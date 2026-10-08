import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, History, Search, WalletCards } from 'lucide-react';
import api from '../../lib/api';
import { getBarHistory } from '../../services/bar.service';
import { getPafHistory, type PafClosure } from '../../services/paf.service';
import { formatCurrency } from '../../utils/data';

type HistoryTab = 'paf' | 'caisse';
type CashHistoryOrder = {
  id: number;
  client: string;
  table: number;
  total: number;
  observation?: string;
  moyen_paiement?: string;
  created_at?: string;
  cloture_at?: string;
};

type RoomChargeHistory = {
  id: number;
  roomId: number;
  roomLabel: string;
  client: string;
  reservationId?: number;
  status?: string;
  roomAmount: number;
  barAmount: number;
  total: number;
  date: string;
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const parseFrenchDate = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const direct = new Date(trimmed);
  return Number.isNaN(direct.getTime()) ? null : direct;
};

const dateSearchValue = (value?: string) => {
  const parsed = parseFrenchDate(value);
  return parsed ? parsed.toLocaleDateString('fr-FR') : '';
};

const dateMatchesQuery = (value: string | undefined, query: string) => {
  if (!query) return true;
  const safeQuery = query.trim().toLowerCase();
  if (!safeQuery) return true;

  const candidateValues = [
    value,
    dateSearchValue(value),
    value ? new Date(value).toLocaleDateString('fr-FR') : '',
  ].filter(Boolean) as string[];

  return candidateValues.some((candidate) => candidate.toLowerCase().includes(safeQuery));
};

const cashLocation = (order: CashHistoryOrder) => {
  const kind = order.observation?.trim().toUpperCase();
  if (kind === 'CHAMBRE') return 'Chambre';
  if (kind === 'POKER' || kind === 'POCKER' || kind === 'POKER GRATUIT' || kind === 'POCKER GRATUIT') return 'Table Poker';
  if (kind === 'GRATUIT' || (order.table === 0 && order.moyen_paiement === 'GRATUIT')) return 'Table Gratuit';
  return `Table ${order.table}`;
};

