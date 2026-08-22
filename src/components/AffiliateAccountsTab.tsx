import { useEffect, useState } from 'react';
import * as api from '../api/affiliates';
import { useAffiliateProducts } from '../hooks/useAffiliateProducts';
import { SearchBox, PaginationFooter, usePagedSearch } from './TableControls';

export function AffiliateAccountsTab({ affiliateId, accounts, onChanged }: {
  affiliateId: number; accounts: api.AffiliateAccount[]; onChanged: () => void;
}) {
  const { products, fetchProducts } = useAffiliateProducts();
  const [productId, setProductId] = useState<number | ''>('');
  const [pct, setPct] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [editingPid, setEditingPid] = useState<number | null>(null);
  const [editPct, setEditPct] = useState<string>('');

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const existingIds = new Set(accounts.map(a => a.product_id));
  const addable = products.filter(p => !existingIds.has(p.id));

  const search = usePagedSearch(accounts, (a, q) =>
    (`${a.product_name} ${a.link ?? ''} ${a.currency}`).toLowerCase().includes(q));

  const copy = (link: string | null) => { if (link) navigator.clipboard.writeText(link); };

  const add = async () => {
    if (!productId) return;
    setError(null);
    try {
      const override = pct.trim() !== ''
        ? { commission_type: 'percent' as const, commission_value: Number(pct) }
        : undefined;
      await api.addAffiliateAccount(affiliateId, Number(productId), override);
      setProductId(''); setPct('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    }
  };

  const startEdit = (a: api.AffiliateAccount) => {
    setEditingPid(a.product_id);
    setEditPct(a.effective_type === 'percent' ? String(a.effective_value) : '');
  };

  const saveEdit = async (pid: number) => {
    setError(null);
    try {
      // Blank clears the override → the account inherits the product default.
      const override: { commission_type: 'percent' | ''; commission_value: number | '' } =
        editPct.trim() !== ''
          ? { commission_type: 'percent', commission_value: Number(editPct) }
          : { commission_type: '', commission_value: '' };
      await api.updateAffiliateAccount(affiliateId, pid, override);
      setEditingPid(null); setEditPct('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update commission');
    }
  };

  const remove = async (pid: number, name: string) => {
    if (!confirm(`Remove ${name} from this affiliate?`)) return;
    await api.deleteAffiliateAccount(affiliateId, pid);
    onChanged();
  };

  return (
    <div className="space-y-3">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="flex gap-2 items-center flex-wrap">
        <select value={productId} onChange={e => setProductId(e.target.value ? Number(e.target.value) : '')}
          className="border rounded px-2 py-1 text-sm">
          <option value="">Add product…</option>
          {addable.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex items-center">
          <input type="number" min="0" max="100" step="0.01" value={pct}
            onChange={e => setPct(e.target.value)} placeholder="default"
            className="border rounded px-2 py-1 text-sm w-24" />
          <span className="ml-1 text-sm text-gray-500">%</span>
        </div>
        <button onClick={add} disabled={!productId}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">Add</button>
        <span className="text-xs text-gray-400">Leave % blank to use the product's default commission.</span>
      </div>

      {accounts.length === 0 ? (
        <p className="text-gray-500 text-sm">No products attached yet.</p>
      ) : (
        <>
        <div className="flex flex-col sm:flex-row gap-3 justify-end sm:items-center">
          <SearchBox value={search.query} onChange={search.setQuery} placeholder="Search…" className="w-full sm:w-64 flex-shrink-0" />
        </div>
        <div className="overflow-x-auto">
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
            {search.total === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No products match "{search.query}".</td></tr>
            ) : search.pageItems.map(a => (
              <tr key={a.account_id} className="border-t">
                <td className="px-4 py-2 font-medium">{a.product_name}</td>
                <td className="px-4 py-2">
                  {editingPid === a.product_id ? (
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100" step="0.01" value={editPct}
                        onChange={e => setEditPct(e.target.value)} placeholder="default"
                        className="border rounded px-2 py-1 text-sm w-20" />
                      <span className="text-gray-500">%</span>
                      <button onClick={() => saveEdit(a.product_id)}
                        className="text-green-600 hover:text-green-800 text-xs ml-1">Save</button>
                      <button onClick={() => { setEditingPid(null); setEditPct(''); }}
                        className="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{a.effective_type === 'percent' ? `${a.effective_value}%` : `${a.effective_value} ${a.currency}`}</span>
                      <button onClick={() => startEdit(a)} className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                    </div>
                  )}
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
        </div>
        <PaginationFooter page={search.page} totalPages={search.totalPages} total={search.total} pageSize={search.pageSize} setPage={search.setPage} noun="products" />
        </>
      )}
    </div>
  );
}
