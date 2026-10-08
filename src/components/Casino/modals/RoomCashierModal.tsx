import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal, Field, TextInput, Select, Button, ErrorBanner } from '../common';
import { roomsApi, cashiersApi } from '../../../services/casino.service';
import type { Room, Cashier, TypeSalle, StatutSalle, StatutCaisse } from '../../../types/casino.types';
import { TYPE_SALLE_LABELS } from '../../../types/casino.types';

interface RoomFormModalProps {
  room?: Room | null;
  onClose: () => void;
  onSuccess: (room: Room) => void;
}

export const RoomFormModal: React.FC<RoomFormModalProps> = ({ room, onClose, onSuccess }) => {
  const isEdit = !!room;
  const [code, setCode] = useState(room?.code || '');
  const [nom, setNom] = useState(room?.nom || '');
  const [typeSalle, setTypeSalle] = useState<TypeSalle>(room?.type_salle || 'MACHINES');
  const [statut, setStatut] = useState<StatutSalle>(room?.statut || 'OUVERTE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!code.trim() || !nom.trim()) {
      setError('Code et nom sont requis.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = { code: code.trim(), nom: nom.trim(), type_salle: typeSalle, statut };
      const result = isEdit ? await roomsApi.update(room!.id, payload) : await roomsApi.create(payload);
      onSuccess(result);
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'enregistrement de la salle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Modifier la salle' : 'Nouvelle salle'}
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
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="SALLE-VIP-01" />
        </Field>
        <Field label="Nom" required>
          <TextInput value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Salon VIP" />
        </Field>
        <Field label="Type de salle">
          <Select value={typeSalle} onChange={(e) => setTypeSalle(e.target.value as TypeSalle)}>
            {Object.entries(TYPE_SALLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Statut">
          <Select value={statut} onChange={(e) => setStatut(e.target.value as StatutSalle)}>
            <option value="OUVERTE">Ouverte</option>
            <option value="FERMEE">Fermée</option>
            <option value="EN_TRAVAUX">En travaux</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
};

interface CashierFormModalProps {
  roomId?: number;
  rooms: Room[];
  cashier?: Cashier | null;
  onClose: () => void;
  onSuccess: (cashier: Cashier) => void;
}

export const CashierFormModal: React.FC<CashierFormModalProps> = ({ roomId, rooms, cashier, onClose, onSuccess }) => {
  const isEdit = !!cashier;
  const [roomIdValue, setRoomIdValue] = useState<number | ''>(cashier?.room_id ?? roomId ?? (rooms[0]?.id || ''));
  const [code, setCode] = useState(cashier?.code || '');
  const [nom, setNom] = useState(cashier?.nom || '');
  const [statut, setStatut] = useState<StatutCaisse>(cashier?.statut || 'OUVERTE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!roomIdValue || !code.trim() || !nom.trim()) {
      setError('Salle, code et nom sont requis.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = { room_id: Number(roomIdValue), code: code.trim(), nom: nom.trim(), statut };
      const result = isEdit ? await cashiersApi.update(cashier!.id, payload) : await cashiersApi.create(payload);
      onSuccess(result);
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          e?.message ||
          "Erreur lors de l'enregistrement de la caisse."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Modifier la caisse' : 'Nouvelle caisse'}
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
        <Field label="Salle" required>
          <Select value={roomIdValue} onChange={(e) => setRoomIdValue(Number(e.target.value))}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nom}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Code" required>
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAISSE-01" />
        </Field>
        <Field label="Nom" required>
          <TextInput value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Caisse principale" />
        </Field>
        <Field label="Statut">
          <Select value={statut} onChange={(e) => setStatut(e.target.value as StatutCaisse)}>
            <option value="OUVERTE">Ouverte</option>
            <option value="FERMEE">Fermée</option>
            <option value="MAINTENANCE">Maintenance</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
};
