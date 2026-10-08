// =========================================================================
// Casino — Types
// Alignés sur CASINO_README.md (casinoRoutes.js). Montants en Ariary (int).
// Dates : "YYYY-MM-DD HH:MM:SS" (datetime) ou "YYYY-MM-DD" (date).
// =========================================================================

export type ID = number;

// -------------------------------------------------------------------------
// Enums / unions métier
// -------------------------------------------------------------------------

export type TypeSalle = 'VIP' | 'POKER' | 'MACHINES' | 'TABLE_JEUX' | 'AUTRE';
export type StatutSalle = 'OUVERTE' | 'FERMEE' | 'EN_TRAVAUX';

export type StatutCaisse = 'OUVERTE' | 'FERMEE' | 'MAINTENANCE';

export type StatutSession = 'OUVERTE' | 'FERMEE';

export type NiveauCarte = 'STANDARD' | 'SILVER' | 'GOLD' | 'VIP';
export type StatutCarte = 'ACTIVE' | 'SUSPENDUE' | 'PERDUE';

export type StatutSpecialClient =
  | 'NORMAL'
  | 'VIP'
  | 'A_SURVEILLER'
  | 'EXCLU'
  | 'AUTO_EXCLU';

export type TypeIncident = 'INCIDENT' | 'LITIGE';
export type GraviteIncident = 'FAIBLE' | 'MOYENNE' | 'ELEVEE';
export type StatutIncident = 'OUVERT' | 'EN_COURS' | 'RESOLU';

export type StatutChipType = 'ACTIF' | 'INACTIF';

export type MoyenPaiement = 'ESPECES' | 'MOBILE_MONEY' | 'CARTE' | 'VIREMENT' | 'AUTRE' | 'JETONS';

export type TypeOperationCaisse =
  | 'BUY_IN'
  | 'CASH_OUT'
  | 'DEPOT'
  | 'AVANCE_CREDIT'
  | 'REMBOURSEMENT_CREDIT';

export type TypeMouvementJeton = 'BUY' | 'SELL' | 'PAIEMENT';

export type ModuleCiblePaiementJetons = 'RESTAURANT' | 'BAR' | 'BOUTIQUE' | 'HEBERGEMENT';

export type StatutCredit = 'ACTIF' | 'EN_RETARD' | 'SOLDE';

export type CategorieScore = 'BON' | 'MOYEN' | 'MAUVAIS';
export type DecisionScore = 'AUCUNE' | 'VALIDEE' | 'CONTESTEE' | 'ANNULEE';

export type EntreeViaVisite = 'QR' | 'MANUEL';

// -------------------------------------------------------------------------
// Entités
// -------------------------------------------------------------------------

export interface Room {
  id: ID;
  code: string;
  nom: string;
  type_salle: TypeSalle;
  statut: StatutSalle;
  created_at?: string;
  updated_at?: string;
}

export interface Cashier {
  id: ID;
  room_id: ID;
  code: string;
  nom: string;
  statut: StatutCaisse;
  created_at?: string;
  updated_at?: string;
}

export interface CashSession {
  id: ID;
  cashier_id: ID;
  user_id: ID;
  ouverture_at: string;
  fermeture_at: string | null;
  fond_initial: number;
  fond_final_theorique?: number | null;
  fond_final_declare: number | null;
  ecart?: number | null;
  cash_check?: number | null;
  cashing_verifie?: number | boolean | null;
  cashing_verifie_le?: string | null;
  cashing_verifie_par?: ID | null;
  cashing_montant_verifie?: number | null;
  rack_check_verifie?: number | boolean | null;
  rack_check_montant?: number | null;
  rack_check_manquant?: number | null;
  rack_check_le?: string | null;
  rack_check_par?: ID | null;
  statut: StatutSession;
  commentaire?: string | null;
}

export interface SessionSummary {
  session: CashSession;
  total_entrees: number;
  total_sorties: number;
  solde_theorique: number;
}

export interface SessionTransaction {
  source: 'cash_operation' | 'chip_transaction';
  id: ID;
  type_operation: string;
  montant: number;
  moyen_paiement: MoyenPaiement;
  client_id: ID | null;
  client_libre: string | null;
  created_at: string;
}

export interface Client {
  id: ID;
  code_client: string;
  nom: string;
  prenom?: string | null;
  telephone?: string | null;
  is_casino_player?: 0 | 1;
  statut?: string;
}

