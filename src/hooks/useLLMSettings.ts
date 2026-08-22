import { useState, useCallback } from 'react';
import type { LLMProviderConfig } from '../types';
import * as api from '../api/client';

export function useLLMSettings() {
  const [providers, setProviders] = useState<LLMProviderConfig[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLLMSettings();
      setProviders(data.providers);
      setSource(data.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch LLM providers');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProvider = useCallback(async (provider: Partial<LLMProviderConfig>) => {
    setLoading(true);
    setError(null);
    try {
      await api.saveLLMProvider(provider);
      await fetchProviders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchProviders]);

  const deleteProvider = useCallback(async (providerKey: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteLLMProvider(providerKey);
      await fetchProviders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchProviders]);

  const toggleProvider = useCallback(async (providerKey: string, enabled?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await api.toggleLLMProvider(providerKey, enabled);
      await fetchProviders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle provider');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchProviders]);

  const seedFromConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.seedLLMFromConfig();
      await fetchProviders();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed from config');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchProviders]);

  return {
    providers,
    source,
    loading,
    error,
    fetchProviders,
    saveProvider,
    deleteProvider,
    toggleProvider,
    seedFromConfig,
  };
}
