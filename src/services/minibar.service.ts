// src/services/minibar.service.ts
import api from '../lib/api';

export const minibarService = {
  // Récupérer tous les minibars
  async getAll(filters?: { room_id?: number; product_id?: number; seuil_alerte?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.room_id) params.append('room_id', filters.room_id.toString());
    if (filters?.product_id) params.append('product_id', filters.product_id.toString());
    if (filters?.seuil_alerte) params.append('seuil_alerte', 'true');
    
    // Fix: Use correct backend endpoint
    const response = await api.get(`/api/hebergement/room-minibar${params.toString() ? `?${params.toString()}` : ''}`);
    return response.data;
  },

  // Récupérer les statistiques - calculated client-side from getAll data
  async getStats() {
    // Fix: Remove stats endpoint - calculate from getAll data instead
    // This will be handled by the component after calling getAll
    return { data: { total_produits: 0, chambres_equipees: 0 } };
  },

  // Récupérer le minibar d'une chambre
  async getByRoom(roomId: number) {
    // Fix: Use filter parameter on existing endpoint
    const response = await api.get(`/api/hebergement/room-minibar?room_id=${roomId}`);
    return response.data;
  },

  // Créer un minibar item
  async create(data: { room_id: number; product_id: number; quantite: number; seuil_alerte: number }) {
    const response = await api.post('/api/hebergement/room-minibar', data);
    return response.data;
  },

  // Mettre à jour la quantité
  async updateQuantity(id: number, quantite: number) {
    // Fix: Use PUT with quantite in body
    const response = await api.put(`/api/hebergement/room-minibar/${id}`, { quantite });
    return response.data;
  },

  // Supprimer un produit
  async delete(id: number) {
    // Fix: Use correct endpoint path
    const response = await api.delete(`/api/hebergement/room-minibar/${id}`);
    return response.data;
  },

  // --- Stock Management Methods ---

  // Transfer stock from source location (restaurant/bar) to hotel minibar location
  async transferStock(data: { 
    product_id: number; 
    source_location_id: number; 
    quantity: number; 
    room_id: number;
  }) {
    const response = await api.post('/api/hebergement/minibar/transfer-stock', data);
    return response.data;
  },

  // Handle minibar consumption with stock movement tracking
  async consumeWithStock(data: {
    room_id: number;
    product_id: number;
    quantity: number;
    client_id: number;
    price: number;
  }) {
    const response = await api.post('/api/hebergement/minibar/consume', data);
    return response.data;
  },

  // Get minibar items with low stock alerts
  async getWithAlerts() {
    const response = await api.get('/api/hebergement/minibar/alerts');
    return response.data;
  },

  // Get only low stock minibar items for notifications
  async getLowStockItems() {
    const response = await api.get('/api/hebergement/minibar/low-stock');
    return response.data;
  },

  // Restock minibar from hotel stock location
  async restock(data: {
    room_id: number;
    product_id: number;
    quantity: number;
  }) {
    const response = await api.post('/api/hebergement/minibar/restock', data);
    return response.data;
  },
};