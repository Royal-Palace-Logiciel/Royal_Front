// src/pages/HotelPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Hotel,
  Wifi,
  Coffee,
  Car,
  Sparkles,
  DoorOpen,
  Calendar,
  Users,
  ClipboardList,
  Hammer,
  Brush,
  LucideIcon,
  Plus,
  BedDouble,
  Menu,
  X,
  ChevronDown,
  Home,
  BarChart3,
  Settings,
  LogOut,
  User,
  TrendingUp,
  Bell,
  Search,
  Moon,
  Sun,
  Package,
  History
} from 'lucide-react';
import { useHDA } from '../context/HDAContext';
import { formatCurrency, formatDate } from '../utils/data';
import { RoomList } from '../components/Hotel/HotelRoomList';
import { ReservationList } from '../components/Hotel/HotellReservationList';
import { EquipmentManager } from '../components/Hotel/HotelEquipmentManager';
import { MaintenanceManager } from '../components/Hotel/HotelMaintenanceManager';
import { HousekeepingManager } from '../components/Hotel/HotelHousekeepingManager';
import { HotelReservationCollectionReport } from '../components/Hotel/HotelReservationCollectionReport';
import { ClientSearch } from '../components/Hotel/ClientSearch';
import { RoomFormModal } from '../components/Hotel/Modal/RoomFormModal';
import { ReservationFormModal } from '../components/Hotel/Modal/ReservationFormModal';
import { useRooms } from '../hooks/useRooms';
import { useReservations } from '../hooks/useReservations';
import { reservationService } from '../services/reservation.service';
import type { HotelPaymentMethod } from '../services/reservation.service';
import { Room, Reservation } from '../types/hotel.types';
import { StockManager, CaisseManager } from '../components/StockManager';
import { HotelProductHistory } from '../components/Hotel/HotelProductHistory';
import AuthService from '../services/authService';
import { filterTabsByRole, getDefaultTabForRole, isAdmin, isCashier } from '../utils/permissions';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  mobileLabel?: string;
}

const tabs: Tab[] = [
  { id: 'reservations', label: 'Réservations', icon: Calendar, mobileLabel: 'Réserv.' },
  { id: 'chambres', label: 'Chambres', icon: DoorOpen, mobileLabel: 'Chambres' },
  { id: 'clients', label: 'Clients', icon: Users, mobileLabel: 'Clients' },
  { id: 'equipements', label: 'Équipements', icon: Sparkles, mobileLabel: 'Équip.' },
  { id: 'maintenance', label: 'Maintenance', icon: Hammer, mobileLabel: 'Mainten.' },
  { id: 'housekeeping', label: 'Ménage', icon: Brush, mobileLabel: 'Ménage' },
  { id: 'stock', label: 'Stock', icon: Package, mobileLabel: 'Stock' },
  { id: 'rapports', label: 'Rapports', icon: ClipboardList, mobileLabel: 'Rapport' },
  { id: 'caisse', label: 'Finances', icon: BarChart3, mobileLabel: 'Finance' },
  
  { id: 'historiqueReservations', label: 'Historique', icon: History, mobileLabel: 'Historique' },
];

const hotelPaymentMethods: Array<{ value: HotelPaymentMethod; label: string }> = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'TPE', label: 'TPE' },
  { value: 'MVOLA', label: 'MVola' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'CARTE', label: 'Carte bancaire' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CREDIT', label: 'Crédit' },
  { value: 'GRATUIT', label: 'Gratuit' },
];

// Composant pour les statistiques responsives
const StatsCard: React.FC<{
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  color?: string;
  className?: string;
}> = ({ label, value, subValue, icon: Icon, color = 'accent', className = '' }) => {
  return (
    <div className={`bg-surface border border-base rounded-2xl p-4 md:p-5 hover:border-accent/30 transition-all ${className}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-muted text-[10px] md:text-xs uppercase tracking-wider font-medium mb-1 truncate">
            {label}
          </p>
          <p className="text-primary font-bold text-lg md:text-xl lg:text-2xl truncate">
            {value}
          </p>
          {subValue && (
            <p className="text-muted text-[10px] md:text-xs mt-0.5 truncate">{subValue}</p>
          )}
        </div>
        {Icon && (
          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-${color}/10`}>
            <Icon size={16} className={`md:w-5 md:h-5 text-${color}`} />
          </div>
        )}
      </div>
    </div>
  );
};

