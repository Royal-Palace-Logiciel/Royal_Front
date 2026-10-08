/*
import React from 'react';
import { Calendar, BedDouble, Settings, Wrench, Package, DollarSign } from 'lucide-react';
import { Client, Equipment, HousekeepingTask, Reservation, Room, RoomEquipment, RoomMaintenance, RoomType } from '../types/hebergement.type';

// ─── Tabs ────────────────────────────────────────────────────────────────────

export const TABS = [
  { id: 'reservations', label: 'Réservations', icon: <Calendar size={16} /> },
  { id: 'chambres',     label: 'Chambres',     icon: <BedDouble size={16} /> },
  { id: 'equipements',  label: 'Équipements',  icon: <Settings size={16} /> },
  { id: 'housekeeping', label: 'Ménage',        icon: <Settings size={16} /> },
  { id: 'maintenance',  label: 'Maintenance',  icon: <Wrench size={16} /> },
  { id: 'stock',        label: 'Stock',        icon: <Package size={16} /> },
  { id: 'caisse',       label: 'Caisse',       icon: <DollarSign size={16} /> },
];

// ─── Status maps ─────────────────────────────────────────────────────────────

export const STATUTS_ROOM: Record<Room['statut'], { label: string; variant: string }> = {
  LIBRE:        { label: 'Libre',        variant: 'success'   },
  OCCUPEE:      { label: 'Occupée',      variant: 'warning'   },
  RESERVEE:     { label: 'Réservée',     variant: 'info'      },
  NETTOYAGE:    { label: 'Nettoyage',    variant: 'secondary' },
  MAINTENANCE:  { label: 'Maintenance',  variant: 'danger'    },
  HORS_SERVICE: { label: 'Hors service', variant: 'danger'    },
};

export const STATUTS_RESERVATION: Record<string, { label: string; variant: string }> = {
  CONFIRMEE: { label: 'Confirmée', variant: 'success'   },
  EN_COURS:  { label: 'En cours',  variant: 'warning'   },
  TERMINEE:  { label: 'Terminée',  variant: 'secondary' },
  ANNULEE:   { label: 'Annulée',   variant: 'danger'    },
  // Tolérances pour prévenir les décalages de clés
  'Confirmée': { label: 'Confirmée', variant: 'success' },
  'En cours':  { label: 'En cours',  variant: 'warning' },
};

export const STATUTS_EQUIPMENT: Record<RoomEquipment['statut'], { label: string; variant: string }> = {
  BON:          { label: 'Bon',          variant: 'success' },
  EN_PANNE:     { label: 'En panne',     variant: 'danger'  },
  REMPLACE:     { label: 'Remplacé',     variant: 'warning' },
  HORS_SERVICE: { label: 'Hors service', variant: 'danger'  },
};

export const STATUTS_HOUSEKEEPING: Record<HousekeepingTask['statut'], { label: string; variant: string }> = {
  A_FAIRE:  { label: 'À faire',   variant: 'warning' },
  EN_COURS: { label: 'En cours',  variant: 'info'    },
  TERMINE:  { label: 'Terminé',   variant: 'success' },
};

export const STATUTS_MAINTENANCE: Record<RoomMaintenance['statut'], { label: string; variant: string }> = {
  OUVERT:   { label: 'Ouvert',   variant: 'danger'    },
  EN_COURS: { label: 'En cours', variant: 'warning'   },
  TERMINE:  { label: 'Terminé',  variant: 'success'   },
  ANNULE:   { label: 'Annulé',   variant: 'secondary' },
};

// ─── Données initiales (mock) ────────────────────────────────────────────────

export const INITIAL_ROOM_TYPES: RoomType[] = [
  { id: 1, nom: 'Standard',  description: 'Chambre standard confortable' },
  { id: 2, nom: 'Deluxe',    description: 'Chambre deluxe avec vue'      },
  { id: 3, nom: 'Suite',     description: 'Suite luxueuse avec salon'    },
  { id: 4, nom: 'VIP',       description: 'Suite présidentielle'         },
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 1, code_client: 'CL001', nom: 'Rakoto', prenom: 'Jean', telephone: '+261 34 123 4567', email: 'jean@email.com', adresse: 'Antananarivo',
    is_casino_player: undefined
  },
  {
    id: 2, code_client: 'CL002', nom: 'Rabe', prenom: 'Marie', telephone: '+261 33 987 6543', email: 'marie@email.com', adresse: 'Antananarivo',
    is_casino_player: undefined
  },
];

export const INITIAL_EQUIPMENTS: Equipment[] = [
  { id: 1, code: 'EQ001', nom: 'Téléviseur LED 55"', categorie: 'Electronique',  description: 'TV 4K Smart'             },
  { id: 2, code: 'EQ002', nom: 'Climatisation',       categorie: 'Climatisation', description: 'Réversible 12000 BTU'   },
  { id: 3, code: 'EQ003', nom: 'Coffre-fort',          categorie: 'Sécurité',      description: 'Coffre électronique'    },
  { id: 4, code: 'EQ004', nom: 'Réfrigérateur',        categorie: 'Electroménager',description: 'Mini-bar'               },
];

export const INITIAL_ROOMS: Room[] = [
  { id: 1, room_type_id: 1, numero: '101', capacite: 2, prix_nuit: 150000,  statut: 'LIBRE',    etage: 1 },
  { id: 2, room_type_id: 1, numero: '102', capacite: 2, prix_nuit: 150000,  statut: 'OCCUPEE',  etage: 1 },
  { id: 3, room_type_id: 2, numero: '201', capacite: 3, prix_nuit: 250000,  statut: 'LIBRE',    etage: 2 },
  { id: 4, room_type_id: 3, numero: '301', capacite: 4, prix_nuit: 450000,  statut: 'RESERVEE', etage: 3 },
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  { id: 1, client_id: 1, room_id: 2, date_arrivee: '2026-06-25', date_depart: '2026-06-28', montant_total: 450000,  statut: 'CONFIRMEE' },
  { id: 2, client_id: 2, room_id: 4, date_arrivee: '2026-06-26', date_depart: '2026-06-30', montant_total: 1800000, statut: 'CONFIRMEE' },
];

export const INITIAL_ROOM_EQUIPMENTS: RoomEquipment[] = [
  { id: 1, room_id: 1, equipment_id: 1, quantite: 1, statut: 'BON' },
  { id: 2, room_id: 1, equipment_id: 2, quantite: 1, statut: 'BON' },
  { id: 3, room_id: 1, equipment_id: 3, quantite: 1, statut: 'BON' },
];

export const INITIAL_HOUSEKEEPING: HousekeepingTask[] = [
  { id: 1, room_id: 1, assigned_user_id: 1, type_tache: 'NETTOYAGE',        statut: 'A_FAIRE', commentaire: 'Nettoyage complet', planned_at: '2026-06-24 08:00', completed_at: '' },
  { id: 2, room_id: 2, assigned_user_id: 1, type_tache: 'CHANGEMENT_DRAPS', statut: 'TERMINE', commentaire: 'Draps changés',    planned_at: '2026-06-23 10:00', completed_at: '2026-06-23 10:30' },
];

export const INITIAL_MAINTENANCES: RoomMaintenance[] = [
  { id: 1, room_id: 1, equipment_id: 2, type_intervention: 'CORRECTIVE', description: 'Climatisation ne refroidit plus', statut: 'OUVERT', date_declaration: '2026-06-23 14:00', date_resolution: '', cout: 0 },
];
*/

