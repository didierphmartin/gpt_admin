# Affiliates — Design Spec

**Date:** 2026-05-31
**Status:** Approved (ready for implementation planning)
**Surfaces:** `gpt_admin` (React), `gpt/backend` (PHP), new standalone affiliate portal

---

## 1. Summary

Add affiliate management. Admins manage affiliates and products from a new
**"Affiliates"** main section in `gpt_admin`. Each affiliate gets a unique
**affiliate key** that is appended to a product's sales-page URL to form an
**affiliate link**. When a referred prospect buys a service through that page's
payment form, the selling app reports the purchase to a backend **conversion
endpoint**, which records a **commission** (percentage of sale, or fixed amount).

There are **three surfaces over one data model**:

1. **gpt_admin** (admin-only) — manage affiliates & products, see all earnings,
   mark payouts.
2. **Affiliate portal** (new standalone authenticated page) — each affiliate
   logs in and sees **only their own** statement: their links, earnings per
   product, and every transaction with **paid vs. to-be-paid** totals.
3. **Conversion endpoint** — selling apps report sales (the integration
   contract; wiring each selling app's payment form is separate per-app
   follow-up).

## 2. Key decisions (from brainstorming)

- **Products = your apps/plans.** Each product references one of your
  offerings, has a sales-page base URL and a default commission.
- **Earnings come from real purchases**, reported by the selling app — not
  entered by hand. Admin can seed a couple of test sales for demo.
- **Commission** is configurable per product: either **percent of sale** or a
  **fixed amount**. Optionally **overridden per affiliate-product** to give a
  specific affiliate a different deal.
- **Affiliates are standalone records**, not customers of your apps. But each
  affiliate **does** get an auth identity (`role=affiliate`) so they can log
  into the portal. Reuses the existing auth system.
- **Self-scoping is server-side.** Affiliate-facing endpoints derive
  `affiliate_id` from the token and ignore any id in the request — one
  affiliate can never read another's data.
- **Auth reuse:** admin endpoints sit behind the existing admin JWT /
  `role=admin` middleware; the conversion endpoint reuses the current backend
  auth; affiliate endpoints require `role=affiliate`.
- **Migrations:** delivered as a `.sql` file; the user runs it manually.

## 3. Data model

Four new tables in the gpt backend DB. (Naming follows existing migrations,
e.g. `006_create_packages_table.sql`.)

### 3.1 `affiliates`
| column | type | notes |
|---|---|---|
| `id` | PK | |
| `user_id` | FK → users.id | the provisioned `role=affiliate` auth user |
| `name` | varchar | |
| `email` | varchar | |
| `affiliate_key` | varchar, unique | auto-generated, URL-safe |
| `status` | enum(`active`,`inactive`) | default `active` |
| `created_at` / `updated_at` | timestamps | |

### 3.2 `affiliate_products`
| column | type | notes |
|---|---|---|
| `id` | PK | |
| `name` | varchar | |
| `app_ref` | varchar/nullable | which app/plan this maps to |
| `sales_page_url` | varchar | landing page base URL |
| `commission_type` | enum(`percent`,`fixed`) | default commission type |
| `commission_value` | decimal | percent (e.g. 20.00) or fixed amount |
| `currency` | char(3) | for fixed amounts / reporting |
| `active` | bool | default true |
| `created_at` / `updated_at` | timestamps | |

### 3.3 `affiliate_accounts`
The affiliate's "account" on a product.
| column | type | notes |
|---|---|---|
| `id` | PK | |
| `affiliate_id` | FK → affiliates.id | |
| `product_id` | FK → affiliate_products.id | |
| `commission_type` | enum/nullable | **override**; null = use product default |
| `commission_value` | decimal/nullable | **override**; null = use product default |
| `created_at` | timestamp | |
| | | UNIQUE(`affiliate_id`,`product_id`) |

**Affiliate link** = `product.sales_page_url` + `?ref=<affiliate_key>`
(appended as a query param; `&ref=` if the URL already has a query string).

### 3.4 `affiliate_sales`
One recorded purchase / commission.
| column | type | notes |
|---|---|---|
| `id` | PK | |
| `affiliate_id` | FK → affiliates.id | |
| `product_id` | FK → affiliate_products.id | |
| `sale_amount` | decimal | what the prospect paid |
| `currency` | char(3) | |
| `commission_amount` | decimal | computed at record time |
| `status` | enum(`pending`,`paid`) | default `pending` (`pending` = owed) |
| `external_ref` | varchar/nullable | selling app's order/txn id (idempotency) |
| `occurred_at` | timestamp | when the purchase happened |
| `paid_at` | timestamp/nullable | when payout was made |
| `created_at` | timestamp | |

**Derived figures:**
- earnings per product = Σ `commission_amount` for affiliate+product
- **owed / to-be-paid** = Σ where `status = pending`
- **paid** = Σ where `status = paid`
- total earned = Σ all

## 4. Commission computation

Given a conversion (affiliate key + product + sale amount):
1. Resolve the `affiliate_account` (affiliate_id, product_id). If none exists,
   reject (the affiliate has no account on that product).
2. Effective commission = account override if set, else product default.
3. If `percent`: `commission = sale_amount * value / 100`.
   If `fixed`: `commission = value`.
