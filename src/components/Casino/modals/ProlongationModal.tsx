import React, { useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { Modal, Field, Select, Button, ErrorBanner, Badge } from '../common';
import { PlayerSelector } from '../PlayerSelector';
import SignaturePad from '../../SignaturePad';
import { tablesJeuApi, tableProlongationSignatureApi } from '../../../services/casinoTablesJeu.service';
import type { TableJeu, StatutPaiementCave } from '../../../types/casinoTablesJeu.types';
import type { MoyenPaiement, SelectedPlayer } from '../../../types/casino.types';

interface ProlongationModalProps {
  table: TableJeu;
  sessionId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProlongationModal: React.FC<ProlongationModalProps> = ({ table, sessionId, onClose, onSuccess }) => {
  const [player, setPlayer] = useState<SelectedPlayer | null>(null);
  const [clientLibre, setClientLibre] = useState('');
  const [statutPaiement, setStatutPaiement] = useState<StatutPaiementCave>('PAYE');
  const [moyenPaiement, setMoyenPaiement] = useState<MoyenPaiement>('ESPECES');
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!player && !clientLibre.trim()) {
      setError('Sélectionnez le joueur à qui la prolongation est facturée.');
      return;
    }
    if (!signature) {
      setError("Validez la signature du joueur avant d'enregistrer la prolongation.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const prolongation = await tablesJeuApi.addProlongation(table.id, {
        session_id: sessionId,
        client_id: player?.client.id ?? null,
        client_libre: !player && clientLibre.trim() ? clientLibre.trim() : null,
        statut_paiement: statutPaiement,
        moyen_paiement: statutPaiement === 'PAYE' ? moyenPaiement : null,
      });
      await tableProlongationSignatureApi.sign(prolongation.id, signature);
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur lors de l'enregistrement de la prolongation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Prolongation"
      subtitle={`${table.numero} · salaire croupier ${table.salaire_horaire_croupier.toLocaleString('fr-FR')} Ar/h`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<CheckCircle2 size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Valider la prolongation'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        <div className="flex items-center gap-2">
          <Badge tone="info">
            <Clock size={12} className="inline mr-1" />
            {table.salaire_horaire_croupier.toLocaleString('fr-FR')} Ar
          </Badge>
          <p className="text-muted text-[11px]">
            Salaire horaire du croupier pour cette période, à la charge du joueur.
          </p>
        </div>

        <PlayerSelector
          value={player}
          onChange={setPlayer}
          allowFree
          freeLabel="Joueur sans fiche (nom libre)"
          freeValue={clientLibre}
          onFreeLabelChange={setClientLibre}
        />

        <Field label="Statut du paiement" required>
          <Select value={statutPaiement} onChange={(e) => setStatutPaiement(e.target.value as StatutPaiementCave)}>
            <option value="PAYE">Payé</option>
            <option value="NON_PAYE">Non payé</option>
          </Select>
        </Field>

        {statutPaiement === 'PAYE' && (
          <Field label="Moyen de paiement" required>
            <Select value={moyenPaiement} onChange={(e) => setMoyenPaiement(e.target.value as MoyenPaiement)}>
              <option value="ESPECES">Espèces</option>
              <option value="CARTE">TPE / Carte bancaire</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="VIREMENT">Virement</option>
              <option value="AUTRE">Autre</option>
            </Select>
          </Field>
        )}

        <SignaturePad
          value={signature}
          onChange={setSignature}
          label="Signature du joueur"
          height={140}
          disabled={loading}
        />

        <p className="text-muted text-[11px]">
          Cette prolongation relance la période de {table.duree_prolongation_minutes} min et apparaîtra dans la
          feuille de table sous « Total prolongation ».
        </p>
      </div>
    </Modal>
  );
};

export default ProlongationModal;