export const BarHistory: React.FC = () => {
  const [tab, setTab] = useState<HistoryTab>('paf');
  const [query, setQuery] = useState('');
  const [pafClosures, setPafClosures] = useState<PafClosure[]>([]);
  const [cashOrders, setCashOrders] = useState<CashHistoryOrder[]>([]);
  const [roomCharges, setRoomCharges] = useState<RoomChargeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoomCharges = async (): Promise<RoomChargeHistory[]> => {
    const [reservationsResponse, consumptionsResponse, barOrdersResponse] = await Promise.all([
      api.get('/api/hebergement/reservations'),
      api.get('/api/hebergement/minibar-consumptions'),
      api.get('/api/bar/orders'),
    ]);

    const reservations = Array.isArray(reservationsResponse.data?.data)
      ? reservationsResponse.data.data
      : Array.isArray(reservationsResponse.data)
        ? reservationsResponse.data
        : [];

    const consumptions = Array.isArray(consumptionsResponse.data?.data)
      ? consumptionsResponse.data.data
      : Array.isArray(consumptionsResponse.data)
        ? consumptionsResponse.data
        : [];

    const barOrders = Array.isArray(barOrdersResponse.data?.data)
      ? barOrdersResponse.data.data
      : Array.isArray(barOrdersResponse.data)
        ? barOrdersResponse.data
        : [];

    const roomMap = new Map<number, RoomChargeHistory>();
    const reservationsById = new Map<number, any>();

    for (const reservation of reservations) {
      const reservationId = Number(reservation?.id ?? 0);
      if (reservationId > 0) {
        reservationsById.set(reservationId, reservation);
      }

      const roomId = Number(reservation?.room_id ?? 0);
      if (!roomId) continue;

      const status = String(reservation?.statut || '').toUpperCase();
      if (!['CONFIRMEE', 'EN_COURS', 'TERMINEE'].includes(status)) continue;

      const roomNumber = reservation?.room?.numero ?? reservation?.room_numero ?? `Chambre ${roomId}`;
      const roomAmount = Number(reservation?.montant_total ?? reservation?.montant_brut ?? 0);
      const entry = roomMap.get(roomId) ?? {
        id: Number(reservation?.id ?? roomId),
        roomId,
        roomLabel: `Chambre ${roomNumber}`,
        client: [reservation?.client?.prenom, reservation?.client?.nom].filter(Boolean).join(' ') || 'Client chambre',
        reservationId: reservationId || undefined,
        status,
        roomAmount: 0,
        barAmount: 0,
        total: 0,
        date: reservation?.updated_at || reservation?.date_depart || reservation?.created_at || new Date().toISOString(),
      };

      entry.roomAmount = Math.max(entry.roomAmount, roomAmount);
      entry.total = entry.roomAmount + entry.barAmount;
      entry.date = reservation?.updated_at || reservation?.date_depart || reservation?.created_at || entry.date;
      roomMap.set(roomId, entry);
    }

    for (const item of consumptions) {
      const roomId = Number(item?.room_id ?? 0);
      if (!roomId) continue;

      const amount = Number(item?.montant ?? 0);
      const row = roomMap.get(roomId) ?? {
        id: roomId,
        roomId,
        roomLabel: `Chambre ${roomId}`,
        client: 'Client chambre',
        roomAmount: 0,
        barAmount: 0,
        total: 0,
        date: item?.consumed_at || new Date().toISOString(),
      };

      row.barAmount += Number.isFinite(amount) && amount > 0 ? amount : (Number(item?.quantite || 0) * Number(item?.prix_unitaire || 0));
      row.total = row.roomAmount + row.barAmount;
      row.date = item?.consumed_at || row.date;
      roomMap.set(roomId, row);
    }

    for (const order of barOrders) {
      const roomId = Number(order?.room_id ?? 0);
      const reservationId = Number(order?.hotel_reservation_id ?? 0);
      const linkedReservation = reservationId > 0 ? reservationsById.get(reservationId) : null;
      const resolvedRoomId = roomId || (linkedReservation ? Number(linkedReservation?.room_id ?? 0) : 0);
      if (!resolvedRoomId) continue;

      const roomEntry = roomMap.get(resolvedRoomId) ?? {
        id: resolvedRoomId,
        roomId: resolvedRoomId,
        roomLabel: `Chambre ${resolvedRoomId}`,
        client: order?.room_guest_name || order?.client || 'Client chambre',
        roomAmount: 0,
        barAmount: 0,
        total: 0,
        date: order?.created_at || new Date().toISOString(),
      };

      if (linkedReservation) {
        const linkedRoomAmount = Number(linkedReservation?.montant_total ?? linkedReservation?.montant_brut ?? 0);
        if (linkedRoomAmount > 0) {
          roomEntry.roomAmount = Math.max(roomEntry.roomAmount, linkedRoomAmount);
        }
      }

      roomEntry.barAmount += Number(order?.total || 0);
      roomEntry.total = roomEntry.roomAmount + roomEntry.barAmount;
      roomEntry.date = order?.created_at || roomEntry.date;
      roomEntry.client = order?.room_guest_name || roomEntry.client || 'Client chambre';
      roomMap.set(resolvedRoomId, roomEntry);
    }

    return Array.from(roomMap.values())
      .filter((entry) => entry.total > 0)
      .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pafResult, caisseResult, roomResult] = await Promise.allSettled([
          getPafHistory(),
          getBarHistory(),
          loadRoomCharges(),
        ]);

        if (pafResult.status === 'fulfilled') {
          setPafClosures(pafResult.value);
        }
        if (caisseResult.status === 'fulfilled') {
          setCashOrders(caisseResult.value as CashHistoryOrder[]);
        }
        if (roomResult.status === 'fulfilled') {
          setRoomCharges(roomResult.value);
        }

        const hasAnyData = (
          pafResult.status === 'fulfilled' && Array.isArray(pafResult.value) && pafResult.value.length > 0
        ) || (
          caisseResult.status === 'fulfilled' && Array.isArray(caisseResult.value) && caisseResult.value.length > 0
        ) || (
          roomResult.status === 'fulfilled' && Array.isArray(roomResult.value) && roomResult.value.length > 0
        );

        if (!hasAnyData) {
          setError("L'historique n'a pas pu être chargé.");
        }
      } catch (loadError) {
        console.error('Erreur chargement historique Bar:', loadError);
        setError("L'historique n'a pas pu être chargé.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR');
  const filteredPaf = useMemo(() => pafClosures.filter((closure) => {
    const haystack = [closure.reference, closure.date, formatDate(closure.dateCloture), dateSearchValue(closure.dateCloture)].join(' ').toLocaleLowerCase('fr-FR');
    return haystack.includes(normalizedQuery) || dateMatchesQuery(closure.dateCloture, normalizedQuery);
  }), [pafClosures, normalizedQuery]);
  const filteredCash = useMemo(() => cashOrders.filter((order) => {
    const haystack = [cashLocation(order), order.client, formatDate(order.cloture_at || order.created_at), dateSearchValue(order.cloture_at || order.created_at), order.moyen_paiement].join(' ').toLocaleLowerCase('fr-FR');
    return haystack.includes(normalizedQuery) || dateMatchesQuery(order.cloture_at || order.created_at, normalizedQuery);
  }), [cashOrders, normalizedQuery]);
  const filteredRoomCharges = useMemo(() => roomCharges.filter((entry) => {
    const haystack = [entry.roomLabel, entry.client, entry.status, formatDate(entry.date), String(entry.total)].join(' ').toLocaleLowerCase('fr-FR');
    return haystack.includes(normalizedQuery) || dateMatchesQuery(entry.date, normalizedQuery);
  }), [roomCharges, normalizedQuery]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-accent/30 bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><History size={22} /></div>
            <div><h2 className="font-semibold text-primary">Historique</h2><p className="mt-1 text-sm text-muted">Archives conservées après la clôture des PAF et de la caisse.</p></div>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="date" aria-label="Rechercher par date" className="w-full rounded-xl border border-base bg-surface-2 px-3 py-2.5 text-sm text-primary outline-none focus:border-accent" />
          </div>
        </div>
        <div className="mt-5 flex w-fit rounded-xl border border-base bg-surface-2 p-1">
          <button type="button" onClick={() => setTab('paf')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'paf' ? 'bg-accent text-black' : 'text-muted hover:text-primary'}`}>Historique PAF</button>
          <button type="button" onClick={() => setTab('caisse')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'caisse' ? 'bg-accent text-black' : 'text-muted hover:text-primary'}`}>Historique Caisse</button>
        </div>
      </div>

      {loading && <div className="rounded-xl border border-base bg-surface p-6 text-sm text-muted">Chargement de l'historique…</div>}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      {!loading && !error && tab === 'paf' && (
        <div className="space-y-3">
          {filteredPaf.length === 0 ? <EmptyHistory label="Aucune clôture PAF ne correspond à cette recherche." /> : filteredPaf.map((closure) => (
            <article key={closure.id} className="rounded-xl border border-base bg-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-primary">{closure.reference}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted"><CalendarDays size={13} /> Session du {closure.date} · clôturée le {formatDate(closure.dateCloture)}</p></div><strong className="text-lg text-accent">{formatCurrency(closure.summary.totalAmount)}</strong></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><Stat label="Tickets" value={closure.summary.totalTickets} /><Stat label="Hommes" value={closure.summary.homme} /><Stat label="Femmes" value={closure.summary.femme} /></div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'caisse' && (
        <div className="space-y-4">
          <div className="space-y-3">
            {filteredCash.length === 0 ? <EmptyHistory label="Aucune commande de caisse clôturée ne correspond à cette recherche." /> : filteredCash.map((order) => (
              <article key={order.id} className="rounded-xl border border-base bg-surface p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-accent/15 px-2 text-accent"><WalletCards size={18} /></div><div><p className="font-semibold text-primary">{cashLocation(order)}</p><p className="mt-0.5 text-sm text-secondary">{order.client || 'Client non renseigné'}</p><p className="mt-1 text-xs text-muted">Clôturée le {formatDate(order.cloture_at || order.created_at)} · {order.moyen_paiement || 'ESPECES'}</p></div></div><strong className="text-lg text-accent">{formatCurrency(order.total)}</strong></div></article>
            ))}
          </div>

          <div className="rounded-xl border border-dashed border-base bg-surface/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-secondary">Historique chambres</p>
                <p className="mt-1 text-xs text-muted">Total de la chambre + achats bar ajoutés au compte hôtel.</p>
              </div>
            </div>

            {filteredRoomCharges.length === 0 ? (
              <div className="text-sm text-muted">Aucun achat chambre n’a été enregistré pour cette recherche.</div>
            ) : (
              <div className="space-y-3">
                {filteredRoomCharges.map((entry) => (
                  <article key={`${entry.roomId}-${entry.reservationId ?? 'no-res'}`} className="rounded-xl border border-base bg-surface p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-accent/15 px-2 text-accent"><WalletCards size={18} /></div>
                        <div>
                          <p className="font-semibold text-primary">{entry.roomLabel}</p>
                          <p className="mt-0.5 text-sm text-secondary">{entry.client || 'Client chambre'}</p>
                          <p className="mt-1 text-xs text-muted">{formatDate(entry.date)} · {entry.status || 'Hébergement'}</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs text-muted">Chambre {formatCurrency(entry.roomAmount)} · Bar {formatCurrency(entry.barAmount)}</p>
                        <strong className="text-lg text-accent">{formatCurrency(entry.total)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => <div className="rounded-lg bg-surface-2 p-2"><p className="text-muted">{label}</p><p className="mt-1 font-semibold text-primary">{value}</p></div>;
const EmptyHistory = ({ label }: { label: string }) => <div className="rounded-xl border border-base bg-surface p-6 text-center text-sm text-muted">{label}</div>;
