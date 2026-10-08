// types/hotel.types.ts

// ============================================
// Types de base
// ============================================

export interface RoomType {
  id: number;
  nom: string;
  description: string | null;
  prix_base?: number;
  capacite?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Room {
  id: number;
  room_type_id: number | null;
  numero: string;
  capacite: number | null;
  prix_nuit: number | null;
  statut: 'LIBRE' | 'OCCUPEE' | 'RESERVEE' | 'NETTOYAGE' | 'MAINTENANCE' | 'HORS_SERVICE';
  etage: number;
  room_type?: RoomType;
  created_at?: string;
  updated_at?: string;
}

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

export interface ReservationExtraService {
  type: 'TRANSFERT' | 'EXCURSION';
  description: string;
  date: string;
  heure: string;
  personnes: number;
  prix: number;
}

// Un encaissement d'une réservation : le paiement initial ou une rectification.
export interface ReservationPayment {
  id: number;
  reservation_id: number;
  montant: number;
  montant_encaisse?: number;
  montant_credit?: number;
  montant_gratuit?: number;
  moyen_paiement: string | null;
  statut?: string;
  // Ce qui était facturé au moment du paiement (sert à calculer les rectifications)
  details: {
    montant_total: number;
    laundry_price: number;
    services_extras: ReservationExtraService[];
    modes_paiement?: Array<{ moyen_paiement: string; montant: number }>;
    montant_cible?: number;
    statut_paiement_apres_operation?: string;
  } | null;
  created_by_nom?: string | null;
  created_by_prenom?: string | null;
  created_at: string;
}

export interface Reservation {
  id: number;
  client_id: number;
  room_id: number;
  date_arrivee: string;
  date_depart: string;
  pdj_inclus?: boolean;
  moyen_paiement?: 'ESPECES' | 'TPE' | 'MVOLA' | 'ORANGE_MONEY' | 'CARTE' | 'VIREMENT' | 'CREDIT' | 'GRATUIT';
  montant_total: number | null;
  montant_brut?: number | null;
  remise_pourcentage?: number;
  montant_remise?: number | null;
  remise_validee_par?: number | null;
  remise_validee_at?: string | null;
  statut: 'EN_ATTENTE' | 'CONFIRMEE' | 'CHECKED_IN' | 'EN_COURS' | 'ANNULEE' | 'TERMINEE' | 'NO_SHOW';
  type_reservation?: 'BOOKING' | 'ON_SITE';
  laundry_included?: boolean;
  laundry_price?: number;
  manual_price?: number;
  exchange_rate?: number;
  // Transferts / excursions : JSON (chaîne côté API) de ReservationExtraService[]
  services_extras?: string | ReservationExtraService[] | null;
  services_extras_total?: number | null;
  // Somme déjà encaissée ; reste à payer = montant_total - montant_paye
  montant_paye?: number | null;
  montant_encaisse?: number | null;
  montant_credit?: number | null;
  montant_gratuit?: number | null;
  montant_restant?: number | null;
  statut_paiement?: 'IMPAYE' | 'PARTIELLEMENT_PAYE' | 'PAYE' | 'CREDIT' | 'GRATUIT';
  est_payee?: boolean | number;
  client?: Client;
  room?: Room;
  created_by?: number | null;
  modified_by?: number | null;
  created_by_nom?: string;
  created_by_prenom?: string;
  modified_by_nom?: string;
  modified_by_prenom?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Stay {
  id: number;
  reservation_id: number | null;
  checkin_at: string | null;
  checkout_at: string | null;
  reservation?: Reservation;
  room?: Room;
  client?: Client;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Équipements et maintenance
// ============================================

export interface Equipment {
  id: number;
  code: string | null;
  nom: string;
  categorie: string | null;
  description: string | null;
  zone?: 'CHAMBRE' | 'SALLE_DE_BAIN';
  quantite?: number;
  is_consumable?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RoomEquipment {
  id: number;
  room_id: number;
  equipment_id: number;
  quantite: number;
  statut: 'BON' | 'EN_PANNE' | 'REMPLACE' | 'HORS_SERVICE';
  zone?: 'CHAMBRE' | 'SALLE_DE_BAIN';
  equipment?: Equipment;
  room?: Room;
  created_at?: string;
  updated_at?: string;
}

export interface RoomMaintenance {
  id: number;
  room_id: number;
  equipment_id: number | null;
  type_intervention: 'PLOMBERIE' | 'ELECTRICITE' | 'MACONNERIE' | 'CLIMATISATION' | 'AUTRE';
  description: string | null;
  statut: 'OUVERT' | 'EN_COURS' | 'TERMINE' | 'ANNULE';
  date_declaration: string;
  date_resolution: string | null;
  cout: number;
  created_by: number | null;
  room?: Room;
  equipment?: Equipment;
  created_at?: string;
  updated_at?: string;
  location?: string | null;
  equipment_label?: string | null;
  worker_id?: number | null;
  execution_date?: string | null;
  finish_date?: string | null;
  materials_cost?: number;
  labor_cost?: number;
  total_cost?: number;
  materials_used?: Array<{ product_id: number; quantity: number }>;
  materials_cost?: number;
  labor_cost?: number;
  total_cost?: number;
}

export interface MaintenanceWorker {
  id: number;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  specialite: string | null;
  date_debut: string | null;
  date_fin: string | null;
  statut: 'ACTIF' | 'INACTIF';
  photo_url?: string | null;
  id_photo_url?: string | null;
  contract_url?: string | null;
  quote_url?: string | null;
  time_slot?: string | null;
}

// ============================================
// Ménage et tâches
// ============================================

export interface HousekeepingTask {
  id: number;
  room_id: number;
  assigned_user_id: number | null;
  type_tache: 'POST_OCCUPANCY' | 'AFTER_OCCUPANCY' | 'DEEP_CLEANING' | 'EXCEPTIONAL' | 'CHAMBRE' | 'ESCALIER_RAMPE' | 'DECORATIONS' | 'MUR' | 'PLAFOND' | 'SOL_MOQUETTE' | 'MEUBLES' | 'COULOIR' | 'TERASSE' | 'TOILETTES';
  statut: 'A_FAIRE' | 'EN_COURS' | 'TERMINE';
  commentaire: string | null;
  planned_at: string | null;
  completed_at: string | null;
  exceptional_details?: string | null;
  room?: Room;
  assigned_user?: User;
  created_at?: string;
  updated_at?: string;
  products_used?: Array<{ product_id: number; quantity: number }>;
}

// ============================================
// Produits et Minibar
// ============================================

export interface Product {
  id: number;
  category_id: number | null;
  code: string | null;
  nom: string;
  unite: string;
  prix_achat: number;
  prix_vente: number;
  actif: boolean;
  type_produit: 'CONSOMMABLE' | 'EQUIPEMENT' | 'SERVICE' | 'AUTRE';
  description?: string | null;
  stock_min?: number;
  stock_max?: number;
  category?: ProductCategory;
  created_at?: string;
  updated_at?: string;
}

export interface ProductCategory {
  id: number;
  nom: string;
  description: string | null;
  parent_id: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface MinibarItem {
  id: number;
  room_id: number;
  product_id: number;
  quantite: number;
  seuil_alerte: number;
  product?: Product;
  room?: Room;
  created_at?: string;
  updated_at?: string;
}

export interface MinibarConsumption {
  id: number;
  room_id: number;
  client_id: number;
  product_id: number;
  quantite: number;
  prix_unitaire: number;
  montant: number;
  facturee: boolean;
  consumed_at: string;
  product?: Product;
  room?: Room;
  client?: Client;
  created_at?: string;
  updated_at?: string;
}

export interface MinibarRestock {
  id: number;
  room_id: number;
  product_id: number;
  quantite_avant: number;
  quantite_ajoutee: number;
  quantite_apres: number;
  restocked_by: number;
  restocked_at: string;
  product?: Product;
  room?: Room;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Notes et documents
// ============================================

export interface RoomNote {
  id: number;
  room_id: number;
  user_id: number;
  note: string;
  type: 'GENERALE' | 'PROBLEME' | 'DEMANDE' | 'RAPPEL';
  pinned: boolean;
  room?: Room;
  user?: User;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Utilisateurs
// ============================================

export interface User {
  id?: number;
  id_admin: number; // Primary ID field for users
  email: string;
  nom: string;
  prenom: string;
  role: 'ADMIN' | 'RECEPTION' | 'SERVEUR' | 'MENAGE' | 'MAINTENANCE' | 'MANAGER';
  telephone: string | null;
  actif: boolean;
  photo_url: string | null;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Statistiques et rapports
// ============================================

export interface RoomStats {
  total_rooms: number;
  occupied: number;
  free: number;
  reserved: number;
  maintenance: number;
  occupancy_rate: number;
  total_revenue: number;
  average_price: number;
}

export interface MinibarStats {
  total_items: number;
  total_rooms_equipped: number;
  total_products: number;
  alerts: number;
  total_consumptions: number;
  total_revenue: number;
  top_consumed_products: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
    revenue: number;
  }>;
}

// ============================================
// Types pour les requêtes API
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  count?: number;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FilterParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  startDate?: string;
  endDate?: string;
}

export interface RoomFilterParams extends FilterParams {
  statut?: Room['statut'];
  room_type_id?: number;
  capacite_min?: number;
  capacite_max?: number;
  prix_min?: number;
  prix_max?: number;
}

export interface ConsumptionFilterParams extends FilterParams {
  room_id?: number;
  client_id?: number;
  product_id?: number;
  facturee?: boolean;
  startDate?: string;
  endDate?: string;
}

// ============================================
// Types pour les formulaires
// ============================================

export interface RoomFormData {
  numero: string;
  room_type_id: number | null;
  capacite: number | null;
  prix_nuit: number | null;
  statut: Room['statut'];
  etage: number;
}

export interface MinibarItemFormData {
  room_id: number;
  product_id: number;
  quantite: number;
  seuil_alerte: number;
}

export interface MinibarConsumptionFormData {
  room_id: number;
  client_id: number;
  product_id: number;
  quantite: number;
  prix_unitaire: number;
  facturee?: boolean;
}

// ============================================
// Types pour l'état global (Redux/Context)
// ============================================

export interface HotelState {
  rooms: Room[];
  clients: Client[];
  reservations: Reservation[];
  products: Product[];
  minibarItems: MinibarItem[];
  consumptions: MinibarConsumption[];
  loading: boolean;
  error: string | null;
  selectedRoom: Room | null;
  selectedClient: Client | null;
}

// ============================================
// Types pour les notifications
// ============================================

export interface Notification {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  duration?: number;
  read: boolean;
  created_at: string;
}

// ============================================
// Types pour les événements en temps réel (WebSocket)
// ============================================

export interface MinibarEvent {
  type: 'CONSUMPTION' | 'RESTOCK' | 'ALERT' | 'UPDATE';
  room_id: number;
  product_id?: number;
  data: any;
  timestamp: string;
}

export interface RoomStatusEvent {
  type: 'STATUS_CHANGE';
  room_id: number;
  old_status: Room['statut'];
  new_status: Room['statut'];
  timestamp: string;
}

// ============================================
// Utilitaires de type
// ============================================

export type StatusColors = {
  [K in NonNullable<Room['statut']>]: string;
};

export const RoomStatusColors: StatusColors = {
  LIBRE: 'text-success bg-success/10',
  OCCUPEE: 'text-info bg-info/10',
  RESERVEE: 'text-warning bg-warning/10',
  NETTOYAGE: 'text-primary bg-primary/10',
  MAINTENANCE: 'text-danger bg-danger/10',
  HORS_SERVICE: 'text-muted bg-muted/10',
};

export type ProductTypeColors = {
  [K in Product['type_produit']]: string;
};

export const ProductTypeColors: ProductTypeColors = {
  CONSOMMABLE: 'text-success bg-success/10',
  EQUIPEMENT: 'text-info bg-info/10',
  SERVICE: 'text-warning bg-warning/10',
  AUTRE: 'text-muted bg-muted/10',
};

// ============================================
// Types pour les rapports et exports
// ============================================

export interface RoomReport {
  room_id: number;
  room_numero: string;
  client_nom?: string;
  checkin_at?: string;
  checkout_at?: string;
  nights: number;
  total_revenue: number;
  consumptions_amount: number;
  minibar_restocks: number;
}

export interface MinibarReport {
  room_numero: string;
  product_nom: string;
  quantite_consommee: number;
  prix_unitaire: number;
  montant_total: number;
  facturee: boolean;
  consumed_at: string;
}

// --- Rapport journalier : « Situation du chambre durant la Nuité » ---

/** Codes du bas de page du rapport manuscrit (CP, CN, NP, BK...). */
export type HotelDailyReportRoomState =
  | 'LIBRE'
  | 'OCCUPEE'
  | 'BK'
  | 'CP'
  | 'CN'
  | 'NP'
  | 'GRATUIT'
  | 'MAINTENANCE';

/**
 * Une ligne du rapport, pour une chambre. Les montants et dates restent des
 * chaînes libres : la réception saisit aussi bien « 69,30€ », « 210.000ar » que
 * « ND » (non défini), comme sur le modèle papier.
 */
export interface HotelDailyReportRoomLine {
  room_id: number | null;
  numero: string;
  etat: HotelDailyReportRoomState;
  /** Nom de l'occupant, ou « libre » / « CP » quand la chambre n'est pas occupée. */
  occupant: string;
  /** Mention accolée au nom : « Booking », « (Chambre gratuit) »... */
  note: string;
  /** DA — date d'arrivée */
  da: string;
  /** DD — date de départ */
  dd: string;
  /** MT — montant */
  mt: string;
  /** P — paiement (moyen, encaisseur, date) */
  p: string;
  /** CN — crédit non payé */
  cn: string;
  /** E — emprunté */
  e: string;
  /** AC — autre crédit */
  ac: string;
}

export interface HotelDailyReportMetrics {
  chambres_total: number;
  chambres_occupees: number;
  chambres_libres: number;
  total_paye: number;
  total_credit: number;
  /** TE — total emprunté (somme des lignes E). */
  total_emprunte: number;
}

/**
 * Ce que la génération automatique ne peut pas redéduire des chambres et des
 * réservations, et qu'il faut donc conserver pour ne pas écraser le travail de la
 * réception à la régénération suivante.
 */
export interface HotelDailyReportAutoState {
  /** Corrections manuelles, par numéro de chambre puis par champ. */
  overrides: Record<string, Partial<HotelDailyReportRoomLine>>;
  /** Chambres retirées du rapport malgré leur présence en base. */
  removed: string[];
  /** Chambres ajoutées à la main (hors référentiel des chambres). */
  extra: HotelDailyReportRoomLine[];
  /** Heures saisies par la réception : elles ne sont plus rafraîchies. */
  heureDebutManuelle: boolean;
  heureFinManuelle: boolean;
}

export interface HotelDailyReport {
  id?: number;
  reportDate: string;
  /** Heure de début de la nuitée, ex. « 17h08 ». */
  heureDebut: string;
  /** Heure de fin de la nuitée, ex. « 5h51 ». */
  heureFin: string;
  receptionniste: string;
  rooms: HotelDailyReportRoomLine[];
  observations: string;
  metrics?: Partial<HotelDailyReportMetrics>;
  autoState?: HotelDailyReportAutoState | null;
  createdBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// Types pour les autorisations
// ============================================

export interface Permission {
  id: number;
  name: string;
  resource: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'MANAGE';
  description?: string;
}

export interface Role {
  id: number;
  name: string;
  permissions: Permission[];
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Types pour l'audit
// ============================================

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  resource_type: string;
  resource_id: number;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  ip_address: string;
  user_agent: string;
  created_at: string;
  user?: User;
}