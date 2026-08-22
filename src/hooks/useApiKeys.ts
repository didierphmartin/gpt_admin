import { useState, useCallback } from 'react';
import type { ApiKeys, ApiKeySavePayload } from '../types';
import * as api from '../api/client';

export function useApiKeys(userId: number | null) {
  const [keys, setKeys] = useState<ApiKeys | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.getApiKeys(userId);
      setKeys(data.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const saveKeys = useCallback(async (keysToSave: Record<string, ApiKeySavePayload | string>) => {
    if (!userId) return false;

    setLoading(true);
    setError(null);
    try {
      await api.saveApiKeys(userId, keysToSave);
      await fetchKeys();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API keys');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, fetchKeys]);

  const deleteKey = useCallback(async (provider: string) => {
    if (!userId) return false;

    setLoading(true);
    setError(null);
    try {
      await api.deleteApiKey(userId, provider);
      await fetchKeys();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, fetchKeys]);

  return {
    keys,
    loading,
    error,
    fetchKeys,
    saveKeys,
    deleteKey,
  };
}
