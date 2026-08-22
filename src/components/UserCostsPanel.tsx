import { useEffect, useState } from 'react';
import * as api from '../api/client';

interface ProviderUsage {
  provider: string;
  requests: number;
  tokens?: number;
  tokensIn?: number;
  tokensOut?: number;
  priceIn?: number | null;
  priceOut?: number | null;
  costIn?: number | null;
  costOut?: number | null;
  storedCost?: number;
  seconds?: number;
  cost: number;
  lastUsed: string | null;
}

interface UsageTotals {
  today: number;
  week: number;
  month: number;
  total: number;
}

interface UsageCosts {
  llm: { byProvider: ProviderUsage[]; totals: UsageTotals };
  voice: { byProvider: ProviderUsage[]; totals: UsageTotals };
  avatar: { byProvider: ProviderUsage[]; totals: UsageTotals; note?: string };
}

type Currency = 'USD' | 'EUR' | 'CAD';
interface Rates { USD: number; EUR: number; CAD: number }
const DEFAULT_RATES: Rates = { USD: 1, EUR: 0.92, CAD: 1.36 };
const CURRENCY_STORAGE_KEY = 'costs_currency';

interface Props {
  userId: number;
}

export function UserCostsPanel({ userId }: Props) {
  const [data, setData] = useState<UsageCosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    return (saved === 'USD' || saved === 'EUR' || saved === 'CAD') ? saved : 'USD';
  });

  const fmt = (usd: number) => {
    const rate = rates[currency] ?? 1;
    return (usd * rate).toLocaleString('en-US', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4,
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.getUserCosts(userId), api.getExchangeRates()])
      .then(([costs, rts]) => {
        if (cancelled) return;
        setData(costs.usageCosts as UsageCosts);
        if (rts?.rates) {
          setRates(rts.rates);
          setRatesUpdatedAt(rts.lastUpdated);
        }
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [userId]);

  const handleCurrencyChange = (c: Currency) => {
    setCurrency(c);
    localStorage.setItem(CURRENCY_STORAGE_KEY, c);
  };

  const handleRefreshRates = async () => {
    setRefreshingRates(true);
    try {
      const res = await api.refreshExchangeRatesApi();
      if (res?.rates) {
        setRates(res.rates);
        setRatesUpdatedAt(res.lastUpdated);
      }
    } catch (err) {
      console.error('refresh rates failed', err);
    } finally {
      setRefreshingRates(false);
    }
  };

  if (loading) return <div className="p-4 text-gray-500">Loading costs…</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Currency switcher + exchange rates bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Currency:</span>
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
            {(['USD', 'EUR', 'CAD'] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => handleCurrencyChange(c)}
                className={`px-3 py-1 text-xs font-medium ${
                  currency === c ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="font-medium">1 USD = {rates.EUR.toFixed(4)} EUR</span>
          <span className="font-medium">1 USD = {rates.CAD.toFixed(4)} CAD</span>
          {ratesUpdatedAt && (
            <span className="text-gray-400">Updated: {new Date(ratesUpdatedAt).toLocaleDateString()}</span>
          )}
          <button
            onClick={handleRefreshRates}
            disabled={refreshingRates}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
            title="Fetch latest USD→EUR/CAD rates"
          >
            <svg className={`w-3 h-3 ${refreshingRates ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshingRates ? 'Refreshing…' : 'Refresh rates'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TotalsCard title="LLM Costs" totals={data.llm.totals} accent="bg-blue-50 text-blue-700" fmt={fmt} />
        <TotalsCard title="Voice Costs" totals={data.voice.totals} accent="bg-purple-50 text-purple-700" fmt={fmt} />
      </div>

      <UsageTable
        title="LLM Usage by Provider (Last 30 Days)"
        category="llm"
        rows={data.llm.byProvider}
        currency={currency}
        fmt={fmt}
      />

      <UsageTable
        title="Voice Usage by Provider (Last 30 Days)"
        category="voice"
        rows={data.voice.byProvider}
        currency={currency}
        fmt={fmt}
      />
    </div>
  );
}

function TotalsCard({
  title, totals, accent, fmt,
}: { title: string; totals: UsageTotals; accent: string; fmt: (v: number) => string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className={`px-4 py-2 text-sm font-semibold ${accent}`}>{title}</div>
      <div className="p-4 grid grid-cols-4 gap-2 text-sm">
        <Cell label="Today" value={totals.today} fmt={fmt} />
        <Cell label="Week" value={totals.week} fmt={fmt} />
        <Cell label="Month" value={totals.month} fmt={fmt} />
        <Cell label="All Time" value={totals.total} fmt={fmt} />
      </div>
    </div>
  );
}

function Cell({ label, value, fmt }: { label: string; value: number; fmt: (v: number) => string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">{fmt(value)}</p>
    </div>
  );
}

interface UsageTableProps {
  title: string;
  category: 'llm' | 'voice';
  rows: ProviderUsage[];
  currency: Currency;
  fmt: (usd: number) => string;
}

function UsageTable({ title, category, rows, currency, fmt }: UsageTableProps) {
  const totalRequests = rows.reduce((s, r) => s + (r.requests || 0), 0);
  const totalTokensIn = rows.reduce((s, r) => s + (r.tokensIn ?? 0), 0);
  const totalTokensOut = rows.reduce((s, r) => s + (r.tokensOut ?? 0), 0);
  const totalCostIn = rows.reduce((s, r) => s + (r.costIn ?? 0), 0);
  const totalCostOut = rows.reduce((s, r) => s + (r.costOut ?? 0), 0);
  const totalSeconds = rows.reduce((s, r) => s + (r.seconds || 0), 0);
  const grandTotal =
    category === 'llm'
      ? totalCostIn + totalCostOut
      : rows.reduce((s, r) => s + (r.cost || 0), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      {rows.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium text-right">Requests</th>
              {category === 'llm' && (
                <>
                  <th className="px-4 py-3 font-medium text-right">In (tokens / {currency})</th>
                  <th className="px-4 py-3 font-medium text-right">Out (tokens / {currency})</th>
                </>
              )}
              {category === 'voice' && <th className="px-4 py-3 font-medium text-right">Duration</th>}
              <th className="px-4 py-3 font-medium text-right">Total ({currency})</th>
              <th className="px-4 py-3 font-medium">Last Used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((u, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-800 capitalize">{u.provider}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{u.requests.toLocaleString()}</td>
                {category === 'llm' && (
                  <>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-gray-900">
                        {u.priceIn != null
                          ? fmt(u.costIn ?? 0)
                          : <span className="italic text-gray-400 font-normal">price n/a</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(u.tokensIn ?? 0).toLocaleString()} tok
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-gray-900">
                        {u.priceOut != null
                          ? fmt(u.costOut ?? 0)
                          : <span className="italic text-gray-400 font-normal">price n/a</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(u.tokensOut ?? 0).toLocaleString()} tok
                      </div>
                    </td>
                  </>
                )}
                {category === 'voice' && (
                  <td className="px-4 py-3 text-right text-gray-600">{Math.round(u.seconds || 0)}s</td>
                )}
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {category === 'llm'
                    ? (u.costIn != null || u.costOut != null
                        ? fmt((u.costIn ?? 0) + (u.costOut ?? 0))
                        : <span className="italic text-gray-400">n/a</span>)
                    : fmt(u.cost)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">
                  {u.lastUsed ? new Date(u.lastUsed).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-900">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{totalRequests.toLocaleString()}</td>
              {category === 'llm' && (
                <>
                  <td className="px-4 py-3 text-right">
                    <div>{fmt(totalCostIn)}</div>
                    <div className="text-xs text-gray-600 font-normal">{totalTokensIn.toLocaleString()} tok</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div>{fmt(totalCostOut)}</div>
                    <div className="text-xs text-gray-600 font-normal">{totalTokensOut.toLocaleString()} tok</div>
                  </td>
                </>
              )}
              {category === 'voice' && (
                <td className="px-4 py-3 text-right">{Math.round(totalSeconds)}s</td>
              )}
              <td className="px-4 py-3 text-right">{fmt(grandTotal)}</td>
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div className="p-8 text-center text-gray-500">
          No {category} usage recorded in the last 30 days for this user
        </div>
      )}
    </div>
  );
}
