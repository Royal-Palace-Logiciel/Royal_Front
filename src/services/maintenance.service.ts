import api from '../lib/api';
import { RoomMaintenance } from '../types/hotel.types';

export interface MaintenanceFormData {
  room_id: number;
  equipment_id?: number | null;
  type_intervention: 'PLOMBERIE' | 'ELECTRICITE' | 'MACONNERIE' | 'CLIMATISATION' | 'AUTRE';
  description?: string;
  statut?: 'OUVERT' | 'EN_COURS' | 'TERMINE' | 'ANNULE';
  date_declaration?: string;
  cout?: number;
  created_by?: number | null;
  location?: string;
  equipment_label?: string;
  worker_id?: number | null;
  execution_date?: string;
  finish_date?: string;
  materials_cost?: number;
  labor_cost?: number;
  total_cost?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

// La table est room_maintenance, montée sous /api/hebergement/room-maintenance (README §5.5)
const BASE_URL = '/api/hebergement/room-maintenance';

export const maintenanceService = {
  // Récupérer toutes les maintenances
  getMaintenances: async (filters?: {
    statut?: string;
    room_id?: number;
    type_intervention?: string;
    from?: string;
    to?: string;
  }): Promise<RoomMaintenance[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.statut) params.append('statut', filters.statut);
      if (filters?.room_id) params.append('room_id', String(filters.room_id));
      if (filters?.type_intervention) params.append('type_intervention', filters.type_intervention);
      if (filters?.from) params.append('from', filters.from);
      if (filters?.to) params.append('to', filters.to);

      const url = `${BASE_URL}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<ApiResponse<RoomMaintenance[]>>(url);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getMaintenances:', error);
      throw error;
    }
  },

  // Récupérer une maintenance par ID
  getMaintenanceById: async (id: number): Promise<RoomMaintenance> => {
    try {
      const response = await api.get<ApiResponse<RoomMaintenance>>(`${BASE_URL}/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getMaintenanceById ${id}:`, error);
      throw error;
    }
  },

  // Créer une maintenance
  createMaintenance: async (data: MaintenanceFormData): Promise<RoomMaintenance> => {
    try {
      const response = await api.post<ApiResponse<RoomMaintenance>>(BASE_URL, data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur createMaintenance:', error);
      throw error;
    }
  },

  // Mettre à jour une maintenance
  updateMaintenance: async (id: number, data: Partial<MaintenanceFormData>): Promise<RoomMaintenance> => {
    try {
      const response = await api.put<ApiResponse<RoomMaintenance>>(`${BASE_URL}/${id}`, data);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateMaintenance ${id}:`, error);
      throw error;
    }
  },

  // Mettre à jour le statut d'une maintenance
  updateMaintenanceStatus: async (id: number, statut: string): Promise<RoomMaintenance> => {
    try {
      const response = await api.put<ApiResponse<RoomMaintenance>>(`${BASE_URL}/${id}/status`, { statut });
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateMaintenanceStatus ${id}:`, error);
      throw error;
    }
  },

  // Supprimer une maintenance
  deleteMaintenance: async (id: number): Promise<void> => {
    try {
      await api.delete<ApiResponse<void>>(`${BASE_URL}/${id}`);
    } catch (error) {
      console.error(`❌ Erreur deleteMaintenance ${id}:`, error);
      throw error;
    }
  },

  // Statistiques des maintenances
  getMaintenanceStats: async (): Promise<any> => {
    try {
      const response = await api.get<ApiResponse<any>>(`${BASE_URL}/stats`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getMaintenanceStats:', error);
      throw error;
    }
  }
};