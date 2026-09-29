import { useEffect, useMemo, useState } from 'react';
import { useLLMSettings } from '../hooks/useLLMSettings';
import { useModelCatalog } from '../lib/modelCatalog';
import type { LLMProviderConfig } from '../types';

// A provider row whose stored price is null falls back to the catalog price
// for its model, so the admin still sees what the model costs.
function formatPrice(stored: number | null | undefined, catalogPrice: number | undefined): string {
  const price = stored ?? catalogPrice;
  return price != null ? `$${Number(price).toFixed(2)}` : '—';
}

interface ProviderCardProps {
  provider: LLMProviderConfig;
  onEdit: (provider: LLMProviderConfig) => void;
  onToggle: (providerKey: string, enabled: boolean) => void;
  onDelete: (providerKey: string) => void;
}

function ProviderCard({ provider, onEdit, onToggle, onDelete }: ProviderCardProps) {
  const { catalog } = useModelCatalog();
  const entry = (catalog[provider.provider_key] ?? []).find((m) => m.id === provider.model);
  return (
    <div className={`border rounded-lg p-4 ${provider.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{provider.display_name}</h4>
            {!provider.enabled && (
              <span className="inline-block px-2 py-0.5 text-xs bg-gray-400 text-white rounded">
                Disabled
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{provider.provider_key}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={provider.enabled}
            onChange={(e) => onToggle(provider.provider_key, e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      <div className="space-y-2 text-sm">
        <p><span className="text-gray-500">Model:</span> <span className="font-mono text-gray-800">{provider.model}</span></p>
        <p><span className="text-gray-500">Max Tokens:</span> {provider.max_tokens.toLocaleString()}</p>
        <p><span className="text-gray-500">Temperature:</span> {provider.temperature}</p>
        <p>
          <span className="text-gray-500">Price / 1M tokens:</span>{' '}
          <span className="font-mono text-gray-800">
            in {formatPrice(provider.price_input_per_1m, entry?.input)} /{' '}
            out {formatPrice(provider.price_output_per_1m, entry?.output)}
          </span>
        </p>
        {provider.api_key_masked && (
          <p><span className="text-gray-500">API Key:</span> <span className="font-mono">{provider.api_key_masked}</span></p>
        )}
        {(provider.base_url || provider.chat_endpoint) && (
          <p>
            <span className="text-gray-500">API URL:</span>{' '}
            <span className="font-mono text-xs break-all">
              {(provider.base_url || '') + (provider.chat_endpoint || '')}
            </span>
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={() => onEdit(provider)}
          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
        >
          Edit
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete provider "${provider.display_name}"? This cannot be undone.`)) {
              onDelete(provider.provider_key);
            }
          }}
          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

interface ProviderFormProps {
  provider: Partial<LLMProviderConfig> | null;
  onSave: (provider: Partial<LLMProviderConfig>) => Promise<boolean>;
  onCancel: () => void;
}

