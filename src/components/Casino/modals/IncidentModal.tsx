import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, Field, Select, TextArea, Button, ErrorBanner } from '../common';
import { incidentsApi } from '../../../services/casino.service';
import type { Incident, TypeIncident, GraviteIncident } from '../../../types/casino.types';

interface IncidentModalProps {
  clientId: number;
  sessionId?: number | null;
  onClose: () => void;
  onSuccess: (incident: Incident) => void;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({ clientId, sessionId, onClose, onSuccess }) => {
  const [type, setType] = useState<TypeIncident>('INCIDENT');
  const [gravite, setGravite] = useState<GraviteIncident>('FAIBLE');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!description.trim()) {
      setError('La description est requise.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const incident = await incidentsApi.create({
        client_id: clientId,
        session_id: sessionId ?? null,
        type,
        gravite,
        description: description.trim(),
        statut: 'OUVERT',
      });
      onSuccess(incident);
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'enregistrement de l'incident.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Déclarer un incident / litige"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<AlertTriangle size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Déclarer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as TypeIncident)}>
            <option value="INCIDENT">Incident</option>
            <option value="LITIGE">Litige</option>
          </Select>
        </Field>
        <Field label="Gravité">
          <Select value={gravite} onChange={(e) => setGravite(e.target.value as GraviteIncident)}>
            <option value="FAIBLE">Faible</option>
            <option value="MOYENNE">Moyenne</option>
            <option value="ELEVEE">Élevée</option>
          </Select>
        </Field>
        <Field label="Description" required>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrire les faits observés…"
            rows={4}
          />
        </Field>
      </div>
    </Modal>
  );
};

export default IncidentModal;
