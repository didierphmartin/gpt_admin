import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePackages } from '../hooks/usePackages';
import { Switch } from './Switch';
import * as api from '../api/client';
import { isRouterRow } from '../types';
import type {
  McpServer,
} from '../api/client';
import type {
  Package,
  PackageCapabilities,
  PackageSidebarFlags,
  UserRole,
} from '../types';
import { useModelCatalog, type Catalog, type ModelChoice } from '../lib/modelCatalog';

const ROLES: UserRole[] = ['guest', 'prospect', 'user', 'admin'];

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  guest: 'Unauthenticated visitors and admin-created guests (journalists, beta testers).',
  prospect: 'Self-registered trial users before they convert to a paid plan.',
  user: 'Paid users on any plan.',
  admin: 'Full access. Edit with care — this governs your own UI too.',
};

const PROVIDER_KEYS = ['claude', 'openai', 'gemini', 'grok', 'deepseek', 'kimi', 'gamma4'] as const;

const SIDEBAR_KEYS: { key: keyof PackageSidebarFlags; label: string }[] = [
  { key: 'conversations', label: 'Conversations' },
  { key: 'verifier', label: 'Verifier split-pane' },
  { key: 'compare', label: 'Compare split-pane' },
  { key: 'prompt_library', label: 'Prompt Library' },
  { key: 'skills', label: 'Skills' },
  { key: 'agent_teams', label: 'Agent Teams' },
  { key: 'file_storage', label: 'File Storage' },
];

/**
 * Deep-clone a capabilities object so the form's local state can mutate
 * without touching the server-truth copy held by the hook.
 */
function cloneCaps(caps: PackageCapabilities): PackageCapabilities {
  return JSON.parse(JSON.stringify(caps));
}

