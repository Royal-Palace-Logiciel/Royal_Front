import api from '../lib/api';
import type {
  Table,
  Product,
  MenuItem,
  Order,
  Cashier,
  RestaurantStats,
  RestaurantHistoryPayment,
  ApiResponse,
} from '../types/restaurant';

// ==================== TABLES ====================

export const getTables = (params?: { statut?: string; capacite_min?: number }) =>
  api.get<ApiResponse<Table[]>>('/api/restaurant/tables', { params }).then(res => res.data);

export const getTableById = (id: number) =>
  api.get<ApiResponse<Table>>(`/api/restaurant/tables/${id}`).then(res => res.data);

export const createTable = (data: { numero: string; capacite: number; statut?: string }) =>
  api.post<ApiResponse<Table>>('/api/restaurant/tables', data).then(res => res.data);

export const updateTable = (id: number, data: Partial<Table>) =>
  api.put<ApiResponse<Table>>(`/api/restaurant/tables/${id}`, data).then(res => res.data);

export const deleteTable = (id: number) =>
  api.delete<ApiResponse<null>>(`/api/restaurant/tables/${id}`).then(res => res.data);

// ==================== MENU & PRODUITS ====================

export const getMenu = () =>
  api.get<ApiResponse<MenuItem[]>>('/api/restaurant/menu').then(res => res.data);

export const getProducts = (params?: Record<string, any>) => {
  const normalizedParams = { ...params };
  if (normalizedParams.actif !== undefined) {
    normalizedParams.actif = normalizedParams.actif === true || normalizedParams.actif === 'true' ? 1 : 0;
  }
  return api.get<ApiResponse<Product[]>>('/api/restaurant/products', { params: normalizedParams }).then(res => res.data);
};

export const getProductById = (id: number) =>
  api.get<ApiResponse<Product>>(`/api/restaurant/products/${id}`).then(res => res.data);

// Recettes endpoints removed

// ==================== COMMANDES ====================

export const getOrders = (params?: {
  statut?: string;
  client_id?: number;
  date_debut?: string;
  date_fin?: string;
  source_module?: 'RESTAURANT';
}) =>
  api.get<ApiResponse<Order[]>>('/api/restaurant/orders', { params }).then(res => res.data);

export const getOrderById = (id: number) =>
  api.get<ApiResponse<Order>>(`/api/restaurant/orders/${id}`).then(res => res.data);

export const getHistoryTotal = (dateDebut: string, dateFin: string) =>
  api.get<ApiResponse<{
    total_payments: number;
    total_collected: number;
    paid_orders: RestaurantHistoryPayment[];
  }>>('/api/restaurant/orders/history-total', {
    params: { date_debut: dateDebut, date_fin: dateFin },
  }).then(res => res.data);

// Fetch printable invoice HTML as text (uses api client so auth headers are included)
export const getInvoiceHtml = (id: number) =>
  api.get<string>(`/api/restaurant/orders/${id}/invoice`, { responseType: 'text' as const }).then(res => res.data);

export const getInvoicePdf = (id: number) =>
  api.get<ArrayBuffer>(`/api/restaurant/orders/${id}/invoice.pdf`, { responseType: 'arraybuffer' as const }).then(res => res.data);

export const createOrder = (data: {
  client_id?: number;
  table_id?: number;
  items: { product_id: number; quantite: number; prix_unitaire: number; cuisson?: string }[];
  notes?: string;
  location_type?: string;
  special_person_name?: string;
}) =>
  api.post<ApiResponse<Order>>('/api/restaurant/orders', data).then(res => res.data);

export const updateOrder = (id: number, data: {
  client_id?: number;
  table_id?: number;
  items: { product_id: number; quantite: number; prix_unitaire: number; cuisson?: string }[];
  notes?: string;
  location_type?: string;
  special_person_name?: string;
}) => api.put<ApiResponse<Order>>(`/api/restaurant/orders/${id}`, data).then(res => res.data);

