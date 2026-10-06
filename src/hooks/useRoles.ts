import { useState, useCallback } from 'react';
import type { Role } from '../types';
import * as api from '../api/client';

/**
 * The installation's roles (GET /admin/roles). Mutations throw the backend's
 * error text so the caller can show it inline, and refresh the list on success.
 */
export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoles(await api.listRoles());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  }, []);

  const createRole = useCallback(async (role: string, name: string, copyFrom: string | null) => {
    const created = await api.createRole(role, name, copyFrom);
    await fetchRoles();
    return created;
  }, [fetchRoles]);

  const renameRole = useCallback(async (role: string, name: string) => {
    const renamed = await api.renameRole(role, name);
    await fetchRoles();
    return renamed;
  }, [fetchRoles]);

  const deleteRole = useCallback(async (role: string) => {
    await api.deleteRole(role);
    await fetchRoles();
  }, [fetchRoles]);

  return { roles, loading, error, fetchRoles, createRole, renameRole, deleteRole };
}
