import React, { useEffect, useRef, useState } from 'react';
import { Copy, Loader2, MessageCircle, Trash2 } from 'lucide-react';
import { PlayerLine, casinoBorder, casinoCurrency, parseCasinoAmount, IDENTITY_VERIFICATION_THRESHOLD, IdentityVerificationData } from './types';
import { IdentityVerificationModal } from './IdentityVerificationModal';
import { identityVerificationApi, playerSheetApi } from '../../../services/casinoTablesJeu.service';
import type { CasinoRegisteredPlayer } from '../../../services/casinoTablesJeu.service';
import { escapeHtml, printThermal, thermalHeader } from '../../../utils/thermalPrint';
import { useToast } from '../../../context/ToastContext';

interface PlayersSheetProps {
  date: string;
  players: PlayerLine[];
  registeredPlayers?: CasinoRegisteredPlayer[];
  cashingPaymentMethod?: string;
  restaurantPayments: { especes: boolean; tpe: boolean };
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  onUpdate: (id: number, key: keyof PlayerLine, value: string) => void;
  onDateChange: (value: string) => void;
  onPaymentChange: (payment: 'especes' | 'tpe', checked: boolean) => void;
  onCashingPaymentMethodChange?: (value: string) => void;
  onSave: () => void;
  onAdd: (ficheId?: number, name?: string) => number;
  onDuplicate: (line: PlayerLine) => void;
  onGoToRegisteredPlayers: () => void;
  onRemove: (id: number) => void;
  onIdentityVerified?: (playerId: number, data: IdentityVerificationData, verificationId?: number) => void;
  showIdentityVerifications?: boolean;
  identityVerifications?: Record<number, { id?: number; full_name: string; id_type: string; id_number: string; issue_date: string; transaction_type: string; amount: number; verified_at: string }>;
  isAdmin?: boolean;
  canDeletePlayerLine?: boolean;
}

const paperInput = 'w-full min-w-0 bg-transparent px-2 py-2 text-xs text-white outline-none placeholder:text-gray-400';
const darkInput = 'w-full min-w-0 bg-transparent px-2 py-2 text-xs text-white outline-none placeholder:text-gray-400';
const formatCompactAmount = (value: number) => {
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (absoluteValue >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }
  return casinoCurrency.format(value);
};
const sheetActionPrimary = 'action inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-xs font-bold shadow-lg shadow-amber-500/10 transition duration-200 hover:-translate-y-0.5 hover:shadow-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50';
const sheetActionSecondary = 'action secondary inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-xs font-bold transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/60 hover:bg-amber-300/10 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50';
const paymentMethods = ['Espèces', 'Orange Money', 'MVola', 'Euro', 'Dollar', 'TPE', 'Chèque', 'Offert', 'Virement', 'Crédit'];

const bonusCategories = ['7 et 2', 'Carré', 'Quinte flush', 'Quinte flush royal', 'Fetish'];
const positiveResultOptions = ['Dépôt', 'Crédit payé', 'Espèce', 'MVola', 'Orange Money'];
const negativeResultOptions = ['Dépôt payé', 'Crédit', 'Offert', 'TPE', 'MVola', 'Orange Money', 'Espèce'];
const ROULETTE_PRIZES = [10000, 5000, 100000, 20000, 10000, 0, 50000, 10000, 10000, 20000, 100000, 10000, 5000, 50000, 20000, 5000, 40000, 5000, 50000, 5000, 0, 100000, 10000, 20000];

const parseBonuses = (value?: string): string[] => {
  try {
    const bonuses = JSON.parse(value || '[]');
    return Array.isArray(bonuses) ? bonuses.filter((bonus): bonus is string => typeof bonus === 'string') : [];
  } catch {
    return [];
  }
};

