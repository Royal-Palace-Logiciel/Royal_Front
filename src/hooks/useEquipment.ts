// src/hooks/useEquipment.ts
import { useState, useEffect, useCallback } from 'react';
import { equipmentService } from '../services/equipment.service';
import { Equipment, RoomEquipment } from '../types/hotel.types';

export const useEquipment = () => {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [roomEquipments, setRoomEquipments] = useState<RoomEquipment[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger tous les équipements
  const loadEquipments = useCallback(async (filters?: { categorie?: string; nom?: string; code?: string }) => {
    try {
      setLoading(true);
      setError(null);
      const data = await equipmentService.getEquipments(filters);
      setEquipments(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des équipements');
      console.error('❌ loadEquipments error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les équipements de chambre
  const loadRoomEquipments = useCallback(async (filters?: { room_id?: number; equipment_id?: number }) => {
    try {
      const data = await equipmentService.getRoomEquipments(filters);
      setRoomEquipments(data);
    } catch (err: any) {
      console.error('❌ loadRoomEquipments error:', err);
    }
  }, []);

  // Charger les catégories
  const loadCategories = useCallback(async () => {
    try {
      const data = await equipmentService.getEquipmentCategories();
      setCategories(data);
    } catch (err: any) {
      console.error('❌ loadCategories error:', err);
    }
  }, []);

  // Charger les statistiques
  const loadStats = useCallback(async () => {
    try {
      const data = await equipmentService.getEquipmentStats();
      setStats(data);
    } catch (err: any) {
      console.error('❌ loadStats error:', err);
    }
  }, []);

  // Créer un équipement
  const createEquipment = useCallback(async (data: any) => {
    try {
      setError(null);
      const newEquipment = await equipmentService.createEquipment(data);
      setEquipments(prev => [...prev, newEquipment]);
      return newEquipment;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
      console.error('❌ createEquipment error:', err);
      throw err;
    }
  }, []);

  // Mettre à jour un équipement
  const updateEquipment = useCallback(async (id: number, data: any) => {
    try {
      setError(null);
      const updatedEquipment = await equipmentService.updateEquipment(id, data);
      setEquipments(prev => prev.map(eq => eq.id === id ? updatedEquipment : eq));
      return updatedEquipment;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
      console.error('❌ updateEquipment error:', err);
      throw err;
    }
  }, []);

  // Supprimer un équipement
  const deleteEquipment = useCallback(async (id: number) => {
    try {
      setError(null);
      await equipmentService.deleteEquipment(id);
      setEquipments(prev => prev.filter(eq => eq.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
      console.error('❌ deleteEquipment error:', err);
      throw err;
    }
  }, []);

  // Assigner un équipement à une chambre
  const assignEquipment = useCallback(async (data: any) => {
    try {
      setError(null);
      const newRoomEquipment = await equipmentService.assignEquipment(data);
      setRoomEquipments(prev => [...prev, newRoomEquipment]);
      return newRoomEquipment;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'assignation');
      console.error('❌ assignEquipment error:', err);
      throw err;
    }
  }, []);

  const updateRoomEquipment = useCallback(async (id: number, data: any) => {
    try {
      setError(null);
      const updated = await equipmentService.updateRoomEquipment(id, data);
      setRoomEquipments(prev => prev.map(re => re.id === id ? updated : re));
      return updated;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour de l\'assignation');
      console.error('❌ updateRoomEquipment error:', err);
      throw err;
    }
  }, []);

  // Supprimer un équipement de chambre
  const deleteRoomEquipment = useCallback(async (id: number) => {
    try {
      setError(null);
      await equipmentService.deleteRoomEquipment(id);
      setRoomEquipments(prev => prev.filter(re => re.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
      console.error('❌ deleteRoomEquipment error:', err);
      throw err;
    }
  }, []);

  // Mettre à jour le statut d'un équipement de chambre
  const updateRoomEquipmentStatus = useCallback(async (id: number, statut: string) => {
    try {
      setError(null);
      const updated = await equipmentService.updateRoomEquipmentStatus(id, statut);
      setRoomEquipments(prev => prev.map(re => re.id === id ? updated : re));
      return updated;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
      console.error('❌ updateRoomEquipmentStatus error:', err);
      throw err;
    }
  }, []);

  // Charger toutes les données
  const loadAll = useCallback(async () => {
    await Promise.all([
      loadEquipments(),
      loadRoomEquipments(),
      loadCategories(),
      loadStats()
    ]);
  }, [loadEquipments, loadRoomEquipments, loadCategories, loadStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    equipments,
    roomEquipments,
    categories,
    stats,
    loading,
    error,
    loadEquipments,
    loadRoomEquipments,
    loadCategories,
    loadStats,
    loadAll,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    assignEquipment,
    updateRoomEquipment,
    deleteRoomEquipment,
    updateRoomEquipmentStatus
  };
};