import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal, Field, TextInput, NumberInput, Select, Button, ErrorBanner } from '../common';
import { chipTypesApi } from '../../../services/casino.service';
import type { ChipType, StatutChipType } from '../../../types/casino.types';

interface ChipTypeFormModalProps {
  chipType?: ChipType | null;
  onClose: () => void;
  onSuccess: (chipType: ChipType) => void;
}

const COLOR_PRESETS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#0f172a', '#ffffff'];

export const ChipTypeFormModal: React.FC<ChipTypeFormModalProps> = ({ chipType, onClose, onSuccess }) => {
  const isEdit = !!chipType;
  const [code, setCode] = useState(chipType?.code || '');
  const [nom, setNom] = useState(chipType?.nom || '');
  const [valeur, setValeur] = useState(chipType ? String(chipType.valeur_nominale) : '');
  const [couleur, setCouleur] = useState(chipType?.couleur || COLOR_PRESETS[0]);
  const [quantiteStock, setQuantiteStock] = useState(chipType ? String(chipType.quantite_stock) : '0');
  const [statut, setStatut] = useState<StatutChipType>(chipType?.statut || 'ACTIF');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!code.trim() || !nom.trim() || !valeur) {
      setError('Code, nom et valeur nominale sont requis.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        code: code.trim(),
        nom: nom.trim(),
        valeur_nominale: Number(valeur),
        couleur,
        statut,
        quantite_stock: Number(quantiteStock) || 0,
      };
      const result = isEdit ? await chipTypesApi.update(chipType!.id, payload) : await chipTypesApi.create(payload);
      onSuccess(result);
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'enregistrement du type de jeton.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Modifier le type de jeton' : 'Nouveau type de jeton'}
      onClose={onClose}
      size="sm"
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

        <Field label="Code" required>
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="JT-1000" />
        </Field>
        <Field label="Nom" required>
          <TextInput value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Jeton 1000 Ar" />
        </Field>
        <Field label="Valeur nominale (Ariary)" required>
          <NumberInput value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="1000" min={1} />
        </Field>
        <Field label="Quantité en stock" hint="Nombre de jetons physiquement disponibles pour ce type">
          <NumberInput
            value={quantiteStock}
            onChange={(e) => setQuantiteStock(e.target.value)}
            placeholder="500"
            min={0}
          />
        </Field>
        <Field label="Couleur">
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setCouleur(c)}
                className="w-7 h-7 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: c,
                  border: couleur === c ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                }}
                aria-label={c}
              />
            ))}
            <TextInput
              value={couleur}
              onChange={(e) => setCouleur(e.target.value)}
              className="w-28 flex-shrink-0"
              placeholder="#ef4444"
            />
          </div>
        </Field>
        <Field label="Statut">
          <Select value={statut} onChange={(e) => setStatut(e.target.value as StatutChipType)}>
            <option value="ACTIF">Actif</option>
            <option value="INACTIF">Inactif</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
};

export default ChipTypeFormModal;
