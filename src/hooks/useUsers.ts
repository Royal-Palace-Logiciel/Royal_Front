// src/hooks/useUsers.ts (version alternative)
import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { User } from '../types';


export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users');
      setUsers(response.data.data);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return { users, loading, error, loadUsers };
};