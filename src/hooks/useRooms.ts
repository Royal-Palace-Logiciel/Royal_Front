// src/hooks/useRooms.ts
import { useState, useEffect, useCallback } from 'react';
import { roomService, roomTypeService } from '../services/room.service';
import { Room, RoomType } from '../types/hotel.types';

export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les chambres et les types
  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [roomsData, typesData] = await Promise.all([
        roomService.getRooms(),
        roomTypeService.getRoomTypes()
      ]);
      
      setRoomTypes(typesData);
      
      const roomsWithTypes = roomsData.map(room => ({
        ...room,
        room_type: typesData.find(type => type.id === room.room_type_id)
      }));
      
      setRooms(roomsWithTypes);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des données');
      console.error('❌ loadRooms error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Créer une chambre
  const createRoom = useCallback(async (data: Omit<Room, 'id' | 'room_type'>) => {
    try {
      setError(null);
      const newRoom = await roomService.createRoom(data);
      
      const roomWithType = {
        ...newRoom,
        room_type: roomTypes.find(type => type.id === newRoom.room_type_id)
      };
      
      setRooms(prev => [...prev, roomWithType]);
      return roomWithType;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
      console.error('❌ createRoom error:', err);
      throw err;
    }
  }, [roomTypes]);

  // Mettre à jour une chambre
  const updateRoom = useCallback(async (id: number, data: Partial<Room>) => {
    try {
      setError(null);
      const updatedRoom = await roomService.updateRoom(id, data);
      
      const roomWithType = {
        ...updatedRoom,
        room_type: roomTypes.find(type => type.id === updatedRoom.room_type_id)
      };
      
      setRooms(prev => prev.map(room => room.id === id ? roomWithType : room));
      return roomWithType;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
      console.error('❌ updateRoom error:', err);
      throw err;
    }
  }, [roomTypes]);

  // Mettre à jour le statut
  const updateRoomStatus = useCallback(async (roomId: number, newStatus: string) => {
    try {
      setError(null);
      const updatedRoom = await roomService.updateRoomStatus(roomId, newStatus);
      
      const roomWithType = {
        ...updatedRoom,
        room_type: roomTypes.find(type => type.id === updatedRoom.room_type_id)
      };
      
      setRooms(prev => prev.map(room => room.id === roomId ? roomWithType : room));
      return roomWithType;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
      console.error('❌ updateRoomStatus error:', err);
      throw err;
    }
  }, [roomTypes]);

  // Supprimer une chambre
  const deleteRoom = useCallback(async (roomId: number) => {
    try {
      setError(null);
      await roomService.deleteRoom(roomId);
      setRooms(prev => prev.filter(room => room.id !== roomId));
      console.log(`✅ Chambre ${roomId} supprimée avec succès`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
      console.error('❌ deleteRoom error:', err);
      throw err;
    }
  }, []);

  // Recharger les données
  const refresh = useCallback(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  return {
    rooms,
    roomTypes,
    loading,
    error,
    loadRooms,
    refresh,
    createRoom,
    updateRoom,
    updateRoomStatus,
    deleteRoom
  };
};