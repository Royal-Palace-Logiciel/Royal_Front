// hotel/modals/RoomStatusModal.tsx (version simplifiée)
import React from 'react';
import { Room } from '../../../types/hotel.types';
import { Modal } from '../../Modal';
import { X, Check, AlertCircle, Clock, Wrench, Brush, Ban } from 'lucide-react';

interface RoomStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  onStatusChange: (newStatus: Room['statut']) => void;
}

const statusOptions = [
  { value: 'LIBRE', label: 'Libre', icon: Check, color: 'success' },
  { value: 'OCCUPEE', label: 'Occupée', icon: Clock, color: 'accent' },
  { value: 'RESERVEE', label: 'Réservée', icon: AlertCircle, color: 'warning' },
  { value: 'NETTOYAGE', label: 'En nettoyage', icon: Brush, color: 'info' },
  { value: 'MAINTENANCE', label: 'En maintenance', icon: Wrench, color: 'danger' },
  { value: 'HORS_SERVICE', label: 'Hors service', icon: Ban, color: 'muted' },
];

export const RoomStatusModal: React.FC<RoomStatusModalProps> = ({
  isOpen,
  onClose,
  room,
  onStatusChange,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-primary font-bold text-xl">
            Changer le statut
            <span className="text-sm font-normal text-muted ml-2">
              Chambre {room.numero}
            </span>
          </h3>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg hover:bg-surface-2 transition-colors"
          >
            <X size={20} className="text-muted" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {statusOptions.map((status) => {
            const Icon = status.icon;
            return (
              <button
                key={status.value}
                onClick={() => {
                  onStatusChange(status.value as Room['statut']);
                }}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                  ${room.statut === status.value 
                    ? `border-${status.color} bg-${status.color}/10` 
                    : 'border-base hover:border-accent/30'
                  }`}
              >
                <Icon size={24} className={`text-${status.color}`} />
                <span className="text-sm font-medium text-primary">
                  {status.label}
                </span>
                {room.statut === status.value && (
                  <span className="text-xs text-accent">✓ Actif</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 pt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-base text-primary font-medium hover:bg-surface-2 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </Modal>
  );
};