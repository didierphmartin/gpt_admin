# Affiliates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add affiliate management — an admin "Affiliates" section in `gpt_admin`, a backend that records purchase-driven commissions, and a standalone self-scoped affiliate portal.

**Architecture:** New tables in the gpt backend DB (`affiliates`, `affiliate_products`, `affiliate_accounts`, `affiliate_sales`). Pure domain helpers (commission calc, key generation, link building) are unit-tested with PHPUnit. A new `AffiliateController` exposes admin CRUD (existing admin JWT), affiliate self-scoped reads (`role=affiliate`), and a conversion endpoint (selling apps report sales). `gpt_admin` gets a new main view + hooks + client; a second Vite entry hosts the affiliate portal.

**Tech Stack:** PHP 8 + FastRoute + PDO/MySQL + PHPUnit (backend); React 19 + TypeScript + Vite + Tailwind 4 (frontend).

**Conventions discovered (follow exactly):**
- Backend controllers: namespace `Quantis\AIPortfolioAssistant\Controllers`, constructor `(PDO $db, array $config)`, methods take `array $request` (+ route params), return arrays. POST body is `$request['body']`; auth user id is `$request['user_id']`. Error returns include `status_code`.
- Routes: `src/routes.php`, FastRoute, handler form `['ControllerName', 'method']`. Controller name (no `Controller` suffix in some, full in others) — use the exact class basename the file uses; existing entries pass e.g. `['AdminController', 'listUsers']`.
- Migrations: numbered `.sql` in `gpt/backend/migrations/`, **the user runs them manually** — never apply.
- Services/domain: `src/Services/`, namespace `Quantis\AIPortfolioAssistant\Services`.
- Tests: `tests/Unit/`, namespace `Quantis\AIPortfolioAssistant\Tests\Unit`, run with `composer test` (PHPUnit 10) from `gpt/backend`.
- Frontend has **no test runner** (only ESLint + `tsc`). Frontend tasks are verified with `npm run build` (runs `tsc -b`) + `npm run lint` + manual checks — do not fabricate a test framework.
- Paths: backend root = `/Applications/XAMPP/xamppfiles/htdocs/gpt/backend`; admin root = `/Applications/XAMPP/xamppfiles/htdocs/gpt_admin`.
- Not a git repo at either root in this environment — `git commit` steps are written for when the user has git initialized; if `git` errors with "not a repository", skip the commit and tell the user.

**Link format:** affiliate link = product `sales_page_url` with `?ref=<affiliate_key>` appended (`&ref=` if the URL already has a `?`).

**Delete semantics (v1):** deleting an affiliate cascades to its accounts and sales (FK `ON DELETE CASCADE`) and removes the linked `role=affiliate` auth user. The admin UI confirms and warns that earnings history is removed.

---

## File Structure

**Backend (create):**
- `migrations/010_create_affiliate_tables.sql` — 4 tables + extend `users.role` enum
- `src/Services/AffiliateCommission.php` — pure commission math
- `src/Services/AffiliateSupport.php` — key generation + link building (pure)
- `src/Services/AffiliateRepository.php` — all PDO data access + aggregation
- `src/Controllers/AffiliateController.php` — admin + self-scope + conversion + products HTTP
- `tests/Unit/AffiliateCommissionTest.php`
- `tests/Unit/AffiliateSupportTest.php`

**Backend (modify):**
- `src/routes.php` — register affiliate routes

**gpt_admin (create):**
- `src/api/affiliates.ts` — typed client functions
- `src/hooks/useAffiliates.ts` — affiliates + detail + transactions
- `src/hooks/useAffiliateProducts.ts` — products CRUD
- `src/components/AffiliatesPanel.tsx` — list + add/delete + selection
- `src/components/AffiliateDetail.tsx` — detail header + tabs container
- `src/components/AffiliateAccountsTab.tsx` — product accounts, links, earnings, add account
- `src/components/AffiliateTransactionsTab.tsx` — transactions + paid/owed + mark paid
- `src/components/AffiliateProductsTab.tsx` — products management

**gpt_admin (modify):**
- `src/App.tsx` — new `MainView` value + nav button + render `AffiliatesPanel`

**Affiliate portal (create):**
- `affiliate.html` — second Vite entry
- `vite.config.ts` (modify) — multi-page `rollupOptions.input`
- `src/portal/main.tsx` — portal entry
- `src/portal/PortalApp.tsx` — login + statement
- `src/portal/portalApi.ts` — self-scoped client

---

## Phase A — Database

### Task 1: Migration for affiliate tables

**Files:**
- Create: `gpt/backend/migrations/010_create_affiliate_tables.sql`

- [ ] **Step 1: Write the migration SQL**

Create `gpt/backend/migrations/010_create_affiliate_tables.sql`:

```sql
/* Migration 010: affiliate management.
   Adds the 'affiliate' role and four tables: affiliates, affiliate_products,
   affiliate_accounts, affiliate_sales. Date: 2026-05-31. */

ALTER TABLE users
  MODIFY COLUMN role ENUM('guest','prospect','user','admin','affiliate') DEFAULT 'prospect';

CREATE TABLE IF NOT EXISTS affiliates (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    affiliate_key VARCHAR(32) NOT NULL,
    status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_affiliate_key (affiliate_key),
    UNIQUE KEY uq_affiliate_user (user_id),
    CONSTRAINT fk_affiliate_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS affiliate_products (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    app_ref          VARCHAR(100) NULL,
    sales_page_url   VARCHAR(1000) NOT NULL,
    commission_type  ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
    commission_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency         CHAR(3) NOT NULL DEFAULT 'USD',
    active           TINYINT(1) NOT NULL DEFAULT 1,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS affiliate_accounts (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    affiliate_id     BIGINT NOT NULL,
    product_id       BIGINT NOT NULL,
    commission_type  ENUM('percent','fixed') NULL,
    commission_value DECIMAL(12,2) NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_affiliate_product (affiliate_id, product_id),
    CONSTRAINT fk_acct_affiliate FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
    CONSTRAINT fk_acct_product   FOREIGN KEY (product_id)   REFERENCES affiliate_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS affiliate_sales (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    affiliate_id      BIGINT NOT NULL,
    product_id        BIGINT NOT NULL,
    sale_amount       DECIMAL(12,2) NOT NULL,
    currency          CHAR(3) NOT NULL DEFAULT 'USD',
    commission_amount DECIMAL(12,2) NOT NULL,
    status            ENUM('pending','paid') NOT NULL DEFAULT 'pending',
    external_ref      VARCHAR(255) NULL,
    occurred_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at           TIMESTAMP NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sale_external (external_ref),
    KEY idx_sale_affiliate (affiliate_id),
    KEY idx_sale_product (product_id),
    CONSTRAINT fk_sale_affiliate FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
    CONSTRAINT fk_sale_product   FOREIGN KEY (product_id)   REFERENCES affiliate_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> Note on `uq_sale_external`: MySQL treats multiple `NULL`s as distinct, so manually-seeded sales without an `external_ref` are allowed; idempotency only applies when the selling app provides one.

- [ ] **Step 2: Hand off to the user to run**

This repo's migrations are run by the user (do not apply). Tell the user:

> "Migration `010_create_affiliate_tables.sql` is ready. Please run it against the backend DB. To verify: `SHOW TABLES LIKE 'affiliate%';` should list 4 tables, and `SHOW COLUMNS FROM users LIKE 'role';` should show `affiliate` in the enum."

- [ ] **Step 3: Commit**

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/gpt/backend
git add migrations/010_create_affiliate_tables.sql
git commit -m "feat(affiliate): add affiliate tables migration"
```

---

## Phase B — Backend domain logic (TDD)

### Task 2: `AffiliateCommission` — commission math

**Files:**
- Create: `gpt/backend/src/Services/AffiliateCommission.php`
- Test: `gpt/backend/tests/Unit/AffiliateCommissionTest.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Unit/AffiliateCommissionTest.php`:

```php
<?php

declare(strict_types=1);

namespace Quantis\AIPortfolioAssistant\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Quantis\AIPortfolioAssistant\Services\AffiliateCommission;

class AffiliateCommissionTest extends TestCase
{
    public function testPercentCommission(): void
    {
        $this->assertSame(20.0, AffiliateCommission::compute('percent', 20.0, 100.0));
    }

    public function testFixedCommissionIgnoresSaleAmount(): void
    {
        $this->assertSame(10.0, AffiliateCommission::compute('fixed', 10.0, 250.0));
    }

    public function testPercentRoundsToCents(): void
    {
        $this->assertSame(3.33, AffiliateCommission::compute('percent', 10.0, 33.33));
    }

    public function testNegativeSaleClampsToZero(): void
    {
        $this->assertSame(0.0, AffiliateCommission::compute('percent', 20.0, -5.0));
    }

    public function testResolveUsesOverrideWhenPresent(): void
    {
        $eff = AffiliateCommission::resolve(
            ['commission_type' => 'fixed', 'commission_value' => 5.0],   // account override
            ['commission_type' => 'percent', 'commission_value' => 20.0] // product default
        );
        $this->assertSame(['fixed', 5.0], $eff);
    }

    public function testResolveFallsBackToProductWhenNoOverride(): void
    {
        $eff = AffiliateCommission::resolve(
            ['commission_type' => null, 'commission_value' => null],
            ['commission_type' => 'percent', 'commission_value' => 20.0]
        );
        $this->assertSame(['percent', 20.0], $eff);
    }

    public function testInvalidTypeThrows(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        AffiliateCommission::compute('bogus', 1.0, 1.0);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Applications/XAMPP/xamppfiles/htdocs/gpt/backend && composer test -- --filter AffiliateCommissionTest`