4. Insert an `affiliate_sales` row with `status = pending`.

Unit-tested in isolation: percent vs. fixed, override vs. default, missing
account, zero/negative guards.

## 5. Backend — `AffiliateController` + routes

### 5.1 Admin routes (existing admin JWT / `role=admin`)
```
GET    /api/v1/admin/affiliates                              list + total earned + owed
POST   /api/v1/admin/affiliates                              create (provisions role=affiliate user)
GET    /api/v1/admin/affiliates/{id}                         info + product accounts (link + earnings)
DELETE /api/v1/admin/affiliates/{id}                         delete
GET    /api/v1/admin/affiliates/{id}/transactions           sales + status + paid/owed totals
POST   /api/v1/admin/affiliates/{id}/accounts               grant product account (+ optional override)
DELETE /api/v1/admin/affiliates/{id}/accounts/{productId}   remove product account
POST   /api/v1/admin/affiliates/{id}/transactions/{saleId}/mark-paid   flip commission to paid

GET    /api/v1/admin/affiliate-products                     list products
POST   /api/v1/admin/affiliate-products                     create
PUT    /api/v1/admin/affiliate-products/{id}                update (name, url, default commission)
DELETE /api/v1/admin/affiliate-products/{id}               delete
```

### 5.2 Affiliate self-scoped routes (`role=affiliate`)
`affiliate_id` is derived from the token; request-supplied ids are ignored.
```
GET    /api/v1/affiliate/me                  own profile + product accounts + links + earnings
GET    /api/v1/affiliate/me/transactions     own transactions + paid/owed totals
```

### 5.3 Conversion endpoint (reuses current backend auth) — the contract
```
POST   /api/v1/affiliate/conversions
body:  { ref, product, amount, currency, external_ref }
```
Resolves affiliate + product from `ref`, computes commission (§4), inserts a
`pending` sale. Idempotent on `external_ref` (don't double-record the same
order). Wiring each selling app's payment form to call this is separate
per-app follow-up.

## 6. Frontend — gpt_admin

Follows existing patterns (`useUsers` hook → `api/client.ts` → backend;
main-view nav + selected-row + tabs in `App.tsx`).

- New **"Affiliates"** entry in `MainView` and the main nav.
- New `api/affiliates.ts` client functions + `useAffiliates` hook.
- **`AffiliatesPanel`**: table of affiliates (name, email, key, total earned,
  owed, # products), "Add affiliate" modal, delete per row.
- **Click a row → detail panel** with tabs:
  - **Overview** — affiliate info; product-accounts table (product, generated
    link with copy button, effective commission rate, earnings); "Add product
    account" (pick product + optional override).
  - **Transactions** — every commission (date, product, sale amount,
    commission, status), with **paid vs. to-be-paid** totals and a "Mark paid"
    action.
- **Products** — a tab within the Affiliates section to define products, their
  sales-page URL, and default commission.

## 7. Frontend — standalone affiliate portal

A small dedicated page/app (its own bundle/entry), reusing the existing login
flow. After a `role=affiliate` user authenticates:
- Landing = **their statement**: product accounts + links, earnings per
  product, and the full transactions list with **paid vs. to-be-paid** totals.
- Calls only the self-scoped `/api/v1/affiliate/me*` endpoints.
- Never exposes admin actions or any other affiliate's data.

(Scaffolding choice — separate Vite entry/app vs. minimal standalone page — to
be settled in the implementation plan; it reuses the existing auth and the
shared client `request()` helper pattern.)

## 8. Attribution flow

1. Admin creates affiliate → auth user (`role=affiliate`) + affiliate key.
2. Admin grants the affiliate an account on a product → link generated
   (`sales_page_url?ref=KEY`).
3. Affiliate shares the link; prospect lands on the product page.
4. Prospect buys via the payment form.
5. Selling app POSTs the conversion → backend records a **pending** commission.
6. Admin sees earnings in gpt_admin; affiliate sees their own statement in the
   portal.
7. Admin pays out and marks commissions **paid** (`pending → paid`).

## 9. Testing

- **Backend (unit):** commission computation (percent/fixed, override vs.
  default, missing account); conversion resolution + idempotency on
  `external_ref`; earnings/owed/paid aggregation; self-scoping (affiliate token
  cannot resolve another affiliate's id).
- **Frontend:** follows existing component conventions; manual verification of
  the admin section and the portal (self-scoping visible — log in as one
  affiliate, confirm no other affiliate's data is reachable).

## 10. Out of scope (explicit follow-ups)

- Wiring each individual selling app's payment form to call the conversion
  endpoint (one integration per app).
- Payout/payment processing itself (we only track `pending`/`paid` status and
  `paid_at`; actual money movement is manual/external for now).
- Migration of this module into the planned shared identity + commerce service
  (the boundary is kept clean so it can move later).

## 11. Notes / alignment

- Reuses existing auth (admin JWT, `role=affiliate`, current backend auth on the
  conversion endpoint) — no new auth system.
- Aligns with the planned shared commerce service (ledger / subscriptions /
  invoicing / statements); built in the gpt backend now with a clean boundary.
- Migration delivered as `.sql`; the user runs it manually.
- Not a git repo at the gpt_admin root, so this spec is saved but not committed.
