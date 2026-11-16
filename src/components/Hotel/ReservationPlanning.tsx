import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  DoorOpen,
  MoreHorizontal,
  RefreshCw,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRooms } from '../../hooks/useRooms';
import { useReservations } from '../../hooks/useReservations';
import { reservationService } from '../../services/reservation.service';
import { roomService } from '../../services/room.service';
import { Reservation, Room } from '../../types/hotel.types';

type ViewMode = 'grid' | 'month';

interface ReservationPlanningProps {
  onCreate: (prefill?: Partial<Reservation>) => void;
  onDetails: (reservation: Reservation) => void;
  refreshTrigger?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const parseDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);
const addDays = (value: string, amount: number) => dateKey(new Date(parseDate(value).getTime() + amount * DAY_MS));
const formatDay = (value: string) => parseDate(value).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
const formatMonth = (value: string) => parseDate(value).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

const activeReservation = (reservation: Reservation) => !['ANNULEE', 'NO_SHOW', 'TERMINEE'].includes(reservation.statut);
const reservationForCell = (reservations: Reservation[], roomId: number, day: string) => reservations.find((reservation) =>
  reservation.room_id === roomId
  && activeReservation(reservation)
  && reservation.date_arrivee.slice(0, 10) <= day
  && reservation.date_depart.slice(0, 10) > day
);

const statusLabel: Record<Reservation['statut'], string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  CHECKED_IN: 'Arrivée',
  EN_COURS: 'En cours',
  ANNULEE: 'Annulée',
  TERMINEE: 'Terminée',
  NO_SHOW: 'No-show',
};

const statusClass: Record<Reservation['statut'], string> = {
  EN_ATTENTE: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  CONFIRMEE: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  CHECKED_IN: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  EN_COURS: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  ANNULEE: 'bg-red-500/20 text-red-700 border-red-500/30',
  TERMINEE: 'bg-slate-500/20 text-slate-700 border-slate-500/30',
  NO_SHOW: 'bg-slate-500/20 text-slate-700 border-slate-500/30',
};

const roomCategoryStyles = [
  { label: 'Bleu', row: 'bg-blue-500/10', cell: 'bg-blue-500/5', border: 'border-blue-500/40', dot: 'bg-blue-500' },
  { label: 'Vert', row: 'bg-emerald-500/10', cell: 'bg-emerald-500/5', border: 'border-emerald-500/40', dot: 'bg-emerald-500' },
  { label: 'Violet', row: 'bg-violet-500/10', cell: 'bg-violet-500/5', border: 'border-violet-500/40', dot: 'bg-violet-500' },
  { label: 'Orange', row: 'bg-orange-500/10', cell: 'bg-orange-500/5', border: 'border-orange-500/40', dot: 'bg-orange-500' },
  { label: 'Rose', row: 'bg-rose-500/10', cell: 'bg-rose-500/5', border: 'border-rose-500/40', dot: 'bg-rose-500' },
  { label: 'Cyan', row: 'bg-cyan-500/10', cell: 'bg-cyan-500/5', border: 'border-cyan-500/40', dot: 'bg-cyan-500' },
];

const clientName = (reservation: Reservation) => [reservation.client?.prenom, reservation.client?.nom]
  .filter(Boolean)
  .join(' ')
  || `Réservation #${reservation.id}`;

