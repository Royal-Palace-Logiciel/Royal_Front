import React, { useState } from 'react';
import { CheckCircle2, HandCoins } from 'lucide-react';
import { Modal, Field, NumberInput, TextInput, Select, Button, ErrorBanner, formatAriary, Badge } from '../common';
import { PlayerSelector } from '../PlayerSelector';
import { creditsApi } from '../../../services/casino.service';
import type { PlayerCredit, CreditRepayment, MoyenPaiement, SelectedPlayer } from '../../../types/casino.types';

// -------------------------------------------------------------------------
// Octroi d'un nouveau crédit
// -------------------------------------------------------------------------

interface CreditGrantModalProps {
  sessionId: number;
  onClose: () => void;
  onSuccess: (credit: PlayerCredit) => void;
}

export const CreditGrantModal: React.FC<CreditGrantModalProps> = ({ sessionId, onClose, onSuccess }) => {
  const [player, setPlayer] = useState<SelectedPlayer | null>(null);
  const [montant, setMontant] = useState('');
  const [echeance, setEcheance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!player) {
      setError('Un crédit joueur nécessite un client identifié (carte ou fiche).');
      return;
    }
    if (!montant || Number(montant) <= 0) {
      setError('Montant invalide.');
      return;
    }
    if (!echeance) {
      setError("Date d'échéance requise.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credit = await creditsApi.grant({
        client_id: player.client.id,
        montant: Number(montant),
        echeance,
        session_id: sessionId,
      });
      onSuccess(credit);
    } catch (e: any) {
      setError(
        e?.status === 409
          ? 'Plafond de crédit dépassé pour ce client.'
          : e?.message || "Erreur lors de l'octroi du crédit."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Octroyer un crédit joueur"
      subtitle="Le plafond de la carte (ou le plafond par défaut) est vérifié automatiquement"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<CheckCircle2 size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Octroi…' : 'Octroyer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <PlayerSelector value={player} onChange={setPlayer} />
        {player?.card?.plafond_credit != null && (
          <p className="text-muted text-xs">Plafond de la carte : {formatAriary(player.card.plafond_credit)}</p>
        )}
        <Field label="Montant du crédit (Ariary)" required>
          <NumberInput value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="300000" min={1} />
        </Field>
        <Field label="Échéance" required>
          <TextInput type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
};

// -------------------------------------------------------------------------
// Tirage sur un crédit déjà accordé (avance)
// -------------------------------------------------------------------------

interface CreditDrawModalProps {
  credit: PlayerCredit;
  sessionId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreditDrawModal: React.FC<CreditDrawModalProps> = ({ credit, sessionId, onClose, onSuccess }) => {
  const [montant, setMontant] = useState('');
  const [moyenPaiement, setMoyenPaiement] = useState<MoyenPaiement>('ESPECES');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!montant || Number(montant) <= 0) {
      setError('Montant invalide.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await creditsApi.draw(credit.id, { session_id: sessionId, montant: Number(montant), moyen_paiement: moyenPaiement });
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du tirage sur le crédit.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Avance sur crédit"
      subtitle={`Encours actuel : ${formatAriary(credit.encours)}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<HandCoins size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Traitement…' : 'Confirmer l’avance'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Montant de l'avance (Ariary)" required>
          <NumberInput value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="50000" min={1} />
        </Field>
        <Field label="Moyen de paiement">
          <Select value={moyenPaiement} onChange={(e) => setMoyenPaiement(e.target.value as MoyenPaiement)}>
            <option value="ESPECES">Espèces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CARTE">Carte bancaire</option>
            <option value="VIREMENT">Virement</option>
            <option value="AUTRE">Autre</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
};

// -------------------------------------------------------------------------
// Remboursement d'un crédit
// -------------------------------------------------------------------------

interface CreditRepayModalProps {
  credit: PlayerCredit;
  sessionId?: number;
  onClose: () => void;
  onSuccess: (repayment: CreditRepayment) => void;
}

export const CreditRepayModal: React.FC<CreditRepayModalProps> = ({ credit, sessionId, onClose, onSuccess }) => {
  const [montant, setMontant] = useState('');
  const [moyenPaiement, setMoyenPaiement] = useState<MoyenPaiement>('ESPECES');
  const [traceEnCaisse, setTraceEnCaisse] = useState(!!sessionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!montant || Number(montant) <= 0) {
      setError('Montant invalide.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const repayment = await creditsApi.repay(credit.id, {
        montant: Number(montant),
        moyen_paiement: moyenPaiement,
        session_id: traceEnCaisse ? sessionId : undefined,
      });
      onSuccess(repayment);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du remboursement.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Remboursement de crédit"
      subtitle={`Échéance : ${credit.echeance} · Encours : ${formatAriary(credit.encours)}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<CheckCircle2 size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer le remboursement'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        {credit.statut === 'EN_RETARD' && <Badge tone="danger">Crédit en retard</Badge>}
        <Field label="Montant remboursé (Ariary)" required>
          <NumberInput value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="100000" min={1} />
        </Field>
        <Field label="Moyen de paiement">
          <Select value={moyenPaiement} onChange={(e) => setMoyenPaiement(e.target.value as MoyenPaiement)}>
            <option value="ESPECES">Espèces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CARTE">Carte bancaire</option>
            <option value="VIREMENT">Virement</option>
            <option value="AUTRE">Autre</option>
          </Select>
        </Field>
        {sessionId && (
          <label className="flex items-center gap-2 text-xs text-secondary">
            <input type="checkbox" checked={traceEnCaisse} onChange={(e) => setTraceEnCaisse(e.target.checked)} />
            Tracer aussi comme opération de caisse (session ouverte courante)
          </label>
        )}
      </div>
    </Modal>
  );
};
