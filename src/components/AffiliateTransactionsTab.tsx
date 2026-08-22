import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/affiliates';
import { SearchBox, PaginationFooter, usePagedSearch } from './TableControls';

export function AffiliateTransactionsTab({ affiliateId, onChanged }: {
  affiliateId: number; onChanged: () => void;
}) {
  const [rows, setRows] = useState<api.AffiliateTransaction[]>([]);
  const [totals, setTotals] = useState<api.TransactionTotals>({ paid: 0, owed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const search = usePagedSearch(rows, (t, q) =>
    (`${t.product_name} ${t.status} ${t.currency}`).toLowerCase().includes(q));

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <>
        <div className="flex flex-col sm:flex-row gap-3 justify-end sm:items-center">
          <SearchBox value={search.query} onChange={search.setQuery} placeholder="Search…" className="w-full sm:w-64 flex-shrink-0" />
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">Date</th><th className="px-4 py-2">Product</th>
              <th className="px-4 py-2 text-right">Sale</th><th className="px-4 py-2 text-right">Commission</th>
              <th className="px-4 py-2">Status</th><th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {search.total === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No transactions match "{search.query}".</td></tr>
            ) : search.pageItems.map(t => (
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
        </div>
        <PaginationFooter page={search.page} totalPages={search.totalPages} total={search.total} pageSize={search.pageSize} setPage={search.setPage} noun="transactions" />
        </>
      )}
    </div>
  );
}
