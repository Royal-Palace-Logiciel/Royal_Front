import React, { useEffect, useState } from 'react';
import { ShieldAlert, History, Utensils, AlertTriangle, IdCard, CheckCircle2, Clock3, Dice5 } from 'lucide-react';
import {
  Modal,
  SectionCard,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  Button,
  Select,
  TextArea,
  Field,
  formatAriary,
  formatDate,
  formatDateTime,
  statutSpecialTone,
} from '../common';
import { ScoringPanel } from '../ScoringPanel';
import { IncidentModal } from '../modals/IncidentModal';
import { clientsApi, clientProfilesApi, creditsApi } from '../../../services/casino.service';
import { tempsJeuApi } from '../../../services/casinoTablesJeu.service';
import type {
  ClientFullProfile,
  ClientHistory,
  ClientConsumption,
  Incident,
  PlayerCredit,
  StatutSpecialClient,
} from '../../../types/casino.types';
import { STATUT_SPECIAL_LABELS, NIVEAU_CARTE_LABELS } from '../../../types/casino.types';
import type { TempsJeuJoueur } from '../../../types/casinoTablesJeu.types';
import { TYPE_JEU_LABELS } from '../../../types/casinoTablesJeu.types';

type TabKey = 'profil' | 'historique' | 'consommation' | 'incidents' | 'scoring' | 'jeu';

interface ClientProfileModalProps {
  clientId: number;
  onClose: () => void;
}

