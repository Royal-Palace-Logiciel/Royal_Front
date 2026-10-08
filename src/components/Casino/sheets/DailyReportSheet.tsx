     import React, { useMemo, useState } from 'react';
import { Clipboard, Download, MessageCircle, Printer } from 'lucide-react';
import { ChipLine, PlayerLine, RackCheck, casinoBorder, casinoCurrency, parseCasinoAmount } from './types';
import type { CasinoRegisteredPlayer } from '../../../services/casinoTablesJeu.service';
import { printThermalText } from '../../../utils/thermalPrint';

// Destinataire du bouton WhatsApp : 0388337122 au format international (Madagascar, +261).
const REPORT_WHATSAPP_NUMBER = '261388337122';

interface DailyReportSheetProps {
  date: string;
  table: string;
  players: PlayerLine[];
  chips: ChipLine[];
  rackChecks: RackCheck[];
  restaurantPayments: { especes: boolean; tpe: boolean };
  finals: Record<string, Record<string, string>>;
  registeredPlayers: CasinoRegisteredPlayer[];
}

const uniquePlayers = (players: PlayerLine[]) => players.filter((player, index, lines) =>
  lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index
);

const playerDisplayName = (player: PlayerLine) => player.surnom?.trim() || player.name.trim() || `Joueur ${player.ficheId ?? player.id}`;

const formatAmount = (value: number) => {
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M Ar`;
  }
  if (absoluteValue >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K Ar`;
  }
  return `${casinoCurrency.format(value)} Ar`;
};

const isSamePlayer = (first: PlayerLine, second: PlayerLine) =>
  (first.ficheId ?? first.id) === (second.ficheId ?? second.id)
  || (first.name.trim() && second.name.trim() && first.name.trim().toLowerCase() === second.name.trim().toLowerCase());

const getPlayerLines = (player: PlayerLine, players: PlayerLine[]) => players.filter((line) => isSamePlayer(line, player));

const playerAmount = (player: PlayerLine, players: PlayerLine[]) => getPlayerLines(player, players)
  .reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);

const playerResult = (player: PlayerLine, players: PlayerLine[]) => {
  const playerLines = getPlayerLines(player, players);
  const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
  return cashing - playerAmount(player, players);
};

const playerHasFinalSignature = (player: PlayerLine, players: PlayerLine[]) => getPlayerLines(player, players)
  .some((line) => String(line.finalSignature ?? '').trim() !== '');

const parsePaymentOptions = (value?: string): Array<{ option: string; amount: number }> => {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (typeof entry === 'string') return [{ option: entry, amount: 0 }];
      return entry && typeof entry.option === 'string'
        ? [{ option: entry.option, amount: Number(entry.amount) || 0 }]
        : [];
    });
  } catch {
    return [];
  }
};

const paymentCategory = (option: string) => {
  const normalized = option.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('depot') && normalized.includes('paye')) return 'Dépôt payé';
  if (normalized.includes('credit') && normalized.includes('paye')) return 'Crédit payé';
  if (normalized.includes('tpe')) return 'TPE';
  if (normalized.includes('orange')) return 'Orange Money';
  if (normalized.includes('mvola')) return 'MVola';
  if (normalized.includes('espece') || normalized.includes('cash')) return 'Espèces';
  if (normalized.includes('credit')) return 'Crédit';
  if (normalized.includes('depot')) return 'Dépôt';
  if (normalized.includes('offert')) return 'Offert';
  if (normalized.includes('cheque')) return 'Chèque';
  if (normalized.includes('virement')) return 'Virement';
  return option;
};

const getPlayerResult = (player: PlayerLine, players: PlayerLine[]) => {
  const playerLines = getPlayerLines(player, players);
  const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
  const totalCaves = playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
  return cashing - totalCaves;
};

