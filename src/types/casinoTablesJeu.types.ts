// =========================================================================
// Types — Tables de jeu, Caves/Recaves, Prolongations & Pourboires
// Remplace src/types/casinoTablesJeu.types.ts (version précédente + ajouts)
// =========================================================================

import type { ID, MoyenPaiement } from './casino.types';

export type TypeJeu = 'POKER' | 'BLACKJACK' | 'ROULETTE' | 'BACCARA' | 'AUTRE';
export type TypePartie = 'JEU_SIMPLE' | 'TOURNOI';
export type StatutTableJeu = 'OUVERTE' | 'FERMEE' | 'ARCHIVEE';
export type StatutPaiementCave = 'PAYE' | 'NON_PAYE';
export type TypePourboire = 'JETONS' | 'ESPECES';

export const TYPE_JEU_LABELS: Record<TypeJeu, string> = {
  POKER: 'Poker',
  BLACKJACK: 'Blackjack',
  ROULETTE: 'Roulette',
  BACCARA: 'Baccara',
  AUTRE: 'Autre',
};

export interface TableJeu {
  id: ID;
  room_id: ID;
  numero: string;
  type_jeu: TypeJeu;
  type_partie: TypePartie;
  nombre_places: number;
  cave_minimum: number;
  /** Ariary/heure, à charge du joueur lors d'une prolongation. */
  salaire_horaire_croupier: number;
  /** Temps de jeu simple, sans prolongation, décompté depuis created_at. À expiration : bouton Prolongation affiché pour la 1ère fois. */
  duree_jeu_simple_minutes: number;
  /** Durée d'UNE prolongation, décomptée depuis derniere_prolongation_at. */
  duree_prolongation_minutes: number;
  /** Référence du timer : NULL tant qu'aucune prolongation n'a été faite (référence = created_at). */
  derniere_prolongation_at: string | null;
  /** Référence de la phase "jeu simple" : remise à jour à chaque ouverture, remise à NULL n'arrive jamais (fallback created_at si jamais ouverte via /ouvrir). */
  derniere_ouverture_at: string | null;
  statut: StatutTableJeu;
  /** true si la table a au moins une cave, prolongation ou pourboire — la suppression est alors bloquée en base (FK), utiliser "Archiver". */
  a_historique: boolean;
  created_at: string;
  updated_at: string;
}

export interface TableCave {
  id: ID;
  table_jeu_id: ID;
  cashier_session_id: ID;
  client_id: ID | null;
  numero_place: number;
  client_libre: string | null;
  numero_adherent: string | null;
  date_jeu: string;
  heure_arrivee: string;
  heure_mouvement: string;
  numero_cave: number;
  montant_cave: number;
  montant_total_joueur: number;
  montant_jetons_remis: number;
  statut_paiement: StatutPaiementCave;
  moyen_paiement: MoyenPaiement | null;
  cash_operation_id: ID | null;
  created_at: string;
}

export interface CaveMovementPayload {
  session_id: ID;
  client_id?: ID | null;
  client_libre?: string | null;
  numero_adherent?: string | null;
  numero_place: number;
  montant: number;
  statut_paiement: StatutPaiementCave;
  moyen_paiement?: MoyenPaiement | null;
}

export interface TableProlongation {
  id: ID;
  table_jeu_id: ID;
  cashier_session_id: ID;
  client_id: ID | null;
  client_libre: string | null;
  montant: number;
  statut_paiement: StatutPaiementCave;
  moyen_paiement: MoyenPaiement | null;
  cash_operation_id: ID | null;
  created_at: string;
}

export interface ProlongationPayload {
  session_id: ID;
  client_id?: ID | null;
  client_libre?: string | null;
  statut_paiement: StatutPaiementCave;
  moyen_paiement?: MoyenPaiement | null;
}

export interface TablePourboire {
  id: ID;
  table_jeu_id: ID;
  cashier_session_id: ID;
  montant: number;
  type_pourboire: TypePourboire;
  created_at: string;
}

export interface PourboirePayload {
  session_id: ID;
  montant: number;
  type_pourboire: TypePourboire;
}

export interface JoueurActif {
  id: ID;
  joueur: string;
  client_id: ID | null;
  numero_place: number;
  type_partie: TypePartie;
  entree_at: string;
  minutes_ecoulees: number;
}

export interface TempsJeuSession {
  table_jeu_id: ID;
  table_numero: string;
  type_jeu: TypeJeu;
  entree_at: string;
  sortie_at: string | null;
  minutes: number;
  en_cours: boolean;
}

export interface TempsJeuParType {
  type_jeu: TypeJeu;
  minutes: number;
  nb_sessions: number;
}

export interface TempsJeuJoueur {
  client_id: ID;
  date: string | null;
  total_minutes: number;
  /** Type de jeu cumulant le plus de minutes ; `null` si aucune présence enregistrée. */
  type_jeu_prefere: TypeJeu | null;
  par_type_jeu: TempsJeuParType[];
  sessions: TempsJeuSession[];
}

export interface TempsJeuJourTable {
  table_jeu_id: ID;
  table_numero: string;
  minutes: number;
  nb_sessions: number;
}

export interface TempsJeuJour {
  date: string;
  total_minutes: number;
  par_table: TempsJeuJourTable[];
}

export interface FeuilleTableLigne {
  /** ID de la cave/recave — nécessaire pour retrouver la signature via tableCaveSignatureApi si besoin. */
  cave_id: ID;
  joueur: string;
  numero_adherent: string | null;
  heure_arrivee: string;
  heure: string;
  numero_cave: number;
  montant_cave: number;
  montant_total_joueur: number;
  statut_paiement: StatutPaiementCave;
  moyen_paiement: MoyenPaiement | null;
  signature_presente: boolean;
  /** Image de la signature (data URL base64, ex. "data:image/png;base64,...") si signée, sinon `null`. */
  signature_data: string | null;
}

export interface FeuilleProlongationLigne {
  /** ID de la prolongation — nécessaire pour retrouver la signature via tableProlongationSignatureApi si besoin. */
  prolongation_id: ID;
  joueur: string;
  heure: string;
  montant: number;
  statut_paiement: StatutPaiementCave;
  moyen_paiement: MoyenPaiement | null;
  signature_presente: boolean;
  /** Image de la signature (data URL base64) si signée, sinon `null`. */
  signature_data: string | null;
}

export interface FeuilleTable {
  table: {
    id: ID; numero: string; type_jeu: TypeJeu; cave_minimum: number;
    salaire_horaire_croupier: number; duree_jeu_simple_minutes: number;
    duree_prolongation_minutes: number; salle: string;
  };
  date: string;
  lignes: FeuilleTableLigne[];
  prolongations: FeuilleProlongationLigne[];
  pourboires: { total_jetons: number; total_especes: number; total: number };
  totaux: {
    total_cashing_jetons: number;
    total_caves_encaissees: number;
    montant_paye_especes: number;
    montant_paye_tpe: number;
    montant_non_paye: number;
    total_prolongation: number;
    total_prolongation_payee: number;
    total_prolongation_non_payee: number;
  };
}