import { useState, useEffect, useCallback, useMemo } from 'react';
import { useModelCatalog, type Catalog } from '../lib/modelCatalog';

interface PricingTier {
  name: string;
  price: string;
  unit: string;
  details?: string;
}

interface ProviderCost {
  provider: string;
  displayName: string;
  category: 'llm' | 'voice' | 'avatar';
  tiers: PricingTier[];
  pricingUrl: string;
  lastUpdated: string | null;
  notes?: string;
}

interface CostsData {
  llm: ProviderCost[];
  voice: ProviderCost[];
  avatar: ProviderCost[];
  lastRefreshed: string | null;
}

interface ProviderUsage {
  provider: string;
  requests: number;
  tokens?: number;
  tokensIn?: number;
  tokensOut?: number;
  priceIn?: number | null;
  priceOut?: number | null;
  costIn?: number;
  costOut?: number;
  storedCost?: number;
  seconds?: number;
  cost: number;
  textCost?: number;
  lastUsed: string | null;
}

interface UsageTotals {
  today: number;
  week: number;
  month: number;
  total: number;
}

interface UsageCosts {
  llm: {
    byProvider: ProviderUsage[];
    totals: UsageTotals;
  };
  voice: {
    byProvider: ProviderUsage[];
    totals: UsageTotals;
  };
  avatar: {
    byProvider: ProviderUsage[];
    totals: UsageTotals;
    note?: string;
  };
}

interface ExchangeRates {
  USD: number;
  EUR: number;
  CAD: number;
}

type Currency = 'USD' | 'EUR' | 'CAD';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '\u20AC',
  CAD: 'C$'
};

const CURRENCY_NAMES: Record<Currency, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  CAD: 'Canadian Dollar'
};

// Default pricing structure - will be populated from API/LLM. LLM prices are
// not listed here: they come from the shared model catalog (see llmCosts).
const DEFAULT_COSTS: CostsData = {
  llm: [],
  voice: [
    {
      provider: 'elevenlabs',
      displayName: 'ElevenLabs',
      category: 'voice',
      tiers: [
        { name: 'Free', price: '$0', unit: '/ month', details: '10,000 characters/month' },
        { name: 'Starter', price: '$5', unit: '/ month', details: '30,000 characters/month' },
        { name: 'Creator', price: '$22', unit: '/ month', details: '100,000 characters/month' },
        { name: 'Pro', price: '$99', unit: '/ month', details: '500,000 characters/month' },
      ],
      pricingUrl: 'https://elevenlabs.io/pricing',
      lastUpdated: null,
    },
    {
      provider: 'hume',
      displayName: 'Hume AI',
      category: 'voice',
      tiers: [
        { name: 'EVI (Empathic Voice)', price: '$0.07', unit: '/ minute', details: 'Real-time voice with emotion' },
        { name: 'Expression Measurement', price: '$0.0036', unit: '/ API call' },
      ],
      pricingUrl: 'https://www.hume.ai/pricing',
      lastUpdated: null,
    },
    {
      provider: 'gemini',
      displayName: 'Gemini Live (Google)',
      category: 'voice',
      tiers: [
        { name: 'Gemini 2.0 Flash Live', price: '$0.35', unit: '/ 1M audio tokens input', details: '$8.75 / 1M audio tokens output' },
      ],
      pricingUrl: 'https://ai.google.dev/pricing',
      lastUpdated: null,
    },
    {
      provider: 'grok',
      displayName: 'Grok Voice (xAI)',
      category: 'voice',
      tiers: [
        { name: 'Grok Voice Agent API', price: '$0.05', unit: '/ minute', details: 'Real-time voice conversation' },
        { name: 'Tool Invocations', price: 'Additional', unit: 'per call', details: 'Web search, X search, function calls charged separately' },
      ],
      pricingUrl: 'https://docs.x.ai/developers/models',
      lastUpdated: null,
    },
  ],
  avatar: [
    {
      provider: 'did',
      displayName: 'D-ID',
      category: 'avatar',
      tiers: [
        { name: 'Free Trial', price: '$0', unit: '', details: '5 minutes of video' },
        { name: 'Lite', price: '$5.90', unit: '/ month', details: '10 minutes/month' },
        { name: 'Pro', price: '$49', unit: '/ month', details: '15 minutes/month' },
        { name: 'Advanced', price: '$299', unit: '/ month', details: '65 minutes/month' },
      ],
      pricingUrl: 'https://www.d-id.com/pricing',
      lastUpdated: null,
    },
    {
      provider: 'heygen',
      displayName: 'HeyGen',
      category: 'avatar',
      tiers: [
        { name: 'Free', price: '$0', unit: '', details: '1 credit (limited features)' },
        { name: 'Creator', price: '$24', unit: '/ month', details: '15 credits/month' },
        { name: 'Business', price: '$72', unit: '/ month', details: '30 credits/month' },
        { name: 'Enterprise', price: 'Custom', unit: '', details: 'Contact sales' },
      ],
      pricingUrl: 'https://www.heygen.com/pricing',
      lastUpdated: null,
    },
    {
      provider: 'tavus',
      displayName: 'Tavus',
      category: 'avatar',
      tiers: [
        { name: 'Starter', price: '$39', unit: '/ month', details: '30 minutes/month' },
        { name: 'Pro', price: '$149', unit: '/ month', details: '120 minutes/month' },
        { name: 'Enterprise', price: 'Custom', unit: '', details: 'Contact sales' },
      ],
      pricingUrl: 'https://www.tavus.io/pricing',
      lastUpdated: null,
    },
    {
      provider: 'anam',
      displayName: 'Anam AI',
      category: 'avatar',
      tiers: [
        { name: 'API Access', price: 'Contact', unit: 'for pricing', details: 'Real-time avatar streaming' },
      ],
      pricingUrl: 'https://www.anam.ai',
      lastUpdated: null,
    },
  ],
  lastRefreshed: null,
};

