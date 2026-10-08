/*
// ─── Entités ────────────────────────────────────────────────────────────────

export interface RoomType {
  id: number;
  nom: string;
  description: string;
  prix_base?: number;
}

export interface Room {
  id: number;
  room_type_id: number;
  numero: string;
  capacite: number;
  prix_nuit: number;
  statut: 'LIBRE' | 'OCCUPEE' | 'RESERVEE' | 'NETTOYAGE' | 'MAINTENANCE' | 'HORS_SERVICE';
  etage: number;
  room_type?: RoomType;
}

export interface Reservation {
  id: number;
  client_id: number;
  room_id: number;
  date_arrivee: string;
  date_depart: string;
  pdj_inclus?: boolean;
  montant_total: number;
  statut: 'CONFIRMEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
  client_nom?: string;
  client_prenom?: string;
  room_numero?: string;
}

export interface Equipment {
  id: number;
  code: string;
  nom: string;
  categorie: string;
  description: string;
}

export interface RoomEquipment {
  id: number;
  room_id: number;
  equipment_id: number;
  quantite: number;
  statut: 'BON' | 'EN_PANNE' | 'REMPLACE' | 'HORS_SERVICE';
  equipment?: Equipment;
}

export interface HousekeepingTask {
  id: number;
  room_id: number;
  assigned_user_id: number;
  type_tache: 'NETTOYAGE' | 'DESINFECTION' | 'CHANGEMENT_DRAPS' | 'CONTROLE';
  statut: 'A_FAIRE' | 'EN_COURS' | 'TERMINE';
  commentaire: string;
  planned_at: string;
  completed_at: string;
}

export interface RoomMaintenance {
  id: number;
  room_id: number;
  equipment_id: number;
  type_intervention: 'PREVENTIVE' | 'CORRECTIVE' | 'URGENCE';
  description: string;
  statut: 'OUVERT' | 'EN_COURS' | 'TERMINE' | 'ANNULE';
  date_declaration: string;
  date_resolution: string;
  cout: number;
}

export interface Client {
  is_casino_player?: boolean;
  id: number;
  code_client: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse: string;
}


// ─── Formulaires ─────────────────────────────────────────────────────────────

export interface ReservationForm {
  client_id: number;
  room_id: number;
  date_arrivee: string;
  date_depart: string;
  pdj_inclus?: boolean;
  montant_total: number;
  statut: 'CONFIRMEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
}

export interface RoomForm {
  room_type_id: number;
  numero: string;
  capacite: number;
  prix_nuit: number;
  statut: 'LIBRE' | 'OCCUPEE' | 'RESERVEE' | 'NETTOYAGE' | 'MAINTENANCE' | 'HORS_SERVICE';
  etage: number;
}

export interface EquipmentForm {
  room_id: number;
  equipment_id: number;
  quantite: number;
  statut: 'BON' | 'EN_PANNE' | 'REMPLACE' | 'HORS_SERVICE';
}

export interface HousekeepingForm {
  room_id: number;
  assigned_user_id: number;
  type_tache: 'NETTOYAGE' | 'DESINFECTION' | 'CHANGEMENT_DRAPS' | 'CONTROLE';
  commentaire: string;
  planned_at: string;
}

export interface MaintenanceForm {
  room_id: number;
  equipment_id: number;
  type_intervention: 'PREVENTIVE' | 'CORRECTIVE' | 'URGENCE';
  description: string;
  cout: number;
}

export interface ClientForm {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse: string;
  type_piece: string;
  numero_piece: string;
}
*/

// Empty exports to prevent module errors when commented out
export interface RoomType { id: number; nom: string; description: string; prix_base?: number; }
export interface Room { id: number; room_type_id: number; numero: string; capacite: number; prix_nuit: number; statut: 'LIBRE' | 'OCCUPEE' | 'RESERVEE' | 'NETTOYAGE' | 'MAINTENANCE' | 'HORS_SERVICE'; etage: number; room_type?: RoomType; }
export interface Reservation { id: number; client_id: number; room_id: number; date_arrivee: string; date_depart: string; pdj_inclus?: boolean; montant_total: number; statut: 'CONFIRMEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE'; client_nom?: string; client_prenom?: string; room_numero?: string; }
export interface Equipment { id: number; code: string; nom: string; categorie: string; description: string; }
export interface RoomEquipment { id: number; room_id: number; equipment_id: number; quantite: number; statut: 'BON' | 'EN_PANNE' | 'REMPLACE' | 'HORS_SERVICE'; equipment?: Equipment; }
export interface HousekeepingTask { id: number; room_id: number; assigned_user_id: number; type_tache: 'NETTOYAGE' | 'DESINFECTION' | 'CHANGEMENT_DRAPS' | 'CONTROLE'; statut: 'A_FAIRE' | 'EN_COURS' | 'TERMINE'; commentaire: string; planned_at: string; completed_at: string; }
export interface RoomMaintenance { id: number; room_id: number; equipment_id: number; type_intervention: 'PREVENTIVE' | 'CORRECTIVE' | 'URGENCE'; description: string; statut: 'OUVERT' | 'EN_COURS' | 'TERMINE' | 'ANNULE'; date_declaration: string; date_resolution: string; cout: number; }
export interface Client { is_casino_player?: boolean; id: number; code_client: string; nom: string; prenom: string; telephone: string; email: string; adresse: string; }
export interface ReservationForm { client_id: number; room_id: number; date_arrivee: string; date_depart: string; pdj_inclus?: boolean; montant_total: number; statut: 'CONFIRMEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE'; }
export interface RoomForm { room_type_id: number; numero: string; capacite: number; prix_nuit: number; statut: 'LIBRE' | 'OCCUPEE' | 'RESERVEE' | 'NETTOYAGE' | 'MAINTENANCE' | 'HORS_SERVICE'; etage: number; }
export interface EquipmentForm { room_id: number; equipment_id: number; quantite: number; statut: 'BON' | 'EN_PANNE' | 'REMPLACE' | 'HORS_SERVICE'; }
export interface HousekeepingForm { room_id: number; assigned_user_id: number; type_tache: 'NETTOYAGE' | 'DESINFECTION' | 'CHANGEMENT_DRAPS' | 'CONTROLE'; commentaire: string; planned_at: string; }
export interface MaintenanceForm { room_id: number; equipment_id: number; type_intervention: 'PREVENTIVE' | 'CORRECTIVE' | 'URGENCE'; description: string; cout: number; }
export interface ClientForm { nom: string; prenom: string; telephone: string; email: string; adresse: string; type_piece: string; numero_piece: string; }