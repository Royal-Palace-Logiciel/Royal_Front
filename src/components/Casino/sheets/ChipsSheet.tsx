import React, { useState, useEffect } from 'react';
import { ChipLine, PlayerLine, RackCheck, casinoBorder, casinoCurrency, casinoInput, IDENTITY_VERIFICATION_THRESHOLD, IdentityVerificationData, parseCasinoAmount } from './types';
import { IdentityVerificationModal } from './IdentityVerificationModal';
import { identityVerificationApi } from '../../../services/casinoTablesJeu.service';

interface ChipsSheetProps {
  date: string;
  chips: ChipLine[];
  rackChecks: RackCheck[];
  players: PlayerLine[];
  endGameTime: string;
  openingTotal: number;
  closingTotal: number;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  onUpdate: (value: number, key: keyof Omit<ChipLine, 'value'>, content: string) => void;
  onEndGameTimeChange: (value: string) => void;
  onSave: () => void;
  onRackChecksChange: (checks: RackCheck[]) => void;
}

export const ChipsSheet: React.FC<ChipsSheetProps> = ({ date, chips, players, rackChecks, endGameTime, openingTotal, closingTotal, saveState = 'idle', onUpdate, onEndGameTimeChange, onSave, onRackChecksChange }) => {
  const [identityModal, setIdentityModal] = useState<{ open: boolean; amount: number }>({ open: false, amount: 0 });
  const withdrawnTotal = chips.reduce((sum, line) => sum + line.value * parseCasinoAmount(line.withdrawn), 0);
  const playersWithStartTime = players.filter((player) => Boolean(player.name.trim() || player.caves.trim() || player.amount.trim()) && Boolean(player.time || player.arrival));
  // Premier joueur ajouté via « Play » (ordre d'ajout) : son heure de play = heure d'arrivée du jeu.
  const firstPlayedPlayer = players.find((player) => player.casinoPlayerGameId && getTimeMinutes(player.time) !== null);
  const firstPlayer = firstPlayedPlayer || getEarliestPlayer(playersWithStartTime) || getEarliestPlayer(players);
  const firstArrival = firstPlayer?.time || firstPlayer?.arrival || '';

  useEffect(() => {
    if (withdrawnTotal >= IDENTITY_VERIFICATION_THRESHOLD && firstPlayer) {
      setIdentityModal({ open: true, amount: withdrawnTotal });
    }
  }, [withdrawnTotal, firstPlayer]);

  useEffect(() => {
    const addScheduledRackCheck = () => {
      const now = new Date();
      if (now.getMinutes() % 30 !== 0) return;
      const time = now.toTimeString().slice(0, 5);
      const alreadyAdded = rackChecks.some((check) => check.type === 'Rack check périodique' && check.date === date && check.time === time);
      if (alreadyAdded) return;
      onRackChecksChange([...rackChecks, {
        id: Date.now(),
        date,
        time,
        type: 'Rack check périodique',
        expected: 220000,
        actual: '',
        missing: '',
        verified: false,
        variance: '',
        croupierEntrant: '',
        croupierSortant: '',
        validatedBy: '',
        validatedAt: '',
      }]);
    };
    addScheduledRackCheck();
    const interval = window.setInterval(addScheduledRackCheck, 30000);
    return () => window.clearInterval(interval);
  }, [date, rackChecks, onRackChecksChange]);

  const saveExchangeVerification = async (data: IdentityVerificationData) => {
    if (!firstPlayer) return;
    try {
      await identityVerificationApi.create({
        fiche_id: firstPlayer.ficheId ?? firstPlayer.id,
        full_name: data.fullName,
        id_type: data.idType,
        id_number: data.idNumber,
        issue_date: data.issueDate,
        transaction_type: data.transactionType.toUpperCase() as 'ACHAT' | 'APPORT' | 'ECHANGE',
        amount: data.amount,
      });
      setIdentityModal({ open: false, amount: 0 });
    } catch (error) {
      const apiError = error as { response?: { data?: { error?: { message?: string } | string } } };
      const responseError = apiError.response?.data?.error;
      alert(typeof responseError === 'string' ? responseError : responseError?.message || 'Erreur lors de l’enregistrement de la vérification.');
    }
  };

  return (
  <div className="flex flex-col gap-7">
    <section><SheetTitle title="Fiche Poker Night — jetons" subtitle="Comptage de départ et de fermeture." /><ChipTable chips={chips} onUpdate={onUpdate} fields={['previous', 'opening', 'closing']} headers={['Valeur des jetons', 'Total de la veille', 'Valeur départ', 'Total fermeture']} /><div className="grid gap-2 mt-3 sm:grid-cols-2"><Stat label="VALEUR DÉPART" value={openingTotal} />
    <Stat label="VALEUR FERMETURE" value={closingTotal} /></div></section>
    <section><SheetTitle title="Total des prélèvements" subtitle="Nombre de jetons prélevés pour chaque valeur." /><ChipTable chips={chips} onUpdate={onUpdate} fields={['withdrawn']} headers={['Valeur des jetons', 'Nombre de jetons', 'Valeur totale']} /></section>
    <RackCheckSection date={date} checks={rackChecks} players={players} openingTotal={openingTotal} cashExpected={getCashExpected(players)} onChange={onRackChecksChange} />
    <section>
      <SheetTitle title="Horaires de la session" subtitle="L'heure du premier joueur est automatique; l'heure de fin de jeu est à saisir." />
      <SessionTimeTable firstArrival={firstArrival} endGameTime={endGameTime} withdrawnTotal={withdrawnTotal} onEndGameTimeChange={onEndGameTimeChange} />
    </section>
    <div className="grid gap-2 sm:grid-cols-2">
      <Stat label="RESULTAT DES PRELEVEMENTS" value={withdrawnTotal} />
      <label className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg)', ...casinoBorder }}>
        <span className="block text-muted text-[11px]">JOUEURS</span>
        <input className={casinoInput} value={players.filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index).map((player) => player.name.trim()).filter(Boolean).join(' - ')} readOnly placeholder="Nom - Nom" />
      </label>
    </div>
    <div className="flex items-center justify-end gap-3 print:hidden">
      {saveState === 'saved' && <span className="text-xs text-green-700">Enregistré</span>}
      {saveState === 'error' && <span className="text-xs text-red-700">Erreur d’enregistrement</span>}
      <button type="button" className="action" onClick={() => onSave()} disabled={saveState === 'saving'}>{saveState === 'saving' ? 'Enregistrement...' : 'Enregistrer les jetons'}</button>
    </div>
    <IdentityVerificationModal
      open={identityModal.open}
      amount={identityModal.amount}
      transactionType="echange"
      onClose={() => setIdentityModal({ open: false, amount: 0 })}
      onConfirm={saveExchangeVerification}
    />
  </div>
  );
};

