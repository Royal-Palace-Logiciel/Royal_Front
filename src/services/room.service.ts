// src/services/room.service.ts
import api from '../lib/api';
import { Room, RoomType } from '../types/hotel.types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

// Service pour les types de chambres
export const roomTypeService = {
  getRoomTypes: async (): Promise<RoomType[]> => {
    try {
      const response = await api.get<ApiResponse<RoomType[]>>('/api/hebergement/room-types');
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getRoomTypes:', error);
      throw error;
    }
  },

  getRoomTypeById: async (id: number): Promise<RoomType> => {
    try {
      const response = await api.get<ApiResponse<RoomType>>(`/api/hebergement/room-types/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getRoomTypeById ${id}:`, error);
      throw error;
    }
  },

  createRoomType: async (data: { nom: string; description?: string }): Promise<RoomType> => {
    try {
      const response = await api.post<ApiResponse<RoomType>>('/api/hebergement/room-types', data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur createRoomType:', error);
      throw error;
    }
  },

  updateRoomType: async (id: number, data: { nom: string; description?: string }): Promise<RoomType> => {
    try {
      const response = await api.put<ApiResponse<RoomType>>(`/api/hebergement/room-types/${id}`, data);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateRoomType ${id}:`, error);
      throw error;
    }
  },

  deleteRoomType: async (id: number): Promise<void> => {
    try {
      await api.delete<ApiResponse<void>>(`/api/hebergement/room-types/${id}`);
    } catch (error) {
      console.error(`❌ Erreur deleteRoomType ${id}:`, error);
      throw error;
    }
  }
};

// Service pour les chambres
export const roomService = {
  getRooms: async (): Promise<Room[]> => {
    try {
      const response = await api.get<ApiResponse<Room[]>>('/api/hebergement/rooms');
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getRooms:', error);
      throw error;
    }
  },

  getRoomById: async (id: number): Promise<Room> => {
    try {
      const response = await api.get<ApiResponse<Room>>(`/api/hebergement/rooms/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getRoomById ${id}:`, error);
      throw error;
    }
  },

  // prix_nuit est optionnel ici : le backend rejette ce champ pour les non-admins
  // (voir hebergementController.js), donc RoomFormModal l'omet volontairement
  // du payload quand l'utilisateur n'est pas admin.
  createRoom: async (data: Omit<Room, 'id' | 'room_type' | 'prix_nuit'> & { prix_nuit?: number | null }): Promise<Room> => {
    try {
      const response = await api.post<ApiResponse<Room>>('/api/hebergement/rooms', data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur createRoom:', error);
      throw error;
    }
  },

  updateRoom: async (id: number, data: Partial<Room>): Promise<Room> => {
    try {
      const response = await api.put<ApiResponse<Room>>(`/api/hebergement/rooms/${id}`, data);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateRoom ${id}:`, error);
      throw error;
    }
  },

  updateRoomStatus: async (roomId: number, status: string): Promise<Room> => {
    try {
      const response = await api.put<ApiResponse<Room>>(`/api/hebergement/rooms/${roomId}/status`, {
        statut: status
      });
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateRoomStatus ${roomId}:`, error);
      throw error;
    }
  },

  deleteRoom: async (roomId: number): Promise<void> => {
    try {
      await api.delete<ApiResponse<void>>(`/api/hebergement/rooms/${roomId}`);
    } catch (error) {
      console.error(`❌ Erreur deleteRoom ${roomId}:`, error);
      throw error;
    }
  },

  // Statistiques agrégées des chambres (total, taux d'occupation, répartitions)
  getRoomStats: async (): Promise<any> => {
    try {
      const response = await api.get<ApiResponse<any>>('/api/hebergement/rooms/stats');
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getRoomStats:', error);
      throw error;
    }
  }
};

// ➔ AJOUT DE L'EXPORT PAR DÉFAUT POUR ÉVITER LES ERREURS D'IMPORTATION
export default {
  roomService,
  roomTypeService
};