// =========================================================================
// Transferts inter-caisses — Service API
// Module transversal monté sous /api/caisse-transfers (hors /api/casino).
// Même pattern que casino.service.ts : instance axios centralisée
// (src/lib/api.ts), header Authorization + refresh token gérés par
// l'intercepteur.
// =========================================================================

import api from '../lib/api';
import type {
  CaisseTransfer,
  CreateCaisseTransferPayload,
  RejectCaisseTransferPayload,
  ListCaisseTransfersParams,
  ID,
} from '../types/caisseTransfers.types';

const BASE_URL = '/api/caisse-transfers';

function qs(params: Record<string, string | number | undefined | null>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!usable.length) return '';
  const search = new URLSearchParams(usable.map(([k, v]) => [k, String(v)]));
  return `?${search.toString()}`;
}

async function get<T>(path: string): Promise<T> {
  try {
    const response = await api.get<T>(`${BASE_URL}${path}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erreur GET ${path}:`, error);
    throw error;
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  try {
    const response = await api.post<T>(`${BASE_URL}${path}`, body);
    return response.data;
  } catch (error) {
    console.error(`❌ Erreur POST ${path}:`, error);
    throw error;
  }
}

export const caisseTransfersApi = {
  list: (params?: ListCaisseTransfersParams) => get<CaisseTransfer[]>(qs((params || {}) as Record<string, string | number | undefined | null>)),
  get: (id: ID) => get<CaisseTransfer>(`/${id}`),
  create: (payload: CreateCaisseTransferPayload) => post<CaisseTransfer>('/', payload),
  confirm: (id: ID) => post<CaisseTransfer>(`/${id}/confirm`),
  reject: (id: ID, payload?: RejectCaisseTransferPayload) => post<CaisseTransfer>(`/${id}/reject`, payload || {}),
  /** Transferts EN_ATTENTE touchant une session de caisse casino donnée (source ou destination). */
  pendingForCasinoSession: (sessionId: ID) => get<CaisseTransfer[]>(`/pending/casino/${sessionId}`),
};

export default caisseTransfersApi;