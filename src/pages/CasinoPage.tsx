import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, ClipboardList, Coins, Download, FileText, Printer, Shield, WalletCards } from 'lucide-react';
import { PlayersSheet } from '../components/Casino/sheets/PlayersSheet';
import { PlayerSetupSheet } from '../components/Casino/sheets/PlayerSetupSheet';
import { ChipsSheet } from '../components/Casino/sheets/ChipsSheet';
import { FinalCalculationSheet } from '../components/Casino/sheets/FinalCalculationSheet';
import { IdentityVerificationsManagement } from '../components/Casino/sheets/IdentityVerificationsManagement';
import { DailyReportSheet } from '../components/Casino/sheets/DailyReportSheet';
import { FinalResultsSheet, defaultFinalResultsRange, type FinalResultsRange } from '../components/Casino/sheets/FinalResultsSheet';
import { CHIP_VALUES, CasinoView, ChipLine, PlayerLine, RackCheck, casinoBorder, casinoCurrency, createPlayerLine, parseCasinoAmount } from '../components/Casino/sheets/types';
import { casinoPlayersApi, CasinoRegisteredPlayer, playerSheetApi, identityVerificationApi, tablesJeuApi } from '../services/casinoTablesJeu.service';
import type { TableJeu } from '../types/casinoTablesJeu.types';
import AuthService from '../services/authService';
import { isAdmin } from '../utils/permissions';
import { useHDA } from '../context/HDAContext';

const getCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const createInitialPlayers = (): PlayerLine[] => [];
const DEFAULT_TABLE_NUMBERS = Array.from({ length: 10 }, (_, index) => String(index + 1));
const createInitialRackChecks = (): RackCheck[] => [{ id: Date.now(), date: new Date().toISOString().slice(0, 10), time: getCurrentTime(), type: 'Cash check', expected: 0, actual: '', missing: '', verified: false, variance: '' }];
const LAST_CASINO_TABLE_KEY = 'hda-casino-last-table';

const setFirstPlayerTimeIfMissing = (players: PlayerLine[]) => {
  if (!players.length) return players;
  const firstPlayer = players[0];
  if (firstPlayer.time.trim() && firstPlayer.departure.trim()) return players;
  const currentTime = getCurrentTime();
  return players.map((player, index) => index === 0 ? {
    ...player,
    time: player.time.trim() || currentTime,
    departure: player.departure.trim() || currentTime,
  } : player);
};

