import React from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface Stat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}

interface RestaurantHeaderProps {
  stats: Stat[];
}

export const RestaurantHeader: React.FC<RestaurantHeaderProps> = ({ stats }) => {
  return (
    <>
      {/* Titre */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
        <div className="min-w-0 flex-1">
          <h2 
            className="text-primary text-xl md:text-2xl font-bold truncate" 
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Restaurant
          </h2>
          <p className="text-muted text-xs md:text-sm mt-1 truncate">
            Gestion des commandes, menu, tables et caisse
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div 
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--color-accent)',
              boxShadow: 'var(--shadow-accent)',
            }}
          >
            <UtensilsCrossed size={20} className="text-black md:size-24" />
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