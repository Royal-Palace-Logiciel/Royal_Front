import React, { useState } from 'react';
import { CheckCircle2, Gift } from 'lucide-react';
import { Modal, Field, NumberInput, Select, Button, ErrorBanner } from '../common';
import { tablesJeuApi } from '../../../services/casinoTablesJeu.service';
import type { TableJeu, TypePourboire } from '../../../types/casinoTablesJeu.types';

interface PourboireModalProps {
  table: TableJeu;
  sessionId: number;
  /** Appelé après enregistrement (ou passage sans pourboire) — le parent enchaîne sur la fermeture de la table. */
  onDone: () => void;
  onClose: () => void;
}

export const PourboireModal: React.FC<PourboireModalProps> = ({ table, sessionId, onDone, onClose }) => {
  const [montant, setMontant] = useState('');
  const [typePourboire, setTypePourboire] = useState<TypePourboire>('ESPECES');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const amount = Number(montant);
    if (!amount || amount <= 0) {
      setError('Montant invalide.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await tablesJeuApi.addPourboire(table.id, { session_id: sessionId, montant: amount, type_pourboire: typePourboire });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur lors de l'enregistrement du pourboire.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Pourboires du croupier"
      subtitle={`${table.numero} · avant fermeture de la table`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onDone} disabled={loading}>
            Aucun pourboire — fermer la table
          </Button>
          <Button icon={<CheckCircle2 size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer et fermer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        <div className="flex items-center gap-2 text-muted text-xs">
          <Gift size={16} />
          Total des pourboires reçus par le croupier sur cette table, à déclarer avant fermeture.
        </div>

        <Field label="Montant total (Ariary)" required>
          <NumberInput value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="20000" min={1} />
        </Field>

        <Field label="Reçu en" required>
          <Select value={typePourboire} onChange={(e) => setTypePourboire(e.target.value as TypePourboire)}>
            <option value="ESPECES">Espèces</option>
            <option value="JETONS">Jetons</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
};

export default PourboireModal;