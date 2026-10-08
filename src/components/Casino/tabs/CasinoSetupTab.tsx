import React, { useState } from 'react';
import { Building2, Dices } from 'lucide-react';
import { RoomsTab } from './RoomsTab';
import { GameTablesTab } from './GameTablesTab';

export const CasinoSetupTab: React.FC = () => {
  const [section, setSection] = useState<'rooms' | 'tables'>('rooms');

  return (
    <div className="flex flex-col gap-4 w-full">
      <div
        className="flex items-center gap-1 rounded-xl p-1 w-fit"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <button
          type="button"
          onClick={() => setSection('rooms')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${section === 'rooms' ? 'text-black' : 'text-muted hover:text-primary'}`}
          style={{ backgroundColor: section === 'rooms' ? 'var(--color-accent)' : 'transparent' }}
        >
          <Building2 size={15} />
          Salles et caisses
        </button>
        <button
          type="button"
          onClick={() => setSection('tables')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${section === 'tables' ? 'text-black' : 'text-muted hover:text-primary'}`}
          style={{ backgroundColor: section === 'tables' ? 'var(--color-accent)' : 'transparent' }}
        >
          <Dices size={15} />
          Tables et caisse affectee
        </button>
      </div>
      {section === 'rooms' ? <RoomsTab /> : <GameTablesTab />}
    </div>
  );
};

export default CasinoSetupTab;
