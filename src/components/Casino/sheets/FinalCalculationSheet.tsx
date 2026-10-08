import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { casinoBorder, casinoCurrency, parseCasinoAmount } from './types';
import type { PlayerLine } from './types';

interface FinalCalculationSheetProps {
  players: PlayerLine[];
  selectedPlayerId: number;
  values: Record<string, string>;
  withdrawnTotal: number;
  depositResults: string;
  creditResults: string;
  calculationRevision?: number;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  onPlayerChange: (id: number) => void;
  onUpdate: (key: string, value: string) => void;
  onSave: (values?: Record<string, string>) => void;
  showIdentityVerifications?: boolean;
  identityVerifications?: Record<number, { id?: number; full_name: string; id_type: string; id_number: string; issue_date: string; transaction_type: string; amount: number; verified_at: string }>;
}

export const FinalCalculationSheet: React.FC<FinalCalculationSheetProps> = ({ players, selectedPlayerId, values, withdrawnTotal, depositResults, creditResults, calculationRevision = 0, saveState = 'idle', onPlayerChange, onUpdate, onSave, showIdentityVerifications = true, identityVerifications = {} }) => {
  // Les champs automatiques suivent toujours les fiches joueurs ; seule une saisie
  // manuelle faite pendant cette session (ref à true) les remplace.
  const bonusManualOverrideRef = useRef(false);
  const mobileManualOverrideRef = useRef(false);
  const mobileReturnManualOverrideRef = useRef(false);
  const depositManualOverrideRef = useRef(false);
  const depositPaidManualOverrideRef = useRef(false);
  const creditPaidManualOverrideRef = useRef(false);
  const tpeManualOverrideRef = useRef(false);
  const creditManualOverrideRef = useRef(false);
  const offertManualOverrideRef = useRef(false);
  const otherCavePaymentsManualOverrideRef = useRef(false);

  useEffect(() => {
    bonusManualOverrideRef.current = false;
    mobileManualOverrideRef.current = false;
    mobileReturnManualOverrideRef.current = false;
    depositManualOverrideRef.current = false;
    depositPaidManualOverrideRef.current = false;
    creditPaidManualOverrideRef.current = false;
    tpeManualOverrideRef.current = false;
    creditManualOverrideRef.current = false;
    offertManualOverrideRef.current = false;
    otherCavePaymentsManualOverrideRef.current = false;
  }, [calculationRevision]);
  const activePlayers = players.filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index);
  const selectedPlayer = activePlayers.find((player) => (player.ficheId ?? player.id) === selectedPlayerId);
  const identity = identityVerifications[selectedPlayerId];
  const bonusEntries = players
    .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
    .map((player) => {
      const bonuses = parseBonuses(player.bonuses).filter((bonus) => bonus !== '7 et 2');
      const bonusAmounts = parseBonusResults(player.bonusResults);
      const playerId = player.ficheId ?? player.id;
      const total = bonuses.reduce((sum, bonus) => sum + (bonusAmounts[bonus] || 0), 0);
      return total > 0 ? `${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(total)} Ar` : '';
    })
    .filter(Boolean);
  const bonusTotal = bonusEntries.reduce((total, entry) => total + parseCasinoAmount(entry.split(':').pop() || '0'), 0);
  const bonusResults = bonusEntries.length ? bonusEntries.join('\n') : '';
  const mobilePaymentResults = buildNegativePaymentResults(players, 'MVola', 'Orange Money');
  const offertPaymentResults = buildOffertResults(players);
  const creditPaidResults = players
    .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
    .flatMap((player) => {
      const playerId = player.ficheId ?? player.id;
      const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
      const totalCaves = playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
      const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
      const result = cashing - totalCaves;
      const creditPayments = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => payment.option === 'Crédit payé');
      return result > 0 && creditPayments.length
        ? [`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(creditPayments.reduce((sum, payment) => sum + (payment.amount || result), 0))}`]
        : [];
    })
    .join('\n');
  const depositPaidResults = buildNegativePaymentResults(players, 'Dépôt payé');
  const depositPaymentResults = buildPositivePaymentResults(players, 'Dépôt');
  const depositPaymentTotal = getPositivePaymentTotal(players, 'Dépôt');
  const mobileReturnResults = players
    .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
    .flatMap((player) => {
      const playerId = player.ficheId ?? player.id;
      const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
      const totalCaves = playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
      const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
      const result = cashing - totalCaves;
      const mobileMethods = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => payment.option === 'MVola' || payment.option === 'Orange Money');
      return result > 0 && mobileMethods.length
        ? [`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(mobileMethods.reduce((sum, payment) => sum + (payment.amount || result), 0))} (${mobileMethods.map((payment) => payment.option).join(' / ')})`]
        : [];
    })
    .join('\n');

  const bonusFieldValue = bonusManualOverrideRef.current ? values.bonus : bonusResults;
  const mobileReturnTotal = getPositivePaymentTotal(players, 'MVola', 'Orange Money');
  const mobileReturnFieldValue = mobileReturnManualOverrideRef.current ? values.retourMobile : mobileReturnResults;
  const creditPaidTotal = getPositivePaymentTotal(players, 'Crédit payé');
  const depositAutoDisplay = depositPaymentResults || depositResults;
  const depositFieldValue = depositManualOverrideRef.current ? values.depot : depositAutoDisplay;
  const tpeResults = buildNegativePaymentResults(players, 'TPE');
  const depositPaidFieldValue = depositPaidManualOverrideRef.current ? values.depotPaye : depositPaidResults;
  const creditPaidFieldValue = creditPaidManualOverrideRef.current ? values.creditPaye : creditPaidResults;
  const tpePaymentsTotal = getNegativePaymentTotal(players, 'TPE');
  const mobilePaymentsTotal = getNegativePaymentTotal(players, 'MVola', 'Orange Money');
  const depositPaidTotal = getNegativePaymentTotal(players, 'Dépôt payé');
  const paidCaveTpeResults = buildPaidCavePaymentResults(players, ['TPE']);
  const paidCaveMobileResults = buildPaidCavePaymentResults(players, ['MVola', 'Orange Money']);
  const paidCaveCreditResults = buildPaidCavePaymentResults(players, ['Crédit', 'Credit']);
  const paidCaveOffertResults = buildPaidCavePaymentResults(players, ['Offert']);
  const paidCaveOtherResults = buildPaidCavePaymentResults(players, ['Euro', 'Dollar', 'Chèque', 'Cheque', 'Virement']);
  const paidCaveTpeTotal = getPaidCavePaymentTotal(players, ['TPE']);
  const paidCaveMobileTotal = getPaidCavePaymentTotal(players, ['MVola', 'Orange Money']);
  const paidCaveCreditTotal = getPaidCavePaymentTotal(players, ['Crédit', 'Credit']);
  const paidCaveOffertTotal = getPaidCavePaymentTotal(players, ['Offert']);
  const paidCaveOtherTotal = getPaidCavePaymentTotal(players, ['Euro', 'Dollar', 'Chèque', 'Cheque', 'Virement']);
  const tpeDisplay = [tpeResults, paidCaveTpeResults].filter(Boolean).join('\n');
  const tpeFieldValue = tpeManualOverrideRef.current ? values.tpe : tpeDisplay;
  const mobileDisplayValue = mobileManualOverrideRef.current ? values.mobiles : [mobilePaymentResults, paidCaveMobileResults].filter(Boolean).join('\n');
  const creditAutoDisplay = buildCreditResults(players);
  const creditDisplay = creditManualOverrideRef.current ? values.credit : creditAutoDisplay;
  const offertDisplay = uniqueDisplayLines([
    offertManualOverrideRef.current ? values.offert : offertPaymentResults,
  ].filter(Boolean).join('\n'));
  const otherCavePaymentsDisplay = otherCavePaymentsManualOverrideRef.current
    ? values.autresPaiementsCaves || ''
    : paidCaveOtherResults;
  // Valeurs automatiques : on additionne les montants calculés plutôt que de relire
  // le texte affiché (un chiffre dans le nom du joueur fausserait le total).
  const tpeEntryTotal = tpeManualOverrideRef.current
    ? parseCasinoAmount(values.tpe)
    : tpePaymentsTotal + paidCaveTpeTotal;
  const mobileEntryTotal = mobileManualOverrideRef.current
    ? parseCasinoAmount(values.mobiles)
    : mobilePaymentsTotal + paidCaveMobileTotal;
  const bonusEntryTotal = bonusManualOverrideRef.current ? parseCasinoAmount(values.bonus) : bonusTotal;
  const depositEntryTotal = depositManualOverrideRef.current ? parseCasinoAmount(values.depot) : depositPaymentTotal;
  const mobileReturnEntryTotal = mobileReturnManualOverrideRef.current ? parseCasinoAmount(values.retourMobile) : mobileReturnTotal;
  const depositPaidEntryTotal = depositPaidManualOverrideRef.current ? parseCasinoAmount(values.depotPaye) : depositPaidTotal;
  const creditPaidEntryTotal = creditPaidManualOverrideRef.current ? parseCasinoAmount(values.creditPaye) : creditPaidTotal;
  const cashPaymentTotal = getCashPaymentTotal(players);
  const automaticTotal1 = withdrawnTotal
    + parseCasinoAmount(values.pourboires)
    + parseCasinoAmount(values.autres)
    + parseCasinoAmount(values.autre)
    + parseCasinoAmount(values.restaurant)
    + parseCasinoAmount(values.prolongation)
    + depositEntryTotal
    + mobileReturnEntryTotal
    + creditPaidEntryTotal;
  const automaticTotal2 = tpeEntryTotal
    + mobileEntryTotal
    + bonusEntryTotal
    + parseCasinoAmount(creditDisplay)
    + depositPaidEntryTotal
    + parseCasinoAmount(offertDisplay)
    + parseCasinoAmount(otherCavePaymentsDisplay);
  const total1 = automaticTotal1;
  const total2 = automaticTotal2;
  const difference = Math.abs(total2 - total1);
  // Retraits autres départements : caisse espèces négative → on ajoute, positive → on soustrait.
  const otherDepartmentWithdrawalTotal = parseCasinoAmount(values.autres);
  const totalEspeces = cashPaymentTotal < 0
    ? cashPaymentTotal + otherDepartmentWithdrawalTotal
    : cashPaymentTotal - otherDepartmentWithdrawalTotal;
  const resultatFinal = totalEspeces - difference;
  const finalValuesToSave: Record<string, string> = {
    ...values,
    tpe: tpeFieldValue,
    mobiles: mobileDisplayValue,
    bonus: bonusFieldValue,
    credit: creditDisplay,
    depot: depositFieldValue,
    depotPaye: depositPaidFieldValue,
    offert: offertDisplay,
    autresPaiementsCaves: otherCavePaymentsDisplay,
    retourMobile: mobileReturnFieldValue,
    creditPaye: creditPaidFieldValue,
    total1: casinoCurrency.format(total1),
    total2: casinoCurrency.format(total2),
    totalEspecesCaisse: casinoCurrency.format(totalEspeces),
    difference: casinoCurrency.format(difference),
    resultatFinal: casinoCurrency.format(resultatFinal),
    // Valeur brute (non formatée) reprise par le rapport financier du module Finance.
    resultatFinalValue: String(resultatFinal),
  };

  const updateManualValue = (key: string, value: string, overrideRef: React.MutableRefObject<boolean>) => {
    overrideRef.current = true;
    onUpdate(key, value);
  };

  return (
    <div className="text-sm text-primary">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold tracking-[0.18em]">CALCUL FINAL</p>
        <label className="flex items-center gap-2 text-xs font-semibold">Fiche joueur
          {!activePlayers.length ? (
            <select value={0} className="rounded border bg-transparent px-2 py-1 text-primary" style={casinoBorder} disabled>
              <option value={0} aria-label="Aucun joueur en jeu" />
            </select>
          ) : <>
          <select value={selectedPlayerId} onChange={(event) => onPlayerChange(Number(event.target.value))} className="rounded border bg-transparent px-2 py-1 text-primary" style={casinoBorder}>
            {activePlayers.map((player, index) => <option key={player.ficheId ?? player.id} value={player.ficheId ?? player.id}>Fiche {index + 1} — {player.name}</option>)}
          </select>
          </>}
        </label>
      </div>


      <div className="overflow-x-auto">
        <div className="min-w-[760px] border" style={casinoBorder}>
          <div className="grid grid-cols-[1.25fr_.85fr_1.25fr_.85fr]">
            <CalculationCell label="TOTAL PRELEVEMENTS" />
            <CalculationInput value={String(withdrawnTotal)} readOnly />
            <CalculationCell label="TOTAL TPE" separated />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={tpeFieldValue || ''}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const current = textarea.value;
                const cursorIndex = textarea.selectionStart ?? current.length;
                const before = current.slice(0, cursorIndex);
                const after = current.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                tpeManualOverrideRef.current = true;
                onUpdate('tpe', nextValue || current);
                requestAnimationFrame(() => {
                  const nextCursor = before.length + 1;
                  textarea.selectionStart = textarea.selectionEnd = nextCursor;
                });
              }}
              onChange={(event) => {
                tpeManualOverrideRef.current = true;
                onUpdate('tpe', event.target.value);
              }}
            />

            <CalculationCell label="TOTAL POURBOIRES" />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              value={values.pourboires || ''}
              rows={3}
              onChange={(event) => onUpdate('pourboires', event.target.value)}
            />
            <BlankCell separated />
            <BlankCell />

            <CalculationCell label="TOTAL PROLONGATION" />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              value={values.prolongation || ''}
              rows={3}
              onChange={(event) => onUpdate('prolongation', event.target.value)}
            />
            <CalculationCell label="TOTAL MOBILES" separated />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={mobileDisplayValue || ''}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const current = textarea.value;
                const cursorIndex = textarea.selectionStart ?? current.length;
                const before = current.slice(0, cursorIndex);
                const after = current.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                mobileManualOverrideRef.current = true;
                onUpdate('mobiles', nextValue || current);
                requestAnimationFrame(() => {
                  const nextCursor = before.length + 1;
                  textarea.selectionStart = textarea.selectionEnd = nextCursor;
                });
              }}
              onChange={(event) => {
                mobileManualOverrideRef.current = true;
                updateManualValue('mobiles', event.target.value, mobileManualOverrideRef);
              }}
            />

            <CalculationCell label="TOTAL RETRAIT AUTRES DEPARTEMENT" />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              value={values.autres || ''}
              rows={3}
              onChange={(event) => onUpdate('autres', event.target.value)}
            />
            <CalculationCell label="TOTAL BONUS" separated />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={bonusFieldValue || ''}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const current = textarea.value;
                const cursorIndex = textarea.selectionStart ?? current.length;
                const before = current.slice(0, cursorIndex);
                const after = current.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                bonusManualOverrideRef.current = true;
                onUpdate('bonus', nextValue || current);
                requestAnimationFrame(() => {
                  const nextCursor = before.length + 1;
                  textarea.selectionStart = textarea.selectionEnd = nextCursor;
                });
              }}
              onChange={(event) => {
                bonusManualOverrideRef.current = true;
                updateManualValue('bonus', event.target.value, bonusManualOverrideRef);
              }}
            />

            <CalculationCell label="TOTAL RESTAURANT PAYE" />
            <div className="min-h-20 border-r border-b px-3 py-2" style={casinoBorder}>
              <textarea
                className="w-full min-w-0 resize-y border bg-transparent px-2 py-1 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
                style={casinoBorder}
                inputMode="text"
                rows={3}
                value={values.restaurant || ''}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.shiftKey) return;
                  event.preventDefault();
                  const textarea = event.currentTarget;
                  const text = textarea.value;
                  const cursorIndex = textarea.selectionStart ?? text.length;
                  const before = text.slice(0, cursorIndex);
                  const after = text.slice(cursorIndex);
                  onUpdate('restaurant', `${before}\n${after}`);
                  requestAnimationFrame(() => {
                    textarea.selectionStart = textarea.selectionEnd = cursorIndex + 1;
                  });
                }}
                onChange={(event) => onUpdate('restaurant', event.target.value)}
              />
            </div>
            <CalculationCell label="TOTAL OFFERT" separated />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={offertDisplay || ''}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const current = textarea.value;
                const cursorIndex = textarea.selectionStart ?? current.length;
                const before = current.slice(0, cursorIndex);
                const after = current.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                updateManualValue('offert', nextValue || current, offertManualOverrideRef);
                requestAnimationFrame(() => {
                  const nextCursor = before.length + 1;
                  textarea.selectionStart = textarea.selectionEnd = nextCursor;
                });
              }}
              onChange={(event) => updateManualValue('offert', event.target.value, offertManualOverrideRef)}
            />

            <CalculationCell label="AUTRE" />
            <CalculationInput value={values.autre} onChange={(value) => onUpdate('autre', value)} />
            <CalculationCell label="CREDIT" separated />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={creditDisplay || ''}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const current = textarea.value;
                const cursorIndex = textarea.selectionStart ?? current.length;
                const before = current.slice(0, cursorIndex);
                const after = current.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                creditManualOverrideRef.current = true;
                onUpdate('credit', nextValue || current);
                requestAnimationFrame(() => {
                  const nextCursor = before.length + 1;
                  textarea.selectionStart = textarea.selectionEnd = nextCursor;
                });
              }}
              onChange={(event) => {
                creditManualOverrideRef.current = true;
                onUpdate('credit', event.target.value);
              }}
            />

            <CalculationCell label="DEPOT" />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={depositFieldValue || ''}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const current = textarea.value;
                const cursorIndex = textarea.selectionStart ?? current.length;
                const before = current.slice(0, cursorIndex);
                const after = current.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                depositManualOverrideRef.current = true;
                updateManualValue('depot', nextValue || current, depositManualOverrideRef);
                requestAnimationFrame(() => {
                  const nextCursor = before.length + 1;
                  textarea.selectionStart = textarea.selectionEnd = nextCursor;
                });
              }}
              onChange={(event) => {
                updateManualValue('depot', event.target.value, depositManualOverrideRef);
              }}
            />
            <CalculationCell label="DEPOT PAYE" separated />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={depositPaidFieldValue || ''}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const current = textarea.value;
                const cursorIndex = textarea.selectionStart ?? current.length;
                const before = current.slice(0, cursorIndex);
                const after = current.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                depositPaidManualOverrideRef.current = true;
                updateManualValue('depotPaye', nextValue || current, depositPaidManualOverrideRef);
                requestAnimationFrame(() => {
                  const nextCursor = before.length + 1;
                  textarea.selectionStart = textarea.selectionEnd = nextCursor;
                });
              }}
              onChange={(event) => {
                updateManualValue('depotPaye', event.target.value, depositPaidManualOverrideRef);
              }}
            />

            <CalculationCell label="RETOUR MOBILE" />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={mobileReturnFieldValue || ''}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const current = textarea.value;
                const cursorIndex = textarea.selectionStart ?? current.length;
                const before = current.slice(0, cursorIndex);
                const after = current.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                mobileReturnManualOverrideRef.current = true;
                onUpdate('retourMobile', nextValue || current);
                requestAnimationFrame(() => {
                  const nextCursor = before.length + 1;
                  textarea.selectionStart = textarea.selectionEnd = nextCursor;
                });
              }}
              onChange={(event) => {
                mobileReturnManualOverrideRef.current = true;
                updateManualValue('retourMobile', event.target.value, mobileReturnManualOverrideRef);
              }}
            />
            <BlankCell separated />
            <BlankCell separated />

            <CalculationCell label="CREDIT PAYE" />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={creditPaidFieldValue || ''}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const current = textarea.value;
                const cursorIndex = textarea.selectionStart ?? current.length;
                const before = current.slice(0, cursorIndex);
                const after = current.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                creditPaidManualOverrideRef.current = true;
                onUpdate('creditPaye', nextValue || current);
                requestAnimationFrame(() => {
                  const nextCursor = before.length + 1;
                  textarea.selectionStart = textarea.selectionEnd = nextCursor;
                });
              }}
              onChange={(event) => {
                creditPaidManualOverrideRef.current = true;
                updateManualValue('creditPaye', event.target.value, creditPaidManualOverrideRef);
              }}
            />
            <BlankCell />
            <BlankCell />

            <BlankCell />
            <BlankCell />
            <CalculationCell label="AUTRES PAIEMENTS CAVES" separated />
            <textarea
              className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
              style={casinoBorder}
              inputMode="text"
              rows={3}
              value={otherCavePaymentsDisplay}
              onChange={(event) => {
                otherCavePaymentsManualOverrideRef.current = true;
                onUpdate('autresPaiementsCaves', event.target.value);
              }}
            />

            <TotalCell label="TOTAL 1" />
            <CalculationInput value={casinoCurrency.format(total1)} onChange={(value) => onUpdate('total1', value)} />
            <TotalCell label="TOTAL 2" separated />
            <CalculationInput value={casinoCurrency.format(total2)} readOnly />
          </div>

          <div className="grid grid-cols-[1.35fr_.85fr_1.2fr] border-t" style={casinoBorder}>
            <div className="border-r" style={casinoBorder}>
              <BottomRow label="TOTAL 2 - TOTAL 1" value={casinoCurrency.format(difference)} readOnly />
              <BottomRow label="TOTAL ESPECES CAISSE" value={casinoCurrency.format(totalEspeces)} readOnly />
              <BottomRow label="RESULTAT FINAL" value={casinoCurrency.format(resultatFinal)} readOnly />
            </div>
            <div className="border-r" style={casinoBorder}>
              <BlankBottomRow />
              <BlankBottomRow />
              <BlankBottomRow />
            </div>
            <div className="flex min-h-36 flex-col gap-3 p-3 text-xs font-semibold">
              <label className="flex flex-col gap-2">
                Observation
                <textarea
                  className="min-h-[80px] w-full resize-y rounded border bg-transparent px-2 py-2 text-xs text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
                  style={casinoBorder}
                  value={values.observation || ''}
                  onChange={(event) => onUpdate('observation', event.target.value)}
                  placeholder="Observation sur le calcul final"
                />
              </label>
              <label className="flex flex-col gap-2">
                Signature Responsable
                <TouchSignature value={values.signature || ''} onChange={(value) => onUpdate('signature', value)} />
              </label>
            </div>
          </div>
        </div>
      </div>
      {showIdentityVerifications && identity && (
        <div className="mt-4 rounded-xl border p-3 text-[11px]" style={{ backgroundColor: 'var(--color-bg)', ...casinoBorder }}>
          <p className="mb-2 font-bold text-yellow-300">VÉRIFICATION D'IDENTITÉ — {identity.transaction_type.toUpperCase()}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted">Joueur :</span>
            <span className="font-semibold">{identity.full_name}</span>
            <span className="text-muted">Pièce d'identité :</span>
            <span className="font-semibold">{identity.id_type} n° {identity.id_number}</span>
            <span className="text-muted">Date d'émission :</span>
            <span className="font-semibold">{identity.issue_date}</span>
            <span className="text-muted">Montant :</span>
            <span className="font-semibold text-yellow-300">{casinoCurrency.format(identity.amount)} Ar</span>
            <span className="text-muted">Vérifié le :</span>
            <span className="font-semibold">{new Date(identity.verified_at).toLocaleString('fr-FR')}</span>
          </div>
        </div>
      )}
      <div className="mt-4 flex items-center justify-end gap-3 print:hidden">
        {saveState === 'saved' && <span className="text-xs text-green-700">Enregistré</span>}
        {saveState === 'error' && <span className="text-xs text-red-700">Erreur d’enregistrement</span>}
        <button type="button" className="action inline-flex items-center gap-2" onClick={() => onSave(finalValuesToSave)} disabled={saveState === 'saving'}>
          {saveState === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveState === 'saving' ? 'Enregistrement...' : 'Enregistrer le calcul'}
        </button>
      </div>
    </div>
  );
};