export function PackagesPanel() {
  const { packages, loading, error, fetchPackages, savePackage } = usePackages();
  const { catalog } = useModelCatalog();
  const [activeRole, setActiveRole] = useState<UserRole>('guest');
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [draft, setDraft] = useState<PackageCapabilities | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchPackages();
    // Global MCP servers populate the allowlist checkboxes. Errors are
    // non-fatal — the admin can still edit everything else.
    api
      .listMcpServers({ scope: 'global' })
      .then((r) => setMcpServers(r.servers))
      .catch(() => setMcpServers([]));
  }, [fetchPackages]);

  const currentPkg: Package | undefined = useMemo(
    () => packages.find((p) => p.role === activeRole),
    [packages, activeRole]
  );

  // Reset draft on two transitions only:
  //   1. Role switch (admin clicked a different role sub-tab)
  //   2. Initial load (packages fetched, currentPkg goes from undefined -> defined)
  // NOT on every save — handleSave handles that path explicitly.
  const hasCurrentPkg = !!currentPkg;
  useEffect(() => {
    if (currentPkg) {
      setDraft(cloneCaps(currentPkg.capabilities));
    }
  }, [activeRole, hasCurrentPkg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the "✓ Saved at" indicator when the admin switches to a different
  // role — a fresh save on the same role keeps the confirmation visible.
  useEffect(() => {
    setSavedAt(null);
  }, [activeRole]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    const saved = await savePackage(activeRole, draft);
    setSaving(false);
    if (saved) {
      setDraft(cloneCaps(saved.capabilities));
      setSavedAt(new Date().toLocaleTimeString());
    }
  }, [draft, activeRole, savePackage]);

  const handleReset = useCallback(() => {
    if (currentPkg) {
      setDraft(cloneCaps(currentPkg.capabilities));
      setSavedAt(null);
    }
  }, [currentPkg]);

  // Pull every provider's API key + active model from Global Settings
  // (system_llm_settings) into the current role's draft. For each provider
  // we update whichever of the two fields are non-empty in Global Settings;
  // missing values leave the existing draft value untouched.
  const [fillingKeys, setFillingKeys] = useState(false);
  const handleFillKeysFromGlobal = useCallback(async () => {
    if (!draft) return;
    setFillingKeys(true);
    try {
      const res = await api.getLLMSettings();
      if (!res.providers || res.providers.length === 0) return;
      const nextProviders = { ...draft.providers };
      let changed = 0;
      for (const p of res.providers) {
        // A router row (Jev) is not a chat provider: packages never carry it.
        if (isRouterRow(p)) continue;
        const key = p.provider_key;
        const apiKey = p.api_key ? String(p.api_key).trim() : '';
        const model = p.model ? String(p.model).trim() : '';
        if (!apiKey && !model) continue;
        const existing = nextProviders[key] ?? { enabled: false };
        const patch: Record<string, unknown> = {};
        if (apiKey) patch.default_api_key = apiKey;
        if (model) patch.default_model = model;
        nextProviders[key] = { ...existing, ...patch };
        changed++;
      }
      if (changed > 0) {
        setDraft({ ...draft, providers: nextProviders });
      }
    } finally {
      setFillingKeys(false);
    }
  }, [draft]);

  if (loading && packages.length === 0) {
    return <div className="text-gray-500">Loading packages…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Packages</h2>
        <p className="text-sm text-gray-500 mt-1">
          Capability bundles per user role. Each bundle controls which providers,
          MCP servers, sidebar items, and quotas the gpt app exposes to users in
          that role.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>
      )}

      {/* Role sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {ROLES.map((role) => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeRole === role
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {role}
            </button>
          ))}
        </nav>
      </div>

      <div className="text-sm text-gray-500">{ROLE_DESCRIPTIONS[activeRole]}</div>

      {draft && currentPkg && (
        <PackageForm
          draft={draft}
          mcpServers={mcpServers}
          catalog={catalog}
          onChange={setDraft}
          onFillKeysFromGlobal={handleFillKeysFromGlobal}
          fillingKeys={fillingKeys}
        />
      )}

      {/* Save bar */}
      {draft && currentPkg && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-xs text-gray-500">
            {currentPkg.updated_at && (
              <>Last saved: {currentPkg.updated_at}</>
            )}
            {savedAt && (
              <span className="ml-2 text-green-700">✓ Saved at {savedAt}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PackageFormProps {
  draft: PackageCapabilities;
  mcpServers: McpServer[];
  catalog: Catalog;
  onChange: (next: PackageCapabilities) => void;
  onFillKeysFromGlobal: () => void;
  fillingKeys: boolean;
}

function PackageForm({
  draft,
  mcpServers,
  catalog,
  onChange,
  onFillKeysFromGlobal,
  fillingKeys,
}: PackageFormProps) {
  const patch = (partial: Partial<PackageCapabilities>) => onChange({ ...draft, ...partial });

  // Provider list is data-driven from the shared model catalog (served from model_catalog.json,
  // kept in sync with system_llm_settings), so a provider added there appears here automatically —
  // no hardcoded list. PROVIDER_KEYS is only the fallback shown while the catalog is still loading.
  const providerKeys = Object.keys(catalog).length > 0 ? Object.keys(catalog) : [...PROVIDER_KEYS];

  // Which provider keys are currently shown in plaintext (eye toggled on).
  // Form-local state; resets when the panel remounts (e.g. role switch).
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const toggleKeyVisibility = (providerKey: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(providerKey)) next.delete(providerKey);
      else next.add(providerKey);
      return next;
    });
  };

  const setProvider = (
    key: string,
    next: Partial<{ enabled: boolean; default_api_key: string | null; default_model: string | null }>,
  ) => {
    const providers = { ...draft.providers };
    const existing = providers[key] ?? { enabled: false };
    providers[key] = { ...existing, ...next };
    patch({ providers });
  };

  const setSidebar = (key: keyof PackageSidebarFlags, value: boolean) => {
    patch({ sidebar: { ...draft.sidebar, [key]: value } });
  };

  // Effective enabled set for this role. Null in storage means "all registered
  // servers were allowed at seed time" — we expand that to the current global
  // list so the admin sees every server. The first save persists an explicit
  // array, which is also what new MCP servers added later will check against.
  const allServerNames = mcpServers.map((s) => s.name);
  const mcpEnabled = new Set<string>(draft.mcp_servers ?? allServerNames);

  const toggleMcp = (name: string, checked: boolean) => {
    const next = new Set(mcpEnabled);
    if (checked) next.add(name);
    else next.delete(name);
    patch({ mcp_servers: Array.from(next) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* LLM Providers */}
      <div className="lg:col-span-3">
      <Section
        title="LLM Providers"
        actions={
          <button
            type="button"
            onClick={onFillKeysFromGlobal}
            disabled={fillingKeys}
            title="Copy API keys and models from Global Settings > LLM providers into this package"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md shadow-sm hover:bg-blue-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {fillingKeys ? 'Filling…' : 'Fill keys + models from Global Settings'}
          </button>
        }
      >
        <p className="text-xs text-gray-500 mb-3">
          For each provider: toggle access, pick the default model users see,
          and optionally supply a default API key. Users in this role can
          override the model and key in their own Settings.
        </p>
        <div className="space-y-3">
          {providerKeys.map((key) => {
            const cfg = draft.providers[key] ?? { enabled: false };
            const providerModels = catalog[key] ?? [];
            return (
              <div key={key} className="flex flex-col gap-2 pb-3 border-b border-gray-200 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-24">
                    <Switch
                      checked={!!cfg.enabled}
                      onChange={(v) => setProvider(key, { enabled: v })}
                      size="sm"
                      label={key}
                    />
                  </div>
                  <select
                    value={cfg.default_model ?? ''}
                    onChange={(e) =>
                      setProvider(key, { default_model: e.target.value || null })
                    }
                    disabled={!cfg.enabled || providerModels.length === 0}
                    className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">
                      {providerModels.length === 0 ? 'No models' : 'No default (user picks)'}
                    </option>
                    {providerModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} — ${m.input}/${m.output} per M
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative w-full">
                  <input
                    type={visibleKeys.has(key) ? 'text' : 'password'}
                    value={cfg.default_api_key ?? ''}
                    onChange={(e) =>
                      setProvider(key, { default_api_key: e.target.value || null })
                    }
                    disabled={!cfg.enabled}
                    placeholder={cfg.enabled ? 'Optional default API key' : '—'}
                    className="w-full px-3 py-1.5 pr-9 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400 font-mono"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => toggleKeyVisibility(key)}
                    disabled={!cfg.enabled}
                    aria-label={visibleKeys.has(key) ? 'Hide API key' : 'Show API key'}
                    title={visibleKeys.has(key) ? 'Hide API key' : 'Show API key'}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-9 text-gray-400 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {visibleKeys.has(key) ? (
                      /* eye-off */
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      /* eye */
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
      </div>

      {/* MCP Servers */}
      <div className="lg:col-span-2">
      <Section title="MCP Servers">
        <p className="text-xs text-gray-500 mb-3">
          Toggle which registered MCP servers this role can use. A new MCP added
          in the MCP Servers tab is off by default here until you turn it on.
        </p>
        {mcpServers.length === 0 ? (
          <div className="text-xs text-gray-400 italic">
            No global MCP servers configured yet. Add some in the MCP Servers
            tab, then come back.
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-2">
            {mcpServers.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-gray-800 truncate">{s.name}</span>
                  {!s.enabled && (
                    <span className="text-xs text-gray-400">Globally disabled</span>
                  )}
                </div>
                <Switch
                  checked={mcpEnabled.has(s.name)}
                  onChange={(v) => toggleMcp(s.name, v)}
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}
      </Section>
      <CostChart draft={draft} catalog={catalog} />
      </div>

      {/* Sidebar features */}
      <div className="lg:col-span-3">
      <Section title="Sidebar features">
        <div className="flex flex-col gap-3">
          {SIDEBAR_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{label}</span>
              <Switch
                checked={draft.sidebar[key]}
                onChange={(v) => setSidebar(key, v)}
                size="sm"
              />
            </div>
          ))}
        </div>
      </Section>
      </div>

      {/* Quotas + extras */}
      <div className="lg:col-span-2">
      <Section title="Quota & extras">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token quota (leave blank for no cap)
            </label>
            <input
              type="number"
              min={0}
              value={draft.quota_tokens ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                patch({ quota_tokens: raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0) });
              }}
              placeholder="Unlimited"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Voice features</span>
              <Switch
                checked={draft.voice}
                onChange={(v) => patch({ voice: v })}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Avatar features</span>
              <Switch
                checked={draft.avatar}
                onChange={(v) => patch({ avatar: v })}
                size="sm"
              />
            </div>
          </div>
          <div className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">
            Skill allowlist UI will land after the Skills feature stabilizes —
            until then, {draft.skills === null ? 'all skills are allowed' : `${draft.skills.length} skill(s) are allowed`}.
          </div>
        </div>
      </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * Horizontal bar chart comparing the input/output price of each enabled
 * provider's selected default model. Renders nothing-useful placeholder when
 * no providers have both `enabled` and `default_model` set.
 */
function CostChart({ draft, catalog }: { draft: PackageCapabilities; catalog: Catalog }) {
  type Row = { provider: string; model: ModelChoice };
  const rows: Row[] = [];
  for (const key of PROVIDER_KEYS) {
    const cfg = draft.providers[key];
    if (!cfg?.enabled || !cfg.default_model) continue;
    const model = catalog[key]?.find((m) => m.id === cfg.default_model);
    if (!model) continue;
    rows.push({ provider: key, model });
  }

  const maxPrice = rows.reduce((max, r) => Math.max(max, r.model.output), 0);

  return (
    <div className="mt-4">
      <Section title="Model price comparison">
        {rows.length === 0 ? (
          <div className="text-xs text-gray-400 italic">
            Enable a provider and pick its default model to see pricing here.
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-blue-400" /> input
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-blue-700" /> output
              </span>
              <span className="ml-auto">$ per 1M tokens</span>
            </div>
            <div className="flex items-end justify-start gap-4 h-40 border-b border-gray-300 pb-0.5 overflow-x-auto">
              {rows.map(({ provider, model }) => {
                const inputH = maxPrice > 0 ? (model.input / maxPrice) * 100 : 0;
                const outputH = maxPrice > 0 ? (model.output / maxPrice) * 100 : 0;
                return (
                  <div key={provider} className="flex flex-col items-center flex-shrink-0" style={{ width: '56px' }}>
                    <div className="text-[9px] text-gray-500 tabular-nums mb-0.5 whitespace-nowrap">
                      ${model.input}/${model.output}
                    </div>
                    <div className="flex items-end gap-1 w-full justify-center" style={{ height: '110px' }}>
                      <div
                        className="w-4 bg-blue-400 rounded-t"
                        style={{ height: `${inputH}%` }}
                        title={`${provider} input: $${model.input}/M`}
                      />
                      <div
                        className="w-4 bg-blue-700 rounded-t"
                        style={{ height: `${outputH}%` }}
                        title={`${provider} output: $${model.output}/M`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-start justify-start gap-4 mt-2">
              {rows.map(({ provider, model }) => (
                <div
                  key={provider}
                  className="flex justify-center flex-shrink-0"
                  style={{ width: '56px' }}
                >
                  <div
                    className="text-[10px] text-gray-700 whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    <span className="capitalize font-medium">{provider}</span>
                    <span className="text-gray-400"> · {model.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
