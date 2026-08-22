import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getLoginApps, getLoginAppUsers, setLoginAppUserRole, addLoginAppMember } from '../api/client';
import { usePagedSearch, SearchBox, PaginationFooter } from './TableControls';

const ROLES = ['guest', 'prospect', 'user', 'admin', 'affiliate'];
const TH = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider';
const TH_C = 'px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider';

type Tab = 'apps' | 'manage';
const TABS: { id: Tab; label: string }[] = [
  { id: 'apps', label: 'Applications' },
  { id: 'manage', label: 'Manage applications' },
];

const fmtDate = (s: string | null) => (s ? new Date(s.replace(' ', 'T')).toLocaleDateString() : '—');

export function LoginAdmin() {
  const { exitApp, logout, user } = useAuth();
  const [tab, setTab] = useState<Tab>('apps');
  const [app, setApp] = useState<{ app: string; name: string } | null>(null);

  return (
    <div className="h-full bg-gray-100 overflow-y-auto">
      <header className="bg-white shadow flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <button onClick={exitApp} className="text-base font-medium text-blue-600 hover:text-blue-800">← Apps</button>
              <h1 className="text-2xl font-bold text-gray-900">Login</h1>
            </div>
            <nav className="flex gap-1 flex-wrap">
              {TABS.map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setApp(null); }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button onClick={logout} className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {tab === 'apps' && (app
          ? <AppContext app={app.app} name={app.name} onBack={() => setApp(null)} />
          : <AppGrid onOpen={setApp} />)}
        {tab === 'manage' && <ManageApps />}
      </main>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-lg shadow px-6 py-10 text-center text-gray-500">
      <div className="text-lg font-semibold text-gray-700 mb-1">{label}</div>
      Planned — arrives with the login-service integration.
    </div>
  );
}

// The per-application context: a tabbed page shown after clicking an app card.
// Everything user-scoped (members, passkeys, API keys, overview) lives HERE.
function AppContext({ app, name, onBack }: { app: string; name: string; onBack: () => void }) {
  type Sub = 'overview' | 'users' | 'passkeys' | 'appkeys';
  const SUBS: { id: Sub; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'passkeys', label: 'Passkeys' },
    { id: 'appkeys', label: 'API keys' },
  ];
  const [sub, setSub] = useState<Sub>('users');
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap border-b border-gray-200 pb-3">
        <button onClick={onBack} className="text-base font-medium text-blue-600 hover:text-blue-800">← Applications</button>
        <h2 className="text-xl font-bold text-gray-900">{name}</h2>
        <nav className="flex gap-1">
          {SUBS.map(s => (
            <button key={s.id} onClick={() => setSub(s.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === s.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              {s.label}
            </button>
          ))}
        </nav>
      </div>
      {sub === 'overview' && <AppOverview app={app} />}
      {sub === 'users' && <AppMembers app={app} />}
      {(sub === 'passkeys' || sub === 'appkeys') &&
        <Placeholder label={`${SUBS.find(s => s.id === sub)!.label} — in ${name}`} />}
    </div>
  );
}

function AppOverview({ app }: { app: string }) {
  const [members, setMembers] = useState<AppUser[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    getLoginAppUsers(app).then(r => { if (r.available === false) setMsg(r.message ?? ''); else setMembers(r.users ?? []); })
      .catch(e => setMsg(String(e?.message ?? e)));
  }, [app]);
  const byRole: Record<string, number> = {};
  for (const m of members) { const k = m.role ?? '—'; byRole[k] = (byRole[k] ?? 0) + 1; }
  const verified = members.filter(m => m.email_verified).length;
  return (
    <>
      {msg && <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-4 py-3 text-sm">{msg}</div>}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {([['Members', members.length], ['Email-verified', verified], ['Roles in use', Object.keys(byRole).length]] as [string, number][]).map(([l, v]) => (
          <div key={l} className="bg-white rounded-lg shadow px-5 py-4">
            <div className="text-2xl font-bold text-gray-900">{v}</div>
            <div className="text-xs uppercase tracking-wide text-gray-500 mt-1">{l}</div>
          </div>
        ))}
      </section>
      <section className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="px-6 py-4 text-lg font-semibold text-gray-800 border-b border-gray-200">Members by role</h2>
        <table className="w-full text-sm"><tbody className="divide-y divide-gray-100">
          {Object.entries(byRole).map(([role, n]) => (
            <tr key={role}><td className="px-4 py-3 text-gray-700 capitalize">{role}</td><td className="px-4 py-3 text-right font-medium">{n}</td></tr>
          ))}
          {members.length === 0 && <tr><td className="px-4 py-3 text-gray-400" colSpan={2}>No members yet.</td></tr>}
        </tbody></table>
      </section>
    </>
  );
}