const normalizePaymentOption = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const parsePlayerPayments = (value: string): Array<{ option: string; amount: number }> => {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (typeof entry === 'string') return [{ option: entry, amount: 0 }];
      return entry && typeof entry.option === 'string' ? [{ option: entry.option, amount: Number(entry.amount) || 0 }] : [];
    });
  } catch {
    return [];
  }
};

const getCashExpected = (players: PlayerLine[]) => players.filter((player, index, lines) => lines.findIndex((line) => (line.ficheId ?? line.id) === (player.ficheId ?? player.id)) === index).reduce((total, player) => {
  const playerId = player.ficheId ?? player.id;
  const playerLines = players.filter((line) => (line.ficheId ?? line.id) === playerId);
  const totalCaves = playerLines.reduce((sum, line) => sum + parseCasinoAmount(line.caves) * parseCasinoAmount(line.amount), 0);
  const cashing = parseCasinoAmount(playerLines.find((line) => line.cashing.trim())?.cashing);
  const result = Math.abs(cashing - totalCaves);
  const cashPayments = parsePlayerPayments(player.resultPaymentOptions).filter((payment) => ['espece', 'especes', 'cash'].includes(normalizePaymentOption(payment.option)));
  if (!cashPayments.length) return total;
  const explicitAmount = cashPayments.reduce((sum, payment) => sum + Math.max(0, payment.amount), 0);
  return total + (explicitAmount > 0 ? explicitAmount : cashPayments.length === 1 ? result : 0);
}, 0);