export const ReservationPlanning: React.FC<ReservationPlanningProps> = ({ onCreate, onDetails, refreshTrigger }) => {
  const { rooms, loading: roomsLoading, loadRooms } = useRooms();
  const { reservations, loading: reservationsLoading, loadReservations } = useReservations();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [anchorDate, setAnchorDate] = useState(() => dateKey(new Date()));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TOUS');
  const [roomStatusFilter, setRoomStatusFilter] = useState('TOUS');
  const [context, setContext] = useState<{ x: number; y: number; room: Room; day: string; reservation?: Reservation } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const days = useMemo(() => Array.from({ length: viewMode === 'grid' ? 14 : 35 }, (_, index) =>
    addDays(viewMode === 'grid' ? anchorDate : `${anchorDate.slice(0, 7)}-01`, index)
  ), [anchorDate, viewMode]);

  const filteredRooms = rooms.filter((room) =>
    (!search || room.numero.toLowerCase().includes(search.toLowerCase()))
    && (roomStatusFilter === 'TOUS' || room.statut === roomStatusFilter)
  );
  const filteredReservations = reservations.filter((reservation) =>
    statusFilter === 'TOUS' || reservation.statut === statusFilter
  );
  const categoryStyles = useMemo(() => {
    const styles = new Map<number, typeof roomCategoryStyles[number]>();
    const categories = Array.from(new Set(filteredRooms.map((room) => room.room_type?.nom || 'Type non défini')));
    categories.forEach((category, index) => {
      styles.set(index, roomCategoryStyles[index % roomCategoryStyles.length]);
    });
    return new Map(filteredRooms.map((room) => [
      room.id,
      styles.get(categories.indexOf(room.room_type?.nom || 'Type non défini')) || roomCategoryStyles[0],
    ]));
  }, [filteredRooms]);
  const selectedRooms = filteredRooms.filter((room) =>
    selectedCellsHasRoom(room.id)
  );

  function selectedCellsHasRoom(roomId: number) {
    return Array.from(selectedCells).some((key) => key.startsWith(`${roomId}:`));
  }

  useEffect(() => {
    void Promise.all([loadRooms(), loadReservations()]);
  }, [loadRooms, loadReservations, refreshTrigger]);

  useEffect(() => {
    const close = () => setContext(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, []);

  const movePeriod = (amount: number) => setAnchorDate(addDays(anchorDate, viewMode === 'grid' ? amount * 7 : amount * 35));
  const toggleCell = (roomId: number, day: string, additive: boolean) => {
    const key = `${roomId}:${day}`;
    setSelectedCells((previous) => {
      const next = additive ? new Set(previous) : new Set<string>();
      if (additive && next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const openContext = (event: React.MouseEvent, room: Room, day: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContext({ x: Math.min(event.clientX, window.innerWidth - 250), y: Math.min(event.clientY, window.innerHeight - 310), room, day, reservation: reservationForCell(filteredReservations, room.id, day) });
  };

  const runAction = async (action: 'block' | 'maintenance' | 'release' | 'checkin' | 'checkout') => {
    if (!context) return;
    setBusy(true);
    try {
      if (action === 'checkin' && context.reservation) {
        await reservationService.checkIn(context.reservation.id);
      } else if (action === 'checkout' && context.reservation) {
        const stays = await reservationService.getStays({ reservation_id: context.reservation.id });
        const stay = stays.find((item) => !item.checkout_at) || stays[0];
        if (!stay) throw new Error('Aucun séjour actif pour cette réservation.');
        await reservationService.checkOut(stay.id);
      } else {
        await roomService.updateRoomStatus(context.room.id, action === 'block' ? 'HORS_SERVICE' : action === 'maintenance' ? 'MAINTENANCE' : 'LIBRE');
      }
      toast.success('Action effectuée');
      setContext(null);
      await Promise.all([loadRooms(), loadReservations()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const runBulkRoomAction = async (action: 'block' | 'maintenance' | 'release') => {
    if (!selectedRooms.length) return;
    setBusy(true);
    try {
      const status = action === 'block' ? 'HORS_SERVICE' : action === 'maintenance' ? 'MAINTENANCE' : 'LIBRE';
      await Promise.all(selectedRooms.map((room) => roomService.updateRoomStatus(room.id, status)));
      toast.success(`${selectedRooms.length} chambre(s) mise(s) à jour`);
      setSelectedCells(new Set());
      await loadRooms();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action groupée impossible');
    } finally {
      setBusy(false);
    }
  };

  const renderCell = (room: Room, day: string) => {
    const reservation = reservationForCell(filteredReservations, room.id, day);
    const isRoomUnavailable = room.statut === 'HORS_SERVICE' || room.statut === 'MAINTENANCE';
    const categoryStyle = categoryStyles.get(room.id) || roomCategoryStyles[0];
    return (
      <button
        type="button"
        key={`${room.id}-${day}`}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey) {
            toggleCell(room.id, day, true);
            return;
          }
          setSelectedCells(new Set());
          if (reservation) onDetails(reservation);
          else onCreate({ room_id: room.id, date_arrivee: day, date_depart: addDays(day, 1) });
        }}
        onContextMenu={(event) => openContext(event, room, day)}
        className={`relative min-h-16 min-w-28 border-r border-b border-base p-1.5 text-left transition-colors hover:bg-accent/10 ${selectedCells.has(`${room.id}:${day}`) ? 'ring-2 ring-inset ring-accent bg-accent/10' : ''} ${isRoomUnavailable ? 'bg-red-500/5' : reservation ? categoryStyle.cell : 'bg-surface'}`}
        title={reservation ? `${clientName(reservation)} - ${statusLabel[reservation.statut]}` : 'Cliquer pour créer une réservation'}
      >
        {reservation ? (
          <span className={`block h-full rounded-lg border px-2 py-1 text-[11px] font-semibold ${categoryStyle.border} ${statusClass[reservation.statut]}`}>
            <span className="block truncate">{clientName(reservation)}</span>
            <span className="mt-1 block text-[10px] font-normal">{statusLabel[reservation.statut]}</span>
          </span>
        ) : isRoomUnavailable ? (
          <span className="text-[10px] font-medium text-red-600">{room.statut === 'MAINTENANCE' ? 'Maintenance' : 'Hors service'}</span>
        ) : (
          <span className="text-[10px] text-muted">Disponible</span>
        )}
      </button>
    );
  };

  return (
    <section className="space-y-4 rounded-2xl border border-base bg-surface p-3 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-primary"><CalendarDays size={20} className="text-accent" /> Planning des réservations</h3>
          <p className="text-xs text-muted">Cliquez pour consulter ou créer. Clic droit pour les actions rapides.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-2 text-xs font-medium ${viewMode === 'grid' ? 'bg-accent text-black' : 'bg-surface-2 text-muted'}`}>14 jours</button>
          <button type="button" onClick={() => setViewMode('month')} className={`rounded-lg px-3 py-2 text-xs font-medium ${viewMode === 'month' ? 'bg-accent text-black' : 'bg-surface-2 text-muted'}`}>Mois</button>
          <button type="button" onClick={() => { void Promise.all([loadRooms(), loadReservations()]); }} className="rounded-lg bg-surface-2 p-2 text-muted hover:text-primary" title="Actualiser"><RefreshCw size={16} /></button>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une chambre..." className="input-field rounded-lg px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input-field rounded-lg px-3 py-2 text-sm">
          <option value="TOUS">Toutes les réservations</option>
          {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={roomStatusFilter} onChange={(event) => setRoomStatusFilter(event.target.value)} className="input-field rounded-lg px-3 py-2 text-sm">
          <option value="TOUS">Tous les états chambre</option>
          {['LIBRE', 'RESERVEE', 'OCCUPEE', 'NETTOYAGE', 'MAINTENANCE', 'HORS_SERVICE'].map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
        </select>
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-2">
          <button type="button" onClick={() => movePeriod(-1)} className="p-2 text-muted hover:text-primary"><ChevronLeft size={17} /></button>
          <span className="text-xs font-semibold capitalize text-primary">{viewMode === 'grid' ? `${formatDay(days[0])} - ${formatDay(days[days.length - 1])}` : formatMonth(days[0])}</span>
          <button type="button" onClick={() => movePeriod(1)} className="p-2 text-muted hover:text-primary"><ChevronRight size={17} /></button>
        </div>
        {selectedCells.size > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-primary">
              <strong>{selectedCells.size}</strong> cellule(s) sélectionnée(s), <strong>{selectedRooms.length}</strong> chambre(s) concernée(s).
              <span className="ml-1 text-muted">Ctrl/Cmd + clic pour ajouter.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void runBulkRoomAction('release')} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-700 disabled:opacity-40">Libérer</button>
              <button type="button" disabled={busy} onClick={() => void runBulkRoomAction('maintenance')} className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-700 disabled:opacity-40">Maintenance</button>
              <button type="button" disabled={busy} onClick={() => void runBulkRoomAction('block')} className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-40">Bloquer</button>
              <button type="button" onClick={() => setSelectedCells(new Set())} className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">Annuler</button>
            </div>
          </div>
        )}
      </div>
      {(roomsLoading || reservationsLoading) ? <div className="flex items-center justify-center py-12 text-muted"><Clock3 className="mr-2 animate-pulse" size={18} /> Chargement du planning...</div> : (
        <div className="max-h-[70vh] overflow-auto rounded-xl border border-base">
          <div className="min-w-max">
            <div className="grid" style={{ gridTemplateColumns: `180px repeat(${days.length}, minmax(112px, 1fr))` }}>
              <div className="sticky left-0 top-0 z-30 border-r border-b border-base bg-surface-2 p-3 text-xs font-bold text-primary">Chambre</div>
              {days.map((day) => <div key={day} className="sticky top-0 z-20 border-b border-base bg-surface-2 p-3 text-center text-xs font-semibold capitalize text-primary">{formatDay(day)}</div>)}
              {filteredRooms.map((room) => (
                <React.Fragment key={room.id}>
                  <div className={`sticky left-0 z-10 flex min-h-16 items-center gap-2 border-r border-b border-base p-3 ${categoryStyles.get(room.id)?.row || roomCategoryStyles[0].row}`}>
                    <DoorOpen size={16} className="text-accent" />
                    <div>
                      <p className="text-sm font-bold text-primary">{room.numero}</p>
                      <p className="text-[10px] text-muted">{room.room_type?.nom || 'Type non défini'}</p>
                    </div>
                  </div>
                  {days.map((day) => renderCell(room, day))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
      {!roomsLoading && !filteredRooms.length && <div className="py-8 text-center text-sm text-muted">Aucune chambre ne correspond aux filtres.</div>}
      {context && (
        <div className="fixed z-[80] w-60 rounded-xl border border-base bg-surface p-1.5 shadow-2xl" style={{ left: context.x, top: context.y }} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-base px-3 py-2">
            <span className="text-xs font-bold text-primary">Chambre {context.room.numero}</span>
            <button type="button" onClick={() => setContext(null)} className="text-muted"><X size={14} /></button>
          </div>
          <button type="button" disabled={busy || Boolean(context.reservation)} onClick={() => { onCreate({ room_id: context.room.id, date_arrivee: context.day, date_depart: addDays(context.day, 1) }); setContext(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"><CalendarDays size={15} /> Nouvelle réservation</button>
          {context.reservation && <button type="button" onClick={() => { onDetails(context.reservation!); setContext(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-accent/10"><MoreHorizontal size={15} /> Voir les détails</button>}
          {context.reservation && !['CHECKED_IN', 'EN_COURS', 'TERMINEE', 'ANNULEE'].includes(context.reservation.statut) && <button type="button" disabled={busy} onClick={() => void runAction('checkin')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-accent/10 disabled:opacity-40"><CircleCheck size={15} /> Check-in</button>}
          {context.reservation && ['CHECKED_IN', 'EN_COURS'].includes(context.reservation.statut) && <button type="button" disabled={busy} onClick={() => void runAction('checkout')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-accent/10 disabled:opacity-40"><CircleCheck size={15} /> Check-out</button>}
          <button type="button" disabled={busy || Boolean(context.reservation)} onClick={() => void runAction(context.room.statut === 'HORS_SERVICE' ? 'release' : 'block')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-accent/10 disabled:opacity-40"><DoorOpen size={15} /> {context.room.statut === 'HORS_SERVICE' ? 'Débloquer la chambre' : 'Bloquer la chambre'}</button>
          <button type="button" disabled={busy || Boolean(context.reservation)} onClick={() => void runAction(context.room.statut === 'MAINTENANCE' ? 'release' : 'maintenance')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-accent/10 disabled:opacity-40"><Wrench size={15} /> {context.room.statut === 'MAINTENANCE' ? 'Terminer maintenance' : 'Mettre en maintenance'}</button>
        </div>
      )}
    </section>
  );
};