export interface ClientProfile {
  id?: ID;
  client_id: ID;
  statut_special: StatutSpecialClient;
  motif?: string | null;
  decide_par?: ID | null;
  decide_le?: string | null;
}

export interface LoyaltyCard {
  id: ID;
  client_id: ID;
  numero_carte: string;
  qr_code: string;
  niveau: NiveauCarte;
  plafond_credit: number | null;
  statut: StatutCarte;
  date_emission: string;
}

export interface ClientFullProfile {
  client: Client;
  profile: ClientProfile | null;
  card: LoyaltyCard | null;
  dernier_score: Score | null;
}

export interface ClientHistory {
  visites: Visit[];
  salles_frequentees: { id: ID; nom: string; nb_visites: number }[];
}

export interface ClientConsumption {
  nb_commandes: number;
  panier_moyen: number;
  premiere_commande: string | null;
  derniere_commande: string | null;
}

export interface Incident {
  id: ID;
  client_id: ID;
  session_id: ID | null;
  type: TypeIncident;
  gravite: GraviteIncident;
  description: string;
  statut: StatutIncident;
  resolved_at?: string | null;
  created_at?: string;
}

export interface ChipType {
  id: ID;
  code: string;
  nom: string;
  valeur_nominale: number;
  couleur: string;
  statut: StatutChipType;
  quantite_stock: number;
}

export interface ChipTransaction {
  id: ID;
  session_id: ID | null;
  chip_type_id: ID;
  type_jeton?: ChipType;
  quantite: number;
  montant_total: number;
  client_id: ID | null;
  client_libre: string | null;
  moyen_paiement: MoyenPaiement;
  type_mouvement: TypeMouvementJeton;
  module_cible?: 'CASINO' | ModuleCiblePaiementJetons;
  reference_commande_id?: ID | null;
  created_at: string;
  ref_flux_global?: string;
}

export interface CashOperation {
  id: ID;
  session_id: ID;
  type_operation: TypeOperationCaisse;
  montant: number;
  moyen_paiement: MoyenPaiement;
  client_id: ID | null;
  client_libre?: string | null;
  created_at: string;
  ref_flux_global?: string;
}

export interface PlayerCredit {
  id: ID;
  client_id: ID;
  montant: number;
  encours: number;
  echeance: string;
  statut: StatutCredit;
  session_id?: ID | null;
  created_at?: string;
}

export interface CreditRepayment {
  id: ID;
  credit_id: ID;
  montant: number;
  moyen_paiement: MoyenPaiement;
  session_id?: ID | null;
  delai_jours: number;
  created_at: string;
}

export interface ScoringConfigItem {
  cle: string;
  valeur: string;
  description?: string;
  updated_by?: ID;
  updated_at?: string;
}

export interface ScoreFacteur {
  valeur?: number;
  score?: number;
  poids?: number;
  [k: string]: number | undefined;
}

export interface Score {
  id: ID;
  client_id: ID;
  score: string; // ex: "72.40"
  categorie: CategorieScore | 'MOYEN' | string;
  facteurs: {
    ratio_remboursement?: ScoreFacteur;
    retard_moyen_jours?: ScoreFacteur;
    encours_vs_plafond?: { encours: number; plafond: number; ratio: number; poids: number };
    anciennete_mois?: ScoreFacteur;
    regularite_visites_12m?: ScoreFacteur;
    seuils?: { seuil_bon_payeur: number; seuil_moyen_payeur: number };
    [k: string]: unknown;
  };
  calcule_le: string;
  decision: DecisionScore;
  decide_par?: ID | null;
  decide_le?: string | null;
  commentaire_contestation?: string | null;
}

export interface Visit {
  id: ID;
  room_id: ID;
  client_id: ID | null;
  qr_code?: string | null;
  entree_via: EntreeViaVisite;
  entree_at?: string;
  sortie_at: string | null;
  nom?: string;
  prenom?: string;
}

// -------------------------------------------------------------------------
// Dashboard & rapports
// -------------------------------------------------------------------------

export interface CasinoDashboard {
  salles_total: number;
  salles_ouvertes: number;
  sessions_ouvertes: number;
  produit_net_jour: number;
  encours_credit_total: number;
  incidents_ouverts: number;
}

export interface ProduitNetRow {
  room_id: ID;
  salle: string;
  jour: string;
  total_entrees: number;
  total_sorties: number;
  produit_net: number;
}

