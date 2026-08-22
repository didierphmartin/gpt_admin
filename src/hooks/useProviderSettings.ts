import { useState, useCallback } from 'react';
import type { ProviderSettings, ProviderCategory } from '../types';
import * as api from '../api/client';

export function useProviderSettings(userId: number | null) {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.getProviderSettings(userId);
      // Ensure enabled defaults to true if not set
      setSettings({
        avatar: {
          ...data.avatar,
          enabled: data.avatar.enabled !== false,
        },
        voice: {
          ...data.voice,
          enabled: data.voice.enabled !== false,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const saveProvider = useCallback(async (
    category: ProviderCategory,
    provider: string,
    apiKey?: string,
    providerSettings?: Record<string, unknown>
  ) => {
    if (!userId) return false;

    setLoading(true);
    setError(null);
    try {
      await api.saveProvider(userId, category, provider, apiKey, providerSettings);
      await fetchSettings();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, fetchSettings]);

  const setActiveProvider = useCallback(async (category: ProviderCategory, provider: string) => {
    if (!userId) return false;

    setLoading(true);
    setError(null);
    try {
      await api.setActiveProvider(userId, category, provider);
      await fetchSettings();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active provider');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, fetchSettings]);

  const deleteProvider = useCallback(async (category: ProviderCategory, provider: string) => {
    if (!userId) return false;

    setLoading(true);
    setError(null);
    try {
      await api.deleteProvider(userId, category, provider);
      await fetchSettings();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, fetchSettings]);

  const toggleCategoryEnabled = useCallback(async (category: ProviderCategory, enabled: boolean) => {
    if (!userId) return false;

    setError(null);
    try {
      await api.toggleCategoryEnabled(userId, category, enabled);
      await fetchSettings();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle category');
      return false;
    }
  }, [userId, fetchSettings]);

  const toggleProviderEnabled = useCallback(async (category: ProviderCategory, provider: string, enabled: boolean) => {
    if (!userId) return false;

    setError(null);
    try {
      await api.toggleProviderEnabled(userId, category, provider, enabled);
      await fetchSettings();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle provider');
      return false;
    }
  }, [userId, fetchSettings]);

  return {
    settings,
    loading,
    error,
    fetchSettings,
    saveProvider,
    setActiveProvider,
    deleteProvider,
    toggleCategoryEnabled,
    toggleProviderEnabled,
  };
}
