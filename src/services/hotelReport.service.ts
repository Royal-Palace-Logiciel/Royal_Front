// src/services/hotelReport.service.ts
//
// Rapport journalier de l'hôtel (« Situation du chambre durant la Nuité »).
// Comme housekeeping/maintenance, les routes vivent sous le domaine
// « hébergement » côté backend : /api/hebergement/daily-reports.
import api from '../lib/api';
import { HotelDailyReport } from '../types/hotel.types';

const BASE_URL = '/api/hebergement/daily-reports';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export type HotelDailyReportPayload = Pick<
  HotelDailyReport,
  | 'reportDate'
  | 'heureDebut'
  | 'heureFin'
  | 'receptionniste'
  | 'rooms'
  | 'observations'
  | 'metrics'
  | 'autoState'
>;

export const hotelReportService = {
  /** Rapport d'une date donnée, ou null s'il n'a jamais été enregistré. */
  getReport: async (date: string): Promise<HotelDailyReport | null> => {
    try {
      const response = await api.get<ApiResponse<HotelDailyReport | null>>(`${BASE_URL}/${date}`);
      return response.data.data ?? null;
    } catch (error) {
      console.error(`❌ Erreur getReport ${date}:`, error);
      throw error;
    }
  },

  /** Historique des rapports, du plus récent au plus ancien. */
  listReports: async (filters?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<HotelDailyReport[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('start_date', filters.startDate);
      if (filters?.endDate) params.append('end_date', filters.endDate);
      if (filters?.limit) params.append('limit', String(filters.limit));

      const url = `${BASE_URL}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<ApiResponse<HotelDailyReport[]>>(url);
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Erreur listReports:', error);
      throw error;
    }
  },

  /** Crée ou remplace le rapport de la date fournie. */
  saveReport: async (payload: HotelDailyReportPayload): Promise<HotelDailyReport> => {
    try {
      const response = await api.post<ApiResponse<HotelDailyReport>>(BASE_URL, payload);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur saveReport:', error);
      throw error;
    }
  },

  /** Suppression réservée à l'administrateur. */
  deleteReport: async (date: string): Promise<void> => {
    try {
      await api.delete<ApiResponse<unknown>>(`${BASE_URL}/${date}`);
    } catch (error) {
      console.error(`❌ Erreur deleteReport ${date}:`, error);
      throw error;
    }
  },
};

// --- Envoi WhatsApp ---

export interface WhatsappRecipient {
  id: number;
  /** Numéro international, ou jid de groupe (…@g.us). */
  numero: string;
  type: 'NUMERO' | 'GROUPE';
  nom: string;
  actif: boolean;
  createdAt?: string;
}

export interface WhatsappGroup {
  id: string;
  nom: string;
}

export interface WhatsappSession {
  transport: 'web' | 'cloud';
  /** STOPPED | STARTING | QR | AUTHENTICATED | READY | ERROR | INACTIF */
  statut: string;
  /** Chaîne brute du QR, à rendre en image côté navigateur. */
  qr?: string | null;
  qrGeneratedAt?: string | null;
  numero?: string | null;
  erreur?: string | null;
  readyAt?: string | null;
}

export interface WhatsappSend {
  id: number;
  reportDate: string;
  contentHash: string;
  statut: 'ENVOYE' | 'PARTIEL' | 'ECHEC';
  destinataires: Array<{ numero: string; nom?: string | null; ok: boolean; messages: number; erreur?: string }>;
  erreur: string | null;
  declencheur: 'AUTO' | 'MANUEL';
  sentAt: string;
}

export interface WhatsappStatus {
  reportDate: string;
  /** La boucle d'envoi tourne côté serveur. */
  actif: boolean;
  /** Les identifiants Meta sont présents côté serveur. */
  configure: boolean;
  intervalleMinutes: number;
  destinataires: WhatsappRecipient[];
  dernierEnvoi: WhatsappSend | null;
  /** Pourquoi le prochain envoi partira — ou ne partira pas. */
  prochaineDecision: string | null;
  envoiPossible: boolean;
}

export const hotelReportWhatsappService = {
  getStatus: async (date?: string): Promise<WhatsappStatus> => {
    const url = `${BASE_URL}/whatsapp/status${date ? `?date=${date}` : ''}`;
    const response = await api.get<ApiResponse<WhatsappStatus>>(url);
    return response.data.data;
  },

  getHistory: async (date?: string): Promise<WhatsappSend[]> => {
    const url = `${BASE_URL}/whatsapp/history${date ? `?date=${date}` : ''}`;
    const response = await api.get<ApiResponse<WhatsappSend[]>>(url);
    return response.data.data || [];
  },

  addRecipient: async (numero: string, nom?: string, type: 'NUMERO' | 'GROUPE' = 'NUMERO'): Promise<WhatsappRecipient> => {
    const response = await api.post<ApiResponse<WhatsappRecipient>>(`${BASE_URL}/whatsapp/recipients`, { numero, nom, type });
    return response.data.data;
  },

  /** État de la session WhatsApp Web (QR à scanner, compte rattaché…). */
  getSession: async (): Promise<WhatsappSession> => {
    const response = await api.get<ApiResponse<WhatsappSession>>(`${BASE_URL}/whatsapp/session`);
    return response.data.data;
  },

  connectSession: async (): Promise<WhatsappSession> => {
    const response = await api.post<ApiResponse<WhatsappSession>>(`${BASE_URL}/whatsapp/session`, {});
    return response.data.data;
  },

  disconnectSession: async (logout = false): Promise<WhatsappSession> => {
    const response = await api.delete<ApiResponse<WhatsappSession>>(`${BASE_URL}/whatsapp/session?logout=${logout}`);
    return response.data.data;
  },

  listGroups: async (): Promise<WhatsappGroup[]> => {
    const response = await api.get<ApiResponse<WhatsappGroup[]>>(`${BASE_URL}/whatsapp/groups`);
    return response.data.data || [];
  },

  setRecipientActive: async (id: number, actif: boolean): Promise<WhatsappRecipient> => {
    const response = await api.put<ApiResponse<WhatsappRecipient>>(`${BASE_URL}/whatsapp/recipients/${id}`, { actif });
    return response.data.data;
  },

  removeRecipient: async (id: number): Promise<void> => {
    await api.delete<ApiResponse<unknown>>(`${BASE_URL}/whatsapp/recipients/${id}`);
  },

  sendNow: async (date?: string): Promise<{ statut: string }> => {
    const response = await api.post<ApiResponse<{ statut: string }>>(`${BASE_URL}/whatsapp/send`, { date });
    return response.data.data;
  },
};

export default hotelReportService;
