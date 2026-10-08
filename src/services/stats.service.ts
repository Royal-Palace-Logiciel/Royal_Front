// src/services/stats.service.ts
import api from '../lib/api';

export interface HotelStats {
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  totalReservations: number;
  activeReservations: number;
  totalMaintenance: number;
  openMaintenance: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

export interface MinibarStats {
  totalItems: number;
  totalRoomsEquipped: number;
  alerts: number;
  totalConsumptions: number;
  monthlyConsumptions: number;
}

export const statsService = {
  // Récupérer les statistiques de l'hôtel
  async getHotelStats(): Promise<HotelStats> {
    try {
      const response = await api.get('/api/hotel/stats');
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getHotelStats:', error);
      // Fallback avec des données mockées
      return {
        totalRooms: 0,
        occupiedRooms: 0,
        availableRooms: 0,
        totalReservations: 0,
        activeReservations: 0,
        totalMaintenance: 0,
        openMaintenance: 0,
        totalRevenue: 0,
        monthlyRevenue: 0
      };
    }
  },

  // Récupérer les statistiques du minibar
  async getMinibarStats(): Promise<MinibarStats> {
    try {
      // Note: Minibar stats endpoint doesn't exist on backend
      // This service method relies on error fallback
      const response = await api.get('/api/hebergement/room-minibar');
      const items = response.data.data || [];
      const uniqueRooms = new Set(items.map((i: any) => i.room_id));
      const alerts = items.filter((i: any) => i.quantite <= (i.seuil_alerte || 1)).length;
      
      return {
        totalItems: items.length,
        totalRoomsEquipped: uniqueRooms.size,
        alerts: alerts,
        totalConsumptions: 0,
        monthlyConsumptions: 0
      };
    } catch (error) {
      console.error('❌ Erreur getMinibarStats:', error);
      return {
        totalItems: 0,
        totalRoomsEquipped: 0,
        alerts: 0,
        totalConsumptions: 0,
        monthlyConsumptions: 0
      };
    }
  },

  // Récupérer les revenus
  async getRevenueStats() {
    try {
      const response = await api.get('/api/reservations/revenue');
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getRevenueStats:', error);
      return {
        total: 0,
        monthly: 0,
        daily: 0
      };
    }
  }
};