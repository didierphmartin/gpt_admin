import { useState, useCallback } from 'react';
import * as api from '../api/affiliates';

export function useAffiliates() {
  const [affiliates, setAffiliates] = useState<api.AffiliateListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAffiliates = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.listAffiliates();
      setAffiliates(data.affiliates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch affiliates');
    } finally { setLoading(false); }
  }, []);

  const createAffiliate = useCallback(async (name: string, email: string, password: string) => {
    setError(null);
    try {
      const res = await api.createAffiliate(name, email, password);
      await fetchAffiliates();
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create affiliate');
      return null;
    }
  }, [fetchAffiliates]);

  const deleteAffiliate = useCallback(async (id: number) => {
    setError(null);
    try {
      await api.deleteAffiliate(id);
      await fetchAffiliates();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete affiliate');
      return false;
    }
  }, [fetchAffiliates]);

  return { affiliates, loading, error, fetchAffiliates, createAffiliate, deleteAffiliate };
}