const getNegativePaymentTotal = (players: PlayerLine[], ...methods: string[]): number => players
  .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
  .reduce((total, player) => {
    const playerId = player.ficheId ?? player.id;
    const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
    const result = getPlayerResult(player, players);
    const payments = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => methods.includes(payment.option));
    if (result >= 0 || (!payments.length && !methods.includes('Dépôt payé'))) return total;
    const amount = payments.some((payment) => payment.amount > 0)
      ? payments.reduce((sum, payment) => sum + payment.amount, 0)
      : Math.abs(result);
    return total + amount;
  }, 0);

const getPositivePaymentTotal = (players: PlayerLine[], ...methods: string[]): number => players
  .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
  .reduce((total, player) => {
    const result = getPlayerResult(player, players);
    const payments = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => methods.includes(payment.option));
    if (result <= 0 || !payments.length) return total;
    return total + payments.reduce((sum, payment) => sum + (payment.amount || result), 0);
  }, 0);

const getPaidCavePaymentTotal = (players: PlayerLine[], methods?: string[]): number => players.reduce((total, line) => {
  const method = line.paymentMethod.trim();
  const amount = parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount);
  const isPaid = String(line.payment || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().startsWith('pay');
  if (!isPaid || !method || amount <= 0 || (methods && !methods.includes(method))) return total;
  return total + amount;
}, 0);

const readFinalCategoryValue = (finals: Record<string, Record<string, string>>, key: string, fallback: number) => {
  const explicitValue = Object.values(finals)
    .map((values) => parseCasinoAmount(values?.[key]))
    .reduce((sum, amount) => sum + amount, 0);
  return explicitValue > 0 ? explicitValue : fallback;
};

