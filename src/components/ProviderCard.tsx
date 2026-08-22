import { useState, useEffect } from 'react';
import { Switch } from './Switch';
import type { ProviderConfig } from '../types';

interface ProviderCardProps {
  provider: string;
  category: 'avatar' | 'voice';
  config: ProviderConfig | null;
  isActive: boolean;
  isEnabled: boolean;
  /** Whether the entire category (voice/avatar) is enabled */
  categoryEnabled?: boolean;
  onSave: (apiKey?: string, settings?: Record<string, unknown>) => Promise<boolean>;
  onSetActive: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onToggleEnabled: (enabled: boolean) => Promise<boolean>;
}

export function ProviderCard({
  provider,
  config,
  isActive,
  isEnabled,
  categoryEnabled = true,
  onSave,
  onSetActive,
  onDelete,
  onToggleEnabled,
}: ProviderCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [apiKey, setApiKey] = useState(config?.api_key || '');
  const [settingsJson, setSettingsJson] = useState(
    config?.settings ? JSON.stringify(config.settings, null, 2) : '{}'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update local state when config prop changes
  useEffect(() => {
    setApiKey(config?.api_key || '');
    setSettingsJson(config?.settings ? JSON.stringify(config.settings, null, 2) : '{}');
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let settings = {};
      try {
        settings = JSON.parse(settingsJson);
      } catch {
        setError('Invalid JSON in settings');
        setSaving(false);
        return;
      }
      const success = await onSave(apiKey || undefined, settings);
      if (success) {
        setIsEditing(false);
        setError(null);
      } else {
        setError('Failed to save provider settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete ${provider} configuration?`)) {
      await onDelete();
    }
  };

  const isConfigured = config !== null;

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        !categoryEnabled || !isEnabled
          ? 'border-gray-200 bg-gray-50 opacity-60'
          : isActive
          ? 'border-green-500 bg-green-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Header with Provider Name and Enable Switch */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={categoryEnabled && isEnabled}
            onChange={onToggleEnabled}
            size="sm"
            disabled={!categoryEnabled}
          />
          <div>
            <h4 className={`font-medium capitalize ${categoryEnabled && isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
              {provider}
            </h4>
            <div className="flex gap-2 mt-1">
              {isActive && categoryEnabled && isEnabled && (
                <span className="inline-block px-2 py-0.5 text-xs bg-green-500 text-white rounded">
                  Active
                </span>
              )}
              {isConfigured && (
                <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                  Configured
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isConfigured && !isActive && isEnabled && (
            <button
              onClick={onSetActive}
              className="text-sm text-green-600 hover:text-green-800 cursor-pointer"
            >
              Set Active
            </button>
          )}
          {isConfigured && (
            <button
              onClick={handleDelete}
              className="text-sm text-red-600 hover:text-red-800 cursor-pointer"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Content - only show when both category and provider are enabled */}
      {categoryEnabled && isEnabled && (
        <>
          {isEditing ? (
            <div className="space-y-3">
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-1">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                  placeholder="Enter API key..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Settings (JSON)</label>
                <textarea
                  value={settingsJson}
                  onChange={(e) => setSettingsJson(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setError(null); setIsEditing(false); }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {isConfigured ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">API Key:</span>{' '}
                    <span className="font-mono">
                      {config.api_key ? `****${config.api_key.slice(-4)}` : 'Not set'}
                    </span>
                  </p>
                  {config.settings && Object.keys(config.settings).length > 0 && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Settings:</span>
                      <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(config.settings, null, 2)}
                      </pre>
                    </div>
                  )}
                  <button
                    onClick={() => { setError(null); setIsEditing(true); }}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Not configured</p>
                  <button
                    onClick={() => { setError(null); setIsEditing(true); }}
                    className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    + Configure
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
