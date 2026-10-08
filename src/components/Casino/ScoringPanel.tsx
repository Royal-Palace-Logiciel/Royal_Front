import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, ShieldAlert, ShieldX, Gavel } from 'lucide-react';
import {
  SectionCard,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  TextArea,
  Field,
  formatDateTime,
  categorieScoreTone,
} from './common';
import { scoringApi } from '../../services/casino.service';
import type { Score, DecisionScore } from '../../types/casino.types';
import { CATEGORIE_SCORE_LABELS } from '../../types/casino.types';

interface ScoringPanelProps {
  clientId: number;
}

const FACTEUR_LABELS: Record<string, string> = {
  ratio_remboursement: 'Ratio de remboursement',
  retard_moyen_jours: 'Retard moyen (jours)',
  encours_vs_plafond: 'Encours vs plafond',
  anciennete_mois: 'Ancienneté (mois)',
  regularite_visites_12m: 'Régularité des visites (12 mois)',
};

/**
 * Scoring de crédit joueur — basé exclusivement sur des faits enregistrés
 * (remboursements, retards, encours, ancienneté, régularité). Le calcul ne
 * modifie jamais le statut spécial du client : toute conséquence (VIP,
 * surveillance, exclusion) exige une décision humaine séparée et explicite
 * via l'onglet "Antécédents".
 */
export const ScoringPanel: React.FC<ScoringPanelProps> = ({ clientId }) => {
  const [history, setHistory] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contestingId, setContestingId] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState('');

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const data = await scoringApi.history(clientId);
      setHistory(data);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement du score.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleCompute() {
    setComputing(true);
    setError(null);
    try {
      await scoringApi.compute(clientId);
      await loadHistory();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du calcul du score.');
    } finally {
      setComputing(false);
    }
  }

  async function handleDecision(scoreId: number, decision: Exclude<DecisionScore, 'AUCUNE'>) {
    setError(null);
    try {
      await scoringApi.decide(scoreId, { decision, commentaire: commentaire.trim() || undefined });
      setContestingId(null);
      setCommentaire('');
      await loadHistory();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la décision.');
    }
  }

  const latest = history[0];

  return (
    <SectionCard
      title="Scoring de crédit joueur"
      action={
        <Button
          variant="secondary"
          icon={<RefreshCw size={14} className={computing ? 'animate-spin' : ''} />}
          onClick={handleCompute}
          disabled={computing}
          className="text-xs"
        >
          {computing ? 'Calcul…' : 'Recalculer'}
        </Button>
      }
    >
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <Spinner label="Chargement du score…" />
      ) : !latest ? (
        <EmptyState label="Aucun score calculé pour ce client." />
      ) : (
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-bold text-primary">{latest.score}</span>
            <Badge tone={categorieScoreTone(latest.categorie)}>
              {CATEGORIE_SCORE_LABELS[latest.categorie] || latest.categorie}
            </Badge>
            <span className="text-muted text-xs">Calculé le {formatDateTime(latest.calcule_le)}</span>
            {latest.decision !== 'AUCUNE' && (
              <Badge
                tone={latest.decision === 'VALIDEE' ? 'success' : latest.decision === 'CONTESTEE' ? 'warning' : 'neutral'}
              >
                {latest.decision}
              </Badge>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            {Object.entries(latest.facteurs || {})
              .filter(([key]) => key !== 'seuils')
              .map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl p-3 text-xs"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <p className="text-muted mb-1">{FACTEUR_LABELS[key] || key}</p>
                  <pre className="text-primary text-[11px] whitespace-pre-wrap font-mono">
                    {JSON.stringify(value, null, 0)}
                  </pre>
                </div>
              ))}
          </div>

          {latest.facteurs?.seuils && (
            <p className="text-muted text-[11px]">
              Seuils appliqués — bon payeur ≥ {latest.facteurs.seuils.seuil_bon_payeur}, moyen payeur ≥{' '}
              {latest.facteurs.seuils.seuil_moyen_payeur} (paramétrables par la direction).
            </p>
          )}

          <div
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <p className="text-xs text-secondary">
              Ce score n'entraîne aucun blocage automatique. Toute conséquence (VIP, surveillance, exclusion) exige
              une décision humaine explicite dans l'onglet « Antécédents ». Le client peut contester ce calcul.
            </p>
            {latest.decision === 'AUCUNE' && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  icon={<ShieldCheck size={14} />}
                  className="text-xs"
                  onClick={() => handleDecision(latest.id, 'VALIDEE')}
                >
                  Valider le score
                </Button>
                <Button
                  variant="secondary"
                  icon={<ShieldAlert size={14} />}
                  className="text-xs"
                  onClick={() => setContestingId(latest.id)}
                >
                  Contester
                </Button>
                <Button
                  variant="secondary"
                  icon={<ShieldX size={14} />}
                  className="text-xs"
                  onClick={() => handleDecision(latest.id, 'ANNULEE')}
                >
                  Annuler
                </Button>
              </div>
            )}
            {contestingId === latest.id && (
              <div className="flex flex-col gap-2 mt-1">
                <Field label="Motif de la contestation">
                  <TextArea
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    placeholder="Le client conteste le calcul, cf. pièce jointe…"
                  />
                </Field>
                <Button
                  icon={<Gavel size={14} />}
                  className="text-xs w-fit"
                  onClick={() => handleDecision(latest.id, 'CONTESTEE')}
                >
                  Enregistrer la contestation
                </Button>
              </div>
            )}
            {latest.decision === 'CONTESTEE' && latest.commentaire_contestation && (
              <p className="text-xs text-muted italic">« {latest.commentaire_contestation} »</p>
            )}
          </div>

          {history.length > 1 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted">Historique des scores précédents ({history.length - 1})</summary>
              <div className="flex flex-col gap-1.5 mt-2">
                {history.slice(1).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-muted">
                    <span>{formatDateTime(s.calcule_le)}</span>
                    <span>
                      {s.score} · {CATEGORIE_SCORE_LABELS[s.categorie] || s.categorie}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </SectionCard>
  );
};

export default ScoringPanel;
