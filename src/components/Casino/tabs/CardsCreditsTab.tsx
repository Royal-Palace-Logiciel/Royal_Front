import React, { useEffect, useState } from 'react';
import { Plus, Coins, CreditCard, Settings2, HandCoins, Undo2 } from 'lucide-react';
import {
  SectionCard,
  Spinner,
  EmptyState,
  ErrorBanner,
  Badge,
  Button,
  Field,
  TextInput,
  formatAriary,
  formatDate,
} from '../common';
import { cardsApi, chipTypesApi, creditsApi, scoringApi, sessionsApi } from '../../../services/casino.service';
import { ChipTypeFormModal } from '../modals/ChipTypeFormModal';
import { CreditGrantModal, CreditDrawModal, CreditRepayModal } from '../modals/CreditModal';
import type { LoyaltyCard, ChipType, PlayerCredit, ScoringConfigItem, CashSession } from '../../../types/casino.types';
import { NIVEAU_CARTE_LABELS } from '../../../types/casino.types';

export const CardsCreditsTab: React.FC = () => {
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [chipTypes, setChipTypes] = useState<ChipType[]>([]);
  const [credits, setCredits] = useState<PlayerCredit[]>([]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfigItem[]>([]);
  const [activeSessions, setActiveSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showChipTypeForm, setShowChipTypeForm] = useState<ChipType | null | false>(false);
  const [showGrant, setShowGrant] = useState(false);
  const [showDraw, setShowDraw] = useState<PlayerCredit | null>(null);
  const [showRepay, setShowRepay] = useState<PlayerCredit | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [c, ct, cr, sc, sess] = await Promise.all([
        cardsApi.list(),
        chipTypesApi.list(),
        creditsApi.list(),
        scoringApi.getConfig(),
        sessionsApi.active(),
      ]);
      setCards(c);
      setChipTypes(ct);
      setCredits(cr);
      setScoringConfig(sc);
      setActiveSessions(sess);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleDeleteChipType(ct: ChipType) {
    if (!confirm(`Supprimer le jeton "${ct.nom}" ?`)) return;
    try {
      await chipTypesApi.remove(ct.id);
      loadAll();
    } catch (e: any) {
      alert(e?.message || 'Suppression impossible.');
    }
  }

  const currentSessionId = activeSessions[0]?.id;

  if (loading) return <Spinner label="Chargement…" />;

  return (
    <div className="flex flex-col gap-4 w-full">
      {error && <ErrorBanner message={error} />}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Jetons */}
        <SectionCard
          title="Types de jetons"
          action={
            <Button className="text-xs" icon={<Plus size={14} />} onClick={() => setShowChipTypeForm(null)}>
              Jeton
            </Button>
          }
        >
          {chipTypes.length === 0 ? (
            <EmptyState label="Aucun jeton configuré." icon={<Coins size={22} />} />
          ) : (
            <div className="flex flex-col gap-2">
              {chipTypes.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center justify-between rounded-xl p-2.5"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: ct.couleur }} />
                    <div className="min-w-0">
                      <p className="text-primary text-sm font-medium truncate">{ct.nom}</p>
                      <p className="text-muted text-[11px] truncate">{ct.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-primary text-xs font-semibold">{formatAriary(ct.valeur_nominale)}</span>
                    <Badge tone={ct.quantite_stock <= 0 ? 'danger' : ct.quantite_stock < 20 ? 'warning' : 'neutral'}>
                      Stock : {ct.quantite_stock}
                    </Badge>
                    <Badge tone={ct.statut === 'ACTIF' ? 'success' : 'neutral'}>{ct.statut}</Badge>
                    <button
                      onClick={() => setShowChipTypeForm(ct)}
                      className="text-muted hover:text-primary text-[11px] underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDeleteChipType(ct)}
                      className="text-muted hover:text-primary text-[11px] underline"
                    >
                      Suppr.
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Cartes de fidélité */}
        <SectionCard title="Cartes de fidélité">
          {cards.length === 0 ? (
            <EmptyState label="Aucune carte émise." icon={<CreditCard size={22} />} />
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-xl p-2.5 text-xs"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div>
                    <p className="text-primary font-medium">{card.numero_carte}</p>
                    <p className="text-muted">Plafond : {formatAriary(card.plafond_credit)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{NIVEAU_CARTE_LABELS[card.niveau]}</Badge>
                    <Badge tone={card.statut === 'ACTIVE' ? 'success' : 'danger'}>{card.statut}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Crédits joueur */}
        <SectionCard
          title="Crédits joueur"
          action={
            <Button
              className="text-xs"
              icon={<Plus size={14} />}
              onClick={() => setShowGrant(true)}
              disabled={!currentSessionId}
            >
              Octroyer
            </Button>
          }
        >
          {!currentSessionId && (
            <p className="text-muted text-[11px] mb-2">
              Ouvrez une session de caisse pour pouvoir octroyer un crédit ou tracer une avance.
            </p>
          )}
          {credits.length === 0 ? (
            <EmptyState label="Aucun crédit enregistré." />
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {credits.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl p-3 text-xs"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-primary font-semibold">{formatAriary(c.montant)} accordé</p>
                    <Badge tone={c.statut === 'EN_RETARD' ? 'danger' : c.statut === 'SOLDE' ? 'success' : 'info'}>
                      {c.statut}
                    </Badge>
                  </div>
                  <p className="text-muted">
                    Encours : {formatAriary(c.encours)} · Échéance {formatDate(c.echeance)}
                  </p>
                  {c.statut !== 'SOLDE' && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="secondary"
                        className="text-[11px] py-1"
                        icon={<HandCoins size={12} />}
                        onClick={() => setShowDraw(c)}
                        disabled={!currentSessionId}
                      >
                        Avance
                      </Button>
                      <Button
                        variant="secondary"
                        className="text-[11px] py-1"
                        icon={<Undo2 size={12} />}
                        onClick={() => setShowRepay(c)}
                      >
                        Rembourser
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Config scoring */}
        <ScoringConfigCard config={scoringConfig} onUpdated={loadAll} />
      </div>

      {showChipTypeForm !== false && (
        <ChipTypeFormModal
          chipType={showChipTypeForm}
          onClose={() => setShowChipTypeForm(false)}
          onSuccess={() => {
            setShowChipTypeForm(false);
            loadAll();
          }}
        />
      )}
      {showGrant && currentSessionId && (
        <CreditGrantModal
          sessionId={currentSessionId}
          onClose={() => setShowGrant(false)}
          onSuccess={() => {
            setShowGrant(false);
            loadAll();
          }}
        />
      )}
      {showDraw && currentSessionId && (
        <CreditDrawModal
          credit={showDraw}
          sessionId={currentSessionId}
          onClose={() => setShowDraw(null)}
          onSuccess={() => {
            setShowDraw(null);
            loadAll();
          }}
        />
      )}
      {showRepay && (
        <CreditRepayModal
          credit={showRepay}
          sessionId={currentSessionId}
          onClose={() => setShowRepay(null)}
          onSuccess={() => {
            setShowRepay(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
};

// -------------------------------------------------------------------------
// Configuration du scoring (rôle admin/manager requis côté API)
// -------------------------------------------------------------------------

const ScoringConfigCard: React.FC<{ config: ScoringConfigItem[]; onUpdated: () => void }> = ({ config, onUpdated }) => {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(cle: string) {
    const valeur = edits[cle];
    if (valeur === undefined) return;
    setSaving(cle);
    setError(null);
    try {
      await scoringApi.updateConfig(cle, valeur);
      onUpdated();
    } catch (e: any) {
      setError(e?.status === 403 ? 'Rôle admin/manager requis pour modifier ce paramètre.' : e?.message || 'Erreur.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <SectionCard title="Configuration du scoring (seuils & plafond)" action={<Settings2 size={16} className="text-muted" />}>
      <p className="text-muted text-[11px] mb-3">
        Poids, seuils et plafond par défaut sont paramétrables par la direction — jamais codés en dur. Un score ne
        déclenche jamais seul un blocage automatique.
      </p>
      {error && <ErrorBanner message={error} />}
      {config.length === 0 ? (
        <EmptyState label="Aucun paramètre chargé." />
      ) : (
        <div className="flex flex-col gap-3">
          {config.map((item) => (
            <Field key={item.cle} label={item.description || item.cle} hint={item.cle}>
              <div className="flex gap-2">
                <TextInput
                  defaultValue={item.valeur}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [item.cle]: e.target.value }))}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  className="text-xs"
                  onClick={() => handleSave(item.cle)}
                  disabled={saving === item.cle}
                >
                  {saving === item.cle ? '...' : 'OK'}
                </Button>
              </div>
            </Field>
          ))}
        </div>
      )}
    </SectionCard>
  );
};

export default CardsCreditsTab;
