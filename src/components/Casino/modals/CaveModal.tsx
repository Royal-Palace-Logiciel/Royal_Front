import React, { useState } from 'react';
import { CheckCircle2, Coins, Plus, Trash2 } from 'lucide-react';
import { Modal, Field, NumberInput, TextInput, Select, Button, ErrorBanner, Badge } from '../common';
import { PlayerSelector } from '../PlayerSelector';
import SignaturePad from '../../SignaturePad';
import { tablesJeuApi, tableCaveSignatureApi } from '../../../services/casinoTablesJeu.service';
import type { TableJeu, StatutPaiementCave } from '../../../types/casinoTablesJeu.types';
import type { MoyenPaiement, SelectedPlayer } from '../../../types/casino.types';

interface CaveModalProps {
  table: TableJeu;
  sessionId: number;
  /** true = recave (pas de minimum imposé), false = cave initiale (montant >= cave_minimum) */
  isRecave?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CaveModal: React.FC<CaveModalProps> = ({ table, sessionId, isRecave = false, onClose, onSuccess }) => {
  const [montant, setMontant] = useState<string>(isRecave ? '' : String(table.cave_minimum));
  const [players, setPlayers] = useState<Array<{
    place: string;
    player: SelectedPlayer | null;
    clientLibre: string;
    numeroAdherent: string;
    signature: string | null;
  }>>([{ place: '1', player: null, clientLibre: '', numeroAdherent: '', signature: null }]);
  const [statutPaiement, setStatutPaiement] = useState<StatutPaiementCave>('PAYE');
  const [moyenPaiement, setMoyenPaiement] = useState<MoyenPaiement>('ESPECES');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const amount = Number(montant);
    if (!amount || amount <= 0) {
      setError('Montant invalide.');
      return;
    }
    if (!isRecave && amount < table.cave_minimum) {
      setError(`La cave initiale doit être au moins de ${table.cave_minimum.toLocaleString('fr-FR')} Ar.`);
      return;
    }
    const seenPlaces = new Set<string>();
    for (const entry of players) {
      if (seenPlaces.has(entry.place)) {
        setError(`La place ${entry.place} est sélectionnée plusieurs fois.`);
        return;
      }
      seenPlaces.add(entry.place);
      if (!entry.player && !entry.clientLibre.trim()) {
        setError(`Sélectionnez un joueur ou saisissez un nom pour la place ${entry.place}.`);
        return;
      }
      if (!entry.signature) {
        setError(`Validez la signature du joueur de la place ${entry.place}.`);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      for (const entry of players) {
        const cave = await tablesJeuApi.addCave(table.id, {
          session_id: sessionId,
          client_id: entry.player?.client.id ?? null,
          client_libre: !entry.player && entry.clientLibre.trim() ? entry.clientLibre.trim() : null,
          numero_adherent: entry.numeroAdherent.trim() || null,
          numero_place: Number(entry.place),
          montant: amount,
          statut_paiement: statutPaiement,
          moyen_paiement: statutPaiement === 'PAYE' ? moyenPaiement : null,
        });
        await tableCaveSignatureApi.sign(cave.id, entry.signature!);
      }
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur lors de l'enregistrement de la cave.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isRecave ? 'Recave' : 'Nouvelle cave'}
      subtitle={`${table.numero} · cave minimum ${table.cave_minimum.toLocaleString('fr-FR')} Ar`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<CheckCircle2 size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Valider la ' + (isRecave ? 'recave' : 'cave')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        <div className="flex items-center gap-2">
          <Badge tone="info"><Coins size={12} className="inline mr-1" />{table.type_jeu}</Badge>
          {!isRecave && <Badge tone="warning">Cave initiale — minimum requis</Badge>}
        </div>

        {table.type_partie === 'TOURNOI' && (
          <p className="text-muted text-xs">Ajoutez les joueurs du tournoi, une place par joueur. Le même montant et le même paiement sont appliqués à tous.</p>
        )}

        {players.map((entry, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-primary text-sm font-semibold">Joueur {index + 1}</p>
              {players.length > 1 && (
                <button type="button" className="text-muted hover:text-primary" onClick={() => setPlayers((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Retirer ce joueur">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <Field label="Numéro de place" required>
              <Select value={entry.place} onChange={(e) => setPlayers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, place: e.target.value } : item))}>
                {Array.from({ length: table.nombre_places }, (_, placeIndex) => (
                  <option key={placeIndex + 1} value={placeIndex + 1}>Place {placeIndex + 1}</option>
                ))}
              </Select>
            </Field>
            <PlayerSelector
              value={entry.player}
              onChange={(player) => setPlayers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, player } : item))}
              allowFree
              freeLabel="Joueur sans fiche (nom libre)"
              freeValue={entry.clientLibre}
              onFreeLabelChange={(clientLibre) => setPlayers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, clientLibre } : item))}
            />
            <Field label="N° d'adhérent (carte de fidélité)">
              <TextInput value={entry.numeroAdherent} onChange={(e) => setPlayers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, numeroAdherent: e.target.value } : item))} placeholder="ADH-0231" />
            </Field>
            <SignaturePad
              value={entry.signature}
              onChange={(signature) => setPlayers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, signature } : item))}
              label={`Signature du joueur ${index + 1}`}
              height={120}
              disabled={loading}
            />
          </div>
        ))}

        {table.type_partie === 'TOURNOI' && players.length < table.nombre_places && (
          <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setPlayers((current) => [...current, { place: String(current.length + 1), player: null, clientLibre: '', numeroAdherent: '', signature: null }])}>
            Ajouter un joueur
          </Button>
        )}

        <Field label={isRecave ? 'Montant de la recave (Ariary)' : 'Montant de la cave (Ariary)'} required>
          <NumberInput value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="100000" min={1} />
        </Field>

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

        <p className="text-muted text-[11px]">
          Cette cave génère une écriture de caisse (buy-in) rattachée à la session en cours et une ligne dans la
          feuille de table de {table.numero}, avec horodatage et signature.
        </p>
      </div>
    </Modal>
  );
};

export default CaveModal;