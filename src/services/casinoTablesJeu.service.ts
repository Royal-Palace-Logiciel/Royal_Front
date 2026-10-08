// =========================================================================
// Casino — Tables de jeu, Caves/Recaves, Prolongations & Pourboires
// Remplace src/services/casinoTablesJeu.service.ts (version précédente + ajouts)
// =========================================================================

import api from '../lib/api';
import type { ID } from '../types/casino.types';
import type {
  TableJeu,
  TableCave,
  CaveMovementPayload,
  TableProlongation,
  ProlongationPayload,
  TablePourboire,
  PourboirePayload,
  JoueurActif,
  TempsJeuJoueur,
  TempsJeuJour,
  FeuilleTable,
} from '../types/casinoTablesJeu.types';
import type { ChipLine, PlayerLine, RackCheck } from '../components/Casino/sheets/types';

const BASE_URL = '/api/casino';

function qs(params: Record<string, string | number | undefined | null>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!usable.length) return '';
  const search = new URLSearchParams(usable.map(([k, v]) => [k, String(v)]));
  return `?${search.toString()}`;
}

async function get<T>(path: string): Promise<T> {
  const response = await api.get<T>(`${BASE_URL}${path}`);
  return response.data;
}
async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await api.post<T>(`${BASE_URL}${path}`, body);
  return response.data;
}
async function put<T>(path: string, body?: unknown): Promise<T> {
  const response = await api.put<T>(`${BASE_URL}${path}`, body);
  return response.data;
}
async function del<T>(path: string): Promise<T> {
  const response = await api.delete<T>(`${BASE_URL}${path}`);
  return response.data;
}

export const tablesJeuApi = {
  list: (params?: { room_id?: ID }) => get<TableJeu[]>(`/tables-jeu${qs(params || {})}`),
  get: (id: ID) => get<TableJeu>(`/tables-jeu/${id}`),
  create: (payload: Partial<TableJeu>) => post<TableJeu>('/tables-jeu', payload),
  update: (id: ID, payload: Partial<TableJeu>) => put<TableJeu>(`/tables-jeu/${id}`, payload),
  remove: (id: ID) => del<void>(`/tables-jeu/${id}`),
  ouvrir: (id: ID) => post<TableJeu>(`/tables-jeu/${id}/ouvrir`),
  fermer: (id: ID) => post<TableJeu>(`/tables-jeu/${id}/fermer`),
  archiver: (id: ID) => post<TableJeu>(`/tables-jeu/${id}/archiver`),
  desarchiver: (id: ID) => post<TableJeu>(`/tables-jeu/${id}/desarchiver`),

  // Caves / recaves
  addCave: (tableId: ID, payload: CaveMovementPayload) =>
    post<TableCave>(`/tables-jeu/${tableId}/caves`, payload),
  listCaves: (tableId: ID, params?: { date?: string }) =>
    get<TableCave[]>(`/tables-jeu/${tableId}/caves${qs(params || {})}`),

  // Prolongations (salaire horaire croupier, à charge du joueur)
  addProlongation: (tableId: ID, payload: ProlongationPayload) =>
    post<TableProlongation>(`/tables-jeu/${tableId}/prolongations`, payload),
  listProlongations: (tableId: ID, params?: { date?: string }) =>
    get<TableProlongation[]>(`/tables-jeu/${tableId}/prolongations${qs(params || {})}`),

  // Pourboires (déclaratif, jetons ou espèces)
  addPourboire: (tableId: ID, payload: PourboirePayload) =>
    post<TablePourboire>(`/tables-jeu/${tableId}/pourboires`, payload),
  listPourboires: (tableId: ID, params?: { date?: string }) =>
    get<TablePourboire[]>(`/tables-jeu/${tableId}/pourboires${qs(params || {})}`),

  feuille: (tableId: ID, params?: { date?: string }) =>
    get<FeuilleTable>(`/tables-jeu/${tableId}/feuille${qs(params || {})}`),

  // Présence par table (nécessaire pour totaliser le temps de jeu)
  joueursActifs: (tableId: ID) => get<JoueurActif[]>(`/tables-jeu/${tableId}/joueurs-actifs`),
};

export type PlayerSheetData = {
  id?: number;
  date: string;
  table_name: string;
  players: PlayerLine[];
  chips: ChipLine[];
  rackChecks?: RackCheck[];
  restaurantPayments: { especes: boolean; tpe: boolean };
  finals: Record<string, Record<string, string>>;
  endGameTime?: string;
  isFinished?: boolean;
  finishedAt?: string;
  total_cashing_jetons?: number;
  cashingPaymentMethod?: string;
};

export interface CasinoRegisteredPlayer {
  id: number;
  nom: string;
  prenom?: string | null;
  surnom?: string | null;
  whatsapp?: string | null;
  whatsapp_fiche_consent?: boolean | number;
  whatsapp_fiche_consent_signature?: string | null;
  whatsapp_fiche_consent_at?: string | null;
  identite_type?: string | null;
  identite_numero?: string | null;
  identite_nom_complet?: string | null;
  identite_date_emission?: string | null;
  identite_verifiee?: boolean | number;
  identite_fichier_url?: string | null;
  identite_fichiers_urls?: string | null;
  telephone?: string | null;
  date_inscription?: string | null;
  depot: number | string;
  credit: number | string;
  mode_jeu?: 'EN_ATTENTE' | 'EN_JEU';
  statut: 'ACTIF' | 'INACTIF';
  statut_jeu?: 'EN_JEU' | 'ARRETE';
}

