import api from '../lib/api';
import { Equipment, RoomEquipment } from '../types/hotel.types';

export interface EquipmentFormData {
  code?: string;
  nom: string;
  categorie?: string;
  description?: string;
  zone?: 'CHAMBRE' | 'SALLE_DE_BAIN';
  quantite?: number;
  is_consumable?: boolean;
}

export interface RoomEquipmentFormData {
  room_id: number;
  equipment_id: number;
  quantite: number;
  statut?: 'BON' | 'EN_PANNE' | 'REMPLACE' | 'HORS_SERVICE';
  zone?: 'CHAMBRE' | 'SALLE_DE_BAIN';
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

// Toutes ci-dessous sont montées sous /api/hebergement (voir README §5.5)
const BASE_URL = '/api/hebergement';

export const equipmentService = {
  // =============================================
  // Équipements
  // =============================================

  // Récupérer tous les équipements
  getEquipments: async (filters?: { categorie?: string; nom?: string; code?: string }): Promise<Equipment[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.categorie) params.append('categorie', filters.categorie);
      if (filters?.nom) params.append('nom', filters.nom);
      if (filters?.code) params.append('code', filters.code);

      const url = `${BASE_URL}/equipments${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<ApiResponse<Equipment[]>>(url);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getEquipments:', error);
      throw error;
    }
  },

  // Récupérer un équipement par ID
  getEquipmentById: async (id: number): Promise<Equipment> => {
    try {
      const response = await api.get<ApiResponse<Equipment>>(`${BASE_URL}/equipments/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getEquipmentById ${id}:`, error);
      throw error;
    }
  },

  // Récupérer un équipement par code
  // ⚠️ Route custom non couverte par le CRUD générique — à ajouter côté backend
  // (voir controllers/hebergementController.js -> equipmentController.getByCode)
  getEquipmentByCode: async (code: string): Promise<Equipment> => {
    try {
      const response = await api.get<ApiResponse<Equipment>>(`${BASE_URL}/equipments/code/${code}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getEquipmentByCode ${code}:`, error);
      throw error;
    }
  },

  // Récupérer les catégories
  // ⚠️ Route custom non couverte par le CRUD générique — à ajouter côté backend
  getEquipmentCategories: async (): Promise<string[]> => {
    try {
      const response = await api.get<ApiResponse<string[]>>(`${BASE_URL}/equipments/categories`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getEquipmentCategories:', error);
      throw error;
    }
  },

  // Créer un équipement
  createEquipment: async (data: EquipmentFormData): Promise<Equipment> => {
    try {
      const response = await api.post<ApiResponse<Equipment>>(`${BASE_URL}/equipments`, data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur createEquipment:', error);
      throw error;
    }
  },

  // Mettre à jour un équipement
  updateEquipment: async (id: number, data: EquipmentFormData): Promise<Equipment> => {
    try {
      const response = await api.put<ApiResponse<Equipment>>(`${BASE_URL}/equipments/${id}`, data);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateEquipment ${id}:`, error);
      throw error;
    }
  },

  // Supprimer un équipement
  deleteEquipment: async (id: number): Promise<void> => {
    try {
      await api.delete<ApiResponse<void>>(`${BASE_URL}/equipments/${id}`);
    } catch (error) {
      console.error(`❌ Erreur deleteEquipment ${id}:`, error);
      throw error;
    }
  },

  // Statistiques des équipements
  // ⚠️ Route custom non couverte par le CRUD générique — à ajouter côté backend
  getEquipmentStats: async (): Promise<any> => {
    try {
      const response = await api.get<ApiResponse<any>>(`${BASE_URL}/equipments/stats`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getEquipmentStats:', error);
      throw error;
    }
  },

  // =============================================
  // Équipements de chambre (RoomEquipment)
  // =============================================

  // Récupérer tous les équipements de chambre
  getRoomEquipments: async (filters?: { room_id?: number; equipment_id?: number; zone?: string }): Promise<RoomEquipment[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.room_id) params.append('room_id', String(filters.room_id));
      if (filters?.equipment_id) params.append('equipment_id', String(filters.equipment_id));
      if (filters?.zone) params.append('zone', filters.zone);

      const url = `${BASE_URL}/room-equipments${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<ApiResponse<RoomEquipment[]>>(url);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getRoomEquipments:', error);
      throw error;
    }
  },

  // Assigner un équipement à une chambre
  assignEquipment: async (data: RoomEquipmentFormData): Promise<RoomEquipment> => {
    try {
      const response = await api.post<ApiResponse<RoomEquipment>>(`${BASE_URL}/room-equipments`, data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur assignEquipment:', error);
      throw error;
    }
  },

  // Mettre à jour un équipement de chambre
  updateRoomEquipment: async (id: number, data: Partial<RoomEquipmentFormData>): Promise<RoomEquipment> => {
    try {
      const response = await api.put<ApiResponse<RoomEquipment>>(`${BASE_URL}/room-equipments/${id}`, data);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateRoomEquipment ${id}:`, error);
      throw error;
    }
  },

  // Supprimer un équipement de chambre
  deleteRoomEquipment: async (id: number): Promise<void> => {
    try {
      await api.delete<ApiResponse<void>>(`${BASE_URL}/room-equipments/${id}`);
    } catch (error) {
      console.error(`❌ Erreur deleteRoomEquipment ${id}:`, error);
      throw error;
    }
  },

  // Mettre à jour le statut d'un équipement de chambre
  updateRoomEquipmentStatus: async (id: number, statut: string): Promise<RoomEquipment> => {
    try {
      const response = await api.put<ApiResponse<RoomEquipment>>(`${BASE_URL}/room-equipments/${id}/status`, { statut });
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateRoomEquipmentStatus ${id}:`, error);
      throw error;
    }
  }
};