export const CasinoPage: React.FC = () => {
  const { addNotification } = useHDA();
  const currentUser = AuthService.getCurrentUser();
  const userRole = currentUser?.role?.toLowerCase() || '';
  const userIsAdmin = isAdmin(currentUser);
  const canManageCasino = userIsAdmin || ['croupier', 'manager', 'caisse', 'caissier'].includes(userRole);
  // Vérification des résultats finaux : mêmes rôles que l'API (pas les croupiers).
  const canViewFinalResults = userIsAdmin || ['manager', 'caisse', 'caissier'].includes(userRole);
  const [finalResultsRange, setFinalResultsRange] = useState<FinalResultsRange>(defaultFinalResultsRange);
  const [sheetSaveCount, setSheetSaveCount] = useState(0);
  const [view, setView] = useState<CasinoView>('table');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [table, setTable] = useState(() => window.localStorage.getItem(LAST_CASINO_TABLE_KEY) || '');
  const [gameTables, setGameTables] = useState<TableJeu[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerLine[]>(createInitialPlayers);
  const playersRef = useRef<PlayerLine[]>(players);
  // Dernière version enregistrée des fiches joueurs : le calcul final ne
  // reflète les modifications qu'après l'enregistrement de la fiche joueur.
  const [savedPlayers, setSavedPlayers] = useState<PlayerLine[]>(players);
  const resultPaymentOverridesRef = useRef<Record<string, string>>({});
  const [restaurantPayments, setRestaurantPayments] = useState({ especes: false, tpe: false });
  const [cashingPaymentMethod, setCashingPaymentMethod] = useState('');
  const [endGameTime, setEndGameTime] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [chips, setChips] = useState<ChipLine[]>(() => CHIP_VALUES.map((value) => ({ value, previous: '', opening: '', closing: '', withdrawn: '' })));
  const [rackChecks, setRackChecks] = useState<RackCheck[]>(createInitialRackChecks);
  const rackChecksRef = useRef<RackCheck[]>(rackChecks);
  const [finalsByPlayer, setFinalsByPlayer] = useState<Record<string, Record<string, string>>>({});
  const finalsByPlayerRef = useRef<Record<string, Record<string, string>>>({});
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [gameFinishedAt, setGameFinishedAt] = useState('');
  const [isFinishingGame, setIsFinishingGame] = useState(false);
  const [selectedFinalPlayerId, setSelectedFinalPlayerId] = useState(players[0]?.ficheId ?? players[0]?.id ?? 0);
  const [showIdentityVerifications, setShowIdentityVerifications] = useState(true);
  const [identityVerifications, setIdentityVerifications] = useState<Record<number, { id?: number; full_name: string; id_type: string; id_number: string; issue_date: string; transaction_type: string; amount: number; verified_at: string }>>({});
  const [registeredPlayers, setRegisteredPlayers] = useState<CasinoRegisteredPlayer[]>([]);
  const [calculationRevision, setCalculationRevision] = useState(0);
  const sheetLoadKeyRef = useRef('');
  const sheetLoadedRef = useRef(false);
  const lastHourlyReportAlertRef = useRef('');

  useEffect(() => {
    if (!table) return undefined;

    const checkHourlyReportReminder = () => {
      const now = new Date();
      if (now.getMinutes() !== 0) return;
      const alertKey = `${date}|${table}|${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
      if (lastHourlyReportAlertRef.current === alertKey) return;
      lastHourlyReportAlertRef.current = alertKey;
      addNotification(
        'warning',
        `Rappel horaire : envoyez le rapport de la table ${table} pour la fiche du ${date}.`,
        'Casino',
        '/casino?view=report',
      );
    };

    checkHourlyReportReminder();
    const interval = window.setInterval(checkHourlyReportReminder, 30 * 1000);
    return () => window.clearInterval(interval);
  }, [addNotification, date, table]);

  useEffect(() => {
    let active = true;
    tablesJeuApi.list().then((rows) => {
      if (!active) return;
      const allTables = [...rows].sort((first, second) =>
        first.numero.localeCompare(second.numero, undefined, { numeric: true, sensitivity: 'base' })
      );
      setGameTables(allTables);
    }).catch(() => {
      if (active) setTablesError('Impossible de charger les tables de jeu.');
    }).finally(() => {
      if (active) setTablesLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (table) window.localStorage.setItem(LAST_CASINO_TABLE_KEY, table);
  }, [table]);

  const changeGameDate = (value: string) => {
    if (value === date) return;
    sheetLoadedRef.current = false;
    setSaveState('idle');
    const initialPlayers = createInitialPlayers();
    setPlayers(initialPlayers);
    setSavedPlayers(initialPlayers);
    setSelectedFinalPlayerId(0);
    setChips(CHIP_VALUES.map((chipValue) => ({ value: chipValue, previous: '', opening: '', closing: '', withdrawn: '' })));
    setRackChecks(createInitialRackChecks());
    setRestaurantPayments({ especes: false, tpe: false });
    setCashingPaymentMethod('');
    setEndGameTime('');
    setFinalsByPlayer({});
    setIsGameFinished(false);
    setGameFinishedAt('');
    setIdentityVerifications({});
    setDate(value);
  };

  const openingTotal = useMemo(() => chips.reduce((total, line) => total + line.value * (Number(line.opening) || 0), 0), [chips]);
  const closingTotal = useMemo(() => chips.reduce((total, line) => total + line.value * (Number(line.closing) || 0), 0), [chips]);
  const withdrawnTotal = useMemo(() => chips.reduce((total, line) => total + line.value * parseCasinoAmount(line.withdrawn), 0), [chips]);

  const parsePaymentEntries = (value?: string): Array<{ option: string; amount: number }> => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((entry) => {
        if (typeof entry === 'string') return [{ option: entry, amount: 0 }];
        if (entry && typeof entry.option === 'string') return [{ option: entry.option, amount: Number(entry.amount) || 0 }];
        return [];
      });
    } catch {
      return [];
    }
  };

  const getPlayerPaymentTotal = (player: PlayerLine, option: string): number => {
    const payments = parsePaymentEntries(player.resultPaymentOptions).filter((entry) => entry.option === option);
    return payments.reduce((total, entry) => total + (entry.amount || 0), 0);
  };

  const playerResults = useMemo(() => players
    .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
    .map((player) => {
      const playerId = player.ficheId ?? player.id;
      const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
      const cavesTotal = playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
      const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
      const result = cashing - cavesTotal;
      return {
        name: player.name || `Joueur ${playerId}`,
        result,
        paymentEntries: parsePaymentEntries(player.resultPaymentOptions),
        depositTotal: getPlayerPaymentTotal(player, 'Dépôt'),
        creditTotal: getPlayerPaymentTotal(player, 'Crédit'),
      };
    }), [players]);

  const depositResults = useMemo(() => players
    .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
    .flatMap((player) => {
      const playerId = player.ficheId ?? player.id;
      const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
      const result = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing) - playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
      const total = getPlayerPaymentTotal(player, 'Dépôt');
      return result > 0 && total > 0 ? [`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(total)}`] : [];
    })
    .join(' - '), [players]);

  const creditResults = useMemo(() => players
    .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
    .flatMap((player) => {
      const playerId = player.ficheId ?? player.id;
      const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
      const result = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing) - playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
      const total = getPlayerPaymentTotal(player, 'Crédit');
      return result < 0 && total > 0 ? [`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(total)}`] : [];
    })
    .join(' - '), [players]);

  useEffect(() => {
    let active = true;
    const sheetKey = `${date}|${table}`;
    sheetLoadKeyRef.current = sheetKey;
    sheetLoadedRef.current = false;
    if (!table) {
      setSaveState('idle');
      sheetLoadedRef.current = true;
      return () => { active = false; };
    }
    setSaveState('idle');
    setIsGameFinished(false);
    setGameFinishedAt('');
    playerSheetApi.get(date, table).then((sheet) => {
      if (!active) return;
      if (sheet) {
        const loadedPlayers = setFirstPlayerTimeIfMissing(sheet.players);
        setPlayers(loadedPlayers);
        setSavedPlayers(loadedPlayers);
        if (loadedPlayers.some((player) => Boolean(player.casinoPlayerId || player.name.trim()))) {
          setView('players');
        }
        setChips(sheet.chips || CHIP_VALUES.map((value) => ({ value, previous: '', opening: '', closing: '', withdrawn: '' })));
        setRackChecks(sheet.rackChecks?.length ? sheet.rackChecks : createInitialRackChecks());
        setRestaurantPayments(sheet.restaurantPayments || { especes: false, tpe: false });
        setCashingPaymentMethod(sheet.cashingPaymentMethod || '');
        setEndGameTime(sheet.endGameTime || '');
        const loadedFinals = sheet.finals || {};
        // Compatibilité avec les signatures précédemment enregistrées dans une fiche joueur.
        const previousSignature = Object.values(loadedFinals).find((entry) => entry?.signature)?.signature;
        const normalizedFinals = previousSignature && !loadedFinals._global
          ? { ...loadedFinals, _global: { signature: previousSignature } }
          : loadedFinals;
        finalsByPlayerRef.current = normalizedFinals;
        setFinalsByPlayer(normalizedFinals);
        const firstLoadedPlayer = loadedPlayers.find((player) => player.ficheId ?? player.id);
        if (firstLoadedPlayer) setSelectedFinalPlayerId(firstLoadedPlayer.ficheId ?? firstLoadedPlayer.id);
        setIsGameFinished(Boolean(sheet.isFinished));
        setGameFinishedAt(sheet.finishedAt || '');
      } else {
        const initialPlayers = createInitialPlayers();
        setPlayers(initialPlayers);
        setSavedPlayers(initialPlayers);
        setChips(CHIP_VALUES.map((value) => ({ value, previous: '', opening: '', closing: '', withdrawn: '' })));
        setRackChecks(createInitialRackChecks());
        setRestaurantPayments({ especes: false, tpe: false });
        setCashingPaymentMethod('');
        setEndGameTime('');
        finalsByPlayerRef.current = {};
        setFinalsByPlayer({});
        setIsGameFinished(false);
        setGameFinishedAt('');
      }
      sheetLoadedRef.current = true;
    }).catch(() => {
      if (active) setSaveState('error');
    });
    return () => {
      active = false;
    };
  }, [date, table]);

  useEffect(() => {
    let active = true;
    casinoPlayersApi.list().then((rows) => {
      if (active) setRegisteredPlayers(Array.isArray(rows) ? rows : []);
    }).catch(() => {
      if (active) setRegisteredPlayers([]);
    });
    return () => { active = false; };
  }, []);

  const registerCasinoPlayer = async (player: { nom: string; prenom: string; surnom: string; whatsapp: string; whatsapp_fiche_consent: boolean; whatsapp_fiche_consent_signature: string; telephone: string; identite_type: string; identite_numero: string; identite_nom_complet: string; identite_date_emission: string; identite_verifiee: boolean; identite_fichiers_urls: string; date_inscription: string; depot: string; credit: string; mode_jeu: 'EN_ATTENTE' | 'EN_JEU' }) => {
    if (!canManageCasino) return;
    const created = await casinoPlayersApi.create({ ...player, depot: parseCasinoAmount(player.depot), credit: parseCasinoAmount(player.credit), statut: 'ACTIF' });
    setRegisteredPlayers((current) => [...current, created]);
  };

  const updateRegisteredCasinoPlayer = async (id: number, player: Partial<CasinoRegisteredPlayer>) => {
    if (!userIsAdmin) return;

    const normalizedPlayer = {
      ...player,
      depot: parseCasinoAmount(player.depot),
      credit: parseCasinoAmount(player.credit),
    };

    const updated = await casinoPlayersApi.update(id, normalizedPlayer);
    const nextDeposit = updated.depot == null ? '' : String(updated.depot);
    const nextCredit = updated.credit == null ? '' : String(updated.credit);
    const nextName = [updated.nom, updated.prenom].filter(Boolean).join(' ');

    setRegisteredPlayers((current) => current.map((registeredPlayer) => registeredPlayer.id === id ? updated : registeredPlayer));
    const nextPlayers = playersRef.current.map((line) =>
      line.casinoPlayerId === id
        ? { ...line, name: nextName, surnom: updated.surnom || '', whatsapp: updated.whatsapp || '', initialDeposit: nextDeposit, initialCredit: nextCredit }
        : line
    );
    setPlayers(nextPlayers);
    await savePlayerSheet(nextPlayers);
  };

  const deleteRegisteredCasinoPlayer = async (player: CasinoRegisteredPlayer) => {
    if (!userIsAdmin) return;
    await casinoPlayersApi.remove(player.id);
    const nextPlayers = players.filter((line) => line.casinoPlayerId !== player.id);
    setRegisteredPlayers((current) => current.filter((registeredPlayer) => registeredPlayer.id !== player.id));
    if (nextPlayers.length !== players.length) {
      setPlayers(nextPlayers);
      await savePlayerSheet(nextPlayers);
    }
  };

  const addRegisteredPlayerToGame = async (player: CasinoRegisteredPlayer, deposit = String(player.depot || ''), credit = String(player.credit || '')) => {
    if (!canManageCasino) return;
    const initialDeposit = parseCasinoAmount(deposit) || parseCasinoAmount(player.depot);
    const initialCredit = parseCasinoAmount(credit) || parseCasinoAmount(player.credit);
    const game = await casinoPlayersApi.play(player.id, { game_date: date, table_name: table, depot: initialDeposit, credit: initialCredit });
    const ficheId = Math.max(0, ...players.map((line) => line.ficheId ?? line.id)) + 1;
    const lineId = Math.max(0, ...players.map((line) => line.id)) + 1;
    const name = [player.nom, player.prenom].filter(Boolean).join(' ');
    const nextPlayers = [...players, { ...createPlayerLine(lineId, ficheId), casinoPlayerId: player.id, casinoPlayerGameId: game.id, time: getCurrentTime(), name, surnom: player.surnom || '', whatsapp: player.whatsapp || '', initialDeposit: String(initialDeposit), initialCredit: String(initialCredit) }];
    setPlayers(nextPlayers);
    await savePlayerSheet(nextPlayers);
  };

  const updatePlayerLine = (id: number, key: keyof PlayerLine, value: string) => {
    setSaveState('idle');
    const shouldRecalculateResultPayments = key === 'caves' || key === 'amount' || key === 'cashing';
    if (shouldRecalculateResultPayments || key === 'payment' || key === 'paymentMethod') {
      setCalculationRevision((revision) => revision + 1);
    }
    const sourceLine = playersRef.current.find((line) => line.id === id);
    const casinoPlayerId = sourceLine?.casinoPlayerId;
    const ficheId = sourceLine?.ficheId ?? sourceLine?.id;
    const isDeposit = key === 'initialDeposit';
    const isCredit = key === 'initialCredit';
    const resetResultPaymentAmounts = (paymentOptions: string) => {
      try {
        const parsed = JSON.parse(paymentOptions || '[]');
        if (!Array.isArray(parsed)) return paymentOptions;
        return JSON.stringify(parsed.map((payment) => (
          payment && typeof payment === 'object' && typeof payment.option === 'string'
            ? { ...payment, amount: 0 }
            : payment
        )));
      } catch {
        return paymentOptions;
      }
    };
    if (key === 'resultPaymentOptions' && value.startsWith('__restore_remove__:')) {
      const restoredPayment = value.slice('__restore_remove__:'.length);
      const nextPlayers = playersRef.current
        .filter((line) => line.id !== id)
        .map((line) => (line.ficheId ?? line.id) === ficheId ? { ...line, resultPaymentOptions: restoredPayment } : line);
      resultPaymentOverridesRef.current[String(ficheId)] = restoredPayment;
      playersRef.current = nextPlayers;
      setPlayers(nextPlayers);
      void savePlayerSheet(nextPlayers);
      return;
    }
    if (key === 'resultPaymentOptions') {
      resultPaymentOverridesRef.current[String(ficheId)] = value;
    }
    const nextPlayers = playersRef.current.map((line) => {
      const sameFiche = (line.ficheId ?? line.id) === ficheId;
      if ((isDeposit || isCredit) && sameFiche) {
        return {
          ...line,
          [key]: value,
          ...(shouldRecalculateResultPayments ? { resultPaymentOptions: resetResultPaymentAmounts(line.resultPaymentOptions) } : {}),
        };
      }
      return key === 'resultPaymentOptions' && sameFiche
        ? { ...line, [key]: value }
        : line.id === id
          ? { ...line, [key]: value, ...(shouldRecalculateResultPayments ? { resultPaymentOptions: resetResultPaymentAmounts(line.resultPaymentOptions) } : {}) }
          : shouldRecalculateResultPayments && sameFiche
            ? { ...line, resultPaymentOptions: resetResultPaymentAmounts(line.resultPaymentOptions) }
            : line;
    });
    playersRef.current = nextPlayers;
    setPlayers(nextPlayers);
    if (!casinoPlayerId || (!isDeposit && !isCredit)) return;
    setRegisteredPlayers((current) => current.map((player) => player.id === casinoPlayerId
      ? {
        ...player,
        ...(isDeposit ? { depot: parseCasinoAmount(value) } : {}),
        ...(isCredit ? { credit: parseCasinoAmount(value) } : {}),
      }
      : player
    ));
  };

  useEffect(() => {
    let active = true;
    if (!table) return () => { active = false; };
    identityVerificationApi.list({ date_from: date, date_to: date }).then((rows) => {
      if (!active) return;
      const map: Record<number, { id?: number; full_name: string; id_type: string; id_number: string; issue_date: string; transaction_type: string; amount: number; verified_at: string }> = {};
      for (const row of rows) {
        map[row.fiche_id] = {
          id: row.id,
          full_name: row.full_name,
          id_type: row.id_type,
          id_number: row.id_number,
          issue_date: row.issue_date,
          transaction_type: row.transaction_type,
          amount: Number(row.amount),
          verified_at: row.verified_at,
        };
      }
      setIdentityVerifications(map);
    }).catch(() => { });
    return () => { active = false; };
  }, [date, table]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    finalsByPlayerRef.current = finalsByPlayer;
  }, [finalsByPlayer]);

  useEffect(() => {
    rackChecksRef.current = rackChecks;
  }, [rackChecks]);

  const savePlayerSheet = async (playersToSave?: PlayerLine[] | unknown, finalValues?: Record<string, string>): Promise<boolean> => {
    const sheetKey = `${date}|${table}`;
    if (!sheetLoadedRef.current || sheetLoadKeyRef.current !== sheetKey) return false;
    setSaveState('saving');
    try {
      const playersList = Array.isArray(playersToSave) ? playersToSave : playersRef.current;
      const accumulatedTotals: Record<string, number> = {};
      const playersWithAccumulatedCaves = playersList.map((player) => {
        const ficheId = String(player.ficheId ?? player.id);
        const lineTotal = parseCasinoAmount(player.caves) * parseCasinoAmount(player.amount);
        accumulatedTotals[ficheId] = (accumulatedTotals[ficheId] || 0) + lineTotal;
        const resultPaymentOptions = resultPaymentOverridesRef.current[ficheId] ?? player.resultPaymentOptions;
        return { ...player, resultPaymentOptions, total: String(lineTotal), accumulated: String(accumulatedTotals[ficheId]) };
      });
      const currentFinals = finalsByPlayerRef.current;
      // Le dernier résultat final enregistré est aussi copié dans `_global` : c'est
      // la valeur de la fiche (date + table) reprise par le rapport financier.
      const finalsToSave = finalValues
        ? {
            ...currentFinals,
            [String(selectedFinalPlayerId)]: {
              ...(currentFinals[String(selectedFinalPlayerId)] || {}),
              ...finalValues,
            },
            _global: {
              ...(currentFinals._global || {}),
              ...(finalValues.resultatFinalValue !== undefined
                ? { resultatFinal: finalValues.resultatFinal, resultatFinalValue: finalValues.resultatFinalValue }
                : {}),
            },
          }
        : currentFinals;
      const saved = await playerSheetApi.save({ date, table_name: table, players: playersWithAccumulatedCaves, chips, rackChecks: rackChecksRef.current, restaurantPayments, finals: finalsToSave, endGameTime, cashingPaymentMethod, isFinished: isGameFinished, finishedAt: gameFinishedAt });
      finalsByPlayerRef.current = finalsToSave;
      resultPaymentOverridesRef.current = {};
      setSavedPlayers(playersWithAccumulatedCaves);
      setRegisteredPlayers((current) => current.map((registeredPlayer) => {
        const savedPlayer = playersWithAccumulatedCaves.find((player) => player.casinoPlayerId === registeredPlayer.id);
        return savedPlayer
          ? { ...registeredPlayer, depot: parseCasinoAmount(savedPlayer.initialDeposit), credit: parseCasinoAmount(savedPlayer.initialCredit) }
          : registeredPlayer;
      }));
      setSaveState('saved');
      setSheetSaveCount((count) => count + 1);
      // Les vérifications d'identité sont liées à la fiche, mais leur échec
      // ne doit pas bloquer l'enregistrement principal de la fiche.
      const sheetId = saved.id;
      if (sheetId) {
        const verificationsToSave = Object.entries(identityVerifications)
          .filter(([, v]) => v && (v.full_name || v.id_number))
          .map(([ficheId, v]) => ({
            id: v.id,
            player_sheet_id: sheetId,
            fiche_id: Number(ficheId),
            full_name: v.full_name,
            id_type: v.id_type,
            id_number: v.id_number,
            issue_date: v.issue_date,
            transaction_type: v.transaction_type,
            amount: v.amount,
          }));
        for (const v of verificationsToSave) {
          try {
            if (v.id) {
              await identityVerificationApi.update(v.id, { full_name: v.full_name, id_type: v.id_type, id_number: v.id_number, issue_date: v.issue_date, transaction_type: v.transaction_type as 'ACHAT' | 'APPORT' | 'ECHANGE', amount: v.amount });
            } else {
              await identityVerificationApi.create({ player_sheet_id: v.player_sheet_id, fiche_id: v.fiche_id, full_name: v.full_name, id_type: v.id_type, id_number: v.id_number, issue_date: v.issue_date, transaction_type: v.transaction_type as 'ACHAT' | 'APPORT' | 'ECHANGE', amount: v.amount });
            }
          } catch (verificationError) {
            console.error('Erreur lors de la sauvegarde de la vérification d\'identité :', verificationError);
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la fiche :', error);
      setSaveState('error');
      return false;
    }
  };

  const saveFinalCalculation = (finalValues?: Record<string, string>) => {
    void savePlayerSheet(undefined, finalValues);
  };

  const updateFinalCalculationValue = (key: string, value: string) => {
    setSaveState('idle');
    const playerKey = String(selectedFinalPlayerId);
    const currentFinals = finalsByPlayerRef.current;
    const nextValues = {
      ...(currentFinals[playerKey] || {}),
      [key]: value,
    };
    const nextFinals = key === 'signature'
      ? { ...currentFinals, _global: { ...(currentFinals._global || {}), signature: value } }
      : { ...currentFinals, [playerKey]: nextValues };
    finalsByPlayerRef.current = nextFinals;
    setFinalsByPlayer(nextFinals);
  };

  const finishGame = async () => {
    if (!canManageCasino || isGameFinished || isFinishingGame) return;
    if (!window.confirm('Terminer ce jeu ? Les joueurs passeront hors jeu, mais toutes les fiches et le calcul final resteront enregistrés.')) return;
    setIsFinishingGame(true);
    const saved = await savePlayerSheet();
    if (!saved) {
      setIsFinishingGame(false);
      return;
    }
    try {
      const result = await playerSheetApi.finish(date, table);
      setIsGameFinished(true);
      setGameFinishedAt(result.finishedAt);
      setRegisteredPlayers((current) => current.map((player) => result.playerIds.includes(player.id) ? { ...player, statut_jeu: 'ARRETE' } : player));
    } catch {
      setSaveState('error');
    } finally {
      setIsFinishingGame(false);
    }
  };

  const removePlayerLines = (lineIds: number[]) => {
    if (!userIsAdmin) return;
    const previousPlayers = playersRef.current;
    const nextPlayers = previousPlayers.filter((line) => !lineIds.includes(line.id));
    playersRef.current = nextPlayers;
    setPlayers(nextPlayers);
    void savePlayerSheet(nextPlayers).then((saved) => {
      if (!saved) {
        playersRef.current = previousPlayers;
        setPlayers(previousPlayers);
      }
    });
  };

  const tableOptions = Array.from(new Set([
    ...DEFAULT_TABLE_NUMBERS,
    ...gameTables.map((gameTable) => gameTable.numero),
  ]));
  const hasSelectedTable = Boolean(table);
  const navigation: { id: CasinoView; label: string; help: string; icon: React.ReactNode }[] = [
    { id: 'table', label: '1. Choix de table', help: 'Sélectionner la table à jouer', icon: <ClipboardList size={18} /> },
    { id: 'setup', label: '2. Joueurs', help: 'Informations de début de jeu', icon: <ClipboardList size={18} /> },
    { id: 'players', label: '3. Fiche de jeu', help: 'Caves, paiements et signatures', icon: <ClipboardList size={18} /> },
    { id: 'chips', label: '4. Comptage jetons', help: 'Ouverture / fermeture', icon: <Coins size={18} /> },
    { id: 'final', label: '5. Calcul final', help: 'Clôture de caisse', icon: <Calculator size={18} /> },
    { id: 'management', label: '6. Vérifications', help: 'Gérer les identités', icon: <Shield size={18} /> },
    { id: 'report', label: '7. Rapport', help: 'Générer le rapport de la table', icon: <FileText size={18} /> },
    ...(canViewFinalResults
      ? [{ id: 'results' as CasinoView, label: '8. Résultats finaux', help: 'Vérifier les montants du rapport financier', icon: <WalletCards size={18} /> }]
      : []),
  ];
  // Sections consultables sans table sélectionnée.
  const viewsWithoutTable: CasinoView[] = ['table', 'results'];

  return <div className="flex flex-col gap-5 w-full">
    <header className="rounded-3xl p-5 md:p-7 print:hidden" style={{ background: 'linear-gradient(120deg, var(--color-surface) 0%, #201a10 100%)', ...casinoBorder }}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5"><div><p className="text-accent text-xs font-bold uppercase tracking-[.18em]">Poker Night</p><h1 className="text-primary text-3xl font-bold mt-2" style={{ fontFamily: 'Playfair Display, serif' }}>Gestion casino</h1><p className="text-muted text-sm mt-2">Nouvelle interface locale basée sur les trois fiches papier.</p></div><div className="flex gap-2"><button type="button" onClick={() => window.print()} className="action secondary"><Printer size={15} /> Imprimer</button><button type="button" disabled={!hasSelectedTable} onClick={() => setView('report')} className="action disabled:opacity-50 disabled:cursor-not-allowed"><Download size={15} /> Rapport</button></div></div>
    </header>
    <nav className="grid gap-2 md:grid-cols-4 print:hidden">{navigation.map((item) => <button type="button" key={item.id} disabled={!viewsWithoutTable.includes(item.id) && !hasSelectedTable} onClick={() => setView(item.id)} className="casino-nav-button flex gap-3 items-center rounded-2xl p-4 text-left disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: view === item.id ? '#6b7280' : 'var(--color-surface)', color: view === item.id ? '#000' : undefined, ...casinoBorder }}>{item.icon}<span><b className="block text-sm">{item.label}</b><small className="opacity-70">{item.help}</small></span></button>)}</nav>
    <main className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
      <div className="p-4 md:p-5 flex flex-col sm:flex-row gap-3 justify-between print:hidden" style={{ borderBottom: '1px solid var(--color-border)' }}><div className="flex flex-col sm:flex-row gap-3"><label className="field">Table sélectionnée<input value={table || 'Aucune table sélectionnée'} readOnly /></label><label className="field">Date<input type="date" value={date} onChange={(event) => changeGameDate(event.target.value)} /></label></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs font-semibold cursor-pointer"><input type="checkbox" checked={showIdentityVerifications} onChange={(event) => setShowIdentityVerifications(event.target.checked)} /> Vérifications identité</label><p className="text-muted text-xs self-end">Fiche enregistrée dans la base de données.</p></div></div>
      <div className="p-4 md:p-5"><div className="hidden print:block text-center mb-5"><h1>{table}</h1><p>Date : {date}</p></div>
        {view === 'table' && <section className="flex flex-col gap-4"><div><h2 className="text-primary text-xl font-bold">Choix de la table</h2><p className="text-muted text-sm mt-1">Choisissez la table avant de commencer. Chaque table conserve ses propres joueurs et sa propre fiche.</p></div>{tablesError && <p className="text-red-400 text-sm">{tablesError}</p>}{tablesLoading ? <p className="text-muted text-sm">Chargement des tables…</p> : <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">{tableOptions.map((tableNumber) => { const gameTable = gameTables.find((candidate) => candidate.numero === tableNumber); const isSelected = table === tableNumber; return <button key={tableNumber} type="button" aria-pressed={isSelected} onClick={() => { setTable(tableNumber); setView('setup'); }} className="flex min-h-24 flex-col items-center justify-center rounded-xl px-4 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)]" style={{ backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-bg)', color: isSelected ? '#000' : undefined, border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)', boxShadow: isSelected ? 'var(--shadow-accent)' : 'none' }}><span className="text-base font-bold">Table {tableNumber}</span>{gameTable ? <><span className="mt-1 text-[11px] opacity-75">{gameTable.type_jeu} · {gameTable.nombre_places} places</span><span className="mt-1 text-[11px] font-semibold">{gameTable.statut === 'OUVERTE' ? 'Ouverte' : gameTable.statut === 'FERMEE' ? 'Fermée' : 'Archivée'}</span></> : <span className="mt-1 text-[11px] opacity-75">Disponible</span>}</button>; })}</div>}</section>}
        {view === 'setup' && <PlayerSetupSheet players={players} isAdmin={userIsAdmin} canManageGame={canManageCasino} saveState={saveState} registeredPlayers={registeredPlayers} onRegister={registerCasinoPlayer} onUpdateRegisteredPlayer={updateRegisteredCasinoPlayer} onDeleteRegisteredPlayer={deleteRegisteredCasinoPlayer} onPlay={addRegisteredPlayerToGame} onUpdate={updatePlayerLine} onAdd={() => { const firstId = Math.max(0, ...players.map((line) => line.id)) + 1; setPlayers((lines) => [...lines, createPlayerLine(firstId)]); }} onRemove={(ficheId) => removePlayerLines(players.filter((line) => (line.ficheId ?? line.id) === ficheId).map((line) => line.id))} onSave={savePlayerSheet} />}
        {view === 'players' && <PlayersSheet date={date} players={players} registeredPlayers={registeredPlayers} cashingPaymentMethod={cashingPaymentMethod} restaurantPayments={restaurantPayments} saveState={saveState} isAdmin={canManageCasino} canDeletePlayerLine={userIsAdmin} onDateChange={changeGameDate} onUpdate={updatePlayerLine} onPaymentChange={(payment, checked) => { setSaveState('idle'); setRestaurantPayments((current) => ({ ...current, [payment]: checked })); }} onCashingPaymentMethodChange={(value) => { setSaveState('idle'); setCashingPaymentMethod(value); }} onSave={savePlayerSheet} onAdd={(ficheId, name = '') => { const firstId = Math.max(0, ...players.map((line) => line.id)) + 1; const newFicheId = ficheId ?? firstId; const newLines = ficheId ? [createPlayerLine(firstId, newFicheId)] : Array.from({ length: 5 }, (_, index) => createPlayerLine(firstId + index, newFicheId)); setPlayers((lines) => [...lines, ...newLines.map((line) => name ? { ...line, name } : line)]); return newFicheId; }} onDuplicate={(source) => { if (!canManageCasino) return; setSaveState('idle'); setPlayers((lines) => { const lineId = Math.max(0, ...lines.map((line) => line.id)) + 1; return [...lines, { ...createPlayerLine(lineId, source.ficheId ?? source.id), name: source.name, time: source.time, caves: source.caves, amount: source.amount, payment: source.payment, paymentMethod: source.paymentMethod }]; }); }} onGoToRegisteredPlayers={() => setView('setup')} onRemove={(id) => { if (!userIsAdmin) return; const previousPlayers = players; const nextPlayers = players.filter((line) => line.id !== id); setPlayers(nextPlayers); void savePlayerSheet(nextPlayers).then((saved) => { if (!saved) setPlayers(previousPlayers); }); }} showIdentityVerifications={showIdentityVerifications} identityVerifications={identityVerifications} onIdentityVerified={(ficheId, data, verificationId) => { setIdentityVerifications((current) => ({ ...current, [ficheId]: { id: verificationId ?? current[ficheId]?.id, full_name: data.fullName, id_type: data.idType, id_number: data.idNumber, issue_date: data.issueDate, transaction_type: data.transactionType.toUpperCase(), amount: data.amount, verified_at: data.verifiedAt } })); }} />}
        {view === 'chips' && <ChipsSheet date={date} chips={chips} players={players} rackChecks={rackChecks} endGameTime={endGameTime} openingTotal={openingTotal} closingTotal={closingTotal} saveState={saveState} onUpdate={(value, key, content) => { setSaveState('idle'); setChips((lines) => lines.map((line) => line.value === value ? { ...line, [key]: content } : line)); }} onRackChecksChange={(checks) => { setSaveState('idle'); rackChecksRef.current = checks; setRackChecks(checks); }} onEndGameTimeChange={(value) => { setSaveState('idle'); setEndGameTime(value); }} onSave={savePlayerSheet} />}
        {view === 'final' && <FinalCalculationSheet players={players} selectedPlayerId={selectedFinalPlayerId} calculationRevision={calculationRevision} values={{ ...(finalsByPlayer[String(selectedFinalPlayerId)] || {}), signature: finalsByPlayer._global?.signature || finalsByPlayer[String(selectedFinalPlayerId)]?.signature || '' }} withdrawnTotal={withdrawnTotal} depositResults={depositResults} creditResults={creditResults} saveState={saveState} onPlayerChange={setSelectedFinalPlayerId} onUpdate={updateFinalCalculationValue} onSave={saveFinalCalculation} showIdentityVerifications={showIdentityVerifications} identityVerifications={identityVerifications} />} 
        {view === 'management' && <IdentityVerificationsManagement verifications={Object.entries(identityVerifications).map(([ficheId, v]) => ({ ...v, fiche_id: Number(ficheId) }))} onUpdate={(updated) => { const map: Record<number, any> = {}; for (const v of updated) { map[v.fiche_id ?? 0] = v; } setIdentityVerifications(map); }} />}
        {view === 'results' && canViewFinalResults && <FinalResultsSheet range={finalResultsRange} onRangeChange={setFinalResultsRange} refreshTrigger={sheetSaveCount} onOpenSheet={(sheetDate, sheetTable) => { setTable(sheetTable); changeGameDate(sheetDate); setView('final'); }} />}
        {view === 'report' && <DailyReportSheet date={date} table={table} players={players} chips={chips} rackChecks={rackChecks} restaurantPayments={restaurantPayments} finals={finalsByPlayer} registeredPlayers={registeredPlayers} />}
      </div>
    </main>
    <style>{`.action{display:inline-flex;align-items:center;gap:.5rem;border-radius:.75rem;padding:.65rem .9rem;font-size:.75rem;font-weight:600;background:var(--color-accent);color:#000}.action.secondary{background:var(--color-bg);color:var(--text-primary);border:1px solid var(--color-border)}.casino-nav-button{transition:background-color .2s ease,color .2s ease}.casino-nav-button:hover{background-color:#6b7280!important;color:#000!important}.field{font-size:.75rem;color:var(--text-secondary);font-weight:600}.field input{display:block;margin-top:.25rem;padding:.5rem .65rem;border-radius:.7rem;background:var(--color-bg);border:1px solid var(--color-border);color:var(--text-primary);outline:none}@page{size:A4 landscape;margin:8mm}@media print{.print\\:hidden{display:none!important}body{background:#fff!important}.player-sheet-print{background:#fff!important;color:#000!important;width:100%!important;padding:0!important}.player-sheet-print table{min-width:0!important;width:100%!important;font-size:9px!important;table-layout:fixed!important}.player-sheet-print th,.player-sheet-print td,.player-sheet-print label,.player-sheet-print p,.player-sheet-print span{color:#000!important}.player-sheet-print input,.player-sheet-print select{color:#000!important;background:#fff!important}.player-sheet-print input::placeholder{color:#555!important}.player-sheet-print .text-white{color:#000!important}.player-sheet-print .overflow-x-auto{overflow:visible!important}.player-sheet-print th,.player-sheet-print td{padding:5px 4px!important;overflow-wrap:anywhere!important}.player-sheet-print canvas{max-width:100%!important;height:auto!important}}`}</style>
  </div>;
};

const parseResultPaymentOptions = (value?: string): string[] => {
  try {
    const options = JSON.parse(value || '[]');
    return Array.isArray(options) ? options.flatMap((option) => {
      if (typeof option === 'string') return [option];
      return option && typeof option.option === 'string' ? [option.option] : [];
    }) : [];
  } catch {
    return [];
  }
};

export default CasinoPage;