export interface CasinoPlayerGame {
  id: number;
  casino_player_id: number;
  game_date: string;
  table_name: string;
  depot: number | string;
  credit: number | string;
  nom: string;
  prenom?: string | null;
  surnom?: string | null;
  whatsapp?: string | null;
}

export interface IdentityVerification {
  id?: number;
  player_sheet_id?: number;
  fiche_id: number;
  full_name: string;
  id_type: string;
  id_number: string;
  issue_date: string;
  transaction_type: 'ACHAT' | 'APPORT' | 'ECHANGE';
  amount: number;
  verified_at: string;
  verified_by?: number;
  created_at?: string;
}

export interface CasinoFinalResultRow {
  sheet_id: number;
  date: string;
  table_name: string;
  updated_at: string;
  /** Montant repris par le rapport financier (null : calcul final jamais enregistré). */
  montant_rapport: number | null;
}

export const playerSheetApi = {
  get: (date: string, tableName: string) =>
    get<PlayerSheetData | null>(`/player-sheets${qs({ date, table_name: tableName })}`),
  finalResults: (dateFrom: string, dateTo: string) =>
    get<CasinoFinalResultRow[]>(`/player-sheets/final-results${qs({ date_from: dateFrom, date_to: dateTo })}`),
  save: (payload: PlayerSheetData) => put<PlayerSheetData>('/player-sheets', payload),
  finish: (date: string, tableName: string) =>
    post<{ finishedAt: string; playerIds: number[] }>('/player-sheets/finish', { date, table_name: tableName }),
  // Le serveur envoie la capture (data URL PNG/JPEG) au WhatsApp du joueur.
  sendWhatsapp: (payload: { image: string; casino_player_id?: number; numero?: string; caption?: string; filename?: string }) =>
    post<{ ok: boolean; numero: string }>('/player-sheets/whatsapp', payload),
  openWhatsappDesktop: (payload: { image: string; casino_player_id?: number; numero?: string }) =>
    post<{ ok: boolean; numero: string }>('/player-sheets/whatsapp-desktop', payload),
};

export const casinoPlayersApi = {
  list: async () => unwrapCasinoPlayerResponse<CasinoRegisteredPlayer[]>(await get<CasinoRegisteredPlayer[] | { data?: CasinoRegisteredPlayer[] }>('/players')) || [],
  create: async (payload: Omit<CasinoRegisteredPlayer, 'id' | 'statut'> & { statut?: 'ACTIF' | 'INACTIF' }) => unwrapCasinoPlayerResponse<CasinoRegisteredPlayer>(await post<CasinoRegisteredPlayer | { data?: CasinoRegisteredPlayer }>('/players', payload)),
  update: async (id: number, payload: Partial<Omit<CasinoRegisteredPlayer, 'id'>>) => unwrapCasinoPlayerResponse<CasinoRegisteredPlayer>(await put<CasinoRegisteredPlayer | { data?: CasinoRegisteredPlayer }>(`/players/${id}`, payload)),
  play: async (id: number, payload: { game_date: string; table_name: string; depot: number; credit: number }) => unwrapCasinoPlayerResponse<CasinoPlayerGame>(await post<CasinoPlayerGame | { data?: CasinoPlayerGame }>(`/players/${id}/play`, payload)),
  remove: (id: number) => del<void>(`/players/${id}`),
};

const unwrapCasinoPlayerResponse = <T,>(response: T | { data?: T }): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data?: T }).data as T;
  }
  return response as T;
};

export const identityVerificationApi = {
  list: (params?: { player_sheet_id?: number; fiche_id?: number; date_from?: string; date_to?: string }) =>
    get<IdentityVerification[]>(`/identity-verifications${qs(params || {})}`),
  get: (id: number) => get<IdentityVerification>(`/identity-verifications/${id}`),
  create: (payload: Omit<IdentityVerification, 'id' | 'verified_at' | 'created_at'>) =>
    post<IdentityVerification>('/identity-verifications', payload),
  update: (id: number, payload: Partial<IdentityVerification>) =>
    put<IdentityVerification>(`/identity-verifications/${id}`, payload),
  remove: (id: number) => del<void>(`/identity-verifications/${id}`),
};

export const tableVisitApi = {
  terminer: (visitId: ID) => post<{ id: ID; sortie_at: string }>(`/table-visits/${visitId}/terminer`),
  changerPlace: (visitId: ID, numero_place: number) =>
    post<{ id: ID; numero_place: number }>(`/table-visits/${visitId}/place`, { numero_place }),
};

export const tempsJeuApi = {
  parJoueur: (clientId: ID, params?: { date?: string }) =>
    get<TempsJeuJoueur>(`/reports/temps-jeu-joueur/${clientId}${qs(params || {})}`),
  parJour: (params?: { date?: string }) =>
    get<TempsJeuJour>(`/reports/temps-jeu-jour${qs(params || {})}`),
};

export const tableCaveSignatureApi = {
  sign: (caveId: ID, signatureData: string) =>
    post<{ id: ID; signed_at: string }>(`/table-caves/${caveId}/signature`, { signature_data: signatureData }),
  get: (caveId: ID) => get<{ id: ID; signature_data: string; signed_at: string } | null>(`/table-caves/${caveId}/signature`),
};

export const tableProlongationSignatureApi = {
  sign: (prolongationId: ID, signatureData: string) =>
    post<{ id: ID; signed_at: string }>(`/table-prolongations/${prolongationId}/signature`, { signature_data: signatureData }),
};

export default tablesJeuApi;