const CalculationCell: React.FC<{ label: string; separated?: boolean }> = ({ label, separated = false }) => (
  <div className={`min-h-20 border-r border-b p-3 flex items-center font-semibold text-[11px] leading-tight${separated ? ' border-l-4' : ''}`} style={casinoBorder}>{label}</div>
);

const CalculationInput: React.FC<{ value?: string; onChange?: (value: string) => void; readOnly?: boolean; inputMode?: 'decimal' | 'text'; multiline?: boolean; rows?: number }> = ({ value = '', onChange, readOnly = false, inputMode = 'decimal', multiline = false, rows = 3 }) => {
  if (multiline) {
    return (
      <textarea
        className="min-h-20 w-full min-w-0 resize-y border-r border-b bg-transparent px-3 py-2 text-base text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]"
        style={casinoBorder}
        inputMode={inputMode}
        value={value}
        readOnly={readOnly}
        rows={rows}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || readOnly) return;
          event.preventDefault();
          const nextValue = value ? `${value}\n. ` : '. ';
          onChange?.(nextValue);
          requestAnimationFrame(() => {
            const textarea = event.currentTarget;
            textarea.selectionStart = textarea.selectionEnd = nextValue.length;
          });
        }}
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  }

  return (
    <input className="min-h-20 w-full min-w-0 border-r border-b bg-transparent px-3 text-base text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]" style={casinoBorder} inputMode={inputMode} value={value} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} />
  );
};

