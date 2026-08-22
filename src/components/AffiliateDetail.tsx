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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{detail?.affiliate.name ?? 'Affiliate'}</h2>
            <p className="text-sm text-gray-500">{detail?.affiliate.email} · key <code className="font-mono">{detail?.affiliate.affiliate_key}</code></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="border-b">
          <nav className="flex -mb-px">
            {(['overview', 'transactions'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t === 'overview' ? 'Products & Commissions' : 'Transactions'}
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
    </div>
  );
}
