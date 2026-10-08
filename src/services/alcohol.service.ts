import api from '../lib/api';
import type {
  BarTable,
  BarCashier,
  BarSession,
  BarProduct,
  BarStockItem,
} from '../types/bar.type';

const BASE = '/api/alcool';

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

export const getAlcoholTables = () => get<BarTable[]>('/tables');
export const getAlcoholTableById = (id: number) => get<BarTable>(`/tables/${id}`);
export const createAlcoholTable = (data: { numero: string; capacite: number }) =>
  post<BarTable>('/tables', data);
export const updateAlcoholTable = (id: number, data: Partial<BarTable>) =>
  put<BarTable>(`/tables/${id}`, data);
export const deleteAlcoholTable = (id: number) => remove<null>(`/tables/${id}`);
export const getAlcoholTablesStats = () =>
  get<{ total_tables: number; capacite_totale: number; libres: number; occupees: number; reservees: number; en_cours: number }>('/tables/stats');

export const getAlcoholCashiers = () => get<BarCashier[]>('/cashiers');
export const getAlcoholCashierById = (id: number) => get<BarCashier>(`/cashiers/${id}`);
export const createAlcoholCashier = (data: { nom: string }) => post<BarCashier>('/cashiers', data);
export const updateAlcoholCashier = (id: number, data: Partial<BarCashier>) =>
  put<BarCashier>(`/cashiers/${id}`, data);
export const deleteAlcoholCashier = (id: number) => remove<null>(`/cashiers/${id}`);

export const openAlcoholSession = (data: { cashier_id: number; user_id: number; fond_initial: number }) =>
  post<{ session_id: number; session: BarSession }>('/sessions/open', data);
export const closeAlcoholSession = (data: { session_id: number; fond_final: number }) =>
  post<null>('/sessions/close', data);
export const getAlcoholSessions = () => get<BarSession[]>('/sessions');
export const getAlcoholSessionById = (id: number) => get<BarSession>(`/sessions/${id}`);
export const getAlcoholOpenSessions = (cashier_id?: number) =>
  get<BarSession[]>('/sessions/open', cashier_id ? { cashier_id } : undefined);
export const getAlcoholSessionStats = () => get<{ total_sessions: number; sessions_ouvertes: number }>('/sessions/stats');
export const getAlcoholCashierStatus = () => get<BarCashier[]>('/cashier-status');

export const getAlcoholProducts = () => get<BarProduct[]>('/products');
export const getAlcoholProductById = (id: number) => get<BarProduct>(`/products/${id}`);
export const createAlcoholProduct = (data: {
  nom: string;
  categorie: string;
  prix: number;
  alcool: boolean;
  quantite: number;
  seuil_minimum: number;
  unite: string;
}) => post<BarProduct>('/products', data);
export const updateAlcoholProduct = (id: number, data: Partial<BarProduct>) =>
  put<BarProduct>(`/products/${id}`, data);
export const deleteAlcoholProduct = (id: number) => remove<null>(`/products/${id}`);

export const getAlcoholStock = () => get<BarStockItem[]>('/stock');
export const updateAlcoholStock = (id: number, data: { quantite?: number }) =>
  put<BarStockItem>(`/stock/${id}`, data);
export const addAlcoholTransaction = (data: { session_id?: number; product_id: number; quantite: number; prix_unitaire: number }) =>
  post<{ id: number }>('/transactions', data);
export const getAlcoholLatestTransaction = (productId: number) =>
  get<{ id: number; product_id: number; quantite: number; prix_unitaire: number; montant: number; created_at: string }>(`/transactions/latest?product_id=${productId}`);
export const getAlcoholTransactions = () =>
  get<{ id: number; product_id: number; quantite: number; prix_unitaire: number; montant: number; created_at: string; nom: string; categorie: string }[]>('/transactions');

type AlcoholOrderResponse = {
  id: number;
  client: string;
  table: number;
  statut: string;
  total: number;
  created_at?: string;
  items: Array<{ nom: string; quantite: number; prix: number }>;
};
export type AlcoholOrderStatus = 'EN_ATTENTE' | 'EN_PREPARATION' | 'SERVIE' | 'ENCAISSEE';

export const getAlcoholOrders = async () => {
  const response = await get<AlcoholOrderResponse[] | { data?: AlcoholOrderResponse[] }>('/orders');
  return Array.isArray(response) ? response : response.data ?? [];
};
export const createAlcoholOrder = (data: {
  client: string;
  table: number;
  items: Array<{ product_id?: number; nom: string; quantite: number; prix: number; prix_unitaire?: number }>;
}) => post<{ id: number; client: string; table: number; statut: string; total: number; items: Array<{ nom: string; quantite: number; prix: number }> }>('/orders', data);
export const deleteAlcoholOrder = (id: number) => remove<{ message: string }>('/orders/' + id);
export const updateAlcoholOrderStatus = (id: number, statut: AlcoholOrderStatus) =>
  put<AlcoholOrderResponse>('/orders/' + id + '/status', { statut });

const alcoholService = {
  getAlcoholTables, getAlcoholTableById, createAlcoholTable, updateAlcoholTable, deleteAlcoholTable, getAlcoholTablesStats,
  getAlcoholCashiers, getAlcoholCashierById, createAlcoholCashier, updateAlcoholCashier, deleteAlcoholCashier,
  openAlcoholSession, closeAlcoholSession, getAlcoholSessions, getAlcoholSessionById, getAlcoholOpenSessions, getAlcoholSessionStats, getAlcoholCashierStatus,
  getAlcoholProducts, getAlcoholProductById, createAlcoholProduct, updateAlcoholProduct, deleteAlcoholProduct,
  getAlcoholStock, updateAlcoholStock, addAlcoholTransaction, getAlcoholLatestTransaction, getAlcoholTransactions, getAlcoholOrders, createAlcoholOrder, deleteAlcoholOrder, updateAlcoholOrderStatus,
};

export default alcoholService;
