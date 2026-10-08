// hotel/modals/AssignEquipmentModal.tsx
import React, { useState } from 'react';
import { Equipment, Room } from '../../../types/hotel.types';

import { X } from 'lucide-react';
import { Modal } from '../../Modal';

interface AssignEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  rooms: Room[];
  onAssign: (roomId: number, quantity: number, zone: 'CHAMBRE' | 'SALLE_DE_BAIN') => void;
}

export const AssignEquipmentModal: React.FC<AssignEquipmentModalProps> = ({
  isOpen,
  onClose,
  equipment,
  rooms,
  onAssign,
}) => {
  const [roomId, setRoomId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState(1);
  const [zone, setZone] = useState<'CHAMBRE' | 'SALLE_DE_BAIN'>('CHAMBRE');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId && equipment) {
      onAssign(Number(roomId), quantity, zone);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-primary font-bold text-xl">
            Assigner {equipment?.nom}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-2 transition-colors">
            <X size={20} className="text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">Zone *</label>
            <select value={zone} onChange={(e) => setZone(e.target.value as 'CHAMBRE' | 'SALLE_DE_BAIN')} className="input-field w-full" required>
              <option value="CHAMBRE">Chambre</option>
              <option value="SALLE_DE_BAIN">Salle de bain</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Chambre *
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(Number(e.target.value))}
              className="input-field w-full"
              required
            >
              <option value="">Sélectionner une chambre</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  Chambre {room.numero} - {room.room_type?.nom || 'Standard'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Quantité
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="input-field w-full"
              min="1"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-base text-primary font-medium hover:bg-surface-2 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl btn-primary font-medium"
            >
              Assigner
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};