const CalculationResult: React.FC<{ value: string }> = ({ value }) => (
  <div className="min-h-20 border-r border-b px-3 py-2" style={casinoBorder}>
    <div className="whitespace-pre-wrap text-[11px] font-semibold text-primary">{value || '—'}</div>
  </div>
);

const EmptyPaymentPlayersModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="payment-confirmation-title">
    <div className="w-full max-w-md rounded-2xl border p-5 shadow-2xl" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
      <h2 id="payment-confirmation-title" className="text-lg font-bold text-primary">Validation du paiement</h2>
      <p className="mt-3 text-sm text-muted">Aucun joueur n’est inscrit dans cette partie pour le moment.</p>
      <div className="mt-5 flex justify-end">
        <button type="button" className="action secondary" onClick={onClose}>Fermer</button>
      </div>
    </div>
  </div>
);

const PlayerPaymentConfirmationModal: React.FC<{
  players: PlayerLine[];
  onClose: () => void;
  onConfirm: (entries: Array<{
    id: number;
    name: string;
    deposit: number;
    credit: number;
    depositStatus: string;
    creditStatus: string;
    depositAmount: string;
    creditAmount: string;
    lossAmount: string;
    depositMethod: string;
    creditMethod: string;
  }>) => void;
}> = ({ players, onClose, onConfirm }) => {
  const [playerStates, setPlayerStates] = useState(() => players.map((player) => ({
    id: player.ficheId ?? player.id,
    name: player.name || `Joueur ${player.ficheId ?? player.id}`,
    deposit: parseCasinoAmount(player.initialDeposit),
    credit: parseCasinoAmount(player.initialCredit),
    depositStatus: '',
    creditStatus: '',
    depositAmount: '',
    creditAmount: '',
    lossAmount: '',
    depositMethod: 'Espèces',
    creditMethod: 'Crédit',
  })));

  useEffect(() => {
    setPlayerStates(players.map((player) => ({
      id: player.ficheId ?? player.id,
      name: player.name || `Joueur ${player.ficheId ?? player.id}`,
      deposit: parseCasinoAmount(player.initialDeposit),
      credit: parseCasinoAmount(player.initialCredit),
      depositStatus: '',
      creditStatus: '',
      depositAmount: '',
      creditAmount: '',
      lossAmount: '',
      depositMethod: 'Espèces',
      creditMethod: 'Crédit',
    })));
  }, [players]);

  const updateEntry = (playerId: number, field: 'depositStatus' | 'creditStatus' | 'depositAmount' | 'creditAmount' | 'lossAmount' | 'depositMethod' | 'creditMethod', value: string) => {
    setPlayerStates((current) => current.map((entry) => entry.id === playerId ? { ...entry, [field]: value } : entry));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="payment-confirmation-title">
      <div className="w-full max-w-5xl rounded-2xl border p-5 shadow-2xl" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="payment-confirmation-title" className="text-lg font-bold text-primary">Validation du paiement</h2>
            <p className="mt-1 text-sm text-muted">Liste des joueurs actifs pour le dépôt et le crédit.</p>
          </div>
          <button type="button" className="action secondary" onClick={onClose}>Fermer</button>
        </div>

        <div className="mt-5 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {playerStates.map((entry) => (
            <div key={entry.id} className="rounded-xl border p-3" style={casinoBorder}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-primary">{entry.name}</p>
                <span className="rounded-full border border-yellow-400/40 bg-yellow-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-yellow-300">Joueur actif</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <PaymentStatusRow
                  label="Dépôt de la partie"
                  amount={entry.deposit}
                  status={entry.depositStatus}
                  amountValue={entry.depositAmount}
                  extraAmountValue={entry.lossAmount}
                  paymentMethod={entry.depositMethod}
                  showExtraAmount={entry.deposit > 0}
                  extraAmountLabel="Montant perdu"
                  onStatusChange={(status) => updateEntry(entry.id, 'depositStatus', status)}
                  onAmountChange={(value) => updateEntry(entry.id, 'depositAmount', value)}
                  onExtraAmountChange={(value) => updateEntry(entry.id, 'lossAmount', value)}
                  onMethodChange={(value) => updateEntry(entry.id, 'depositMethod', value)}
                />
                <PaymentStatusRow
                  label="Crédit de la partie"
                  amount={entry.credit}
                  status={entry.creditStatus}
                  amountValue={entry.creditAmount}
                  paymentMethod={entry.creditMethod}
                  onStatusChange={(status) => updateEntry(entry.id, 'creditStatus', status)}
                  onAmountChange={(value) => updateEntry(entry.id, 'creditAmount', value)}
                  onMethodChange={(value) => updateEntry(entry.id, 'creditMethod', value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="action secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="action" onClick={() => onConfirm(playerStates)}>Enregistrer le calcul</button>
        </div>
      </div>
    </div>
  );
};

const PaymentStatusRow: React.FC<{
  label: string;
  amount: number;
  status: string;
  amountValue: string;
  extraAmountValue?: string;
  paymentMethod: string;
  showExtraAmount?: boolean;
  extraAmountLabel?: string;
  onStatusChange: (status: 'Payé' | 'Non payé') => void;
  onAmountChange: (amount: string) => void;
  onExtraAmountChange?: (amount: string) => void;
  onMethodChange: (method: string) => void;
}> = ({ label, amount, status, amountValue, extraAmountValue = '', paymentMethod, showExtraAmount = false, extraAmountLabel = 'Montant additionnel', onStatusChange, onAmountChange, onExtraAmountChange, onMethodChange }) => {
  const displayedAmount = parseCasinoAmount(amountValue || String(amount)) || amount;

  return (
    <div className="rounded-xl border p-3" style={casinoBorder}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-primary">{label}</p>
          <p className="mt-1 text-sm font-bold text-yellow-300">{casinoCurrency.format(amount)} Ar</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={`rounded-lg border px-3 py-2 text-xs font-semibold ${status === 'Payé' ? 'border-green-400 bg-green-500/20 text-green-300' : 'text-primary'}`} style={casinoBorder} onClick={() => onStatusChange('Payé')}>Payé</button>
          <button type="button" className={`rounded-lg border px-3 py-2 text-xs font-semibold ${status === 'Non payé' ? 'border-red-400 bg-red-500/20 text-red-300' : 'text-primary'}`} style={casinoBorder} onClick={() => onStatusChange('Non payé')}>Non payé</button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr]">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Mode de paiement
          <select
            value={paymentMethod}
            onChange={(event) => onMethodChange(event.target.value)}
            className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2 text-sm text-primary outline-none"
            style={casinoBorder}
          >
            <option value="Espèces">Espèces</option>
            <option value="TPE">TPE</option>
            <option value="Orange Money">Orange Money</option>
            <option value="MVola">MVola</option>
            <option value="Virement">Virement</option>
            <option value="Crédit">Crédit</option>
            <option value="Autre">Autre</option>
          </select>
        </label>

        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Montant manuel
          <textarea
            rows={3}
            inputMode="decimal"
            value={amountValue}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return;
              event.preventDefault();
              const textarea = event.currentTarget;
              const text = textarea.value;
              const cursorIndex = textarea.selectionStart ?? text.length;
              const before = text.slice(0, cursorIndex);
              const after = text.slice(cursorIndex);
              const nextValue = `${before}\n${after}`;
              onAmountChange(nextValue || text);
              requestAnimationFrame(() => {
                textarea.selectionStart = textarea.selectionEnd = cursorIndex + 1;
              });
            }}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2 text-sm text-primary outline-none placeholder:text-muted"
            style={casinoBorder}
          />
        </label>
      </div>

      {showExtraAmount && onExtraAmountChange && (
        <div className="mt-3">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            {extraAmountLabel}
            <textarea
              rows={3}
              inputMode="decimal"
              value={extraAmountValue}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                const textarea = event.currentTarget;
                const text = textarea.value;
                const cursorIndex = textarea.selectionStart ?? text.length;
                const before = text.slice(0, cursorIndex);
                const after = text.slice(cursorIndex);
                const nextValue = `${before}\n${after}`;
                onExtraAmountChange?.(nextValue || text);
                requestAnimationFrame(() => {
                  textarea.selectionStart = textarea.selectionEnd = cursorIndex + 1;
                });
              }}
              onChange={(event) => onExtraAmountChange?.(event.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-lg border bg-transparent px-2 py-2 text-sm text-primary outline-none placeholder:text-muted"
              style={casinoBorder}
            />
          </label>
        </div>
      )}

      <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-2 py-2 text-[11px] text-yellow-200">
        <span className="font-semibold">Montant + mode :</span> {casinoCurrency.format(displayedAmount)} Ar — {paymentMethod}
      </div>
    </div>
  );
};