export interface EcartCaisseRow {
  session_id: ID;
  caisse: string;
  salle: string;
  user_id: ID;
  ouverture_at: string;
  fermeture_at: string | null;
  fond_initial: number;
  fond_final_theorique: number;
  fond_final_declare: number | null;
  ecart: number | null;
  cash_check?: number | null;
  cashing_verifie?: number | boolean | null;
  cashing_verifie_le?: string | null;
  cashing_verifie_par?: ID | null;
  cashing_montant_verifie?: number | null;
  rack_check_verifie?: number | boolean | null;
  rack_check_montant?: number | null;
  rack_check_manquant?: number | null;
}

export interface EncoursCreditRow {
  client_id: ID;
  client: string;
  nb_credits_actifs: number;
  encours_total: number;
  prochaine_echeance: string | null;
}

export interface FluxASynchroniserRow {
  source: string;
  id: ID;
  ref_flux_global: string;
  montant: number;
  created_at: string;
}

// -------------------------------------------------------------------------
// Payloads (bodies d'entrée)
// -------------------------------------------------------------------------

export interface OpenSessionPayload {
  cashier_id: ID;
  fond_initial: number;
}

export interface CloseSessionPayload {
  fond_final_declare: number;
  cash_check?: number;
  cashing_verifie?: boolean;
  cashing_montant?: number;
  rack_check_verifie?: boolean;
  rack_check_montant?: number;
  rack_check_manquant?: number;
  commentaire?: string;
}

export interface QuickAddClientPayload {
  nom: string;
  prenom?: string;
  telephone?: string;
}

export interface CashOperationPayload {
  session_id: ID;
  montant: number;
  moyen_paiement: MoyenPaiement;
  client_id?: ID | null;
  client_libre?: string | null;
}

export interface ChipMovementPayload {
  session_id: ID;
  chip_type_id: ID;
  quantite: number;
  client_id?: ID | null;
  client_libre?: string | null;
  moyen_paiement: MoyenPaiement;
}

export interface ChipPaymentPayload {
  client_id: ID;
  chip_type_id: ID;
  quantite: number;
  module_cible: ModuleCiblePaiementJetons;
  reference_commande_id?: ID;
}

export interface CreditGrantPayload {
  client_id: ID;
  montant: number;
  echeance: string;
  session_id: ID;
}

export interface CreditDrawPayload {
  session_id: ID;
  montant: number;
  moyen_paiement: MoyenPaiement;
}

export interface CreditRepayPayload {
  montant: number;
  moyen_paiement: MoyenPaiement;
  session_id?: ID;
}

export interface ClientStatutPayload {
  statut_special: StatutSpecialClient;
  motif: string;
}

export interface ScoreDecisionPayload {
  decision: Exclude<DecisionScore, 'AUCUNE'>;
  commentaire?: string;
}

export interface CheckInPayload {
  room_id: ID;
  qr_code?: string;
  client_id?: ID;
  entree_via?: EntreeViaVisite;
}

// -------------------------------------------------------------------------
// UI-only helpers
// -------------------------------------------------------------------------

/** Client sélectionné en caisse, avec ou sans carte scannée. */
export interface SelectedPlayer {
  client: Client;
  card?: LoyaltyCard | null;
  via: 'QR' | 'MANUEL';
}

export const TYPE_SALLE_LABELS: Record<TypeSalle, string> = {
  VIP: 'VIP',
  POKER: 'Poker',
  MACHINES: 'Machines à sous',
  TABLE_JEUX: 'Table de jeux',
  AUTRE: 'Autre',
};

export const NIVEAU_CARTE_LABELS: Record<NiveauCarte, string> = {
  STANDARD: 'Standard',
  SILVER: 'Silver',
  GOLD: 'Gold',
  VIP: 'VIP',
};

export const STATUT_SPECIAL_LABELS: Record<StatutSpecialClient, string> = {
  NORMAL: 'Normal',
  VIP: 'VIP',
  A_SURVEILLER: 'À surveiller',
  EXCLU: 'Exclu',
  AUTO_EXCLU: 'Auto-exclu',
};

export const CATEGORIE_SCORE_LABELS: Record<string, string> = {
  BON: 'Bon payeur',
  MOYEN: 'Moyen payeur',
  MAUVAIS: 'Mauvais payeur',
};