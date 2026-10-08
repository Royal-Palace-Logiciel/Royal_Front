// src/hooks/useMaintenance.ts
import { useState, useEffect, useCallback } from 'react';
import { maintenanceService } from '../services/maintenance.service';
import { RoomMaintenance } from '../types/hotel.types';

export const useMaintenance = () => {
  const [maintenances, setMaintenances] = useState<RoomMaintenance[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger toutes les maintenances
  const loadMaintenances = useCallback(async (filters?: {
    statut?: string;
    room_id?: number;
    type_intervention?: string;
    from?: string;
    to?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const data = await maintenanceService.getMaintenances(filters);
      setMaintenances(Array.isArray(data) ? data.filter(Boolean) : []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des maintenances');
      console.error('❌ loadMaintenances error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les statistiques
  const loadStats = useCallback(async () => {
    try {
      const data = await maintenanceService.getMaintenanceStats();
      setStats(data);
    } catch (err: any) {
      console.error('❌ loadStats error:', err);
      // Stats par défaut en cas d'erreur
      setStats({
        total: 0,
        ouverts: 0,
        en_cours: 0,
        termines: 0,
        annules: 0,
        cout_total: 0,
        cout_moyen: 0,
        chambres_touchees: 0
      });
    }
  }, []);

  // Créer une maintenance
  const createMaintenance = useCallback(async (data: any) => {
    try {
      setError(null);
      const newMaintenance = await maintenanceService.createMaintenance(data);
      if (newMaintenance) setMaintenances(prev => [...prev, newMaintenance]);
      return newMaintenance;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
      console.error('❌ createMaintenance error:', err);
      throw err;
    }
  }, []);

  // Mettre à jour une maintenance
  const updateMaintenance = useCallback(async (id: number, data: any) => {
    try {
      setError(null);
      const updated = await maintenanceService.updateMaintenance(id, data);
      if (updated) setMaintenances(prev => prev.map(m => m.id === id ? updated : m));
      return updated;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
      console.error('❌ updateMaintenance error:', err);
      throw err;
    }
  }, []);

  // Mettre à jour le statut
  const updateStatus = useCallback(async (id: number, statut: string) => {
    try {
      setError(null);
      const updated = await maintenanceService.updateMaintenanceStatus(id, statut);
      if (updated) setMaintenances(prev => prev.map(m => m.id === id ? updated : m));
      return updated;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
      console.error('❌ updateStatus error:', err);
      throw err;
    }
  }, []);

  // Supprimer une maintenance
  const deleteMaintenance = useCallback(async (id: number) => {
    try {
      setError(null);
      await maintenanceService.deleteMaintenance(id);
      setMaintenances(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
      console.error('❌ deleteMaintenance error:', err);
      throw err;
    }
  }, []);

  // Charger toutes les données
  const loadAll = useCallback(async () => {
    await Promise.all([loadMaintenances(), loadStats()]);
  }, [loadMaintenances, loadStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    maintenances,
    stats,
    loading,
    error,
    loadMaintenances,
    loadStats,
    loadAll,
    createMaintenance,
    updateMaintenance,
    updateStatus,
    deleteMaintenance
  };
};