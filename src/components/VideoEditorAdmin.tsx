import { Fragment, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getVideoEditorUsageSummary, getVideoEditorByUser, getVideoEditorTransactions,
  getVideoEditorProviders, type VeProviderModel,
  getVideoEditorUsers, setVideoEditorUserRole,
  getVideoEditorPackages, saveVideoEditorPackage,
  getVideoEditorUserOverride, saveVideoEditorUserOverride,
  getExchangeRates, refreshExchangeRatesApi, type ExchangeRatesPayload,
} from '../api/client';
import { Switch } from './Switch';
import { VideoEditorGlobal, type ProviderRow } from './VideoEditorGlobal';

type Kind = 'video' | 'image' | 'music';
type Currency = 'USD' | 'EUR' | 'CAD';
const KIND_META: { id: Kind; label: string; pill: string; month: string }[] = [
  { id: 'video', label: 'Video', pill: 'bg-purple-100 text-purple-800', month: 'text-purple-700' },
  { id: 'image', label: 'Image', pill: 'bg-blue-100 text-blue-800',     month: 'text-blue-700' },
  { id: 'music', label: 'Music', pill: 'bg-green-100 text-green-800',   month: 'text-green-700' },
];
const CUR_SYM: Record<Currency, string> = { USD: '$', EUR: '€', CAD: 'C$' };
const CUR_LOCALE: Record<Currency, string> = { USD: 'en-US', EUR: 'de-DE', CAD: 'en-CA' };