export const ClientProfileModal: React.FC<ClientProfileModalProps> = ({ clientId, onClose }) => {
  const [tab, setTab] = useState<TabKey>('profil');
  const [profile, setProfile] = useState<ClientFullProfile | null>(null);
  const [history, setHistory] = useState<ClientHistory | null>(null);
  const [consumption, setConsumption] = useState<ClientConsumption | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeCredits, setActiveCredits] = useState<PlayerCredit[]>([]);
  const [tempsJeu, setTempsJeu] = useState<TempsJeuJoueur | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showStatutForm, setShowStatutForm] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [p, h, c, inc, credits] = await Promise.all([
        clientsApi.profile(clientId),
        clientsApi.history(clientId),
        clientsApi.consumption(clientId),
        clientsApi.incidents(clientId),
        creditsApi.activeByClient(clientId),
      ]);
      setProfile(p);
      setHistory(h);
      setConsumption(c);
      setIncidents(inc);
      setActiveCredits(credits);

      // Séparé du Promise.all principal : un client sans historique de tables
      // de jeu (aucune présence enregistrée) ne doit pas faire échouer tout
      // le chargement de la fiche.
      try {
        setTempsJeu(await tempsJeuApi.parJoueur(clientId));
      } catch {
        setTempsJeu(null);
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement de la fiche client.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'profil', label: 'Profil', icon: <IdCard size={14} /> },
    { key: 'historique', label: 'Historique', icon: <History size={14} /> },
    { key: 'consommation', label: 'F&B / Bar', icon: <Utensils size={14} /> },
    { key: 'incidents', label: 'Incidents', icon: <AlertTriangle size={14} /> },
    { key: 'jeu', label: 'Temps de jeu', icon: <Clock3 size={14} /> },
    { key: 'scoring', label: 'Scoring', icon: <ShieldAlert size={14} /> },
  ];

  return (
    <Modal
      title={profile ? `${profile.client.prenom || ''} ${profile.client.nom}`.trim() : 'Fiche joueur'}
      subtitle={profile?.client.code_client}
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fermer
        </Button>
      }
    >
      {loading ? (
        <Spinner label="Chargement de la fiche…" />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <div className="flex flex-col gap-4">
          <div
            className="flex gap-1 rounded-xl p-1 w-full overflow-x-auto"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0"
                style={{
                  backgroundColor: tab === t.key ? 'var(--color-accent)' : 'transparent',
                  color: tab === t.key ? '#000' : 'inherit',
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'profil' && profile && (
            <div className="flex flex-col gap-3">
              <SectionCard>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge tone={statutSpecialTone(profile.profile?.statut_special || 'NORMAL')}>
                    {STATUT_SPECIAL_LABELS[profile.profile?.statut_special || 'NORMAL']}
                  </Badge>
                  {profile.card && <Badge tone="accent">Carte {NIVEAU_CARTE_LABELS[profile.card.niveau]}</Badge>}
                  {profile.card && <Badge tone={profile.card.statut === 'ACTIVE' ? 'success' : 'danger'}>{profile.card.statut}</Badge>}
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted text-xs">Téléphone</p>
                    <p className="text-primary">{profile.client.telephone || '—'}</p>
                  </div>
                  {profile.card && (
                    <>
                      <div>
                        <p className="text-muted text-xs">N° carte</p>
                        <p className="text-primary">{profile.card.numero_carte}</p>
                      </div>
                      <div>
                        <p className="text-muted text-xs">Plafond de crédit</p>
                        <p className="text-primary">{formatAriary(profile.card.plafond_credit)}</p>
                      </div>
                    </>
                  )}
                  {profile.profile?.motif && (
                    <div className="sm:col-span-2">
                      <p className="text-muted text-xs">Motif du statut</p>
                      <p className="text-primary">{profile.profile.motif}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  {!showStatutForm ? (
                    <Button variant="secondary" className="text-xs" onClick={() => setShowStatutForm(true)}>
                      Modifier le statut
                    </Button>
                  ) : (
                    <ClientStatutForm
                      clientId={clientId}
                      current={profile.profile?.statut_special || 'NORMAL'}
                      onDone={() => {
                        setShowStatutForm(false);
                        loadAll();
                      }}
                      onCancel={() => setShowStatutForm(false)}
                    />
                  )}
                </div>
              </SectionCard>

              {activeCredits.length > 0 && (
                <SectionCard title="Crédits actifs">
                  <div className="flex flex-col gap-2">
                    {activeCredits.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-xl p-3 text-sm"
                        style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                      >
                        <div>
                          <p className="text-primary font-semibold">{formatAriary(c.encours)}</p>
                          <p className="text-muted text-xs">Échéance {formatDate(c.echeance)}</p>
                        </div>
                        <Badge tone={c.statut === 'EN_RETARD' ? 'danger' : 'info'}>{c.statut}</Badge>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {tab === 'historique' && history && (
            <div className="flex flex-col gap-3">
              <SectionCard title="Salles fréquentées">
                {history.salles_frequentees.length === 0 ? (
                  <EmptyState label="Aucune visite enregistrée." />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {history.salles_frequentees.map((s) => (
                      <Badge key={s.id} tone="neutral">
                        {s.nom} · {s.nb_visites} visite(s)
                      </Badge>
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Visites récentes">
                {history.visites.length === 0 ? (
                  <EmptyState label="Aucune visite enregistrée." />
                ) : (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {history.visites.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between text-xs rounded-lg p-2"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        <span className="text-primary">{formatDateTime(v.entree_at)}</span>
                        <span className="text-muted">{v.sortie_at ? `→ ${formatDateTime(v.sortie_at)}` : 'En salle'}</span>
                        <Badge tone={v.entree_via === 'QR' ? 'accent' : 'neutral'}>{v.entree_via}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {tab === 'consommation' && consumption && (
            <SectionCard title="Habitudes F&B / Bar">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted text-xs">Nombre de commandes</p>
                  <p className="text-primary font-semibold">{consumption.nb_commandes}</p>
                </div>
                <div>
                  <p className="text-muted text-xs">Panier moyen</p>
                  <p className="text-primary font-semibold">{formatAriary(consumption.panier_moyen)}</p>
                </div>
                <div>
                  <p className="text-muted text-xs">Première commande</p>
                  <p className="text-primary">{formatDate(consumption.premiere_commande)}</p>
                </div>
                <div>
                  <p className="text-muted text-xs">Dernière commande</p>
                  <p className="text-primary">{formatDate(consumption.derniere_commande)}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {tab === 'incidents' && (
            <SectionCard
              title="Incidents & litiges"
              action={
                <Button className="text-xs" icon={<AlertTriangle size={14} />} onClick={() => setShowIncidentModal(true)}>
                  Déclarer
                </Button>
              }
            >
              {incidents.length === 0 ? (
                <EmptyState label="Aucun incident enregistré." />
              ) : (
                <div className="flex flex-col gap-2">
                  {incidents.map((i) => (
                    <div
                      key={i.id}
                      className="rounded-xl p-3 text-sm"
                      style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge tone={i.type === 'LITIGE' ? 'danger' : 'warning'}>{i.type}</Badge>
                          <Badge tone={i.gravite === 'ELEVEE' ? 'danger' : i.gravite === 'MOYENNE' ? 'warning' : 'neutral'}>
                            {i.gravite}
                          </Badge>
                        </div>
                        <Badge tone={i.statut === 'RESOLU' ? 'success' : 'neutral'}>{i.statut}</Badge>
                      </div>
                      <p className="text-primary text-xs">{i.description}</p>
                      {i.created_at && <p className="text-muted text-[11px] mt-1">{formatDateTime(i.created_at)}</p>}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {tab === 'jeu' && (
            <div className="flex flex-col gap-3">
              {!tempsJeu || tempsJeu.sessions.length === 0 ? (
                <EmptyState label="Aucune présence enregistrée sur une table de jeu pour ce client." />
              ) : (
                <>
                  <SectionCard title="Cumul">
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted text-xs">Temps de jeu total</p>
                        <p className="text-primary text-lg font-semibold">{formatMinutes(tempsJeu.total_minutes)}</p>
                      </div>
                      <div>
                        <p className="text-muted text-xs">Type de jeu préféré</p>
                        <p className="text-primary">
                          {tempsJeu.type_jeu_prefere ? (
                            <Badge tone="accent">
                              <Dice5 size={12} className="inline mr-1" />
                              {TYPE_JEU_LABELS[tempsJeu.type_jeu_prefere]}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </p>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Répartition par type de jeu">
                    <div className="flex flex-wrap gap-2">
                      {tempsJeu.par_type_jeu.map((t) => (
                        <Badge key={t.type_jeu} tone="neutral">
                          {TYPE_JEU_LABELS[t.type_jeu]} · {formatMinutes(t.minutes)} · {t.nb_sessions} session(s)
                        </Badge>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Sessions récentes">
                    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                      {[...tempsJeu.sessions].reverse().map((s, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs rounded-lg p-2"
                          style={{ backgroundColor: 'var(--color-bg)' }}
                        >
                          <div>
                            <p className="text-primary font-medium">
                              {s.table_numero} · {TYPE_JEU_LABELS[s.type_jeu]}
                            </p>
                            <p className="text-muted">
                              {formatDateTime(s.entree_at)} → {s.sortie_at ? formatDateTime(s.sortie_at) : 'en cours'}
                            </p>
                          </div>
                          <Badge tone={s.en_cours ? 'success' : 'neutral'}>{formatMinutes(s.minutes)}</Badge>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </>
              )}
            </div>
          )}

          {tab === 'scoring' && <ScoringPanel clientId={clientId} />}
        </div>
      )}

      {showIncidentModal && (
        <IncidentModal
          clientId={clientId}
          onClose={() => setShowIncidentModal(false)}
          onSuccess={() => {
            setShowIncidentModal(false);
            loadAll();
          }}
        />
      )}
    </Modal>
  );
};

// -------------------------------------------------------------------------
// Formate un nombre de minutes en "1h 32min" (ou "45min" si < 1h)
// -------------------------------------------------------------------------

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}min` : `${m}min`;
}

// -------------------------------------------------------------------------
// Formulaire de décision humaine explicite sur le statut spécial
// -------------------------------------------------------------------------

const ClientStatutForm: React.FC<{
  clientId: number;
  current: StatutSpecialClient;
  onDone: () => void;
  onCancel: () => void;
}> = ({ clientId, current, onDone, onCancel }) => {
  const [statut, setStatut] = useState<StatutSpecialClient>(current);
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!motif.trim()) {
      setError('Le motif est requis pour toute décision de statut (jamais automatique).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await clientProfilesApi.setStatut(clientId, { statut_special: statut, motif: motif.trim() });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du changement de statut.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-3 mt-2"
      style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
    >
      {error && <ErrorBanner message={error} />}
      <Field label="Nouveau statut">
        <Select value={statut} onChange={(e) => setStatut(e.target.value as StatutSpecialClient)}>
          {Object.entries(STATUT_SPECIAL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Motif (décision humaine explicite)" required>
        <TextArea value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Comportement suspect le 05/07…" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" className="text-xs" onClick={onCancel}>
          Annuler
        </Button>
        <Button className="text-xs" icon={<CheckCircle2 size={14} />} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Enregistrement…' : 'Confirmer'}
        </Button>
      </div>
    </div>
  );
};

export default ClientProfileModal;