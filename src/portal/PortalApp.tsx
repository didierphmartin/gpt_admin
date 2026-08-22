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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
                  <tr key={a.product_id} className="border-t">
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