const parseIdentityVerification = (value?: string) => {
  try {
    const data = JSON.parse(value || 'null');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

const parseBonusResults = (value?: string): Record<string, number> => {
  try {
    const results = JSON.parse(value || '{}');
    return results && typeof results === 'object' && !Array.isArray(results)
      ? Object.entries(results).reduce<Record<string, number>>((amounts, [bonus, amount]) => {
        if (typeof amount === 'number') amounts[bonus] = amount;
        return amounts;
      }, {})
      : {};
  } catch {
    return {};
  }
};

type ResultPayment = { option: string; amount: number };

const parseResultPayments = (value?: string): ResultPayment[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    const payments = parsed.flatMap((entry) => {
      if (typeof entry === 'string') return [{ option: entry, amount: 0 }];
      if (entry && typeof entry.option === 'string') return [{ option: entry.option, amount: Number(entry.amount) || 0 }];
      return [];
    });
    return [...new Map(payments.map((payment) => [payment.option, payment])).values()];
  } catch {
    return [];
  }
};

export const PlayersSheet: React.FC<PlayersSheetProps> = ({ date, players, registeredPlayers = [], restaurantPayments, saveState = 'idle', onUpdate, onDateChange, onPaymentChange, onSave, onAdd, onDuplicate, onGoToRegisteredPlayers, onRemove, onIdentityVerified, showIdentityVerifications = true, identityVerifications = {}, isAdmin = false, canDeletePlayerLine = isAdmin }) => {
  const { showToast } = useToast();
  const activePlayers = players.filter((player, index, lines) => Boolean(player.casinoPlayerId) && lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index);
  const [selectedPlayerId, setSelectedPlayerId] = useState(() => activePlayers[0] ? (activePlayers[0].ficheId ?? activePlayers[0].id) : 0);
  const resultPaymentBackups = useRef<Record<number, string>>({});
  const resultBalanceBases = useRef<Record<number, { deposit: number; credit: number }>>({});
  const [pendingBonus, setPendingBonus] = useState<string | null>(null);
  const [rouletteRotation, setRouletteRotation] = useState(0);
  const [rouletteResult, setRouletteResult] = useState<number | null>(null);
  const [rouletteNumber, setRouletteNumber] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [identityModal, setIdentityModal] = useState<{ open: boolean; amount: number }>({ open: false, amount: 0 });
  const [identityTransactionType, setIdentityTransactionType] = useState<'achat' | 'apport' | 'echange'>('achat');
  const [signatureError, setSignatureError] = useState('');
  const [signatureConfirmationOpen, setSignatureConfirmationOpen] = useState(false);
  const [confirmedSignatures, setConfirmedSignatures] = useState<string[]>([]);
  const [isSignatureConfirmationSaving, setIsSignatureConfirmationSaving] = useState(false);
  const [lineSignatureModal, setLineSignatureModal] = useState<{ id: number; name: string; value: string; field: 'signature' | 'finalSignature' } | null>(null);
  const getPlayerDisplayName = (player?: PlayerLine) => player?.surnom?.trim() || player?.name?.trim() || `Joueur ${player?.ficheId ?? player?.id ?? selectedPlayerId}`;
  const selectedPlayer = activePlayers.find((player) => (player.ficheId ?? player.id) === selectedPlayerId);
  const selectedPlayerName = getPlayerDisplayName(selectedPlayer);
  const selectedRegisteredPlayer = registeredPlayers.find((player) => player.id === selectedPlayer?.casinoPlayerId);
  // Accord signé à l'inscription : rappeler au caissier d'envoyer la fiche par WhatsApp.
  const wantsWhatsappFiche = Boolean(Number(selectedRegisteredPlayer?.whatsapp_fiche_consent));
  const [whatsappReminderOpen, setWhatsappReminderOpen] = useState(false);
  const selectedPlayerLines = players.filter((player) => (player.ficheId ?? player.id) === selectedPlayerId);
  const selectedPlayerTotal = selectedPlayerLines.reduce((sum, line) => sum + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
  const selectedPlayerCaveToVerify = selectedPlayerTotal;
  const selectedPlayerCashing = parseCasinoAmount(selectedPlayer?.cashing);
  const selectedPlayerResult = selectedPlayerCashing - selectedPlayerTotal;
  const selectedBonuses = parseBonuses(selectedPlayer?.bonuses);
  const selectedBonusResults = parseBonusResults(selectedPlayer?.bonusResults);
  const selectedIdentityVerification = identityVerifications[selectedPlayerId];
  const resultOptions = selectedPlayerResult > 0 ? positiveResultOptions : selectedPlayerResult < 0 ? negativeResultOptions : [];
  const selectedResultPayments = parseResultPayments(selectedPlayer?.resultPaymentOptions)
    .filter((payment) => resultOptions.includes(payment.option));
  const caveLinesToSign = selectedPlayerLines.filter((line) => line.caves.trim() || line.amount.trim());
  const signatureConfirmationItems = [
    ...caveLinesToSign.map((line) => ({ key: `cave-${line.id}`, label: `Cave ${line.caves || '—'} × ${line.amount || '—'} — ${getPlayerDisplayName(line)}` })),
    ...(selectedBonuses.length ? [{ key: `bonus-${selectedPlayerId}`, label: `Signature bonus — ${selectedPlayerName}` }] : []),
  ];

  useEffect(() => {
    if (activePlayers.some((player) => (player.ficheId ?? player.id) === selectedPlayerId)) return;
    setSelectedPlayerId(activePlayers[0] ? (activePlayers[0].ficheId ?? activePlayers[0].id) : 0);
  }, [activePlayers, selectedPlayerId]);

  const saveWithResultCheck = () => {
    if (!selectedPlayer || selectedPlayerResult === 0) {
      setSignatureError('');
    } else if (selectedResultPayments.length === 1) {
      const payment = selectedResultPayments[0];
      if (payment.amount <= 0) {
        // Le montant sera appliqué aux soldes uniquement après confirmation de l'enregistrement.
      }
    } else if (selectedResultPayments.length > 1) {
      if (selectedResultPayments.some((payment) => payment.amount <= 0)) {
        setSignatureError('Veuillez saisir un montant pour chaque mode de règlement.');
        return;
      }
      const allocatedTotal = selectedResultPayments.reduce((sum, payment) => sum + payment.amount, 0);
      if (allocatedTotal !== Math.abs(selectedPlayerResult)) {
        setSignatureError(`La somme des règlements doit être égale à ${casinoCurrency.format(Math.abs(selectedPlayerResult))} Ar.`);
        return;
      }
    }
    const unsignedCave = caveLinesToSign.find((line) => !line.signature);
    if (unsignedCave) {
      const ficheId = unsignedCave.ficheId ?? unsignedCave.id;
      setSelectedPlayerId(ficheId);
      setSignatureError(`La signature est obligatoire pour la cave du joueur ${getPlayerDisplayName(unsignedCave)}.`);
      return;
    }
    if (selectedBonuses.length && !selectedPlayer?.bonusSignature) {
      setSignatureError(`La signature bonus est obligatoire pour ${selectedPlayerName}.`);
      return;
    }
    setSignatureError('');
    setConfirmedSignatures([]);
    setSignatureConfirmationOpen(true);
  };

  const confirmSignaturesAndSave = () => {
    if (confirmedSignatures.length !== signatureConfirmationItems.length || isSignatureConfirmationSaving) return;
    setIsSignatureConfirmationSaving(true);
    // La fiche est clôturée dès que le départ, le cashing ou la signature finale est saisi.
    const isClosingFiche = Boolean(selectedPlayer && (selectedPlayer.finalSignature || selectedPlayer.departure || parseCasinoAmount(selectedPlayer.cashing) > 0));
    const shouldRemindWhatsapp = wantsWhatsappFiche && isClosingFiche;
    try {
      if (selectedPlayer && selectedResultPayments.length) {
        const paymentsToApply = selectedResultPayments.length === 1 && selectedResultPayments[0].amount <= 0
          ? [{ ...selectedResultPayments[0], amount: Math.abs(selectedPlayerResult) }]
          : selectedResultPayments;
        updateResultBalances(paymentsToApply);
      }
      onSave();
    } finally {
      window.setTimeout(() => {
        setIsSignatureConfirmationSaving(false);
        setSignatureConfirmationOpen(false);
        if (shouldRemindWhatsapp) setWhatsappReminderOpen(true);
      }, 350);
    }
  };

  // Chaque fiche possède son propre cumul : une recave ne doit jamais
  // s'ajouter au total d'un autre joueur.
  const totalsByLineId: Record<number, number> = {};
  const accumulatedByLineId: Record<number, string> = {};
  const accumulatedByPlayerId: Record<number, number> = {};

  players.forEach((line) => {
    const playerId = line.ficheId ?? line.id;
    const lineTotal = parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount);

    totalsByLineId[line.id] = lineTotal;
    accumulatedByPlayerId[playerId] = (accumulatedByPlayerId[playerId] || 0) + lineTotal;
    accumulatedByLineId[line.id] = String(accumulatedByPlayerId[playerId]);
  });

  // Fiche joueur au format ticket 80 mm : une ligne par cave avec sa signature.
  const printPlayerSheet = () => {
    if (!selectedPlayer) return;
    const amount = (value: number) => `${escapeHtml(casinoCurrency.format(value))} Ar`;
    const signature = (value?: string) => (value ? `<img class="signature" src="${escapeHtml(value)}" alt="Signature" />` : '<p class="sub">Signature : —</p>');
    const caves = caveLinesToSign.map((line) => `
      <div class="line">
        <div class="row"><span>${escapeHtml(line.time || '—')} · ${escapeHtml(line.caves || '—')} x ${escapeHtml(line.amount || '—')}</span><span>${amount(totalsByLineId[line.id] || 0)}</span></div>
        <div class="sub">Cumul ${amount(Number(accumulatedByLineId[line.id]) || 0)} · ${escapeHtml(line.payment || '—')}${line.paymentMethod ? ` · ${escapeHtml(line.paymentMethod)}` : ''}</div>
        ${signature(line.signature)}
      </div>`).join('');
    const reglements = selectedResultPayments.map((payment) => `<div class="row"><span>${escapeHtml(payment.option)}</span><span>${amount(selectedResultPayments.length > 1 ? payment.amount : Math.abs(selectedPlayerResult))}</span></div>`).join('');
    const bonuses = selectedBonuses.map((bonus) => `<div class="row"><span>${escapeHtml(bonus)}</span><span>${selectedBonusResults[bonus] !== undefined ? amount(selectedBonusResults[bonus]) : ''}</span></div>`).join('');

    printThermal(`Fiche joueur ${selectedPlayerName}`, `
      ${thermalHeader('Fiche joueur', [selectedPlayerName, `N° de fiche : ${selectedPlayer.ficheId ?? selectedPlayer.id}`, `Date : ${date || '—'}`])}
      <h2>CAVES</h2>
      ${caves || '<p>Aucune cave.</p>'}
      <p>Heure de départ : ${escapeHtml(selectedPlayer.departure || '—')}</p>
      <div class="row total"><span>TOTAL CAVES</span><span>${amount(selectedPlayerTotal)}</span></div>
      <div class="row"><span>Cashing (jetons)</span><span>${amount(selectedPlayerCashing)}</span></div>
      <div class="row box"><span>RÉSULTAT</span><span>${amount(selectedPlayerResult)}</span></div>
      ${reglements ? `<h2>${selectedPlayerResult > 0 ? 'RÈGLEMENT DU DÉPÔT' : 'RÈGLEMENT DU CRÉDIT'}</h2>${reglements}` : ''}
      ${bonuses ? `<h2>BONUS</h2>${bonuses}${signature(selectedPlayer.bonusSignature)}` : ''}
      <h2>SIGNATURE FINALE</h2>
      ${signature(selectedPlayer.finalSignature)}
    `);
  };

  // Même priorité que le serveur : le WhatsApp de la fiche d'inscription du joueur fait foi.
  const getPlayerContactNumber = () => {
    const registeredPlayer = registeredPlayers.find((player) => player.id === selectedPlayer?.casinoPlayerId);
    return registeredPlayer?.whatsapp?.trim() || selectedPlayer?.whatsapp?.trim() || registeredPlayer?.telephone?.trim() || '';
  };

  const normalizeContactNumber = (value: string) => {
    const compact = value.trim().replace(/[^\d+]/g, '');
    if (compact.startsWith('+')) return compact.slice(1);
    if (compact.startsWith('00')) return compact.slice(2);
    if (compact.startsWith('0')) return `261${compact.slice(1)}`;
    return compact;
  };

  const buildShareMessage = () => {
    const caveLines = selectedPlayerLines
      .filter((line) => line.caves.trim() || line.amount.trim())
      .map((line) => `- Cave ${line.caves || '—'} x ${line.amount || '—'} : ${line.paymentMethod || line.payment || '—'}`)
      .join('\n');
    return [
      `Fiche joueur - ${selectedPlayerName}`,
      `Date : ${date}`,
      `Total caves : ${formatCompactAmount(selectedPlayerTotal)} Ar`,
      `Cashing : ${formatCompactAmount(selectedPlayerCashing)} Ar`,
      `Resultat : ${formatCompactAmount(selectedPlayerResult)} Ar`,
      caveLines ? `Caves:\n${caveLines}` : '',
    ].filter(Boolean).join('\n');
  };

  const capturePlayerSheet = async () => {
    const printArea = document.querySelector<HTMLElement>('.player-sheet-print');
    if (!printArea) throw new Error('Fiche joueur introuvable');
    // html2canvas-pro : comprend les couleurs oklch() de Tailwind v4, que html2canvas ne sait pas lire.
    const { default: html2canvas } = await import('html2canvas-pro');
    return html2canvas(printArea, {
      backgroundColor: '#161616',
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
      onclone: (clonedDocument) => {
        clonedDocument.querySelectorAll<HTMLElement>('.print\\:hidden').forEach((element) => {
          element.style.display = 'none';
        });
      },
    });
  };

  // Capture JPEG de la fiche : nette et assez légère pour l'envoi (limite serveur 5 Mo).
  const createPlayerImage = async (canvas?: HTMLCanvasElement) => {
    if (!canvas) canvas = await capturePlayerSheet();
    let quality = 0.9;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > 4_000_000 && quality > 0.4) {
      quality -= 0.15;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  };

  const createPlayerPdf = async () => {
    const [canvas, { jsPDF }] = await Promise.all([capturePlayerSheet(), import('jspdf')]);
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pageWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    let offset = 0;
    const imageData = canvas.toDataURL('image/jpeg', 0.92);
    while (offset < imageHeight) {
      if (offset > 0) pdf.addPage();
      pdf.addImage(imageData, 'JPEG', 0, -offset, imageWidth, imageHeight);
      offset += pageHeight;
    }
    return pdf.output('blob');
  };

  const downloadImage = (image: string, fileName: string) => {
    const downloadLink = document.createElement('a');
    downloadLink.href = image;
    downloadLink.download = fileName;
    downloadLink.click();
  };

  // Secours quand l'envoi serveur échoue : la capture part dans WhatsApp depuis cet appareil.
  // Mobile : feuille de partage avec l'image jointe. Ordinateur : l'image est copiée dans le
  // presse-papiers et WhatsApp s'ouvre sur la discussion du joueur (il reste Ctrl+V puis Entrée).
  const openPlayerSheetInWhatsApp = async (canvas: HTMLCanvasElement, image: string, fileName: string, number: string) => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      try {
        const file = new File([await (await fetch(image)).blob()], fileName, { type: 'image/jpeg' });
        if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({ title: `Fiche joueur - ${selectedPlayerName}`, files: [file] });
          return 'Choisissez la discussion du joueur dans WhatsApp pour envoyer la fiche.';
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return '';
      }
      downloadImage(image, fileName);
      window.location.assign(`https://wa.me/${number}`);
      return 'Fiche enregistrée : joignez l’image dans la discussion WhatsApp ouverte.';
    }
    // Sur le PC du serveur : la capture est collée directement dans la discussion du joueur.
    try {
      const opened = await playerSheetApi.openWhatsappDesktop({ image, casino_player_id: selectedPlayer?.casinoPlayerId, numero: number });
      return `Fiche prête dans la discussion WhatsApp du +${opened.numero} : appuyez sur Entrée pour l’envoyer.`;
    } catch (error) {
      console.warn('Collage automatique dans WhatsApp Desktop impossible :', error);
    }
    let copied = false;
    try {
      // Le presse-papiers n'accepte que le PNG.
      const pngBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Capture vide'))), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      copied = true;
    } catch (error) {
      console.warn('Copie de la fiche dans le presse-papiers impossible :', error);
      downloadImage(image, fileName);
    }
    window.location.assign(`whatsapp://send?phone=${number}`);
    return copied
      ? `Discussion WhatsApp du +${number} ouverte : faites Ctrl+V puis Entrée pour envoyer la fiche.`
      : `Fiche enregistrée : joignez l’image dans la discussion WhatsApp du +${number}.`;
  };

  // Envoi automatique : la fiche est capturée en image JPEG et le serveur l'envoie
  // directement au numéro WhatsApp du joueur, depuis le compte WhatsApp rattaché
  // (QR code, onglet Rapport de l'hôtel). En cas d'échec, WhatsApp s'ouvre sur cet appareil.
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);
  const sendPlayerSheetOnWhatsApp = async (number: string) => {
    if (!selectedPlayer || isSendingWhatsapp) return;
    setSignatureError('');
    setIsSendingWhatsapp(true);
    const fileName = `fiche-${selectedPlayerName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${date}.jpg`;
    let image = '';
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = await capturePlayerSheet();
      image = await createPlayerImage(canvas);
      const result = await playerSheetApi.sendWhatsapp({
        image,
        casino_player_id: selectedPlayer.casinoPlayerId,
        numero: number,
        caption: `Fiche joueur — ${selectedPlayerName} — ${date}`,
        filename: fileName,
      });
      showToast(`Fiche envoyée par WhatsApp au +${result.numero}.`, 'success');
    } catch (error) {
      console.error('Erreur lors de l’envoi WhatsApp de la fiche joueur :', error);
      const apiError = error as { response?: { data?: { error?: { message?: string } | string; message?: string } } };
      const responseError = apiError.response?.data?.error;
      const message = (typeof responseError === 'string' ? responseError : responseError?.message) || apiError.response?.data?.message || 'Impossible d’envoyer la fiche par WhatsApp.';
      if (canvas && image) {
        const instructions = await openPlayerSheetInWhatsApp(canvas, image, fileName, number);
        if (instructions) showToast(instructions, 'info', 10000);
        console.warn('Envoi automatique WhatsApp échoué :', message);
      } else {
        setSignatureError(message);
        showToast(message, 'error', 10000);
      }
    } finally {
      setIsSendingWhatsapp(false);
    }
  };

  const sharePlayerSheet = async (channel: 'whatsapp' | 'viber') => {
    if (!selectedPlayer) return;
    const number = normalizeContactNumber(getPlayerContactNumber());
    if (!number) {
      setSignatureError('Ajoutez d’abord un numéro WhatsApp ou Viber pour ce joueur.');
      return;
    }
    if (channel === 'whatsapp') {
      await sendPlayerSheetOnWhatsApp(number);
      return;
    }
    const message = buildShareMessage();
    try {
      const pdfBlob = await createPlayerPdf();
      const file = new File([pdfBlob], `fiche-${selectedPlayerName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${date}.pdf`, { type: 'application/pdf' });
      if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `Fiche joueur - ${selectedPlayerName}`, text: message, files: [file] });
        return;
      }
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = file.name;
      downloadLink.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Erreur lors de la génération de la fiche PDF :', error);
      setSignatureError('Impossible de générer le PDF de la fiche joueur.');
      return;
    }
    try {
      await navigator.clipboard?.writeText(message);
    } catch {
      // Le chat Viber peut s'ouvrir même si le presse-papiers est indisponible.
    }
    window.location.assign(`viber://chat?number=${encodeURIComponent(`+${number}`)}`);
  };

  const addPlayerLine = () => {
    if (!selectedPlayer) return;
    const ficheId = selectedPlayer.ficheId ?? selectedPlayer.id;
    resultPaymentBackups.current[ficheId] = selectedPlayer.resultPaymentOptions || '';
    onUpdate(selectedPlayer.id, 'resultPaymentOptions', '');
    onAdd(selectedPlayer.ficheId ?? selectedPlayer.id, selectedPlayer.surnom || selectedPlayer.name);
    setSelectedPlayerId(selectedPlayer.ficheId ?? selectedPlayer.id);
  };

  const toggleBonus = (bonus: string, checked: boolean) => {
    if (!selectedPlayer) return;
    if (checked) {
      setPendingBonus(bonus);
      setRouletteResult(null);
      setRouletteNumber(null);
      return;
    }
    const nextBonuses = selectedBonuses.filter((selectedBonus) => selectedBonus !== bonus);
    const nextResults = { ...selectedBonusResults };
    delete nextResults[bonus];
    onUpdate(selectedPlayer.id, 'bonuses', JSON.stringify(nextBonuses));
    onUpdate(selectedPlayer.id, 'bonusResults', JSON.stringify(nextResults));
  };

  const spinRoulette = () => {
    if (isSpinning) return;
    const winningIndex = Math.floor(Math.random() * ROULETTE_PRIZES.length);
    setIsSpinning(true);
    setRouletteResult(null);
    setRouletteNumber(null);
    // Le numéro gagnant doit finir sous la flèche placée en haut de la roue,
    // même si la roue a déjà été tournée auparavant.
    setRouletteRotation((current) => {
      const currentAngle = ((current % 360) + 360) % 360;
      const targetAngle = (360 - winningIndex * (360 / ROULETTE_PRIZES.length)) % 360;
      const extraAngle = (targetAngle - currentAngle + 360) % 360;
      return current + 1800 + extraAngle;
    });
    window.setTimeout(() => {
      setRouletteResult(ROULETTE_PRIZES[winningIndex]);
      setRouletteNumber(winningIndex + 1);
      setIsSpinning(false);
    }, 10000);
  };

  const confirmBonusResult = () => {
    if (!selectedPlayer || !pendingBonus || rouletteResult === null) return;
    onUpdate(selectedPlayer.id, 'bonuses', JSON.stringify([...new Set([...selectedBonuses, pendingBonus])]));
    onUpdate(selectedPlayer.id, 'bonusResults', JSON.stringify({ ...selectedBonusResults, [pendingBonus]: rouletteResult }));
    setPendingBonus(null);
  };

  const updateResultBalances = (nextPayments: ResultPayment[]) => {
    if (!selectedPlayer) return;
    const ficheId = selectedPlayer.ficheId ?? selectedPlayer.id;
    const balanceBase = resultBalanceBases.current[ficheId] ?? {
      deposit: parseCasinoAmount(selectedPlayer.initialDeposit),
      credit: parseCasinoAmount(selectedPlayer.initialCredit),
    };
    resultBalanceBases.current[ficheId] = balanceBase;
    const normalizedPayments = nextPayments.length === 1
      ? [{ ...nextPayments[0], amount: Math.abs(selectedPlayerResult) }]
      : nextPayments;
    onUpdate(selectedPlayer.id, 'resultPaymentOptions', JSON.stringify(normalizedPayments));

    // Règle métier détaillée :
    // - Dépôt payé => réduit le dépôt initial.
    // - Crédit payé => réduit le crédit initial.
    // - Si le crédit initial est positif et le règlement dépasse ce crédit, le surplus est reporté sur le dépôt.
    const depositReduction = normalizedPayments
      .filter((payment) => payment.option === 'Dépôt payé')
      .reduce((total, payment) => total + (payment.amount || 0), 0);
    const creditReduction = normalizedPayments
      .filter((payment) => payment.option === 'Crédit payé')
      .reduce((total, payment) => total + (payment.amount || 0), 0);

    const nextDeposit = Math.max(0, balanceBase.deposit - depositReduction);
    const remainingCredit = Math.max(0, balanceBase.credit - creditReduction);
    const creditOverflow = Math.max(0, creditReduction - balanceBase.credit);
    const finalDeposit = Math.max(0, nextDeposit + creditOverflow);

    onUpdate(selectedPlayer.id, 'initialDeposit', String(finalDeposit));
    onUpdate(selectedPlayer.id, 'initialCredit', String(remainingCredit));
  };

  const toggleResultPaymentOption = (option: string, checked: boolean) => {
    if (!selectedPlayer) return;
    const nextPayments = checked
      ? [...selectedResultPayments.filter((payment) => payment.option !== option), { option, amount: 0 }]
      : selectedResultPayments.filter((payment) => payment.option !== option);
    onUpdate(selectedPlayer.id, 'resultPaymentOptions', JSON.stringify(nextPayments));
  };

  const updateResultPaymentAmount = (option: string, amount: string) => {
    if (!selectedPlayer) return;
    const nextPayments = selectedResultPayments.map((payment) => payment.option === option ? { ...payment, amount: parseCasinoAmount(amount) } : payment);
    onUpdate(selectedPlayer.id, 'resultPaymentOptions', JSON.stringify(nextPayments));
  };

  useEffect(() => {
    const cashingAmount = parseCasinoAmount(selectedPlayer?.cashing);
    const caveAmount = selectedPlayerCaveToVerify >= IDENTITY_VERIFICATION_THRESHOLD ? selectedPlayerCaveToVerify : 0;
    const verificationAmount = Math.max(caveAmount, cashingAmount);
    if (selectedPlayer && verificationAmount >= IDENTITY_VERIFICATION_THRESHOLD && !selectedPlayer.identityVerification && !identityVerifications[selectedPlayer.ficheId ?? selectedPlayer.id]) {
      setIdentityTransactionType(cashingAmount > caveAmount ? 'echange' : 'achat');
      setIdentityModal({ open: true, amount: verificationAmount });
    }
  }, [selectedPlayer?.id, selectedPlayer?.identityVerification, selectedPlayer?.cashing, selectedPlayerCaveToVerify, identityVerifications]);

  const handleIdentityConfirm = async (data: IdentityVerificationData) => {
    if (!selectedPlayer) return;
    try {
      // Call API to save verification to database
      const savedVerification = await identityVerificationApi.create({
        fiche_id: selectedPlayer.ficheId ?? selectedPlayer.id,
        full_name: data.fullName,
        id_type: data.idType,
        id_number: data.idNumber,
        issue_date: data.issueDate,
        transaction_type: data.transactionType.toUpperCase() as 'ACHAT' | 'APPORT' | 'ECHANGE',
        amount: data.amount,
      });
      
      // Update local state
      onUpdate(selectedPlayer.id, 'identityVerification', JSON.stringify(data));
      onIdentityVerified?.(selectedPlayer.ficheId ?? selectedPlayer.id, data, savedVerification.id);
      setIdentityModal({ open: false, amount: 0 });
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement de la vérification d\'identité:', err);
      const apiError = err as { response?: { status?: number; data?: { error?: { message?: string } | string } } };
      const responseError = apiError.response?.data?.error;
      const message = typeof responseError === 'string' ? responseError : responseError?.message;
      alert(message || `Erreur lors de l'enregistrement (${apiError.response?.status || 'réseau'})`);
    }
  };

  return (
  <div className="player-sheet-print p-2 text-xs text-white print:bg-white print:text-black" style={{ backgroundColor: 'var(--color-surface)' }}>
    <div className="mb-4 flex flex-col items-stretch justify-between gap-3 rounded-2xl border p-3 shadow-sm sm:flex-row sm:items-center print:hidden" style={{ backgroundColor: 'var(--color-bg)', ...casinoBorder }}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <label htmlFor="player-to-print" className="font-semibold">Fiche joueur :</label>
        {!activePlayers.length ? (
          <select id="player-to-print" value={0} className="w-full rounded border bg-transparent px-2 py-1 text-white sm:w-auto" style={{ ...casinoBorder, color: '#fff', backgroundColor: 'var(--color-surface)' }} disabled>
            <option value={0} aria-label="Aucun joueur en jeu" />
          </select>
        ) : <>
        <select id="player-to-print" value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(Number(event.target.value))} className="w-full rounded border bg-transparent px-2 py-1 text-white sm:w-auto" style={{ ...casinoBorder, color: '#fff', backgroundColor: 'var(--color-surface)' }} disabled={!players.length}>
          {activePlayers.map((player, index) => <option key={player.ficheId ?? player.id} value={player.ficheId ?? player.id} className="text-white" style={{ color: '#fff', backgroundColor: 'var(--color-surface)' }}>Fiche {index + 1} — {getPlayerDisplayName(player)}</option>)}
        </select>
        </>}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        {isAdmin && <button type="button" className={sheetActionSecondary} onClick={onGoToRegisteredPlayers}>Ajouter un joueur</button>}
        {isAdmin && <button type="button" className={sheetActionSecondary} onClick={addPlayerLine} disabled={!selectedPlayer}>Ajouter une ligne</button>}
        <button type="button" className={sheetActionSecondary} onClick={printPlayerSheet} disabled={!selectedPlayer}>Imprimer la fiche</button>
        {wantsWhatsappFiche && <span className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-green-400 bg-green-500/10 px-3 text-[11px] font-semibold text-green-300" title="Accord signé à l’inscription"><MessageCircle size={14} /> Joueur souhaite un envoi de fiche par WhatsApp</span>}
        <button type="button" className={sheetActionSecondary} onClick={() => void sharePlayerSheet('whatsapp')} disabled={!selectedPlayer || isSendingWhatsapp} style={wantsWhatsappFiche ? { backgroundColor: '#25D366', borderColor: '#25D366', color: '#fff' } : undefined}>{isSendingWhatsapp ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />} {isSendingWhatsapp ? 'Envoi en cours…' : wantsWhatsappFiche ? 'Envoi par WhatsApp' : 'WhatsApp'}</button>
        <button type="button" className={sheetActionSecondary} onClick={() => void sharePlayerSheet('viber')} disabled={!selectedPlayer}><MessageCircle size={15} /> Viber</button>
      </div>
    </div>
    <div className="player-print-header mb-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-end sm:justify-between print:mb-3 print:rounded-none print:border-2 print:border-black print:bg-white print:p-3" style={{ backgroundColor: 'var(--color-bg)', ...casinoBorder }}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-300">Fiche joueur</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white print:text-black">{selectedPlayerName}</h1>
        <p className="mt-1 text-[11px] text-gray-400 print:text-gray-600">Suivi de jeu et règlement de la session</p>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right text-[11px] text-gray-300 print:text-black sm:min-w-48">
        <span className="text-gray-500 print:text-gray-600">N° de fiche</span><strong>{selectedPlayer?.ficheId ?? selectedPlayer?.id ?? '—'}</strong>
        <span className="text-gray-500 print:text-gray-600">Date</span><strong>{date || '—'}</strong>
      </div>
    </div>
    <div className="-mx-2 overflow-x-auto px-2 pb-2 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[980px] table-fixed border-collapse border sm:min-w-[1080px] xl:min-w-[1180px]" style={casinoBorder}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-bg)' }}>
            <th className="border p-2 text-left font-semibold" style={casinoBorder} colSpan={2}>DATE : <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} className="ml-1 bg-transparent font-normal outline-none" /></th>
            <th className="border p-2 text-left font-semibold" style={casinoBorder} colSpan={3}>JOUEUR :</th>
            <th className="border p-2 text-left font-semibold" style={casinoBorder}>N° D’ADHÉRANT</th>
            <th className="border p-2 text-left font-semibold" style={casinoBorder}>HEURE D’ARRIVÉE</th>
            <th className="border p-2 text-left font-semibold" style={casinoBorder} colSpan={3}>RÉSULTATS</th>
          </tr>
          <tr style={{ backgroundColor: 'var(--color-bg)' }}>
            <th className="border p-2 text-left font-semibold" style={casinoBorder}>JOUEUR :</th>
            <th className="border p-2 text-left font-semibold" style={casinoBorder}>HEURE :</th>
            <th className="border p-2 text-left font-semibold" style={casinoBorder}>NB CAVES</th>
            <th className="border p-2 text-left font-semibold" style={casinoBorder}>Montant Caves</th>
            <th className="bo rder p-2 text-left font-semibold" style={casinoBorder}>Total Caves +</th>
            <th className="border p-2 text-left font-semibold" style={casinoBorder}>Caves accumulées +</th>
            <th className="border p-2 text-center font-semibold" style={casinoBorder}>Paye</th>
            <th className="border p-2 text-center font-semibold" style={casinoBorder}>non Paye</th>
            <th className="border p-2 text-left font-semibold" style={casinoBorder}>MODE DE PAIEMENT</th>
            <th className="border p-2 text-center font-semibold" style={casinoBorder}>Signature</th>
            {isAdmin && <th className="border p-2 text-center font-semibold print:hidden" style={casinoBorder}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {selectedPlayerLines.map((line) => {
            const isEmptyCaveLine = !line.caves.trim() && !line.amount.trim();

            return (
            <tr key={line.id} className="h-9">
              <td className="border" style={casinoBorder}><input className={paperInput} value={line.surnom} onChange={(event) => onUpdate(line.id, 'surnom', event.target.value)} placeholder="Surnom du joueur" disabled={!isAdmin} /></td>
              <td className="border" style={casinoBorder}><input type="time" className={paperInput} value={line.time} onChange={(event) => onUpdate(line.id, 'time', event.target.value)} disabled={!isAdmin} /></td>
              <td className="border" style={casinoBorder}><input className={paperInput} value={line.caves} onChange={(event) => onUpdate(line.id, 'caves', event.target.value)} disabled={!isAdmin} /></td>
              <td className="border" style={casinoBorder}><input className={paperInput} value={line.amount} onChange={(event) => onUpdate(line.id, 'amount', event.target.value)} disabled={!isAdmin} /></td>
              <td className="border" style={casinoBorder}><input className={paperInput} value={totalsByLineId[line.id] ? formatCompactAmount(totalsByLineId[line.id]) : '0'} readOnly /></td>
              <td className="border" style={casinoBorder}><input className={paperInput} value={isEmptyCaveLine ? '' : accumulatedByLineId[line.id] || '0'} readOnly /></td>
              <td className="border text-center" style={casinoBorder}><input type="radio" name={`payment-${line.id}`} checked={line.payment === 'Payé'} onChange={() => onUpdate(line.id, 'payment', 'Payé')} disabled={!isAdmin} /></td>
              <td className="border text-center" style={casinoBorder}><input type="radio" name={`payment-${line.id}`} checked={line.payment === 'Non payé'} onChange={() => onUpdate(line.id, 'payment', 'Non payé')} disabled={!isAdmin} /></td>
              <td className="border" style={casinoBorder}><select className={paperInput} value={line.paymentMethod || ''} onChange={(event) => onUpdate(line.id, 'paymentMethod', event.target.value)} style={{ color: '#fff', backgroundColor: 'var(--color-surface)' }} disabled={!isAdmin}><option value="" className="text-white" style={{ color: '#fff', backgroundColor: 'var(--color-surface)' }}>Sélectionner</option>{paymentMethods.map((method) => <option key={method} value={method} className="text-white" style={{ color: '#fff', backgroundColor: 'var(--color-surface)' }}>{method}</option>)}</select></td>
              <td className="border p-1" style={casinoBorder}>
                <button type="button" className="flex min-h-14 w-full items-center justify-center rounded border border-dashed px-1 text-[10px] text-yellow-200 transition hover:border-yellow-300 hover:bg-yellow-300/10 disabled:cursor-not-allowed disabled:opacity-60" style={casinoBorder} onClick={() => setLineSignatureModal({ id: line.id, name: getPlayerDisplayName(line), value: line.signature || '', field: 'signature' })} disabled={!isAdmin} aria-label={`Signer pour ${getPlayerDisplayName(line)}`}>
                  {line.signature ? <img src={line.signature} alt="Signature du joueur" className="max-h-12 max-w-full object-contain" style={{ filter: 'invert(1)' }} /> : 'Cliquer pour signer'}
                </button>
              </td>
              {isAdmin && <td className="border p-1 text-center print:hidden" style={casinoBorder}>
                <div className="flex justify-center gap-1">
                  <button type="button" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-500/10 p-2 text-amber-200 transition hover:bg-amber-500/20 hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => onDuplicate(line)} title="Copier cette ligne" aria-label={`Copier la ligne de ${getPlayerDisplayName(line)}`} disabled={isEmptyCaveLine}><Copy size={16} /></button>
                  {canDeletePlayerLine && <button type="button" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20 hover:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-400" onClick={() => { if (!window.confirm(`Supprimer la ligne de ${line.name || 'ce joueur'} ?`)) return; const ficheId = line.ficheId ?? line.id; const previousPayment = resultPaymentBackups.current[ficheId]; if (previousPayment !== undefined) { onUpdate(line.id, 'resultPaymentOptions', `__restore_remove__:${previousPayment}`); return; } onRemove(line.id); }} title="Supprimer la ligne" aria-label={`Supprimer la ligne de ${line.name || 'ce joueur'}`}><Trash2 size={16} /></button>}
                </div>
              </td>}
            </tr>
            );
          })}
          <tr className="h-12">
            <td className="border p-2 font-semibold" style={casinoBorder} colSpan={2}>HEURE DE DEPART : <input type="time" className={`${paperInput} inline-block w-28`} value={selectedPlayer?.departure || ''} onChange={(event) => selectedPlayer && onUpdate(selectedPlayer.id, 'departure', event.target.value)} /></td>
            <td className="border p-2 font-semibold" style={casinoBorder} colSpan={3}>Cashing : <input type="text" inputMode="decimal" className={`${paperInput} inline-block w-32`} value={selectedPlayer?.cashing || ''} onChange={(event) => selectedPlayer && onUpdate(selectedPlayer.id, 'cashing', event.target.value)} placeholder="0" /></td>
            <td className="border p-2" style={casinoBorder} colSpan={isAdmin ? 6 : 5} />
          </tr>
        </tbody>
      </table>
    </div>

    <div className="mt-4 grid md:grid-cols-[1.15fr_1fr_1.15fr] border text-white" style={{ ...casinoBorder, backgroundColor: 'var(--color-surface)' }}>
      <div className="border-r" style={casinoBorder}>
        <SheetBottomRow label="TOTAL CAVEES :" value={formatCompactAmount(selectedPlayerTotal)} />
        <SheetBottomRow label="TOTAL CASHING EN JETONS" value={formatCompactAmount(selectedPlayerCashing)} />
        <SheetBottomRow label="RESULTAT :" value={formatCompactAmount(selectedPlayerResult)} />
        {resultOptions.length > 0 && (
          <div className="border-b p-3" style={casinoBorder}>
            <p className="mb-2 text-[10px] font-semibold">{selectedPlayerResult > 0 ? 'RÈGLEMENT DU DÉPÔT' : 'RÈGLEMENT DU CRÉDIT'}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              {resultOptions.map((option) => (
                <label key={option} className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={selectedResultPayments.some((payment) => payment.option === option)} onChange={(event) => toggleResultPaymentOption(option, event.target.checked)} />
                  {option}
                  {selectedResultPayments.length > 1 && selectedResultPayments.some((payment) => payment.option === option) && <input type="text" inputMode="decimal" className="w-24 rounded border bg-transparent px-2 py-1" value={selectedResultPayments.find((payment) => payment.option === option)?.amount || ''} onChange={(event) => updateResultPaymentAmount(option, event.target.value)} placeholder="Montant" />}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 border-b p-3" style={casinoBorder}>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-yellow-200">SIGNATURE FINALE</p>
          {selectedPlayer && <button type="button" className="flex min-h-16 w-full items-center justify-center rounded border border-dashed bg-white px-2 text-[10px] text-slate-600 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60" style={casinoBorder} onClick={() => setLineSignatureModal({ id: selectedPlayer.id, name: selectedPlayerName, value: selectedPlayer.finalSignature || '', field: 'finalSignature' })} disabled={!isAdmin} aria-label={`Signer la fiche finale de ${selectedPlayerName}`}>
            {selectedPlayer.finalSignature ? <img src={selectedPlayer.finalSignature} alt="Signature finale du joueur" className="max-h-14 max-w-full object-contain" /> : 'Cliquer pour signer'}
          </button>}
        </div>
      </div>
      <div className="border-r" style={casinoBorder}>
        <p className="border-b p-2 font-semibold" style={casinoBorder}>BONUS</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 text-[11px]">
          {bonusCategories.map((bonus) => (
            <label key={bonus} className="inline-flex items-center gap-2">
              <input type="checkbox" checked={selectedBonuses.includes(bonus)} onChange={(event) => toggleBonus(bonus, event.target.checked)} />
              {bonus}
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t p-3" style={casinoBorder}>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-yellow-200">SIGNATURE BONUS</p>
          {selectedPlayer && <SignaturePad value={selectedPlayer.bonusSignature || ''} onChange={(value) => onUpdate(selectedPlayer.id, 'bonusSignature', value)} disabled={!isAdmin} />}
        </div>
      </div>
      <div>
        <p className="border-b p-2 font-semibold" style={casinoBorder}>RESTAURANT</p>
        <SheetBottomRow label="TOTAL OFFERT" />
        <SheetBottomRow label="TOTAL BON RESTAURANT" />
        <SheetBottomRow label="MONTANT PAYE" />
        <div className="flex items-center gap-4 border-b p-2" style={casinoBorder}>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" aria-label="Paiement en especes" checked={restaurantPayments.especes} onChange={(event) => onPaymentChange('especes', event.target.checked)} />
            ESPECES
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" aria-label="Paiement par TPE" checked={restaurantPayments.tpe} onChange={(event) => onPaymentChange('tpe', event.target.checked)} />
            TPE
          </label>
        </div>
        <SheetBottomRow label="RESTE A PAYER" />
      </div>
    </div>

    {showIdentityVerifications && selectedIdentityVerification && (
      <div className="mt-4 rounded-xl border p-3 text-[11px] print:hidden" style={{ backgroundColor: 'var(--color-bg)', ...casinoBorder }}>
        <p className="mb-2 font-bold text-yellow-300">VÉRIFICATION D'IDENTITÉ</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted">Nom :</span>
          <span className="font-semibold">{selectedIdentityVerification.full_name}</span>
          <span className="text-muted">Pièce :</span>
          <span className="font-semibold">{selectedIdentityVerification.id_type} n° {selectedIdentityVerification.id_number}</span>
          <span className="text-muted">Date d'émission :</span>
          <span className="font-semibold">{selectedIdentityVerification.issue_date}</span>
          <span className="text-muted">Type :</span>
          <span className="font-semibold">{selectedIdentityVerification.transaction_type.toUpperCase()}</span>
          <span className="text-muted">Montant :</span>
          <span className="font-semibold text-yellow-300">{casinoCurrency.format(selectedIdentityVerification.amount)} Ar</span>
          <span className="text-muted">Vérifié le :</span>
          <span className="font-semibold">{new Date(selectedIdentityVerification.verified_at).toLocaleString('fr-FR')}</span>
        </div>
      </div>
    )}
    <div className="mt-5 flex flex-col items-stretch gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-end print:hidden" style={{ backgroundColor: 'var(--color-bg)', ...casinoBorder }}>
      {saveState === 'saved' && <span className="text-xs text-green-700">Enregistré</span>}
      {(saveState === 'error' || signatureError) && <span className="text-xs text-red-400">{signatureError || 'Erreur d’enregistrement'}</span>}
      <button type="button" className={sheetActionPrimary} onClick={saveWithResultCheck} disabled={saveState === 'saving'}>
        {saveState === 'saving' ? 'Enregistrement...' : 'Enregistrer la fiche'}
      </button>
    </div>
    {pendingBonus && <BonusRouletteModal bonus={pendingBonus} rotation={rouletteRotation} result={rouletteResult} number={rouletteNumber} isSpinning={isSpinning} onSpin={spinRoulette} onConfirm={confirmBonusResult} onClose={() => !isSpinning && setPendingBonus(null)} />}
    {signatureConfirmationOpen && <SignatureConfirmationModal items={signatureConfirmationItems} confirmedKeys={confirmedSignatures} isSubmitting={isSignatureConfirmationSaving} onToggle={(key, checked) => setConfirmedSignatures((current) => checked ? [...current, key] : current.filter((item) => item !== key))} onClose={() => setSignatureConfirmationOpen(false)} onConfirm={confirmSignaturesAndSave} />}
    {whatsappReminderOpen && <WhatsappReminderModal playerName={selectedPlayerName} contactNumber={getPlayerContactNumber()} onClose={() => setWhatsappReminderOpen(false)} onSend={() => { setWhatsappReminderOpen(false); void sharePlayerSheet('whatsapp'); }} />}
    {lineSignatureModal && <LineSignatureModal playerName={lineSignatureModal.name} value={lineSignatureModal.value} onClose={() => setLineSignatureModal(null)} onValidate={(value) => { onUpdate(lineSignatureModal.id, lineSignatureModal.field, value); setLineSignatureModal(null); }} />}
    <IdentityVerificationModal
      open={identityModal.open}
      amount={identityModal.amount}
      transactionType={identityTransactionType}
      onClose={() => setIdentityModal({ open: false, amount: 0 })}
      onConfirm={handleIdentityConfirm}
    />
  </div>
  );
};

const SignatureConfirmationModal: React.FC<{
  items: { key: string; label: string }[];
  confirmedKeys: string[];
  isSubmitting?: boolean;
  onToggle: (key: string, checked: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ items, confirmedKeys, isSubmitting = false, onToggle, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="signature-confirmation-title">
    <div className="w-full max-w-xl rounded-2xl border p-5 text-white shadow-2xl" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
      <h2 id="signature-confirmation-title" className="text-lg font-bold">Confirmation des signatures</h2>
      <p className="mt-2 text-sm text-muted">Le joueur doit confirmer que chaque signature ci-dessous est bien la sienne avant l’enregistrement de la fiche.</p>
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {items.map((item) => <label key={item.key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm" style={casinoBorder}>
          <input type="checkbox" className="mt-0.5" checked={confirmedKeys.includes(item.key)} onChange={(event) => onToggle(item.key, event.target.checked)} disabled={isSubmitting} />
          <span>Je confirme : {item.label}</span>
        </label>)}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="action secondary" onClick={onClose} disabled={isSubmitting}>Annuler</button>
        <button type="button" className="action inline-flex items-center gap-2" onClick={onConfirm} disabled={confirmedKeys.length !== items.length || isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Enregistrement...' : 'Confirmer et enregistrer'}
        </button>
      </div>
    </div>
  </div>
);

const WhatsappReminderModal: React.FC<{ playerName: string; contactNumber: string; onClose: () => void; onSend: () => void }> = ({ playerName, contactNumber, onClose, onSend }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="whatsapp-reminder-title">
    <div className="w-full max-w-md rounded-2xl border border-green-400 p-5 text-white shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }}>
      <h2 id="whatsapp-reminder-title" className="inline-flex items-center gap-2 text-lg font-bold text-green-300"><MessageCircle size={20} /> Rappel WhatsApp</h2>
      <p className="mt-3 text-sm">Le joueur <strong>{playerName}</strong> souhaite un envoi de fiche par WhatsApp.</p>
      <p className="mt-1 text-xs text-muted">Numéro : {contactNumber || 'aucun numéro enregistré'}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="action secondary" onClick={onClose}>Plus tard</button>
        <button type="button" className="action inline-flex items-center gap-2" style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#fff' }} onClick={onSend}><MessageCircle size={15} /> Envoi par WhatsApp</button>
      </div>
    </div>
  </div>
);

const LineSignatureModal: React.FC<{ playerName: string; value: string; onClose: () => void; onValidate: (value: string) => void }> = ({ playerName, value, onClose, onValidate }) => {
  const [draftSignature, setDraftSignature] = useState(value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="line-signature-title">
      <div className="w-full max-w-3xl rounded-2xl border p-5 text-white shadow-2xl" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
        <h2 id="line-signature-title" className="text-lg font-bold">Signature du joueur</h2>
        <p className="mt-1 text-sm text-muted">{playerName}</p>
        <div className="mt-4 rounded-xl border bg-white p-2" style={casinoBorder}>
          <SignaturePad value={draftSignature} onChange={setDraftSignature} large />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="action secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="action" onClick={() => onValidate(draftSignature)} disabled={!draftSignature}>Valider la signature</button>
        </div>
      </div>
    </div>
  );
};

const SheetBottomRow: React.FC<{ label: string; value?: string }> = ({ label, value = '' }) => (
  <label className="grid grid-cols-[1.45fr_1fr] min-h-12 border-b last:border-b-0" style={casinoBorder}>
    <span className="p-2 flex items-center font-semibold text-[10px] leading-tight border-r" style={casinoBorder}>{label}</span>
    <input className={darkInput} value={value} readOnly />
  </label>
);

const BonusRouletteModal: React.FC<{ bonus: string; rotation: number; result: number | null; number: number | null; isSpinning: boolean; onSpin: () => void; onConfirm: () => void; onClose: () => void }> = ({ bonus, rotation, result, number, isSpinning, onSpin, onConfirm, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden" role="dialog" aria-modal="true" aria-label={`Roue bonus ${bonus}`}>
    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border p-4 text-white shadow-2xl sm:p-5" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
      <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-lg font-bold">Roue bonus</p><p className="text-sm text-muted">Bonus : {bonus}</p></div><button type="button" className="text-xl leading-none" onClick={onClose} disabled={isSpinning} aria-label="Fermer">×</button></div>
      <div className="relative mx-auto mb-5 flex h-[min(90vw,25rem,55vh)] w-[min(90vw,25rem,55vh)] max-w-full items-center justify-center">
        <span className="absolute -top-3 z-10 text-3xl text-yellow-300">▼</span>
        <div className="relative h-full w-full rounded-full border-4 border-yellow-500 transition-transform duration-[10000ms] ease-out" style={{ background: 'repeating-conic-gradient(#b91c1c 0deg 15deg, #1f2937 15deg 30deg)', transform: `rotate(${rotation}deg)` }}>
          {ROULETTE_PRIZES.map((_, index) => (
            <span key={index} className="absolute left-1/2 top-1/2 -ml-3 -mt-3 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-[9px] font-bold text-white" style={{ transform: `rotate(${index * 15}deg) translateY(calc(-1 * (min(90vw, 25rem, 55vh) / 2 - 14px))) rotate(${-index * 15}deg)` }}>{index + 1}</span>
          ))}
        </div>
        <div className="absolute flex h-32 w-32 items-center justify-center rounded-full border-4 border-yellow-500 bg-yellow-700 text-center text-sm font-bold">BONUS</div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded border p-2 text-[10px] sm:grid-cols-3 sm:text-[11px]" style={casinoBorder}>
        {ROULETTE_PRIZES.map((prize, index) => <span key={index} className={prize === 0 ? 'text-red-400' : prize === 100000 ? 'text-lime-300' : ''}>{index + 1}. {casinoCurrency.format(prize)} Ar</span>)}
      </div>
      {result !== null && <p className="mb-4 rounded-lg bg-yellow-500/15 p-3 text-center font-bold text-yellow-300">Numéro {number} : {casinoCurrency.format(result)} Ar</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className="action secondary" onClick={onClose} disabled={isSpinning}>Annuler</button>{result === null ? <button type="button" className="action" onClick={onSpin} disabled={isSpinning}>{isSpinning ? 'La roue tourne...' : 'Tourner la roue'}</button> : <button type="button" className="action" onClick={onConfirm}>Valider le gain</button>}</div>
    </div>
  </div>
);

const SignaturePad: React.FC<{ value?: string; onChange: (value: string) => void; compact?: boolean; large?: boolean; disabled?: boolean }> = ({ value = '', onChange, compact = false, large = false, disabled = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));
  const width = large ? 760 : compact ? 180 : 210;
  const height = large ? 260 : compact ? 58 : 56;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    const signatureValue = value || '';
    setHasSignature(Boolean(signatureValue));
    if (!signatureValue.startsWith('data:image/')) return;

    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = signatureValue;
  }, [value]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const context = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const { x, y } = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !isDrawingRef.current) return;
    const context = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const finishDrawing = () => {
    if (disabled || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    const signature = canvasRef.current?.toDataURL('image/png') || '';
    setHasSignature(Boolean(signature));
    onChange(signature);
  };

  const clear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    canvas?.getContext('2d', { willReadFrequently: true })?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange('');
  };

  return (
    <span className={`relative flex w-full ${large ? 'max-w-none' : 'max-w-[250px]'} rounded-xl border p-1.5 shadow-inner transition ${hasSignature ? 'border-emerald-400/50 bg-emerald-500/5' : 'border-white/20 bg-black/10 hover:border-amber-300/70'}`} style={{ borderColor: hasSignature ? undefined : 'var(--color-border)' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        aria-label="Zone de signature tactile"
        className="h-auto w-full rounded-lg bg-white touch-none"
        style={{ touchAction: 'none', cursor: disabled ? 'not-allowed' : 'crosshair', opacity: disabled ? 0.65 : 1 }}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
        onPointerLeave={finishDrawing}
      />
      {!hasSignature && <span className="pointer-events-none absolute inset-x-3 bottom-2 text-center text-[9px] font-semibold tracking-[0.14em] text-slate-500">SIGNER ICI</span>}
      {hasSignature && !disabled && <button type="button" className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-400/40 bg-red-500/90 text-white shadow-lg transition hover:scale-105 hover:bg-red-500 print:hidden" onClick={clear} title="Effacer la signature" aria-label="Effacer la signature"><Trash2 size={13} /></button>}
    </span>
  );
};
