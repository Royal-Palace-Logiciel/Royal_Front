// src/services/client.service.ts
import api from '../lib/api';

export interface Client {
  id: number;
  code_client: string | null;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  date_naissance: string | null;
  type_piece: string | null;
  numero_piece: string | null;
  photo_url: string | null;
  is_casino_player: boolean;
  statut: 'ACTIF' | 'INACTIF' | 'BLOCKED';
  created_at?: string;
  updated_at?: string;
}

export interface ClientFormData {
  code_client?: string;
  nom: string;
  prenom?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  date_naissance?: string;
  type_piece?: string;
  numero_piece?: string;
  photo_url?: string | null;
  is_casino_player?: boolean;
  statut?: 'ACTIF' | 'INACTIF' | 'BLOCKED';
}

export interface ClientWithDetails extends Client {
  solde: number | null;
  kyc?: ClientKyc | null;
}

export interface ClientKyc {
  id?: number;
  client_id?: number;
  lieu_naissance?: string | null;
  nationalite?: string | null;
  profession?: string | null;
  date_delivrance_piece?: string | null;
  date_expiration_piece?: string | null;
  autorite_delivrance?: string | null;
  source_revenus?: string | null;
  revenu_mensuel_estime?: number | null;
  mode_paiement?: string | null;
  banque?: string | null;
  doc_piece_identite?: boolean;
  doc_justificatif_domicile?: boolean;
  doc_photo_client?: boolean;
  doc_autre?: string | null;
  documents_identite_urls?: string[];
  niveau_risque?: 'FAIBLE' | 'MOYEN' | 'ELEVE' | null;
  commentaires_risque?: string | null;
  declaration_client?: boolean;
  agent_verificateur?: number | null;
  date_verification?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientKycFormData {
  lieu_naissance?: string;
  nationalite?: string;
  profession?: string;
  date_delivrance_piece?: string;
  date_expiration_piece?: string;
  autorite_delivrance?: string;
  source_revenus?: string;
  revenu_mensuel_estime?: number;
  mode_paiement?: string;
  banque?: string;
  doc_piece_identite?: boolean;
  doc_justificatif_domicile?: boolean;
  doc_photo_client?: boolean;
  doc_autre?: string;
  documents_identite_urls?: string[];
  niveau_risque?: 'FAIBLE' | 'MOYEN' | 'ELEVE';
  commentaires_risque?: string;
  declaration_client?: boolean;
  agent_verificateur?: number;
  date_verification?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    message: string;
  };
  message?: string;
  count?: number;
}

export const clientService = {
  // Récupérer tous les clients
  getClients: async (filters?: { nom?: string; statut?: string; is_casino_player?: boolean }): Promise<Client[]> => {
    try {
      const params = new URLSearchParams();
      if (filters?.nom) params.append('nom', filters.nom);
      if (filters?.statut) params.append('statut', filters.statut);
      if (filters?.is_casino_player !== undefined) params.append('is_casino_player', String(filters.is_casino_player));
      
      const url = `/api/clients${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<ApiResponse<Client[]>>(url);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getClients:', error);
      throw error;
    }
  },

  // Recherche multi-critères (nom, prénom, code_client, téléphone, email)
  searchClients: async (term: string, limit?: number): Promise<Client[]> => {
    try {
      const params = new URLSearchParams({ q: term });
      if (limit) params.append('limit', String(limit));
      const response = await api.get<ApiResponse<Client[]>>(`/api/clients/search?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur searchClients:', error);
      throw error;
    }
  },

  // Récupérer un client par ID
  getClientById: async (id: number): Promise<Client> => {
    try {
      const response = await api.get<ApiResponse<Client>>(`/api/clients/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getClientById ${id}:`, error);
      throw error;
    }
  },

  // Récupérer un client avec son solde
  getClientWithDetails: async (id: number): Promise<ClientWithDetails> => {
    try {
      const response = await api.get<ApiResponse<ClientWithDetails>>(`/api/clients/${id}/full`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getClientWithDetails ${id}:`, error);
      throw error;
    }
  },

  // Aperçu du prochain code client (CH<n>/<année>) — le code définitif est attribué à l'enregistrement
  getNextClientCode: async (): Promise<string> => {
    const response = await api.get<ApiResponse<{ code_client: string }>>('/api/clients/next-code');
    return response.data.data.code_client;
  },

  // Créer un client
  createClient: async (data: ClientFormData): Promise<Client> => {
    try {
      const response = await api.post<ApiResponse<Client>>('/api/clients', data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur createClient:', error);
      throw error;
    }
  },

  // Mettre à jour un client
  updateClient: async (id: number, data: ClientFormData): Promise<Client> => {
    try {
      const response = await api.put<ApiResponse<Client>>(`/api/clients/${id}`, data);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur updateClient ${id}:`, error);
      throw error;
    }
  },

  // Supprimer un client
  deleteClient: async (id: number): Promise<{
    success: boolean;
    message: string;
    deleted: boolean;
    deactivated: boolean;
    archived?: boolean; // true : retiré de la liste, historique conservé
    relatedCount?: number
  }> => {
    try {
      const response = await api.delete<ApiResponse<{ 
        success: boolean; 
        message: string; 
        deleted: boolean; 
        deactivated: boolean; 
        relatedCount?: number 
      }>>(`/api/clients/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur deleteClient ${id}:`, error);
      throw error;
    }
  },

  // Récupérer la fiche KYC d'un client
  getClientKyc: async (id: number): Promise<ClientKyc | null> => {
    try {
      const response = await api.get<ApiResponse<ClientKyc | null>>(`/api/clients/${id}/kyc`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getClientKyc ${id}:`, error);
      throw error;
    }
  },

  // Créer ou mettre à jour la fiche KYC d'un client
  saveClientKyc: async (id: number, data: ClientKycFormData): Promise<ClientKyc> => {
    try {
      const response = await api.put<ApiResponse<ClientKyc>>(`/api/clients/${id}/kyc`, data);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur saveClientKyc ${id}:`, error);
      throw error;
    }
  },

};