import { useState, useCallback } from 'react';
import type { Package, PackageCapabilities } from '../types';
import * as api from '../api/client';

export function usePackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listPackages();
      setPackages(data.packages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch packages');
    } finally {
      setLoading(false);
    }
  }, []);

  const savePackage = useCallback(
    async (role: string, capabilities: PackageCapabilities): Promise<Package | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.updatePackage(role, capabilities);
        // Replace the updated row in place so other tabs keep their unsaved state.
        setPackages((prev) =>
          prev.map((p) => (p.role === data.package.role ? data.package : p))
        );
        return data.package;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save package');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    packages,
    loading,
    error,
    fetchPackages,
    savePackage,
  };
}
