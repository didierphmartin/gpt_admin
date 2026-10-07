import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../api/client';

interface OverallStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost: number;
  avg_response_time_ms: number;
  unique_users: number;
  voice_requests: number;
  audio_seconds: number;
  voice_cost: number;
  total_function_calls: number;
  total_mcp_calls: number;
}

interface ProviderStats {
  provider: string;
  requests: number;
  tokens: number;
  cost: number;
  avg_response_time_ms: number;
  voice_requests: number;
  audio_seconds: number;
  voice_cost: number;
  function_calls: number;
  mcp_calls: number;
}

interface DailyTrend {
  date: string;
  requests: number;
  cost: number;
  tokens: number;
}

interface UserUsage {
  user_id: number;
  email: string;
  name: string;
  requests: number;
  tokens: number;
  cost: number;
  avg_response_time_ms: number;
  last_activity: string;
  voice_requests: number;
  audio_seconds: number;
  voice_cost: number;
  function_calls: number;
  mcp_calls: number;
}

interface Transaction {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  response_time_ms: number;
  status: string;
  error_message: string | null;
  function_calls: number;
  functions_called: string[] | null;
  mcp_calls: number;
  mcp_tools_called: string[] | null;
  created_at: string;
  is_voice: boolean;
  audio_seconds: number;
  audio_input_seconds: number;
  audio_output_seconds: number;
}

interface UserDetail {
  user: { id: number; email: string; name: string };
  stats: {
    total_requests: number;
    successful_requests: number;
    total_tokens: number;
    total_cost: number;
    avg_response_time_ms: number;
    voice_requests: number;
    audio_seconds: number;
    voice_cost: number;
    function_calls: number;
    mcp_calls: number;
  };
  by_provider: ProviderStats[];
  recent_transactions: Transaction[];
}

interface ToolDetail {
  name: string;
  count: number;
  unique_users: number;
  last_used: string | null;
  is_mcp: boolean;
  mcp_server: string | null;
}

interface AvailableTool {
  name: string;
  description: string;
  count: number;
  unique_users: number;
  last_used: string | null;
  is_mcp: boolean;
  has_been_used: boolean;
  mcp_server?: string;
  original_name?: string;
  server_url?: string;
}

interface MCPServer {
  id: number;
  is_global: boolean;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  tool_count: number;
  created_at: string;
  updated_at: string;
}

interface MCPServerStats {
  name: string;
  total_calls: number;
  tool_count: number;
  unique_users: number;
  tools: { name: string; count: number; unique_users: number; last_used: string | null }[];
}

interface ToolUsageStats {
  total_function_calls: number;
  total_mcp_calls: number;
  total_requests: number;
  requests_with_tools: number;
  tool_usage_rate: number;
  unique_tools_count: number;
  unique_mcp_tools_count: number;
  top_tools: ToolDetail[];
  regular_tools: ToolDetail[];
  mcp_tools: ToolDetail[];
  mcp_servers: MCPServerStats[];
  all_regular_tools: AvailableTool[];
  all_mcp_tools: AvailableTool[];
  by_provider: { provider: string; function_calls: number; mcp_calls: number }[];
}

type Period = 'day' | 'week' | 'month' | 'year' | 'all';
type View = 'overview' | 'by-user' | 'transactions' | 'tools';

import { getApiV1Base } from '../lib/backendConfig';

const API_BASE = getApiV1Base();

