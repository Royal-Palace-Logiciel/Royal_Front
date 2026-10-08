// Accommodation component is currently disabled
import React from 'react';

interface Props {
  onNewReservation: () => void;
}

export const HebergementHeader: React.FC<Props> = ({ onNewReservation }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
    <div className="min-w-0 flex-1">
      <h2
        className="text-primary text-xl md:text-2xl font-bold truncate"
        style={{ fontFamily: 'Playfair Display, serif' }}
      >
        Hébergement (Disabled)
      </h2>
      <p className="text-muted text-xs md:text-sm mt-1 truncate">
        Accommodation module is currently disabled
      </p>
    </div>
  </div>
);

/*
// Original accommodation component code (commented out)
import React from 'react';
import { BedDouble, Plus } from 'lucide-react';
import { Button } from '../../components/UI';

interface Props {
  onNewReservation: () => void;
}

export const HebergementHeader: React.FC<Props> = ({ onNewReservation }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
    <div className="min-w-0 flex-1">
      <h2
        className="text-primary text-xl md:text-2xl font-bold truncate"
        style={{ fontFamily: 'Playfair Display, serif' }}
      >
        Hébergement
      </h2>
      <p className="text-muted text-xs md:text-sm mt-1 truncate">
        Gestion complète des chambres, réservations et services
      </p>
    </div>

    <div className="flex items-center gap-2 flex-shrink-0">
      <Button icon={<Plus size={16} />} onClick={onNewReservation} className="text-sm">
        Nouvelle réservation
      </Button>
      <div
        className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-accent)', boxShadow: 'var(--shadow-accent)' }}
      >
        <BedDouble size={20} className="text-black" />
      </div>
    </div>
  </div>
);
*/