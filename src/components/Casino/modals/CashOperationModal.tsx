import React, { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Wallet, CheckCircle2 } from 'lucide-react';
import { Modal, Field, NumberInput, Select, Button, ErrorBanner } from '../common';
import { PlayerSelector } from '../PlayerSelector';
import { operationsApi } from '../../../services/casino.service';
import type { CashOperation, MoyenPaiement, SelectedPlayer } from '../../../types/casino.types';

type OperationKind = 'buy-in' | 'cash-out' | 'deposit';

const KIND_CONFIG: Record<OperationKind, { label: string; icon: React.ReactNode; sens: 'entrée' | 'sortie'; helper: string }> = {
  'buy-in': {
    label: 'Achat de jetons (buy-in)',
    icon: <ArrowDownCircle size={16} />,
    sens: 'entrée',
    helper: 'Le client verse du cash en échange de jetons de jeu.',
  },
  deposit: {
    label: 'Encaissement (dépôt)',
    icon: <Wallet size={16} />,
    sens: 'entrée',
    helper: "Dépôt d'espèces du client en caisse, sans remise de jetons.",
  },
  'cash-out': {
    label: 'Remboursement / cash-out',
    icon: <ArrowUpCircle size={16} />,
    sens: 'sortie',
    helper: 'Le client récupère du cash (reprise de jetons ou remboursement).',
  },
};

interface CashOperationModalProps {
  sessionId: number;
  defaultKind?: OperationKind;
  onClose: () => void;
  onSuccess: (op: CashOperation) => void;
}

export const CashOperationModal: React.FC<CashOperationModalProps> = ({
  sessionId,
  defaultKind = 'buy-in',
  onClose,
  onSuccess,
}) => {
  const [kind, setKind] = useState<OperationKind>(defaultKind);
  const [montant, setMontant] = useState<string>('');
  const [moyenPaiement, setMoyenPaiement] = useState<MoyenPaiement>('ESPECES');
  const [player, setPlayer] = useState<SelectedPlayer | null>(null);
  const [clientLibre, setClientLibre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = KIND_CONFIG[kind];

  async function handleSubmit() {
    const amount = Number(montant);
    if (!amount || amount <= 0) {
      setError('Montant invalide.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        session_id: sessionId,
        montant: amount,
        moyen_paiement: moyenPaiement,
        client_id: player?.client.id ?? null,
        client_libre: !player && clientLibre.trim() ? clientLibre.trim() : null,
      };
      const fn =
        kind === 'buy-in' ? operationsApi.buyIn : kind === 'deposit' ? operationsApi.deposit : operationsApi.cashOut;
      const op = await fn(payload);
      onSuccess(op);
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'enregistrement de l'opération.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Nouvelle opération de caisse"
      subtitle="Chaque opération est horodatée et rattachée au caissier connecté"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<CheckCircle2 size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Valider'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        <Field label="Type d'opération">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(KIND_CONFIG) as OperationKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className="flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: kind === k ? 'var(--color-accent)' : 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: kind === k ? '#000' : 'inherit',
                }}
              >
                {KIND_CONFIG[k].icon}
                {KIND_CONFIG[k].label}
              </button>
            ))}
          </div>
          <p className="text-muted text-[11px] mt-1">{config.helper}</p>
        </Field>

        <Field label="Montant (Ariary)" required>
          <NumberInput
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="100000"
            min={1}
          />
        </Field>

        <Field label="Moyen de paiement" required>
          <Select value={moyenPaiement} onChange={(e) => setMoyenPaiement(e.target.value as MoyenPaiement)}>
            <option value="ESPECES">Espèces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CARTE">Carte bancaire</option>
            <option value="VIREMENT">Virement</option>
            <option value="AUTRE">Autre</option>
          </Select>
        </Field>

        <PlayerSelector
          value={player}
          onChange={setPlayer}
          allowFree
          freeLabel="Client de passage (nom libre, optionnel)"
          freeValue={clientLibre}
          onFreeLabelChange={setClientLibre}
        />

        <p className="text-muted text-[11px]">
          Cette opération générera automatiquement une écriture dans le module financier global (référence de
          liaison <code>ref_flux_global</code>), sens « {config.sens} ».
        </p>
      </div>
    </Modal>
  );
};

export default CashOperationModal;
