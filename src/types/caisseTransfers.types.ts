// =========================================================================
// Transferts inter-caisses — Types
// Alignés sur CAISSE_TRANSFERTS_README.md (caisseTransfersRoutes.js).
// Module transversal, monté sous /api/caisse-transfers (hors /api/casino).
// =========================================================================

export type ID = number;

export type ModuleCaisse = 'CASINO' | 'RESTAURANT' | 'BAR' | 'BOUTIQUE' | 'HEBERGEMENT';

export type StatutCaisseTransfer = 'EN_ATTENTE' | 'CONFIRME' | 'REFUSE' | 'ANNULE';

export interface CaisseTransfer {
  id: ID;
  module_source: ModuleCaisse;
  session_source_id: ID;
  module_destination: ModuleCaisse;
  session_destination_id: ID;
  montant: number;
  motif: string | null;
  statut: StatutCaisseTransfer;
  ref_flux_global_source: string | null;
  ref_flux_global_destination: string | null;
  created_by: ID;
  confirmed_by: ID | null;
  created_at: string;
  confirmed_at: string | null;
  /**
   * Résolus côté backend par jointure (uniquement pour CASINO aujourd'hui —
   * `null` pour les autres modules tant qu'ils n'ont pas de table de caisse
   * dédiée exploitable de la même façon). Toujours utiliser en fallback sur
   * l'id de session si absent.
   */
  cashier_source_code?: string | null;
  cashier_source_nom?: string | null;
  cashier_destination_code?: string | null;
  cashier_destination_nom?: string | null;
}

export interface CreateCaisseTransferPayload {
  module_source: ModuleCaisse;
  session_source_id: ID;
  module_destination: ModuleCaisse;
  session_destination_id: ID;
  montant: number;
  motif?: string;
}

export interface RejectCaisseTransferPayload {
  motif_refus?: string;
}

export interface ListCaisseTransfersParams {
  module?: ModuleCaisse;
  statut?: StatutCaisseTransfer;
  limit?: number;
  offset?: number;
}

/**
 * Modules déjà dotés d'une table de session de caisse dédiée côté backend
 * (`SESSION_TABLES` dans caisseTransfersController.js). Un transfert vers un
 * module absent de cette liste est rejeté avec un 400.
 */
export const CAISSE_TRANSFER_MODULES_SUPPORTES: ModuleCaisse[] = ['CASINO', 'RESTAURANT'];

export const MODULE_CAISSE_LABELS: Record<ModuleCaisse, string> = {
  CASINO: 'Casino',
  RESTAURANT: 'Restaurant',
  BAR: 'Bar',
  BOUTIQUE: 'Boutique',
  HEBERGEMENT: 'Hébergement',
};

export const STATUT_TRANSFER_LABELS: Record<StatutCaisseTransfer, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmé',
  REFUSE: 'Refusé',
  ANNULE: 'Annulé',
};

/** Libellé caisse lisible : code résolu si dispo, sinon repli sur l'id de session. */
export function caisseLabel(module: ModuleCaisse, sessionId: ID, code?: string | null, nom?: string | null): string {
  const base = MODULE_CAISSE_LABELS[module];
  if (code) return `${base} — ${code}`;
  if (nom) return `${base} — ${nom}`;
  return `${base} (session #${sessionId})`;
}