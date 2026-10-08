import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Modal, Field, Button, ErrorBanner } from '../common';
import { PlayerSelector } from '../PlayerSelector';
import { visitsApi } from '../../../services/casino.service';
import type { Room, SelectedPlayer, Visit } from '../../../types/casino.types';

interface VisitCheckInModalProps {
  room: Room;
  onClose: () => void;
  onSuccess: (visit: Visit) => void;
}

export const VisitCheckInModal: React.FC<VisitCheckInModalProps> = ({ room, onClose, onSuccess }) => {
  const [player, setPlayer] = useState<SelectedPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!player) {
      setError('Sélectionnez un client (scan de carte ou sélection simple).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const visit =
        player.via === 'QR' && player.card
          ? await visitsApi.checkIn({ room_id: room.id, qr_code: player.card.qr_code })
          : await visitsApi.checkIn({ room_id: room.id, client_id: player.client.id, entree_via: 'MANUEL' });
      onSuccess(visit);
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'enregistrement de la visite.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={`Entrée en salle — ${room.nom}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<LogIn size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer l’entrée'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        <PlayerSelector value={player} onChange={setPlayer} />
      </div>
    </Modal>
  );
};

export default VisitCheckInModal;
