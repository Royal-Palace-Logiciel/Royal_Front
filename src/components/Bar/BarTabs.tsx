import React from 'react';
import { BAR_TABS, BarTabId } from '../../data/Bar.data';
import AuthService from '../../services/authService';
import { filterTabsByRole } from '../../utils/permissions';

interface Props {
  activeTab: BarTabId;
  onTabChange: (id: BarTabId) => void;
}

export const BarTabs: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const currentUser = AuthService.getCurrentUser();
  const visibleTabs = filterTabsByRole([...BAR_TABS], currentUser?.role)
    .filter((tab) => tab.id !== 'equipement' || currentUser?.role?.toLowerCase() === 'admin');

  return (
    <div className="flex gap-1 bg-surface border border-base rounded-2xl p-1 overflow-x-auto scrollbar-hide">
      {visibleTabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id as BarTabId)}
          className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === tab.id
              ? 'bg-accent-4 text-accent'
              : 'text-muted hover:text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};