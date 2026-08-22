import { useEffect, useState } from 'react';
import * as api from '../api/affiliates';
import { useAffiliateProducts } from '../hooks/useAffiliateProducts';
import { SearchBox, PaginationFooter, usePagedSearch } from './TableControls';

const EMPTY: api.ProductInput = {
  name: '', app_ref: '', sales_page_url: '', commission_type: 'percent', commission_value: 0, currency: 'USD', active: 1,
};

export function AffiliateProductsTab() {
  const { products, error, fetchProducts, saveProduct, removeProduct } = useAffiliateProducts();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<api.ProductInput>(EMPTY);

  const search = usePagedSearch(products, (p, q) =>
    (`${p.name} ${p.sales_page_url} ${p.app_ref ?? ''} ${p.currency}`).toLowerCase().includes(q));

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
        <>
        <div className="flex flex-col sm:flex-row gap-3 justify-end sm:items-center">
          <SearchBox value={search.query} onChange={search.setQuery} placeholder="Search…" className="w-full sm:w-64 flex-shrink-0" />
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">Name</th><th className="px-4 py-2">URL</th>
              <th className="px-4 py-2">Commission</th><th className="px-4 py-2">Active</th><th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {search.total === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No products match "{search.query}".</td></tr>
            ) : search.pageItems.map(p => (
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
        </div>
        <PaginationFooter page={search.page} totalPages={search.totalPages} total={search.total} pageSize={search.pageSize} setPage={search.setPage} noun="products" />
        </>
      )}
    </div>
  );
}
