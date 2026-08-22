import { useEffect, useState } from 'react';
import { useAffiliates } from '../hooks/useAffiliates';
import { AffiliateDetail } from './AffiliateDetail';
import { AffiliateProductsTab } from './AffiliateProductsTab';
import { SearchBox, PaginationFooter, usePagedSearch } from './TableControls';

export function AffiliatesPanel() {
  const { affiliates, loading, error, fetchAffiliates, createAffiliate, deleteAffiliate } = useAffiliates();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<'affiliates' | 'products'>('affiliates');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [created, setCreated] = useState<{ key: string; existing: boolean } | null>(null);

  const search = usePagedSearch(affiliates, (a, q) =>
    (`${a.name} ${a.email} ${a.affiliate_key}`).toLowerCase().includes(q));

  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createAffiliate(form.name, form.email, form.password);
    if (res) {
      setCreated({ key: res.affiliate_key, existing: res.existing_user });
      setForm({ name: '', email: '', password: '' });
      setShowForm(false);
    }
  };

  const onDelete = async (id: number, name: string) => {
    if (confirm(`Delete affiliate "${name}"? This removes their affiliate account and all earnings history. Their login is removed only if it was created just for affiliate use.`)) {
      await deleteAffiliate(id);
      if (selectedId === id) setSelectedId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        <button onClick={() => setView('affiliates')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${view === 'affiliates' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
          Affiliate List
        </button>
        <button onClick={() => setView('products')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${view === 'products' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
          Products
        </button>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
      {created && (
        <div className="p-4 bg-green-50 text-green-800 rounded-lg flex justify-between items-center">
          <span>
            {created.existing ? 'Existing user marked as an affiliate.' : 'Affiliate created.'}{' '}
            Key: <code className="font-mono">{created.key}</code>
          </span>
          <button onClick={() => setCreated(null)} className="text-green-700 hover:text-green-900">Dismiss</button>
        </div>
      )}

      {view === 'products' && (
        <div className="bg-white rounded-lg shadow p-6"><AffiliateProductsTab /></div>
      )}

      {view === 'affiliates' && (
        <>
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
              <h2 className="text-lg font-semibold text-gray-800">Affiliates</h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <SearchBox value={search.query} onChange={search.setQuery} placeholder="Search…" className="w-full sm:w-64 flex-shrink-0" />
                <button onClick={() => setShowForm(v => !v)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  {showForm ? 'Cancel' : 'Add affiliate'}
                </button>
              </div>
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
                  <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="New users only — leave blank if already registered"
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
              <>
              <div className="overflow-x-auto">
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
                  {search.total === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No affiliates match "{search.query}".</td></tr>
                  ) : search.pageItems.map(a => (
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
              </div>
              <PaginationFooter page={search.page} totalPages={search.totalPages} total={search.total} pageSize={search.pageSize} setPage={search.setPage} noun="affiliates" />
              </>
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
