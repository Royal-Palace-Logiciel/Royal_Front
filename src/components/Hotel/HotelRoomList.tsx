// hotel/RoomList.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { HousekeepingTask, Room, RoomMaintenance, RoomType, Reservation } from '../../types/hotel.types';
import {
  DoorOpen,
  Edit,
  Loader,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Ban,
  Users,
  Home,
  Search,
  Filter,
  XCircle,
  Settings,
  Wrench,
  Brush,
  Calendar
} from 'lucide-react';
import { formatCurrency } from '../../utils/data';
import { RoomStatusModal } from './Modal/RoomStatusModal';
import { useRooms } from '../../hooks/useRooms';
import { useReservations } from '../../hooks/useReservations';
import { roomTypeService } from '../../services/room.service';
import { housekeepingService } from '../../services/housekeeping.service';
import { maintenanceService } from '../../services/maintenance.service';

interface RoomListProps {
  rooms?: Room[];
  onEdit?: (room: Room) => void;
  onDelete?: (roomId: number) => void;
  onStatusChange?: (roomId: number, newStatus: string) => void;
  refreshTrigger?: number;
  onViewEquipment?: (room: Room) => void;
  onViewHousekeeping?: (room: Room) => void;
  onViewMaintenance?: (room: Room) => void;
}