export const buildDailyReport = ({ date, table, players, chips, rackChecks, restaurantPayments, finals, registeredPlayers }: DailyReportSheetProps) => {
  const reportPlayers = uniquePlayers(players).filter((player) => player.surnom?.trim() || player.name.trim() || playerAmount(player, players) > 0);
  const listedPlayers = reportPlayers.filter((player) => !playerHasFinalSignature(player, players));
  const totalCaves = listedPlayers.reduce((total, player) => total + playerAmount(player, players), 0);
  const playersOut = reportPlayers
    .filter((player) => playerHasFinalSignature(player, players) && playerResult(player, players) < 0)
    .map((player) => `${formatAmount(Math.abs(playerResult(player, players)))} (${playerDisplayName(player)})`);
  const withdrawn = chips.reduce((total, chip) => total + chip.value * parseCasinoAmount(chip.withdrawn), 0);
  const cashChecks = rackChecks.filter((check) => check.type === 'Cash check');
  const rackChecksReport = rackChecks.filter((check) => check.type.startsWith('Rack check') || check.type === 'Retour croupier' || check.type === 'Sortie croupier');
  const paymentDetails = new Map<string, string[]>();
  reportPlayers.forEach((player) => {
    const result = playerResult(player, players);
    const payments = getPlayerLines(player, players).flatMap((line) => parsePaymentOptions(line.resultPaymentOptions));
    const uniquePayments = [...new Map(payments.map((payment) => [payment.option, payment])).values()];
    uniquePayments.forEach((payment) => {
      const category = paymentCategory(payment.option);
      const amount = payment.amount > 0 ? payment.amount : Math.abs(result);
      if (!amount) return;
      const signedAmount = result < 0 ? -amount : amount;
      const playerName = playerDisplayName(player);
      const entries = paymentDetails.get(category) || [];
      entries.push(`${playerName} : ${formatAmount(signedAmount)}`);
      paymentDetails.set(category, entries);
    });
  });
  const paymentSection = (category: string) => paymentDetails.has(category)
    ? [`# ${category} :`, ...(paymentDetails.get(category) || [])]
    : [];
  const finalValues = (key: string) => Object.values(finals)
    .map((values) => ({ values, amount: parseCasinoAmount(values?.[key]) }))
    .filter(({ amount }) => amount > 0)
    .map(({ values, amount }) => `${formatAmount(amount)}${values?.name ? ` (${values.name})` : ''}`)
    .join(' - ');
  const finalValue = (key: string) => finalValues(key);
  const finalCategoryValue = (key: string, fallback = '0') => {
    const value = finalValue(key);
    return value || fallback;
  };
  const euroDollarValue = [finalCategoryValue('euro', '0'), finalCategoryValue('dollar', '0')]
    .filter((value) => value !== '0')
    .join(' / ') || '0';
  const observationEntries = Object.entries(finals)
    .filter(([key]) => key !== '_global')
    .map(([, values]) => {
      const text = String(values?.observation ?? '').trim();
      if (!text) return null;
      return text;
    })
    .filter(Boolean) as string[];
  const tpeReportTotal = readFinalCategoryValue(finals, 'tpe', getNegativePaymentTotal(players, 'TPE'));
  const creditReportTotal = readFinalCategoryValue(finals, 'credit', getNegativePaymentTotal(players, 'Crédit'));
  const creditPaidReportTotal = readFinalCategoryValue(finals, 'creditPaye', getPositivePaymentTotal(players, 'Crédit payé'));
  const depotReportTotal = readFinalCategoryValue(finals, 'depot', getPositivePaymentTotal(players, 'Dépôt'));
  const depotPaidReportTotal = readFinalCategoryValue(finals, 'depotPaye', getNegativePaymentTotal(players, 'Dépôt payé'));
  const offeredReportTotal = readFinalCategoryValue(finals, 'offert', getPaidCavePaymentTotal(players, ['Offert']));
  const bonusReportTotal = readFinalCategoryValue(finals, 'bonus', 0);
  const mobileReportTotal = readFinalCategoryValue(finals, 'mobiles', 0);
  const restaurantReportTotal = readFinalCategoryValue(finals, 'restaurant', 0);
  const prolongationReportTotal = readFinalCategoryValue(finals, 'prolongation', 0);
  const pourboiresReportTotal = readFinalCategoryValue(finals, 'pourboires', 0);
  const otherRetraitTotal = readFinalCategoryValue(finals, 'autres', withdrawn);
  const finalCategoryLines = [
    `# Mobile : ${formatAmount(mobileReportTotal)}`,
    `# TPE : ${formatAmount(tpeReportTotal)}`,
    `# Offert : ${formatAmount(offeredReportTotal)}`,
    `# Bonus : ${formatAmount(bonusReportTotal)}`,
    `# Euro / Dollars : ${euroDollarValue}`,
    `# Chèque : ${formatAmount(readFinalCategoryValue(finals, 'cheque', 0))}`,
    `# Crédit : ${formatAmount(creditReportTotal)}`,
    `# Crédit payé : ${formatAmount(creditPaidReportTotal)}`,
    `# Dépôt : ${formatAmount(depotReportTotal)}`,
    `# Dépôt payé : ${formatAmount(depotPaidReportTotal)}`,
    `# Bar et Resto : ${formatAmount(restaurantReportTotal)}`,
    `# Prolongation : ${formatAmount(prolongationReportTotal)}`,
    `# PB : ${formatAmount(pourboiresReportTotal)}`,
    `# Retrait : ${formatAmount(otherRetraitTotal)}`,
    `# Bureau : ${formatAmount(otherRetraitTotal)}`,
    `# Devis : ${formatAmount(readFinalCategoryValue(finals, 'devis', 0))}`,
    `# Espece : ${formatAmount(readFinalCategoryValue(finals, 'especes', totalCaves))}`,
    ''
  ];
  const lines = [
    `Rapport du ${date.split('-').reverse().join('/')}`,
    '',
    `Table : ${table}`,
    '',
    `# Nombre joueurs : ${listedPlayers.length}`,
    ...listedPlayers.map((player) => {
      const amount = playerAmount(player, players);
      const status = player.payment === 'Non payé' || player.paymentMethod.toLowerCase() === 'np' ? ' np' : '';
      return `${playerDisplayName(player)} : ${formatAmount(amount)}${status}`;
    }),
    '',
    '# Sit out :',
    '',
    '# Joueur sortie :',
    ...(playersOut.length ? playersOut : ['']),
    '',
    '# Joueurs en attente :',
    '',
    ...finalCategoryLines,
    '',
    '# Observation :',
    ...(observationEntries.length ? observationEntries : ['Aucune observation.']),
    '',
    '# Cash checks horaires :',
    ...(cashChecks.length ? cashChecks.map((check) => `${check.date || date} ${check.time} — croupier entrant : ${check.croupierEntrant || 'non renseigné'} · croupier sortant : ${check.croupierSortant || 'non renseigné'} · responsable : ${check.validatedBy || 'non renseigné'} · attendu ${formatAmount(check.expected)} · constaté ${check.actual ? formatAmount(parseCasinoAmount(check.actual)) : 'non renseigné'} · écart ${formatAmount(parseCasinoAmount(check.variance))} · ${check.verified ? 'validé' : 'en attente de validation'}`) : ['Aucun cash check enregistré.']),
    '',
    '# Rack checks :',
    ...(rackChecksReport.length ? rackChecksReport.map((check) => `${check.date || date} ${check.time} — ${check.type} · entrant : ${check.croupierEntrant || 'non renseigné'} · sortant : ${check.croupierSortant || 'non renseigné'} · attendu ${formatAmount(check.expected)} · constaté ${check.actual ? formatAmount(parseCasinoAmount(check.actual)) : 'non renseigné'} · manque ${formatAmount(parseCasinoAmount(check.missing))} · ${check.verified ? `validé par ${check.validatedBy || 'le responsable'}` : 'en attente de validation'}`) : ['Aucun rack check enregistré.']),
  ];
  return lines.join('\n');
};

