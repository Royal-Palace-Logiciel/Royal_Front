import React, { useEffect, useState } from 'react';
import { Building2, DoorOpen, Wallet, TrendingUp, CreditCard, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  SectionCard,
  Spinner,
  EmptyState,
  ErrorBanner,
  Badge,
  Button,
  formatAriary,
  formatDate,
  formatDateTime,
} from '../common';
import { dashboardApi, reportsApi } from '../../../services/casino.service';
import type { CasinoDashboard, ProduitNetRow, EcartCaisseRow, EncoursCreditRow, FluxASynchroniserRow } from '../../../types/casino.types';

export const OverviewTab: React.FC = () => {
  const [dashboard, setDashboard] = useState<CasinoDashboard | null>(null);
  const [produitNet, setProduitNet] = useState<ProduitNetRow[]>([]);
  const [ecarts, setEcarts] = useState<EcartCaisseRow[]>([]);
  const [encours, setEncours] = useState<EncoursCreditRow[]>([]);
  const [flux, setFlux] = useState<FluxASynchroniserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [d, pn, ec, en, fl] = await Promise.all([
        dashboardApi.get(),
        reportsApi.produitNet(),
        reportsApi.ecartsCaisse(),
        reportsApi.encoursCredit(),
        reportsApi.fluxASynchroniser(),
      ]);
      setDashboard(d);
      setProduitNet(pn);
      setEcarts(ec);
      setEncours(en);
      setFlux(fl);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement du tableau de bord.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) return <Spinner label="Chargement du tableau de bord…" />;

  return (
    <div className="flex flex-col gap-4 w-full">
      {error && <ErrorBanner message={error} />}

      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatTile icon={<Building2 size={16} />} label="Salles" value={dashboard.salles_total} />
          <StatTile icon={<DoorOpen size={16} />} label="Salles ouvertes" value={dashboard.salles_ouvertes} />
          <StatTile icon={<Wallet size={16} />} label="Sessions ouvertes" value={dashboard.sessions_ouvertes} />
          <StatTile
            icon={<TrendingUp size={16} />}
            label="Produit net (jour)"
            value={formatAriary(dashboard.produit_net_jour)}
          />
          <StatTile
            icon={<CreditCard size={16} />}
            label="Encours crédit"
            value={formatAriary(dashboard.encours_credit_total)}
          />
          <StatTile
            icon={<AlertTriangle size={16} />}
            label="Incidents ouverts"
            value={dashboard.incidents_ouverts}
            tone={dashboard.incidents_ouverts > 0 ? 'warning' : undefined}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Produit net par salle / jour">
          {produitNet.length === 0 ? (
            <EmptyState label="Aucune donnée sur la période." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted text-left">
                    <th className="py-1.5 pr-2">Salle</th>
                    <th className="py-1.5 pr-2">Jour</th>
                    <th className="py-1.5 pr-2 text-right">Entrées</th>
                    <th className="py-1.5 pr-2 text-right">Sorties</th>
                    <th className="py-1.5 text-right">Produit net</th>
                  </tr>
                </thead>
                <tbody>
                  {produitNet.map((row, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td className="py-1.5 pr-2 text-primary font-medium">{row.salle}</td>
                      <td className="py-1.5 pr-2 text-muted">{formatDate(row.jour)}</td>
                      <td className="py-1.5 pr-2 text-right text-muted">{formatAriary(row.total_entrees)}</td>
                      <td className="py-1.5 pr-2 text-right text-muted">{formatAriary(row.total_sorties)}</td>
                      <td className="py-1.5 text-right font-semibold" style={{ color: 'var(--color-accent)' }}>
                        {formatAriary(row.produit_net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Écarts de caisse (déclaré vs théorique)">
          {ecarts.length === 0 ? (
            <EmptyState label="Aucun écart à signaler." />
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {ecarts.map((row) => (
                <div
                  key={row.session_id}
                  className="flex items-center justify-between rounded-xl p-2.5 text-xs"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div>
                    <p className="text-primary font-medium">
                      {row.caisse} · {row.salle}
                    </p>
                    <p className="text-muted">{formatDateTime(row.fermeture_at || row.ouverture_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={!row.ecart ? 'success' : row.ecart > 0 ? 'info' : 'danger'}>
                      {row.ecart == null ? '—' : `${row.ecart > 0 ? '+' : ''}${formatAriary(row.ecart)}`}
                    </Badge>
                    {row.cash_check != null && row.cash_check > 0 && (
                      <span className="text-[10px] font-semibold text-red-400">Cash check {formatAriary(row.cash_check)}</span>
                    )}
                    {row.rack_check_manquant != null && row.rack_check_manquant > 0 && (
                      <span className="text-[10px] font-semibold text-violet-300">Rack check {formatAriary(row.rack_check_manquant)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Encours de crédit joueur">
          {encours.length === 0 ? (
            <EmptyState label="Aucun encours en cours." />
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {encours.map((row) => (
                <div
                  key={row.client_id}
                  className="flex items-center justify-between rounded-xl p-2.5 text-xs"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div>
                    <p className="text-primary font-medium">{row.client}</p>
                    <p className="text-muted">
                      {row.nb_credits_actifs} crédit(s) actif(s)
                      {row.prochaine_echeance ? ` · échéance ${formatDate(row.prochaine_echeance)}` : ''}
                    </p>
                  </div>
                  <span className="font-semibold text-primary">{formatAriary(row.encours_total)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Flux à synchroniser"
          action={
            <Button variant="secondary" icon={<RefreshCw size={14} />} className="text-xs" onClick={loadAll}>
              Rafraîchir
            </Button>
          }
        >
          {flux.length === 0 ? (
            <EmptyState label="Tout est synchronisé avec le module financier." />
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              <p className="text-muted text-[11px] mb-1">
                Écritures casino sans contrepartie encore trouvée dans le module financier global (à réconcilier).
              </p>
              {flux.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl p-2.5 text-xs"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div>
                    <p className="text-primary font-medium">{row.source} #{row.id}</p>
                    <p className="text-muted font-mono">{row.ref_flux_global}</p>
                  </div>
                  <span className="font-semibold text-primary">{formatAriary(row.montant)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'warning' }> = ({
  icon,
  label,
  value,
  tone,
}) => (
  <div
    className="rounded-2xl p-3 md:p-4 flex items-center gap-3 min-w-0"
    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
  >
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: tone === 'warning' ? 'rgba(245,158,11,0.2)' : 'var(--color-accent)' }}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-muted text-[10px] md:text-xs truncate">{label}</p>
      <p className="text-primary font-bold text-sm md:text-lg truncate">{value}</p>
    </div>
  </div>
);

export default OverviewTab;
