import { useEffect } from 'react';
import { useProviderSettings } from '../hooks/useProviderSettings';
import { ProviderCard } from './ProviderCard';
import { Switch } from './Switch';
import { AVATAR_PROVIDERS, VOICE_PROVIDERS } from '../types';
import type { ProviderCategory } from '../types';

interface ProviderSettingsProps {
  userId: number;
}

export function ProviderSettings({ userId }: ProviderSettingsProps) {
  const {
    settings,
    loading,
    error,
    fetchSettings,
    saveProvider,
    setActiveProvider,
    deleteProvider,
    toggleCategoryEnabled,
    toggleProviderEnabled,
  } = useProviderSettings(userId);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (loading && !settings) {
    return <div className="p-4 text-gray-500">Loading provider settings...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  const renderProviderSection = (
    title: string,
    description: string,
    category: ProviderCategory,
    providers: readonly string[]
  ) => {
    const categorySettings = settings?.[category];
    const categoryEnabled = categorySettings?.enabled !== false;
    const activeProvider = categorySettings?.active;

    return (
      <div className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
        {/* Section Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${categoryEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                {categoryEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={categoryEnabled}
                onChange={(enabled) => toggleCategoryEnabled(category, enabled)}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Providers Grid */}
        <div className={`p-6 ${!categoryEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((provider) => {
              const config = categorySettings?.providers[provider] || null;
              const providerEnabled = config?.enabled !== false;

              return (
                <ProviderCard
                  key={provider}
                  provider={provider}
                  category={category}
                  config={config}
                  isActive={activeProvider === provider}
                  isEnabled={providerEnabled}
                  categoryEnabled={categoryEnabled}
                  onSave={(apiKey, providerSettings) =>
                    saveProvider(category, provider, apiKey, providerSettings)
                  }
                  onSetActive={() => setActiveProvider(category, provider)}
                  onDelete={() => deleteProvider(category, provider)}
                  onToggleEnabled={(enabled) => toggleProviderEnabled(category, provider, enabled)}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderProviderSection(
        'Voice Providers',
        'Configure voice synthesis providers for text-to-speech functionality',
        'voice',
        VOICE_PROVIDERS
      )}
      {renderProviderSection(
        'Avatar Providers',
        'Configure avatar providers for visual AI representation',
        'avatar',
        AVATAR_PROVIDERS
      )}
    </div>
  );
}
