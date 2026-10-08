import React from 'react';
import { ShoppingCart, UtensilsCrossed, Package, DollarSign, History, FileText, ClipboardList } from 'lucide-react';
import AuthService from '../../../services/authService';
import { filterTabsByRole } from '../../../utils/permissions';

const TABS = [
  { id: 'commandes', label: 'Commandes', icon: <ShoppingCart size={16} /> },
  { id: 'menu', label: 'Menu', icon: <UtensilsCrossed size={16} /> },
  { id: 'stock', label: 'Stock', icon: <Package size={16} /> },
  { id: 'caisse', label: 'Caisse', icon: <DollarSign size={16} /> },
  { id: 'historique', label: 'Historique', icon: <History size={16} /> },
  { id: 'rapports', label: 'Rapports', icon: <FileText size={16} /> },
  { id: 'inventaire', label: 'Inventaire', icon: <ClipboardList size={16} /> },
];

interface RestaurantTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const RestaurantTabs: React.FC<RestaurantTabsProps> = ({ activeTab, setActiveTab }) => {
  const currentUser = AuthService.getCurrentUser();
  const visibleTabs = filterTabsByRole(TABS, currentUser?.role);

  return (
    <div 
      className="flex gap-1 rounded-2xl p-1 w-full overflow-x-auto hide-scrollbar"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {visibleTabs.map((tab) => (
        <button 
          key={tab.id} 
          onClick={() => setActiveTab(tab.id)}
          className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-2 ${
            activeTab === tab.id ? 'text-black' : 'text-muted hover:text-secondary'
          }`}
          style={{
            backgroundColor: activeTab === tab.id ? 'var(--color-accent)' : 'transparent',
            boxShadow: activeTab === tab.id ? 'var(--shadow-accent)' : 'none',
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
};