const RackCheckSection: React.FC<{ date: string; checks: RackCheck[]; players: PlayerLine[]; openingTotal: number; cashExpected: number; onChange: (checks: RackCheck[]) => void }> = ({ date, checks, players, openingTotal, cashExpected, onChange }) => {
  const caveTotal = players.reduce((total, player) => total + parseCasinoAmount(player.caves) * parseCasinoAmount(player.amount), 0);
  const movementAmount = (check: RackCheck) => {
    if (check.type === 'Retour croupier' || check.type === 'Rack check entrée') return 220000;
    if (check.type === 'Sortie croupier' || check.type === 'Sortie' || check.type === 'Rack check sortie') return -220000;
    if (check.type === 'Rajout bureau') return parseCasinoAmount(check.amount);
    return 0;
  };
  const isRackCheck = (check: RackCheck) => check.type === 'Rack check entrée' || check.type === 'Rack check sortie' || check.type === 'Rack check périodique' || check.type === 'Retour croupier' || check.type === 'Sortie croupier';
  const expectedForCheck = (check: RackCheck, index: number) => check.type === 'Cash check' ? cashExpected : isRackCheck(check) ? 220000 : expectedByCheck(index);
  useEffect(() => {
    const nextChecks = checks.map((check) => check.type === 'Cash check' && !check.verified && check.expected !== cashExpected ? { ...check, expected: cashExpected } : check);
    if (nextChecks.some((check, index) => check !== checks[index])) onChange(nextChecks);
  }, [cashExpected, checks, onChange]);
  const expectedByCheck = (index: number) => Math.max(0, openingTotal - caveTotal + checks.slice(0, index + 1).reduce((total, check) => total + movementAmount(check), 0));
  const addCheck = (type: RackCheck['type']) => onChange([...checks, { id: Date.now(), date, time: new Date().toTimeString().slice(0, 5), type, expected: isRackCheck({ type } as RackCheck) ? 220000 : 0, actual: '', missing: '', verified: false, amount: type === 'Rajout bureau' ? '' : undefined, variance: '', croupierEntrant: '', croupierSortant: '', validatedBy: '', validatedAt: '' }]);
  const updateCheck = (id: number, changes: Partial<RackCheck>) => onChange(checks.map((check) => {
    if (check.id !== id) return check;
    const next = { ...check, ...changes };
    const actual = parseCasinoAmount(next.actual);
    return { ...next, missing: next.actual.trim() ? String(Math.max(0, next.expected - actual)) : '', variance: next.actual.trim() ? String(actual - next.expected) : '' };
  }));
  const checksWithExpected = checks.map((check, index) => check.type === 'Cash check' ? check : { ...check, expected: expectedForCheck(check, index) });
  const cashChecks = checksWithExpected.filter((check) => check.type === 'Cash check');
  const rackChecks = checksWithExpected.filter((check) => check.type !== 'Cash check');
  return <section>
    <SheetTitle title="Contrôles caisse et rack" subtitle="Les cash checks contrôlent les espèces. Les rack checks contrôlent les 220 000 Ar de jetons du croupier. Chaque contrôle est confirmé par le caissier et transmis à la direction en cas d'écart." />
    <div className="mb-3 flex flex-wrap gap-2 print:hidden">
      <button type="button" className="action secondary" onClick={() => addCheck('Cash check')}>+ Cash check horaire</button>
      <button type="button" className="action secondary" onClick={() => addCheck('Rack check entrée')}>+ Rack check entrée (220k)</button>
      <button type="button" className="action secondary" onClick={() => addCheck('Rack check sortie')}>+ Rack check sortie (220k)</button>
      <button type="button" className="action secondary" onClick={() => addCheck('Rack check périodique')}>+ Rack check périodique</button>
      <button type="button" className="action secondary" onClick={() => addCheck('Rajout bureau')}>+ Rajout bureau</button>
    </div>
    <CheckTable title="Cash check — espèces en caisse" checks={cashChecks} date={date} emptyLabel="Aucun cash check horaire enregistré." isRackCheck={isRackCheck} onUpdate={updateCheck} onRemove={(id) => onChange(checks.filter((item) => item.id !== id))} />
    <CheckTable title="Rack check — jetons du croupier" checks={rackChecks} date={date} emptyLabel="Aucun rack check enregistré." isRackCheck={isRackCheck} onUpdate={updateCheck} onRemove={(id) => onChange(checks.filter((item) => item.id !== id))} />
  </section>;
};