export function UsageStats() {
  // Every configured provider row (chat + decision), for the provider filter.
  const [providerRows, setProviderRows] = useState<{ provider_key: string; display_name?: string }[]>([]);
  useEffect(() => {
    api.getLLMSettings().then((res) => setProviderRows(res.providers || [])).catch(() => setProviderRows([]));
  }, []);
  const { token } = useAuth();
  const [view, setView] = useState<View>('overview');
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Overview data
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [byProvider, setByProvider] = useState<ProviderStats[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);

  // By user data
  const [userUsage, setUserUsage] = useState<UserUsage[]>([]);

  // Transactions data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionFilters, setTransactionFilters] = useState({
    provider: '',
    status: '',
    user_id: '',
  });

  // User detail data
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetail | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  // Tool usage data
  const [toolStats, setToolStats] = useState<ToolUsageStats | null>(null);

  // MCP Server management
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [serverForm, setServerForm] = useState({ name: '', url: '', description: '' });
  const [serverActionLoading, setServerActionLoading] = useState<number | null>(null);

  // Expanded transaction for tool details
  const [expandedTransactionId, setExpandedTransactionId] = useState<number | null>(null);

  const fetchOverviewStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/usage/stats?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setOverall(data.overall);
        setByProvider(data.by_provider);
        setDailyTrend(data.daily_trend);
      } else {
        setError(data.error || 'Failed to fetch stats');
      }
    } catch (err) {
      setError('Network error fetching stats');
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  const fetchUserUsage = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/usage/by-user?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setUserUsage(data.users);
      } else {
        setError(data.error || 'Failed to fetch user usage');
      }
    } catch (err) {
      setError('Network error fetching user usage');
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (transactionFilters.provider) params.set('provider', transactionFilters.provider);
      if (transactionFilters.status) params.set('status', transactionFilters.status);
      if (transactionFilters.user_id) params.set('user_id', transactionFilters.user_id);

      const response = await fetch(`${API_BASE}/admin/usage/transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions);
      } else {
        setError(data.error || 'Failed to fetch transactions');
      }
    } catch (err) {
      setError('Network error fetching transactions');
    } finally {
      setLoading(false);
    }
  }, [token, transactionFilters]);

  const fetchToolStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/admin/usage/tools?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setToolStats(data);
      } else {
        setToolStats(null);
      }
    } catch (err) {
      setToolStats(null);
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  const fetchMCPServers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/mcp/servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setMcpServers(data.servers);
      }
    } catch (err) {
      console.error('Failed to fetch MCP servers:', err);
    }
  }, [token]);

  const handleCreateServer = async () => {
    if (!serverForm.name || !serverForm.url) {
      setError('Name and URL are required');
      return;
    }
    try {
      setServerActionLoading(-1);
      const response = await fetch(`${API_BASE}/admin/mcp/servers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serverForm),
      });
      const data = await response.json();
      if (data.success) {
        setShowAddServer(false);
        setServerForm({ name: '', url: '', description: '' });
        fetchMCPServers();
        fetchToolStats();
      } else {
        setError(data.error || 'Failed to create server');
      }
    } catch (err) {
      setError('Network error creating server');
    } finally {
      setServerActionLoading(null);
    }
  };

  const handleUpdateServer = async () => {
    if (!editingServer || !serverForm.name || !serverForm.url) {
      setError('Name and URL are required');
      return;
    }
    try {
      setServerActionLoading(editingServer.id);
      const response = await fetch(`${API_BASE}/admin/mcp/servers/update`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server_id: editingServer.id,
          name: serverForm.name,
          url: serverForm.url,
          description: serverForm.description,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setEditingServer(null);
        setServerForm({ name: '', url: '', description: '' });
        fetchMCPServers();
        fetchToolStats();
      } else {
        setError(data.error || 'Failed to update server');
      }
    } catch (err) {
      setError('Network error updating server');
    } finally {
      setServerActionLoading(null);
    }
  };

  const handleDeleteServer = async (serverId: number) => {
    if (!confirm('Are you sure you want to delete this MCP server? All associated tools will be removed.')) {
      return;
    }
    try {
      setServerActionLoading(serverId);
      const response = await fetch(`${API_BASE}/admin/mcp/servers/${serverId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        fetchMCPServers();
        fetchToolStats();
      } else {
        setError(data.error || 'Failed to delete server');
      }
    } catch (err) {
      setError('Network error deleting server');
    } finally {
      setServerActionLoading(null);
    }
  };

  const handleToggleServer = async (serverId: number, enabled: boolean) => {
    try {
      setServerActionLoading(serverId);
      const response = await fetch(`${API_BASE}/admin/mcp/servers/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ server_id: serverId, enabled }),
      });
      const data = await response.json();
      if (data.success) {
        fetchMCPServers();
      } else {
        setError(data.error || 'Failed to toggle server');
      }
    } catch (err) {
      setError('Network error toggling server');
    } finally {
      setServerActionLoading(null);
    }
  };

  const handleRefreshServerTools = async (serverId: number) => {
    try {
      setServerActionLoading(serverId);
      const response = await fetch(`${API_BASE}/admin/mcp/servers/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ server_id: serverId }),
      });
      const data = await response.json();
      if (data.success) {
        fetchMCPServers();
        fetchToolStats();
      } else {
        setError(data.error || 'Failed to refresh tools');
      }
    } catch (err) {
      setError('Network error refreshing tools');
    } finally {
      setServerActionLoading(null);
    }
  };

  const fetchUserDetail = useCallback(async (userId: number) => {
    try {
      setLoadingUserDetail(true);
      const response = await fetch(`${API_BASE}/admin/usage/users/${userId}?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setSelectedUserDetail({
          user: data.user,
          stats: data.stats,
          by_provider: data.by_provider,
          recent_transactions: data.recent_transactions,
        });
      } else {
        setError(data.error || 'Failed to fetch user details');
      }
    } catch (err) {
      setError('Network error fetching user details');
    } finally {
      setLoadingUserDetail(false);
    }
  }, [token, period]);

  useEffect(() => {
    if (view === 'overview') {
      fetchOverviewStats();
    } else if (view === 'by-user') {
      fetchUserUsage();
    } else if (view === 'transactions') {
      fetchTransactions();
    } else if (view === 'tools') {
      fetchToolStats();
      fetchMCPServers();
      fetchOverviewStats();
    }
  }, [view, fetchOverviewStats, fetchUserUsage, fetchTransactions, fetchToolStats, fetchMCPServers]);

  // Sub-cent costs (e.g. deepseek at $0.14/$0.28 per 1M) round to $0.00 at 2 decimals,
  // which reads as "no cost recorded". Show 4 decimals for a genuine value under a cent
  // so tiny-but-real costs stay visible; $0.00 then means an actual zero.
  const formatCost = (cost: number) =>
    cost > 0 && cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
  const formatNumber = (n: number) => n.toLocaleString();
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toFixed(0)}s`;
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      claude: 'bg-purple-100 text-purple-800',
      openai: 'bg-green-100 text-green-800',
      gemini: 'bg-blue-100 text-blue-800',
      grok: 'bg-orange-100 text-orange-800',
      kimi: 'bg-pink-100 text-pink-800',
      deepseek: 'bg-cyan-100 text-cyan-800',
    };
    return colors[provider] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      timeout: 'bg-yellow-100 text-yellow-800',
      rate_limited: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Calculate tool usage rate
  const toolUsageRate = overall && overall.total_requests > 0
    ? ((overall.total_function_calls || 0) / overall.total_requests * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Usage Statistics</h2>
          <p className="text-sm text-gray-500">LLM usage and cost analytics</p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {(['day', 'week', 'month', 'year', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* View Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'by-user', label: 'By User' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'tools', label: 'Tools', icon: '🔧' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as View)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon && <span className="mr-1">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      )}

      {/* Overview View */}
      {!loading && view === 'overview' && overall && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(overall.total_requests)}</p>
              <p className="text-xs text-green-600">{overall.successful_requests} successful</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Tokens</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(overall.total_tokens)}</p>
              <p className="text-xs text-gray-500">
                {formatNumber(overall.prompt_tokens)} in / {formatNumber(overall.completion_tokens)} out
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Cost</p>
              <p className="text-2xl font-bold text-blue-600">{formatCost(overall.total_cost)}</p>
              {overall.voice_cost > 0 && (
                <p className="text-xs text-purple-600">{formatCost(overall.voice_cost)} voice</p>
              )}
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Voice Usage</p>
              <p className="text-2xl font-bold text-purple-600">{formatNumber(overall.voice_requests || 0)}</p>
              <p className="text-xs text-gray-500">{formatDuration(overall.audio_seconds || 0)} audio</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Tool Calls</p>
              <p className="text-2xl font-bold text-amber-600">{formatNumber(overall.total_function_calls || 0)}</p>
              <p className="text-xs text-gray-500">
                {formatNumber(overall.total_mcp_calls || 0)} MCP
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{overall.unique_users}</p>
              <p className="text-xs text-gray-500">Avg {overall.avg_response_time_ms}ms response</p>
            </div>
          </div>

          {/* By Provider */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-800">Usage by Provider</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Requests</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tokens</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tools</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Voice</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {byProvider.map((p) => (
                    <tr key={p.provider} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProviderColor(p.provider)}`}>
                          {p.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{formatNumber(p.requests)}</td>
                      <td className="px-4 py-3 text-right text-sm">{formatNumber(p.tokens)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-blue-600">{formatCost(p.cost)}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {(p.function_calls || 0) > 0 ? (
                          <span className="text-amber-600" title={`${p.mcp_calls || 0} MCP`}>
                            {formatNumber(p.function_calls || 0)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-purple-600">
                        {p.voice_requests > 0 ? formatNumber(p.voice_requests) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{p.avg_response_time_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Trend (Simple Bar Chart with Y-axis scale) */}
          {dailyTrend.length > 0 && (() => {
            const maxCost = Math.max(...dailyTrend.map((t) => t.cost));
            const totalCost = dailyTrend.reduce((sum, t) => sum + t.cost, 0);
            const avgCost = totalCost / dailyTrend.length;
            // Calculate nice round numbers for scale
            const scaleMax = maxCost > 0 ? Math.ceil(maxCost * 1.1 * 100) / 100 : 1;
            const scaleMid = scaleMax / 2;

            return (
              <div className="bg-white rounded-lg shadow">
                <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-medium text-gray-800">Daily Cost Trend (Last 30 Days)</h3>
                  <div className="text-xs text-gray-500">
                    Total: <span className="font-medium text-blue-600">{formatCost(totalCost)}</span>
                    {' · '}
                    Avg: <span className="font-medium">{formatCost(avgCost)}</span>/day
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex">
                    {/* Y-axis scale */}
                    <div className="flex flex-col justify-between h-40 pr-2 text-xs text-gray-500 text-right w-16">
                      <span>{formatCost(scaleMax)}</span>
                      <span>{formatCost(scaleMid)}</span>
                      <span>$0.00</span>
                    </div>
                    {/* Chart area */}
                    <div className="flex-1 relative">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        <div className="border-b border-gray-200 border-dashed"></div>
                        <div className="border-b border-gray-200 border-dashed"></div>
                        <div className="border-b border-gray-300"></div>
                      </div>
                      {/* Bars */}
                      <div className="flex items-end h-40 gap-1 relative z-10">
                        {dailyTrend.map((d) => {
                          const height = scaleMax > 0 ? (d.cost / scaleMax) * 100 : 0;
                          return (
                            <div
                              key={d.date}
                              className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors group relative"
                              style={{ height: `${Math.max(height, 1)}%` }}
                              title={`${d.date}: ${formatCost(d.cost)}`}
                            >
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20">
                                {d.date}: {formatCost(d.cost)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {/* X-axis labels */}
                  <div className="flex mt-2">
                    <div className="w-16"></div>
                    <div className="flex-1 flex justify-between text-xs text-gray-500">
                      <span>{dailyTrend[0]?.date}</span>
                      <span>{dailyTrend[Math.floor(dailyTrend.length / 2)]?.date}</span>
                      <span>{dailyTrend[dailyTrend.length - 1]?.date}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* By User View */}
      {!loading && view === 'by-user' && (
        <div className="space-y-4">
          {/* User List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-medium text-gray-800">Usage by User</h3>
              <p className="text-xs text-gray-500">Click on a user to see details</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Requests</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tokens</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tools</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Voice</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Response</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {userUsage.map((u) => (
                    <tr
                      key={u.user_id}
                      className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                        selectedUserDetail?.user.id === u.user_id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => fetchUserDetail(u.user_id)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.email}</p>
                          <p className="text-xs text-gray-500">{u.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{formatNumber(u.requests)}</td>
                      <td className="px-4 py-3 text-right text-sm">{formatNumber(u.tokens)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-blue-600">{formatCost(u.cost)}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {(u.function_calls || 0) > 0 ? (
                          <span className="text-amber-600" title={`${u.mcp_calls || 0} MCP`}>
                            {formatNumber(u.function_calls || 0)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {u.voice_requests > 0 ? (
                          <span className="text-purple-600" title={formatDuration(u.audio_seconds)}>
                            {formatNumber(u.voice_requests)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{u.avg_response_time_ms}ms</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {new Date(u.last_activity).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {userUsage.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No usage data for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Detail Panel */}
          {loadingUserDetail && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Loading user details...
            </div>
          )}

          {!loadingUserDetail && selectedUserDetail && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-800">
                    Details for: {selectedUserDetail.user.email}
                  </h3>
                  <p className="text-xs text-gray-500">{selectedUserDetail.user.name}</p>
                </div>
                <button
                  onClick={() => setSelectedUserDetail(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User Stats Summary */}
              <div className="p-4 border-b border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Requests</p>
                    <p className="text-lg font-semibold">{formatNumber(selectedUserDetail.stats.total_requests)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Successful</p>
                    <p className="text-lg font-semibold text-green-600">{formatNumber(selectedUserDetail.stats.successful_requests)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tokens</p>
                    <p className="text-lg font-semibold">{formatNumber(selectedUserDetail.stats.total_tokens)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Cost</p>
                    <p className="text-lg font-semibold text-blue-600">{formatCost(selectedUserDetail.stats.total_cost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tool Calls</p>
                    <p className="text-lg font-semibold text-amber-600">
                      {formatNumber(selectedUserDetail.stats.function_calls || 0)}
                    </p>
                    {(selectedUserDetail.stats.mcp_calls || 0) > 0 && (
                      <p className="text-xs text-gray-500">{selectedUserDetail.stats.mcp_calls} MCP</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Voice Sessions</p>
                    <p className="text-lg font-semibold text-purple-600">
                      {formatNumber(selectedUserDetail.stats.voice_requests || 0)}
                    </p>
                    {selectedUserDetail.stats.audio_seconds > 0 && (
                      <p className="text-xs text-gray-500">{formatDuration(selectedUserDetail.stats.audio_seconds)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Response</p>
                    <p className="text-lg font-semibold">{selectedUserDetail.stats.avg_response_time_ms}ms</p>
                  </div>
                </div>
              </div>

              {/* By Provider */}
              {selectedUserDetail.by_provider.length > 0 && (
                <div className="p-4 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">By Provider</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedUserDetail.by_provider.map((p) => (
                      <div key={p.provider} className="bg-gray-50 rounded-lg px-3 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProviderColor(p.provider)}`}>
                          {p.provider}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">{formatNumber(p.requests)} req</span>
                        <span className="ml-2 text-sm font-medium text-blue-600">{formatCost(p.cost)}</span>
                        {(p.function_calls || 0) > 0 && (
                          <span className="ml-2 text-sm text-amber-600">🔧{p.function_calls}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Transactions</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Provider</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Model</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Type</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Tools</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Usage</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cost</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedUserDetail.recent_transactions.slice(0, 10).map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(t.created_at)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getProviderColor(t.provider)}`}>
                              {t.provider}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[100px]" title={t.model}>
                            {t.model}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {t.is_voice ? (
                              <span className="text-purple-600 text-xs">Voice</span>
                            ) : (
                              <span className="text-gray-400 text-xs">Text</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {t.function_calls > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                🔧 {t.function_calls}
                                {t.mcp_calls > 0 && <span className="text-blue-600 ml-1">({t.mcp_calls} MCP)</span>}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-xs">
                            {t.is_voice ? formatDuration(t.audio_seconds || 0) : formatNumber(t.total_tokens)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-medium text-blue-600">{formatCost(t.cost)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(t.status)}`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {selectedUserDetail.recent_transactions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                            No transactions found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transactions View */}
      {!loading && view === 'transactions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 flex gap-4 flex-wrap">
            <select
              value={transactionFilters.provider}
              onChange={(e) => setTransactionFilters((f) => ({ ...f, provider: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Providers</option>
              {providerRows.map((r) => (
                <option key={r.provider_key} value={r.provider_key}>{r.display_name || r.provider_key}</option>
              ))}
            </select>
            <select
              value={transactionFilters.status}
              onChange={(e) => setTransactionFilters((f) => ({ ...f, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="timeout">Timeout</option>
              <option value="rate_limited">Rate Limited</option>
            </select>
            <input
              type="text"
              placeholder="User ID"
              value={transactionFilters.user_id}
              onChange={(e) => setTransactionFilters((f) => ({ ...f, user_id: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm w-24"
            />
            <button
              onClick={fetchTransactions}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tools</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Usage</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((t) => (
                  <>
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900 truncate max-w-[150px]" title={t.user_email}>
                          {t.user_email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProviderColor(t.provider)}`}>
                          {t.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[120px]" title={t.model}>
                        {t.model}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.is_voice ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Voice
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Text
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.function_calls > 0 ? (
                          <button
                            onClick={() => setExpandedTransactionId(expandedTransactionId === t.id ? null : t.id)}
                            className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                          >
                            🔧 {t.function_calls}
                            {t.mcp_calls > 0 && <span className="text-blue-600 ml-1">({t.mcp_calls} MCP)</span>}
                          </button>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {t.is_voice ? (
                          <span title={`${t.audio_input_seconds?.toFixed(1) || 0}s in / ${t.audio_output_seconds?.toFixed(1) || 0}s out`}>
                            {formatDuration(t.audio_seconds || 0)}
                          </span>
                        ) : (
                          <span title={`${t.prompt_tokens} in / ${t.completion_tokens} out`}>
                            {formatNumber(t.total_tokens)} tokens
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-blue-600">
                        {formatCost(t.cost)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                    {/* Expanded tool details row */}
                    {expandedTransactionId === t.id && t.function_calls > 0 && (
                      <tr key={`${t.id}-tools`} className="bg-amber-50">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Tools Used: </span>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {t.functions_called?.map((fn, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-1 rounded text-xs font-mono ${
                                    t.mcp_tools_called?.includes(fn)
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {t.mcp_tools_called?.includes(fn) && '🔌 '}
                                  {fn}
                                </span>
                              ))}
                              {!t.functions_called && (
                                <span className="text-gray-500 text-xs italic">
                                  {t.function_calls} tool call(s) - names not recorded
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tools View */}
      {!loading && view === 'tools' && (
        <div className="space-y-6">
          {/* Tool Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total Tool Calls</p>
              <p className="text-2xl font-bold text-amber-600">
                {formatNumber(toolStats?.total_function_calls || overall?.total_function_calls || 0)}
              </p>
              <p className="text-xs text-gray-500">
                {toolStats?.unique_tools_count || 0} tools used
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Regular Tools</p>
              <p className="text-2xl font-bold text-gray-700">
                {toolStats?.all_regular_tools?.length || 0}
              </p>
              <p className="text-xs text-gray-500">
                {toolStats?.all_regular_tools?.filter(t => t.has_been_used).length || 0} used /{' '}
                {toolStats?.all_regular_tools?.length || 0} available
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">MCP Tools</p>
              <p className="text-2xl font-bold text-blue-600">
                {toolStats?.all_mcp_tools?.length || 0}
              </p>
              <p className="text-xs text-gray-500">
                {toolStats?.all_mcp_tools?.filter(t => t.has_been_used).length || 0} used /{' '}
                {toolStats?.all_mcp_tools?.length || 0} available
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">MCP Servers</p>
              <p className="text-2xl font-bold text-purple-600">
                {toolStats?.all_mcp_tools ? [...new Set(toolStats.all_mcp_tools.map(t => t.mcp_server))].length : 0}
              </p>
              <p className="text-xs text-gray-500">configured servers</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Tool Usage Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {toolStats?.tool_usage_rate ?? toolUsageRate}%
              </p>
              <p className="text-xs text-gray-500">
                {toolStats?.requests_with_tools || 0} of {toolStats?.total_requests || overall?.total_requests || 0} requests
              </p>
            </div>
          </div>

          {/* MCP Server Usage Statistics */}
          {toolStats?.mcp_servers && toolStats.mcp_servers.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-800">
                  <span className="inline-block w-3 h-3 rounded bg-blue-500 mr-2"></span>
                  MCP Server Usage Statistics
                </h3>
                <p className="text-xs text-gray-500 mt-1">Tool usage breakdown by MCP server</p>
              </div>
              <div className="p-4 space-y-4">
                {toolStats.mcp_servers.map((server) => (
                  <div key={server.name} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 flex justify-between items-center">
                      <div>
                        <h4 className="font-medium text-gray-800">{server.name}</h4>
                        <p className="text-xs text-gray-500">
                          {server.tool_count} tools · {server.unique_users} users
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-600">{formatNumber(server.total_calls)}</p>
                        <p className="text-xs text-gray-500">total calls</p>
                      </div>
                    </div>
                    <div className="p-3">
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-gray-500 uppercase">
                            <th className="text-left py-1 px-2">Tool</th>
                            <th className="text-center py-1 px-2">Calls</th>
                            <th className="text-center py-1 px-2">Users</th>
                            <th className="text-right py-1 px-2">Last Used</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {server.tools.map((tool) => (
                            <tr key={tool.name} className="hover:bg-gray-50">
                              <td className="py-2 px-2">
                                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                  {tool.name.replace(/^mcp_/, '')}
                                </code>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className="font-medium text-blue-600">{formatNumber(tool.count)}</span>
                              </td>
                              <td className="py-2 px-2 text-center text-gray-600">
                                {tool.unique_users}
                              </td>
                              <td className="py-2 px-2 text-right text-xs text-gray-500">
                                {tool.last_used ? new Date(tool.last_used).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MCP Server Management */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-medium text-gray-800">
                  <span className="inline-block w-3 h-3 rounded bg-purple-500 mr-2"></span>
                  Global MCP Servers
                </h3>
                <p className="text-xs text-gray-500 mt-1">Servers available to all users</p>
              </div>
              <button
                onClick={() => {
                  setShowAddServer(true);
                  setEditingServer(null);
                  setServerForm({ name: '', url: '', description: '' });
                }}
                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
              >
                + Add Server
              </button>
            </div>

            {/* Add/Edit Server Form */}
            {(showAddServer || editingServer) && (
              <div className="p-4 bg-purple-50 border-b border-purple-200">
                <h4 className="font-medium text-gray-800 mb-3">
                  {editingServer ? 'Edit Server' : 'Add New Global MCP Server'}
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Global servers are available to all users.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Server Name *</label>
                    <input
                      type="text"
                      value={serverForm.name}
                      onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                      placeholder="e.g., My MCP Server"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Server URL *</label>
                    <input
                      type="url"
                      value={serverForm.url}
                      onChange={(e) => setServerForm({ ...serverForm, url: e.target.value })}
                      placeholder="e.g., http://localhost:3000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Description</label>
                    <input
                      type="text"
                      value={serverForm.description}
                      onChange={(e) => setServerForm({ ...serverForm, description: e.target.value })}
                      placeholder="Optional description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={editingServer ? handleUpdateServer : handleCreateServer}
                    disabled={serverActionLoading !== null}
                    className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    {serverActionLoading !== null ? 'Saving...' : editingServer ? 'Update Server' : 'Create Server'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddServer(false);
                      setEditingServer(null);
                      setServerForm({ name: '', url: '', description: '' });
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Server List */}
            <div className="p-4">
              {mcpServers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Server</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Tools</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Scope</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {mcpServers.map((server) => (
                        <tr key={server.id} className={`hover:bg-gray-50 ${!server.enabled ? 'opacity-60' : ''}`}>
                          <td className="px-3 py-2">
                            <div>
                              <p className="font-medium text-gray-900">{server.name}</p>
                              {server.description && (
                                <p className="text-xs text-gray-500">{server.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{server.url}</code>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {server.tool_count} tools
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Global
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleToggleServer(server.id, !server.enabled)}
                              disabled={serverActionLoading === server.id}
                              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                server.enabled
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {server.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleRefreshServerTools(server.id)}
                                disabled={serverActionLoading === server.id}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Refresh tools"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingServer(server);
                                  setShowAddServer(false);
                                  setServerForm({
                                    name: server.name,
                                    url: server.url,
                                    description: server.description || '',
                                  });
                                }}
                                disabled={serverActionLoading === server.id}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Edit server"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteServer(server.id)}
                                disabled={serverActionLoading === server.id}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete server"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No MCP servers configured. Click "Add Server" to create one.
                </p>
              )}
            </div>
          </div>

          {/* Regular Tools Section - ALL Available */}
          {toolStats?.all_regular_tools && toolStats.all_regular_tools.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-medium text-gray-800">
                  <span className="inline-block w-3 h-3 rounded bg-amber-500 mr-2"></span>
                  Regular Tools (Built-in Functions)
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {toolStats.all_regular_tools.filter(t => t.has_been_used).length} used / {toolStats.all_regular_tools.length} available
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tool Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Calls</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Users</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Last Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {toolStats.all_regular_tools.map((tool) => (
                        <tr key={tool.name} className={`hover:bg-gray-50 ${!tool.has_been_used ? 'opacity-60' : ''}`}>
                          <td className="px-3 py-2">
                            <code className={`text-sm font-mono px-2 py-0.5 rounded ${
                              tool.has_been_used ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {tool.name}
                            </code>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate" title={tool.description}>
                            {tool.description.length > 80 ? tool.description.slice(0, 80) + '...' : tool.description}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium">
                            {tool.has_been_used ? formatNumber(tool.count) : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-gray-600">
                            {tool.has_been_used ? tool.unique_users : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500">
                            {tool.last_used ? new Date(tool.last_used).toLocaleDateString() : <span className="text-gray-400">Never</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MCP Servers Section - Grouped by Server */}
          {toolStats?.all_mcp_tools && toolStats.all_mcp_tools.length > 0 && (() => {
            // Group MCP tools by server
            const serverGroups: Record<string, AvailableTool[]> = {};
            toolStats.all_mcp_tools.forEach(tool => {
              const server = tool.mcp_server || 'Unknown Server';
              if (!serverGroups[server]) {
                serverGroups[server] = [];
              }
              serverGroups[server].push(tool);
            });

            return (
              <div className="bg-white rounded-lg shadow">
                <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-medium text-gray-800">
                    <span className="inline-block w-3 h-3 rounded bg-purple-500 mr-2"></span>
                    MCP Servers & Tools
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {Object.keys(serverGroups).length} servers · {toolStats.all_mcp_tools.length} tools ·{' '}
                      {toolStats.all_mcp_tools.filter(t => t.has_been_used).length} used
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {Object.entries(serverGroups).map(([serverName, tools]) => {
                    const totalCalls = tools.reduce((sum, t) => sum + t.count, 0);
                    const usedCount = tools.filter(t => t.has_been_used).length;

                    return (
                      <div key={serverName} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              <span className="text-purple-600">&#9673;</span>
                              {serverName}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {tools.length} tools · {usedCount} used · {formatNumber(totalCalls)} total calls
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${totalCalls > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                              {formatNumber(totalCalls)}
                            </p>
                            <p className="text-xs text-gray-500">calls</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tools.map((tool) => (
                            <span
                              key={tool.name}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
                                tool.has_been_used
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                              title={tool.description || tool.name}
                            >
                              {tool.original_name || tool.name.replace(/^mcp_/, '')}
                              {tool.has_been_used && (
                                <span className="bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full text-xs">
                                  {tool.count}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* MCP Tools Detailed Table - ALL Available */}
          {toolStats?.all_mcp_tools && toolStats.all_mcp_tools.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-medium text-gray-800">
                  <span className="inline-block w-3 h-3 rounded bg-blue-500 mr-2"></span>
                  MCP Tools Detail
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {toolStats.all_mcp_tools.filter(t => t.has_been_used).length} used / {toolStats.all_mcp_tools.length} available
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tool Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Server</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Calls</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Users</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Last Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {toolStats.all_mcp_tools.map((tool) => (
                        <tr key={tool.name} className={`hover:bg-gray-50 ${!tool.has_been_used ? 'opacity-60' : ''}`}>
                          <td className="px-3 py-2">
                            <code className={`text-sm font-mono px-2 py-0.5 rounded ${
                              tool.has_been_used ? 'bg-blue-50 text-blue-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {tool.original_name || tool.name}
                            </code>
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {tool.mcp_server}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate" title={tool.description}>
                            {tool.description ? (tool.description.length > 60 ? tool.description.slice(0, 60) + '...' : tool.description) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium">
                            {tool.has_been_used ? formatNumber(tool.count) : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-gray-600">
                            {tool.has_been_used ? tool.unique_users : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500">
                            {tool.last_used ? new Date(tool.last_used).toLocaleDateString() : <span className="text-gray-400">Never</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tool Type Breakdown & Provider Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Visual Breakdown */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-800">Tool Type Distribution</h3>
              </div>
              <div className="p-4">
                {(toolStats?.total_function_calls || overall?.total_function_calls || 0) > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Regular Tools</span>
                        <span className="font-medium">
                          {formatNumber(
                            (toolStats?.total_function_calls || overall?.total_function_calls || 0) -
                            (toolStats?.total_mcp_calls || overall?.total_mcp_calls || 0)
                          )}
                        </span>
                      </div>
                      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${(((toolStats?.total_function_calls || overall?.total_function_calls || 0) - (toolStats?.total_mcp_calls || overall?.total_mcp_calls || 0)) / (toolStats?.total_function_calls || overall?.total_function_calls || 1)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">MCP Tools</span>
                        <span className="font-medium">{formatNumber(toolStats?.total_mcp_calls || overall?.total_mcp_calls || 0)}</span>
                      </div>
                      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${((toolStats?.total_mcp_calls || overall?.total_mcp_calls || 0) / (toolStats?.total_function_calls || overall?.total_function_calls || 1)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No tool usage data</p>
                )}
              </div>
            </div>

            {/* Tools by Provider */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-800">Tool Usage by Provider</h3>
              </div>
              <div className="p-4">
                {(toolStats?.by_provider || byProvider).filter(p => (p.function_calls || 0) > 0).length > 0 ? (
                  <div className="space-y-3">
                    {(toolStats?.by_provider || byProvider)
                      .filter(p => (p.function_calls || 0) > 0)
                      .sort((a, b) => (b.function_calls || 0) - (a.function_calls || 0))
                      .map(p => (
                        <div key={p.provider} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProviderColor(p.provider)}`}>
                              {p.provider}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-amber-600 font-medium">
                              {formatNumber(p.function_calls || 0)}
                            </span>
                            {(p.mcp_calls || 0) > 0 && (
                              <span className="text-blue-600">
                                ({formatNumber(p.mcp_calls || 0)} MCP)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No tool usage by provider</p>
                )}
              </div>
            </div>
          </div>

          {/* No tools configured message */}
          {(!toolStats?.all_regular_tools || toolStats.all_regular_tools.length === 0) &&
           (!toolStats?.all_mcp_tools || toolStats.all_mcp_tools.length === 0) && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No tools configured.</p>
              <p className="text-sm text-gray-400 mt-2">
                Regular tools are defined in claude_tools.json. MCP tools are registered via MCP servers.
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium text-gray-800 mb-3">Legend</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-amber-500"></span>
                <span>Regular Tools - Built-in function tools (search, weather, etc.)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-blue-500"></span>
                <span>MCP Tools - Model Context Protocol tools from external servers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-purple-500"></span>
                <span>MCP Servers - External integration endpoints</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