const DEFAULT_USAGE: UsageCosts = {
  llm: { byProvider: [], totals: { today: 0, week: 0, month: 0, total: 0 } },
  voice: { byProvider: [], totals: { today: 0, week: 0, month: 0, total: 0 } },
  avatar: { byProvider: [], totals: { today: 0, week: 0, month: 0, total: 0 } },
};

const DEFAULT_RATES: ExchangeRates = {
  USD: 1.0,
  EUR: 0.92,
  CAD: 1.36
};

import { getAdminBase } from '../lib/backendConfig';

const API_BASE = getAdminBase();

/** A USD amount with at least two decimals, e.g. 0.75 -> "$0.75", 0.003 -> "$0.003". */
function usd(n: number): string {
  const decimals = Math.max(2, (String(n).split('.')[1] || '').length);
  return `$${n.toFixed(decimals)}`;
}

/**
 * LLM pricing cards, built from the model catalog only (the single source of
 * LLM prices). A stored entry for the provider may only supply its display
 * name and pricing page; stored LLM tiers are never shown. A provider the
 * catalog lists with no models still gets a card, with no tiers.
 */
function llmCostsFromCatalog(catalog: Catalog, stored: ProviderCost[]): ProviderCost[] {
  const byKey = new Map(stored.map((p) => [p.provider, p]));
  return Object.keys(catalog).map((key) => {
    const meta = byKey.get(key);
    return {
      provider: key,
      displayName: meta?.displayName || key.charAt(0).toUpperCase() + key.slice(1),
      category: 'llm',
      tiers: (catalog[key] || []).map((m) => ({
        name: m.promo_ends ? `${m.label || m.id} (promo until ${m.promo_ends})` : (m.label || m.id),
        price: typeof m.input === 'number' ? usd(m.input) : '\u2014',
        unit: '/ 1M input tokens',
        details: typeof m.output === 'number' ? `${usd(m.output)} / 1M output tokens` : undefined,
      })),
      pricingUrl: meta?.pricingUrl || '',
      lastUpdated: null,
      notes: 'Prices from the model catalog.',
    };
  });
}

type MainTab = 'usage' | 'pricing';