export const updateOrderStatus = (id: number, statut: string) =>
  api.put<ApiResponse<Order>>(`/api/restaurant/orders/${id}/status`, { statut }).then(res => res.data);

export const deleteOrder = (id: number) =>
  api.delete<ApiResponse<null>>(`/api/restaurant/orders/${id}`).then(res => res.data);

export const closeAllOrders = (order_ids: number[]) =>
  api.post<ApiResponse<{ closed_orders: number; hidden_from_daily_caisse: boolean }>>('/api/restaurant/orders/close-all', { order_ids }).then(res => res.data);

// ==================== PAIEMENTS ====================

export const processPayment = (data: {
  order_id: number;
  montant: number;
  moyen_paiement: string;
  client_id?: number;
}) =>
  api.post<ApiResponse<{ payment_id: number }>>('/api/restaurant/payments', data).then(res => res.data);

export const billToRoom = (data: { order_id: number; room_id: number }) =>
  api.post<ApiResponse<{ invoice_id: number }>>('/api/restaurant/bill-to-room', data).then(res => res.data);

// ==================== CAISSE ====================

export const openCashier = (data: { nom: string; user_id: number; fond_initial: number }) =>
  api.post<ApiResponse<{ cashier_id: number; session_id: number }>>('/api/restaurant/cashier/open', data).then(res => res.data);

export const closeCashier = (data: { session_id: number; fond_final: number }) =>
  api.post<ApiResponse<null>>('/api/restaurant/cashier/close', data).then(res => res.data);

export const getCashierStatus = () =>
  api.get<ApiResponse<Cashier[]>>('/api/restaurant/cashier/status').then(res => res.data);

// ==================== REPORTING ====================

export type RestaurantDailyReport = {
  id: number;
  reportDate: string;
  personnel: Record<string, string>;
  manual: Record<string, string>;
  metrics: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
};

export const getRestaurantDailyReport = (date: string) =>
  api.get<ApiResponse<RestaurantDailyReport | null>>(`/api/restaurant/reports/${date}`).then(res => res.data.data ?? null);

export const saveRestaurantDailyReport = (data: Omit<RestaurantDailyReport, 'id' | 'createdAt' | 'updatedAt'>) =>
  api.post<ApiResponse<RestaurantDailyReport>>('/api/restaurant/reports', data).then(res => res.data.data);

export const getStats = (params: { date_debut: string; date_fin: string }) =>
  api.get<ApiResponse<RestaurantStats>>('/api/restaurant/stats', { params }).then(res => res.data);

// ==================== STOCK ====================
export const getStockLocations = () =>
  api.get('/api/restaurant/stock/locations').then(res => res.data);

export const getStocks = (params?: Record<string, any>) =>
  api.get('/api/restaurant/stock', { params }).then(res => res.data);

export const getStockMovements = (params?: Record<string, any>) =>
  api.get('/api/restaurant/stock/movements', { params }).then(res => res.data);

export const adjustStock = (data: {
  product_id: number;
  location_id: number;
  type_mouvement: 'ENTREE' | 'SORTIE';
  quantite: number;
  source_module?: string;
  reference_id?: number;
  commentaire?: string;
}) =>
  api.post('/api/restaurant/stock/adjust', data).then(res => res.data);

export const consumePortion = (data: {
  product_id: number;
  location_id: number;
  portion_size: number;
  portion_unit?: string;
  reference_id?: number;
}) =>
  api.post('/api/restaurant/stock/consume-portion', data).then(res => res.data);

