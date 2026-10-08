// Vérification des « Résultat final » enregistrés dans les calculs finaux.
// Montre, pour chaque date + table, le résultat final du dernier enregistrement :
// le montant repris par le rapport financier du module Finance.
import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { casinoBorder, casinoCurrency } from './types';
import { playerSheetApi, type CasinoFinalResultRow } from '../../../services/casinoTablesJeu.service';

const toDateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export interface FinalResultsRange { dateFrom: string; dateTo: string }

// Période par défaut : du 1er du mois en cours à aujourd'hui.
export const defaultFinalResultsRange = (): FinalResultsRange => {
  const today = new Date();
  return { dateFrom: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: toDateInput(today) };
};
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR');
const formatDateTime = (value: string) => {
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const formatAmount = (value: number) => `${casinoCurrency.format(value)} Ar`;
const amountClass = (value: number) => (value < 0 ? 'text-red-400' : value > 0 ? 'text-green-400' : 'text-primary');

interface FinalResultsSheetProps {
  /** Période conservée par la page Casino : on la retrouve en revenant d'une fiche ouverte. */
  range: FinalResultsRange;
  onRangeChange: (range: FinalResultsRange) => void;
  /** Incrémenté après chaque enregistrement de fiche : recharge les montants à jour. */
  refreshTrigger?: number;
  onOpenSheet: (date: string, tableName: string) => void;
}

export const FinalResultsSheet: React.FC<FinalResultsSheetProps> = ({ range, onRangeChange, refreshTrigger = 0, onOpenSheet }) => {
  const { dateFrom, dateTo } = range;
  const setDateFrom = (value: string) => onRangeChange({ ...range, dateFrom: value });
  const setDateTo = (value: string) => onRangeChange({ ...range, dateTo: value });
  const [showEmpty, setShowEmpty] = useState(false);
  const [rows, setRows] = useState<CasinoFinalResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    playerSheetApi.finalResults(dateFrom, dateTo)
      .then((data) => { if (!cancelled) setRows(Array.isArray(data) ? data : []); })
      .catch((err) => {
        if (cancelled) return;
        const diag = err?.response?.data?.diagnostic;
        const detail = diag?.sqlMessage || diag?.message || err?.response?.data?.error?.message || err?.response?.data?.message;
        setError(`Impossible de charger les résultats finaux.${detail ? ` (${detail})` : ''}`);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, refreshKey, refreshTrigger]);

  const visibleRows = showEmpty ? rows : rows.filter((row) => row.montant_rapport !== null);
  const totalRapport = visibleRows.reduce((sum, row) => sum + (row.montant_rapport ?? 0), 0);

  return (
    <section className="flex flex-col gap-4 text-sm text-primary">
      <div>
        <h2 className="text-xl font-bold">Vérification des résultats finaux</h2>
        <p className="mt-1 text-xs text-muted">
          « Résultat final » du calcul final de chaque date, tel qu'il a été enregistré en dernier
          (bouton « Enregistrer le calcul »). C'est ce montant qui est repris par le rapport financier du module Finance.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="field">Du<input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="field">Au<input type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label className="flex items-center gap-2 pb-2 text-xs font-semibold cursor-pointer">
          <input type="checkbox" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} />
          Afficher les fiches sans calcul enregistré
        </label>
        <button type="button" className="action secondary" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Actualiser
        </button>
      </div>

      <div className="rounded-xl border p-3 sm:max-w-xs" style={casinoBorder}>
        <p className="text-xs text-muted">Total des résultats finaux de la période</p>
        <p className={`mt-1 text-lg font-bold ${amountClass(totalRapport)}`}>{formatAmount(totalRapport)}</p>
      </div>

      {dateFrom > dateTo && <p className="text-xs text-red-400">La date de début doit être avant la date de fin.</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border" style={casinoBorder}>
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="text-left uppercase tracking-wide text-muted" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Table</th>
              <th className="px-3 py-2 font-semibold">Enregistré le</th>
              <th className="px-3 py-2 text-right font-semibold">Résultat final</th>
              <th className="px-3 py-2 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {loading && !visibleRows.length ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">Chargement…</td></tr>
            ) : !visibleRows.length ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">Aucun résultat final enregistré sur cette période.</td></tr>
            ) : visibleRows.map((row) => (
              <tr key={row.sheet_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="px-3 py-2 font-semibold">{formatDate(row.date)}</td>
                <td className="px-3 py-2">Table {row.table_name}</td>
                <td className="px-3 py-2 text-muted">{formatDateTime(row.updated_at)}</td>
                <td className={`px-3 py-2 text-right font-bold ${row.montant_rapport === null ? 'text-muted' : amountClass(row.montant_rapport)}`}>
                  {row.montant_rapport === null ? 'Non enregistré' : formatAmount(row.montant_rapport)}
                </td>
                <td className="px-3 py-2 text-right print:hidden">
                  <button type="button" className="action secondary" onClick={() => onOpenSheet(row.date, row.table_name)}>Ouvrir</button>
                </td>
              </tr>
            ))}
          </tbody>
          {visibleRows.length > 1 && (
            <tfoot>
              <tr className="font-bold">
                <td className="px-3 py-2" colSpan={3}>Total</td>
                <td className={`px-3 py-2 text-right ${amountClass(totalRapport)}`}>{formatAmount(totalRapport)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
};