Expected: FAIL — class `AffiliateCommission` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/Services/AffiliateCommission.php`:

```php
<?php

declare(strict_types=1);

namespace Quantis\AIPortfolioAssistant\Services;

use InvalidArgumentException;

/**
 * Pure commission math for affiliate sales. No DB access — fully unit-tested.
 */
final class AffiliateCommission
{
    /**
     * Compute the commission for a single sale.
     *
     * @param string $type   'percent' or 'fixed'
     * @param float  $value  percent (e.g. 20.0) or fixed amount
     * @param float  $sale   the amount the prospect paid
     * @return float commission rounded to 2 decimals, never negative
     */
    public static function compute(string $type, float $value, float $sale): float
    {
        if ($sale < 0) {
            $sale = 0.0;
        }
        switch ($type) {
            case 'percent':
                return round($sale * $value / 100, 2);
            case 'fixed':
                return round(max(0.0, $value), 2);
            default:
                throw new InvalidArgumentException("Unknown commission type: {$type}");
        }
    }

    /**
     * Resolve the effective (type, value): account override wins when both of
     * its fields are non-null, otherwise the product default is used.
     *
     * @return array{0:string,1:float}
     */
    public static function resolve(array $account, array $product): array
    {
        $type  = $account['commission_type'] ?? null;
        $value = $account['commission_value'] ?? null;
        if ($type !== null && $value !== null) {
            return [(string) $type, (float) $value];
        }
        return [(string) $product['commission_type'], (float) $product['commission_value']];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `composer test -- --filter AffiliateCommissionTest`
Expected: PASS (7 assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/Services/AffiliateCommission.php tests/Unit/AffiliateCommissionTest.php
git commit -m "feat(affiliate): commission math with unit tests"
```

---

### Task 3: `AffiliateSupport` — key generation + link building

**Files:**
- Create: `gpt/backend/src/Services/AffiliateSupport.php`
- Test: `gpt/backend/tests/Unit/AffiliateSupportTest.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Unit/AffiliateSupportTest.php`:

```php
<?php

declare(strict_types=1);

namespace Quantis\AIPortfolioAssistant\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Quantis\AIPortfolioAssistant\Services\AffiliateSupport;

class AffiliateSupportTest extends TestCase
{
    public function testGeneratedKeyIsUrlSafeAndCorrectLength(): void
    {
        $key = AffiliateSupport::generateKey();
        $this->assertSame(16, strlen($key));
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9]+$/', $key);
    }

    public function testKeysAreUnique(): void
    {
        $a = AffiliateSupport::generateKey();
        $b = AffiliateSupport::generateKey();
        $this->assertNotSame($a, $b);
    }

    public function testBuildLinkAppendsRefWithQuestionMark(): void
    {
        $this->assertSame(
            'https://shop.example.com/buy?ref=ABC123',
            AffiliateSupport::buildLink('https://shop.example.com/buy', 'ABC123')
        );
    }

    public function testBuildLinkUsesAmpersandWhenQueryExists(): void
    {
        $this->assertSame(
            'https://shop.example.com/buy?plan=pro&ref=ABC123',
            AffiliateSupport::buildLink('https://shop.example.com/buy?plan=pro', 'ABC123')
        );
    }

    public function testBuildLinkTrimsTrailingWhitespace(): void
    {
        $this->assertSame(
            'https://shop.example.com/buy?ref=K',
            AffiliateSupport::buildLink('  https://shop.example.com/buy  ', 'K')
        );
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `composer test -- --filter AffiliateSupportTest`
Expected: FAIL — class not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/Services/AffiliateSupport.php`:

```php
<?php

declare(strict_types=1);

namespace Quantis\AIPortfolioAssistant\Services;

/**
 * Pure helpers for affiliate keys and link construction. No DB access.
 */
final class AffiliateSupport
{
    private const KEY_LENGTH = 16;
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    /** Generate a URL-safe random affiliate key. Uniqueness vs. the DB is the caller's job. */
    public static function generateKey(): string
    {
        $max = strlen(self::ALPHABET) - 1;
        $out = '';
        for ($i = 0; $i < self::KEY_LENGTH; $i++) {
            $out .= self::ALPHABET[random_int(0, $max)];
        }
        return $out;
    }

    /** Append ?ref=KEY (or &ref=KEY) to a sales-page URL. */
    public static function buildLink(string $salesPageUrl, string $key): string
    {
        $url = trim($salesPageUrl);
        $sep = str_contains($url, '?') ? '&' : '?';
        return $url . $sep . 'ref=' . rawurlencode($key);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `composer test -- --filter AffiliateSupportTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/Services/AffiliateSupport.php tests/Unit/AffiliateSupportTest.php
git commit -m "feat(affiliate): key generation + link building with unit tests"
```

---

### Task 4: `AffiliateRepository` — data access + aggregation

**Files:**
- Create: `gpt/backend/src/Services/AffiliateRepository.php`

This is thin PDO data access (verified end-to-end via the controller tasks and manual SQL — unit testing PDO is out of pattern for this repo). Write it in full so later tasks can call it.

- [ ] **Step 1: Write the repository**

Create `src/Services/AffiliateRepository.php`:

```php
<?php

declare(strict_types=1);

namespace Quantis\AIPortfolioAssistant\Services;

use PDO;

/**
 * All affiliate-related data access + earnings aggregation. Controllers call
 * this; it never decides HTTP status. Commission math lives in
 * AffiliateCommission; link/key helpers in AffiliateSupport.
 */
class AffiliateRepository
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    // ---- Affiliates -------------------------------------------------------

    /** List affiliates with total earned + owed (pending). */
    public function listAffiliates(): array
    {
        $sql = "
            SELECT a.id, a.user_id, a.name, a.email, a.affiliate_key, a.status, a.created_at,
                   COALESCE(SUM(s.commission_amount), 0) AS total_earned,
                   COALESCE(SUM(CASE WHEN s.status='pending' THEN s.commission_amount ELSE 0 END), 0) AS owed,
                   COUNT(DISTINCT acc.id) AS product_count
            FROM affiliates a
            LEFT JOIN affiliate_sales s    ON s.affiliate_id = a.id
            LEFT JOIN affiliate_accounts acc ON acc.affiliate_id = a.id
            GROUP BY a.id
            ORDER BY a.created_at DESC";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findAffiliate(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM affiliates WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findAffiliateByUserId(int $userId): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM affiliates WHERE user_id = :uid LIMIT 1");
        $stmt->execute([':uid' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findAffiliateByKey(string $key): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM affiliates WHERE affiliate_key = :k LIMIT 1");
        $stmt->execute([':k' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function keyExists(string $key): bool
    {
        $stmt = $this->db->prepare("SELECT 1 FROM affiliates WHERE affiliate_key = :k LIMIT 1");
        $stmt->execute([':k' => $key]);
        return (bool) $stmt->fetchColumn();
    }

    /** Insert an affiliate row. Returns new id. */
    public function insertAffiliate(int $userId, string $name, string $email, string $key): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO affiliates (user_id, name, email, affiliate_key)
             VALUES (:uid, :name, :email, :key)"
        );
        $stmt->execute([':uid' => $userId, ':name' => $name, ':email' => $email, ':key' => $key]);
        return (int) $this->db->lastInsertId();
    }

    /** Delete affiliate (accounts + sales cascade via FK). Returns affected rows. */
    public function deleteAffiliate(int $id): int
    {
        $stmt = $this->db->prepare("DELETE FROM affiliates WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->rowCount();
    }

    // ---- Products ---------------------------------------------------------

    public function listProducts(): array
    {
        return $this->db->query("SELECT * FROM affiliate_products ORDER BY name ASC")
            ->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findProduct(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM affiliate_products WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function insertProduct(array $p): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO affiliate_products (name, app_ref, sales_page_url, commission_type, commission_value, currency, active)
             VALUES (:name, :app_ref, :url, :ctype, :cval, :cur, :active)"
        );
        $stmt->execute([
            ':name' => $p['name'], ':app_ref' => $p['app_ref'], ':url' => $p['sales_page_url'],
            ':ctype' => $p['commission_type'], ':cval' => $p['commission_value'],
            ':cur' => $p['currency'], ':active' => $p['active'],
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function updateProduct(int $id, array $p): void
    {
        $stmt = $this->db->prepare(
            "UPDATE affiliate_products
             SET name=:name, app_ref=:app_ref, sales_page_url=:url, commission_type=:ctype,
                 commission_value=:cval, currency=:cur, active=:active
             WHERE id=:id"
        );
        $stmt->execute([
            ':id' => $id, ':name' => $p['name'], ':app_ref' => $p['app_ref'], ':url' => $p['sales_page_url'],
            ':ctype' => $p['commission_type'], ':cval' => $p['commission_value'],
            ':cur' => $p['currency'], ':active' => $p['active'],
        ]);
    }

    public function deleteProduct(int $id): int
    {
        $stmt = $this->db->prepare("DELETE FROM affiliate_products WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->rowCount();
    }

    // ---- Accounts ---------------------------------------------------------

    /** Product accounts for an affiliate, joined to product + per-product earnings. */
    public function accountsForAffiliate(int $affiliateId): array
    {
        $sql = "
            SELECT acc.id AS account_id, acc.affiliate_id, acc.product_id,
                   acc.commission_type AS override_type, acc.commission_value AS override_value,
                   p.name AS product_name, p.sales_page_url, p.currency,
                   p.commission_type AS product_type, p.commission_value AS product_value,
                   COALESCE(SUM(s.commission_amount), 0) AS earnings,
                   COALESCE(SUM(CASE WHEN s.status='pending' THEN s.commission_amount ELSE 0 END), 0) AS owed
            FROM affiliate_accounts acc
            JOIN affiliate_products p ON p.id = acc.product_id
            LEFT JOIN affiliate_sales s
                   ON s.affiliate_id = acc.affiliate_id AND s.product_id = acc.product_id
            WHERE acc.affiliate_id = :aid
            GROUP BY acc.id
            ORDER BY p.name ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':aid' => $affiliateId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findAccount(int $affiliateId, int $productId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM affiliate_accounts WHERE affiliate_id = :a AND product_id = :p LIMIT 1"
        );
        $stmt->execute([':a' => $affiliateId, ':p' => $productId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function insertAccount(int $affiliateId, int $productId, ?string $type, ?float $value): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO affiliate_accounts (affiliate_id, product_id, commission_type, commission_value)
             VALUES (:a, :p, :t, :v)"
        );
        $stmt->execute([':a' => $affiliateId, ':p' => $productId, ':t' => $type, ':v' => $value]);
        return (int) $this->db->lastInsertId();
    }

    public function deleteAccount(int $affiliateId, int $productId): int
    {
        $stmt = $this->db->prepare(
            "DELETE FROM affiliate_accounts WHERE affiliate_id = :a AND product_id = :p"
        );
        $stmt->execute([':a' => $affiliateId, ':p' => $productId]);
        return $stmt->rowCount();
    }

    // ---- Sales ------------------------------------------------------------

    public function transactionsForAffiliate(int $affiliateId): array
    {
        $sql = "
            SELECT s.id, s.product_id, p.name AS product_name, s.sale_amount, s.currency,
                   s.commission_amount, s.status, s.external_ref, s.occurred_at, s.paid_at
            FROM affiliate_sales s
            JOIN affiliate_products p ON p.id = s.product_id
            WHERE s.affiliate_id = :aid
            ORDER BY s.occurred_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':aid' => $affiliateId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function insertSale(int $affiliateId, int $productId, float $sale, string $currency, float $commission, ?string $externalRef): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO affiliate_sales (affiliate_id, product_id, sale_amount, currency, commission_amount, external_ref)
             VALUES (:a, :p, :sale, :cur, :comm, :ext)"
        );
        $stmt->execute([
            ':a' => $affiliateId, ':p' => $productId, ':sale' => $sale,
            ':cur' => $currency, ':comm' => $commission, ':ext' => $externalRef,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function saleByExternalRef(string $ref): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM affiliate_sales WHERE external_ref = :r LIMIT 1");
        $stmt->execute([':r' => $ref]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function markSalePaid(int $affiliateId, int $saleId): int
    {
        $stmt = $this->db->prepare(
            "UPDATE affiliate_sales SET status='paid', paid_at=NOW()
             WHERE id = :id AND affiliate_id = :aid AND status='pending'"
        );
        $stmt->execute([':id' => $saleId, ':aid' => $affiliateId]);
        return $stmt->rowCount();
    }
}
```

- [ ] **Step 2: Syntax check**

Run: `cd /Applications/XAMPP/xamppfiles/htdocs/gpt/backend && php -l src/Services/AffiliateRepository.php`
Expected: `No syntax errors detected`.

- [ ] **Step 3: Commit**

```bash
git add src/Services/AffiliateRepository.php
git commit -m "feat(affiliate): repository data access + aggregation"
```

---

## Phase C — Backend HTTP (controller + routes)

### Task 5: `AffiliateController` — full controller

**Files:**
- Create: `gpt/backend/src/Controllers/AffiliateController.php`

Implements admin CRUD, affiliate self-scope, products, and the conversion endpoint. Mirrors `PackageController`'s `requireAdmin` pattern and adds `requireAffiliate`.

- [ ] **Step 1: Write the controller**

Create `src/Controllers/AffiliateController.php`:

```php
<?php

declare(strict_types=1);

namespace Quantis\AIPortfolioAssistant\Controllers;

use Quantis\AIPortfolioAssistant\Services\AffiliateRepository;
use Quantis\AIPortfolioAssistant\Services\AffiliateCommission;
use Quantis\AIPortfolioAssistant\Services\AffiliateSupport;
use PDO;

/**
 * Affiliate management.
 *
 * Admin (existing admin JWT):      /api/v1/admin/affiliates*, /api/v1/admin/affiliate-products*
 * Affiliate self-scope (role=affiliate): /api/v1/affiliate/me, /api/v1/affiliate/me/transactions
 * Conversion (any authenticated caller / selling app): POST /api/v1/affiliate/conversions
 */
class AffiliateController
{
    private PDO $db;
    private array $config;
    private AffiliateRepository $repo;

    public function __construct(PDO $db, array $config)
    {
        $this->db = $db;
        $this->config = $config;
        $this->repo = new AffiliateRepository($db);
    }

    // ===== Admin: affiliates ==============================================

    public function adminList(array $request): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        return ['success' => true, 'affiliates' => $this->repo->listAffiliates()];
    }

    public function adminGet(array $request, int $id): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        $affiliate = $this->repo->findAffiliate($id);
        if (!$affiliate) return $this->notFound('Affiliate');
        return [
            'success' => true,
            'affiliate' => $affiliate,
            'accounts' => $this->decorateAccounts($this->repo->accountsForAffiliate($id)),
        ];
    }

    public function adminCreate(array $request): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        $body = $request['body'] ?? [];
        $name = trim($body['name'] ?? '');
        $email = trim($body['email'] ?? '');
        $password = (string) ($body['password'] ?? '');
        if ($name === '' || $email === '' || $password === '') {
            return $this->badRequest('name, email and password are required');
        }

        // Provision the role=affiliate auth user, then the affiliate row, atomically.
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO users (email, password, first_name, role, provider, created_at, updated_at)
                 VALUES (:email, :password, :name, 'affiliate', 'email', NOW(), NOW())"
            );
            $stmt->execute([
                ':email' => $email,
                ':password' => password_hash($password, PASSWORD_DEFAULT),
                ':name' => $name,
            ]);
            $userId = (int) $this->db->lastInsertId();

            do { $key = AffiliateSupport::generateKey(); } while ($this->repo->keyExists($key));
            $affiliateId = $this->repo->insertAffiliate($userId, $name, $email, $key);

            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            if (str_contains($e->getMessage(), 'Duplicate') || str_contains($e->getMessage(), '1062')) {
                return $this->badRequest('A user with that email already exists');
            }
            throw $e;
        }

        return ['success' => true, 'affiliate_id' => $affiliateId, 'affiliate_key' => $key];
    }

    public function adminDelete(array $request, int $id): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        $affiliate = $this->repo->findAffiliate($id);
        if (!$affiliate) return $this->notFound('Affiliate');
        // Deleting the linked user cascades to the affiliate row (FK ON DELETE CASCADE),
        // which in turn cascades to accounts + sales.
        $stmt = $this->db->prepare("DELETE FROM users WHERE id = :uid");
        $stmt->execute([':uid' => (int) $affiliate['user_id']]);
        return ['success' => true];
    }

    // ===== Admin: accounts ================================================

    public function adminAddAccount(array $request, int $id): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        if (!$this->repo->findAffiliate($id)) return $this->notFound('Affiliate');
        $body = $request['body'] ?? [];
        $productId = (int) ($body['product_id'] ?? 0);
        if (!$this->repo->findProduct($productId)) return $this->badRequest('Unknown product');
        if ($this->repo->findAccount($id, $productId)) return $this->badRequest('Account already exists');

        [$type, $value] = $this->readOptionalOverride($body);
        $this->repo->insertAccount($id, $productId, $type, $value);
        return ['success' => true];
    }

    public function adminDeleteAccount(array $request, int $id, int $productId): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        $this->repo->deleteAccount($id, $productId);
        return ['success' => true];
    }

    // ===== Admin: transactions ============================================

    public function adminTransactions(array $request, int $id): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        if (!$this->repo->findAffiliate($id)) return $this->notFound('Affiliate');
        return $this->transactionsPayload($id);
    }

    public function adminMarkPaid(array $request, int $id, int $saleId): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        $updated = $this->repo->markSalePaid($id, $saleId);
        return ['success' => true, 'updated' => $updated];
    }

    // ===== Admin: products ================================================

    public function adminListProducts(array $request): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        return ['success' => true, 'products' => $this->repo->listProducts()];
    }

    public function adminCreateProduct(array $request): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        $p = $this->validateProduct($request['body'] ?? []);
        if (isset($p['error'])) return $p;
        $pid = $this->repo->insertProduct($p);
        return ['success' => true, 'product_id' => $pid];
    }

    public function adminUpdateProduct(array $request, int $id): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        if (!$this->repo->findProduct($id)) return $this->notFound('Product');
        $p = $this->validateProduct($request['body'] ?? []);
        if (isset($p['error'])) return $p;
        $this->repo->updateProduct($id, $p);
        return ['success' => true];
    }

    public function adminDeleteProduct(array $request, int $id): array
    {
        if ($err = $this->requireAdmin($request)) return $err;
        $this->repo->deleteProduct($id);
        return ['success' => true];
    }

    // ===== Affiliate self-scope ===========================================

    public function me(array $request): array
    {
        $affiliate = $this->requireAffiliate($request);
        if (isset($affiliate['error'])) return $affiliate;
        return [
            'success' => true,
            'affiliate' => [
                'id' => $affiliate['id'], 'name' => $affiliate['name'],
                'email' => $affiliate['email'], 'affiliate_key' => $affiliate['affiliate_key'],
                'status' => $affiliate['status'],
            ],
            'accounts' => $this->decorateAccounts($this->repo->accountsForAffiliate((int) $affiliate['id'])),
        ];
    }

    public function myTransactions(array $request): array
    {
        $affiliate = $this->requireAffiliate($request);
        if (isset($affiliate['error'])) return $affiliate;
        return $this->transactionsPayload((int) $affiliate['id']);
    }

    // ===== Conversion (selling apps) ======================================

    public function recordConversion(array $request): array
    {
        if (!($request['user_id'] ?? null)) {
            return ['success' => false, 'error' => 'Authentication required', 'status_code' => 401];
        }
        $body = $request['body'] ?? [];
        $ref = trim((string) ($body['ref'] ?? ''));
        $productId = (int) ($body['product'] ?? 0);
        $amount = (float) ($body['amount'] ?? 0);
        $currency = strtoupper(trim((string) ($body['currency'] ?? 'USD'))) ?: 'USD';
        $externalRef = isset($body['external_ref']) ? trim((string) $body['external_ref']) : null;
        if ($externalRef === '') $externalRef = null;

        if ($ref === '' || $productId <= 0 || $amount <= 0) {
            return $this->badRequest('ref, product and a positive amount are required');
        }

        // Idempotency: if this external_ref was already recorded, return it.
        if ($externalRef !== null && ($existing = $this->repo->saleByExternalRef($externalRef))) {
            return ['success' => true, 'sale_id' => (int) $existing['id'], 'duplicate' => true];
        }

        $affiliate = $this->repo->findAffiliateByKey($ref);
        if (!$affiliate) return $this->badRequest('Unknown affiliate ref');
        $product = $this->repo->findProduct($productId);
        if (!$product) return $this->badRequest('Unknown product');
        $account = $this->repo->findAccount((int) $affiliate['id'], $productId);
        if (!$account) return $this->badRequest('Affiliate has no account on this product');

        [$type, $value] = AffiliateCommission::resolve($account, $product);
        $commission = AffiliateCommission::compute($type, $value, $amount);
        $saleId = $this->repo->insertSale((int) $affiliate['id'], $productId, $amount, $currency, $commission, $externalRef);

        return ['success' => true, 'sale_id' => $saleId, 'commission_amount' => $commission];
    }

    // ===== Helpers ========================================================

    private function transactionsPayload(int $affiliateId): array
    {
        $rows = $this->repo->transactionsForAffiliate($affiliateId);
        $paid = 0.0; $owed = 0.0;
        foreach ($rows as $r) {
            if ($r['status'] === 'paid') $paid += (float) $r['commission_amount'];
            else $owed += (float) $r['commission_amount'];
        }
        return [
            'success' => true,
            'transactions' => $rows,
            'totals' => ['paid' => round($paid, 2), 'owed' => round($owed, 2), 'total' => round($paid + $owed, 2)],
        ];
    }

    /** Add effective commission + generated link to each account row. */
    private function decorateAccounts(array $accounts): array
    {
        foreach ($accounts as &$a) {
            [$type, $value] = AffiliateCommission::resolve(
                ['commission_type' => $a['override_type'], 'commission_value' => $a['override_value']],
                ['commission_type' => $a['product_type'], 'commission_value' => $a['product_value']]
            );
            $a['effective_type'] = $type;
            $a['effective_value'] = $value;
            // affiliate_key is not on the account row; resolve via the affiliate.
            $affiliate = $this->repo->findAffiliate((int) $a['affiliate_id']);
            $a['link'] = $affiliate
                ? AffiliateSupport::buildLink($a['sales_page_url'], $affiliate['affiliate_key'])
                : null;
        }
        return $accounts;
    }

    private function readOptionalOverride(array $body): array
    {
        $type = $body['commission_type'] ?? null;
        $value = $body['commission_value'] ?? null;
        if ($type === '' || $type === null || $value === '' || $value === null) {
            return [null, null];
        }
        if (!in_array($type, ['percent', 'fixed'], true)) return [null, null];
        return [(string) $type, (float) $value];
    }

    private function validateProduct(array $body): array
    {
        $name = trim($body['name'] ?? '');
        $url = trim($body['sales_page_url'] ?? '');
        $type = $body['commission_type'] ?? 'percent';
        if ($name === '' || $url === '') return $this->badRequest('name and sales_page_url are required');
        if (!in_array($type, ['percent', 'fixed'], true)) return $this->badRequest('commission_type must be percent or fixed');
        return [
            'name' => $name,
            'app_ref' => trim($body['app_ref'] ?? '') ?: null,
            'sales_page_url' => $url,
            'commission_type' => $type,
            'commission_value' => (float) ($body['commission_value'] ?? 0),
            'currency' => strtoupper(trim($body['currency'] ?? 'USD')) ?: 'USD',
            'active' => !empty($body['active']) ? 1 : 0,
        ];
    }

    private function requireAdmin(array $request): ?array
    {
        $userId = $request['user_id'] ?? null;
        if (!$userId) return ['success' => false, 'error' => 'Authentication required', 'status_code' => 401];
        $stmt = $this->db->prepare('SELECT role FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user || ($user['role'] ?? '') !== 'admin') {
            return ['success' => false, 'error' => 'Admin access required', 'status_code' => 403];
        }
        return null;
    }

    /** Returns the affiliate row for the authenticated user, or an error array. */
    private function requireAffiliate(array $request): array
    {
        $userId = $request['user_id'] ?? null;
        if (!$userId) return ['error' => true, 'success' => false, 'message' => 'Authentication required', 'status_code' => 401];
        $affiliate = $this->repo->findAffiliateByUserId((int) $userId);
        if (!$affiliate) return ['error' => true, 'success' => false, 'message' => 'Affiliate access required', 'status_code' => 403];
        return $affiliate;
    }

    private function notFound(string $what): array
    {
        return ['success' => false, 'error' => "{$what} not found", 'status_code' => 404];
    }

    private function badRequest(string $msg): array
    {
        return ['success' => false, 'error' => $msg, 'status_code' => 400];
    }
}
```

- [ ] **Step 2: Syntax check**

Run: `php -l src/Controllers/AffiliateController.php`
Expected: `No syntax errors detected`.

- [ ] **Step 3: Commit**

```bash
git add src/Controllers/AffiliateController.php
git commit -m "feat(affiliate): controller (admin, self-scope, conversion, products)"
```

---

### Task 6: Register routes

**Files:**
- Modify: `gpt/backend/src/routes.php`

- [ ] **Step 1: Add the routes**

Find the package routes block (around line 59-61, the `PackageController` admin routes). Immediately **after** that block, insert:

```php
        // ============================================
        // AFFILIATE ROUTES
        // ============================================
        // Admin (existing admin JWT / role=admin enforced in controller)
        $r->get('/api/v1/admin/affiliates', ['AffiliateController', 'adminList']);
        $r->post('/api/v1/admin/affiliates', ['AffiliateController', 'adminCreate']);
        $r->get('/api/v1/admin/affiliates/{id:\d+}', ['AffiliateController', 'adminGet']);
        $r->delete('/api/v1/admin/affiliates/{id:\d+}', ['AffiliateController', 'adminDelete']);
        $r->get('/api/v1/admin/affiliates/{id:\d+}/transactions', ['AffiliateController', 'adminTransactions']);
        $r->post('/api/v1/admin/affiliates/{id:\d+}/accounts', ['AffiliateController', 'adminAddAccount']);
        $r->delete('/api/v1/admin/affiliates/{id:\d+}/accounts/{productId:\d+}', ['AffiliateController', 'adminDeleteAccount']);
        $r->post('/api/v1/admin/affiliates/{id:\d+}/transactions/{saleId:\d+}/mark-paid', ['AffiliateController', 'adminMarkPaid']);

        $r->get('/api/v1/admin/affiliate-products', ['AffiliateController', 'adminListProducts']);
        $r->post('/api/v1/admin/affiliate-products', ['AffiliateController', 'adminCreateProduct']);
        $r->put('/api/v1/admin/affiliate-products/{id:\d+}', ['AffiliateController', 'adminUpdateProduct']);
        $r->delete('/api/v1/admin/affiliate-products/{id:\d+}', ['AffiliateController', 'adminDeleteProduct']);

        // Affiliate self-scope (role=affiliate enforced in controller)
        $r->get('/api/v1/affiliate/me', ['AffiliateController', 'me']);
        $r->get('/api/v1/affiliate/me/transactions', ['AffiliateController', 'myTransactions']);

        // Conversion endpoint — selling apps report a sale
        $r->post('/api/v1/affiliate/conversions', ['AffiliateController', 'recordConversion']);
```

- [ ] **Step 2: Syntax check**

Run: `php -l src/routes.php`
Expected: `No syntax errors detected`.

- [ ] **Step 3: Verify the controller resolves**

Confirm `getControllerClass('AffiliateController')` resolves to the new class (same mechanism used by `AdminController`/`PackageController`). Grep the resolver:

Run: `grep -n "function getControllerClass" src/routes.php`
Then read that function and confirm it maps `'AffiliateController'` → `Quantis\AIPortfolioAssistant\Controllers\AffiliateController` (the namespace our file uses). If the resolver uses a hardcoded map, add an `AffiliateController` entry following the existing pattern.

- [ ] **Step 4: Manual smoke test (requires migration run + a logged-in admin token)**

Ask the user to run the migration (Task 1) first. Then, with an admin bearer token in `$TOKEN`:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/gpt/backend/api/v1/admin/affiliates | head
```
Expected: `{"success":true,"affiliates":[]}`.

- [ ] **Step 5: Commit**

```bash
git add src/routes.php
git commit -m "feat(affiliate): register routes"
```

---

### Task 7: End-to-end backend verification (manual)

**Files:** none (verification only)

- [ ] **Step 1: Create a product, affiliate, account; record a conversion; check earnings**

With admin token `$TOKEN` and backend running:

```bash
B=http://localhost/gpt/backend/api/v1
# 1. product
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Pro Plan","sales_page_url":"https://shop.example.com/pro","commission_type":"percent","commission_value":20,"currency":"USD","active":1}' \
  $B/admin/affiliate-products
# note the product_id, call it PID
# 2. affiliate
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Jane Aff","email":"jane.aff@example.com","password":"secret123"}' \
  $B/admin/affiliates
# note affiliate_id (AID) and affiliate_key (KEY)
# 3. grant account
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"product_id\":PID}" $B/admin/affiliates/AID/accounts
# 4. record a conversion (any authenticated token works; reuse $TOKEN)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"ref\":\"KEY\",\"product\":PID,\"amount\":100,\"currency\":\"USD\",\"external_ref\":\"order-1\"}" \
  $B/affiliate/conversions
# expect commission_amount: 20
# 5. earnings show up
curl -s -H "Authorization: Bearer $TOKEN" $B/admin/affiliates/AID
```
Expected: account row with `earnings: 20.00`, `link` ending `?ref=KEY`. Re-running step 4 with the same `external_ref` returns `"duplicate":true` and does not double-count.

- [ ] **Step 2: Verify self-scope as the affiliate**

Log in as `jane.aff@example.com` / `secret123` via the existing login endpoint to get an affiliate token `$ATOKEN`:

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"jane.aff@example.com","password":"secret123"}' \
  $B/auth/login
# extract token -> $ATOKEN
curl -s -H "Authorization: Bearer $ATOKEN" $B/affiliate/me
curl -s -H "Authorization: Bearer $ATOKEN" $B/affiliate/me/transactions
```
Expected: only Jane's data; `totals.owed` = 20. Confirm an affiliate token cannot hit `/admin/affiliates` (403).

---

## Phase D — gpt_admin frontend

> All paths below are under `/Applications/XAMPP/xamppfiles/htdocs/gpt_admin`. Verification per task: `npm run build` (type-check) + `npm run lint`, plus the manual UI check noted.

### Task 8: API client `src/api/affiliates.ts`

**Files:**
- Create: `gpt_admin/src/api/affiliates.ts`

- [ ] **Step 1: Write the client + shared request helper**

The existing `src/api/client.ts` keeps `request()` private. Create a self-contained client reusing the same auth/headers approach. Create `src/api/affiliates.ts`:

```typescript
const API_BASE = '/gpt/backend/api/v1/admin';

function getAuthToken(): string | null {
  return localStorage.getItem('token') || localStorage.getItem('voice_token') || null;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getAuthToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options?.headers } });
  if (res.status === 401) {
    window.location.href = '/gpt/frontend/login.html?redirect=' + encodeURIComponent(window.location.href);
    throw new Error('Authentication required');
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || data.message || 'Request failed');
  return data as T;
}

// ---- Types ----
export interface AffiliateListRow {
  id: number;
  user_id: number;
  name: string;
  email: string;
  affiliate_key: string;
  status: 'active' | 'inactive';
  created_at: string;
  total_earned: string;
  owed: string;
  product_count: number;
}

export interface AffiliateAccount {
  account_id: number;
  affiliate_id: number;
  product_id: number;
  product_name: string;
  sales_page_url: string;
  currency: string;
  effective_type: 'percent' | 'fixed';
  effective_value: number;
  earnings: string;
  owed: string;
  link: string | null;
}

export interface AffiliateDetail {
  id: number;
  name: string;
  email: string;
  affiliate_key: string;
  status: string;
}

export interface AffiliateTransaction {
  id: number;
  product_id: number;
  product_name: string;
  sale_amount: string;
  currency: string;
  commission_amount: string;
  status: 'pending' | 'paid';
  external_ref: string | null;
  occurred_at: string;
  paid_at: string | null;
}

export interface TransactionTotals { paid: number; owed: number; total: number; }

export interface AffiliateProduct {
  id: number;
  name: string;
  app_ref: string | null;
  sales_page_url: string;
  commission_type: 'percent' | 'fixed';
  commission_value: string;
  currency: string;
  active: number;
}

// ---- Affiliates ----
export const listAffiliates = () =>
  request<{ success: boolean; affiliates: AffiliateListRow[] }>(`${API_BASE}/affiliates`);

export const getAffiliate = (id: number) =>
  request<{ success: boolean; affiliate: AffiliateDetail; accounts: AffiliateAccount[] }>(`${API_BASE}/affiliates/${id}`);

export const createAffiliate = (name: string, email: string, password: string) =>
  request<{ success: boolean; affiliate_id: number; affiliate_key: string }>(`${API_BASE}/affiliates`, {
    method: 'POST', body: JSON.stringify({ name, email, password }),
  });

export const deleteAffiliate = (id: number) =>
  request<{ success: boolean }>(`${API_BASE}/affiliates/${id}`, { method: 'DELETE' });

export const getAffiliateTransactions = (id: number) =>
  request<{ success: boolean; transactions: AffiliateTransaction[]; totals: TransactionTotals }>(
    `${API_BASE}/affiliates/${id}/transactions`);

export const markTransactionPaid = (id: number, saleId: number) =>
  request<{ success: boolean; updated: number }>(
    `${API_BASE}/affiliates/${id}/transactions/${saleId}/mark-paid`, { method: 'POST' });

export const addAffiliateAccount = (
  id: number, productId: number, override?: { commission_type: 'percent' | 'fixed'; commission_value: number }
) =>
  request<{ success: boolean }>(`${API_BASE}/affiliates/${id}/accounts`, {
    method: 'POST', body: JSON.stringify({ product_id: productId, ...override }),
  });

export const deleteAffiliateAccount = (id: number, productId: number) =>
  request<{ success: boolean }>(`${API_BASE}/affiliates/${id}/accounts/${productId}`, { method: 'DELETE' });

// ---- Products ----
export const listAffiliateProducts = () =>
  request<{ success: boolean; products: AffiliateProduct[] }>(`${API_BASE}/affiliate-products`);

export interface ProductInput {
  name: string; app_ref?: string | null; sales_page_url: string;
  commission_type: 'percent' | 'fixed'; commission_value: number; currency: string; active: number;
}

export const createAffiliateProduct = (p: ProductInput) =>
  request<{ success: boolean; product_id: number }>(`${API_BASE}/affiliate-products`, {
    method: 'POST', body: JSON.stringify(p),
  });

export const updateAffiliateProduct = (id: number, p: ProductInput) =>
  request<{ success: boolean }>(`${API_BASE}/affiliate-products/${id}`, {
    method: 'PUT', body: JSON.stringify(p),
  });

export const deleteAffiliateProduct = (id: number) =>
  request<{ success: boolean }>(`${API_BASE}/affiliate-products/${id}`, { method: 'DELETE' });
```

- [ ] **Step 2: Type-check**

Run: `cd /Applications/XAMPP/xamppfiles/htdocs/gpt_admin && npm run build`
Expected: build succeeds (no TS errors). *(Component not imported yet; this just type-checks the client.)*

- [ ] **Step 3: Commit**

```bash
git add src/api/affiliates.ts
git commit -m "feat(affiliate): gpt_admin api client"
```

---

### Task 9: Hooks `useAffiliates` + `useAffiliateProducts`

**Files:**
- Create: `gpt_admin/src/hooks/useAffiliates.ts`
- Create: `gpt_admin/src/hooks/useAffiliateProducts.ts`

- [ ] **Step 1: Write `useAffiliates.ts`** (mirrors `useUsers` structure)

```typescript
import { useState, useCallback } from 'react';
import * as api from '../api/affiliates';

export function useAffiliates() {
  const [affiliates, setAffiliates] = useState<api.AffiliateListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAffiliates = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.listAffiliates();
      setAffiliates(data.affiliates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch affiliates');
    } finally { setLoading(false); }
  }, []);

  const createAffiliate = useCallback(async (name: string, email: string, password: string) => {
    setError(null);
    try {
      const res = await api.createAffiliate(name, email, password);
      await fetchAffiliates();
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create affiliate');
      return null;
    }
  }, [fetchAffiliates]);

  const deleteAffiliate = useCallback(async (id: number) => {
    setError(null);
    try {
      await api.deleteAffiliate(id);
      await fetchAffiliates();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete affiliate');
      return false;
    }
  }, [fetchAffiliates]);

  return { affiliates, loading, error, fetchAffiliates, createAffiliate, deleteAffiliate };
}
```

- [ ] **Step 2: Write `useAffiliateProducts.ts`**

```typescript
import { useState, useCallback } from 'react';
import * as api from '../api/affiliates';

export function useAffiliateProducts() {
  const [products, setProducts] = useState<api.AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.listAffiliateProducts();
      setProducts(data.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally { setLoading(false); }
  }, []);

  const saveProduct = useCallback(async (p: api.ProductInput, id?: number) => {
    setError(null);
    try {
      if (id) await api.updateAffiliateProduct(id, p);
      else await api.createAffiliateProduct(p);
      await fetchProducts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
      return false;
    }
  }, [fetchProducts]);

  const removeProduct = useCallback(async (id: number) => {
    setError(null);
    try {
      await api.deleteAffiliateProduct(id);
      await fetchProducts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      return false;
    }
  }, [fetchProducts]);

  return { products, loading, error, fetchProducts, saveProduct, removeProduct };
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npm run build`
Expected: success.

```bash
git add src/hooks/useAffiliates.ts src/hooks/useAffiliateProducts.ts
git commit -m "feat(affiliate): gpt_admin hooks"
```

---

### Task 10: `AffiliatesPanel` — list + add + delete + selection

**Files:**
- Create: `gpt_admin/src/components/AffiliatesPanel.tsx`

- [ ] **Step 1: Write the panel**

```tsx
import { useEffect, useState } from 'react';
import { useAffiliates } from '../hooks/useAffiliates';
import { AffiliateDetail } from './AffiliateDetail';
import { AffiliateProductsTab } from './AffiliateProductsTab';

export function AffiliatesPanel() {
  const { affiliates, loading, error, fetchAffiliates, createAffiliate, deleteAffiliate } = useAffiliates();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<'affiliates' | 'products'>('affiliates');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createAffiliate(form.name, form.email, form.password);
    if (res) {
      setNewKey(res.affiliate_key);
      setForm({ name: '', email: '', password: '' });
      setShowForm(false);
    }
  };

  const onDelete = async (id: number, name: string) => {
    if (confirm(`Delete affiliate "${name}"? This removes their login and all earnings history.`)) {
      await deleteAffiliate(id);
      if (selectedId === id) setSelectedId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        <button onClick={() => setView('affiliates')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${view === 'affiliates' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
          Affiliates
        </button>
        <button onClick={() => setView('products')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${view === 'products' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
          Products
        </button>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
      {newKey && (
        <div className="p-4 bg-green-50 text-green-800 rounded-lg flex justify-between items-center">
          <span>Affiliate created. Key: <code className="font-mono">{newKey}</code></span>
          <button onClick={() => setNewKey(null)} className="text-green-700 hover:text-green-900">Dismiss</button>
        </div>
      )}

      {view === 'products' && (
        <div className="bg-white rounded-lg shadow p-6"><AffiliateProductsTab /></div>
      )}

      {view === 'affiliates' && (
        <>
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Affiliates</h2>
              <button onClick={() => setShowForm(v => !v)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                {showForm ? 'Cancel' : 'Add affiliate'}
              </button>
            </div>

            {showForm && (
              <form onSubmit={submit} className="px-6 py-4 border-b grid grid-cols-4 gap-3 items-end">
                <label className="text-sm">Name
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full border rounded px-2 py-1" />
                </label>
                <label className="text-sm">Email
                  <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="mt-1 w-full border rounded px-2 py-1" />
                </label>
                <label className="text-sm">Password
                  <input required type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="mt-1 w-full border rounded px-2 py-1" />
                </label>
                <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Create</button>
              </form>
            )}

            {loading && affiliates.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Loading…</div>
            ) : affiliates.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No affiliates yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr>
                    <th className="px-6 py-3">Name</th><th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Key</th><th className="px-6 py-3 text-right">Earned</th>
                    <th className="px-6 py-3 text-right">Owed</th><th className="px-6 py-3 text-right">Products</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {affiliates.map(a => (
                    <tr key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`border-t cursor-pointer hover:bg-gray-50 ${selectedId === a.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-3 font-medium">{a.name}</td>
                      <td className="px-6 py-3">{a.email}</td>
                      <td className="px-6 py-3 font-mono text-xs">{a.affiliate_key}</td>
                      <td className="px-6 py-3 text-right">{a.total_earned}</td>
                      <td className="px-6 py-3 text-right">{a.owed}</td>
                      <td className="px-6 py-3 text-right">{a.product_count}</td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); onDelete(a.id, a.name); }}
                          className="text-red-600 hover:text-red-800">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selectedId && (
            <AffiliateDetail
              affiliateId={selectedId}
              onClose={() => setSelectedId(null)}
              onChanged={fetchAffiliates}
            />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build will fail until child components exist — that's expected.** Proceed to Tasks 11-13, then type-check the whole panel.

- [ ] **Step 3: Commit**

```bash
git add src/components/AffiliatesPanel.tsx
git commit -m "feat(affiliate): affiliates panel (list/add/delete)"
```

---

### Task 11: `AffiliateDetail` + `AffiliateAccountsTab`

**Files:**
- Create: `gpt_admin/src/components/AffiliateDetail.tsx`
- Create: `gpt_admin/src/components/AffiliateAccountsTab.tsx`

- [ ] **Step 1: Write `AffiliateDetail.tsx`** (header + tabs container)

```tsx
import { useEffect, useState, useCallback } from 'react';
import * as api from '../api/affiliates';
import { AffiliateAccountsTab } from './AffiliateAccountsTab';
import { AffiliateTransactionsTab } from './AffiliateTransactionsTab';

type Tab = 'overview' | 'transactions';

export function AffiliateDetail({ affiliateId, onClose, onChanged }: {
  affiliateId: number; onClose: () => void; onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<{ affiliate: api.AffiliateDetail; accounts: api.AffiliateAccount[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.getAffiliate(affiliateId);
      setDetail({ affiliate: d.affiliate, accounts: d.accounts });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load affiliate');
    }
  }, [affiliateId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{detail?.affiliate.name ?? 'Affiliate'}</h2>
          <p className="text-sm text-gray-500">{detail?.affiliate.email} · key <code className="font-mono">{detail?.affiliate.affiliate_key}</code></p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <div className="border-b">
        <nav className="flex -mb-px">
          {(['overview', 'transactions'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'overview' ? 'Overview' : 'Transactions'}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-4">{error}</div>}
        {tab === 'overview' && detail && (
          <AffiliateAccountsTab
            affiliateId={affiliateId}
            accounts={detail.accounts}
            onChanged={() => { load(); onChanged(); }}
          />
        )}
        {tab === 'transactions' && (
          <AffiliateTransactionsTab affiliateId={affiliateId} onChanged={onChanged} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `AffiliateAccountsTab.tsx`** (accounts table, copy link, add account)

```tsx
import { useEffect, useState } from 'react';
import * as api from '../api/affiliates';
import { useAffiliateProducts } from '../hooks/useAffiliateProducts';

export function AffiliateAccountsTab({ affiliateId, accounts, onChanged }: {
  affiliateId: number; accounts: api.AffiliateAccount[]; onChanged: () => void;
}) {
  const { products, fetchProducts } = useAffiliateProducts();
  const [productId, setProductId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const existingIds = new Set(accounts.map(a => a.product_id));
  const addable = products.filter(p => !existingIds.has(p.id));

  const copy = (link: string | null) => { if (link) navigator.clipboard.writeText(link); };

  const add = async () => {
    if (!productId) return;
    setError(null);
    try {
      await api.addAffiliateAccount(affiliateId, Number(productId));
      setProductId('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    }
  };

  const remove = async (pid: number, name: string) => {
    if (!confirm(`Remove ${name} account from this affiliate?`)) return;
    await api.deleteAffiliateAccount(affiliateId, pid);
    onChanged();
  };

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="flex gap-2 items-center">
        <select value={productId} onChange={e => setProductId(e.target.value ? Number(e.target.value) : '')}
          className="border rounded px-2 py-1 text-sm">
          <option value="">Add product account…</option>
          {addable.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={add} disabled={!productId}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">Add</button>
      </div>

      {accounts.length === 0 ? (
        <p className="text-gray-500 text-sm">No product accounts yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">Product</th><th className="px-4 py-2">Commission</th>
              <th className="px-4 py-2">Affiliate link</th>
              <th className="px-4 py-2 text-right">Earnings</th><th className="px-4 py-2 text-right">Owed</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.account_id} className="border-t">
                <td className="px-4 py-2 font-medium">{a.product_name}</td>
                <td className="px-4 py-2">
                  {a.effective_type === 'percent' ? `${a.effective_value}%` : `${a.effective_value} ${a.currency}`}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs truncate max-w-xs">{a.link}</code>
                    <button onClick={() => copy(a.link)} className="text-blue-600 hover:text-blue-800 text-xs">Copy</button>
                  </div>
                </td>
                <td className="px-4 py-2 text-right">{a.earnings} {a.currency}</td>
                <td className="px-4 py-2 text-right">{a.owed} {a.currency}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(a.product_id, a.product_name)} className="text-red-600 hover:text-red-800">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AffiliateDetail.tsx src/components/AffiliateAccountsTab.tsx
git commit -m "feat(affiliate): affiliate detail + accounts tab"
```

---

### Task 12: `AffiliateTransactionsTab` — transactions + paid/owed + mark paid

**Files:**
- Create: `gpt_admin/src/components/AffiliateTransactionsTab.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/affiliates';

export function AffiliateTransactionsTab({ affiliateId, onChanged }: {
  affiliateId: number; onChanged: () => void;
}) {
  const [rows, setRows] = useState<api.AffiliateTransaction[]>([]);
  const [totals, setTotals] = useState<api.TransactionTotals>({ paid: 0, owed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.getAffiliateTransactions(affiliateId);
      setRows(d.transactions);
      setTotals(d.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    }
  }, [affiliateId]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (saleId: number) => {
    await api.markTransactionPaid(affiliateId, saleId);
    await load();
    onChanged();
  };

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="flex gap-6 text-sm">
        <div>Paid: <span className="font-semibold text-green-700">{totals.paid.toFixed(2)}</span></div>
        <div>To be paid: <span className="font-semibold text-amber-700">{totals.owed.toFixed(2)}</span></div>
        <div>Total: <span className="font-semibold">{totals.total.toFixed(2)}</span></div>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No transactions yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">Date</th><th className="px-4 py-2">Product</th>
              <th className="px-4 py-2 text-right">Sale</th><th className="px-4 py-2 text-right">Commission</th>
              <th className="px-4 py-2">Status</th><th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2">{new Date(t.occurred_at).toLocaleDateString()}</td>
                <td className="px-4 py-2">{t.product_name}</td>
                <td className="px-4 py-2 text-right">{t.sale_amount} {t.currency}</td>
                <td className="px-4 py-2 text-right">{t.commission_amount} {t.currency}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.status === 'paid' ? 'Paid' : 'To be paid'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {t.status === 'pending' && (
                    <button onClick={() => markPaid(t.id)} className="text-blue-600 hover:text-blue-800">Mark paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AffiliateTransactionsTab.tsx
git commit -m "feat(affiliate): transactions tab with paid/owed + mark paid"
```

---

### Task 13: `AffiliateProductsTab` — products management

**Files:**
- Create: `gpt_admin/src/components/AffiliateProductsTab.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useState } from 'react';
import * as api from '../api/affiliates';
import { useAffiliateProducts } from '../hooks/useAffiliateProducts';

const EMPTY: api.ProductInput = {
  name: '', app_ref: '', sales_page_url: '', commission_type: 'percent', commission_value: 0, currency: 'USD', active: 1,
};

export function AffiliateProductsTab() {
  const { products, error, fetchProducts, saveProduct, removeProduct } = useAffiliateProducts();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<api.ProductInput>(EMPTY);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const edit = (p: api.AffiliateProduct) => {
    setEditingId(p.id);
    setForm({
      name: p.name, app_ref: p.app_ref ?? '', sales_page_url: p.sales_page_url,
      commission_type: p.commission_type, commission_value: Number(p.commission_value),
      currency: p.currency, active: p.active,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await saveProduct(form, editingId ?? undefined);
    if (ok) { setForm(EMPTY); setEditingId(null); }
  };

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <form onSubmit={submit} className="grid grid-cols-3 gap-3 items-end">
        <label className="text-sm">Name
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="text-sm col-span-2">Sales page URL
          <input required value={form.sales_page_url} onChange={e => setForm({ ...form, sales_page_url: e.target.value })}
            className="mt-1 w-full border rounded px-2 py-1" placeholder="https://…" />
        </label>
        <label className="text-sm">App ref (optional)
          <input value={form.app_ref ?? ''} onChange={e => setForm({ ...form, app_ref: e.target.value })}
            className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="text-sm">Commission type
          <select value={form.commission_type} onChange={e => setForm({ ...form, commission_type: e.target.value as 'percent' | 'fixed' })}
            className="mt-1 w-full border rounded px-2 py-1">
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
        </label>
        <label className="text-sm">Value
          <input type="number" step="0.01" value={form.commission_value}
            onChange={e => setForm({ ...form, commission_value: Number(e.target.value) })}
            className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="text-sm">Currency
          <input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            maxLength={3} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="text-sm flex items-center gap-2 mt-5">
          <input type="checkbox" checked={form.active === 1} onChange={e => setForm({ ...form, active: e.target.checked ? 1 : 0 })} />
          Active
        </label>
        <div className="flex gap-2">
          <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
            {editingId ? 'Update' : 'Add product'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setForm(EMPTY); setEditingId(null); }}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Cancel</button>
          )}
        </div>
      </form>

      {products.length === 0 ? (
        <p className="text-gray-500 text-sm">No products yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">Name</th><th className="px-4 py-2">URL</th>
              <th className="px-4 py-2">Commission</th><th className="px-4 py-2">Active</th><th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 truncate max-w-xs"><code className="text-xs">{p.sales_page_url}</code></td>
                <td className="px-4 py-2">{p.commission_type === 'percent' ? `${p.commission_value}%` : `${p.commission_value} ${p.currency}`}</td>
                <td className="px-4 py-2">{p.active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2 text-right space-x-3">
                  <button onClick={() => edit(p)} className="text-blue-600 hover:text-blue-800">Edit</button>
                  <button onClick={() => { if (confirm(`Delete product "${p.name}"?`)) removeProduct(p.id); }}
                    className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AffiliateProductsTab.tsx
git commit -m "feat(affiliate): products management tab"
```

---

### Task 14: Wire `AffiliatesPanel` into `App.tsx`

**Files:**
- Modify: `gpt_admin/src/App.tsx`

- [ ] **Step 1: Add the import**

After line 20 (`import { PortfolioAdmin } ...`), add:

```tsx
import { AffiliatesPanel } from './components/AffiliatesPanel';
```

- [ ] **Step 2: Extend the `MainView` type** (line 25)

Change:
```tsx
type MainView = 'users' | 'usage' | 'costs' | 'settings' | 'mcp' | 'packages' | 'readme';
```
to:
```tsx
type MainView = 'users' | 'usage' | 'costs' | 'settings' | 'mcp' | 'packages' | 'readme' | 'affiliates';
```

- [ ] **Step 3: Add the nav button**

After the "Readme" nav `<button>` (ends ~line 157), add:

```tsx
              <button
                onClick={() => setMainView('affiliates')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mainView === 'affiliates'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Affiliates
              </button>
```

- [ ] **Step 4: Render the panel**

After the Readme view block (ends ~line 227, the `{mainView === 'readme' && (...)}` block), add:

```tsx
        {/* Affiliates View */}
        {mainView === 'affiliates' && <AffiliatesPanel />}
```

- [ ] **Step 5: Type-check + lint the whole admin app**

Run: `cd /Applications/XAMPP/xamppfiles/htdocs/gpt_admin && npm run build && npm run lint`
Expected: build + lint pass.

- [ ] **Step 6: Manual UI check**

Run `npm run dev`, open the admin, click **Affiliates**. Verify: add an affiliate (key banner shows), Products tab adds a product, clicking a row opens detail, add a product account (link with copy button appears), Transactions tab shows totals. (Earnings populate after a conversion — see Task 7.)

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat(affiliate): add Affiliates main section to admin nav"
```

---

## Phase E — Affiliate portal (standalone)

### Task 15: Second Vite entry + portal scaffold

**Files:**
- Create: `gpt_admin/affiliate.html`
- Modify: `gpt_admin/vite.config.ts`
- Create: `gpt_admin/src/portal/main.tsx`
- Create: `gpt_admin/src/portal/portalApi.ts`

- [ ] **Step 1: Add the HTML entry** — create `affiliate.html` (sibling of `index.html`):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Affiliate Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/portal/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Configure multi-page build** — in `vite.config.ts`, add `build.rollupOptions.input`. Replace the `defineConfig({ ... })` object's `plugins`/`base`/`server` with the same values plus a `build` key:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/gpt_admin/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        affiliate: resolve(__dirname, 'affiliate.html'),
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/gpt/backend': { target: 'http://localhost', changeOrigin: true },
      '/PortfolioManagement/backend': { target: 'http://localhost', changeOrigin: true },
      '/LandingPage/Ledger': { target: 'http://localhost', changeOrigin: true },
    },
  },
})
```

> The portal will be served at `/gpt_admin/affiliate.html` (dev: `http://localhost:5174/gpt_admin/affiliate.html`).

- [ ] **Step 3: Write the self-scoped portal API** — create `src/portal/portalApi.ts`:

```typescript
const API = '/gpt/backend/api/v1';

export function getToken(): string | null {
  return localStorage.getItem('token') || localStorage.getItem('voice_token');
}
export function setToken(t: string) { localStorage.setItem('token', t); }
export function clearToken() { localStorage.removeItem('token'); localStorage.removeItem('voice_token'); }

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.success || !data.token) throw new Error(data.error || data.message || 'Login failed');
  return data.token as string;
}

export interface MeAccount {
  product_name: string; sales_page_url: string; currency: string;
  effective_type: 'percent' | 'fixed'; effective_value: number;
  earnings: string; owed: string; link: string | null;
}
export interface MeResponse {
  affiliate: { id: number; name: string; email: string; affiliate_key: string; status: string };
  accounts: MeAccount[];
}
export interface PortalTransaction {
  id: number; product_name: string; sale_amount: string; currency: string;
  commission_amount: string; status: 'pending' | 'paid'; occurred_at: string; paid_at: string | null;
}
export interface PortalTotals { paid: number; owed: number; total: number; }

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || data.message || 'Request failed');
  return data as T;
}

export const fetchMe = () => get<{ success: boolean } & MeResponse>('/affiliate/me');
export const fetchMyTransactions = () =>
  get<{ success: boolean; transactions: PortalTransaction[]; totals: PortalTotals }>('/affiliate/me/transactions');
```

> Confirm the login response field: this assumes `POST /api/v1/auth/login` returns `{ success, token }`. If it returns the token under a different key (e.g. `data.token`), adjust `login()` accordingly — check `AuthController::login` before finishing this task.

- [ ] **Step 4: Stub entry so the build passes** — create `src/portal/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { PortalApp } from './PortalApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PortalApp />
  </StrictMode>,
)
```

- [ ] **Step 5: Commit** (build runs after Task 16 adds `PortalApp`)

```bash
git add affiliate.html vite.config.ts src/portal/main.tsx src/portal/portalApi.ts
git commit -m "feat(affiliate): portal vite entry + self-scoped api"
```

---

### Task 16: `PortalApp` — login + self-scoped statement

**Files:**
- Create: `gpt_admin/src/portal/PortalApp.tsx`

- [ ] **Step 1: Write the portal app**

```tsx
import { useEffect, useState, useCallback } from 'react';
import * as api from './portalApi';

export function PortalApp() {
  const [authed, setAuthed] = useState<boolean>(!!api.getToken());
  const [me, setMe] = useState<api.MeResponse | null>(null);
  const [tx, setTx] = useState<{ transactions: api.PortalTransaction[]; totals: api.PortalTotals } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState({ email: '', password: '' });

  const load = useCallback(async () => {
    setError(null);
    try {
      const m = await api.fetchMe();
      setMe({ affiliate: m.affiliate, accounts: m.accounts });
      const t = await api.fetchMyTransactions();
      setTx({ transactions: t.transactions, totals: t.totals });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      // token invalid / not an affiliate
      api.clearToken();
      setAuthed(false);
    }
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const token = await api.login(creds.email, creds.password);
      api.setToken(token);
      setAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const logout = () => { api.clearToken(); setAuthed(false); setMe(null); setTx(null); };
  const copy = (link: string | null) => { if (link) navigator.clipboard.writeText(link); };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={doLogin} className="bg-white p-8 rounded-lg shadow w-80 space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Affiliate Portal</h1>
          {error && <div className="p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>}
          <input required type="email" placeholder="Email" value={creds.email}
            onChange={e => setCreds({ ...creds, email: e.target.value })}
            className="w-full border rounded px-3 py-2" />
          <input required type="password" placeholder="Password" value={creds.password}
            onChange={e => setCreds({ ...creds, password: e.target.value })}
            className="w-full border rounded px-3 py-2" />
          <button type="submit" className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Affiliate Portal</h1>
            <p className="text-sm text-gray-500">{me?.affiliate.name} · key <code className="font-mono">{me?.affiliate.affiliate_key}</code></p>
          </div>
          <button onClick={logout} className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200">Sign out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">My products</h2>
          {!me || me.accounts.length === 0 ? (
            <p className="text-gray-500 text-sm">No products yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-2">Product</th><th className="px-4 py-2">Commission</th>
                  <th className="px-4 py-2">My link</th>
                  <th className="px-4 py-2 text-right">Earnings</th><th className="px-4 py-2 text-right">Owed</th>
                </tr>
              </thead>
              <tbody>
                {me.accounts.map(a => (
                  <tr key={a.product_name} className="border-t">
                    <td className="px-4 py-2 font-medium">{a.product_name}</td>
                    <td className="px-4 py-2">{a.effective_type === 'percent' ? `${a.effective_value}%` : `${a.effective_value} ${a.currency}`}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs truncate max-w-xs">{a.link}</code>
                        <button onClick={() => copy(a.link)} className="text-blue-600 hover:text-blue-800 text-xs">Copy</button>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">{a.earnings} {a.currency}</td>
                    <td className="px-4 py-2 text-right">{a.owed} {a.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Transactions</h2>
          <div className="flex gap-6 text-sm mb-4">
            <div>Paid: <span className="font-semibold text-green-700">{tx?.totals.paid.toFixed(2) ?? '0.00'}</span></div>
            <div>To be paid: <span className="font-semibold text-amber-700">{tx?.totals.owed.toFixed(2) ?? '0.00'}</span></div>
            <div>Total: <span className="font-semibold">{tx?.totals.total.toFixed(2) ?? '0.00'}</span></div>
          </div>
          {!tx || tx.transactions.length === 0 ? (
            <p className="text-gray-500 text-sm">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-2">Date</th><th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2 text-right">Sale</th><th className="px-4 py-2 text-right">Commission</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tx.transactions.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-2">{new Date(t.occurred_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{t.product_name}</td>
                    <td className="px-4 py-2 text-right">{t.sale_amount} {t.currency}</td>
                    <td className="px-4 py-2 text-right">{t.commission_amount} {t.currency}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {t.status === 'paid' ? 'Paid' : 'To be paid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `cd /Applications/XAMPP/xamppfiles/htdocs/gpt_admin && npm run build && npm run lint`
Expected: both pass; `dist/affiliate.html` is emitted.

- [ ] **Step 3: Manual check**

Run `npm run dev`, open `http://localhost:5174/gpt_admin/affiliate.html`. Log in as the affiliate created in Task 7 (`jane.aff@example.com` / `secret123`). Verify: only Jane's products, links, earnings, and transactions appear; totals show paid/to-be-paid. Sign out returns to the login form.

- [ ] **Step 4: Commit**

```bash
git add src/portal/PortalApp.tsx
git commit -m "feat(affiliate): self-scoped affiliate portal page"
```

---

## Final verification

- [ ] **Backend unit tests green:** `cd gpt/backend && composer test -- --filter Affiliate` → all pass.
- [ ] **PHP lint:** `php -l` clean on the 3 new PHP files + `routes.php`.
- [ ] **Admin app:** `cd gpt_admin && npm run build && npm run lint` pass.
- [ ] **End-to-end (Task 7) replayed** with the UI: create product → create affiliate → add account → POST a conversion → earnings show in admin detail and in the portal; mark paid moves the amount from "to be paid" to "paid" in both surfaces.
- [ ] **Self-scoping:** logged-in affiliate cannot reach another affiliate's data or any `/admin/*` route (403).

## Notes / follow-ups (out of scope, per spec §10)

- Wiring each selling app's payment form to call `POST /api/v1/affiliate/conversions` — one integration per app.
- Actual payout/payment processing (we only track `pending`/`paid` + `paid_at`).
- Possible later migration of this module into the planned shared identity + commerce service.
