// Accommodation hook is currently disabled
// Providing empty hook implementation to prevent import errors

import { useState } from 'react';
import { Client, ClientForm, Equipment, EquipmentForm, HousekeepingForm, HousekeepingTask, MaintenanceForm, Reservation, ReservationForm, Room, RoomEquipment, RoomForm, RoomMaintenance, RoomType } from '../types/hebergement.type';

export function useHebergement() {
  return {
    roomTypes: [],
    clients: [],
    equipments: [],
    rooms: [],
    reservations: [],
    roomEquipments: [],
    housekeepingTasks: [],
    maintenances: [],
    loading: false,
    error: null,
    refetch: () => {},
    activeTab: 'reservations',
    setActiveTab: () => {},
    searchQuery: '',
    setSearchQuery: () => {},
    filterStatus: '',
    setFilterStatus: () => {},
    editingId: null,
    stats: { totalReservations: 0, enCours: 0, chambresOccupees: 0, chambresLibres: 0 },
    showReservationModal: false,
    setShowReservationModal: () => {},
    showRoomModal: false,
    setShowRoomModal: () => {},
    showEquipmentModal: false,
    setShowEquipmentModal: () => {},
    showHousekeepingModal: false,
    setShowHousekeepingModal: () => {},
    showMaintenanceModal: false,
    setShowMaintenanceModal: () => {},
    showClientModal: false,
    setShowClientModal: () => {},
    reservationForm: {} as ReservationForm,
    setReservationForm: () => {},
    roomForm: {} as RoomForm,
    setRoomForm: () => {},
    equipmentForm: {} as EquipmentForm,
    setEquipmentForm: () => {},
    housekeepingForm: {} as HousekeepingForm,
    setHousekeepingForm: () => {},
    maintenanceForm: {} as MaintenanceForm,
    setMaintenanceForm: () => {},
    clientForm: {} as ClientForm,
    setClientForm: () => {},
    handleCheckIn: () => {},
    handleCheckOut: () => {},
    handleCancelReservation: () => {},
    handleDeleteReservation: () => {},
    handleSaveReservation: () => {},
    handleEditRoom: () => {},
    handleDeleteRoom: () => {},
    handleSaveRoom: () => {},
    openNewRoomModal: () => {},
    handleEditRoomEquipment: () => {},
    handleDeleteRoomEquipment: () => {},
    handleSaveEquipment: () => {},
    openNewEquipmentModal: () => {},
    handleStartTask: () => {},
    handleCompleteTask: () => {},
    handleDeleteTask: () => {},
    handleSaveHousekeeping: () => {},
    openNewHousekeepingModal: () => {},
    handleStartMaintenance: () => {},
    handleCompleteMaintenance: () => {},
    handleDeleteMaintenance: () => {},
    handleSaveMaintenance: () => {},
    openNewMaintenanceModal: () => {},
    handleSaveClient: () => {},
  };
}

