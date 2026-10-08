// src/hooks/useHousekeeping.ts
import { useState, useEffect, useCallback } from 'react';
import { housekeepingService } from '../services/housekeeping.service';
import { HousekeepingTask } from '../types/hotel.types';

export const useHousekeeping = () => {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger toutes les tâches
  const loadTasks = useCallback(async (filters?: {
    statut?: string;
    room_id?: number;
    type_tache?: string;
    assigned_user_id?: number;
    planned_at?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const data = await housekeepingService.getTasks(filters);
      setTasks(Array.isArray(data) ? data.filter(Boolean) : []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des tâches');
      console.error('❌ loadTasks error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les statistiques
  const loadStats = useCallback(async () => {
    try {
      const data = await housekeepingService.getTaskStats();
      setStats(data);
    } catch (err: any) {
      console.error('❌ loadStats error:', err);
      // Stats par défaut en cas d'erreur
      setStats({ total: 0, a_faire: 0, en_cours: 0, termine: 0 });
    }
  }, []);

  // Créer une tâche
  const createTask = useCallback(async (data: any) => {
    try {
      setError(null);
      const newTask = await housekeepingService.createTask(data);
      if (newTask) setTasks(prev => [...prev, newTask]);
      return newTask;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
      console.error('❌ createTask error:', err);
      throw err;
    }
  }, []);

  // Mettre à jour une tâche
  const updateTask = useCallback(async (id: number, data: any) => {
    try {
      setError(null);
      const updated = await housekeepingService.updateTask(id, data);
      if (updated) setTasks(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
      console.error('❌ updateTask error:', err);
      throw err;
    }
  }, []);

  // Mettre à jour le statut
  const updateStatus = useCallback(async (id: number, statut: string, productsUsed?: any[]) => {
    try {
      setError(null);
      const updated = await housekeepingService.updateTaskStatus(id, statut, productsUsed);
      if (updated) setTasks(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
      console.error('❌ updateStatus error:', err);
      throw err;
    }
  }, []);

  // Supprimer une tâche
  const deleteTask = useCallback(async (id: number) => {
    try {
      setError(null);
      await housekeepingService.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
      console.error('❌ deleteTask error:', err);
      throw err;
    }
  }, []);

  // Charger toutes les données
  const loadAll = useCallback(async () => {
    await Promise.all([loadTasks(), loadStats()]);
  }, [loadTasks, loadStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    tasks,
    stats,
    loading,
    error,
    loadTasks,
    loadStats,
    loadAll,
    createTask,
    updateTask,
    updateStatus,
    deleteTask
  };
};