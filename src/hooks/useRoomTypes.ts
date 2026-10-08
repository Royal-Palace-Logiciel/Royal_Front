// src/hooks/useRoomTypes.ts
import { useState, useEffect, useCallback } from 'react';
import { roomTypeService } from '../services/room.service';
import { RoomType } from '../types/hotel.types';

export const useRoomTypes = () => {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoomTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await roomTypeService.getRoomTypes();
      setRoomTypes(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des types de chambres');
      console.error('❌ loadRoomTypes error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoomTypes();
  }, [loadRoomTypes]);

  return {
    roomTypes,
    loading,
    error,
    loadRoomTypes,
  };
};