const parseBonuses = (value?: string): string[] => {
  try {
    const bonuses = JSON.parse(value || '[]');
    return Array.isArray(bonuses) ? bonuses.filter((bonus): bonus is string => typeof bonus === 'string') : [];
  } catch {
    return [];
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

const parsePaymentOptions = (value?: string): Array<{ option: string; amount: number }> => {
  try {
    const options = JSON.parse(value || '[]');
    return Array.isArray(options) ? options.flatMap((option) => {
      if (typeof option === 'string') return [{ option, amount: 0 }];
      return option && typeof option.option === 'string' ? [{ option: option.option, amount: Number(option.amount) || 0 }] : [];
    }) : [];
  } catch {
    return [];
  }
};

const isCashPaymentOption = (option: string) => {
  const normalized = option.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return normalized === 'espece' || normalized === 'especes' || normalized === 'cash';
};

const uniquePlayerLines = (players: PlayerLine[]) => players.filter((player, index, lines) =>
  lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index
);

const getCashPaymentTotal = (players: PlayerLine[]) => uniquePlayerLines(players).reduce((total, player) => {
  const playerId = player.ficheId ?? player.id;
  const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
  const totalCaves = playerLines.reduce((sum, line) => sum + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
  const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
  const result = cashing - totalCaves;
  if (result === 0) return total;
  const payments = parsePaymentOptions(player.resultPaymentOptions);
  const cashPayments = payments.filter((payment) => isCashPaymentOption(payment.option));
  if (!cashPayments.length) return total;
  // Espèce seule : tout le résultat passe en caisse.
  // Plusieurs règlements (ex. Espèce + TPE) : seul le montant saisi en Espèce compte.
  const amount = payments.length === 1
    ? Math.abs(result)
    : cashPayments.reduce((sum, payment) => sum + Math.max(0, payment.amount), 0);
  // Résultat négatif : le joueur paie, la caisse augmente.
  // Résultat positif : le casino paie le joueur, la caisse diminue.
  return result < 0 ? total + amount : total - amount;
}, 0);

const isPaidCave = (payment?: string) => {
  const normalized = String(payment || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  // Accepte aussi les anciennes fiches enregistrées avec « PayÃ© ».
  return normalized.startsWith('pay') && !normalized.includes('non');
};

const buildOffertResults = (players: PlayerLine[]): string => {
  const results: string[] = [];
  const uniquePlayers = players.filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index);

  uniquePlayers.forEach((player) => {
    const playerId = player.ficheId ?? player.id;
    const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
    const totalCaves = playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
    const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
    const result = cashing - totalCaves;
    const offertPayments = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => payment.option === 'Offert');

    if (result < 0 && offertPayments.length) {
      const amount = offertPayments.some((payment) => payment.amount > 0)
        ? offertPayments.reduce((sum, payment) => sum + payment.amount, 0)
        : Math.abs(result);
      results.push(`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(amount)} Ar (Offert)`);
      return;
    }

    const offeredCaves = playerLines
      .filter((line) => isPaidCave(line.payment) && line.paymentMethod.trim() === 'Offert')
      .reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
    if (offeredCaves > 0) {
      results.push(`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(offeredCaves)} Ar (Offert)`);
    }
  });

  return results.join('\n');
};

const uniqueDisplayLines = (value: string): string => {
  const seen = new Set<string>();
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .join('\n');
};

const buildCreditResults = (players: PlayerLine[]): string => {
  const results: string[] = [];
  const uniquePlayers = players.filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index);

  uniquePlayers.forEach((player) => {
    const playerId = player.ficheId ?? player.id;
    const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
    const totalCaves = playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
    const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
    const result = cashing - totalCaves;
    const creditPayments = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => payment.option === 'Crédit');

    if (result < 0 && creditPayments.length) {
      const amount = creditPayments.some((payment) => payment.amount > 0)
        ? creditPayments.reduce((sum, payment) => sum + payment.amount, 0)
        : Math.abs(result);
      results.push(`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(amount)} Ar (Crédit)`);
      return;
    }

    const creditCaves = playerLines
      .filter((line) => isPaidCave(line.payment) && ['Crédit', 'Credit'].includes(line.paymentMethod.trim()))
      .reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
    if (creditCaves > 0) {
      results.push(`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(creditCaves)} Ar (Crédit)`);
    }
  });

  return results.join('\n');
};