function AppGrid({ onOpen }: { onOpen: (a: { app: string; name: string }) => void }) {
  const [apps, setApps] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    getLoginApps().then(r => {
      if (r.available === false) { setMsg(r.message ?? 'Login DB not reachable'); return; }
      setApps(r.apps ?? []);
    }).catch(e => setMsg(String(e?.message ?? e)));
  }, []);
  return (
    <>
      {msg && <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-4 py-3 text-sm">{msg}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {apps.map(a => (
          <button key={a.id} onClick={() => onOpen({ app: a.app_id, name: a.name })}
                  className="text-left bg-white rounded-lg shadow p-6 hover:shadow-lg hover:ring-2 hover:ring-blue-500 transition">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{a.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${a.revoked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{a.revoked ? 'revoked' : 'active'}</span>
            </div>
            <div className="text-xs font-mono text-gray-400 mt-1">{a.app_id}</div>
            <div className="text-sm text-gray-600 mt-3">{a.users} member{a.users === 1 ? '' : 's'}</div>
            <div className="text-xs text-gray-400 truncate mt-1">{a.entry_point}</div>
          </button>
        ))}
        {apps.length === 0 && !msg && <div className="text-gray-400 text-sm">No registered applications.</div>}
      </div>
    </>
  );
}

function ManageApps() {
  const [apps, setApps] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    getLoginApps().then(r => { if (r.available === false) setMsg(r.message ?? 'Login DB not reachable'); else setApps(r.apps ?? []); })
      .catch(e => setMsg(String(e?.message ?? e)));
  }, []);
  const appSearch = usePagedSearch(apps, (a, q) => ((a.name ?? '') + ' ' + (a.key_prefix ?? '') + ' ' + (a.entry_point ?? '')).toLowerCase().includes(q));
  return (
    <section className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Manage applications</h2>
          <p className="text-sm text-gray-500">Registered SSO applications. Register / revoke / key rotation arrives with the login-service integration.</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBox value={appSearch.query} onChange={appSearch.setQuery} placeholder="Search…" className="w-full sm:w-64 flex-shrink-0" />
          <button disabled title="Needs the login-service key mint (next phase)"
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-400 rounded-md border cursor-not-allowed flex-shrink-0">+ Register app</button>
        </div>
      </div>
      {msg && <div className="px-6 py-3 text-sm text-amber-800 bg-amber-50 border-b border-amber-200">{msg}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr><th className={TH}>Application</th><th className={TH}>Key prefix</th><th className={TH}>Entry point</th>
              <th className={TH}>Members</th><th className={TH}>Status</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {appSearch.pageItems.map(a => (
              <tr key={a.id}>
                <td className="px-4 py-3"><div className="text-gray-800 font-medium">{a.name}</div><div className="text-xs font-mono text-gray-400">{a.app_id}</div></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.key_prefix ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 truncate max-w-xs">{a.entry_point}</td>
                <td className="px-4 py-3 text-gray-500">{a.users}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.revoked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{a.revoked ? 'revoked' : 'active'}</span>
                </td>
              </tr>
            ))}
            {appSearch.total === 0 && !msg && <tr><td colSpan={5} className="px-4 py-4 text-gray-400 text-sm">{appSearch.query ? 'No matching applications.' : 'No applications.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <PaginationFooter page={appSearch.page} totalPages={appSearch.totalPages} total={appSearch.total} pageSize={appSearch.pageSize} setPage={appSearch.setPage} noun="apps" />
    </section>
  );
}

interface AppUser { id: number; email: string; name: string; provider: string | null; email_verified: number; last_login: string | null; role: string | null; }
function AppMembers({ app }: { app: string }) {
  const [members, setMembers] = useState<AppUser[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const load = () => {
    getLoginAppUsers(app).then(r => {
      setMembers(r.users ?? []);
      setMsg(r.available === false ? (r.message ?? 'Login DB not reachable') : null);
    }).catch(e => setMsg(String(e?.message ?? e)));
  };
  useEffect(() => { load(); }, [app]); // eslint-disable-line react-hooks/exhaustive-deps
  const setRole = (u: AppUser, role: string) => {
    setBusy(u.id);
    setLoginAppUserRole(app, u.id, role)
      .then(r => { if (!r.success) alert(r.message ?? 'Save failed'); load(); })
      .catch(e => alert(String(e?.message ?? e)))
      .finally(() => setBusy(null));
  };
  const memberSearch = usePagedSearch(members, (u, q) => ((u.email ?? '') + ' ' + (u.name ?? '') + ' ' + (u.role ?? '')).toLowerCase().includes(q));
  return (
    <section className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Members</h2>
          <p className="text-sm text-gray-500">Users who are members (have a role) of this application.</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBox value={memberSearch.query} onChange={memberSearch.setQuery} placeholder="Search…" className="w-full sm:w-64 flex-shrink-0" />
          <button onClick={() => setAdding(v => !v)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex-shrink-0">+ Add member</button>
        </div>
      </div>
      {adding && <AddMember app={app} onDone={() => { load(); }} />}
      {msg && <div className="px-6 py-3 text-sm text-amber-800 bg-amber-50 border-b border-amber-200">{msg}</div>}
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr><th className={TH}>Member</th><th className={TH}>Provider</th><th className={TH_C}>Verified</th>
            <th className={TH}>Last login</th><th className={TH}>Role</th><th className={`${TH} text-right`}></th></tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {memberSearch.pageItems.map(u => (
            <tr key={u.id}>
              <td className="px-4 py-3"><div className="text-gray-800 font-medium">{u.name}</div><div className="text-xs text-gray-400">{u.email}</div></td>
              <td className="px-4 py-3 text-gray-500">{u.provider}</td>
              <td className="px-4 py-3 text-center">
                {u.email_verified
                  ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">verified</span>
                  : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">no</span>}
              </td>
              <td className="px-4 py-3 text-gray-500">{fmtDate(u.last_login)}</td>
              <td className="px-4 py-3">
                <select className="border rounded px-2 py-1 text-sm" value={u.role ?? ''} disabled={busy === u.id}
                        onChange={e => setRole(u, e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {busy === u.id && <span className="ml-2 text-xs text-gray-400">saving…</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => setRole(u, '')} disabled={busy === u.id}
                        className="px-2 py-1 text-sm text-red-600 hover:bg-red-100 rounded">Remove</button>
              </td>
            </tr>
          ))}
          {memberSearch.total === 0 && !msg && <tr><td colSpan={6} className="px-4 py-4 text-gray-400 text-sm">{memberSearch.query ? 'No matching members.' : 'No members yet — use “Add member”.'}</td></tr>}
        </tbody>
      </table>
      </div>
      <PaginationFooter page={memberSearch.page} totalPages={memberSearch.totalPages} total={memberSearch.total} pageSize={memberSearch.pageSize} setPage={memberSearch.setPage} noun="members" />
    </section>
  );
}

// Add a member by email: creates the login account if the email is new (checked
// server-side), then links the user to this app with the chosen role.
function AddMember({ app, onDone }: { app: string; onDone: () => void }) {
  const [f, setF] = useState({ email: '', first_name: '', last_name: '', role: 'user' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = () => {
    if (!f.email.trim()) { setMsg({ ok: false, text: 'Email is required' }); return; }
    setBusy(true); setMsg(null);
    addLoginAppMember(app, f)
      .then(r => {
        if (!r.success) { setMsg({ ok: false, text: r.message ?? 'Add failed' }); return; }
        setF({ email: '', first_name: '', last_name: '', role: 'user' });
        setMsg({ ok: true, text: r.created ? 'New account created and added.' : 'Existing user added.' });
        onDone();
      })
      .catch(e => setMsg({ ok: false, text: String(e?.message ?? e) }))
      .finally(() => setBusy(false));
  };
  return (
    <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col text-xs text-gray-600">Email
          <input className="mt-0.5 border rounded px-2 py-1 text-sm w-64" value={f.email}
                 onChange={e => setF({ ...f, email: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') submit(); }} /></label>
        <label className="flex flex-col text-xs text-gray-600">First name
          <input className="mt-0.5 border rounded px-2 py-1 text-sm" value={f.first_name}
                 onChange={e => setF({ ...f, first_name: e.target.value })} /></label>
        <label className="flex flex-col text-xs text-gray-600">Last name
          <input className="mt-0.5 border rounded px-2 py-1 text-sm" value={f.last_name}
                 onChange={e => setF({ ...f, last_name: e.target.value })} /></label>
        <label className="flex flex-col text-xs text-gray-600">Role
          <select className="mt-0.5 border rounded px-2 py-1 text-sm" value={f.role}
                  onChange={e => setF({ ...f, role: e.target.value })}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
        <button onClick={submit} disabled={busy} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
          {busy ? 'Adding…' : 'Add'}</button>
      </div>
      {msg && <div className={`mt-2 text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</div>}
      <p className="mt-2 text-xs text-gray-500">If the email already exists, that user is linked to this app. If it's new, an account is created (no password — the user sets one via reset, social, or passkey) and linked.</p>
    </div>
  );
}
