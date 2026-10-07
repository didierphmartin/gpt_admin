import { useEffect, useState } from 'react';
import { useApiKeys } from '../hooks/useApiKeys';
import { LLM_PROVIDERS, ROUTER_PROVIDERS } from '../types';
import type { ApiKeyInfo, ApiKeySavePayload, LLMProvider, LLMProviderConfig, RouterProvider } from '../types';
import { useModelCatalog } from '../lib/modelCatalog';
import * as api from '../api/client';

interface ApiKeysSettingsProps {
  userId: number;
}

const PROVIDER_INFO: Record<LLMProvider | RouterProvider, { label: string; color: string }> = {
  claude: { label: 'Claude (Anthropic)', color: 'bg-orange-100 border-orange-300' },
  openai: { label: 'OpenAI', color: 'bg-green-100 border-green-300' },
  gemini: { label: 'Gemini (Google)', color: 'bg-blue-100 border-blue-300' },
  grok: { label: 'Grok (xAI)', color: 'bg-purple-100 border-purple-300' },
  deepseek: { label: 'DeepSeek', color: 'bg-cyan-100 border-cyan-300' },
  kimi: { label: 'Kimi (Moonshot)', color: 'bg-pink-100 border-pink-300' },
  gamma4: { label: 'Gamma4', color: 'bg-yellow-100 border-yellow-300' },
  jev: { label: 'Jev (dispatcher routing)', color: 'bg-teal-100 border-teal-300' },
};

interface FormState {
  api_key: string;
  model: string;
  base_url: string;
  max_tokens: string;
  temperature: string;
  chat_endpoint: string;
  system_prompt: string;
  streaming: boolean;
  supports_tools: boolean;
  enabled: boolean;
}

function toForm(info: ApiKeyInfo | undefined): FormState {
  return {
    api_key: info?.api_key ?? '',
    model: info?.model ?? '',
    base_url: info?.base_url ?? '',
    max_tokens: info?.max_tokens != null ? String(info.max_tokens) : '',
    temperature: info?.temperature != null ? String(info.temperature) : '',
    chat_endpoint: info?.chat_endpoint ?? '',
    system_prompt: info?.system_prompt ?? '',
    streaming: info?.streaming ?? false,
    supports_tools: info?.supports_tools ?? false,
    enabled: info?.enabled ?? true,
  };
}

function formToPayload(form: FormState, original: ApiKeyInfo | undefined, keyOnly: boolean): ApiKeySavePayload {
  const payload: ApiKeySavePayload = {};
  const trimmedKey = form.api_key.trim();
  // Send api_key when it changed, OR when the user has no personal key of their
  // own yet — i.e. creating a per-user override (including pinning a package-
  // inherited key as this user's personal override). For an existing personal
  // key left unchanged, skip it to avoid re-sending unnecessarily.
  const userHadOwnKey = original?.source === 'user';
  if (trimmedKey && (!userHadOwnKey || trimmedKey !== (original?.api_key ?? ''))) {
    payload.api_key = trimmedKey;
  }
  // A router key (Jev) has no model, prompt or sampling settings; its URL
  // (a gateway in front of Jev) it does.
  if (keyOnly) {
    payload.base_url = form.base_url.trim() || null;
    return payload;
  }
  payload.model = form.model.trim() || null;
  payload.base_url = form.base_url.trim() || null;
  payload.max_tokens = form.max_tokens.trim() === '' ? null : Number(form.max_tokens);
  payload.temperature = form.temperature.trim() === '' ? null : Number(form.temperature);
  payload.chat_endpoint = form.chat_endpoint.trim() || null;
  payload.system_prompt = form.system_prompt.trim() || null;
  payload.streaming = form.streaming;
  payload.supports_tools = form.supports_tools;
  payload.enabled = form.enabled;
  return payload;
}

function applyGlobal(form: FormState, global: LLMProviderConfig): FormState {
  // Copy all attributes from the global config except api_key (user's key stays).
  return {
    ...form,
    model: global.model ?? '',
    base_url: global.base_url ?? '',
    max_tokens: global.max_tokens != null ? String(global.max_tokens) : '',
    temperature: global.temperature != null ? String(global.temperature) : '',
    chat_endpoint: global.chat_endpoint ?? '',
    system_prompt: global.system_prompt ?? '',
    streaming: !!global.streaming,
    supports_tools: !!global.supports_tools,
    enabled: global.enabled ?? true,
  };
}

