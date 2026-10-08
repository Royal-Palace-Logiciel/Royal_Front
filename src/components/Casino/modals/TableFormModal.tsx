import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal, Field, TextInput, NumberInput, Select, Button, ErrorBanner } from '../common';
import { tablesJeuApi } from '../../../services/casinoTablesJeu.service';
import type { TableJeu, TypeJeu, TypePartie } from '../../../types/casinoTablesJeu.types';
import { TYPE_JEU_LABELS } from '../../../types/casinoTablesJeu.types';
import type { Room } from '../../../types/casino.types';

interface TableFormModalProps {
  room: Room;
  cashierId?: number | null;
  table?: TableJeu | null; // null/undefined = création
  onClose: () => void;
  onSuccess: () => void;
}

export const TableFormModal: React.FC<TableFormModalProps> = ({ room, cashierId, table, onClose, onSuccess }) => {
  const isEdit = !!table;
  const [numero, setNumero] = useState(table?.numero || '');
  const [typeJeu, setTypeJeu] = useState<TypeJeu>(table?.type_jeu || 'POKER');
  const [typePartie, setTypePartie] = useState<TypePartie>(table?.type_partie || 'JEU_SIMPLE');
  const [nombrePlaces, setNombrePlaces] = useState(String(table?.nombre_places || 8));
  const [caveMinimum, setCaveMinimum] = useState<string>(table ? String(table.cave_minimum) : '');
  const [salaireHoraireCroupier, setSalaireHoraireCroupier] = useState<string>(
    table ? String(table.salaire_horaire_croupier) : ''
  );
  const [dureeJeuSimple, setDureeJeuSimple] = useState<string>(
    table ? String(table.duree_jeu_simple_minutes) : '120'
  );
  const [dureeProlongation, setDureeProlongation] = useState<string>(
    table ? String(table.duree_prolongation_minutes) : '60'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!numero.trim()) {
      setError('Le numéro/nom de la table est requis.');
      return;
    }
    const min = Number(caveMinimum);
    if (!min || min <= 0) {
      setError('La cave minimum doit être un montant positif.');
      return;
    }
    const places = Number(nombrePlaces);
    if (!Number.isInteger(places) || places < 2 || places > 100) {
      setError('Le nombre de places doit être compris entre 2 et 100.');
      return;
    }
    if (!table && !cashierId) {
      setError('Sélectionnez une caisse avant de créer la table.');
      return;
    }
    const salaire = Number(salaireHoraireCroupier);
    if (!salaire || salaire <= 0) {
      setError('Le salaire horaire du croupier doit être un montant positif.');
      return;
    }
    const duree = Number(dureeProlongation);
    if (!duree || duree <= 0) {
      setError('La durée de prolongation doit être positive (en minutes).');
      return;
    }
    const dureeSimple = Number(dureeJeuSimple);
    if (!dureeSimple || dureeSimple <= 0) {
      setError('Le temps de jeu simple doit être positif (en minutes).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        room_id: room.id,
        ...(cashierId ? { cashier_id: cashierId } : {}),
        numero: numero.trim(),
        type_jeu: typeJeu,
        type_partie: typePartie,
        nombre_places: places,
        cave_minimum: min,
        salaire_horaire_croupier: salaire,
        duree_jeu_simple_minutes: dureeSimple,
        duree_prolongation_minutes: duree,
      };
      if (isEdit && table) {
        await tablesJeuApi.update(table.id, payload);
      } else {
        await tablesJeuApi.create(payload);
      }
      onSuccess();
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          e?.message ||
          "Erreur lors de l'enregistrement de la table."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Modifier la table' : 'Nouvelle table de jeu'}
      subtitle={`Salle : ${room.nom}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<CheckCircle2 size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        <Field label="Numéro / nom de la table" required>
          <TextInput value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Table 1" />
        </Field>

        <Field label="Type de jeu" required>
          <Select value={typeJeu} onChange={(e) => setTypeJeu(e.target.value as TypeJeu)}>
            {(Object.keys(TYPE_JEU_LABELS) as TypeJeu[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_JEU_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Format de la partie" required>
          <Select value={typePartie} onChange={(e) => setTypePartie(e.target.value as TypePartie)}>
            <option value="JEU_SIMPLE">Jeu simple — changement de place autorisé</option>
            <option value="TOURNOI">Tournoi — places fixes</option>
          </Select>
        </Field>

        <Field label="Nombre de places" required>
          <NumberInput value={nombrePlaces} onChange={(e) => setNombrePlaces(e.target.value)} min={2} max={100} />
        </Field>

        <Field label="Cave minimum (Ariary)" required>
          <NumberInput value={caveMinimum} onChange={(e) => setCaveMinimum(e.target.value)} placeholder="100000" min={1} />
          <p className="text-muted text-[11px] mt-1">
            Montant requis pour la cave initiale d'un joueur. Les recaves n'ont pas de minimum.
          </p>
        </Field>

        <Field label="Salaire horaire croupier (Ar)" required>
          <NumberInput
            value={salaireHoraireCroupier}
            onChange={(e) => setSalaireHoraireCroupier(e.target.value)}
            placeholder="15000"
            min={1}
          />
          <p className="text-muted text-[11px] mt-1">
            Montant à charge du joueur pour chaque prolongation accordée.
          </p>
        </Field>

        <Field label="Temps de jeu simple, sans prolongation (min)" required>
          <NumberInput
            value={dureeJeuSimple}
            onChange={(e) => setDureeJeuSimple(e.target.value)}
            placeholder="120"
            min={1}
          />
          <p className="text-muted text-[11px] mt-1">
            Décompté dès la création de la table. À la fin de ce temps : label « Temps de jeu terminé » et
            affichage du bouton « Prolongation » pour la première fois.
          </p>
        </Field>

        <Field label="Durée d'une prolongation (min)" required>
          <NumberInput
            value={dureeProlongation}
            onChange={(e) => setDureeProlongation(e.target.value)}
            placeholder="60"
            min={1}
          />
          <p className="text-muted text-[11px] mt-1">
            Une fois une prolongation accordée, ce temps se décompte à son tour ; à la fin : label « Timeout Pour
            la Prolongation » et le bouton redevient disponible pour une prolongation suivante.
          </p>
        </Field>
      </div>
    </Modal>
  );
};

export default TableFormModal;