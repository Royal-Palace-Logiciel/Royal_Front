// src/services/signature.service.ts
import api from '../lib/api';

// Étendre cette liste au fur et à mesure : 'casino_cash_operation' pour les recaves,
// 'casino_credit' pour les crédits, etc. Doit rester synchronisé avec SIGNABLE_TYPES
// côté backend (controllers/signatureController.js).
export type SignableType = 'client_kyc' | 'casino_cash_operation' | 'casino_credit';

export interface SignatureRecord {
  id: number;
  signable_type: SignableType;
  signable_id: number;
  client_id: number | null;
  signature_data: string;
  signed_at: string;
  created_at?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Module signature électronique générique et réutilisable, append-only :
// chaque signature créée est conservée, aucune n'est jamais écrasée. Pour
// une même entité (type, id), on peut donc accumuler un historique complet
// (ex: plusieurs recaves signées séparément pour un même client).
export const signatureService = {
  // Dernière signature connue pour cette entité (ou null si aucune)
  getSignature: async (type: SignableType, id: number | string): Promise<SignatureRecord | null> => {
    try {
      const response = await api.get<ApiResponse<SignatureRecord | null>>(`/api/signatures/${type}/${id}`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getSignature ${type}/${id}:`, error);
      throw error;
    }
  },

  // Historique complet des signatures de cette entité, du plus récent au plus ancien
  getSignatureHistory: async (type: SignableType, id: number | string): Promise<SignatureRecord[]> => {
    try {
      const response = await api.get<ApiResponse<SignatureRecord[]>>(`/api/signatures/${type}/${id}/history`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur getSignatureHistory ${type}/${id}:`, error);
      throw error;
    }
  },

  // Enregistre une NOUVELLE signature (ne remplace jamais une signature existante)
  createSignature: async (
    type: SignableType,
    id: number | string,
    signatureData: string,
    clientId?: number
  ): Promise<SignatureRecord> => {
    try {
      const response = await api.post<ApiResponse<SignatureRecord>>(`/api/signatures/${type}/${id}`, {
        signature_data: signatureData,
        client_id: clientId,
      });
      return response.data.data;
    } catch (error) {
      console.error(`❌ Erreur createSignature ${type}/${id}:`, error);
      throw error;
    }
  },
};