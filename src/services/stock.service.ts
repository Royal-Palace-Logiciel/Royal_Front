// src/services/stock.service.ts
import api from '../lib/api';

export interface StockLocation {
  id: number;
  nom: string;
}

export interface StockItem {
  id: number;
  product_id: number;
  location_id: number;
  quantite: number;
  product?: {
    id: number;
    nom: string;
    code?: string;
    prix_vente?: number;
  };
  location?: StockLocation;
}

export const stockService = {
  // Get all stock locations
  async getLocations(): Promise<StockLocation[]> {
    const response = await api.get('/api/stock/locations');
    return response.data?.data || response.data || [];
  },

  // Get stock by location
  async getByLocation(locationId: number): Promise<StockItem[]> {
    const response = await api.get(`/api/stock/stocks?location_id=${locationId}`);
    return response.data?.data || response.data || [];
  },

  // Get stock by product
  async getByProduct(productId: number): Promise<StockItem[]> {
    const response = await api.get(`/api/stock/products/${productId}/stock`);
    return response.data?.data || response.data || [];
  },

  // Get hotel stock (location_id = 5)
  async getHotelStock(): Promise<StockItem[]> {
    return this.getByLocation(5);
  },

  // Record stock movement
  async recordMovement(data: {
    product_id: number;
    location_id: number;
    type: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
    quantite: number;
    source_module?: string;
    reference_id?: number;
  }) {
    const response = await api.post('/api/stock/movements', data);
    return response.data;
  },

  // Create a supplier purchase for the selected module. The financial report
  // values the stock currently available in that module as its outflow.
  async createPurchase(data: {
    supplier_id: number;
    location_id: number;
    source_module: 'HEBERGEMENT' | 'HOTEL' | 'RESTAURANT' | 'BAR' | 'CASINO' | 'GENERAL';
    items: Array<{ product_id: number; quantite: number; prix_unitaire: number }>;
  }) {
    const response = await api.post('/api/stock/purchases', data);
    return response.data?.data || response.data;
  },

  // Get stock movements
  async getMovements(filters?: {
    product_id?: number;
    location_id?: number;
    type?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.product_id) params.append('product_id', filters.product_id.toString());
    if (filters?.location_id) params.append('location_id', filters.location_id.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);

    const response = await api.get(`/api/stock/movements${params.toString() ? `?${params.toString()}` : ''}`);
    return response.data?.data || response.data || [];
  },
};
