import { useState, useCallback } from 'react';
import type { User } from '../types';
import * as api from '../api/client';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listUsers();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async (email: string, password: string, firstName?: string, lastName?: string, role?: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.createUser(email, password, firstName, lastName, role);
      await fetchUsers();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  const updateUser = useCallback(async (userId: number, email: string, firstName?: string, lastName?: string, role?: string, password?: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.updateUser(userId, email, firstName, lastName, role, password);
      await fetchUsers();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId: number) => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteUser(userId);
      await fetchUsers();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
}
