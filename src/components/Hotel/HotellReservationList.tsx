// components/Hotel/ReservationList.tsx
import React, { useState, useEffect } from 'react';
import { Reservation, ReservationPayment } from '../../types/hotel.types';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/data';
import {
  Calendar,
  Edit,
  X,
  Loader,
  AlertCircle,
  Trash2,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  User,
  UserCheck,
  DoorOpen,
  CreditCard,
  Printer
} from 'lucide-react';
import { printReservationTicket, receiptDataFromReservation } from '../../utils/hotelReceipt';
import { useReservations } from '../../hooks/useReservations';
import { useClients } from '../../hooks/useClients';
import { useRooms } from '../../hooks/useRooms';
import { toast } from 'react-hot-toast';
import AuthService from '../../services/authService';
import { reservationService } from '../../services/reservation.service';
import api from '../../lib/api';

interface ReservationListProps {
  reservations?: Reservation[];
  onEdit?: (reservation: Reservation) => void;
  onEncaisser?: (reservation: Reservation) => void;
  onCheckIn?: (reservation: Reservation) => void;
  onCancel?: (reservationId: number) => void;
  onDelete?: (reservationId: number) => void;
  refreshTrigger?: number;
  paymentCancelledTrigger?: number;
  view?: 'active' | 'history';
}

