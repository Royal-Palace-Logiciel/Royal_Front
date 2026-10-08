import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Link2, ShieldCheck, ArrowRightLeft, Check, X, RefreshCcw, Unlock, LockKeyhole } from 'lucide-react';
import {
  SectionCard,
  Spinner,
  EmptyState,
  ErrorBanner,
  Badge,
  Button,
  Field,
  TextInput,
  Select,
  formatAriary,
  formatDateTime,
} from '../common';
import { sessionsApi, cashiersApi, reportsApi } from '../../../services/casino.service';
import { caisseTransfersApi } from '../../../services/caisseTransfers.service';
import financeService, { FinancialStats } from '../../../services/finance.service';
import { CaisseTransferModal } from '../modals/CaisseTransferModal';
import { OpenSessionModal, CloseSessionModal } from '../modals/SessionModal';
import type { CashSession, Cashier, EcartCaisseRow, FluxASynchroniserRow, SessionSummary } from '../../../types/casino.types';
import type { CaisseTransfer, StatutCaisseTransfer } from '../../../types/caisseTransfers.types';
import { MODULE_CAISSE_LABELS, STATUT_TRANSFER_LABELS, caisseLabel } from '../../../types/caisseTransfers.types';

export const CaisseTab: React.FC = () => {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [ecarts, setEcarts] = useState<EcartCaisseRow[]>([]);
  const [flux, setFlux] = useState<FluxASynchroniserRow[]>([]);
  const [transfers, setTransfers] = useState<CaisseTransfer[]>([]);
  const [transferStatutFilter, setTransferStatutFilter] = useState<StatutCaisseTransfer | ''>('');
  const [salleFilter, setSalleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingTransferId, setActingTransferId] = useState<number | null>(null);
  const [proceedingTransfer, setProceedingTransfer] = useState<CaisseTransfer | null>(null);
  const [openingCashier, setOpeningCashier] = useState<Cashier | null>(null);
  const [closingSession, setClosingSession] = useState<CashSession | null>(null);
  const [closingSummary, setClosingSummary] = useState<SessionSummary | null>(null);
  const [casinoFinance, setCasinoFinance] = useState({ entrees: 0, sorties: 0, solde: 0 });

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [s, cs, ec, fl, tr, finance] = await Promise.all([
        sessionsApi.list(),
        cashiersApi.list(),
        reportsApi.ecartsCaisse({ salle: salleFilter || undefined }),
        reportsApi.fluxASynchroniser(),
        caisseTransfersApi.list({ statut: transferStatutFilter || undefined, limit: 50 }),
        financeService.getFinancialStats(),
      ]);
      setSessions(s);
      setCashiers(cs);
      setEcarts(ec);
      setFlux(fl);
      setTransfers(tr);
      const summary = (finance as FinancialStats).modules.find(
        (module) => module.module.toLowerCase() === 'casino'
      );
      setCasinoFinance(summary || { entrees: 0, sorties: 0, solde: 0 });
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement de la caisse globale.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferStatutFilter]);

  const cashierCode = (cashierId: number) => cashiers.find((c) => c.id === cashierId)?.code;

  async function handleConfirmTransfer(t: CaisseTransfer) {
    setActingTransferId(t.id);
    try {
      await caisseTransfersApi.confirm(t.id);
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erreur lors de la confirmation.');
    } finally {
      setActingTransferId(null);
    }
  }

  async function handleRejectTransfer(t: CaisseTransfer) {
    const motif = window.prompt('Motif du refus :') || undefined;
    setActingTransferId(t.id);
    try {
      await caisseTransfersApi.reject(t.id, { motif_refus: motif });
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erreur lors du refus.');
    } finally {
      setActingTransferId(null);
    }
  }

  async function handleProceedSuccess(created: CaisseTransfer) {
    const old = proceedingTransfer;
    setProceedingTransfer(null);
    if (old) {
      try {
        await caisseTransfersApi.reject(old.id, { motif_refus: `Remplacé par le transfert #${created.id}` });
      } catch {
        // best effort : cf. PendingCaisseTransfers
      }
    }
    await loadAll();
  }

  async function handleCloseSession(session: CashSession) {
    setError(null);
    try {
      const summary = await sessionsApi.summary(session.id);
      setClosingSummary(summary);
      setClosingSession(session);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Impossible de charger le résumé de la session.');
    }
  }

  /** Session casino d'origine du transfert en cours de reprise, si encore trouvable. */
  const proceedingSession = useMemo(
    () => (proceedingTransfer ? sessions.find((s) => s.id === proceedingTransfer.session_source_id) : undefined),
    [proceedingTransfer, sessions]
  );

  if (loading) return <Spinner label="Chargement…" />;

  return (
    <div className="flex flex-col gap-4 w-full">
      {error && <ErrorBanner message={error} />}

      {/*
        Résumé financier rapide du casino :
        - entrées / sorties / solde global de la caisse
        - permet d'avoir une vue d'ensemble avant d'ouvrir un détail
      */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Entrées Casino', value: casinoFinance.entrees, color: 'var(--color-success, #4ade80)' },
          { label: 'Sorties Casino', value: casinoFinance.sorties, color: 'var(--color-danger, #f87171)' },
          { label: 'Solde Casino', value: casinoFinance.solde, color: 'var(--color-accent)' },
        ].map((stat) => (
          <SectionCard key={stat.label} title={stat.label}>
            <p className="text-primary text-xl font-bold" style={{ color: stat.color }}>
              {formatAriary(stat.value)}
            </p>
          </SectionCard>
        ))}
      </div>

      {/*
        Gestion des sessions de caisse par caissier :
        - ouverture d'une session si aucune n'est active
        - fermeture si une session est déjà ouverte
        - contrôle du cycle de vie de la caisse casino
      */}
      <SectionCard title="Sessions de caisse" action={<RefreshCw size={16} className="text-muted" />}>
        {cashiers.length === 0 ? (
          <EmptyState label="Aucune caisse configurée." />
        ) : (
          <div className="flex flex-col gap-2">
            {cashiers.map((cashier) => {
              const session = sessions.find((item) => item.cashier_id === cashier.id && item.statut === 'OUVERTE');
              return (
                <div
                  key={cashier.id}
                  className="flex items-center justify-between gap-3 rounded-xl p-3 text-xs"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div className="min-w-0">
                    <p className="text-primary font-semibold truncate">{cashier.code} · {cashier.nom}</p>
                    <p className="text-muted">{session ? `Session #${session.id} ouverte le ${formatDateTime(session.ouverture_at)}` : 'Aucune session ouverte'}</p>
                  </div>
                  {session ? (
                    <Button
                      variant="secondary"
                      className="text-[11px] py-1 flex-shrink-0"
                      icon={<LockKeyhole size={12} />}
                      onClick={() => handleCloseSession(session)}
                    >
                      Clôturer
                    </Button>
                  ) : (
                    <Button
                      className="text-[11px] py-1 flex-shrink-0"
                      icon={<Unlock size={12} />}
                      onClick={() => setOpeningCashier(cashier)}
                    >
                      Ouvrir
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/*
        Règle métier centrale : la caisse casino est la source unique de vérité.
        Tous les mouvements sont consolidés dans le module financier global,
        et la référence de flux permet de faire la correspondance entre les
        écritures locales et les écritures centralisées.
      */}
      <SectionCard
        title="Principe : source unique"
        action={<ShieldCheck size={16} className="text-muted" />}
      >
        <p className="text-muted text-xs">
          La caisse casino est la source unique de vérité pour ses mouvements. Chaque écriture (entrée, sortie,
          opération, mouvement de jetons) est transmise au module financier global d'HDA via un événement interne,
          avec une référence de liaison <code>ref_flux_global</code>. Aucune double saisie n'est nécessaire ; en cas
          d'échec du webhook, la liste ci-dessous permet une réconciliation par lot.
        </p>
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-4">
        {/*
          Contrôle des écarts de caisse après fermeture d'une session.
          Affiche le fond théorique, le fond déclaré et les écarts éventuels
          comme le cash check ou le rack check manquant.
        */}
        <SectionCard
          title="Écarts de caisse"
          action={
            <div className="flex items-center gap-2">
              <TextInput
                placeholder="Filtrer par salle…"
                value={salleFilter}
                onChange={(e) => setSalleFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadAll()}
                className="text-xs py-1.5 w-40"
              />
              <Button variant="secondary" className="text-xs" icon={<RefreshCw size={14} />} onClick={loadAll}>
                Filtrer
              </Button>
            </div>
          }
        >
          {ecarts.length === 0 ? (
            <EmptyState label="Aucun écart trouvé." />
          ) : (
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {ecarts.map((row) => (
                <div
                  key={row.session_id}
                  className="rounded-xl p-3 text-xs"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-primary font-semibold">
                      {row.caisse} · {row.salle}
                    </p>
                    <Badge tone={!row.ecart ? 'success' : row.ecart > 0 ? 'info' : 'danger'}>
                      {row.ecart == null ? '—' : `${row.ecart > 0 ? '+' : ''}${formatAriary(row.ecart)}`}
                    </Badge>
                  </div>
                  <p className="text-muted">
                    Théorique {formatAriary(row.fond_final_theorique)} · Déclaré {formatAriary(row.fond_final_declare)}
                  </p>
                  {row.cash_check != null && row.cash_check > 0 && (
                    <p className="text-muted text-red-400">
                      Cash check : {formatAriary(row.cash_check)}
                    </p>
                  )}
                  {row.rack_check_manquant != null && row.rack_check_manquant > 0 && (
                    <p className="text-muted text-violet-300">
                      Rack check : manque {formatAriary(row.rack_check_manquant)}
                    </p>
                  )}
                  <p className="text-muted">
                    {formatDateTime(row.ouverture_at)} → {formatDateTime(row.fermeture_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Historique des sessions">
          {sessions.length === 0 ? (
            <EmptyState label="Aucune session enregistrée." />
          ) : (
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {sessions.map((s) => {
                const code = cashierCode(s.cashier_id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl p-2.5 text-xs"
                    style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                  >
                    <div>
                      <p className="text-primary font-medium">
                        Session #{s.id} · {code ? `caisse ${code}` : `caisse #${s.cashier_id}`}
                      </p>
                      <p className="text-muted">
                        {formatDateTime(s.ouverture_at)} {s.fermeture_at ? `→ ${formatDateTime(s.fermeture_at)}` : ''}
                      </p>
                    </div>
                    <Badge tone={s.statut === 'OUVERTE' ? 'success' : 'neutral'}>{s.statut}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/*
          Gestion des transferts d'argent entre caisses.
          Le casino peut recevoir ou envoyer des fonds vers d'autres modules,
          avec validation, refus ou reprise selon le statut du transfert.
        */}
        <SectionCard
          title="Transferts inter-caisses"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-2">
              <Select
                value={transferStatutFilter}
                onChange={(e) => setTransferStatutFilter(e.target.value as StatutCaisseTransfer | '')}
                className="text-xs py-1.5 w-40"
              >
                <option value="">Tous statuts</option>
                {Object.entries(STATUT_TRANSFER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" className="text-xs" icon={<ArrowRightLeft size={14} />} onClick={loadAll}>
                Rafraîchir
              </Button>
            </div>
          }
        >
          {transfers.length === 0 ? (
            <EmptyState label="Aucun transfert inter-caisses." />
          ) : (
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {transfers.map((t) => {
                const entrantIci = t.statut === 'EN_ATTENTE' && t.module_destination === 'CASINO';
                const sortantIci = t.statut === 'EN_ATTENTE' && t.module_source === 'CASINO';
                const sourceLabel = caisseLabel(t.module_source, t.session_source_id, t.cashier_source_code, t.cashier_source_nom);
                const destLabel = caisseLabel(t.module_destination, t.session_destination_id, t.cashier_destination_code, t.cashier_destination_nom);
                const sessionIntrouvable = sortantIci && !sessions.some((s) => s.id === t.session_source_id);

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-xl p-3 text-xs"
                    style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-primary font-semibold">
                        {sourceLabel} → {destLabel}
                      </p>
                      <p className="text-muted">
                        {formatAriary(t.montant)} · {t.motif || 'sans motif'} · {formatDateTime(t.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        tone={
                          t.statut === 'CONFIRME' ? 'success' : t.statut === 'REFUSE' ? 'danger' : t.statut === 'ANNULE' ? 'neutral' : 'warning'
                        }
                      >
                        {STATUT_TRANSFER_LABELS[t.statut]}
                      </Badge>
                      {entrantIci && (
                        <>
                          <Button
                            className="text-[11px] py-1"
                            icon={<Check size={12} />}
                            onClick={() => handleConfirmTransfer(t)}
                            disabled={actingTransferId === t.id}
                          >
                            Confirmer
                          </Button>
                          <Button
                            variant="secondary"
                            className="text-[11px] py-1"
                            icon={<X size={12} />}
                            onClick={() => handleRejectTransfer(t)}
                            disabled={actingTransferId === t.id}
                          >
                            Refuser
                          </Button>
                        </>
                      )}
                      {sortantIci && (
                        <>
                          <Button
                            variant="secondary"
                            className="text-[11px] py-1"
                            icon={<RefreshCcw size={12} />}
                            onClick={() => setProceedingTransfer(t)}
                            disabled={actingTransferId === t.id || sessionIntrouvable}
                            title={sessionIntrouvable ? 'Session source introuvable (probablement clôturée)' : undefined}
                          >
                            Procéder
                          </Button>
                          <Button
                            variant="secondary"
                            className="text-[11px] py-1"
                            icon={<X size={12} />}
                            onClick={() => handleRejectTransfer(t)}
                            disabled={actingTransferId === t.id}
                          >
                            Refuser
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/*
          Liste des mouvements non encore correctement synchronisés avec le
          module financier global. Cela sert de filet de réconciliation.
        */}
        <SectionCard
          title="Flux à synchroniser"
          className="lg:col-span-2"
          action={
            <Button variant="secondary" className="text-xs" icon={<Link2 size={14} />} onClick={loadAll}>
              Rafraîchir
            </Button>
          }
        >
          {flux.length === 0 ? (
            <EmptyState label="Tout est synchronisé avec le module financier global." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted text-left">
                    <th className="py-1.5 pr-2">Source</th>
                    <th className="py-1.5 pr-2">ID</th>
                    <th className="py-1.5 pr-2">Référence flux global</th>
                    <th className="py-1.5 pr-2 text-right">Montant</th>
                    <th className="py-1.5 text-right">Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {flux.map((row, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td className="py-1.5 pr-2 text-primary">{row.source}</td>
                      <td className="py-1.5 pr-2 text-muted">#{row.id}</td>
                      <td className="py-1.5 pr-2 text-muted font-mono">{row.ref_flux_global}</td>
                      <td className="py-1.5 pr-2 text-right text-primary font-semibold">{formatAriary(row.montant)}</td>
                      <td className="py-1.5 text-right text-muted">{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {proceedingTransfer && proceedingSession && (
        <CaisseTransferModal
          casinoSession={proceedingSession}
          prefill={proceedingTransfer}
          onClose={() => setProceedingTransfer(null)}
          onSuccess={handleProceedSuccess}
        />
      )}

      {openingCashier && (
        <OpenSessionModal
          cashier={openingCashier}
          onClose={() => setOpeningCashier(null)}
          onSuccess={() => {
            setOpeningCashier(null);
            loadAll();
          }}
        />
      )}

      {closingSession && (
        <CloseSessionModal
          session={closingSession}
          summary={closingSummary}
          onClose={() => {
            setClosingSession(null);
            setClosingSummary(null);
          }}
          onSuccess={() => {
            setClosingSession(null);
            setClosingSummary(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
};

export default CaisseTab;