const getPaidCavePaymentTotal = (players: PlayerLine[], methods?: string[]): number => players.reduce(
  (total, line) => isPaidCave(line.payment) && line.paymentMethod.trim() && (!methods || methods.includes(line.paymentMethod.trim()))
    ? total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount)
    : total,
  0,
);

const buildPaidCavePaymentResults = (players: PlayerLine[], methods?: string[]): string => {
  const payments: Array<{ name: string; amount: number; method: string }> = [];
  players.forEach((line) => {
    const amount = parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount);
    const method = line.paymentMethod.trim();
    if (!isPaidCave(line.payment) || !method || amount <= 0 || (methods && !methods.includes(method))) return;
    payments.push({ name: line.name || `Joueur ${line.ficheId ?? line.id}`, amount, method });
  });
  return payments
    .map(({ name, amount, method }) => `${name} : ${casinoCurrency.format(amount)} Ar (${method})`)
    .join('\n');
};

const buildNegativePaymentResults = (players: PlayerLine[], ...methods: string[]): string => players
  .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
  .flatMap((player) => {
    const playerId = player.ficheId ?? player.id;
    const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
    const totalCaves = playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
    const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
    const result = cashing - totalCaves;
    const selectedMethods = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => methods.includes(payment.option));
    const amount = selectedMethods.some((payment) => payment.amount > 0)
      ? selectedMethods.reduce((sum, payment) => sum + payment.amount, 0)
      : Math.abs(result);
    return result < 0 && selectedMethods.length
      ? [`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(amount)} (${selectedMethods.map((payment) => payment.option).join(' / ')})`]
      : [];
  })
  .join('\n');

