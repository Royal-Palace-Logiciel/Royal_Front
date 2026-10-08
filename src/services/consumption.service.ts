// src/services/consumption.service.ts
import api from '../lib/api';
import { minibarService } from './minibar.service';

export const consumptionService = {
  // Récupérer les consommations d'une chambre
  async getByRoom(roomId: number) {
    // ✅ CORRECTION: Use the correct backend endpoint with filter parameter
    const response = await api.get(`/api/hebergement/minibar-consumptions?room_id=${roomId}`);
    return response.data;
  },

  // Créer une consommation with stock integration
  async create(data: { 
    room_id: number; 
    client_id: number; 
    product_id: number; 
    quantite: number; 
    prix_unitaire: number;
  }) {
    // ✅ ENHANCEMENT: Use the new stock-integrated consumption endpoint
    // The integrated endpoint creates the HOTEL / ENTREE ledger movement.
    // Falling back to the generic CRUD endpoint silently drops that movement.
    return minibarService.consumeWithStock({
      room_id: data.room_id,
      client_id: data.client_id,
      product_id: data.product_id,
      quantity: data.quantite,
      price: data.prix_unitaire,
    });
  },

  // Marquer comme facturée
  async markAsBilled(id: number) {
    // ✅ CORRECTION: Use the correct backend endpoint with PUT/UPDATE
    const response = await api.put(`/api/hebergement/minibar-consumptions/${id}`, { facturee: 1 });
    return response.data;
  },
};