// Empty exports to prevent module errors when commented out
import React from 'react';
import { Calendar, BedDouble, Settings, Wrench, Package, DollarSign } from 'lucide-react';

export const TABS = [
  { id: 'reservations', label: 'Réservations', icon: <Calendar size={16} /> },
  { id: 'chambres',     label: 'Chambres',     icon: <BedDouble size={16} /> },
  { id: 'equipements',  label: 'Équipements',  icon: <Settings size={16} /> },
  { id: 'housekeeping', label: 'Ménage',        icon: <Settings size={16} /> },
  { id: 'maintenance',  label: 'Maintenance',  icon: <Wrench size={16} /> },
  { id: 'stock',        label: 'Stock',        icon: <Package size={16} /> },
  { id: 'caisse',       label: 'Caisse',       icon: <DollarSign size={16} /> },
];

export const STATUTS_ROOM: Record<string, { label: string; variant: string }> = {
  LIBRE: { label: 'Libre', variant: 'success' },
  OCCUPEE: { label: 'Occupée', variant: 'warning' },
  RESERVEE: { label: 'Réservée', variant: 'info' },
  NETTOYAGE: { label: 'Nettoyage', variant: 'secondary' },
  MAINTENANCE: { label: 'Maintenance', variant: 'danger' },
  HORS_SERVICE: { label: 'Hors service', variant: 'danger' },
};

export const STATUTS_RESERVATION: Record<string, { label: string; variant: string }> = {
  CONFIRMEE: { label: 'Confirmée', variant: 'success' },
  EN_COURS: { label: 'En cours', variant: 'warning' },
  TERMINEE: { label: 'Terminée', variant: 'secondary' },
  ANNULEE: { label: 'Annulée', variant: 'danger' },
};

export const STATUTS_EQUIPMENT: Record<string, { label: string; variant: string }> = {
  BON: { label: 'Bon', variant: 'success' },
  EN_PANNE: { label: 'En panne', variant: 'danger' },
  REMPLACE: { label: 'Remplacé', variant: 'warning' },
  HORS_SERVICE: { label: 'Hors service', variant: 'danger' },
};

export const STATUTS_HOUSEKEEPING: Record<string, { label: string; variant: string }> = {
  A_FAIRE: { label: 'À faire', variant: 'warning' },
  EN_COURS: { label: 'En cours', variant: 'info' },
  TERMINE: { label: 'Terminé', variant: 'success' },
};

export const STATUTS_MAINTENANCE: Record<string, { label: string; variant: string }> = {
  OUVERT: { label: 'Ouvert', variant: 'danger' },
  EN_COURS: { label: 'En cours', variant: 'warning' },
  TERMINE: { label: 'Terminé', variant: 'success' },
  ANNULE: { label: 'Annulé', variant: 'secondary' },
};

export const INITIAL_ROOM_TYPES: any[] = [];
export const INITIAL_CLIENTS: any[] = [];
export const INITIAL_EQUIPMENTS: any[] = [];
export const INITIAL_ROOMS: any[] = [];
export const INITIAL_RESERVATIONS: any[] = [];
export const INITIAL_ROOM_EQUIPMENTS: any[] = [];
export const INITIAL_HOUSEKEEPING: any[] = [];
export const INITIAL_MAINTENANCES: any[] = [];