const CheckTable: React.FC<{ title: string; checks: RackCheck[]; date: string; emptyLabel: string; isRackCheck: (check: RackCheck) => boolean; onUpdate: (id: number, changes: Partial<RackCheck>) => void; onRemove: (id: number) => void }> = ({ title, checks, date, emptyLabel, isRackCheck, onUpdate, onRemove }) => <section className="mb-4">
  <h3 className="mb-2 text-sm font-bold text-primary">{title}</h3>
  <div className="overflow-x-auto"><table className="w-full min-w-[1500px] text-xs border" style={casinoBorder}><thead style={{ backgroundColor: 'var(--color-bg)' }}><tr>{['Date', 'Heure', 'Type', 'Croupier entrant', 'Croupier sortant', 'Rajout bureau', 'Montant attendu', 'Montant constaté', 'Écart', 'Responsable validation', 'Validé', 'Action'].map((header) => <th key={header} className="p-3 text-left border-r last:border-r-0" style={casinoBorder}>{header}</th>)}</tr></thead><tbody>
    {!checks.length && <tr><td colSpan={12} className="p-3 text-muted" style={casinoBorder}>{emptyLabel}</td></tr>}
    {checks.map((check) => <tr key={check.id}>
      <td className="border-r border-b" style={casinoBorder}><input type="date" className={casinoInput} value={check.date || date} onChange={(event) => onUpdate(check.id, { date: event.target.value })} /></td>
      <td className="border-r border-b" style={casinoBorder}><input type="time" className={casinoInput} value={check.time} onChange={(event) => onUpdate(check.id, { time: event.target.value })} /></td>
      <td className="border-r border-b p-2 font-semibold" style={casinoBorder}>{check.type}</td>
      <td className="border-r border-b" style={casinoBorder}><input className={casinoInput} placeholder="Croupier entrant" value={check.croupierEntrant || ''} onChange={(event) => onUpdate(check.id, { croupierEntrant: event.target.value })} /></td>
      <td className="border-r border-b" style={casinoBorder}><input className={casinoInput} placeholder="Croupier sortant" value={check.croupierSortant || ''} onChange={(event) => onUpdate(check.id, { croupierSortant: event.target.value })} /></td>
      <td className="border-r border-b" style={casinoBorder}>{check.type === 'Rajout bureau' ? <input className={casinoInput} inputMode="numeric" placeholder="Montant ajouté" value={check.amount || ''} onChange={(event) => onUpdate(check.id, { amount: event.target.value })} /> : <span className="block p-2 text-right">—</span>}</td>
      <td className="border-r border-b" style={casinoBorder}>{check.type === 'Cash check' ? <input className={casinoInput} inputMode="numeric" placeholder="Montant théorique" value={check.expected || ''} onChange={(event) => onUpdate(check.id, { expected: parseCasinoAmount(event.target.value) })} /> : <span className="block p-2 text-right font-semibold">{casinoCurrency.format(check.expected)} Ar</span>}</td>
      <td className="border-r border-b" style={casinoBorder}><input className={casinoInput} inputMode="numeric" placeholder={isRackCheck(check) ? 'Jetons dans le rack' : 'Espèces constatées'} value={check.actual} onChange={(event) => onUpdate(check.id, { actual: event.target.value })} /></td>
      <td className={`border-r border-b p-2 text-right font-bold ${check.actual.trim() && parseCasinoAmount(check.actual) - check.expected < 0 ? 'text-red-400' : 'text-green-400'}`} style={casinoBorder}>{check.actual.trim() ? `${parseCasinoAmount(check.actual) - check.expected > 0 ? '+' : ''}${casinoCurrency.format(parseCasinoAmount(check.actual) - check.expected)} Ar` : '—'}</td>
      <td className="border-r border-b" style={casinoBorder}><input className={casinoInput} placeholder="Nom du responsable" value={check.validatedBy || ''} onChange={(event) => onUpdate(check.id, { validatedBy: event.target.value })} /></td>
      <td className="border-r border-b p-2 text-center" style={casinoBorder}><label className="inline-flex items-center gap-2"><input type="checkbox" checked={check.verified} disabled={!check.actual.trim() || !check.validatedBy?.trim()} onChange={(event) => onUpdate(check.id, { verified: event.target.checked, validatedAt: event.target.checked ? new Date().toISOString() : '' })} /> Validé</label></td>
      <td className="border-b p-2 text-center" style={casinoBorder}><button type="button" className="action secondary text-xs" onClick={() => onRemove(check.id)}>Supprimer</button></td>
    </tr>)}
  </tbody></table></div>
</section>;