interface ApiKeyCardProps {
  provider: LLMProvider | RouterProvider;
  /** Router key (Jev): the card shows and saves the key only. */
  keyOnly?: boolean;
  info: ApiKeyInfo | undefined;
  globalConfig?: LLMProviderConfig;
  onSave: (payload: ApiKeySavePayload) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

function ApiKeyCard({ provider, keyOnly = false, info, globalConfig, onSave, onDelete }: ApiKeyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(info));
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const { catalog } = useModelCatalog();
  const modelSuggestions = (catalog[provider] ?? []).map((m) => m.id);

  const providerInfo = PROVIDER_INFO[provider];
  const hasKey = !!info?.api_key;
  // Where the displayed key comes from for this user (set by the backend overlay).
  const source = info?.source ?? (hasKey ? 'user' : 'none');
  const fromPackage = source === 'package';
  const isPersonal = source === 'user';

  useEffect(() => {
    if (!isEditing) setForm(toForm(info));
  }, [info, isEditing]);

  const handleSave = async () => {
    // Require api_key when creating
    if (!hasKey && !form.api_key.trim()) return;
    // Validate numeric fields
    if (form.max_tokens !== '' && Number.isNaN(Number(form.max_tokens))) return;
    if (form.temperature !== '' && Number.isNaN(Number(form.temperature))) return;

    setSaving(true);
    const success = await onSave(formToPayload(form, info, keyOnly));
    setSaving(false);
    if (success) setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm(`Delete API key and settings for ${providerInfo.label}?`)) {
      await onDelete();
    }
  };

  const handleCancel = () => {
    setForm(toForm(info));
    setIsEditing(false);
    setShowKey(false);
  };

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className={`border rounded-lg p-4 ${hasKey ? providerInfo.color : 'border-gray-200 bg-white'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-medium text-gray-900">{providerInfo.label}</h4>
          <div className="flex gap-1 mt-1 flex-wrap">
            {isPersonal && (
              <span className="inline-block px-2 py-0.5 text-xs bg-green-600 text-white rounded">
                Personal key
              </span>
            )}
            {fromPackage && (
              <span className="inline-block px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                From package{info?.package_name ? `: ${info.package_name}` : ''}
              </span>
            )}
            {source === 'none' && (
              <span className="inline-block px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                Not available
              </span>
            )}
            {info && !info.enabled && (
              <span className="inline-block px-2 py-0.5 text-xs bg-gray-500 text-white rounded">
                Disabled
              </span>
            )}
          </div>
        </div>
        {isPersonal && !isEditing && (
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 hover:text-red-800"
            title="Remove this user's personal override (reverts to the package default)"
          >
            Delete override
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <Field label="API Key" hint={isPersonal ? 'Leave unchanged to keep existing key' : fromPackage ? 'Pre-filled from package — keep or change it to set this user’s override' : 'Required'}>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={(e) => update('api_key', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                placeholder="Enter API key..."
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>

          {keyOnly && (
            <Field label="API URL" hint="empty = default; used with the user's own key">
              <input
                type="text"
                value={form.base_url}
                onChange={(e) => update('base_url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                placeholder={globalConfig?.base_url || 'https://api.typesafe.ai/v1/systemone'}
              />
            </Field>
          )}

          {!keyOnly && (<>
          <Field label="Model" hint="Pick from suggestions or type a custom value">
            <input
              type="text"
              value={form.model}
              onChange={(e) => update('model', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
              placeholder={modelSuggestions[0] ?? 'Enter model name'}
              list={`models-${provider}`}
            />
            <datalist id={`models-${provider}`}>
              {modelSuggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Max Tokens">
              <input
                type="number"
                min={1}
                step={1}
                value={form.max_tokens}
                onChange={(e) => update('max_tokens', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="4096"
              />
            </Field>
            <Field label="Temperature">
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={form.temperature}
                onChange={(e) => update('temperature', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="0.7"
              />
            </Field>
          </div>

          {/* The user's own entry point (e.g. a gateway serving several
              providers). Empty = the system-wide link shown as placeholder.
              Used at chat time only with this user's own key. */}
          <Field label="Base URL" hint="empty = default; used with the user's own key">
            <input
              type="text"
              value={form.base_url}
              onChange={(e) => update('base_url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
              placeholder={globalConfig?.base_url || 'https://api.example.com'}
            />
          </Field>

          <Field label="Chat Endpoint">
            <input
              type="text"
              value={form.chat_endpoint}
              onChange={(e) => update('chat_endpoint', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
              placeholder={globalConfig?.chat_endpoint || '/v1/chat/completions'}
            />
          </Field>

          <Field label="System Prompt">
            <textarea
              value={form.system_prompt}
              onChange={(e) => update('system_prompt', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="Optional default system prompt..."
            />
          </Field>

          <div className="flex flex-wrap gap-4 pt-1">
            <Toggle label="Enabled" checked={form.enabled} onChange={(v) => update('enabled', v)} />
            <Toggle label="Streaming" checked={form.streaming} onChange={(v) => update('streaming', v)} />
            <Toggle label="Supports Tools" checked={form.supports_tools} onChange={(v) => update('supports_tools', v)} />
          </div>
          </>)}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || (!hasKey && !form.api_key.trim())}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            {!keyOnly && <button
              type="button"
              onClick={() => globalConfig && setForm((f) => applyGlobal(f, globalConfig))}
              disabled={!globalConfig}
              title={globalConfig ? 'Copy system-wide defaults into all fields (except API Key)' : 'No global configuration for this provider'}
              className="ml-auto px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm rounded hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Copy from Global
            </button>}
          </div>
        </div>
      ) : (
        <div>
          {hasKey ? (
            <div className="space-y-1.5 text-sm text-gray-700">
              <Summary label="API Key" value={
                <span className="font-mono inline-flex items-center gap-2">
                  {showKey ? info!.api_key : `••••••••${info!.api_key!.slice(-4)}`}
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    title={showKey ? 'Hide key' : 'Reveal key'}
                    className="text-gray-400 hover:text-gray-700 leading-none"
                  >
                    {showKey ? '🙈' : '👁'}
                  </button>
                </span>
              } />
              {keyOnly && info?.base_url && <Summary label="API URL" value={<span className="font-mono text-xs break-all">{info.base_url}</span>} />}
              {!keyOnly && (<>
              <Summary label="Model" value={info?.model || <Muted>not set</Muted>} />
              <div className="grid grid-cols-2 gap-x-3">
                <Summary label="Max Tokens" value={info?.max_tokens ?? <Muted>—</Muted>} />
                <Summary label="Temperature" value={info?.temperature ?? <Muted>—</Muted>} />
              </div>
              {info?.base_url && <Summary label="Base URL" value={<span className="font-mono text-xs break-all">{info.base_url}</span>} />}
              {info?.chat_endpoint && <Summary label="Endpoint" value={<span className="font-mono text-xs break-all">{info.chat_endpoint}</span>} />}
              <div className="flex gap-3 flex-wrap pt-0.5 text-xs">
                {info?.streaming != null && <Badge on={info.streaming}>streaming</Badge>}
                {info?.supports_tools != null && <Badge on={info.supports_tools}>tools</Badge>}
              </div>
              </>)}
              {fromPackage && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                  Inherited from package{info?.package_name ? ` “${info.package_name}”` : ''}. Editing creates a personal override for this user only.
                </p>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-blue-600 hover:text-blue-800 pt-1"
              >
                {fromPackage ? 'Override for this user' : 'Edit'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-2">
                {keyOnly
                  ? 'No personal key: Dispatcher routing uses the global Jev key, if one is set.'
                  : 'Not available from this user’s package.'}
              </p>
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {keyOnly ? 'Set a key for this user' : 'Enable for this user'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">
        {label}
        {hint && <span className="ml-2 text-xs text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
      {label}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="font-medium">{label}:</span> {value}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-400">{children}</span>;
}

function Badge({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={`px-1.5 py-0.5 rounded ${on ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
      {on ? '✓' : '✗'} {children}
    </span>
  );
}

