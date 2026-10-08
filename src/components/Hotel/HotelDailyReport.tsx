// components/Hotel/HotelDailyReport.tsx
//
// Rapport journalier de l'hôtel : « Situation du chambre durant la Nuité ».
//
// Le rapport est automatique : chaque ligne est dérivée en continu des chambres
// et des réservations couvrant la nuitée, les données sources sont rafraîchies
// périodiquement, et le rapport est enregistré tout seul dès qu'il change.
// La réception garde la main sans quitter l'automatisme : corriger un champ pose
// une exception sur ce seul champ, le reste de la ligne continue de suivre les
// réservations. Ces exceptions sont persistées avec le rapport, sinon la
// régénération suivante les écraserait.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ClipboardList,
  Clipboard,
  Loader,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  Zap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Client,
  HotelDailyReportAutoState,
  HotelDailyReportMetrics,
  HotelDailyReportRoomLine,
  HotelDailyReportRoomState,
  Reservation,
  Room,
} from '../../types/hotel.types';
import { useRooms } from '../../hooks/useRooms';
import { useReservations } from '../../hooks/useReservations';
import { useClients } from '../../hooks/useClients';
import { hotelReportService } from '../../services/hotelReport.service';
import { HotelReportWhatsapp } from './HotelReportWhatsapp';
import AuthService from '../../services/authService';
import { printThermalText } from '../../utils/thermalPrint';

/** Cadence de rafraîchissement des chambres / réservations pendant la nuitée. */
const SOURCE_REFRESH_MS = 60_000;
/** Délai d'inactivité avant l'enregistrement automatique. */
const AUTOSAVE_DEBOUNCE_MS = 2_000;

const ETAT_OPTIONS: Array<{ value: HotelDailyReportRoomState; label: string }> = [
  { value: 'LIBRE', label: 'Libre' },
  { value: 'OCCUPEE', label: 'Occupée' },
  { value: 'BK', label: 'BK — Booking' },
  { value: 'CP', label: 'CP — Crédit payé' },
  { value: 'CN', label: 'CN — Crédit non payé' },
  { value: 'NP', label: 'NP — Non payé' },
  { value: 'GRATUIT', label: 'Chambre gratuite' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
];

const ETAT_BADGE: Record<HotelDailyReportRoomState, string> = {
  LIBRE: 'text-emerald-400 bg-emerald-500/10',
  OCCUPEE: 'text-sky-400 bg-sky-500/10',
  BK: 'text-indigo-400 bg-indigo-500/10',
  CP: 'text-emerald-400 bg-emerald-500/10',
  CN: 'text-red-400 bg-red-500/10',
  NP: 'text-orange-400 bg-orange-500/10',
  GRATUIT: 'text-violet-400 bg-violet-500/10',
  MAINTENANCE: 'text-amber-400 bg-amber-500/10',
};

// Bas de page du rapport manuscrit, reproduit tel quel.
const LEGENDE: string[] = [
  'E: EMPRUNTE',
  'TE: TOTAL EMPRUNTE',
  'TP: TOTAL PAYÉ',
  'AC: AUTRE CRÉDIT',
  "DA: DATE D'ARRIVÉE",
  'DD: DATE DE DÉPART',
  'ND: NON DEFINI',
  'P: PAYMENT',
  'MT: MONTANT',
  'BK: BOOKING',
  'NP: NON PAYÉ',
  'CH: CHAMBRE',
  'CP: CRÉDIT PAYÉ',
  'CN: Crédit non payé',
];

const PAYMENT_LABELS: Record<string, string> = {
  ESPECES: 'espèces',
  TPE: 'TPE',
  MVOLA: 'MVola',
  ORANGE_MONEY: 'Orange Money',
  CARTE: 'carte bancaire',
  VIREMENT: 'virement',
  CREDIT: 'crédit',
  GRATUIT: 'gratuit',
};

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Nuitée en cours. Une nuitée court du soir au petit matin : avant midi, le
 * rapport à tenir est encore celui de la veille — c'est celui que l'équipe de
 * nuit vient de vivre.
 */
const getCurrentNightDate = (): string => {
  const now = new Date();
  if (now.getHours() < 12) now.setDate(now.getDate() - 1);
  return toIsoDate(now);
};

const formatNowTime = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
};

