import api from '../lib/api';
import { HousekeepingTask } from '../types/hotel.types';

// src/services/housekeeping.service.ts
//
// Les tâches de housekeeping vivent sous le domaine "hébergement" côté backend
// (routes/hebergementRoutes.js, montées sous /api/hebergement), pas sous
// /api/housekeeping à la racine. Toutes les URLs ci-dessous ont été corrigées
// en conséquence (même remarque que pour reservation.service.ts).
const BASE_URL = '/api/hebergement/housekeeping';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export interface HousekeepingFormData {
  room_id: number;
  assigned_user_id?: number | null;
  type_tache: HousekeepingTask['type_tache'];
  statut?: 'A_FAIRE' | 'EN_COURS' | 'TERMINE';
  commentaire?: string;
  planned_at?: string;
}

export const housekeepingService = {
  // Récupérer toutes les tâches
  getTasks: async (filters?: {
    statut?: string;
    room_id?: number;
    type_tache?: string;
    assigned_user_id?: number;
    planned_at?: string;
  }): Promise<HousekeepingTask[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.statut) params.append('statut', filters.statut);
      if (filters?.room_id) params.append('room_id', String(filters.room_id));
      if (filters?.type_tache) params.append('type_tache', filters.type_tache);
      if (filters?.assigned_user_id) params.append('assigned_user_id', String(filters.assigned_user_id));
      if (filters?.planned_at) params.append('planned_at', filters.planned_at);

      const url = `${BASE_URL}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<ApiResponse<HousekeepingTask[]>>(url);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getTasks:', error);
      throw error;
    }
  },

  // Récupérer une tâche par ID
  getTaskById: async (id: number): Promise<HousekeepingTask> => {
    try {
      const response = await api.get<ApiResponse<HousekeepingTask>>(`${BASE_URL}/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getTaskById ${id}:`, error);
      throw error;
    }
  },

  // Créer une tâche
  createTask: async (data: HousekeepingFormData): Promise<HousekeepingTask> => {
    try {
      const response = await api.post<ApiResponse<HousekeepingTask>>(BASE_URL, data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur createTask:', error);
      throw error;
    }
  },

  // Mettre à jour une tâche
  updateTask: async (id: number, data: Partial<HousekeepingFormData>): Promise<HousekeepingTask> => {
    try {
      const response = await api.put<ApiResponse<HousekeepingTask>>(`${BASE_URL}/${id}`, data);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateTask ${id}:`, error);
      throw error;
    }
  },

  // Mettre à jour le statut d'une tâche
  updateTaskStatus: async (id: number, statut: string, productsUsed?: any[]): Promise<HousekeepingTask> => {
    try {
      const response = await api.put<ApiResponse<HousekeepingTask>>(`${BASE_URL}/${id}/status`, { 
        statut,
        products_used: productsUsed
      });
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateTaskStatus ${id}:`, error);
      throw error;
    }
  },

  // Supprimer une tâche
  deleteTask: async (id: number): Promise<void> => {
    try {
      await api.delete<ApiResponse<void>>(`${BASE_URL}/${id}`);
    } catch (error) {
      console.error(`❌ Erreur deleteTask ${id}:`, error);
      throw error;
    }
  },

  // Statistiques des tâches
  getTaskStats: async (): Promise<any> => {
    try {
      const response = await api.get<ApiResponse<any>>(`${BASE_URL}/stats`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getTaskStats:', error);
      throw error;
    }
  }
};