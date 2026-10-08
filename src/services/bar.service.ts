import api from '../lib/api';
import type {
  BarTable,
  BarCashier,
  BarSession,
  BarProduct,
  BarStockItem,
  BarPaymentMethod,
  ProductHistoryItem,
  BarEquipment,
} from '../types/bar.type';

const BASE = '/api/bar';

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<T>(`${BASE}${path}`, params ? { params } : undefined);
  return data;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await api.post<T>(`${BASE}${path}`, body);
  return data;
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await api.put<T>(`${BASE}${path}`, body);
  return data;
}

async function remove<T>(path: string): Promise<T> {
  const { data } = await api.delete<T>(`${BASE}${path}`);
  return data;
}

// ==================== TABLES ====================

export const getBarTables = () => get<BarTable[]>('/tables');
export const getBarTableById = (id: number) => get<BarTable>(`/tables/${id}`);
export const createBarTable = (data: { numero: string; capacite: number }) =>
  post<BarTable>('/tables', data);
export const updateBarTable = (id: number, data: Partial<BarTable>) =>
  put<BarTable>(`/tables/${id}`, data);
export const deleteBarTable = (id: number) => remove<null>(`/tables/${id}`);
export const getBarTablesStats = () => get<{ total_tables: number; capacite_totale: number; libres: number; occupees: number; reservees: number; en_cours: number }>('/tables/stats');

// ==================== CASHIERS ====================

export const getBarCashiers = () => get<BarCashier[]>('/cashiers');
export const getBarCashierById = (id: number) => get<BarCashier>(`/cashiers/${id}`);
export const createBarCashier = (data: { nom: string }) => post<BarCashier>('/cashiers', data);
export const updateBarCashier = (id: number, data: Partial<BarCashier>) =>
  put<BarCashier>(`/cashiers/${id}`, data);
export const deleteBarCashier = (id: number) => remove<null>(`/cashiers/${id}`);

// ==================== SESSIONS ====================

export const openBarSession = (data: { cashier_id: number; user_id: number; fond_initial: number }) =>
  post<{ session_id: number; session: BarSession }>('/sessions/open', data);
export const closeBarSession = (data: { session_id: number; fond_final: number }) =>
  post<null>('/sessions/close', data);
export const getBarSessions = () => get<BarSession[]>('/sessions');
export const getBarSessionById = (id: number) => get<BarSession>(`/sessions/${id}`);
export const getBarOpenSessions = (cashier_id?: number) =>
  get<BarSession[]>('/sessions/open', cashier_id ? { cashier_id } : undefined);
export const getBarSessionStats = () => get<{ total_sessions: number; sessions_ouvertes: number }>('/sessions/stats');
export const getBarCashierStatus = () => get<BarCashier[]>('/cashier-status');

// ==================== PRODUCTS ====================

export const getBarProducts = () => get<BarProduct[]>('/products');
export const getBarProductById = (id: number) => get<BarProduct>(`/products/${id}`);

export const createBarProduct = (data: { 
  nom: string; 
  categorie: string; 
  prix: number; 
  alcool: boolean; 
  quantite: number; 
  seuil_minimum: number; 
  unite: string; 
}) => post<BarProduct>('/products', data);

export const updateBarProduct = (id: number, data: Partial<BarProduct>) =>
  put<BarProduct>(`/products/${id}`, data);
export const deleteBarProduct = (id: number) => remove<null>(`/products/${id}`);
// ==================== EQUIPMENT ====================

export type BarEquipmentPayload = Omit<BarEquipment, 'id' | 'created_at' | 'updated_at'>;
export const getBarEquipments = () => get<BarEquipment[] | { data?: BarEquipment[] }>('/equipments');
export const createBarEquipment = (data: BarEquipmentPayload) => post<BarEquipment>('/equipments', data);
export const updateBarEquipment = (id: number, data: BarEquipmentPayload) => put<BarEquipment>(`/equipments/${id}`, data);
export const deleteBarEquipment = (id: number) => remove<null>(`/equipments/${id}`);

// ==================== STOCK ====================

export const getBarStock = () => get<BarStockItem[]>('/stock');

export const updateBarStock = (id: number, data: { quantite?: number }) =>
  put<BarStockItem>(`/stock/${id}`, data);

export const addBarTransaction = (data: { session_id?: number; product_id: number; quantite: number; prix_unitaire: number }) =>
  post<{ id: number }>('/transactions', data);

export const getBarLatestTransaction = (productId: number) =>
  get<{ id: number; product_id: number; quantite: number; prix_unitaire: number; montant: number; created_at: string }>(`/transactions/latest?product_id=${productId}`);