/** Convertit « 2026-09-27 » (ou un ISO complet) en « 27/09/26 » comme sur le rapport. */
const toShortDate = (value?: string | null): string => {
  if (!value) return '';
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year.slice(2)}`;
};

const toAmount = (value: unknown): string => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount === 0) return '';
  return `${amount.toLocaleString('fr-FR')} Ar`;
};

const compareRoomNumbers = (a: string, b: string): number => {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB;
  return String(a).localeCompare(String(b), 'fr', { numeric: true });
};

const emptyLine = (numero = ''): HotelDailyReportRoomLine => ({
  room_id: null,
  numero,
  etat: 'LIBRE',
  occupant: 'libre',
  note: '',
  da: '',
  dd: '',
  mt: '',
  p: '',
  cn: '',
  e: '',
  ac: '',
});

const EMPTY_AUTO_STATE: HotelDailyReportAutoState = {
  overrides: {},
  removed: [],
  extra: [],
  heureDebutManuelle: false,
  heureFinManuelle: false,
};

/** Réservation occupant la chambre pendant la nuitée du `reportDate`. */
const findReservationForNight = (
  reservations: Reservation[],
  roomId: number,
  reportDate: string
): Reservation | null => {
  const candidates = reservations.filter((res) => {
    if (Number(res?.room_id) !== roomId) return false;
    if (res?.statut === 'ANNULEE' || res?.statut === 'NO_SHOW') return false;

    const arrivee = String(res?.date_arrivee || '').slice(0, 10);
    const depart = String(res?.date_depart || '').slice(0, 10);
    if (!arrivee || arrivee > reportDate) return false;

    // Séjour ouvert (départ non défini) ou usage à la journée : la nuitée compte
    // dès lors que l'arrivée est celle du rapport.
    if (!depart || depart <= arrivee) return arrivee === reportDate;
    return depart > reportDate;
  });

  if (candidates.length === 0) return null;
  return candidates.reduce((latest, res) =>
    String(res.date_arrivee || '') > String(latest.date_arrivee || '') ? res : latest
  );
};

const buildLineFromReservation = (
  room: Room,
  reservation: Reservation,
  client?: Client
): HotelDailyReportRoomLine => {
  const total = Number(reservation.montant_total || 0);
  const paye = Number(reservation.montant_paye || 0);
  const reste = Math.max(0, total - paye);
  const moyen = String(reservation.moyen_paiement || '').toUpperCase();
  const moyenLabel = PAYMENT_LABELS[moyen] || moyen.toLowerCase();

  const prenom = client?.prenom || reservation.client?.prenom || (reservation as any).client_prenom || '';
  const nom = client?.nom || reservation.client?.nom || (reservation as any).client_nom || '';
  const occupant = `${prenom} ${nom}`.trim() || 'Client';

  let etat: HotelDailyReportRoomState = 'OCCUPEE';
  let note = '';
  if (moyen === 'GRATUIT') {
    etat = 'GRATUIT';
    note = '(Chambre gratuit)';
  } else if (moyen === 'CREDIT') {
    etat = reste > 0 ? 'CN' : 'CP';
  } else if (reste > 0) {
    etat = 'NP';
  }
  if (reservation.type_reservation === 'BOOKING') {
    note = note ? `Booking ${note}` : 'Booking';
    if (etat === 'OCCUPEE') etat = 'BK';
  }

  // P : ce qui a réellement été encaissé, et par qui.
  const encaisseur = `${reservation.created_by_prenom || ''} ${reservation.created_by_nom || ''}`.trim();
  const paiementParts: string[] = [];
  if (paye > 0) {
    paiementParts.push(`${paye.toLocaleString('fr-FR')} Ar payé par ${moyenLabel || 'espèces'}`);
    if (encaisseur) paiementParts.push(`reçu par ${encaisseur}`);
  }

  const departIso = String(reservation.date_depart || '').slice(0, 10);
  const arriveeIso = String(reservation.date_arrivee || '').slice(0, 10);

  return {
    room_id: room.id,
    numero: room.numero,
    etat,
    occupant,
    note,
    da: toShortDate(arriveeIso),
    dd: !departIso || departIso <= arriveeIso ? 'ND' : toShortDate(departIso),
    mt: toAmount(total),
    p: paiementParts.join(' '),
    cn: etat === 'CN' || etat === 'NP' ? toAmount(reste) : '',
    e: '',
    ac: '',
  };
};

const buildLineFromRoom = (room: Room): HotelDailyReportRoomLine => {
  if (room.statut === 'MAINTENANCE' || room.statut === 'HORS_SERVICE') {
    return {
      ...emptyLine(room.numero),
      room_id: room.id,
      etat: 'MAINTENANCE',
      occupant: room.statut === 'MAINTENANCE' ? 'Maintenance' : 'Hors service',
    };
  }
  return { ...emptyLine(room.numero), room_id: room.id };
};

const computeMetrics = (lines: HotelDailyReportRoomLine[]): HotelDailyReportMetrics => {
  // Les montants du rapport sont du texte libre : on n'additionne que ce qui est
  // clairement numérique, en ignorant les séparateurs de milliers et la devise.
  const parseLoose = (value: string): number => {
    const digits = String(value || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  };

  const libres = lines.filter((line) => line.etat === 'LIBRE').length;
  const occupees = lines.filter((line) => !['LIBRE', 'MAINTENANCE'].includes(line.etat)).length;

  return {
    chambres_total: lines.length,
    chambres_occupees: occupees,
    chambres_libres: libres,
    total_paye: lines.reduce((sum, line) => sum + parseLoose(line.p), 0),
    total_credit: lines.reduce((sum, line) => sum + parseLoose(line.cn) + parseLoose(line.ac), 0),
    total_emprunte: lines.reduce((sum, line) => sum + parseLoose(line.e), 0),
  };
};

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface HotelDailyReportProps {
  /** Incrémenté par la page pour forcer un rechargement des données sources. */
  refreshTrigger?: number;
}

export const HotelDailyReport: React.FC<HotelDailyReportProps> = ({ refreshTrigger }) => {
  const { rooms, loading: roomsLoading, loadRooms } = useRooms();
  const { reservations, loading: reservationsLoading, loadReservations } = useReservations();
  const { clients } = useClients();

  const [reportDate, setReportDate] = useState(getCurrentNightDate);
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [receptionniste, setReceptionniste] = useState('');
  const [observations, setObservations] = useState('');

  // État d'automatisation : ce que la génération ne peut pas redéduire.
  const [overrides, setOverrides] = useState<HotelDailyReportAutoState['overrides']>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [extraLines, setExtraLines] = useState<HotelDailyReportRoomLine[]>([]);
  const [heureDebutManuelle, setHeureDebutManuelle] = useState(false);
  const [heureFinManuelle, setHeureFinManuelle] = useState(false);

  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lastSavedSignatureRef = useRef<string | null>(null);
  const heureFinRef = useRef('');
  heureFinRef.current = heureFin;

  const isToday = reportDate === getCurrentNightDate();

  // Rechargement demandé par la page (encaissement, check-in...).
  useEffect(() => {
    if (refreshTrigger === undefined) return;
    void loadRooms();
    void loadReservations();
  }, [refreshTrigger, loadRooms, loadReservations]);

  // Les chambres et réservations se rafraîchissent d'elles-mêmes tant que le
  // rapport affiché est celui de la nuitée en cours.
  useEffect(() => {
    if (!isToday) return;
    const timer = window.setInterval(() => {
      void loadRooms();
      void loadReservations();
    }, SOURCE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isToday, loadRooms, loadReservations]);

  const roomsReady = !roomsLoading && rooms.length > 0;

  // Situation reconstituée depuis les chambres et les réservations de la nuitée.
  const generatedLines = useMemo(() => {
    const clientsById = new Map(clients.map((client) => [client.id, client]));
    return [...rooms]
      .sort((a, b) => compareRoomNumbers(a.numero, b.numero))
      .map((room) => {
        const reservation = findReservationForNight(reservations, room.id, reportDate);
        if (!reservation) return buildLineFromRoom(room);
        return buildLineFromReservation(room, reservation, clientsById.get(reservation.client_id));
      });
  }, [rooms, reservations, clients, reportDate]);

  /** Lignes issues de l'automatisation, corrections manuelles appliquées. */
  const autoLines = useMemo(() => {
    const removedSet = new Set(removed);
    return generatedLines
      .filter((line) => !removedSet.has(line.numero))
      .map((line) => ({ ...line, ...(overrides[line.numero] || {}) }));
  }, [generatedLines, overrides, removed]);

  const lines = useMemo(() => [...autoLines, ...extraLines], [autoLines, extraLines]);

  const autoState = useMemo<HotelDailyReportAutoState>(
    () => ({ overrides, removed, extra: extraLines, heureDebutManuelle, heureFinManuelle }),
    [overrides, removed, extraLines, heureDebutManuelle, heureFinManuelle]
  );

  // Chargement du rapport de la date : s'il existe, il rétablit l'état
  // d'automatisation tel qu'il était ; sinon le rapport démarre tout seul.
  useEffect(() => {
    let active = true;
    setIsLoadingReport(true);
    setLoadedDate(null);
    setSaveState('idle');
    setSavedAt(null);
    setCopied(false);
    lastSavedSignatureRef.current = null;

    void hotelReportService
      .getReport(reportDate)
      .then((saved) => {
        if (!active) return;
        const state = { ...EMPTY_AUTO_STATE, ...(saved?.autoState || {}) };
        setOverrides(state.overrides || {});
        setRemoved(state.removed || []);
        setExtraLines(state.extra || []);
        setHeureDebutManuelle(Boolean(state.heureDebutManuelle));
        setHeureFinManuelle(Boolean(state.heureFinManuelle));

        if (saved) {
          setHeureDebut(saved.heureDebut || formatNowTime());
          setHeureFin(saved.heureFin || formatNowTime());
          setReceptionniste(saved.receptionniste || '');
          setObservations(saved.observations || '');
          setSavedAt(saved.updatedAt || saved.createdAt || null);
          setSaveState('saved');
        } else {
          // Nouveau rapport : le début de nuitée est l'instant de création, et
          // le réceptionniste est l'utilisateur connecté.
          const currentUser = AuthService.getCurrentUser();
          const now = formatNowTime();
          setHeureDebut(now);
          setHeureFin(now);
          setReceptionniste(`${currentUser?.prenom || ''} ${currentUser?.nom || ''}`.trim());
          setObservations('');
        }
        setLoadedDate(reportDate);
      })
      .catch((error) => {
        console.error('Erreur chargement rapport journalier hôtel:', error);
        if (active) {
          toast.error('Impossible de charger le rapport de cette date.');
          setSaveState('error');
        }
      })
      .finally(() => {
        if (active) setIsLoadingReport(false);
      });

    return () => {
      active = false;
    };
  }, [reportDate]);

  const metrics = useMemo(() => computeMetrics(lines), [lines]);

  // Signature de ce qui mérite un enregistrement. `heureFin` en est exclue quand
  // elle est automatique : elle est horodatée au moment de l'enregistrement, et
  // l'y inclure relancerait un enregistrement en boucle.
  const payloadSignature = useMemo(
    () =>
      JSON.stringify({
        reportDate,
        lines,
        heureDebut,
        heureFin: heureFinManuelle ? heureFin : null,
        receptionniste,
        observations,
        autoState,
      }),
    [reportDate, lines, heureDebut, heureFin, heureFinManuelle, receptionniste, observations, autoState]
  );

  const persist = useCallback(
    async (signature: string) => {
      const fin = heureFinManuelle ? heureFinRef.current : formatNowTime();
      setSaveState('saving');
      try {
        const saved = await hotelReportService.saveReport({
          reportDate,
          heureDebut,
          heureFin: fin,
          receptionniste,
          rooms: lines,
          observations,
          metrics,
          autoState,
        });
        if (!heureFinManuelle) setHeureFin(fin);
        lastSavedSignatureRef.current = signature;
        setSavedAt(saved.updatedAt || saved.createdAt || null);
        setSaveState('saved');
        return true;
      } catch (error: any) {
        console.error('Erreur enregistrement rapport journalier hôtel:', error);
        setSaveState('error');
        toast.error(error?.response?.data?.error?.message || 'Impossible d’enregistrer le rapport.');
        return false;
      }
    },
    [reportDate, heureDebut, heureFinManuelle, receptionniste, lines, observations, metrics, autoState]
  );

  // Enregistrement automatique, après une courte inactivité.
  useEffect(() => {
    if (loadedDate !== reportDate || isLoadingReport) return;
    if (lines.length === 0) return;
    if (lastSavedSignatureRef.current === payloadSignature) return;

    setSaveState('pending');
    const timer = window.setTimeout(() => {
      void persist(payloadSignature);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [payloadSignature, loadedDate, reportDate, isLoadingReport, lines.length, persist]);

  /** Modifie une ligne : seul le champ touché est figé, le reste suit les réservations. */
  const updateLine = useCallback(
    (index: number, patch: Partial<HotelDailyReportRoomLine>) => {
      if (index < autoLines.length) {
        const numero = autoLines[index].numero;
        setOverrides((current) => ({ ...current, [numero]: { ...(current[numero] || {}), ...patch } }));
        return;
      }
      const extraIndex = index - autoLines.length;
      setExtraLines((current) => current.map((line, i) => (i === extraIndex ? { ...line, ...patch } : line)));
    },
    [autoLines]
  );

  const removeLine = useCallback(
    (index: number) => {
      if (index < autoLines.length) {
        const numero = autoLines[index].numero;
        setRemoved((current) => (current.includes(numero) ? current : [...current, numero]));
        return;
      }
      const extraIndex = index - autoLines.length;
      setExtraLines((current) => current.filter((_, i) => i !== extraIndex));
    },
    [autoLines]
  );

  const addLine = useCallback(() => {
    setExtraLines((current) => [...current, emptyLine()]);
  }, []);

  const resetAutomation = useCallback(() => {
    if (!window.confirm('Repartir de la situation issue des réservations ? Les corrections manuelles de ce rapport seront perdues.')) {
      return;
    }
    setOverrides({});
    setRemoved([]);
    setExtraLines([]);
    setHeureFinManuelle(false);
    toast.success('Rapport régénéré automatiquement.');
  }, []);

  const reportText = useMemo(() => {
    const header = `Situation du chambre durant la Nuité ${toShortDate(reportDate)} à ${heureDebut || '—'} a ${heureFin || '—'}`;
    const blocks = lines.map((line) => {
      const title = `#${line.numero}: ${[line.occupant, line.note].filter(Boolean).join(' ')}`.trimEnd();
      const rows = [
        line.da && `DA: ${line.da}`,
        line.dd && `DD: ${line.dd}`,
        line.mt && `MT: ${line.mt}`,
        line.p && `P: ${line.p}`,
        line.cn && `CN: ${line.cn}`,
        line.e && `E: ${line.e}`,
        line.ac && `AC: ${line.ac}`,
      ].filter(Boolean);
      return [title, ...rows].join('\n');
    });

    return [
      header,
      '',
      '',
      blocks.join('\n\n\n'),
      '',
      '',
      `RÉCEPTIONNISTE : ${receptionniste || '—'}`,
      ...(observations.trim() ? ['', 'OBSERVATIONS', observations.trim()] : []),
      '',
      ...LEGENDE,
    ].join('\n');
  }, [lines, reportDate, heureDebut, heureFin, receptionniste, observations]);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      toast.success('Rapport copié.');
    } catch {
      toast.error('Copie impossible : sélectionnez le texte manuellement.');
    }
  };

  const saveNow = async () => {
    if (lines.length === 0) {
      toast.error('Aucune chambre à enregistrer.');
      return;
    }
    if (await persist(payloadSignature)) toast.success('Rapport journalier enregistré.');
  };

  const isBusy = isLoadingReport || roomsLoading || reservationsLoading;
  const overridesCount = Object.values(overrides).reduce((sum, patch) => sum + Object.keys(patch || {}).length, 0);

  const saveLabel: Record<SaveState, string> = {
    idle: 'En attente de données',
    pending: 'Modifications en cours…',
    saving: 'Enregistrement…',
    saved: savedAt ? `Enregistré automatiquement à ${new Date(savedAt).toLocaleTimeString('fr-FR')}` : 'Enregistré',
    error: 'Échec de l’enregistrement',
  };
  const saveColor: Record<SaveState, string> = {
    idle: 'text-muted',
    pending: 'text-amber-400',
    saving: 'text-amber-400',
    saved: 'text-emerald-400',
    error: 'text-red-400',
  };

  return (
    <section className="space-y-4">
      {/* En-tête */}
      <div className="rounded-2xl border border-base bg-surface p-4 md:p-5 print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent/10">
              <ClipboardList size={18} className="text-accent" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-primary md:text-lg">Rapport journalière</h3>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  <Zap size={11} />
                  Automatique
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted md:text-sm">
                Situation des chambres générée et enregistrée automatiquement depuis les réservations.
              </p>
              <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${saveColor[saveState]}`}>
                {saveState === 'saving' && <Loader size={11} className="animate-spin" />}
                {saveLabel[saveState]}
                {overridesCount > 0 && (
                  <span className="text-muted">· {overridesCount} correction(s) manuelle(s) conservée(s)</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              <span className="mb-1 block">Nuitée du</span>
              <input
                type="date"
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
                className="rounded-xl border border-base bg-surface-2 px-3 py-2 text-sm font-normal normal-case tracking-normal text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              <span className="mb-1 block">De</span>
              <input
                value={heureDebut}
                onChange={(event) => {
                  setHeureDebut(event.target.value);
                  setHeureDebutManuelle(true);
                }}
                placeholder="17h08"
                className="w-20 rounded-xl border border-base bg-surface-2 px-3 py-2 text-sm font-normal normal-case tracking-normal text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              <span className="mb-1 block">À {!heureFinManuelle && <span className="text-emerald-400">auto</span>}</span>
              <input
                value={heureFin}
                onChange={(event) => {
                  setHeureFin(event.target.value);
                  setHeureFinManuelle(true);
                }}
                placeholder="5h51"
                className="w-20 rounded-xl border border-base bg-surface-2 px-3 py-2 text-sm font-normal normal-case tracking-normal text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              <span className="mb-1 block">Réceptionniste</span>
              <input
                value={receptionniste}
                onChange={(event) => setReceptionniste(event.target.value)}
                placeholder="Nom"
                className="w-40 rounded-xl border border-base bg-surface-2 px-3 py-2 text-sm font-normal normal-case tracking-normal text-primary outline-none focus:border-accent"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
        {([
          ['Chambres', `${metrics.chambres_occupees}/${metrics.chambres_total}`, 'occupées'],
          ['Libres', String(metrics.chambres_libres), 'cette nuitée'],
          ['TP — Total payé', `${metrics.total_paye.toLocaleString('fr-FR')} Ar`, 'somme des lignes P'],
          ['Crédit (CN + AC)', `${metrics.total_credit.toLocaleString('fr-FR')} Ar`, 'restant dû'],
        ] as const).map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-base bg-surface p-4">
            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted md:text-xs">{label}</p>
            <p className="truncate text-lg font-bold text-primary md:text-xl">{value}</p>
            <p className="truncate text-[10px] text-muted md:text-xs">{hint}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={resetAutomation}
          disabled={isBusy}
          className="flex items-center gap-1.5 rounded-xl border border-base px-4 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-surface-2 disabled:opacity-50 md:text-sm"
        >
          <RefreshCw size={15} />
          Régénérer
        </button>
        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-1.5 rounded-xl border border-base px-4 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-surface-2 md:text-sm"
        >
          <Plus size={15} />
          Ajouter une chambre
        </button>
        <button
          type="button"
          onClick={() => void saveNow()}
          disabled={saveState === 'saving' || isBusy}
          className="flex items-center gap-1.5 rounded-xl border border-base px-4 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-surface-2 disabled:opacity-50 md:text-sm"
        >
          <Save size={15} />
          Enregistrer maintenant
        </button>
        <button
          type="button"
          onClick={() => void copyReport()}
          className="flex items-center gap-1.5 rounded-xl border border-base px-4 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-surface-2 md:text-sm"
        >
          <Clipboard size={15} />
          {copied ? 'Copié' : 'Copier le texte'}
        </button>
        <button
          type="button"
          onClick={() => printThermalText('Rapport Hôtel', reportText)}
          className="flex items-center gap-1.5 rounded-xl border border-base px-4 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-surface-2 md:text-sm"
        >
          <Printer size={15} />
          Imprimer
        </button>
      </div>

      {isBusy && (
        <div className="flex items-center gap-2 rounded-xl border border-base bg-surface-2 px-4 py-3 text-sm text-muted print:hidden">
          <Loader size={16} className="animate-spin" />
          Chargement de la situation des chambres...
        </div>
      )}

      {/* Lignes par chambre */}
      <div className="space-y-3 print:hidden">
        {lines.length === 0 && !isBusy && (
          <div className="flex items-center gap-3 rounded-2xl border border-base bg-surface p-6 text-sm text-muted">
            <AlertCircle size={18} className="text-amber-400" />
            Aucune chambre dans ce rapport. Utilisez « Régénérer » ou « Ajouter une chambre ».
          </div>
        )}

        {lines.map((line, index) => {
          const patched = index < autoLines.length ? overrides[line.numero] : undefined;
          return (
            <div key={`${line.room_id ?? 'manuel'}-${line.numero}-${index}`} className="rounded-2xl border border-base bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-accent">#</span>
                <input
                  value={line.numero}
                  onChange={(event) => updateLine(index, { numero: event.target.value })}
                  placeholder="N°"
                  className="w-16 rounded-lg border border-base bg-surface-2 px-2 py-1.5 text-sm font-semibold text-primary outline-none focus:border-accent"
                />
                <input
                  value={line.occupant}
                  onChange={(event) => updateLine(index, { occupant: event.target.value })}
                  placeholder="Mr Jean Noël / libre / CP"
                  className="min-w-[180px] flex-1 rounded-lg border border-base bg-surface-2 px-3 py-1.5 text-sm text-primary outline-none focus:border-accent"
                />
                <input
                  value={line.note}
                  onChange={(event) => updateLine(index, { note: event.target.value })}
                  placeholder="Booking / (Chambre gratuit)"
                  className="w-full rounded-lg border border-base bg-surface-2 px-3 py-1.5 text-sm text-primary outline-none focus:border-accent sm:w-52"
                />
                <select
                  value={line.etat}
                  onChange={(event) => updateLine(index, { etat: event.target.value as HotelDailyReportRoomState })}
                  className={`rounded-lg border border-base px-2 py-1.5 text-xs font-semibold outline-none focus:border-accent ${ETAT_BADGE[line.etat]}`}
                >
                  {ETAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {patched && Object.keys(patched).length > 0 && (
                  <span
                    title={`Champs figés à la main : ${Object.keys(patched).join(', ')}`}
                    className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400"
                  >
                    corrigé
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  title="Retirer cette chambre du rapport"
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ['da', 'DA — arrivée', '27/09/26 ou ND'],
                  ['dd', 'DD — départ', '28/09/26 ou ND'],
                  ['mt', 'MT — montant', '210.000 Ar / 69,30€'],
                  ['cn', 'CN — crédit non payé', '98 000 Ar'],
                  ['e', 'E — emprunté', 'Montant'],
                  ['ac', 'AC — autre crédit', 'Montant'],
                ] as const).map(([key, label, placeholder]) => (
                  <label key={key} className="text-[11px] text-muted">
                    <span className="mb-1 block font-semibold uppercase tracking-wider">{label}</span>
                    <input
                      value={line[key]}
                      onChange={(event) => updateLine(index, { [key]: event.target.value })}
                      placeholder={placeholder}
                      className="w-full rounded-lg border border-base bg-surface-2 px-3 py-1.5 text-sm text-primary outline-none focus:border-accent"
                    />
                  </label>
                ))}
                <label className="text-[11px] text-muted sm:col-span-2">
                  <span className="mb-1 block font-semibold uppercase tracking-wider">P — paiement</span>
                  <input
                    value={line.p}
                    onChange={(event) => updateLine(index, { p: event.target.value })}
                    placeholder="346 500 Ar payé par TPE BFV le 26/09/26 reçu par Angello"
                    className="w-full rounded-lg border border-base bg-surface-2 px-3 py-1.5 text-sm text-primary outline-none focus:border-accent"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Observations */}
      <div className="rounded-2xl border border-base bg-surface p-4 print:hidden">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          <span className="mb-2 block">Observations de la nuitée</span>
          <textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            rows={3}
            placeholder="Incidents, consignes, passages, remises de caisse..."
            className="w-full resize-y rounded-xl border border-base bg-surface-2 px-3 py-2 text-sm font-normal normal-case tracking-normal text-primary outline-none focus:border-accent"
          />
        </label>
      </div>

      {/* Rapport texte */}
      <div className="space-y-2 rounded-2xl border border-base bg-surface p-4 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-primary">Rapport texte (copiable / WhatsApp)</h4>
          <button
            type="button"
            onClick={() => void copyReport()}
            className="flex items-center gap-1.5 rounded-lg border border-base px-3 py-1.5 text-xs text-primary hover:bg-surface-2"
          >
            <Clipboard size={14} />
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
        <textarea
          readOnly
          value={reportText}
          aria-label="Rapport journalier hôtel généré"
          className="min-h-[420px] w-full resize-y rounded-xl border border-base bg-surface-2 p-4 font-mono text-xs leading-6 text-primary outline-none"
        />
      </div>

      {/* Envoi WhatsApp */}
      <HotelReportWhatsapp reportDate={reportDate} savedAt={savedAt} />

      {/* Légende */}
      <div className="rounded-2xl border border-base bg-surface p-4 print:hidden">
        <h4 className="mb-2 text-sm font-semibold text-primary">Légende</h4>
        <div className="grid gap-1 text-xs text-muted sm:grid-cols-2 lg:grid-cols-3">
          {LEGENDE.map((entry) => <span key={entry}>{entry}</span>)}
        </div>
      </div>

      {/* Version imprimable */}
      <div className="hidden text-sm text-black print:block">
        <pre className="whitespace-pre-wrap font-sans text-[12px] leading-5">{reportText}</pre>
      </div>
    </section>
  );
};

export default HotelDailyReport;