/*
// Original accommodation hook code (commented out)
import { useState, useEffect, useCallback } from 'react';
import { Client, ClientForm, Equipment, EquipmentForm, HousekeepingForm, HousekeepingTask, MaintenanceForm, Reservation, ReservationForm, Room, RoomEquipment, RoomForm, RoomMaintenance, RoomType } from '../types/hebergement.type';
import { roomService, roomTypeService } from '../services/room.service';
import { reservationService } from '../services/reservation.service';
import { equipmentService } from '../services/equipment.service';
import { clientService } from '../services/client.service';
import { housekeepingService } from '../services/housekeeping.service';
import { maintenanceService } from '../services/maintenance.service';
import AuthService from '../services/authService';
import { getDefaultTabForRole } from '../utils/permissions';

// ─── Valeurs par défaut des formulaires ──────────────────────────────────────

const DEFAULT_RESERVATION_FORM: ReservationForm = {
  client_id: 0, room_id: 0, date_arrivee: '', date_depart: '', montant_total: 0, statut: 'CONFIRMEE',
};
const DEFAULT_ROOM_FORM: RoomForm = {
  room_type_id: 0, numero: '', capacite: 2, prix_nuit: 0, statut: 'LIBRE', etage: 0,
};
const DEFAULT_EQUIPMENT_FORM: EquipmentForm = {
  room_id: 0, equipment_id: 0, quantite: 1, statut: 'BON',
};
const DEFAULT_HOUSEKEEPING_FORM: HousekeepingForm = {
  room_id: 0, assigned_user_id: 0, type_tache: 'NETTOYAGE', commentaire: '', planned_at: '',
};
const DEFAULT_MAINTENANCE_FORM: MaintenanceForm = {
  room_id: 0, equipment_id: 0, type_intervention: 'CORRECTIVE', description: '', cout: 0,
};
const DEFAULT_CLIENT_FORM: ClientForm = {
  nom: '', prenom: '', telephone: '', email: '', adresse: '', type_piece: '', numero_piece: '',
};

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useHebergement() {
  // ── Données ──────────────────────────────────────────────────────────────
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [roomEquipments, setRoomEquipments] = useState<RoomEquipment[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [maintenances, setMaintenances] = useState<RoomMaintenance[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Chargement depuis l'API ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomsData, reservationsData, roomTypesData, clientsData, equipmentsData, roomEquipmentsData, housekeepingData, maintenancesData] = await Promise.all([
        roomService.getRooms().catch(() => []),
        reservationService.getReservations().catch(() => []),
        roomTypeService.getRoomTypes().catch(() => []),
        clientService.getClients().catch(() => []),
        equipmentService.getEquipments().catch(() => []),
        equipmentService.getRoomEquipments().catch(() => []),
        housekeepingService.getTasks().catch(() => []),
        maintenanceService.getMaintenances().catch(() => []),
      ]);

      setRooms(Array.isArray(roomsData) ? roomsData as Room[] : []);
      setReservations(Array.isArray(reservationsData) ? reservationsData as Reservation[] : []);
      setRoomTypes(Array.isArray(roomTypesData) ? roomTypesData as RoomType[] : []);
      setClients(Array.isArray(clientsData) ? clientsData as Client[] : []);
      setEquipments(Array.isArray(equipmentsData) ? equipmentsData as Equipment[] : []);
      setRoomEquipments(Array.isArray(roomEquipmentsData) ? roomEquipmentsData as RoomEquipment[] : []);
      setHousekeepingTasks(Array.isArray(housekeepingData) ? housekeepingData as HousekeepingTask[] : []);
      setMaintenances(Array.isArray(maintenancesData) ? maintenancesData as RoomMaintenance[] : []);
    } catch (err: any) {
      console.error('Erreur lors du chargement des données d'hébergement :', err);
      setError('Erreur lors du chargement des données d'hébergement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── UI ───────────────────────────────────────────────────────────────────
  const currentUser = AuthService.getCurrentUser();
  const [activeTab, setActiveTab] = useState(() => getDefaultTabForRole('reservations', currentUser?.role));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  // ── Modales ───────────────────────────────────────────────────────────────
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showHousekeepingModal, setShowHousekeepingModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  // ── Formulaires ───────────────────────────────────────────────────────────
  const [reservationForm, setReservationForm] = useState<ReservationForm>(DEFAULT_RESERVATION_FORM);
  const [roomForm, setRoomForm] = useState<RoomForm>(DEFAULT_ROOM_FORM);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentForm>(DEFAULT_EQUIPMENT_FORM);
  const [housekeepingForm, setHousekeepingForm] = useState<HousekeepingForm>(DEFAULT_HOUSEKEEPING_FORM);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>(DEFAULT_MAINTENANCE_FORM);
  const [clientForm, setClientForm] = useState<ClientForm>(DEFAULT_CLIENT_FORM);

  // ── Handlers : réservations ───────────────────────────────────────────────
  const handleCheckIn = async (reservation: Reservation) => {
    try {
      await reservationService.checkIn(reservation.id);
      await fetchData();
    } catch (err: any) {
      console.error('Erreur lors du check-in :', err);
      setError(err?.response?.data?.error || err?.message || 'Impossible de valider le check-in.');
    }
  };

  const handleCheckOut = async (reservation: Reservation) => {
    try {
      const reservationId = Number(reservation.id);
      const stays = await reservationService.getStays({ reservation_id: reservationId });
      // MySQL numeric ids can arrive as strings depending on the driver/API
      // serialization. Compare normalized values so an active stay is found.
      const stay = stays.find((s) => Number(s.reservation_id) === reservationId && !s.checkout_at);
      if (!stay) {
        throw new Error('Séjour introuvable pour cette réservation');
      }
      await reservationService.checkOut(stay.id);
      await reservationService.updateReservationStatus(reservation.id, 'TERMINEE');
      await fetchData();
    } catch (err: any) {
      console.error('Erreur lors du check-out :', err);
      setError('Impossible de valider le check-out.');
    }
  };

  const handleCancelReservation = async (id: number) => {
    if (window.confirm('Annuler cette réservation ?')) {
      try {
        await reservationService.updateReservationStatus(id, 'ANNULEE');
        await fetchData();
      } catch (err) {
        setReservations(prev => prev.map(r => r.id === id ? { ...r, statut: 'ANNULEE' } : r));
      }
    }
  };

  const handleDeleteReservation = async (id: number) => {
    if (!window.confirm('Supprimer définitivement cette réservation ?')) return;

    try {
      await reservationService.deleteReservation(id);
      await fetchData();
    } catch (err) {
      console.error('Erreur lors de la suppression de la réservation :', err);
      setError('Impossible de supprimer la réservation.');
    }
  };

  const handleSaveReservation = async () => {
    try {
      await reservationService.createReservation(reservationForm);
      await fetchData();
    } catch (err) {
      const newReservation: Reservation = { ...reservationForm, id: Date.now() };
      setReservations(prev => [...prev, newReservation]);
    } finally {
      setShowReservationModal(false);
      setReservationForm(DEFAULT_RESERVATION_FORM);
    }
  };

  // ── Handlers : chambres ───────────────────────────────────────────────────
  const handleEditRoom = (room: Room) => {
    setEditingId(room.id);
    setRoomForm({
      room_type_id: room.room_type_id,
      numero: room.numero,
      capacite: room.capacite,
      prix_nuit: room.prix_nuit,
      statut: room.statut,
      etage: room.etage,
    });
    setShowRoomModal(true);
  };

  const handleDeleteRoom = async (id: number) => {
    if (window.confirm('Supprimer cette chambre ?')) {
      try {
        await roomService.deleteRoom(id);
        await fetchData();
      } catch (err) {
        setRooms(prev => prev.filter(r => r.id !== id));
      }
    }
  };

  const handleSaveRoom = async () => {
    try {
      if (editingId) {
        await roomService.updateRoom(editingId, roomForm);
      } else {
        await roomService.createRoom(roomForm);
      }
      await fetchData();
    } catch (err) {
      if (editingId) {
        setRooms(prev => prev.map(r => r.id === editingId ? { ...r, ...roomForm } : r));
      } else {
        setRooms(prev => [...prev, { ...roomForm, id: Date.now() }]);
      }
    } finally {
      setShowRoomModal(false);
      setEditingId(null);
      setRoomForm(DEFAULT_ROOM_FORM);
    }
  };

  const openNewRoomModal = () => {
    setEditingId(null);
    setRoomForm(DEFAULT_ROOM_FORM);
    setShowRoomModal(true);
  };

  // ── Handlers : équipements ────────────────────────────────────────────────
  const handleEditRoomEquipment = (re: RoomEquipment) => {
    setEditingId(re.id);
    setEquipmentForm({
      room_id: re.room_id,
      equipment_id: re.equipment_id,
      quantite: re.quantite,
      statut: re.statut,
    });
    setShowEquipmentModal(true);
  };

  const handleDeleteRoomEquipment = async (id: number) => {
    if (window.confirm('Supprimer cet équipement de la chambre ?')) {
      try {
        await equipmentService.deleteRoomEquipment(id);
        await fetchData();
      } catch (err) {
        setRoomEquipments(prev => prev.filter(re => re.id !== id));
      }
    }
  };

  const handleSaveEquipment = async () => {
    try {
      if (editingId) {
        await equipmentService.updateRoomEquipment(editingId, equipmentForm);
      } else {
        await equipmentService.assignEquipment(equipmentForm);
      }
      await fetchData();
    } catch (err) {
      if (editingId) {
        setRoomEquipments(prev => prev.map(re => re.id === editingId ? { ...re, ...equipmentForm } : re));
      } else {
        setRoomEquipments(prev => [...prev, { ...equipmentForm, id: Date.now() }]);
      }
    } finally {
      setShowEquipmentModal(false);
      setEditingId(null);
      setEquipmentForm(DEFAULT_EQUIPMENT_FORM);
    }
  };

  const openNewEquipmentModal = () => {
    setEditingId(null);
    setEquipmentForm(DEFAULT_EQUIPMENT_FORM);
    setShowEquipmentModal(true);
  };

  // ── Handlers : housekeeping ───────────────────────────────────────────────
  const handleStartTask = async (id: number) => {
    try {
      await housekeepingService.updateTaskStatus(id, 'EN_COURS');
      await fetchData();
    } catch (err: any) {
      console.error('Erreur lors du démarrage de la tâche de ménage :', err);
      setError('Impossible de démarrer la tâche de ménage.');
    }
  };

  const handleCompleteTask = async (id: number) => {
    try {
      await housekeepingService.updateTaskStatus(id, 'TERMINE');
      await fetchData();
    } catch (err: any) {
      console.error('Erreur lors de la finition de la tâche de ménage :', err);
      setError('Impossible de terminer la tâche de ménage.');
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!window.confirm('Supprimer cette tâche ?')) return;
    try {
      await housekeepingService.deleteTask(id);
      await fetchData();
    } catch (err: any) {
      console.error('Erreur lors de la suppression de la tâche de ménage :', err);
      setError('Impossible de supprimer la tâche de ménage.');
    }
  };

  const handleSaveHousekeeping = async () => {
    try {
      await housekeepingService.createTask({
        ...housekeepingForm,
        statut: 'A_FAIRE',
      });
      await fetchData();
    } catch (err: any) {
      console.error('Erreur lors de la création de la tâche de ménage :', err);
      setError('Impossible de créer la tâche de ménage.');
    } finally {
      setShowHousekeepingModal(false);
      setHousekeepingForm(DEFAULT_HOUSEKEEPING_FORM);
    }
  };

  const openNewHousekeepingModal = () => {
    setHousekeepingForm(DEFAULT_HOUSEKEEPING_FORM);
    setShowHousekeepingModal(true);
  };

  // ── Handlers : maintenance ────────────────────────────────────────────────
  const handleStartMaintenance = (id: number) => {
    setMaintenances(prev => prev.map(m => m.id === id ? { ...m, statut: 'EN_COURS' } : m));
  };

  const handleCompleteMaintenance = (id: number) => {
    setMaintenances(prev => prev.map(m =>
      m.id === id ? { ...m, statut: 'TERMINE', date_resolution: new Date().toISOString() } : m
    ));
  };

  const handleDeleteMaintenance = (id: number) => {
    if (window.confirm('Supprimer cette maintenance ?')) {
      setMaintenances(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleSaveMaintenance = () => {
    const newMaintenance: RoomMaintenance = {
      ...maintenanceForm,
      id: Date.now(),
      statut: 'OUVERT',
      date_declaration: new Date().toISOString(),
      date_resolution: '',
    };
    setMaintenances(prev => [...prev, newMaintenance]);
    setShowMaintenanceModal(false);
    setMaintenanceForm(DEFAULT_MAINTENANCE_FORM);
  };

  const openNewMaintenanceModal = () => {
    setMaintenanceForm(DEFAULT_MAINTENANCE_FORM);
    setShowMaintenanceModal(true);
  };

  // ── Handlers : client ─────────────────────────────────────────────────────
  const handleSaveClient = async () => {
    try {
      await clientService.createClient(clientForm);
      await fetchData();
    } catch (err) {
      const newClient: Client = {
        ...clientForm,
        id: Date.now(),
        code_client: `CL${String(clients.length + 1).padStart(3, '0')}`,
      };
      setClients(prev => [...prev, newClient]);
    } finally {
      setShowClientModal(false);
      setClientForm(DEFAULT_CLIENT_FORM);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    totalReservations: reservations.length,
    enCours: reservations.filter(r => r.statut === 'EN_COURS').length,
    chambresOccupees: rooms.filter(r => r.statut === 'OCCUPEE').length,
    chambresLibres: rooms.filter(r => r.statut === 'LIBRE').length,
  };

  return {
    // données
    roomTypes, clients, equipments, rooms, reservations,
    roomEquipments, housekeepingTasks, maintenances,
    loading, error, refetch: fetchData,
    // UI
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    filterStatus, setFilterStatus,
    editingId,
    stats,
    // modales
    showReservationModal, setShowReservationModal,
    showRoomModal, setShowRoomModal,
    showEquipmentModal, setShowEquipmentModal,
    showHousekeepingModal, setShowHousekeepingModal,
    showMaintenanceModal, setShowMaintenanceModal,
    showClientModal, setShowClientModal,
    // formulaires
    reservationForm, setReservationForm,
    roomForm, setRoomForm,
    equipmentForm, setEquipmentForm,
    housekeepingForm, setHousekeepingForm,
    maintenanceForm, setMaintenanceForm,
    clientForm, setClientForm,
    // handlers
    handleCheckIn, handleCheckOut, handleCancelReservation, handleDeleteReservation, handleSaveReservation,
    handleEditRoom, handleDeleteRoom, handleSaveRoom, openNewRoomModal,
    handleEditRoomEquipment, handleDeleteRoomEquipment, handleSaveEquipment, openNewEquipmentModal,
    handleStartTask, handleCompleteTask, handleDeleteTask, handleSaveHousekeeping, openNewHousekeepingModal,
    handleStartMaintenance, handleCompleteMaintenance, handleDeleteMaintenance, handleSaveMaintenance, openNewMaintenanceModal,
    handleSaveClient,
  };
}
*/