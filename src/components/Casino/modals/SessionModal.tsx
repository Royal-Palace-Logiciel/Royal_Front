import React, { useState } from 'react';
import { LockKeyhole, Unlock } from 'lucide-react';
import { Modal, Field, NumberInput, TextArea, Button, ErrorBanner, formatAriary, SectionCard } from '../common';
import { sessionsApi } from '../../../services/casino.service';
import type { CashSession, Cashier, SessionSummary } from '../../../types/casino.types';

interface OpenSessionModalProps {
  cashier: Cashier;
  onClose: () => void;
  onSuccess: (session: CashSession) => void;
}

export const OpenSessionModal: React.FC<OpenSessionModalProps> = ({ cashier, onClose, onSuccess }) => {
  const [fondInitial, setFondInitial] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const amount = Number(fondInitial);
    if (!fondInitial || amount < 0) {
      setError('Fond initial invalide.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await sessionsApi.open({ cashier_id: cashier.id, fond_initial: amount });
      onSuccess(session);
    } catch (e: any) {
      setError(
        e?.status === 409
          ? 'Une session est déjà ouverte pour cette caisse.'
          : e?.message || "Erreur à l'ouverture de la session."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={`Ouvrir la caisse — ${cashier.nom}`}
      subtitle="Déclarez le fond de caisse initial avant la première opération"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<Unlock size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Ouverture…' : 'Ouvrir la session'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Fond initial (Ariary)" required>
          <NumberInput
            value={fondInitial}
            onChange={(e) => setFondInitial(e.target.value)}
            placeholder="200000"
            min={0}
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  );
};

interface CloseSessionModalProps {
  session: CashSession;
  summary: SessionSummary | null;
  onClose: () => void;
  onSuccess: (session: CashSession) => void;
}

export const CloseSessionModal: React.FC<CloseSessionModalProps> = ({ session, summary, onClose, onSuccess }) => {
  const [fondDeclare, setFondDeclare] = useState(String(session.fond_final_declare ?? ''));
  const [cashCheck, setCashCheck] = useState(String(session.cash_check ?? ''));
  const [cashingVerified, setCashingVerified] = useState(Boolean(session.cashing_verifie));
  const [cashingAmount, setCashingAmount] = useState(String(session.cashing_montant_verifie ?? session.fond_final_declare ?? ''));
  const [rackCheckVerified, setRackCheckVerified] = useState(Boolean(session.rack_check_verifie));
  const [rackCheckAmount, setRackCheckAmount] = useState(String(session.rack_check_montant ?? 220000));
  const [rackCheckMissing, setRackCheckMissing] = useState(String(session.rack_check_manquant ?? ''));
  const [commentaire, setCommentaire] = useState(session.commentaire || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theorique = summary?.solde_theorique ?? null;
  const ecartPrevisionnel = theorique !== null && fondDeclare ? Number(fondDeclare) - theorique : null;
  const cashCheckManquant = Number(cashCheck || 0) || (ecartPrevisionnel !== null && ecartPrevisionnel < 0 ? Math.abs(ecartPrevisionnel) : 0);

  async function handleSubmit() {
    if (!fondDeclare) {
      setError('Le fond final déclaré est requis.');
      return;
    }
    if (cashingVerified && (!cashingAmount || Number(cashingAmount) <= 0)) {
      setError('Le montant vérifié en espèces est requis pour valider le cashing.');
      return;
    }
    if (rackCheckVerified && (!rackCheckAmount || Number(rackCheckAmount) <= 0)) {
      setError('Le montant du rack vérifié est requis pour valider le rack check.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await sessionsApi.close(session.id, {
        fond_final_declare: Number(fondDeclare),
        cash_check: Number(cashCheck || 0) || undefined,
        cashing_verifie: cashingVerified,
        cashing_montant: cashingVerified ? Number(cashingAmount) : undefined,
        rack_check_verifie: rackCheckVerified,
        rack_check_montant: rackCheckVerified ? Number(rackCheckAmount) : undefined,
        rack_check_manquant: rackCheckVerified ? Number(rackCheckMissing || 0) : undefined,
        commentaire: commentaire.trim() || undefined,
      });
      onSuccess(updated);
    } catch (e: any) {
      setError(e?.message || 'Erreur à la fermeture de la session.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Clôturer la session de caisse"
      subtitle={`Ouverte le ${session.ouverture_at}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<LockKeyhole size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Clôture…' : 'Clôturer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        <SectionCard title="Résumé en direct">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted text-xs">Fond initial</p>
              <p className="text-primary font-semibold">{formatAriary(session.fond_initial)}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Solde théorique</p>
              <p className="text-primary font-semibold">{formatAriary(theorique)}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Total entrées</p>
              <p className="text-primary font-semibold">{formatAriary(summary?.total_entrees)}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Total sorties</p>
              <p className="text-primary font-semibold">{formatAriary(summary?.total_sorties)}</p>
            </div>
          </div>
        </SectionCard>

        <Field label="Fond final déclaré (comptage physique, Ariary)" required>
          <NumberInput
            value={fondDeclare}
            onChange={(e) => setFondDeclare(e.target.value)}
            placeholder="850000"
            min={0}
            autoFocus
          />
        </Field>

        {ecartPrevisionnel !== null && (
          <p
            className="text-sm font-semibold"
            style={{ color: ecartPrevisionnel === 0 ? '#22c55e' : ecartPrevisionnel > 0 ? '#3b82f6' : '#ef4444' }}
          >
            Écart prévisionnel : {ecartPrevisionnel > 0 ? '+' : ''}
            {formatAriary(ecartPrevisionnel)}
          </p>
        )}

        <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-sm">
          <label className="flex items-center gap-3 text-primary font-medium">
            <input
              type="checkbox"
              checked={cashingVerified}
              onChange={(e) => setCashingVerified(e.target.checked)}
            />
            Le caissier confirme que le montant en espèces en caisse est bien vérifié.
          </label>
        </div>

        {cashingVerified && (
          <Field label="Montant vérifié en espèces (Ariary)">
            <NumberInput
              value={cashingAmount}
              onChange={(e) => setCashingAmount(e.target.value)}
              placeholder={String(fondDeclare || 0)}
              min={0}
            />
          </Field>
        )}

        <div className="rounded-xl border border-violet-400/30 bg-violet-500/5 p-3 text-sm">
          <label className="flex items-center gap-3 text-primary font-medium">
            <input
              type="checkbox"
              checked={rackCheckVerified}
              onChange={(e) => setRackCheckVerified(e.target.checked)}
            />
            Le caissier confirme que le rack du croupier contient bien 220 000 Ariary en jetons.
          </label>
        </div>

        {rackCheckVerified && (
          <>
            <Field label="Montant vérifié dans le rack (Ariary)">
              <NumberInput
                value={rackCheckAmount}
                onChange={(e) => setRackCheckAmount(e.target.value)}
                placeholder="220000"
                min={0}
              />
            </Field>
            <Field label="Manque de jetons dans le rack (Ariary)">
              <NumberInput
                value={rackCheckMissing}
                onChange={(e) => setRackCheckMissing(e.target.value)}
                placeholder="0"
                min={0}
              />
            </Field>
          </>
        )}

        <Field label="Cash check / manque de caisse (Ariary)">
          <NumberInput
            value={cashCheck}
            onChange={(e) => setCashCheck(e.target.value)}
            placeholder="15000"
            min={0}
          />
        </Field>

        {cashCheckManquant > 0 && (
          <p className="text-sm font-semibold text-red-400">
            Manque de caisse à relever : {formatAriary(cashCheckManquant)}
          </p>
        )}

        <Field label="Commentaire">
          <TextArea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="RAS" />
        </Field>
      </div>
    </Modal>
  );
};