export const ReservationList: React.FC<ReservationListProps> = ({ onEdit, onEncaisser, onCheckIn, refreshTrigger, paymentCancelledTrigger, view = 'active' }) => {
  const {
    reservations,
    loading: reservationsLoading,
    error: reservationsError,
    stats,
    loadReservations,
    cancelReservation,
    deleteReservation
  } = useReservations();

  const { clients, loading: clientsLoading, loadClients } = useClients();
  const { rooms, loading: roomsLoading, loadRooms } = useRooms();
  const [users, setUsers] = useState<any[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<string>('TOUS');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedPayments, setExpandedPayments] = useState<ReservationPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [enrichedReservations, setEnrichedReservations] = useState<Reservation[]>([]);
  const [barSpendByReservation, setBarSpendByReservation] = useState<Record<number, number>>({});
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const isDirection = ['admin', 'manager'].includes(String(AuthService.getCurrentUser()?.role || '').toLowerCase());

  useEffect(() => {
    if (expandedId === null) {
      setExpandedPayments([]);
      return;
    }
    let cancelled = false;
    setPaymentsLoading(true);
    reservationService.getReservationPayments(expandedId)
      .then((rows) => { if (!cancelled) setExpandedPayments(rows); })
      .catch(() => { if (!cancelled) setExpandedPayments([]); })
      .finally(() => { if (!cancelled) setPaymentsLoading(false); });
    return () => { cancelled = true; };
  }, [expandedId]);

  // 🟢 État local pour stocker les IDs des réservations déjà encaissées
  const [encaissedIds, setEncaissedIds] = useState<number[]>([]);

  // Charger toutes les données
  useEffect(() => {
    const loadAllData = async () => {
      await Promise.all([loadReservations(), loadClients(), loadRooms()]);
      // Load users for history filtering
      try {
        const response = await api.get('/api/hebergement/users');
        setUsers(response.data.data || []);
      } catch (err) {
        console.warn('Failed to load users:', err);
        setUsers([]);
      }
    };
    loadAllData();
  }, [loadReservations, loadClients, loadRooms]);

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadReservations();
    }
  }, [loadReservations, refreshTrigger]);

  // Clear encaissedIds when payment is cancelled
  useEffect(() => {
    if (paymentCancelledTrigger !== undefined) {
      setEncaissedIds([]);
    }
  }, [paymentCancelledTrigger]);

  useEffect(() => {
    let isMounted = true;

    const loadBarSpendByReservation = async () => {
      try {
        const response = await api.get('/api/bar/orders');
        const orders = Array.isArray(response?.data?.data)
          ? response.data.data
          : Array.isArray(response?.data)
            ? response.data
            : [];

        const totals: Record<number, number> = {};

        for (const order of orders) {
          const amount = Number(order?.total ?? 0);
          if (!Number.isFinite(amount) || amount <= 0) continue;

          const reservationId = Number(order?.hotel_reservation_id ?? 0);
          const roomId = Number(order?.room_id ?? 0);

          if (reservationId > 0) {
            totals[reservationId] = (totals[reservationId] || 0) + amount;
          } else if (roomId > 0) {
            totals[roomId] = (totals[roomId] || 0) + amount;
          }
        }

        if (isMounted) {
          setBarSpendByReservation(totals);
        }
      } catch (error) {
        if (isMounted) {
          setBarSpendByReservation({});
        }
      }
    };

    void loadBarSpendByReservation();

    return () => {
      isMounted = false;
    };
  }, [reservations]);

  // Enrichir les réservations
  useEffect(() => {
    if (reservations.length > 0 && clients.length > 0 && rooms.length > 0) {
      const enriched = reservations.map(res => ({
        ...res,
        client: clients.find(c => c.id === res.client_id),
        room: rooms.find(r => r.id === res.room_id)
      }));
      setEnrichedReservations(enriched);
    } else {
      setEnrichedReservations(reservations);
    }
  }, [reservations, clients, rooms]);

  // Filtrer
  const filteredReservations = enrichedReservations.filter(res => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      res.client?.nom?.toLowerCase().includes(searchLower) ||
      res.client?.prenom?.toLowerCase().includes(searchLower) ||
      res.room?.numero?.includes(searchTerm);

    // Filter by tab (active vs history)
    const matchesTab = view === 'active'
      ? !['TERMINEE', 'ANNULEE', 'NO_SHOW'].includes(res.statut)
      : ['TERMINEE', 'ANNULEE', 'NO_SHOW'].includes(res.statut);

    // Custom status filtering based on user's requirements
    let matchesStatus = true;
    if (selectedStatus === 'TOUS') {
      matchesStatus = true;
    } else if (selectedStatus === 'CHECKED_IN') {
      matchesStatus = res.statut === 'CHECKED_IN';
    } else if (selectedStatus === 'ARRIVAL') {
      // Upcoming reservations: date_arrivee >= today, not checked in yet
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const arrivalDate = new Date(res.date_arrivee);
      arrivalDate.setHours(0, 0, 0, 0);
      matchesStatus = res.statut === 'CONFIRMEE' && arrivalDate >= today;
    } else if (selectedStatus === 'DEPARTURE') {
      // Completed reservations: based on checkout date (date_depart)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const departureDate = new Date(res.date_depart);
      departureDate.setHours(0, 0, 0, 0);
      matchesStatus = res.statut === 'TERMINEE' && departureDate <= today;
    } else {
      matchesStatus = res.statut === selectedStatus;
    }

    // Filter by date range
    let matchesDateRange = true;
    if (filterFromDate) {
      matchesDateRange = matchesDateRange && new Date(res.date_arrivee) >= new Date(filterFromDate);
    }
    if (filterToDate) {
      matchesDateRange = matchesDateRange && new Date(res.date_depart) <= new Date(filterToDate);
    }

    // Filter by date range in history tab (for user search)
    let matchesHistoryDateRange = true;
    if (view === 'history') {
      if (historyFromDate) {
        matchesHistoryDateRange = matchesHistoryDateRange && new Date(res.date_arrivee) >= new Date(historyFromDate);
      }
      if (historyToDate) {
        matchesHistoryDateRange = matchesHistoryDateRange && new Date(res.date_depart) <= new Date(historyToDate);
      }
    }

    // Filter by user name in history tab
    let matchesUser = true;
    if (view === 'history' && userSearchTerm) {
      const userSearchLower = userSearchTerm.toLowerCase();
      const creatorName = `${res.created_by_prenom || ''} ${res.created_by_nom || ''}`.toLowerCase();
      const modifierName = `${res.modified_by_prenom || ''} ${res.modified_by_nom || ''}`.toLowerCase();
      matchesUser = creatorName.includes(userSearchLower) || modifierName.includes(userSearchLower);
    }

    return matchesSearch && matchesTab && matchesStatus && matchesDateRange && matchesHistoryDateRange && matchesUser;
  });
  const filteredReservationsTotal = filteredReservations.reduce(
    (total, reservation) => total + (Number(reservation.montant_total) || 0),
    0
  );

  const isLoading = reservationsLoading || clientsLoading || roomsLoading;

  // Ticket 80 mm de la réservation (prestations + historique des paiements)
  const handlePrintTicket = async (res: Reservation) => {
    try {
      const payments = await reservationService.getReservationPayments(res.id);
      printReservationTicket(receiptDataFromReservation(res, payments));
    } catch {
      toast.error("Impossible de préparer le ticket d'impression");
    }
  };

  const getStatusBadge = (statut: string) => {
    const colors: Record<string, string> = {
      CONFIRMEE: 'bg-emerald-500/20 text-emerald-400',
      EN_COURS: 'bg-blue-500/20 text-blue-400',
      TERMINEE: 'bg-gray-500/20 text-gray-400',
      ANNULEE: 'bg-red-500/20 text-red-400',
      NO_SHOW: 'bg-orange-500/20 text-orange-400'
    };
    const labels: Record<string, string> = {
      CONFIRMEE: 'Confirmée',
      EN_COURS: 'En cours',
      TERMINEE: 'Terminée',
      ANNULEE: 'Annulée',
      NO_SHOW: 'No Show'
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[statut] || colors.CONFIRMEE}`}>
        {labels[statut] || statut}
      </span>
    );
  };

  // Gestion des actions
  const handleCancel = async (reservation: Reservation) => {
    if (window.confirm(`Annuler la réservation de ${reservation.client?.prenom} ${reservation.client?.nom} ?`)) {
      try {
        setIsProcessing(true);
        await cancelReservation(reservation.id);
        toast.success('Réservation annulée');
        await loadReservations();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erreur');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleNoShow = async (reservation: Reservation) => {
    if (window.confirm(`Marquer comme No Show la réservation de ${reservation.client?.prenom} ${reservation.client?.nom} ?`)) {
      try {
        setIsProcessing(true);
        await reservationService.updateReservationStatus(reservation.id, 'NO_SHOW');
        toast.success('Réservation marquée comme No Show');
        await loadReservations();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erreur');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDeleteClick = (reservation: Reservation) => {
    setReservationToDelete(reservation);
    setIsDeleteModalOpen(true);
  };

  const handleValidateDiscount = async (reservation: Reservation) => {
    try {
      await reservationService.validateDiscount(reservation.id);
      toast.success('Remise validée par la direction');
      await loadReservations();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Impossible de valider la remise');
    }
  };

  const handleConfirmDelete = async () => {
    if (!reservationToDelete) return;
    try {
      setIsProcessing(true);
      await deleteReservation(reservationToDelete.id);
      toast.success('Réservation supprimée');
      setIsDeleteModalOpen(false);
      setReservationToDelete(null);
      await loadReservations();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={32} className="animate-spin text-accent" />
        <span className="ml-3 text-gray-400 text-sm">Chargement...</span>
      </div>
    );
  }

  if (reservationsError) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
        <p className="text-red-400">{reservationsError}</p>
        <button type="button" onClick={() => loadReservations()} className="mt-3 text-accent hover:underline text-sm">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats compactes */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">Total</p>
            <p className="text-white font-bold text-lg">{stats.total || 0}</p>
          </div>
          <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">Confirmées</p>
            <p className="text-emerald-400 font-bold text-lg">{stats.confirmees || 0}</p>
          </div>
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">En cours</p>
            <p className="text-blue-400 font-bold text-lg">{stats.en_cours || 0}</p>
          </div>
          <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">Annulées</p>
            <p className="text-red-400 font-bold text-lg">{stats.annulees || 0}</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent"
        />
        <input
          type="date"
          value={filterFromDate}
          onChange={(e) => setFilterFromDate(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          placeholder="Du"
        />
        <input
          type="date"
          value={filterToDate}
          onChange={(e) => setFilterToDate(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          placeholder="Au"
        />
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
        >
          <option value="TOUS">Tous</option>
          <option value="CHECKED_IN">Check-in</option>
          <option value="ARRIVAL">Arrivée</option>
          <option value="DEPARTURE">Départ</option>
        </select>
        <button
          type="button"
          onClick={() => Promise.all([loadReservations(), loadClients(), loadRooms()])}
          className="px-3 py-2 bg-accent text-black rounded-lg text-sm hover:bg-accent-2 transition"
        >
          🔄
        </button>
      </div>

      {/* History date filters */}
      {view === 'history' && (
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            list="users-list"
            placeholder="Rechercher par utilisateur..."
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          />
          <datalist id="users-list">
            {users.map(user => (
              <option key={user.id_admin} value={`${user.prenom} ${user.nom}`}>
                {user.prenom} {user.nom} ({user.role})
              </option>
            ))}
          </datalist>
          <input
            type="date"
            value={historyFromDate}
            onChange={(e) => setHistoryFromDate(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
            placeholder="Du"
          />
          <input
            type="date"
            value={historyToDate}
            onChange={(e) => setHistoryToDate(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
            placeholder="Au"
          />
        </div>
      )}

      {/* Liste */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2">
          <span className="text-xs text-gray-400">
            {filteredReservations.length} réservation{filteredReservations.length > 1 ? 's' : ''}
          </span>
          {view === 'history' && (
            <span className="text-sm font-semibold text-accent">
              Valeur totale listée : {formatCurrency(filteredReservationsTotal)}
            </span>
          )}
        </div>

        {filteredReservations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <Calendar size={32} className="mx-auto text-gray-600 mb-2" />
            Aucune réservation
          </div>
        ) : (
          filteredReservations.map((res) => (
            <div
              key={res.id}
              className={`bg-gray-900 border rounded-lg overflow-hidden transition-all
                ${res.statut === 'ANNULEE' ? 'border-red-800/30' : 'border-gray-700'}`}
            >
              {/* Ligne principale */}
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  {/* Info client */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs flex-shrink-0">
                      {res.client?.prenom?.[0] || '?'}{res.client?.nom?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm truncate">
                          {res.client?.prenom} {res.client?.nom || 'Inconnu'}
                        </span>
                        {getStatusBadge(res.statut)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-0.5">
                          <DoorOpen size={12} />
                          {res.room?.numero || 'N/A'}
                        </span>
                        <span>{formatDate(res.date_arrivee)} → {formatDate(res.date_depart)}</span>
                        <span className={res.type_reservation === 'BOOKING' ? 'text-blue-400' : 'text-gray-500'}>
                          {res.type_reservation === 'BOOKING' ? 'Booking' : 'Sur place'}
                        </span>
                        {res.laundry_included && (
                          <span className="text-purple-400">Blanchisserie {formatCurrency(res.laundry_price || 0)}</span>
                        )}
                                        <span className={res.pdj_inclus ? 'text-emerald-400' : 'text-gray-500'}>
                          {res.pdj_inclus ? 'PDJ inclus' : 'PDJ non inclus'}
                        </span>
                        {(() => {
                          const barSpend = Number(barSpendByReservation[res.id] ?? barSpendByReservation[res.room_id] ?? 0);
                          return barSpend > 0 ? (
                            <span className="text-amber-300">Bar {formatCurrency(barSpend)}</span>
                          ) : null;
                        })()}
                        {res.moyen_paiement && res.statut === 'TERMINEE' && (
                          <span className="text-sky-300">Paiement : {res.moyen_paiement.replace('_', ' ')}</span>
                        )}
                        <span className="text-accent font-medium">{formatCurrency(res.montant_total || 0)}</span>
                        {Number(res.montant_encaisse || 0) > 0 && <span className="text-emerald-300">Encaissé {formatCurrency(res.montant_encaisse || 0)}</span>}
                        {Number(res.montant_gratuit || 0) > 0 && <span className="text-violet-300">Gratuit {formatCurrency(res.montant_gratuit || 0)}</span>}
                        {Number(res.montant_credit || 0) > 0 && <span className="text-orange-300">Crédit {formatCurrency(res.montant_credit || 0)}</span>}
                        {(() => {
                          const paid = Number(res.montant_paye || 0);
                          const due = Number(res.montant_total || 0) - paid;
                          if (paid <= 0 && due <= 0) return null;
                          const statusLabels: Record<string, string> = {
                            IMPAYE: 'Impayé', PARTIELLEMENT_PAYE: 'Partiellement payé', PAYE: 'Payé', CREDIT: 'Crédit', GRATUIT: 'Gratuit',
                          };
                          return <span className={due > 0 ? 'text-orange-300 font-medium' : 'text-emerald-400'}>
                            {statusLabels[res.statut_paiement || ''] || (due > 0 ? 'Solde restant' : 'Payé')} · Couvert {formatCurrency(paid)} · Reste {formatCurrency(Math.max(0, due))}
                          </span>;
                        })()}
                        {Number(res.remise_pourcentage || 0) > 0 && (
                          <span className={res.remise_validee_par ? 'text-emerald-400' : 'text-orange-400'}>
                            Remise {res.remise_pourcentage}% {res.remise_validee_par ? 'validée' : 'à valider'}
                          </span>
                        )}
                        {/* User tracking information */}
                        {view === 'history' && (
                          <>
                            {res.created_by_nom && (
                              <span className="text-green-400">
                                Créé par: {res.created_by_prenom} {res.created_by_nom}
                              </span>
                            )}
                            {res.modified_by_nom && res.modified_by_nom !== res.created_by_nom && (
                              <span className="text-yellow-400">
                                Modifié par: {res.modified_by_prenom} {res.modified_by_nom}
                              </span>
                            )}
                            {res.created_at && (
                              <span className="text-gray-500">
                                {formatDateTime(res.created_at)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isDirection && Number(res.remise_pourcentage || 0) > 0 && !res.remise_validee_par && (
                      <button type="button" onClick={() => handleValidateDiscount(res)} className="px-2 py-1 text-xs rounded bg-orange-500/20 text-orange-300">
                        Valider remise
                      </button>
                    )}
                    {/* Bouton Check-in - Only show for confirmed reservations */}
                    {onCheckIn && res.statut === 'CONFIRMEE' && (
                      <button
                        type="button"
                        onClick={() => onCheckIn(res)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs rounded-lg transition-colors font-medium mr-1"
                        title="Check-in du client"
                      >
                        <UserCheck size={12} />
                        <span className="hidden sm:inline">Check-in</span>
                      </button>
                    )}
                    {/* Bouton Encaisser dynamique - Only show after check-in */}
                    {onEncaisser && (res.statut === 'CHECKED_IN' || res.statut === 'EN_COURS') && !encaissedIds.includes(res.id) && (
                      <button
                        type="button"
                        onClick={() => onEncaisser(res)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs rounded-lg transition-colors font-medium mr-1"
                        title="Encaisser cette réservation"
                      >
                        <CreditCard size={12} />
                        <span className="hidden sm:inline">Encaisser</span>
                      </button>
                    )}
                    {/* Réservation déjà payée avec rectification (blanchisserie, transfert...) */}
                    {onEncaisser && res.statut === 'TERMINEE' && Number(res.montant_paye || 0) > 0 && Number(res.montant_total || 0) - Number(res.montant_paye || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => onEncaisser(res)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 text-xs rounded-lg transition-colors font-medium mr-1"
                        title="Encaisser la rectification"
                      >
                        <CreditCard size={12} />
                        <span className="hidden sm:inline">Encaisser rectification</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handlePrintTicket(res)}
                      className="p-1.5 hover:bg-gray-800 rounded"
                      title="Imprimer le ticket (80 mm)"
                    >
                      <Printer size={14} className="text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === res.id ? null : res.id)}
                      className="p-1.5 hover:bg-gray-800 rounded"
                    >
                      {expandedId === res.id ?
                        <ChevronUp size={14} className="text-gray-400" /> :
                        <ChevronDown size={14} className="text-gray-400" />
                      }
                    </button>
                    {onEdit && (
                      <button type="button" onClick={() => onEdit(res)} className="p-1.5 hover:bg-gray-800 rounded">
                        <Edit size={14} className="text-gray-400" />
                      </button>
                    )}
                    {res.statut !== 'ANNULEE' && res.statut !== 'TERMINEE' && (
                      <button type="button" onClick={() => handleCancel(res)} className="p-1.5 hover:bg-red-500/10 rounded">
                        <X size={14} className="text-red-400" />
                      </button>
                    )}
                    {res.statut === 'CONFIRMEE' && (
                      <button type="button" onClick={() => handleNoShow(res)} className="p-1.5 hover:bg-orange-500/10 rounded" title="Marquer comme No Show">
                        <User size={14} className="text-orange-400" />
                      </button>
                    )}
                    <button type="button" onClick={() => handleDeleteClick(res)} className="p-1.5 hover:bg-red-500/10 rounded">
                      <Trash2 size={14} className="text-gray-500 hover:text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Détails étendus */}
                {expandedId === res.id && (
                  <div className="mt-2 border-t border-gray-800 pt-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-gray-500">Client</p>
                        <p className="text-gray-300">{res.client?.prenom} {res.client?.nom}</p>
                        {res.client?.telephone && <p className="flex items-center gap-1 text-gray-400"><Phone size={12} /> {res.client.telephone}</p>}
                        {res.client?.email && <p className="flex items-center gap-1 truncate text-gray-400"><Mail size={12} /> {res.client.email}</p>}
                      </div>
                      <div>
                        <p className="text-gray-500">Chambre</p>
                        <p className="text-gray-300">N° {res.room?.numero || 'N/A'}</p>
                        <p className="text-gray-400">{res.room?.room_type?.nom || 'Standard'}</p>
                        <p className="text-gray-400">{res.room?.capacite || 0} pers.</p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-gray-800 pt-2">
                      <p className="mb-2 font-semibold text-gray-300">Historique des encaissements</p>
                      {paymentsLoading ? <p className="text-gray-500">Chargement…</p> : expandedPayments.length === 0 ? (
                        <p className="text-gray-500">Aucun encaissement enregistré.</p>
                      ) : (
                        <div className="space-y-2">
                          {expandedPayments.map((payment, index) => {
                            const modes = payment.details?.modes_paiement;
                            return (
                              <div key={payment.id} className="rounded-lg bg-gray-900/60 p-2.5">
                                <div className="flex flex-wrap justify-between gap-2 text-gray-300">
                                  <strong>Encaissement {index + 1} · {formatDateTime(payment.created_at)}</strong>
                                  <strong>{formatCurrency(payment.montant)}</strong>
                                </div>
                                <div className="mt-1 space-y-0.5 text-gray-400">
                                  {modes?.length ? modes.map((mode, modeIndex) => (
                                    <div key={`${payment.id}-${modeIndex}`} className="flex justify-between">
                                      <span>{mode.moyen_paiement.replace('_', ' ')}</span><span>{formatCurrency(mode.montant)}</span>
                                    </div>
                                  )) : <div>{payment.moyen_paiement || 'Mode historique'} · {formatCurrency(payment.montant)}</div>}
                                  <div className="flex flex-wrap justify-between gap-2 border-t border-gray-800 pt-1">
                                    <span>Reçu {formatCurrency(payment.montant_encaisse ?? payment.montant)}</span>
                                    {Number(payment.montant_credit || 0) > 0 && <span>Crédit {formatCurrency(payment.montant_credit || 0)}</span>}
                                    {Number(payment.montant_gratuit || 0) > 0 && <span>Gratuit {formatCurrency(payment.montant_gratuit || 0)}</span>}
                                  </div>
                                  <div>Effectué par {`${payment.created_by_prenom || ''} ${payment.created_by_nom || ''}`.trim() || 'Utilisateur inconnu'}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de suppression */}
      {isDeleteModalOpen && reservationToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
              <h3 className="text-white font-bold mb-2">Confirmer la suppression</h3>
              <p className="text-gray-400 text-sm">
                Supprimer la réservation de <br />
                <strong className="text-white">
                  {reservationToDelete.client?.prenom} {reservationToDelete.client?.nom}
                </strong>
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm flex items-center justify-center gap-2"
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader size={16} className="animate-spin" /> : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};