export const getBarTransactions = () =>
  get<{ id: number; order_id?: number | null; table_id?: number | null; product_id: number; quantite: number; prix_unitaire: number; montant: number; created_at: string; nom: string; categorie: string }[]>('/transactions');

type BarOrderResponse = { id: number; client: string; table: number; nombre_personnes?: number; moyen_paiement?: BarPaymentMethod; observation?: string; statut: string; total: number; created_at?: string; cloture_at?: string; hotel_reservation_id?: number | null; room_id?: number | null; room_guest_name?: string | null; room_account_paid?: boolean; items: Array<{ nom: string; quantite: number; prix: number }> };
export type BarOrderStatus = 'EN_ATTENTE' | 'EN_PREPARATION' | 'PRETE' | 'SERVIE' | 'ENCAISSEE';

export const getBarOrders = async () => {
  const response = await get<BarOrderResponse[] | { data?: BarOrderResponse[] }>('/orders');
  return Array.isArray(response) ? response : response.data ?? [];
};
export const getBarHistory = async () => {
  const response = await get<BarOrderResponse[] | { data?: BarOrderResponse[] }>('/history');
  return Array.isArray(response) ? response : response.data ?? [];
};
export type BarDailyReport = {
  id: number;
  reportDate: string;
  personnel: Record<string, string>;
  manual: Record<string, string>;
  metrics: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};
export const getBarDailyReport = async (date: string): Promise<BarDailyReport | null> => {
  const response = await get<BarDailyReport | null | { data?: BarDailyReport | null }>(`/reports/${date}`);
  if (response && typeof response === 'object' && 'data' in response) return response.data ?? null;
  return response as BarDailyReport | null;
};
export const saveBarDailyReport = async (data: Omit<BarDailyReport, 'id' | 'createdAt' | 'updatedAt'>) => {
  const response = await post<BarDailyReport | { data?: BarDailyReport }>('/reports', data);
  return response && typeof response === 'object' && 'data' in response ? response.data : response;
};
export const createBarOrder = (data: { client: string; table: number; nombre_personnes: number; moyen_paiement: BarPaymentMethod; observation?: string; items: Array<{ product_id?: number; nom: string; quantite: number; prix: number; prix_unitaire?: number }>; hotel_reservation_id?: number | null; room_id?: number | null; room_guest_name?: string | null; room_account_paid?: boolean }) =>
  post<{ id: number; client: string; table: number; statut: string; total: number; items: Array<{ nom: string; quantite: number; prix: number }> }>('/orders', data);
export const updateBarOrder = (id: number, data: { client?: string; table: number; nombre_personnes: number; moyen_paiement: BarPaymentMethod; observation?: string; items: Array<{ product_id?: number; nom: string; quantite: number; prix: number; prix_unitaire?: number }>; hotel_reservation_id?: number | null; room_id?: number | null; room_guest_name?: string | null; room_account_paid?: boolean }) =>
  put<BarOrderResponse>(`/orders/${id}`, data);
export const deleteBarOrder = (id: number) => remove<{ message: string }>('/orders/' + id);
export const closeAllBarOrders = (order_ids: number[]) => post<{ closed_orders: number; archived: boolean }>('/orders/close-all', { order_ids });
export const updateBarOrderStatus = (id: number, statut: BarOrderStatus, moyen_paiement?: BarPaymentMethod) =>
  put<BarOrderResponse>('/orders/' + id + '/status', { statut, moyen_paiement });

// ==================== HISTORIQUE PRODUITS ====================

export const getProductHistory = async (params: { dateFrom?: string; dateTo?: string; productName?: string }): Promise<ProductHistoryItem[]> => {
  const response = await get<ProductHistoryItem[] | { data?: ProductHistoryItem[] }>('/product-history', params);
  // Le backend enveloppe toujours la réponse dans { data: [...] } via `ok(res, ...)`.
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data?: ProductHistoryItem[] }).data ?? [];
  }
  return [];
};

const barService = {
  getBarTables, getBarTableById, createBarTable, updateBarTable, deleteBarTable, getBarTablesStats,
  getBarCashiers, getBarCashierById, createBarCashier, updateBarCashier, deleteBarCashier,
  openBarSession, closeBarSession, getBarSessions, getBarSessionById, getBarOpenSessions, getBarSessionStats, getBarCashierStatus,
  getBarProducts, getBarProductById, createBarProduct, updateBarProduct, deleteBarProduct,
  getBarEquipments, createBarEquipment, updateBarEquipment, deleteBarEquipment,
  getBarStock, updateBarStock, addBarTransaction, getBarLatestTransaction, getBarTransactions,
  getBarOrders, getBarHistory, getBarDailyReport, saveBarDailyReport,
  createBarOrder, updateBarOrder, deleteBarOrder, closeAllBarOrders, updateBarOrderStatus,
  getProductHistory,
};

export default barService;