export const deleteStockItem = (stockIdOrFilter: number | { product_id?: number; location_id?: number }) => {
  // Use the restaurant-scoped delete endpoint which supports deletion by id
  // or by product_id + location_id pair (convenient for the restaurant UI).
  if (typeof stockIdOrFilter === 'number') {
    return api.delete('/api/restaurant/stock', { params: { id: stockIdOrFilter } }).then(res => {
      if (res.status === 204) return { success: true };
      return res.data || { success: true };
    });
  }
  const { product_id, location_id } = stockIdOrFilter || {};
  return api.delete('/api/restaurant/stock', { params: { product_id, location_id } }).then(res => {
    if (res.status === 204) return { success: true };
    return res.data || { success: true };
  });
};

export const createProduct = (data: {
  nom: string;
  unite: string;
  type_produit?: string;
  prix_achat?: number;
  prix_vente?: number;
  category_id?: number;
  subcategory_id?: number;
  portion_size?: number;
  portion_unite?: string;
}) =>
  api.post('/api/restaurant/products', data).then(res => res.data);

export const getNextRestaurantProductCode = () =>
  api.get<ApiResponse<{ code: string }>>('/api/restaurant/products/next-code').then(res => res.data);

// ==================== PRODUITS ====================
export const updateProduct = (id: number, data: Partial<{
  nom: string; unite: string; prix_achat: number; prix_vente: number;
  actif: boolean; type_produit: string; category_id: number;
}>) =>
  api.put(`/api/restaurant/products/${id}`, data).then(res => res.data);

export const deleteProduct = (id: number) =>
  api.delete(`/api/restaurant/products/${id}`).then(res => res.data);



// ==================== FOURNISSEURS ====================
export const getSuppliers = () =>
  api.get('/api/restaurant/suppliers').then(res => res.data);

export const createSupplier = (data: { nom: string; telephone?: string; email?: string }) =>
  api.post('/api/restaurant/suppliers', data).then(res => res.data);

// ==================== ACHATS ====================
export const getPurchases = () =>
  api.get('/api/restaurant/purchases').then(res => res.data);

export const getPurchaseById = (id: number) =>
  api.get(`/api/restaurant/purchases/${id}`).then(res => res.data);

export const createPurchase = (data: {
  supplier_id: number;
  items: { product_id: number; location_id: number; quantite: number; prix_unitaire: number }[];
}) =>
  api.post('/api/restaurant/purchases', data).then(res => res.data);

// Recettes endpoints removed

// ==================== UNITÉS ====================
export const getUnits = () =>
  api.get('/api/restaurant/units').then(res => res.data);

// ==================== TYPES DE PRODUITS ====================
export const getProductTypes = () =>
  api.get('/api/restaurant/product-types').then(res => res.data);

// ==================== CATÉGORIES ====================
export const getCategories = () =>
  api.get('/api/restaurant/categories').then(res => res.data);

export const createCategory = (data: { nom: string }) =>
  api.post<ApiResponse<{ id: number; nom: string }>>('/api/restaurant/categories', data).then(res => res.data);

// ==================== SOUS-CATÉGORIES ====================
export const getSubcategories = (params?: { category_id?: number }) =>
  api.get('/api/restaurant/subcategories', { params }).then(res => res.data);

export const createSubcategory = (data: { category_id: number; nom: string }) =>
  api.post('/api/restaurant/subcategories', data).then(res => res.data);

export const updateSubcategory = (id: number, data: { category_id?: number; nom?: string }) =>
  api.put(`/api/restaurant/subcategories/${id}`, data).then(res => res.data);

export const deleteSubcategory = (id: number) =>
  api.delete(`/api/restaurant/subcategories/${id}`).then(res => res.data);

// ==================== INVENTAIRE ====================

export interface ProductHistoryItem {
  date_vente: string;
  product_id: number;
  produit: string;
  categorie: string;
  quantite_totale: number;
  montant_total: number;
  nb_commandes: number;
}

export const getProductHistory = (params: { dateFrom?: string; dateTo?: string; productName?: string }) =>
  api.get<ApiResponse<ProductHistoryItem[]>>('/api/restaurant/product-history', { params }).then(res => res.data);