function RefreshIcon({ spin, small }: { spin?: boolean; small?: boolean }) {
  return (
    <svg className={`${small ? 'w-3 h-3' : 'w-4 h-4'} ${spin ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

const ROLES = ['guest', 'prospect', 'user', 'admin', 'affiliate'];
const KINDS = ['video', 'image', 'music'];
const RES_OPTS = ['', '480p', '720p', '1080p'];
const VE_ROLE_DESC: Record<string, string> = {
  guest: 'Unauthenticated visitors and admin-created guests — minimal or no generation access.',
  prospect: 'Signed-up leads evaluating the product; limited generation quotas.',
  user: 'Full paying users; standard generation access and quotas.',
  admin: 'Administrators; unrestricted generation access.',
  affiliate: 'Affiliate accounts; inherit the user package.',
};
interface Caps { models: string[] | null; kinds: string[]; limits: Record<string, number | string | null>; provider_keys?: Record<string, string> }
interface PackageRow { role: string; capabilities: Caps; updated_at: string }

const num = (n: unknown) => (Number(n) || 0).toLocaleString();

interface UserRow { user_id: number; email: string | null; name: string | null; generations: number; cost: string; last_used: string; }
interface AppUserRow {
  id: number; email: string | null; name: string | null;
  provider: string | null; email_verified: number; last_login: string | null; ve_role: string | null;
}
const fmtD = (s: string | null) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleDateString() : '—');
const TH = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider';
const USERS_PAGE_SIZE = 10;

type VeTab = 'usage' | 'transactions' | 'global' | 'packages' | 'users';
const VE_TABS: { id: VeTab; label: string }[] = [
  { id: 'users', label: 'User management' },
  { id: 'usage', label: 'Usage & costs' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'global', label: 'Global settings' },
  { id: 'packages', label: 'Packages' },
];

interface TxRow {
  id: number; user_id: number; kind: string; provider: string; model: string;
  units: number | string; cost_usd: number | string; status: string; created_at: string;
  email: string | null; name: string | null;
}
const TX_PAGE_SIZE = 20;

/** Paged transaction list. Without userId: every user's generations (the Usage tab
 *  section); with userId: one user's (the Users-tab drill-down). Default period:
 *  the current calendar month. */
function VeTransactions({ userId }: { userId?: number }) {
  const mstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const now = new Date();
  const periods: { id: string; label: string; params: { month?: string; days?: number; all?: boolean } }[] = [
    { id: 'this-month', label: 'This month', params: { month: mstr(now) } },
    { id: 'last-month', label: 'Last month', params: { month: mstr(new Date(now.getFullYear(), now.getMonth() - 1, 1)) } },
    { id: '7d',  label: 'Last 7 days',  params: { days: 7 } },
    { id: '30d', label: 'Last 30 days', params: { days: 30 } },
    { id: '90d', label: 'Last 90 days', params: { days: 90 } },
    { id: 'all', label: 'All time', params: { all: true } },
  ];
  const [period, setPeriod] = useState('this-month');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(TX_PAGE_SIZE);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const p = periods.find(x => x.id === period) ?? periods[0];
    setLoading(true);
    getVideoEditorTransactions({ ...(userId ? { user_id: userId } : {}), ...p.params, page, per_page: perPage })
      .then(r => { setRows(r.rows ?? []); setTotal(r.total ?? 0); })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [userId, period, page, perPage]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const cost = (c: number | string) => '$' + (+c).toFixed(4).replace(/\.?0+$/, '');
  const pill = (k: string) =>
    k === 'video' ? 'bg-purple-100 text-purple-700' : k === 'image' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs text-gray-500">{loading ? 'Loading…' : `${total.toLocaleString()} transaction${total === 1 ? '' : 's'}`}</div>
        <select className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
                value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }}>
          {periods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className={TH}>Date</th>
              {!userId && <th className={TH}>User</th>}
              <th className={TH}>Kind</th><th className={TH}>Model</th>
              <th className={`${TH} text-right`}>Units</th><th className={`${TH} text-right`}>Cost (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(t => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{new Date(String(t.created_at).replace(' ', 'T')).toLocaleString()}</td>
                {!userId && <td className="px-4 py-2"><div className="text-gray-800">{t.name ?? `#${t.user_id}`}</div><div className="text-xs text-gray-400">{t.email ?? ''}</div></td>}
                <td className="px-4 py-2"><span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${pill(t.kind)}`}>{t.kind}</span></td>
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{t.model}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-600">{+t.units}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-teal-700">{cost(t.cost_usd)}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && <tr><td colSpan={userId ? 5 : 6} className="px-4 py-4 text-gray-400 text-sm">No transactions in this period.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 pt-3 text-sm border-t border-gray-100 mt-1">
        <label className="text-xs text-gray-400 flex items-center gap-1.5">
          <select className="border border-gray-300 rounded px-1.5 py-1 text-xs bg-white text-gray-600"
                  value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          per page
        </label>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-2.5 py-1 border border-gray-300 rounded disabled:opacity-40">‹ Prev</button>
          <span className="text-xs text-gray-500">Page {Math.min(page, totalPages)} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-2.5 py-1 border border-gray-300 rounded disabled:opacity-40">Next ›</button>
        </div>
      </div>
    </div>
  );
}

export function VideoEditorAdmin() {
  const { exitApp, logout } = useAuth();
  const [tab, setTab] = useState<VeTab>('users');
  const [activeKind, setActiveKind] = useState<Kind>('video');
  const [summary, setSummary] = useState<any>(null);
  const [byUser, setByUser] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Currency (USD/EUR/CAD) — reuses the admin exchange-rate endpoint; VE costs stored in USD.
  const [currency, setCurrency] = useState<Currency>('USD');
  const [rates, setRates] = useState<ExchangeRatesPayload>({ USD: 1, EUR: 0.92, CAD: 1.36 });
  const [ratesUpdated, setRatesUpdated] = useState<string | null>(null);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setError(null);
    getVideoEditorUsageSummary().then(setSummary).catch(e => setError(String(e?.message ?? e)));
    getVideoEditorByUser(30).then(r => setByUser(r.users ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem('ve_costs_currency') as Currency | null;
    if (saved && ['USD', 'EUR', 'CAD'].includes(saved)) setCurrency(saved);
    getExchangeRates().then(r => { if (r?.rates) { setRates(r.rates); setRatesUpdated(r.lastUpdated); } }).catch(() => {});
  }, []);

  const changeCurrency = (c: Currency) => { setCurrency(c); localStorage.setItem('ve_costs_currency', c); };
  const conv = (usd: number) => (currency === 'USD' ? usd : usd * (rates[currency] || 1));
  const fmtMoney = (usd: number) => new Intl.NumberFormat(CUR_LOCALE[currency], {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(conv(usd));
  const refreshAll = async () => {
    setRefreshing(true); setError(null);
    try {
      setSummary(await getVideoEditorUsageSummary());
      const bu = await getVideoEditorByUser(30); setByUser(bu.users ?? []);
    } catch (e: any) { setError(String(e?.message ?? e)); }
    finally { setRefreshing(false); }
  };
  const updateRates = async () => {
    setRefreshingRates(true);
    try { const r = await refreshExchangeRatesApi(); if (r?.rates) { setRates(r.rates); setRatesUpdated(r.lastUpdated); } }
    finally { setRefreshingRates(false); }
  };

  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const loadProviders = () => {
    getVideoEditorProviders().then(r => setProviders(r.providers ?? [])).catch(() => {});
  };
  useEffect(loadProviders, []);

  const catalogModels = providers.flatMap(p => p.models);
  const modelById = new Map(catalogModels.map(m => [m.model, m]));
  const fmtCost = (m: VeProviderModel) => `$${(+m.cost).toFixed(4).replace(/\.?0+$/, '')} / ${m.unit}`;

  // Users (per-app roles)
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [userQ, setUserQ] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPerPage, setUserPerPage] = useState(USERS_PAGE_SIZE);
  const [usersMsg, setUsersMsg] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState<number | null>(null);
  const loadUsers = (q = userQ) => {
    getVideoEditorUsers(q).then(r => {
      setUsers(r.users ?? []);
      setUsersMsg(r.available === false ? (r.message ?? 'Login DB not reachable') : null);
    }).catch(e => setUsersMsg(String(e?.message ?? e)));
  };
  useEffect(() => { loadUsers(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setRole = async (u: AppUserRow, role: string) => {
    setSavingUser(u.id);
    try { await setVideoEditorUserRole(u.id, role); loadUsers(); }
    finally { setSavingUser(null); }
  };

  // Per-user override (custom capabilities + bring-your-own keys)
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  // Per-user transaction drill-down (modal overlay, opened by clicking a user row)
  const [txUser, setTxUser] = useState<AppUserRow | null>(null);
  const [ovrUseCustom, setOvrUseCustom] = useState(false);
  const [ovrCaps, setOvrCaps] = useState<Caps>({ models: null, kinds: [...KINDS], limits: {} });
  const [ovrByo, setOvrByo] = useState<Record<string, string>>({});
  const [ovrByoSet, setOvrByoSet] = useState<string[]>([]);
  const [savingOvr, setSavingOvr] = useState(false);
  const openOverride = async (u: AppUserRow) => {
    if (expandedUser === u.id) { setExpandedUser(null); return; }
    setTxUser(null);
    setExpandedUser(u.id); setOvrByo({});
    const r = await getVideoEditorUserOverride(u.id).catch(() => null);
    const caps = r?.capabilities ?? null;
    setOvrUseCustom(!!caps);
    setOvrCaps(caps
      ? { models: caps.models ?? null, kinds: caps.kinds ?? [], limits: caps.limits ?? {} }
      : { models: null, kinds: [...KINDS], limits: {} });
    setOvrByoSet(r?.byo_providers ?? []);
  };
  const ovrLimit = (key: string, raw: string) =>
    setOvrCaps(c => ({ ...c, limits: { ...c.limits, [key]: raw === '' ? null : (key === 'max_resolution' ? raw : Number(raw)) } }));
  const ovrToggleKind = (k: string) =>
    setOvrCaps(c => ({ ...c, kinds: c.kinds.includes(k) ? c.kinds.filter(x => x !== k) : [...c.kinds, k] }));
  const ovrToggleModel = (m: string) =>
    setOvrCaps(c => { const cur = c.models ?? []; return { ...c, models: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] }; });
  const saveOverride = async (u: AppUserRow) => {
    setSavingOvr(true);
    try {
      await saveVideoEditorUserOverride(u.id, ovrUseCustom ? ovrCaps : null, ovrByo);
      setExpandedUser(null);
    } finally { setSavingOvr(false); }
  };

  // Packages (per-role capabilities)
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [savingPkg, setSavingPkg] = useState<string | null>(null);
  const [activePkgRole, setActivePkgRole] = useState<string>('guest');
  const loadPackages = () => getVideoEditorPackages()
    .then(r => {
      const byRole = new Map<string, PackageRow>();
      for (const p of (r.packages ?? [])) {
        byRole.set(p.role, {
          role: p.role,
          capabilities: {
            models: p.capabilities?.models ?? null,
            kinds: p.capabilities?.kinds ?? [],
            limits: p.capabilities?.limits ?? {},
            provider_keys: p.capabilities?.provider_keys ?? undefined,
          },
          updated_at: p.updated_at,
        });
      }
      // Every role is editable; synthesize a default for roles without a DB row.
      setPackages(ROLES.map(role => byRole.get(role) ?? {
        role, capabilities: { models: null, kinds: [...KINDS], limits: {} }, updated_at: '',
      }));
    }).catch(() => {});
  useEffect(() => { loadPackages(); }, []);
  const patchCaps = (role: string, fn: (c: Caps) => Caps) =>
    setPackages(ps => ps.map(p => (p.role === role ? { ...p, capabilities: fn(p.capabilities) } : p)));
  const setLimit = (role: string, key: string, raw: string) =>
    patchCaps(role, c => ({ ...c, limits: { ...c.limits, [key]: raw === '' ? null : (key === 'max_resolution' ? raw : Number(raw)) } }));
  const toggleKind = (role: string, k: string) =>
    patchCaps(role, c => ({ ...c, kinds: c.kinds.includes(k) ? c.kinds.filter(x => x !== k) : [...c.kinds, k] }));
  const toggleAllModels = (role: string, all: boolean) =>
    patchCaps(role, c => ({ ...c, models: all ? null : catalogModels.map(m => m.model) }));
  // Per-provider model choice: replace this provider's model in the allowed set (or clear it).
  // Starting from "all" (null), seed with the full catalog so narrowing one provider
  // doesn't silently drop every other provider's models.
  const setProviderModel = (role: string, providerModelIds: string[], modelId: string) =>
    patchCaps(role, c => {
      const current = c.models === null ? catalogModels.map(m => m.model) : c.models;
      const base = current.filter(id => !providerModelIds.includes(id));
      return { ...c, models: modelId ? [...base, modelId] : base };
    });
  // Per-provider API key (per role) — stored in the role's capabilities.
  const setProviderKey = (role: string, provider: string, value: string) =>
    patchCaps(role, c => ({ ...c, provider_keys: { ...(c.provider_keys ?? {}), [provider]: value } }));
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const toggleReveal = (id: string) =>
    setRevealedKeys(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const savePkg = async (p: PackageRow) => {
    setSavingPkg(p.role);
    // Empty key entries mean "no role key" — drop them so the role falls back to
    // the admin/platform key instead of storing a blank override.
    const pk = Object.fromEntries(Object.entries(p.capabilities.provider_keys ?? {})
      .filter(([, v]) => (v ?? '').trim() !== ''));
    const caps = { ...p.capabilities, provider_keys: Object.keys(pk).length ? pk : undefined };
    try { await saveVideoEditorPackage(p.role, caps); loadPackages(); }
    finally { setSavingPkg(null); }
  };

  const unavailable = summary && summary.available === false;

  // Users tab: client-side search + pagination (GPT-Admin table style)
  const uq = userQ.trim().toLowerCase();
  const filteredUsers = uq
    ? users.filter(u => (u.email ?? '').toLowerCase().includes(uq) || (u.name ?? '').toLowerCase().includes(uq))
    : users;
  // 30-day consumption per user (same data the Usage tab aggregates), joined into the rows.
  const usageById = new Map(byUser.map(x => [x.user_id, x]));
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / userPerPage));
  const userPageSafe = Math.min(userPage, userTotalPages);
  const pagedUsers = filteredUsers.slice((userPageSafe - 1) * userPerPage, userPageSafe * userPerPage);

  return (
    <div className="h-full bg-gray-100 overflow-y-auto">
      <header className="bg-white shadow flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <button onClick={exitApp} className="text-base font-medium text-blue-600 hover:text-blue-800">← Apps</button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Video Editor</h1>
                <p className="text-sm text-gray-500">Manage access, usage, packages, and providers</p>
              </div>
            </div>
            <nav className="flex gap-1">
              {VE_TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === t.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={logout} className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-md px-4 py-3 text-sm">{error}</div>}
        {unavailable && <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-4 py-3 text-sm">
          The video-edit usage database isn’t reachable — check the VE_DB credentials in gpt/backend/.env.
        </div>}

        {tab === 'usage' && (<>
        {/* Header: title + currency toggle + refresh */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Usage &amp; costs</h2>
            <p className="text-sm text-gray-500 mt-1">Generation usage and model pricing for video, image, and music.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {(['USD', 'EUR', 'CAD'] as Currency[]).map(c => (
                <button key={c} onClick={() => changeCurrency(c)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    currency === c ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                  {CUR_SYM[c]} {c}
                </button>
              ))}
            </div>
            <button onClick={refreshAll} disabled={refreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                refreshing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              <RefreshIcon spin={refreshing} /> {refreshing ? 'Refreshing…' : 'Refresh All'}
            </button>
          </div>
        </div>

        {/* Exchange-rate info bar */}
        <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-4 flex-wrap">
            <span>Exchange Rates (base: USD):</span>
            <span className="font-medium">1 USD = {rates.EUR.toFixed(4)} EUR</span>
            <span className="font-medium">1 USD = {rates.CAD.toFixed(4)} CAD</span>
            {ratesUpdated && <span className="text-gray-400">Updated: {new Date(ratesUpdated).toLocaleDateString()}</span>}
          </div>
          <button onClick={updateRates} disabled={refreshingRates} className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
            <RefreshIcon spin={refreshingRates} small /> Update Rates
          </button>
        </div>

        {/* Usage Costs */}
        <>
          {/* Summary cards per kind */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {KIND_META.map(km => {
              const tot = summary?.kinds?.[km.id]?.totals ?? { today: 0, week: 0, month: 0, total: 0 };
              return (
                <div key={km.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-500">{km.label} Costs</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${km.pill}`}>{km.label}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-sm text-gray-600">Today</span><span className="font-semibold">{fmtMoney(tot.today)}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-gray-600">This Week</span><span className="font-semibold">{fmtMoney(tot.week)}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-gray-600">This Month</span><span className={`font-semibold text-lg ${km.month}`}>{fmtMoney(tot.month)}</span></div>
                    <div className="pt-2 border-t border-gray-100 flex justify-between"><span className="text-sm text-gray-600">All Time</span><span className="font-medium">{fmtMoney(tot.total)}</span></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Breakdown sub-tabs per kind */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {KIND_META.map(km => (
                <button key={km.id} onClick={() => setActiveKind(km.id)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeKind === km.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                  {km.label} Breakdown
                </button>
              ))}
            </nav>
          </div>

          {/* Breakdown table for active kind */}
          {(() => {
            const rows = (summary?.kinds?.[activeKind]?.byModel ?? []) as any[];
            const totGen = rows.reduce((s, r) => s + (Number(r.generations) || 0), 0);
            const totUnits = rows.reduce((s, r) => s + (Number(r.units) || 0), 0);
            const totCost = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0);
            const unitLabel = activeKind === 'video' ? 'sec' : activeKind === 'image' ? 'images' : 'clips';
            const dp = activeKind === 'video' ? 1 : 0;
            return (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800 capitalize">{activeKind} Usage by Model (Last 30 Days)</h3>
                </div>
                {rows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="px-4 py-3 font-medium">Model</th>
                          <th className="px-4 py-3 font-medium text-right">Generations</th>
                          <th className="px-4 py-3 font-medium text-right">Units ({unitLabel})</th>
                          <th className="px-4 py-3 font-medium text-right">Cost ({currency})</th>
                          <th className="px-4 py-3 font-medium">Last Used</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.model}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{num(r.generations)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{(Number(r.units) || 0).toFixed(dp)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoney(Number(r.cost) || 0)}</td>
                            <td className="px-4 py-3 text-gray-500">{r.last_used ? new Date(String(r.last_used).replace(' ', 'T')).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-900">
                          <td className="px-4 py-3">Total</td>
                          <td className="px-4 py-3 text-right">{num(totGen)}</td>
                          <td className="px-4 py-3 text-right">{totUnits.toFixed(dp)}</td>
                          <td className="px-4 py-3 text-right">{fmtMoney(totCost)}</td>
                          <td className="px-4 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">No {activeKind} usage recorded in the last 30 days</div>
                )}
              </div>
            );
          })()}

        </>

        </>)}

        {tab === 'transactions' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Transactions <span className="text-xs font-normal text-gray-400">(all users, one row per generation)</span></h3>
            </div>
            <div className="p-4">
              <VeTransactions />
            </div>
          </div>
        )}

        {tab === 'users' && (<>
        {/* Users — per-app video-edit role */}
        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-800">User access</h2>
              <p className="text-xs text-gray-500">Grant a Video Editor role to a user (blank = no access). Accounts are managed in Login.</p>
            </div>
            <div className="w-full sm:w-72 flex-shrink-0">
              <input
                type="text"
                placeholder="Search by email or name..."
                value={userQ}
                onChange={e => { setUserQ(e.target.value); setUserPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          {usersMsg && <div className="px-6 py-3 text-sm text-amber-800 bg-amber-50 border-b border-amber-200">{usersMsg}</div>}
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr><th className={TH}>User</th><th className={TH}>Provider</th><th className={TH}>Verified</th>
                <th className={TH}>Last login</th><th className={TH}>Video Editor role</th>
                <th className={`${TH} text-right`}>Generations <span className="normal-case">(30d)</span></th>
                <th className={`${TH} text-right`}>Cost <span className="normal-case">(30d)</span></th>
                <th className={TH}>Last used</th>
                <th className={`${TH} text-right`}></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedUsers.map(u => (
                <Fragment key={u.id}>
                {/* Clicking the row opens the transactions overlay; interactive cells stop propagation. */}
                <tr className="cursor-pointer hover:bg-gray-50" onClick={() => setTxUser(u)}>
                  <td className="px-4 py-3"><div className="text-gray-800 font-medium">{u.name}</div><div className="text-xs text-gray-400">{u.email}</div></td>
                  <td className="px-4 py-3 text-gray-500">{u.provider ?? '—'}</td>
                  <td className="px-4 py-3">
                    {u.email_verified
                      ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">verified</span>
                      : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">no</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmtD(u.last_login)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select className="border rounded px-2 py-1 text-sm" value={u.ve_role ?? ''}
                            disabled={savingUser === u.id}
                            onChange={e => setRole(u, e.target.value)}>
                      <option value="">— none —</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {savingUser === u.id && <span className="ml-2 text-xs text-gray-400">saving…</span>}
                  </td>
                  {(() => { const us = usageById.get(u.id); return (<>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{us ? num(us.generations) : '0'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{us ? fmtMoney(Number(us.cost) || 0) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{us?.last_used ? new Date(String(us.last_used).replace(' ', 'T')).toLocaleDateString() : '—'}</td>
                  </>); })()}
                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setTxUser(u)}
                            className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded">Transactions</button>
                    <button onClick={() => openOverride(u)} className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded">
                      {expandedUser === u.id ? 'Close' : 'Customize'}</button>
                  </td>
                </tr>
                {expandedUser === u.id && (
                  <tr className="bg-gray-50 border-t">
                    <td colSpan={9} className="px-5 py-4">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="flex items-center gap-2 text-sm font-medium mb-2">
                            <input type="checkbox" checked={ovrUseCustom} onChange={e => setOvrUseCustom(e.target.checked)} />
                            Custom capabilities (override the role package)
                          </label>
                          {ovrUseCustom && (
                            <div className="pl-1 space-y-2 text-sm">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Kinds</div>
                                <div className="flex gap-3">
                                  {KINDS.map(k => <label key={k} className="flex items-center gap-1">
                                    <input type="checkbox" checked={ovrCaps.kinds.includes(k)} onChange={() => ovrToggleKind(k)} /> {k}</label>)}
                                </div>
                              </div>
                              <label className="flex items-center gap-1 text-sm">
                                <input type="checkbox" checked={ovrCaps.models === null}
                                       onChange={e => setOvrCaps(c => ({ ...c, models: e.target.checked ? null : [] }))} /> All models
                              </label>
                              {ovrCaps.models !== null && (
                                <div className="flex flex-wrap gap-2 pl-1">
                                  {catalogModels.map(m => <label key={m.model} className="flex items-center gap-1 text-xs">
                                    <input type="checkbox" checked={(ovrCaps.models ?? []).includes(m.model)} onChange={() => ovrToggleModel(m.model)} />
                                    <span className="font-mono">{m.model}</span></label>)}
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <label className="text-xs text-gray-500">Max resolution
                                  <select className="mt-0.5 w-full border rounded px-2 py-1 text-sm text-gray-800"
                                          value={(ovrCaps.limits.max_resolution as string) ?? ''}
                                          onChange={e => ovrLimit('max_resolution', e.target.value)}>
                                    {RES_OPTS.map(r => <option key={r} value={r}>{r === '' ? 'no cap' : r}</option>)}</select></label>
                                <label className="text-xs text-gray-500">Max duration (s)
                                  <input type="number" min={0} className="mt-0.5 w-full border rounded px-2 py-1 text-sm text-gray-800"
                                         placeholder="no cap" value={ovrCaps.limits.max_duration_s ?? ''} onChange={e => ovrLimit('max_duration_s', e.target.value)} /></label>
                                <label className="text-xs text-gray-500">Monthly budget (USD)
                                  <input type="number" min={0} step="0.01" className="mt-0.5 w-full border rounded px-2 py-1 text-sm text-gray-800"
                                         placeholder="no cap" value={ovrCaps.limits.monthly_cost_usd ?? ''} onChange={e => ovrLimit('monthly_cost_usd', e.target.value)} /></label>
                                <label className="text-xs text-gray-500">Generations / day
                                  <input type="number" min={0} className="mt-0.5 w-full border rounded px-2 py-1 text-sm text-gray-800"
                                         placeholder="no cap" value={ovrCaps.limits.daily_generations ?? ''} onChange={e => ovrLimit('daily_generations', e.target.value)} /></label>
                              </div>
                            </div>
                          )}
                          {!ovrUseCustom && <p className="text-xs text-gray-400 pl-1">Inherits the role package.</p>}
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-2">Bring-your-own keys</div>
                          <p className="text-xs text-gray-400 mb-2">Override the platform key for this user, per provider. Blank = inherit; type <code>__clear__</code> and save to remove one.</p>
                          <div className="space-y-2">
                            {providers.map(p => (
                              <div key={p.provider} className="flex items-center gap-2">
                                <span className="w-28 font-mono text-xs text-gray-600">{p.provider}</span>
                                <input type="password" autoComplete="off" className="flex-1 border rounded px-2 py-1 text-xs"
                                       placeholder={ovrByoSet.includes(p.provider) ? '•••• set (blank = keep)' : 'inherit platform key'}
                                       value={ovrByo[p.provider] ?? ''}
                                       onChange={e => setOvrByo(s => ({ ...s, [p.provider]: e.target.value }))} />
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button onClick={() => saveOverride(u)} disabled={savingOvr}
                                    className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded disabled:opacity-40">
                              {savingOvr ? 'Saving…' : 'Save override'}</button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {filteredUsers.length === 0 && !usersMsg && <tr><td colSpan={9} className="px-6 py-4 text-gray-400 text-sm">{userQ ? 'No users found matching your search' : 'No users found.'}</td></tr>}
            </tbody>
          </table>
          </div>

          {/* Pagination footer */}
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600 flex items-center gap-3">
              <span>
                {filteredUsers.length > 0
                  ? `Showing ${((userPageSafe - 1) * userPerPage) + 1}-${Math.min(userPageSafe * userPerPage, filteredUsers.length)} of ${filteredUsers.length} users`
                  : 'No users'}
              </span>
              <label className="text-xs text-gray-400 flex items-center gap-1.5">
                <select className="border border-gray-300 rounded px-1.5 py-1 text-xs bg-white text-gray-600"
                        value={userPerPage} onChange={e => { setUserPerPage(Number(e.target.value)); setUserPage(1); }}>
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                per page
              </label>
            </div>
            {userTotalPages > 1 && (
              <div className="flex gap-1">
                <button onClick={() => setUserPage(1)} disabled={userPageSafe === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">First</button>
                <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPageSafe === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Prev</button>
                <span className="px-3 py-1 text-sm">Page {userPageSafe} of {userTotalPages}</span>
                <button onClick={() => setUserPage(p => Math.min(userTotalPages, p + 1))} disabled={userPageSafe === userTotalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                <button onClick={() => setUserPage(userTotalPages)} disabled={userPageSafe === userTotalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Last</button>
              </div>
            )}
          </div>
        </section>

        {/* Per-user transactions overlay */}
        {txUser && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setTxUser(null)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-gray-800">Transactions — {txUser.name || txUser.email || `user #${txUser.id}`}</h3>
                  {txUser.email && <p className="text-xs text-gray-400">{txUser.email}</p>}
                </div>
                <button onClick={() => setTxUser(null)}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1" title="Close">✕</button>
              </div>
              <div className="p-4 overflow-y-auto">
                <VeTransactions userId={txUser.id} />
              </div>
            </div>
          </div>
        )}

        </>)}

        {tab === 'global' && (
          <VideoEditorGlobal providers={providers} onSaved={() => { loadProviders(); loadPackages(); }} />
        )}

        {tab === 'packages' && (() => {
          const roleList = packages.map(x => x.role);
          const activeRole = roleList.includes(activePkgRole) ? activePkgRole : (roleList[0] ?? 'guest');
          const p = packages.find(x => x.role === activeRole);
          const c = p?.capabilities;
          const allModels = c ? c.models === null : true;
          const provList = providers.map(pv => pv.provider);
          const kindPill = (k: string) =>
            k === 'video' ? 'bg-purple-100 text-purple-700' : k === 'image' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
          const selectedIds = allModels ? catalogModels.map(m => m.model) : (c?.models ?? []);
          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Packages</h2>
                <p className="text-sm text-gray-500 mt-1">Capability bundles per user role. Each bundle controls which content types and models a role may generate, plus its quotas.</p>
              </div>

              {/* Role tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  {(roleList.length ? roleList : ROLES).map(role => (
                    <button key={role} onClick={() => setActivePkgRole(role)}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                        activeRole === role ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                      {role}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="text-sm text-gray-500">{VE_ROLE_DESC[activeRole] ?? ''}</div>

              {packages.length === 0 ? (
                <div className="text-gray-400 text-sm">No packages yet.</div>
              ) : p && c ? (
                <>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Providers & models — pick one version per provider, priced */}
                  <div className="lg:col-span-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3 gap-3">
                        <h3 className="text-sm font-semibold text-gray-800">Providers &amp; models</h3>
                        <Switch checked={allModels} onChange={v => toggleAllModels(activeRole, v)} size="sm" label="All models" />
                      </div>
                      <p className="text-xs text-gray-500 mb-3">Enable a provider, then choose which model version this role may use. Each option shows its price from the catalog. The key shown per provider is the one in effect for this role — inherited from the admin/platform key unless the role has its own. Type to override; clear the field to fall back.</p>
                      {provList.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">No models in the catalog yet — add one below.</div>
                      ) : (
                        <div>
                          {providers.map(pv => {
                            const prov = pv.provider;
                            const provModels = pv.models;
                            const provIds = provModels.map(m => m.model);
                            const kinds = Array.from(new Set(provModels.map(m => m.kind)));
                            const effModels = c.models === null ? catalogModels.map(m => m.model) : c.models;
                            const selected = effModels.find(id => provIds.includes(id)) ?? '';
                            const on = selected !== '';
                            const revealId = `${activeRole}:${prov}`;
                            const revealed = revealedKeys.has(revealId);
                            // The key in effect for this role: its own, else the admin
                            // package's, else the provider's platform key (same fallback
                            // order the generation endpoints use).
                            const ownKey = c.provider_keys?.[prov];
                            const adminKey = activeRole !== 'admin'
                              ? (packages.find(x => x.role === 'admin')?.capabilities.provider_keys?.[prov] ?? '') : '';
                            const platformKey = pv.api_key ?? '';
                            const inheritedKey = adminKey || platformKey;
                            const shownKey = ownKey !== undefined ? ownKey : inheritedKey;
                            const keySource = ownKey
                              ? 'this role’s own key'
                              : ownKey === ''
                                ? (inheritedKey ? 'cleared — inherits again after save' : 'no key set')
                                : adminKey ? 'inherited from admin — type to override'
                                : platformKey ? 'platform key — type to override'
                                : 'no key set';
                            return (
                              <div key={prov} className="py-3 border-b border-gray-200 last:border-b-0 space-y-2">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2 w-44 flex-none">
                                    <Switch checked={on}
                                      onChange={v => setProviderModel(activeRole, provIds, v ? (selected || provIds[0]) : '')} size="sm" />
                                    <span className={`text-sm font-semibold ${on ? 'text-gray-800' : 'text-gray-400'}`}>{prov}</span>
                                    {kinds.map(k => (
                                      <span key={k} className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${kindPill(k)}`}>{k}</span>
                                    ))}
                                  </div>
                                  <select value={selected} disabled={!on}
                                    onChange={e => setProviderModel(activeRole, provIds, e.target.value)}
                                    className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400">
                                    <option value="">— none —</option>
                                    {provModels.map(m => (
                                      <option key={m.model} value={m.model}>{`${m.label || m.model}`}{` — ${fmtCost(m)}`}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="relative">
                                  <input type={revealed ? 'text' : 'password'} autoComplete="off"
                                    placeholder="no key set"
                                    value={shownKey}
                                    onChange={e => setProviderKey(activeRole, prov, e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm font-mono pr-9 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                                  <button type="button" onClick={() => toggleReveal(revealId)}
                                    className="absolute inset-y-0 right-0 px-2 flex items-center text-gray-400 hover:text-gray-600">
                                    {revealed ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                  </button>
                                </div>
                                <div className="text-[11px] text-gray-400">{keySource}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {allModels && <p className="text-xs text-gray-400 italic mt-3">All models allowed — turn off “All models” to choose a specific version per provider.</p>}
                      <p className="text-xs text-gray-400 mt-3">Providers, models, prices and platform keys are managed in the <button className="underline hover:text-gray-600" onClick={() => setTab('global')}>Global settings</button> tab.</p>
                    </div>
                  </div>

                  {/* Content types + Limits */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Content types</h3>
                      <p className="text-xs text-gray-500 mb-3">What this role may generate.</p>
                      <div className="space-y-2">
                        {KINDS.map(k => (
                          <div key={k} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 capitalize">{k}</span>
                            <Switch checked={c.kinds.includes(k)} onChange={() => toggleKind(activeRole, k)} size="sm" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Limits</h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <label className="text-xs text-gray-500">Max resolution
                          <select className="mt-0.5 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white"
                                  value={(c.limits.max_resolution as string) ?? ''}
                                  onChange={e => setLimit(activeRole, 'max_resolution', e.target.value)}>
                            {RES_OPTS.map(r => <option key={r} value={r}>{r === '' ? 'no cap' : r}</option>)}
                          </select></label>
                        <label className="text-xs text-gray-500">Max duration (s)
                          <input type="number" min={0} className="mt-0.5 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800"
                                 placeholder="no cap" value={c.limits.max_duration_s ?? ''}
                                 onChange={e => setLimit(activeRole, 'max_duration_s', e.target.value)} /></label>
                        <label className="text-xs text-gray-500">Monthly budget (USD)
                          <input type="number" min={0} step="0.01" className="mt-0.5 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800"
                                 placeholder="no cap" value={c.limits.monthly_cost_usd ?? ''}
                                 onChange={e => setLimit(activeRole, 'monthly_cost_usd', e.target.value)} /></label>
                        <label className="text-xs text-gray-500">Generations / day
                          <input type="number" min={0} className="mt-0.5 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800"
                                 placeholder="no cap" value={c.limits.daily_generations ?? ''}
                                 onChange={e => setLimit(activeRole, 'daily_generations', e.target.value)} /></label>
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-1">Selected model prices</h3>
                      <p className="text-xs text-gray-500 mb-3">Rates for the models this role can use.</p>
                      {selectedIds.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">No models selected.</div>
                      ) : (
                        <div>
                          {selectedIds.map(id => {
                            const m = modelById.get(id);
                            return (
                              <div key={id} className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-gray-200 last:border-b-0">
                                <span className="flex items-center gap-2 min-w-0">
                                  {m && <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${kindPill(m.kind)}`}>{m.kind}</span>}
                                  <span className="font-mono text-xs text-gray-600 truncate">{id}</span>
                                </span>
                                <span className="text-xs font-semibold text-teal-700 tabular-nums whitespace-nowrap">{m ? fmtCost(m) : 'price n/a'}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Save bar */}
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="text-xs text-gray-500">{p.updated_at && <>Last saved: {p.updated_at}</>}</div>
                  <button onClick={() => savePkg(p)} disabled={savingPkg === activeRole}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {savingPkg === activeRole ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
                </>
              ) : null}
            </div>
          );
        })()}

      </main>
    </div>
  );
}
