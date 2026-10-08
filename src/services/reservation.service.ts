import api from '../lib/api';
import { Reservation, ReservationPayment } from '../types/hotel.types';

export type HotelPaymentMethod = 'ESPECES' | 'TPE' | 'MVOLA' | 'ORANGE_MONEY' | 'CARTE' | 'VIREMENT' | 'CREDIT' | 'GRATUIT';

export interface ReservationPaymentInput {
  montant: number;
  modes_paiement: Array<{ moyen_paiement: HotelPaymentMethod; montant: number }>;
  idempotency_key: string;
}

export interface ReservationFormData {
  client_id: number;
  room_id: number;
  date_arrivee: string;
  date_depart: string;
  pdj_inclus?: boolean;
  moyen_paiement?: HotelPaymentMethod;
  montant_total: number;
  remise_pourcentage?: number;
  statut?: 'CONFIRMEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
}

export interface Stay {
  id: number;
  reservation_id: number;
  checkin_at: string | null;
  checkout_at: string | null;
  room_id?: number;
  created_at?: string;
  updated_at?: string;
  invoice?: {
    id: number;
    montant_total: number;
    statut: string;
  } | null;
}

export interface HotelReservationCollectionReport {
  startDate: string;
  endDate: string;
  totalCollected: number;
  paymentMethods: Record<HotelPaymentMethod, number>;
}

export interface SavedHotelReservationReportInput extends HotelReservationCollectionReport {
  reservations: Reservation[];
}

const BASE_URL = '/api/hebergement/reservations';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export const reservationService = {
  getReservations: async (filters?: {
    statut?: string;
    client_id?: number;
    room_id?: number;
    date_arrivee?: string;
    date_depart?: string;
  }): Promise<Reservation[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.statut) params.append('statut', filters.statut);
      if (filters?.client_id) params.append('client_id', String(filters.client_id));
      if (filters?.room_id) params.append('room_id', String(filters.room_id));
      if (filters?.date_arrivee) params.append('date_arrivee', filters.date_arrivee);
      if (filters?.date_depart) params.append('date_depart', filters.date_depart);

      const url = `${BASE_URL}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<ApiResponse<Reservation[]>>(url);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getReservations:', error);
      throw error;
    }
  },

  getReservationById: async (id: number): Promise<Reservation> => {
    try {
      const response = await api.get<ApiResponse<Reservation>>(`${BASE_URL}/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getReservationById ${id}:`, error);
      throw error;
    }
  },

  createReservation: async (data: ReservationFormData): Promise<Reservation> => {
    try {
      const response = await api.post<ApiResponse<Reservation>>(BASE_URL, data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur createReservation:', error);
      throw error;
    }
  },

  // Historique des encaissements (paiement initial + rectifications)
  getReservationPayments: async (id: number): Promise<ReservationPayment[]> => {
    const response = await api.get<ApiResponse<ReservationPayment[]>>(`${BASE_URL}/${id}/payments`);
    return Array.isArray(response.data.data) ? response.data.data : [];
  },

  createReservationPayment: async (id: number, data: ReservationPaymentInput): Promise<any> => {
    const response = await api.post<ApiResponse<any>>(`${BASE_URL}/${id}/payments`, data);
    return response.data.data;
  },

  updateReservation: async (id: number, data: Partial<ReservationFormData>): Promise<Reservation> => {
    try {
      const response = await api.put<ApiResponse<Reservation>>(`${BASE_URL}/${id}`, data);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateReservation ${id}:`, error);
      throw error;
    }
  },

  updateReservationStatus: async (id: number, statut: string, moyen_paiement?: HotelPaymentMethod): Promise<Reservation> => {
    try {
      const response = await api.put<ApiResponse<Reservation>>(`${BASE_URL}/${id}`, { statut, moyen_paiement });
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateReservationStatus ${id}:`, error);
      throw error;
    }
  },

  validateDiscount: async (id: number): Promise<Reservation> => {
    const response = await api.post<ApiResponse<Reservation>>(`${BASE_URL}/${id}/validate-discount`);
    return response.data.data;
  },

  deleteReservation: async (id: number): Promise<void> => {
    try {
      await api.delete<ApiResponse<void>>(`${BASE_URL}/${id}`);
    } catch (error) {
      console.error(`❌ Erreur deleteReservation ${id}:`, error);
      throw error;
    }
  },

  getStays: async (filters?: { reservation_id?: number; room_id?: number; checkin_at?: string; checkout_at?: string }): Promise<Stay[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.reservation_id) params.append('reservation_id', String(filters.reservation_id));
      if (filters?.room_id) params.append('room_id', String(filters.room_id));
      if (filters?.checkin_at) params.append('checkin_at', filters.checkin_at);
      if (filters?.checkout_at) params.append('checkout_at', filters.checkout_at);

      const url = `${BASE_URL.replace('/reservations', '/stays')}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<ApiResponse<Stay[]>>(url);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getStays:', error);
      throw error;
    }
  },

  checkIn: async (reservationId: number): Promise<Stay> => {
    try {
      const response = await api.post<ApiResponse<Stay>>(`${BASE_URL.replace('/reservations', '')}/stays/check-in/${reservationId}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur checkIn ${reservationId}:`, error);
      throw error;
    }
  },

  checkOut: async (stayId: number): Promise<Stay> => {
    try {
      const response = await api.post<ApiResponse<Stay>>(`${BASE_URL.replace('/reservations', '')}/stays/check-out/${stayId}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur checkOut ${stayId}:`, error);
      throw error;
    }
  },

  getReservationStats: async (): Promise<any> => {
    try {
      const response = await api.get<ApiResponse<any>>(`${BASE_URL}/stats`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getReservationStats:', error);
      throw error;
    }
  },

  getHotelReservationCollectionReport: async (
    startDate: string,
    endDate: string
  ): Promise<HotelReservationCollectionReport> => {
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const response = await api.get<ApiResponse<HotelReservationCollectionReport>>(
        `${BASE_URL}/reports/collections?${params.toString()}`
      );
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getHotelReservationCollectionReport:', error);
      throw error;
    }
  },

  saveHotelReservationCollectionReport: async (
    report: SavedHotelReservationReportInput
  ): Promise<{ startDate: string; endDate: string; reservationCount: number }> => {
    try {
      const response = await api.post<ApiResponse<{ startDate: string; endDate: string; reservationCount: number }>>(
        `${BASE_URL}/reports/collections`,
        report
      );
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur saveHotelReservationCollectionReport:', error);
      throw error;
    }
  },
};