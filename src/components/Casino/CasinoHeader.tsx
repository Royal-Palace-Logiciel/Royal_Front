import React from 'react';
import { Dices, Plus } from 'lucide-react';
import { Button } from '../../components/UI';

interface Stat {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

interface CasinoHeaderProps {
  stats: Stat[];
  onNewRoom?: () => void;
  onNewSession?: () => void;
  onNewTransaction?: () => void;
}

export const CasinoHeader: React.FC<CasinoHeaderProps> = ({
  stats,
  onNewRoom,
  onNewSession,
  onNewTransaction
}) => {
  return (
    <>
      {/* Titre */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
        <div className="min-w-0 flex-1">
          <h2
            className="text-primary text-xl md:text-2xl font-bold truncate"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Casino
          </h2>
          <p className="text-muted text-xs md:text-sm mt-1 truncate">
            Gestion des salles, caisses, joueurs et transactions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {onNewRoom && (
            <Button
              icon={<Plus size={16} />}
              onClick={onNewRoom}
              className="text-sm"
            >
              Salle
            </Button>
          )}
          {onNewSession && (
            <Button
              icon={<Plus size={16} />}
              variant="secondary"
              onClick={onNewSession}
              className="text-sm"
            >
              Ouvrir caisse
            </Button>
          )}
          {onNewTransaction && (
            <Button
              icon={<Plus size={16} />}
              variant="secondary"
              onClick={onNewTransaction}
              className="text-sm"
            >
              Transaction
            </Button>
          )}
          <div
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--color-accent)',
              boxShadow: 'var(--shadow-accent)',
            }}
          >
            <Dices size={20} className="text-black md:size-24" />
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 w-full">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-3 md:p-4 flex items-center gap-3 md:gap-4 min-w-0"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--color-accent)' }}
            >
              {s.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted text-[10px] md:text-xs truncate">{s.label}</p>
              <p className="text-primary font-bold text-base md:text-lg truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
