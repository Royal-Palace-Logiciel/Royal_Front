// src/services/hotel.service.ts
//
// ⚠️ Adaptateur de compatibilité (et non plus un appel réseau direct).
// Ce service conserve l'ancienne interface (Chambre / Reservation, avec des
// champs comme `type`, `status`, `etage`, `chambre_id`) utilisée par du code
// existant, mais délègue désormais tous les appels réseau à room.service.ts
// et reservation.service.ts, qui sont eux alignés sur le schéma réel du
// backend (room_type_id / statut / room_id — voir models/hebergementModel.js
// et README §5.5). La conversion de champs se fait ici, à la frontière, pour
// que le reste de l'app puisse continuer à utiliser Chambre/Reservation sans
// rien changer.
//
// Pour du nouveau code, préférer directement roomService / roomTypeService /
// reservationService plutôt que ce wrapper.
import { roomService, roomTypeService } from './room.service';
import { reservationService, ReservationFormData } from './reservation.service';
import { Room } from '../types/hotel.types';

export interface Chambre {
  id: number;
  numero: string;
  type: string;
  prix: number;
  status: string;
  etage: number;
  capacite: number;
  created_at?: string;
  updated_at?: string;
}

export interface Reservation {
  id: number;
  chambre_id: number;
  client_id: number;
  date_arrivee: string;
  date_depart: string;
  montant_total: number;
  statut: string;
  created_at?: string;
  updated_at?: string;
}

// =============================================================
// Room (backend) <-> Chambre (interface legacy)
// =============================================================

function roomToChambre(room: Room & { room_type?: { nom?: string } }): Chambre {
  return {
    id: room.id,
    numero: room.numero,
    // Pas de champ `type` côté backend : on résout le nom du type de chambre
    // si l'objet imbriqué room_type a été renvoyé par l'API, sinon on retombe
    // sur l'identifiant brut (room_type_id) en dernier recours.
    type: room.room_type?.nom ?? String((room as any).room_type_id ?? ''),
    prix: (room as any).prix_nuit,
    status: (room as any).statut,
    // Utilise la valeur réelle de etage depuis le backend après migration
    etage: (room as any).etage ?? 0,
    capacite: room.capacite ?? 0,
    created_at: (room as any).created_at,
    updated_at: (room as any).updated_at,
  };
}

// Résout un room_type_id à partir d'un nom de type (ex: "Suite") en interrogeant
// le référentiel /room-types. Lève une erreur explicite si aucun type ne
// correspond, plutôt que d'envoyer une valeur invalide au backend.
async function resolveRoomTypeId(typeName?: string): Promise<number | undefined> {
  if (!typeName) return undefined;
  const roomTypes = await roomTypeService.getRoomTypes();
  const match = roomTypes.find((rt) => rt.nom.toLowerCase() === typeName.toLowerCase());
  if (!match) throw new Error(`Type de chambre "${typeName}" introuvable`);
  return match.id;
}

async function chambreToRoomPayload(data: Partial<Chambre>): Promise<Partial<Room>> {
  const payload: Partial<Room> = {};
  if (data.numero !== undefined) payload.numero = data.numero;
  if (data.capacite !== undefined) payload.capacite = data.capacite;
  if (data.prix !== undefined) (payload as any).prix_nuit = data.prix;
  if (data.status !== undefined) (payload as any).statut = data.status;
  if (data.etage !== undefined) (payload as any).etage = data.etage;
  if (data.type !== undefined) {
    const roomTypeId = await resolveRoomTypeId(data.type);
    if (roomTypeId !== undefined) (payload as any).room_type_id = roomTypeId;
  }
  return payload;
}

// =============================================================
// Reservation (backend) <-> Reservation (interface legacy)
// =============================================================

function toReservationFormData(data: Partial<Reservation>): Partial<ReservationFormData> {
  const payload: Partial<ReservationFormData> = {};
  if (data.chambre_id !== undefined) payload.room_id = data.chambre_id;
  if (data.client_id !== undefined) payload.client_id = data.client_id;
  if (data.date_arrivee !== undefined) payload.date_arrivee = data.date_arrivee;
  if (data.date_depart !== undefined) payload.date_depart = data.date_depart;
  if (data.montant_total !== undefined) payload.montant_total = data.montant_total;
  if (data.statut !== undefined) payload.statut = data.statut as ReservationFormData['statut'];
  return payload;
}

function fromBackendReservation(r: any): Reservation {
  return {
    id: r.id,
    chambre_id: r.room_id,
    client_id: r.client_id,
    date_arrivee: r.date_arrivee,
    date_depart: r.date_depart,
    montant_total: r.montant_total,
    statut: r.statut,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const hotelService = {
  // Chambres
  async getChambres(): Promise<Chambre[]> {
    try {
      const rooms = await roomService.getRooms();
      return rooms.map(roomToChambre);
    } catch (error) {
      console.error('❌ Erreur getChambres:', error);
      throw error;
    }
  },

  async createChambre(data: Partial<Chambre>): Promise<Chambre> {
    const payload = await chambreToRoomPayload(data);
    const room = await roomService.createRoom(payload as Omit<Room, 'id' | 'room_type'>);
    return roomToChambre(room);
  },

  async updateChambre(id: number, data: Partial<Chambre>): Promise<Chambre> {
    const payload = await chambreToRoomPayload(data);
    const room = await roomService.updateRoom(id, payload);
    return roomToChambre(room);
  },

  async deleteChambre(id: number): Promise<void> {
    await roomService.deleteRoom(id);
  },

  // Réservations
  async getReservations(): Promise<Reservation[]> {
    try {
      const reservations = await reservationService.getReservations();
      return reservations.map(fromBackendReservation);
    } catch (error) {
      console.error('❌ Erreur getReservations:', error);
      throw error;
    }
  },

  async createReservation(data: Partial<Reservation>): Promise<Reservation> {
    const payload = toReservationFormData(data);
    if (
      !payload.client_id || !payload.room_id ||
      !payload.date_arrivee || !payload.date_depart ||
      payload.montant_total === undefined
    ) {
      throw new Error('client_id, chambre_id, date_arrivee, date_depart et montant_total sont requis');
    }
    const reservation = await reservationService.createReservation(payload as ReservationFormData);
    return fromBackendReservation(reservation);
  },

  async updateReservation(id: number, data: Partial<Reservation>): Promise<Reservation> {
    const payload = toReservationFormData(data);
    const reservation = await reservationService.updateReservation(id, payload);
    return fromBackendReservation(reservation);
  },

  async deleteReservation(id: number): Promise<void> {
    await reservationService.deleteReservation(id);
  },

  // Statistiques
  async getHotelStats(): Promise<any> {
    try {
      return await roomService.getRoomStats();
    } catch (error) {
      console.error('❌ Erreur getHotelStats:', error);
      throw error;
    }
  }
};
