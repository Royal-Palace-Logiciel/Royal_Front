// src/services/spa.service.ts — module SPA (piscine)
import api from '../lib/api';

export type SpaCategorie = 'ENTREE' | 'LOCATION' | 'ABONNEMENT';
export type SpaPaymentMethod = 'ESPECES' | 'TPE' | 'ORANGE_MONEY' | 'MVOLA' | 'CHAMBRE' | 'OFFERT';
export type SpaAbonnementStatut = 'ACTIF' | 'EXPIRE' | 'EPUISE' | 'ANNULE';

export interface SpaTarif {
  id: number;
  nom: string;
  categorie: SpaCategorie;
  prix: number;
  nbEntrees: number | null;
  dureeJours: number | null;
  actif: boolean;
  ordre: number;
}

export type SpaTarifInput = Omit<SpaTarif, 'id'>;

export interface SpaVenteLigne {
  tarifId: number;
  nom: string;
  categorie: SpaCategorie;
  prix: number;
  quantite: number;
}

export interface SpaAbonnement {
  id: number;
  numero: string;
  venteId: number | null;
  formule: string;
  clientNom: string;
  clientTelephone: string;
  dateDebut: string;
  dateFin: string | null;
  entreesTotal: number | null;
  entreesRestantes: number | null;
  nombrePassages?: number;
  dernierPassage?: string | null;
  statut: SpaAbonnementStatut;
}

export interface SpaVente {
  id: number;
  date: string;
  montant: number;
  moyenPaiement: SpaPaymentMethod;
  clientNom: string;
  clientTelephone: string;
  hotelReservationId: number | null;
  chambre: string;
  lignes: SpaVenteLigne[];
  statut: 'OUVERTE' | 'CLOTUREE';
  sessionId: number;
  clotureId: number | null;
  userId: number | null;
  abonnements?: SpaAbonnement[];
}

export interface SpaSummary {
  nombreVentes: number;
  nombreEntrees: number;
  totalVentes: number;
  totalEncaisse: number;
  byPayment: Partial<Record<SpaPaymentMethod, number>>;
  byCategorie: Partial<Record<SpaCategorie, { quantite: number; montant: number }>>;
}

export interface SpaCaisse {
  session: { id: number; date: string; ouvertAt: string };
  ventes: SpaVente[];
  summary: SpaSummary;
}

export interface SpaClosure {
  id: number;
  reference: string;
  date: string;
  dateCloture: string;
  sessionId: number;
  createdBy: number | null;
  summary: SpaSummary;
  ventes?: SpaVente[];
}

export interface SpaVenteInput {
  lignes: Array<{ tarifId: number; quantite: number }>;
  moyenPaiement: SpaPaymentMethod;
  clientNom?: string;
  clientTelephone?: string;
  hotelReservationId?: number | null;
  chambre?: string;
}

export const SPA_PAYMENT_LABELS: Record<SpaPaymentMethod, string> = {
  ESPECES: 'Espèces',
  TPE: 'Carte (TPE)',
  ORANGE_MONEY: 'Orange Money',
  MVOLA: 'MVola',
  CHAMBRE: 'Note de chambre',
  OFFERT: 'Offert (client hôtel)',
};

export const SPA_CATEGORIE_LABELS: Record<SpaCategorie, string> = {
  ENTREE: 'Entrées',
  LOCATION: 'Locations',
  ABONNEMENT: 'Abonnements',
};

const unwrap = <T,>(response: { data: { data: T } }) => response.data.data;

const spaService = {
  getTarifs: async (includeInactive = false) => unwrap<SpaTarif[]>(await api.get('/api/spa/tarifs', { params: includeInactive ? { all: 1 } : {} })),
  createTarif: async (data: SpaTarifInput) => unwrap<SpaTarif>(await api.post('/api/spa/tarifs', data)),
  updateTarif: async (id: number, data: SpaTarifInput) => unwrap<SpaTarif>(await api.put(`/api/spa/tarifs/${id}`, data)),
  deleteTarif: async (id: number) => { await api.delete(`/api/spa/tarifs/${id}`); },

  getCaisse: async () => unwrap<SpaCaisse>(await api.get('/api/spa/caisse')),
  createVente: async (data: SpaVenteInput) => unwrap<SpaVente>(await api.post('/api/spa/ventes', data)),
  cancelVente: async (id: number) => { await api.delete(`/api/spa/ventes/${id}`); },
  closeCaisse: async () => unwrap<SpaClosure>(await api.post('/api/spa/caisse/close')),
  getClosures: async () => unwrap<SpaClosure[]>(await api.get('/api/spa/clotures')),
  getClosure: async (id: number) => unwrap<SpaClosure>(await api.get(`/api/spa/clotures/${id}`)),

  getAbonnements: async (q = '') => unwrap<SpaAbonnement[]>(await api.get('/api/spa/abonnements', { params: q ? { q } : {} })),
  addPassage: async (id: number) => unwrap<SpaAbonnement>(await api.post(`/api/spa/abonnements/${id}/passages`)),
  getPassages: async (id: number) => unwrap<Array<{ id: number; date: string; enregistrePar: string }>>(await api.get(`/api/spa/abonnements/${id}/passages`)),
  cancelAbonnement: async (id: number) => { await api.post(`/api/spa/abonnements/${id}/annuler`); },

  getRoomCharges: async () => unwrap<Array<{ hotelReservationId: number; total: number }>>(await api.get('/api/spa/room-charges')),
};

export default spaService;