export function CostsPanel() {
  const [costs, setCosts] = useState<CostsData>(DEFAULT_COSTS);
  const { catalog, loading: catalogLoading, error: catalogError } = useModelCatalog();
  const [usageCosts, setUsageCosts] = useState<UsageCosts>(DEFAULT_USAGE);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_RATES);
  const [ratesLastUpdated, setRatesLastUpdated] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [refreshingProvider, setRefreshingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('usage');
  const [activeCategory, setActiveCategory] = useState<'llm' | 'voice' | 'avatar'>('llm');

  const fetchCosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token') || localStorage.getItem('voice_token');

      // Fetch costs and exchange rates in parallel
      const [costsResponse, ratesResponse] = await Promise.all([
        fetch(`${API_BASE}/costs`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }),
        fetch(`${API_BASE}/exchange-rates`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
      ]);

      if (costsResponse.ok) {
        const data = await costsResponse.json();
        if (data.success) {
          if (data.costs) {
            setCosts(data.costs);
          }
          if (data.usageCosts) {
            setUsageCosts(data.usageCosts);
          }
        }
      }

      if (ratesResponse.ok) {
        const data = await ratesResponse.json();
        if (data.success && data.rates) {
          setExchangeRates(data.rates);
          setRatesLastUpdated(data.lastUpdated);
        }
      }
    } catch (err) {
      console.error('Failed to fetch costs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  // Save currency preference to localStorage
  useEffect(() => {
    const savedCurrency = localStorage.getItem('costs_currency') as Currency | null;
    if (savedCurrency && ['USD', 'EUR', 'CAD'].includes(savedCurrency)) {
      setCurrency(savedCurrency);
    }
  }, []);

  const handleCurrencyChange = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    localStorage.setItem('costs_currency', newCurrency);
  };

  const refreshExchangeRates = async () => {
    setRefreshingRates(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('voice_token');
      const response = await fetch(`${API_BASE}/exchange-rates/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.rates) {
          setExchangeRates(data.rates);
          setRatesLastUpdated(data.lastUpdated);
        }
      }
    } catch (err) {
      console.error('Failed to refresh exchange rates:', err);
    } finally {
      setRefreshingRates(false);
    }
  };

  const refreshAllCosts = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('voice_token');
      const response = await fetch(`${API_BASE}/costs/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          if (data.costs) {
            setCosts(data.costs);
          }
          if (data.usageCosts) {
            setUsageCosts(data.usageCosts);
          }
        } else {
          setError(data.error || 'Failed to refresh costs');
        }
      } else {
        setError('Failed to refresh costs from server');
      }
    } catch (err) {
      setError('Network error while refreshing costs');
      console.error('Failed to refresh costs:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const refreshProviderCosts = async (category: 'llm' | 'voice' | 'avatar', provider: string) => {
    setRefreshingProvider(`${category}-${provider}`);
    setError(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('voice_token');
      const response = await fetch(`${API_BASE}/costs/refresh-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ category, provider }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.provider) {
          setCosts(prev => ({
            ...prev,
            [category]: prev[category].map(p =>
              p.provider === provider ? data.provider : p
            ),
            lastRefreshed: new Date().toISOString(),
          }));
        } else {
          setError(data.error || 'Failed to refresh provider costs');
        }
      } else {
        setError('Failed to refresh provider costs from server');
      }
    } catch (err) {
      setError('Network error while refreshing provider');
      console.error('Failed to refresh provider:', err);
    } finally {
      setRefreshingProvider(null);
    }
  };

  // Convert USD amount to selected currency
  const convertCurrency = (usdAmount: number): number => {
    if (currency === 'USD') return usdAmount;
    const rate = exchangeRates[currency] || 1;
    return usdAmount * rate;
  };

  // Format currency with proper symbol and locale
  const formatCurrency = (usdValue: number): string => {
    const convertedValue = convertCurrency(usdValue);

    const localeMap: Record<Currency, string> = {
      USD: 'en-US',
      EUR: 'de-DE',
      CAD: 'en-CA'
    };

    return new Intl.NumberFormat(localeMap[currency], {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(convertedValue);
  };

  // Convert price string from USD to selected currency
  const convertPriceString = (priceStr: string): string => {
    if (currency === 'USD') return priceStr;

    // Handle non-numeric prices like "Custom", "Contact", "Included"
    if (!priceStr.includes('$')) return priceStr;

    // Extract numeric value from price string
    const match = priceStr.match(/\$?([\d,.]+)/);
    if (!match) return priceStr;

    const usdValue = parseFloat(match[1].replace(',', ''));
    if (isNaN(usdValue)) return priceStr;

    const convertedValue = convertCurrency(usdValue);
    const symbol = CURRENCY_SYMBOLS[currency];

    // Format with appropriate precision
    const formatted = convertedValue < 1
      ? convertedValue.toFixed(4).replace(/\.?0+$/, '')
      : convertedValue.toFixed(2);

    return `${symbol}${formatted}`;
  };

  const getCategoryColor = (category: 'llm' | 'voice' | 'avatar') => {
    switch (category) {
      case 'llm': return 'bg-purple-100 text-purple-800';
      case 'voice': return 'bg-blue-100 text-blue-800';
      case 'avatar': return 'bg-green-100 text-green-800';
    }
  };

  const llmCosts = useMemo(() => llmCostsFromCatalog(catalog, costs.llm), [catalog, costs.llm]);
  const categories = [
    { id: 'llm' as const, label: 'LLM', count: llmCosts.length },
    { id: 'voice' as const, label: 'Voice', count: costs.voice.length },
    { id: 'avatar' as const, label: 'Avatar', count: costs.avatar.length },
  ];

  const currentProviders = activeCategory === 'llm' ? llmCosts : costs[activeCategory];
  const currentUsage = usageCosts[activeCategory];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500">Loading costs data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Costs</h2>
          <p className="text-sm text-gray-500 mt-1">
            Usage costs and provider pricing for LLM, Voice, and Avatar services
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Currency Selector */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            {(['USD', 'EUR', 'CAD'] as Currency[]).map((cur) => (
              <button
                key={cur}
                onClick={() => handleCurrencyChange(cur)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  currency === cur
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title={CURRENCY_NAMES[cur]}
              >
                {CURRENCY_SYMBOLS[cur]} {cur}
              </button>
            ))}
          </div>
          <button
            onClick={refreshAllCosts}
            disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              refreshing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
      </div>

      {/* Exchange Rate Info */}
      <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
        <div className="flex items-center gap-4">
          <span>Exchange Rates (base: USD):</span>
          <span className="font-medium">1 USD = {exchangeRates.EUR.toFixed(4)} EUR</span>
          <span className="font-medium">1 USD = {exchangeRates.CAD.toFixed(4)} CAD</span>
          {ratesLastUpdated && (
            <span className="text-gray-400">
              Updated: {new Date(ratesLastUpdated).toLocaleDateString()}
            </span>
          )}
        </div>
        <button
          onClick={refreshExchangeRates}
          disabled={refreshingRates}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
          <svg
            className={`w-3 h-3 ${refreshingRates ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Update Rates
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Main Tabs: Usage Costs vs Provider Pricing */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setMainTab('usage')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              mainTab === 'usage'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Usage Costs
          </button>
          <button
            onClick={() => setMainTab('pricing')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              mainTab === 'pricing'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Provider Pricing
          </button>
        </nav>
      </div>

      {/* Usage Costs Tab */}
      {mainTab === 'usage' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* LLM Costs */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-500">LLM Costs</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor('llm')}`}>LLM</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Today</span>
                  <span className="font-semibold">{formatCurrency(usageCosts.llm.totals.today)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">This Week</span>
                  <span className="font-semibold">{formatCurrency(usageCosts.llm.totals.week)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="font-semibold text-lg text-purple-700">{formatCurrency(usageCosts.llm.totals.month)}</span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between">
                  <span className="text-sm text-gray-600">All Time</span>
                  <span className="font-medium">{formatCurrency(usageCosts.llm.totals.total)}</span>
                </div>
              </div>
            </div>

            {/* Voice Costs */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-500">Voice Costs</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor('voice')}`}>Voice</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Today</span>
                  <span className="font-semibold">{formatCurrency(usageCosts.voice.totals.today)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">This Week</span>
                  <span className="font-semibold">{formatCurrency(usageCosts.voice.totals.week)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="font-semibold text-lg text-blue-700">{formatCurrency(usageCosts.voice.totals.month)}</span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between">
                  <span className="text-sm text-gray-600">All Time</span>
                  <span className="font-medium">{formatCurrency(usageCosts.voice.totals.total)}</span>
                </div>
              </div>
            </div>

            {/* Avatar Costs */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-500">Avatar Costs</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor('avatar')}`}>Avatar</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Today</span>
                  <span className="font-semibold">{formatCurrency(usageCosts.avatar.totals.today)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">This Week</span>
                  <span className="font-semibold">{formatCurrency(usageCosts.avatar.totals.week)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="font-semibold text-lg text-green-700">{formatCurrency(usageCosts.avatar.totals.month)}</span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between">
                  <span className="text-sm text-gray-600">All Time</span>
                  <span className="font-medium">{formatCurrency(usageCosts.avatar.totals.total)}</span>
                </div>
              </div>
              {usageCosts.avatar.note && (
                <p className="text-xs text-gray-400 mt-2">{usageCosts.avatar.note}</p>
              )}
            </div>
          </div>

          {/* Category Sub-tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeCategory === cat.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {cat.label} Breakdown
                </button>
              ))}
            </nav>
          </div>

          {/* Usage by Provider */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">
                {activeCategory.toUpperCase()} Usage by Provider (Last 30 Days)
              </h3>
            </div>
            {currentUsage.byProvider.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium text-right">Requests</th>
                    {activeCategory === 'llm' && (
                      <>
                        <th
                          className="px-4 py-3 font-medium text-right"
                          title="Input tokens and their cost (tokens × current price_input_per_1m)"
                        >
                          In (tokens / {currency})
                        </th>
                        <th
                          className="px-4 py-3 font-medium text-right"
                          title="Output tokens and their cost (tokens × current price_output_per_1m)"
                        >
                          Out (tokens / {currency})
                        </th>
                      </>
                    )}
                    {activeCategory === 'voice' && <th className="px-4 py-3 font-medium text-right">Duration</th>}
                    <th className="px-4 py-3 font-medium text-right">Total ({currency})</th>
                    <th className="px-4 py-3 font-medium">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentUsage.byProvider.map((usage, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800 capitalize">{usage.provider}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {usage.requests.toLocaleString()}
                      </td>
                      {activeCategory === 'llm' && (
                        <>
                          <td className="px-4 py-3 text-right">
                            <div className="font-semibold text-gray-900">
                              {usage.priceIn != null
                                ? formatCurrency(usage.costIn ?? 0)
                                : <span className="italic text-gray-400 font-normal">price n/a</span>}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(usage.tokensIn ?? 0).toLocaleString()} tok
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-semibold text-gray-900">
                              {usage.priceOut != null
                                ? formatCurrency(usage.costOut ?? 0)
                                : <span className="italic text-gray-400 font-normal">price n/a</span>}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(usage.tokensOut ?? 0).toLocaleString()} tok
                            </div>
                          </td>
                        </>
                      )}
                      {activeCategory === 'voice' && (
                        <td className="px-4 py-3 text-right text-gray-600">
                          {Math.round(usage.seconds || 0)}s
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {activeCategory === 'llm'
                          ? (usage.costIn != null || usage.costOut != null
                              ? formatCurrency((usage.costIn ?? 0) + (usage.costOut ?? 0))
                              : <span className="italic text-gray-400">n/a</span>)
                          : formatCurrency(usage.cost)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {usage.lastUsed ? new Date(usage.lastUsed).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {(() => {
                  const rows = currentUsage.byProvider;
                  const totalRequests = rows.reduce((s, r) => s + (r.requests || 0), 0);
                  const totalTokensIn = rows.reduce((s, r) => s + (r.tokensIn ?? 0), 0);
                  const totalTokensOut = rows.reduce((s, r) => s + (r.tokensOut ?? 0), 0);
                  const totalCostIn = rows.reduce((s, r) => s + (r.costIn ?? 0), 0);
                  const totalCostOut = rows.reduce((s, r) => s + (r.costOut ?? 0), 0);
                  const totalSeconds = rows.reduce((s, r) => s + (r.seconds || 0), 0);
                  const grandTotal = activeCategory === 'llm'
                    ? totalCostIn + totalCostOut
                    : rows.reduce((s, r) => s + (r.cost || 0), 0);
                  return (
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-900">
                        <td className="px-4 py-3">Total</td>
                        <td className="px-4 py-3 text-right">{totalRequests.toLocaleString()}</td>
                        {activeCategory === 'llm' && (
                          <>
                            <td className="px-4 py-3 text-right">
                              <div>{formatCurrency(totalCostIn)}</div>
                              <div className="text-xs text-gray-600 font-normal">{totalTokensIn.toLocaleString()} tok</div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div>{formatCurrency(totalCostOut)}</div>
                              <div className="text-xs text-gray-600 font-normal">{totalTokensOut.toLocaleString()} tok</div>
                            </td>
                          </>
                        )}
                        {activeCategory === 'voice' && (
                          <td className="px-4 py-3 text-right">{Math.round(totalSeconds)}s</td>
                        )}
                        <td className="px-4 py-3 text-right">{formatCurrency(grandTotal)}</td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No {activeCategory} usage recorded in the last 30 days
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provider Pricing Tab */}
      {mainTab === 'pricing' && (
        <div className="space-y-6">
          {/* Last Refreshed Info */}
          {costs.lastRefreshed && (
            <p className="text-xs text-gray-400">
              Pricing last refreshed: {new Date(costs.lastRefreshed).toLocaleString()}
            </p>
          )}

          {/* Category Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeCategory === cat.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {cat.label} Providers
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(cat.id)}`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {activeCategory === 'llm' && catalogLoading && (
            <div className="text-sm text-gray-500 py-6 text-center">Loading LLM prices from the model catalog…</div>
          )}
          {activeCategory === 'llm' && !catalogLoading && catalogError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
              Could not load the model catalog, so LLM prices are unavailable: {catalogError}
            </div>
          )}

          {/* Provider Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {currentProviders.map((provider) => (
              <div
                key={provider.provider}
                className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
              >
                {/* Provider Header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-800">{provider.displayName}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(provider.category)}`}>
                      {provider.category.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={provider.pricingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Pricing Page
                    </a>
                    {/* LLM prices come from the model catalog, so there is nothing to refresh. */}
                    {provider.category !== 'llm' && (
                      <button
                        onClick={() => refreshProviderCosts(provider.category, provider.provider)}
                        disabled={refreshingProvider === `${provider.category}-${provider.provider}`}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                        title="Refresh this provider"
                      >
                        <svg
                          className={`w-4 h-4 ${refreshingProvider === `${provider.category}-${provider.provider}` ? 'animate-spin' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Pricing Tiers */}
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="pb-2 font-medium">Plan / Model</th>
                        <th className="pb-2 font-medium text-right">Price ({currency})</th>
                        <th className="pb-2 font-medium">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {provider.tiers.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-gray-400 italic">
                            {provider.category === 'llm' ? 'No models listed in the model catalog' : 'No pricing tiers'}
                          </td>
                        </tr>
                      )}
                      {provider.tiers.map((tier, idx) => (
                        <tr key={idx}>
                          <td className="py-2">
                            <span className="font-medium text-gray-700">{tier.name}</span>
                            {tier.details && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {tier.details.includes('$') ? convertPriceString(tier.details) : tier.details}
                              </p>
                            )}
                          </td>
                          <td className="py-2 text-right font-semibold text-gray-900">
                            {convertPriceString(tier.price)}
                          </td>
                          <td className="py-2 text-gray-500">{tier.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {provider.notes && (
                    <p className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      {provider.notes}
                    </p>
                  )}

                  {provider.lastUpdated && (
                    <p className="mt-2 text-xs text-gray-400">
                      Updated: {new Date(provider.lastUpdated).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">About Pricing & Currency</p>
                <p className="mt-1 text-blue-700">
                  Provider pricing is shown in {CURRENCY_NAMES[currency]} based on current exchange rates.
                  Original prices are in USD. Click "Refresh All" to fetch the latest pricing using AI.
                  Exchange rates are updated from live market data.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