// Composant pour les tabs responsive
const TabButton: React.FC<{
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
}> = ({ tab, isActive, onClick }) => {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 md:flex-none px-3 py-2.5 md:px-5 md:py-2.5 
        rounded-xl text-xs md:text-sm font-medium transition-all 
        flex items-center justify-center md:justify-start gap-1.5 md:gap-2
        min-w-[45px] md:min-w-[120px]
        ${isActive
          ? 'bg-accent-4 text-accent shadow-soft-sm'
          : 'text-muted hover:text-primary hover:bg-surface-2'
        }
      `}
    >
      <Icon size={16} className="md:w-[18px] md:h-[18px] flex-shrink-0" />
      <span className="hidden sm:inline">{tab.label}</span>
      <span className="sm:hidden">{tab.mobileLabel || tab.label}</span>
    </button>
  );
};

// Composant principal
const HotelPage: React.FC = () => {
  const context = useHDA();
  const { showToast } = useToast();

  const {
    getModuleCaisseSolde,
    dispatch,
  } = context;

  const {
    rooms,
    loading: roomsLoading,
    error: roomsError,
    refresh: refreshRooms,
  } = useRooms();

  const {
    reservations,
    loading: reservationsLoading,
    error: reservationsError,
    loadReservations,
  } = useReservations();

  const currentUser = AuthService.getCurrentUser();
  const userIsAdmin = isAdmin(currentUser);
  const userIsCashier = isCashier(currentUser);
  const visibleTabs = filterTabsByRole(tabs, currentUser?.role);

  const [activeTab, setActiveTab] = useState(() => getDefaultTabForRole('chambres', currentUser?.role));
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [equipmentRoomId, setEquipmentRoomId] = useState<number | null>(null);
  const [housekeepingRoomId, setHousekeepingRoomId] = useState<number | null>(null);
  const [maintenanceRoomId, setMaintenanceRoomId] = useState<number | null>(null);
  const [paymentReservation, setPaymentReservation] = useState<Reservation | null>(null);
  const [paymentType, setPaymentType] = useState<'TOTAL' | 'PARTIEL'>('TOTAL');
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  const [paymentAllocations, setPaymentAllocations] = useState<Partial<Record<HotelPaymentMethod, string>>>({});
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const paymentRequestLock = useRef(false);
  const paymentIdempotencyKey = useRef('');
  const [paymentCancelledTrigger, setPaymentCancelledTrigger] = useState(0);

  const roomsData = Array.isArray(rooms) ? rooms : [];
  const reservationsData = Array.isArray(reservations) ? reservations : [];

  // Récupérer les données de caisse
  let caisseData = { solde: 0, entrees: 0, sorties: 0 };
  try {
    if (typeof getModuleCaisseSolde === 'function') {
      caisseData = getModuleCaisseSolde('hotel') || { solde: 0, entrees: 0, sorties: 0 };
    }
  } catch (err) {
    console.error('Erreur lors de la récupération des données de caisse:', err);
  }

  // Calcul dynamique du revenu basé sur les réservations au statut 'TERMINEE'
  const calculatedRevenue = reservationsData
    .filter(r => r?.statut === 'TERMINEE')
    .reduce((sum, r) => sum + (Number(r?.montant_encaisse ?? r?.montant_paye) || 0), 0);

  const finalSolde = (caisseData.solde && caisseData.solde > 0) ? caisseData.solde : calculatedRevenue;

  // Mise à jour du statut vers TERMINEE pour l'encaissement
  const handleEncaisser = (res: Reservation) => {
    const due = Math.max(0, Number(res.montant_total || 0) - Number(res.montant_paye || 0));
    setPaymentReservation(res);
    setPaymentType('TOTAL');
    setPartialPaymentAmount('');
    setPaymentAllocations({ ESPECES: due > 0 ? String(due) : '' });
   
    paymentIdempotencyKey.current = globalThis.crypto?.randomUUID?.()
      || `hotel-${res.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  // Annulation de l'encaissement
  const handleCancelEncaissement = () => {
    setPaymentReservation(null);
   
    setPaymentCancelledTrigger(prev => prev + 1);
  };

  // Check-in logic: Change status from CONFIRMEE to CHECKED_IN
  const handleCheckIn = async (res: Reservation) => {
    try {
      setIsLoading(true);
      await reservationService.updateReservationStatus(res.id, 'CHECKED_IN');
      await Promise.all([refreshRooms(), loadReservations()]);
      setDataRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      console.error("Erreur lors du check-in", error);
      showToast(error?.response?.data?.message || "Erreur lors du check-in de la réservation.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmEncaissement = async () => {
    if (!paymentReservation) return;
    if (paymentRequestLock.current) return;
    const due = Math.max(0, Number(paymentReservation.montant_total || 0) - Number(paymentReservation.montant_paye || 0));
    const amount = paymentType === 'TOTAL' ? due : Number(partialPaymentAmount);
    const modes = Object.entries(paymentAllocations)
      .filter(([, value]) => value !== undefined)
      .map(([moyen_paiement, value]) => ({ moyen_paiement: moyen_paiement as HotelPaymentMethod, montant: Number(value) }));
    const allocated = modes.reduce((sum, mode) => sum + (Number.isFinite(mode.montant) ? mode.montant : 0), 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > due) {
      showToast('Le montant à régler doit être positif et ne peut pas dépasser le solde restant.', 'error');
      return;
    }
    if (!modes.length || modes.some(mode => !Number.isFinite(mode.montant) || mode.montant <= 0)) {
      showToast('Sélectionnez au moins un mode et saisissez un montant positif pour chacun.', 'error');
      return;
    }
    if (Math.round(allocated * 100) !== Math.round(amount * 100)) {
      showToast('La somme des modes de paiement doit être exactement égale au montant à régler.', 'error');
      return;
    }
    paymentRequestLock.current = true;
    try {
      setIsSubmittingPayment(true);
      await reservationService.createReservationPayment(paymentReservation.id, {
        montant: amount,
        modes_paiement: modes,
        idempotency_key: paymentIdempotencyKey.current,
      });
      await Promise.all([refreshRooms(), loadReservations()]);
      setDataRefreshKey((prev) => prev + 1);
      setPaymentReservation(null);
     
    } catch (error: any) {
      console.error("Erreur lors de l'encaissement", error);
      showToast(error?.response?.data?.message || "Erreur lors de l'encaissement de la réservation.", 'error');
    } finally {
      paymentRequestLock.current = false;
      setIsSubmittingPayment(false);
    }
  };

  const paymentDue = paymentReservation
    ? Math.max(0, Number(paymentReservation.montant_total || 0) - Number(paymentReservation.montant_paye || 0))
    : 0;
  const paymentTarget = paymentType === 'TOTAL' ? paymentDue : Number(partialPaymentAmount);
  const paymentAllocated = Object.values(paymentAllocations)
    .reduce((sum, value) => sum + (value === undefined || value === '' ? 0 : Number(value) || 0), 0);
  const canAuthorizeFree = ['admin', 'manager'].includes(String(currentUser?.role || '').toLowerCase());

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([refreshRooms(), loadReservations()]);
      } catch (error: any) {
        console.error('Erreur lors du chargement des données:', error);
        setError(error?.response?.data?.message || 'Impossible de charger les données. Veuillez réessayer.');
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, [refreshRooms, loadReservations]);

  // Statistiques sécurisées
  const safeRooms = roomsData;
  const safeReservations = reservationsData;
  const safeProducts: any[] = [];

  const totalRooms = safeRooms.length;
  const occupiedRooms = safeRooms.filter(r => r?.statut === 'OCCUPEE').length;
  const availableRooms = safeRooms.filter(r => r?.statut === 'LIBRE').length;
  const activeReservations = safeReservations.filter(r => r?.statut === 'CONFIRMEE').length;
  const maintenanceCount = 0;

  if (isLoading && roomsData.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted text-sm md:text-base">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-danger font-medium text-base md:text-lg">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 rounded-xl font-medium text-white bg-accent hover:bg-accent/90 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-primary text-xl md:text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
            Hôtel
          </h2>
          <p className="text-muted text-xs md:text-sm mt-0.5">Gestion complète de l'hôtel</p>
        </div>

        {/* Actions - Mobile Friendly */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsReservationModalOpen(true)}
            className="flex-1 sm:flex-none px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-xs md:text-sm font-medium text-black bg-accent hover:bg-accent/90 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus size={14} className="md:w-4 md:h-4" />
            <span>Réservation</span>
          </button>
          <button
            onClick={() => setIsRoomModalOpen(true)}
            className="flex-1 sm:flex-none px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-xs md:text-sm font-medium text-black bg-accent hover:bg-accent/90 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus size={14} className="md:w-4 md:h-4" />
            <span>Chambre</span>
          </button>
        </div>
      </div>

      {/* Quick Stats - Responsive Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatsCard
          label="Revenu Hôtel"
          value={formatCurrency(finalSolde)}
          icon={Hotel}
          color="accent"
        />
        <StatsCard
          label="Réservations"
          value={activeReservations}
          subValue="actives"
          icon={Calendar}
          color="green"
        />
        <StatsCard
          label="Chambres"
          value={`${occupiedRooms}/${totalRooms}`}
          subValue={`${availableRooms} disponibles`}
          icon={DoorOpen}
          color="blue"
        />
        <StatsCard
          label="Maintenance"
          value={maintenanceCount}
          subValue="en cours"
          icon={Hammer}
          color="orange"
        />
      </div>

      {/* Tabs - Scrollable on Mobile */}
      <div className="relative">
        <div className="flex overflow-x-auto gap-1 bg-surface border border-base rounded-2xl p-1 shadow-soft-sm scrollbar-hide">
          {visibleTabs.map(tab => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none md:hidden" />
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-surface to-transparent pointer-events-none md:hidden" />
      </div>

      {/* Tab Content */}
      <div className="mt-4 md:mt-6">
        {activeTab === 'chambres' && (
          <div className="overflow-x-auto">
            <RoomList
              onViewEquipment={(room) => {
                setEquipmentRoomId(room.id);
                setActiveTab('equipements');
              }}
              onViewHousekeeping={(room) => {
                setHousekeepingRoomId(room.id);
                setActiveTab('housekeeping');
              }}
              onViewMaintenance={(room) => {
                setMaintenanceRoomId(room.id);
                setActiveTab('maintenance');
              }}
              onEdit={(room) => {
                setSelectedRoom(room);
                setIsRoomModalOpen(true);
              }}
              refreshTrigger={dataRefreshKey}
            />
          </div>
        )}
        {activeTab === 'reservations' && (
          <div className="overflow-x-auto">
            <ReservationList
              view="active"
              onEdit={(res) => {
                setSelectedReservation(res);
                setIsReservationModalOpen(true);
              }}
              onEncaisser={handleEncaisser}
              onCheckIn={handleCheckIn}
              refreshTrigger={dataRefreshKey}
              paymentCancelledTrigger={paymentCancelledTrigger}
            />
          </div>
        )}
        {activeTab === 'historiqueReservations' && (
          <div className="overflow-x-auto">
            <ReservationList
              view="history"
              onEdit={(res) => {
                setSelectedReservation(res);
                setIsReservationModalOpen(true);
              }}
              onEncaisser={handleEncaisser}
              onCheckIn={handleCheckIn}
              refreshTrigger={dataRefreshKey}
              paymentCancelledTrigger={paymentCancelledTrigger}
            />
          </div>
        )}
        {activeTab === 'clients' && (
          <div className="bg-surface border border-base rounded-2xl p-4 md:p-6">
            <ClientSearch
              onSelect={(client) => {
                console.log('Client sélectionné:', client);
              }}
            />
          </div>
        )}
        {activeTab === 'equipements' && (
          <div className="overflow-x-auto">
            <EquipmentManager initialRoomId={equipmentRoomId} />
          </div>
        )}
        {activeTab === 'maintenance' && (
          <div className="overflow-x-auto">
            <MaintenanceManager
              initialRoomId={maintenanceRoomId}
              onMaintenanceCompleted={() => {
                setMaintenanceRoomId(null);
                setDataRefreshKey((prev) => prev + 1);
                setActiveTab('chambres');
              }}
            />
          </div>
        )}
        {activeTab === 'housekeeping' && (
          <div className="overflow-x-auto">
            <HousekeepingManager
              initialRoomId={housekeepingRoomId}
              onTaskCompleted={() => {
                setHousekeepingRoomId(null);
                setDataRefreshKey((prev) => prev + 1);
                setActiveTab('chambres');
              }}
            />
          </div>
        )}
        {activeTab === 'stock' && (
          <div className="overflow-x-auto">
            <StockManager
              module="hotel"
              categories={['Mini-bar', 'Entretien', 'Linge', 'Fournitures', 'Autre']}
              refreshTrigger={dataRefreshKey}
            />
          </div>
        )}
        {activeTab === 'rapports' && (
          <HotelReservationCollectionReport
            reservations={reservationsData}
            rooms={roomsData}
            refreshTrigger={dataRefreshKey}
          />
        )}
        {(userIsAdmin || userIsCashier) && activeTab === 'caisse' && (
          <div className="overflow-x-auto">
            <CaisseManager
              module="hotel"
              categories={['Réservations', 'Mini-bar', 'Achats', 'Maintenance', 'Autre']}
            />
          </div>
        )}
        {activeTab === 'rapport' && (
          <HotelDailyReport refreshTrigger={dataRefreshKey} />
        )}
      </div>

      {/* Modals - Responsive */}
      <RoomFormModal
        isOpen={isRoomModalOpen}
        onClose={() => {
          setIsRoomModalOpen(false);
          setSelectedRoom(null);
        }}
        initialData={selectedRoom}
        onSuccess={() => {
          setDataRefreshKey((prev) => prev + 1);
          setIsRoomModalOpen(false);
          setSelectedRoom(null);
        }}
      />

      <ReservationFormModal
        isOpen={isReservationModalOpen}
        onClose={() => {
          setIsReservationModalOpen(false);
          setSelectedReservation(null);
        }}
        initialData={selectedReservation}
        onSuccess={() => {
          setDataRefreshKey((prev) => prev + 1);
          setIsReservationModalOpen(false);
          setSelectedReservation(null);
        }}
      />

      {paymentReservation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 sm:p-5">
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-base bg-surface shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-base p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-bold text-primary">Encaisser la réservation</h2>
                <p className="mt-1 text-sm text-muted">Choisissez le montant et répartissez-le entre les modes de paiement.</p>
              </div>
              <button type="button" onClick={handleCancelEncaissement} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-primary" disabled={isSubmittingPayment}>
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-4 space-y-1 rounded-lg bg-surface-2 p-3 text-sm">
              <div className="flex justify-between text-muted"><span>Total de la réservation</span><span>{formatCurrency(paymentReservation.montant_total || 0)}</span></div>
              <div className="flex justify-between text-emerald-400"><span>Déjà encaissé</span><span>{formatCurrency(paymentReservation.montant_encaisse ?? paymentReservation.montant_paye ?? 0)}</span></div>
              {Number(paymentReservation.montant_gratuit || 0) > 0 && <div className="flex justify-between text-violet-300"><span>Couvert gratuitement</span><span>{formatCurrency(paymentReservation.montant_gratuit || 0)}</span></div>}
              {Number(paymentReservation.montant_credit || 0) > 0 && <div className="flex justify-between text-orange-300"><span>Crédit restant dû</span><span>{formatCurrency(paymentReservation.montant_credit || 0)}</span></div>}
              <div className="flex justify-between border-t border-base pt-1 font-semibold text-accent"><span>Solde réellement dû</span><span>{formatCurrency(paymentDue)}</span></div>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-base px-3 py-2.5">
                <input type="radio" name="paymentType" checked={paymentType === 'TOTAL'} onChange={() => { setPaymentType('TOTAL'); }} disabled={isSubmittingPayment} />
                <span>Paiement total</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-base px-3 py-2.5">
                <input type="radio" name="paymentType" checked={paymentType === 'PARTIEL'} onChange={() => { setPaymentType('PARTIEL'); }} disabled={isSubmittingPayment} />
                <span>Paiement partiel</span>
              </label>
            </div>
            {paymentType === 'PARTIEL' && (
              <label className="mb-4 block space-y-1.5 text-sm">
                <span className="font-medium text-primary">Montant que le client règle maintenant</span>
                <input
                  type="number"
                  min="0.01"
                  max={paymentDue}
                  step="0.01"
                  value={partialPaymentAmount}
                  onChange={(event) => { setPartialPaymentAmount(event.target.value); }}
                  className="input-field w-full rounded-lg px-3 py-2.5"
                  placeholder="Saisir le montant en Ar"
                  disabled={isSubmittingPayment}
                />
              </label>
            )}
            <div className="mb-3 space-y-2">
              <p className="text-sm font-semibold text-primary">Modes de paiement</p>
              {hotelPaymentMethods.map(({ value, label }) => {
                const selected = paymentAllocations[value] !== undefined;
                const freeDisabled = value === 'GRATUIT' && !canAuthorizeFree;
                return (
                  <div key={value} className="rounded-lg border border-base p-2.5">
                    <label className={`flex items-center gap-2 text-sm ${freeDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={isSubmittingPayment || freeDisabled}
                        onChange={(event) => {
                          setPaymentAllocations((previous) => {
                            if (!event.target.checked) {
                              const next = { ...previous };
                              delete next[value];
                              return next;
                            }
                            return { ...previous, [value]: '' };
                          });
                        }}
                      />
                      <span>{label}</span>
                      {value === 'GRATUIT' && freeDisabled && <span className="text-xs text-muted">(direction uniquement)</span>}
                    </label>
                    {selected && (
                      <input
                        type="number"
                        min="0.01"
                        max={paymentDue}
                        step="0.01"
                        value={paymentAllocations[value] ?? ''}
                        onChange={(event) => { setPaymentAllocations((previous) => ({ ...previous, [value]: event.target.value })); }}
                        className="input-field mt-2 w-full rounded-lg px-3 py-2 text-sm"
                        placeholder={`Montant ${label} en Ar`}
                        disabled={isSubmittingPayment}
                        aria-label={`Montant ${label}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mb-3 flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <span className="text-muted">À régler maintenant</span><strong>{formatCurrency(Number.isFinite(paymentTarget) ? paymentTarget : 0)}</strong>
              <span className="text-muted">Répartition</span><strong>{formatCurrency(paymentAllocated)}</strong>
            </div>
            </div>
            <div className="flex shrink-0 gap-3 border-t border-base bg-surface p-4 sm:px-5">
              <button type="button" onClick={handleCancelEncaissement} className="flex-1 rounded-lg border border-base px-4 py-2.5 text-sm text-primary hover:bg-surface-2" disabled={isSubmittingPayment}>
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmEncaissement()}
                className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent-2 disabled:opacity-50"
                disabled={isSubmittingPayment}
              >
                {isSubmittingPayment ? 'Encaissement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HotelPage;