const ChipTable: React.FC<{ chips: ChipLine[]; onUpdate: ChipsSheetProps['onUpdate']; fields: (keyof Omit<ChipLine, 'value'>)[]; headers: string[] }> = ({ chips, onUpdate, fields, headers }) => <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-xs border" style={casinoBorder}><thead style={{ backgroundColor: 'var(--color-bg)' }}><tr>{headers.map((header) => <th key={header} className="p-3 text-left text-secondary border-r last:border-r-0" style={casinoBorder}>{header}</th>)}</tr></thead><tbody>{chips.map((line) => <tr key={line.value}><td className="p-2 font-semibold text-primary border-r border-b" style={casinoBorder}>{casinoCurrency.format(line.value)} Ar</td>{fields.map((field) => <td key={field} className="border-r border-b" style={casinoBorder}><input className={casinoInput} inputMode="numeric" value={line[field]} onChange={(event) => onUpdate(line.value, field, event.target.value)} /></td>)}{fields.length === 1 && <td className="p-2 text-primary border-b" style={casinoBorder}>{casinoCurrency.format(line.value * parseCasinoAmount(line.withdrawn))} Ar</td>}</tr>)}</tbody></table></div>;
const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg)', ...casinoBorder }}><p className="text-muted text-[11px]">{label}</p><p className="text-primary font-bold">{casinoCurrency.format(value)} Ar</p></div>;
const SheetTitle: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => <div className="mb-4"><h2 className="text-primary text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>{title}</h2><p className="text-muted text-xs mt-1">{subtitle}</p></div>;

const getTimeMinutes = (value?: string): number | null => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : null;
};

const getEarliestPlayer = (players: PlayerLine[]): PlayerLine | undefined => players
  .map((player) => ({ player, minutes: getTimeMinutes(player.time || player.arrival) }))
  .filter((entry): entry is { player: PlayerLine; minutes: number } => entry.minutes !== null)
  .sort((a, b) => a.minutes - b.minutes)[0]?.player;

const getPlayDurationMinutes = (arrival: string, departure: string): number | null => {
  if (!arrival || !departure) return null;
  const [arrivalHours, arrivalMinutes] = arrival.split(':').map(Number);
  const [departureHours, departureMinutes] = departure.split(':').map(Number);
  if ([arrivalHours, arrivalMinutes, departureHours, departureMinutes].some((value) => !Number.isFinite(value))) return null;
  let minutes = (departureHours * 60 + departureMinutes) - (arrivalHours * 60 + arrivalMinutes);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
};

const getPlayDuration = (arrival: string, departure: string): string => {
  const minutes = getPlayDurationMinutes(arrival, departure);
  if (minutes === null) return '—';
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
};

const getHourlyAverage = (arrival: string, departure: string, withdrawnTotal: number): string => {
  const minutes = getPlayDurationMinutes(arrival, departure);
  if (!minutes) return '—';
  return `${casinoCurrency.format(Math.round(withdrawnTotal / (minutes / 60)))} Ar/h`;
};

const SessionTimeTable: React.FC<{ firstArrival: string; endGameTime: string; withdrawnTotal: number; onEndGameTimeChange: (value: string) => void }> = ({ firstArrival, endGameTime, withdrawnTotal, onEndGameTimeChange }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[620px] text-xs border" style={casinoBorder}>
      <thead style={{ backgroundColor: 'var(--color-bg)' }}>
        <tr>
          {['Heure d’arrivée', 'Heure de fin de jeu', 'Durée de jeu', 'Moyenne / heure'].map((header) => <th key={header} className="p-3 text-left text-secondary border-r last:border-r-0" style={casinoBorder}>{header}</th>)}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="p-3 font-semibold text-primary border-r border-b" style={casinoBorder}>{firstArrival || '—'}</td>
          <td className="p-3 font-semibold text-primary border-r border-b" style={casinoBorder}><input type="time" className={casinoInput} value={endGameTime} onChange={(event) => onEndGameTimeChange(event.target.value)} /></td>
          <td className="p-3 font-semibold text-primary border-r border-b" style={casinoBorder}>{getPlayDuration(firstArrival, endGameTime)}</td>
          <td className="p-3 font-semibold text-primary border-b" style={casinoBorder}>{getHourlyAverage(firstArrival, endGameTime, withdrawnTotal)}</td>
        </tr>
      </tbody>
    </table>
  </div>
);