export const DailyReportSheet: React.FC<DailyReportSheetProps> = (props) => {
  const [copied, setCopied] = useState(false);
  const report = useMemo(() => buildDailyReport(props), [props]);

  const copyReport = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapport-casino-${props.date}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Ouvre l'application WhatsApp installée (WhatsApp Desktop, ou l'application sur tablette /
  // téléphone) sur la conversation du 0388337122, rapport déjà saisi : il reste à appuyer sur
  // « Envoyer ». Si l'application ne prend pas la main (la page garde le focus), on bascule
  // sur wa.me, qui propose WhatsApp Web.
  const sendReportOnWhatsApp = () => {
    const text = encodeURIComponent(report);
    let appOpened = false;
    const markOpened = () => { appOpened = true; };
    window.addEventListener('blur', markOpened, { once: true });
    document.addEventListener('visibilitychange', markOpened, { once: true });
    window.location.href = `whatsapp://send?phone=${REPORT_WHATSAPP_NUMBER}&text=${text}`;
    window.setTimeout(() => {
      window.removeEventListener('blur', markOpened);
      document.removeEventListener('visibilitychange', markOpened);
      if (!appOpened) window.open(`https://wa.me/${REPORT_WHATSAPP_NUMBER}?text=${text}`, '_blank', 'noopener');
    }, 1500);
  };

  return <section className="flex flex-col gap-4">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
      <div><h2 className="text-primary text-xl font-bold">Rapport journalier</h2><p className="text-muted text-xs mt-1">Généré automatiquement à partir de la fiche de jeu.</p></div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="action" onClick={sendReportOnWhatsApp} title="Ouvrir WhatsApp avec le rapport pour le 0388337122" style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#fff' }}><MessageCircle size={15} /> WhatsApp</button>
        <button type="button" className="action secondary" onClick={copyReport}><Clipboard size={15} /> {copied ? 'Copié' : 'Copier'}</button>
        <button type="button" className="action secondary" onClick={downloadReport}><Download size={15} /> Télécharger</button>
        <button type="button" className="action" onClick={() => printThermalText('Rapport Casino', report)}><Printer size={15} /> Imprimer</button>
      </div>
    </div>    <textarea readOnly value={report} aria-label="Rapport journalier généré" className="w-full min-h-[680px] rounded-xl p-4 text-sm leading-6 text-primary outline-none resize-y" style={{ backgroundColor: 'var(--color-bg)', ...casinoBorder }} />
  </section>;
};