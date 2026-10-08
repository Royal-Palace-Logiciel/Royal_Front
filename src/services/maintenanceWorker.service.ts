import api from '../lib/api';
import { MaintenanceWorker } from '../types/hotel.types';

interface ApiResponse<T> { success: boolean; data: T; }

export interface MaintenanceWorkerFormData {
  nom: string;
  prenom?: string;
  telephone?: string;
  email?: string;
  specialite?: string;
  date_debut?: string;
  date_fin?: string;
  statut?: 'ACTIF' | 'INACTIF';
  photo_url?: string;
  id_photo_url?: string;
  contract_url?: string;
  quote_url?: string;
  time_slot?: string;
}

const BASE_URL = '/api/hebergement/maintenance-workers';

export const maintenanceWorkerService = {
  getWorkers: async (): Promise<MaintenanceWorker[]> => (await api.get<ApiResponse<MaintenanceWorker[]>>(BASE_URL)).data.data,
  createWorker: async (data: MaintenanceWorkerFormData): Promise<MaintenanceWorker> => (await api.post<ApiResponse<MaintenanceWorker>>(BASE_URL, data)).data.data,
  updateWorker: async (id: number, data: Partial<MaintenanceWorkerFormData>): Promise<MaintenanceWorker> => (await api.put<ApiResponse<MaintenanceWorker>>(`${BASE_URL}/${id}`, data)).data.data,
  deleteWorker: async (id: number): Promise<void> => { await api.delete(`${BASE_URL}/${id}`); },
};