function ProviderForm({ provider, onSave, onCancel }: ProviderFormProps) {
  const [formData, setFormData] = useState<Partial<LLMProviderConfig>>({
    provider_key: '',
    display_name: '',
    api_key: '',
    model: '',
    base_url: '',
    max_tokens: 4096,
    temperature: 0.7,
    price_input_per_1m: null,
    price_output_per_1m: null,
    chat_endpoint: '/v1/chat/completions',
    streaming: true,
    supports_tools: true,
    supported_models: [],
    api_format: 'openai',
    system_prompt: '',
    enabled: true,
    sort_order: 0,
    ...provider,
  });
  const [saving, setSaving] = useState(false);
  const { catalog } = useModelCatalog();

  const isEditing = !!provider?.provider_key;

  // Build the dropdown options for the Model field from the shared catalog,
  // each labelled with its price like gpt's own Settings panel. Always ensure
  // the currently-saved value is in the options (covers legacy or
  // manually-seeded values not in the list).
  const modelOptions = useMemo(() => {
    const key = formData.provider_key || '';
    const base = (catalog[key] ?? []).map((m) => ({
      value: m.id,
      text: `${m.label || m.id} — $${m.input}/$${m.output} per M`,
    }));
    const current = formData.model?.trim();
    if (current && !base.some((o) => o.value === current)) {
      return [{ value: current, text: current }, ...base];
    }
    return base;
  }, [formData.provider_key, formData.model, catalog]);

  // The catalog entry for the selected model: fills the displayed (and
  // saved) price when the stored price is null.
  const catalogEntry = (catalog[formData.provider_key || ''] ?? []).find((m) => m.id === formData.model);

  // Changing the model auto-updates the displayed token cost IF the catalog
  // has an entry for the selected model. Otherwise leave the existing price
  // in place (so hand-entered custom prices aren't silently wiped).
  const handleModelChange = (newModel: string) => {
    const key = formData.provider_key || '';
    const entry = (catalog[key] ?? []).find((m) => m.id === newModel);
    setFormData((prev) => ({
      ...prev,
      model: newModel,
      ...(entry ? { price_input_per_1m: entry.input, price_output_per_1m: entry.output } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.provider_key || !formData.model) return;

    setSaving(true);
    const dataToSave = {
      ...formData,
      price_input_per_1m: formData.price_input_per_1m ?? catalogEntry?.input ?? null,
      price_output_per_1m: formData.price_output_per_1m ?? catalogEntry?.output ?? null,
      // supported_models is no longer editable in the UI; keep whatever the
      // record already has (or an empty list for new providers).
      supported_models: formData.supported_models ?? [],
    };
    const success = await onSave(dataToSave);
    setSaving(false);
    if (success) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Provider' : 'Add New Provider'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.provider_key}
                onChange={(e) => setFormData({ ...formData, provider_key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="e.g., claude, openai, custom"
                disabled={isEditing}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="e.g., Claude 4.5"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              {modelOptions.length > 0 ? (
                <select
                  value={formData.model || ''}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                  required
                >
                  {!formData.model && <option value="" disabled>Select a model...</option>}
                  {modelOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.text}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.model || ''}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                  placeholder="e.g., claude-sonnet-5"
                  required
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Token cost <span className="text-gray-400 font-normal">(USD / 1M)</span>
              </label>
              <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-sm font-mono text-gray-700">
                in {formatPrice(formData.price_input_per_1m, catalogEntry?.input)}
                {' / '}
                out {formatPrice(formData.price_output_per_1m, catalogEntry?.output)}
              </div>
              <p className="mt-1 text-xs text-gray-400 italic">
                Pulled from the shared model catalog
                (<code className="font-mono">backend/resources/model_catalog.json</code>).
                Updates automatically when Model changes.
              </p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.api_key || ''}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                placeholder="Enter API key"
                required
              />
            </div>

            <div className="col-span-2 grid grid-cols-6 gap-4">
              <div className="col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API URL
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    (full URL for completion requests)
                  </span>
                </label>
                <input
                  type="text"
                  value={`${formData.base_url || ''}${formData.chat_endpoint || ''}`}
                  onChange={(e) => {
                    const full = e.target.value;
                    try {
                      const u = new URL(full);
                      setFormData({
                        ...formData,
                        base_url: u.origin,
                        chat_endpoint: `${u.pathname}${u.search}`,
                      });
                    } catch {
                      setFormData({ ...formData, base_url: full, chat_endpoint: '' });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                <input
                  type="number"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 4096 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) || 0.7 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
              <textarea
                value={formData.system_prompt || ''}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={6}
                placeholder="Default system prompt for this provider..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-200">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.streaming}
                  onChange={(e) => setFormData({ ...formData, streaming: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Streaming</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.supports_tools}
                  onChange={(e) => setFormData({ ...formData, supports_tools: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Supports Tools</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Enabled</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !formData.provider_key || !formData.model}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : isEditing ? 'Update Provider' : 'Add Provider'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LLMSettingsPanel() {
  const {
    providers,
    source,
    loading,
    error,
    fetchProviders,
    saveProvider,
    deleteProvider,
    toggleProvider,
    seedFromConfig,
  } = useLLMSettings();

  const [editingProvider, setEditingProvider] = useState<Partial<LLMProviderConfig> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleSeedFromConfig = async () => {
    if (!confirm('This will import all providers from the config file. Existing providers with the same key will be updated. Continue?')) {
      return;
    }
    setSeeding(true);
    const result = await seedFromConfig();
    setSeeding(false);
    if (result) {
      alert(`Seeded ${result.seeded.length} providers from config. Default: ${result.default_provider}`);
    }
  };

  const handleAddNew = () => {
    setEditingProvider(null);
    setShowForm(true);
  };

  const handleEdit = (provider: LLMProviderConfig) => {
    setEditingProvider(provider);
    setShowForm(true);
  };

  const handleSave = async (provider: Partial<LLMProviderConfig>) => {
    return await saveProvider(provider);
  };

  if (loading && providers.length === 0) {
    return <div className="p-4 text-gray-500">Loading LLM providers...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">LLM Provider Settings</h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage system-wide LLM provider configurations
            {source && <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded">Source: {source}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {source === 'config' && (
            <button
              onClick={handleSeedFromConfig}
              disabled={seeding}
              className="px-4 py-2 text-sm text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 disabled:opacity-50"
            >
              {seeding ? 'Importing...' : 'Import from Config'}
            </button>
          )}
          <button
            onClick={handleAddNew}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            + Add Provider
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {providers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No LLM providers configured</p>
          <button
            onClick={handleSeedFromConfig}
            disabled={seeding}
            className="px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            {seeding ? 'Importing...' : 'Import from Config File'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.provider_key}
              provider={provider}
              onEdit={handleEdit}
              onToggle={toggleProvider}
              onDelete={deleteProvider}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ProviderForm
          provider={editingProvider}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