export const RoomList: React.FC<RoomListProps> = ({ onEdit, onDelete, refreshTrigger, onViewEquipment, onViewHousekeeping, onViewMaintenance }) => {
  const {
    rooms,
    loading,
    error,
    updateRoomStatus,
    updateRoom,
    deleteRoom,
    refresh
  } = useRooms();

  const { reservations, loading: reservationsLoading } = useReservations();

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [activeHousekeepingTasks, setActiveHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [activeMaintenanceByRoom, setActiveMaintenanceByRoom] = useState<Map<number, RoomMaintenance['statut']>>(new Map());
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);
  const [navigationRoom, setNavigationRoom] = useState<Room | null>(null);

  // États pour la recherche et le filtrage
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TOUS');
  const [filterType, setFilterType] = useState<string>('TOUS');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  const loadOperationalStatuses = useCallback(async () => {
    try {
      const [housekeepingToDo, housekeepingInProgress, maintenanceOpen, maintenanceInProgress] = await Promise.all([
        housekeepingService.getTasks({ statut: 'A_FAIRE' }),
        housekeepingService.getTasks({ statut: 'EN_COURS' }),
        maintenanceService.getMaintenances({ statut: 'OUVERT' }),
        maintenanceService.getMaintenances({ statut: 'EN_COURS' }),
      ]);

      setActiveHousekeepingTasks([...housekeepingToDo, ...housekeepingInProgress]);
      const maintenanceByRoom = new Map<number, RoomMaintenance['statut']>();
      maintenanceOpen.forEach((maintenance: RoomMaintenance) => {
        if (Number.isInteger(maintenance.room_id)) maintenanceByRoom.set(maintenance.room_id, 'OUVERT');
      });
      maintenanceInProgress.forEach((maintenance: RoomMaintenance) => {
        if (Number.isInteger(maintenance.room_id)) maintenanceByRoom.set(maintenance.room_id, 'EN_COURS');
      });
      setActiveMaintenanceByRoom(maintenanceByRoom);
    } catch (err) {
      console.error('❌ Erreur chargement des statuts opérationnels:', err);
    }
  }, []);

  const getHousekeepingTask = (roomId: number) => activeHousekeepingTasks
    .filter(task => task.room_id === roomId)
    .sort((a, b) => Number(b.statut === 'EN_COURS') - Number(a.statut === 'EN_COURS'))[0];

  // Get current or upcoming reservation for a room
  const getRoomReservation = (roomId: number): Reservation | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find reservations for this room that are active or upcoming
    const roomReservations = reservations.filter(res => 
      res.room_id === roomId && 
      !['ANNULEE', 'NO_SHOW'].includes(res.statut) &&
      new Date(res.date_depart) >= today
    ).sort((a, b) => new Date(a.date_arrivee).getTime() - new Date(b.date_arrivee).getTime());
    
    return roomReservations.length > 0 ? roomReservations[0] : null;
  };

  // Format date range for display (e.g., "Oct 8 to Oct 15")
  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startMonth = months[start.getMonth()];
    const startDay = start.getDate();
    const endMonth = months[end.getMonth()];
    const endDay = end.getDate();
    
    return `${startMonth} ${startDay} to ${endMonth} ${endDay}`;
  };

  const getPrimaryRoomStatus = (room: Room): Room['statut'] => {
    // These statuses are operational overlays; the room itself remains available.
    if (room.statut === 'MAINTENANCE' && activeMaintenanceByRoom.has(room.id)) return 'LIBRE';
    if (room.statut === 'NETTOYAGE' && getHousekeepingTask(room.id)) return 'LIBRE';
    return room.statut;
  };

  useEffect(() => {
    void loadOperationalStatuses();
  }, [loadOperationalStatuses, refreshTrigger]);

  // Charger les types de chambres
  useEffect(() => {
    const loadRoomTypes = async () => {
      try {
        const types = await roomTypeService.getRoomTypes();
        setRoomTypes(types);
      } catch (err) {
        console.error('❌ Erreur chargement types:', err);
      } finally {
        setLoadingTypes(false);
      }
    };
    loadRoomTypes();
  }, []);

  // Fonction pour obtenir le nom du type
  const getRoomTypeName = (room: Room) => {
    if (room.room_type?.nom) {
      return room.room_type.nom;
    }
    const type = roomTypes.find(t => t.id === room.room_type_id);
    return type?.nom || 'Type non défini';
  };

  // Charger les réservations pour afficher les dates dans les chambres réservées
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      refresh();
    }
  }, [refresh, refreshTrigger]);

  // Filtrer les chambres
  const filteredRooms = rooms.filter(room => {
    // Recherche par numéro ou type
    const matchesSearch =
      room.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getRoomTypeName(room).toLowerCase().includes(searchTerm.toLowerCase());

    // Filtre par statut
    const matchesStatus = filterStatus === 'TOUS' || getPrimaryRoomStatus(room) === filterStatus;

    // Filtre par type
    const matchesType = filterType === 'TOUS' || room.room_type_id === Number(filterType);

    // Filtre par date de réservation
    let matchesDateRange = true;
    if (filterFromDate || filterToDate) {
      const roomReservation = getRoomReservation(room.id);
      if (roomReservation) {
        if (filterFromDate) {
          matchesDateRange = matchesDateRange && new Date(roomReservation.date_arrivee) >= new Date(filterFromDate);
        }
        if (filterToDate) {
          matchesDateRange = matchesDateRange && new Date(roomReservation.date_depart) <= new Date(filterToDate);
        }
      } else {
        // If no reservation and date filter is set, exclude this room
        matchesDateRange = false;
      }
    }

    return matchesSearch && matchesStatus && matchesType && matchesDateRange;
  });

  // Statistiques des chambres
  const stats = {
    total: rooms.length,
    libre: rooms.filter(r => getPrimaryRoomStatus(r) === 'LIBRE').length,
    occupee: rooms.filter(r => getPrimaryRoomStatus(r) === 'OCCUPEE').length,
    reservee: rooms.filter(r => getPrimaryRoomStatus(r) === 'RESERVEE').length,
    maintenance: rooms.filter(r => getPrimaryRoomStatus(r) === 'MAINTENANCE').length,
  };

  // Gestion du changement de statut
  const handleStatusChange = async (roomId: number, newStatus: string) => {
    try {
      setProcessingId(roomId);
      await updateRoomStatus(roomId, newStatus);
    } catch (error) {
      console.error('❌ Erreur changement statut:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // Gestion de l'édition
  const handleEdit = (room: Room) => {
    if (onEdit) {
      onEdit(room);
    } else {
      setSelectedRoom(room);
      setIsStatusModalOpen(true);
    }
  };

  // Gestion de la suppression
  const handleDeleteClick = (room: Room) => {
    setRoomToDelete(room);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;

    try {
      setProcessingId(roomToDelete.id);
      await deleteRoom(roomToDelete.id);

      if (onDelete) {
        onDelete(roomToDelete.id);
      }

      setIsDeleteModalOpen(false);
      setRoomToDelete(null);
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // Gestion du statut via modal
  const handleModalStatusChange = async (newStatus: string) => {
    if (!selectedRoom) return;
    try {
      await updateRoomStatus(selectedRoom.id, newStatus);
      setIsStatusModalOpen(false);
      setSelectedRoom(null);
    } catch (error) {
      console.error('❌ Erreur changement statut via modal:', error);
    }
  };

  // Réinitialiser les filtres
  const resetFilters = () => {
    setSearchTerm('');
    setFilterStatus('TOUS');
    setFilterType('TOUS');
    setFilterFromDate('');
    setFilterToDate('');
  };

  // Gestion du clic sur une chambre - ouvrir le modal de navigation
  const handleRoomClick = (room: Room) => {
    setNavigationRoom(room);
    setIsNavigationModalOpen(true);
  };

  // Gestion de la navigation vers les différentes sections
  const handleNavigation = (destination: 'equipment' | 'maintenance' | 'housekeeping') => {
    if (!navigationRoom) return;

    switch (destination) {
      case 'equipment':
        onViewEquipment?.(navigationRoom);
        break;
      case 'maintenance':
        onViewMaintenance?.(navigationRoom);
        break;
      case 'housekeeping':
        onViewHousekeeping?.(navigationRoom);
        break;
    }

    setIsNavigationModalOpen(false);
    setNavigationRoom(null);
  };

  // Affichage du chargement
  if (loading || loadingTypes) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={32} className="animate-spin text-accent" />
        <span className="ml-3 text-muted">Chargement des chambres...</span>
      </div>
    );
  }

  // Affichage de l'erreur
  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 text-danger">
        <p>❌ {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-surface rounded-lg p-3 text-center border border-base">
          <div className="text-2xl font-bold text-primary">{stats.total}</div>
          <div className="text-xs text-muted">Total</div>
        </div>
        <div className="bg-success/10 rounded-lg p-3 text-center border border-success/20">
          <div className="text-2xl font-bold text-success">{stats.libre}</div>
          <div className="text-xs text-muted">Libres</div>
        </div>
        <div className="bg-accent/10 rounded-lg p-3 text-center border border-accent/20">
          <div className="text-2xl font-bold text-accent">{stats.occupee}</div>
          <div className="text-xs text-muted">Occupées</div>
        </div>
        <div className="bg-warning/10 rounded-lg p-3 text-center border border-warning/20">
          <div className="text-2xl font-bold text-warning">{stats.reservee}</div>
          <div className="text-xs text-muted">Réservées</div>
        </div>
        <div className="bg-danger/10 rounded-lg p-3 text-center border border-danger/20">
          <div className="text-2xl font-bold text-danger">{stats.maintenance}</div>
          <div className="text-xs text-muted">Maintenance</div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Rechercher par numéro ou type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-base bg-surface text-primary placeholder-muted focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-base bg-surface text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
        >
          <option value="TOUS">Tous les statuts</option>
          <option value="LIBRE">Libre</option>
          <option value="OCCUPEE">Occupée</option>
          <option value="RESERVEE">Réservée</option>
          <option value="NETTOYAGE">En nettoyage</option>
          <option value="MAINTENANCE">En maintenance</option>
          <option value="HORS_SERVICE">Hors service</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-base bg-surface text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
        >
          <option value="TOUS">Tous les types</option>
          {roomTypes.map(type => (
            <option key={type.id} value={type.id}>{type.nom}</option>
          ))}
        </select>

        <input
          type="date"
          value={filterFromDate}
          onChange={(e) => setFilterFromDate(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-base bg-surface text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          placeholder="Date début"
        />

        <input
          type="date"
          value={filterToDate}
          onChange={(e) => setFilterToDate(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-base bg-surface text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          placeholder="Date fin"
        />

        {(searchTerm || filterStatus !== 'TOUS' || filterType !== 'TOUS' || filterFromDate || filterToDate) && (
          <button
            onClick={resetFilters}
            className="px-4 py-2.5 rounded-lg border border-base hover:bg-surface-2 transition-colors flex items-center gap-2"
          >
            <XCircle size={18} />
            Réinitialiser
          </button>
        )}

        <button
          onClick={() => {
            refresh();
            void loadOperationalStatuses();
          }}
          className="px-4 py-2.5 rounded-lg btn-primary flex items-center gap-2"
        >
          <Loader size={18} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Liste des chambres */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-primary font-semibold">Liste des chambres</h3>
          <span className="text-muted text-sm">
            {filteredRooms.length} chambre{filteredRooms.length > 1 ? 's' : ''}
            {rooms.length !== filteredRooms.length && ` (sur ${rooms.length})`}
          </span>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-lg border border-base">
            <Home size={48} className="mx-auto text-muted/30 mb-3" />
            <p className="text-muted">Aucune chambre trouvée</p>
            {(searchTerm || filterStatus !== 'TOUS' || filterType !== 'TOUS' || filterFromDate || filterToDate) && (
              <button
                onClick={resetFilters}
                className="mt-2 text-accent text-sm underline hover:no-underline"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRooms.map(room => {
              const typeName = getRoomTypeName(room);
              const isProcessing = processingId === room.id;
              const primaryStatus = getPrimaryRoomStatus(room);
              const housekeepingTask = getHousekeepingTask(room.id);
              const roomReservation = getRoomReservation(room.id);

              return (
                <div
                  key={room.id}
                  className="card card-gold-hover p-5 cursor-pointer"
                  onClick={() => handleRoomClick(room)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleRoomClick(room);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-primary font-semibold text-lg">
                        Chambre {room.numero}
                      </h4>
                      <p className="text-muted text-sm">
                        {typeName}
                        {room.capacite && ` • ${room.capacite} pers.`}
                      </p>
                      {roomReservation && primaryStatus === 'RESERVEE' && (
                        <p className="text-accent text-xs mt-1 flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDateRange(roomReservation.date_arrivee, roomReservation.date_depart)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[primaryStatus] || ''}`}>
                        {statusLabels[primaryStatus] || primaryStatus}
                      </span>
                      {housekeepingTask && (
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${housekeepingTask.statut === 'EN_COURS' ? 'bg-info/10 text-info border-info/20' : 'bg-warning/10 text-warning border-warning/20'}`}
                          title={housekeepingTask.statut === 'EN_COURS' ? 'Ménage en cours' : 'Ménage à faire'}
                        >
                          <Brush size={12} className="inline mr-1" aria-hidden="true" />
                          {housekeepingTask.statut === 'EN_COURS' ? 'Nettoyage en cours' : 'Ménage à faire'}
                        </span>
                      )}
                      {activeMaintenanceByRoom.has(room.id) && (
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-medium border bg-danger/10 text-danger border-danger/20"
                          title={activeMaintenanceByRoom.get(room.id) === 'EN_COURS' ? 'Maintenance en cours' : 'Maintenance à faire'}
                        >
                          <Wrench size={12} className="inline mr-1" aria-hidden="true" />
                          {activeMaintenanceByRoom.get(room.id) === 'EN_COURS' ? 'Maintenance en cours' : 'Maintenance à faire'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-base">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-accent font-bold text-lg">
                          {formatCurrency(room.prix_nuit || 0)}
                        </span>
                        <span className="text-muted text-sm font-normal ml-1">/nuit</span>
                      </div>
                      <div className="flex gap-1">
                        {/* Bouton Modifier */}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEdit(room);
                          }}
                          className="p-2 rounded-lg hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Modifier"
                          disabled={isProcessing}
                        >
                          <Edit size={16} className="text-accent" />
                        </button>

                        {/* Bouton Supprimer */}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteClick(room);
                          }}
                          className="p-2 rounded-lg hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Supprimer"
                          disabled={isProcessing}
                        >
                          <Trash2 size={16} className="text-danger" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Modal */}
      {selectedRoom && (
        <RoomStatusModal
          isOpen={isStatusModalOpen}
          onClose={() => {
            setIsStatusModalOpen(false);
            setSelectedRoom(null);
          }}
          room={selectedRoom}
          onStatusChange={handleModalStatusChange}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm animate-fade-in">
          <div className="bg dark:bg-surface-2 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-base-light dark:border-base-dark animate-scale-in">
            <div className="text-center">
              {/* Icône d'avertissement */}
              <div className="w-16 h-16 rounded-full bg-danger/10 dark:bg-danger/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-danger" />
              </div>

              <h3 className="text-xl font-bold text-primary-dark dark:text-primary-light mb-2">
                Confirmer la suppression
              </h3>

              <p className="text-muted dark:text-muted-light text-sm mb-2">
                Êtes-vous sûr de vouloir supprimer la <strong className="text-primary-dark dark:text-primary-light">Chambre {roomToDelete.numero}</strong> ?
              </p>
              <p className="text-danger/80 dark:text-danger/70 text-xs">
                ⚠️ Cette action est irréversible et supprimera toutes les données associées.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {/* Bouton Annuler */}
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setRoomToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-base-light dark:border-base-dark text-primary-dark dark:text-primary-light font-medium text-sm hover:bg-surface-2 dark:hover:bg-surface-3 transition-all duration-300"
                  disabled={processingId === roomToDelete.id}
                >
                  Annuler
                </button>

                {/* Bouton Supprimer */}
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-danger hover:bg-danger/90 dark:bg-danger-dark dark:hover:bg-danger-dark/90 text-white font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={processingId === roomToDelete.id}
                >
                  {processingId === roomToDelete.id ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Supprimer définitivement
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Modal */}
      {isNavigationModalOpen && navigationRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm animate-fade-in">
          <div className="bg dark:bg-surface-2 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-base-light dark:border-base-dark animate-scale-in">
            <div className="text-center">
              <h3 className="text-xl font-bold text-primary mb-4">
                Chambre {navigationRoom.numero}
              </h3>
              <p className="text-muted text-sm mb-6">
                Que souhaitez-vous faire ?
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleNavigation('equipment')}
                  className="w-full px-4 py-3 rounded-lg border border-base hover:bg-accent/10 transition-colors flex items-center gap-3"
                >
                  <Settings size={20} className="text-accent" />
                  <span className="text-primary font-medium">Équipement</span>
                </button>

                <button
                  onClick={() => handleNavigation('maintenance')}
                  className="w-full px-4 py-3 rounded-lg border border-base hover:bg-danger/10 transition-colors flex items-center gap-3"
                >
                  <Wrench size={20} className="text-danger" />
                  <span className="text-primary font-medium">Maintenance</span>
                </button>

                <button
                  onClick={() => handleNavigation('housekeeping')}
                  className="w-full px-4 py-3 rounded-lg border border-base hover:bg-info/10 transition-colors flex items-center gap-3"
                >
                  <Brush size={20} className="text-info" />
                  <span className="text-primary font-medium">Ménage</span>
                </button>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => {
                    setIsNavigationModalOpen(false);
                    setNavigationRoom(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg border border-base text-primary font-medium hover:bg-surface-2 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles CSS pour les animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

// Status colors
const statusColors: Record<string, string> = {
  LIBRE: 'bg-success/10 text-success border-success/20',
  OCCUPEE: 'bg-accent/10 text-accent border-accent/20',
  RESERVEE: 'bg-warning/10 text-warning border-warning/20',
  NETTOYAGE: 'bg-info/10 text-info border-info/20',
  MAINTENANCE: 'bg-danger/10 text-danger border-danger/20',
  HORS_SERVICE: 'bg-muted/10 text-muted border-muted/20',
};

const statusLabels: Record<string, string> = {
  LIBRE: 'Libre',
  OCCUPEE: 'Occupée',
  RESERVEE: 'Réservée',
  NETTOYAGE: 'A nettoyer',
  MAINTENANCE: 'Maintenance',
  HORS_SERVICE: 'Hors service',
};