function globalToPayload(global: LLMProviderConfig): ApiKeySavePayload {
  // Global → per-user payload. api_key is intentionally excluded.
  return {
    model: global.model ?? null,
    base_url: global.base_url ?? null,
    max_tokens: global.max_tokens ?? null,
    temperature: global.temperature ?? null,
    chat_endpoint: global.chat_endpoint ?? null,
    system_prompt: global.system_prompt ?? null,
    streaming: !!global.streaming,
    supports_tools: !!global.supports_tools,
    enabled: global.enabled ?? true,
  };
}

export function ApiKeysSettings({ userId }: ApiKeysSettingsProps) {
  const { keys, loading, error, fetchKeys, saveKeys, deleteKey } = useApiKeys(userId);
  const [globalConfigs, setGlobalConfigs] = useState<Record<string, LLMProviderConfig>>({});
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyAllStatus, setApplyAllStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  useEffect(() => {
    api.getLLMSettings()
      .then((res) => {
        const map: Record<string, LLMProviderConfig> = {};
        for (const p of res.providers || []) map[p.provider_key] = p;
        setGlobalConfigs(map);
      })
      .catch(() => {
        // Non-fatal: the button will just be disabled.
      });
  }, []);

  const applicableProviders = LLM_PROVIDERS.filter(
    (p) => globalConfigs[p] && keys?.[p]?.api_key
  );

  const handleApplyAll = async () => {
    if (applicableProviders.length === 0) return;
    const names = applicableProviders.join(', ');
    if (!confirm(
      `Apply global attributes to ${applicableProviders.length} provider(s): ${names}?\n\n` +
      `This will overwrite model, max_tokens, temperature, base_url, chat_endpoint, ` +
      `system_prompt, streaming, supports_tools and enabled on each.\n\n` +
      `API keys will NOT be changed.`
    )) return;

    setApplyingAll(true);
    setApplyAllStatus(null);
    const payload: Record<string, ApiKeySavePayload> = {};
    for (const p of applicableProviders) {
      payload[p] = globalToPayload(globalConfigs[p]);
    }
    const ok = await saveKeys(payload);
    setApplyingAll(false);
    setApplyAllStatus(ok ? `Applied global attributes to ${applicableProviders.length} provider(s).` : 'Failed to apply global attributes.');
    setTimeout(() => setApplyAllStatus(null), 4000);
  };

  if (loading && !keys) {
    return <div className="p-4 text-gray-500">Loading API keys...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-800">LLM API Keys</h3>
        <div className="flex items-center gap-3">
          {applyAllStatus && (
            <span className="text-sm text-gray-600">{applyAllStatus}</span>
          )}
          <button
            type="button"
            onClick={handleApplyAll}
            disabled={applyingAll || applicableProviders.length === 0}
            title={
              applicableProviders.length === 0
                ? 'No configured providers with a matching global config'
                : `Apply global attributes to: ${applicableProviders.join(', ')} (API keys preserved)`
            }
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {applyingAll ? 'Applying...' : `Set All to Global Attributes${applicableProviders.length ? ` (${applicableProviders.length})` : ''}`}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {LLM_PROVIDERS.map((provider) => {
          const info = keys?.[provider];
          return (
            <ApiKeyCard
              key={provider}
              provider={provider}
              info={info}
              globalConfig={globalConfigs[provider]}
              onSave={(payload) => saveKeys({ [provider]: payload })}
              onDelete={() => deleteKey(provider)}
            />
          );
        })}
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mt-8">Dispatcher routing</h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Jev routes Dispatcher agents instead of a model. Not a chat provider; this user&apos;s key wins over the global one.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROUTER_PROVIDERS.map((provider) => (
          <ApiKeyCard
            key={provider}
            provider={provider}
            keyOnly
            info={keys?.[provider]}
            globalConfig={globalConfigs[provider]}
            onSave={(payload) => saveKeys({ [provider]: payload })}
            onDelete={() => deleteKey(provider)}
          />
        ))}
      </div>
    </div>
  );
}