const getNegativePaymentTotal = (players: PlayerLine[], ...methods: string[]): number => players
  .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
  .reduce((total, player) => {
    const playerId = player.ficheId ?? player.id;
    const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
    const totalCaves = playerLines.reduce((sum, line) => sum + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
    const result = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing) - totalCaves;
    const payments = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => methods.includes(payment.option));
    const amount = payments.some((payment) => payment.amount > 0)
      ? payments.reduce((sum, payment) => sum + payment.amount, 0)
      : Math.abs(result);
    return result < 0 && payments.length ? total + amount : total;
  }, 0);

const getPositivePaymentTotal = (players: PlayerLine[], ...methods: string[]): number => players
  .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
  .reduce((total, player) => {
    const playerId = player.ficheId ?? player.id;
    const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
    const totalCaves = playerLines.reduce((sum, line) => sum + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
    const result = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing) - totalCaves;
    const payments = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => methods.includes(payment.option));
    return result > 0 && payments.length ? total + payments.reduce((sum, payment) => sum + (payment.amount || result), 0) : total;
  }, 0);

const buildPositivePaymentResults = (players: PlayerLine[], ...methods: string[]): string => players
  .filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index)
  .flatMap((player) => {
    const playerId = player.ficheId ?? player.id;
    const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
    const totalCaves = playerLines.reduce((total, line) => total + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
    const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
    const result = cashing - totalCaves;
    const payments = parsePaymentOptions(player.resultPaymentOptions).filter((payment) => methods.includes(payment.option));
    return result > 0 && payments.length
      ? [`${player.name || `Joueur ${playerId}`} : ${casinoCurrency.format(payments.reduce((sum, payment) => sum + (payment.amount || result), 0))} (${payments.map((payment) => payment.option).join(' / ')})`]
      : [];
  })
  .join('\n');

const BlankCell: React.FC<{ separated?: boolean }> = ({ separated = false }) => <div className={`min-h-20 border-r border-b${separated ? ' border-l-4' : ''}`} style={casinoBorder} />;
const TotalCell: React.FC<{ label: string; separated?: boolean }> = ({ label, separated = false }) => <div className={`min-h-14 border-r p-2 flex items-center justify-center font-bold text-[11px]${separated ? ' border-l-4' : ''}`} style={casinoBorder}>{label}</div>;
const BottomRow: React.FC<{ label: string; value?: string; onChange?: (value: string) => void; readOnly?: boolean }> = ({ label, value = '', onChange, readOnly = false }) => <label className="grid grid-cols-[1fr_.85fr] min-h-12 border-b last:border-b-0" style={casinoBorder}><span className="px-2 py-2 font-semibold text-center border-r flex items-center justify-center text-[10px] leading-tight" style={casinoBorder}>{label}</span><input className="w-full min-w-0 bg-transparent px-2 text-[11px] text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-accent)]" inputMode="decimal" value={value} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} /></label>;
const BlankBottomRow: React.FC = () => <div className="min-h-12 border-b last:border-b-0" style={casinoBorder} />;

const TouchSignature: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(Boolean(value));
    if (!value.startsWith('data:image/')) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = value;
  }, [value]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * (event.currentTarget.width / bounds.width), y: (event.clientY - bounds.top) * (event.currentTarget.height / bounds.height) };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const point = getPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingRef.current = true;
  };
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };
  const finish = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const nextValue = canvasRef.current?.toDataURL('image/png') || '';
    setHasSignature(Boolean(nextValue));
    onChange(nextValue);
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange('');
  };

  return <div className="flex flex-1 items-start gap-2"><canvas ref={canvasRef} width={280} height={96} aria-label="Signature tactile responsable" className="min-h-20 flex-1 rounded border bg-white touch-none" style={{ borderColor: 'var(--color-border)', touchAction: 'none', cursor: 'crosshair' }} onPointerDown={start} onPointerMove={draw} onPointerUp={finish} onPointerCancel={finish} onPointerLeave={finish} />{hasSignature && <button type="button" className="text-[10px] text-muted print:hidden" onClick={clear}>Effacer</button>}</div>;
};
