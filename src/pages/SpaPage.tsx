// src/pages/SpaPage.tsx — module SPA (piscine) : caisse, abonnements, tarifs, historique.
import React, { useEffect, useState } from 'react';
import { CreditCard, History, Tag, Ticket, Waves } from 'lucide-react';
import AuthService from '../services/authService';
import spaService, { SpaTarif } from '../services/spa.service';
import { isAdmin, isManager } from '../utils/permissions';
import { useToast } from '../context/ToastContext';
import { SpaCaisse } from '../components/Spa/SpaCaisse';
import { SpaAbonnements } from '../components/Spa/SpaAbonnements';
import { SpaTarifs } from '../components/Spa/SpaTarifs';
import { SpaHistorique } from '../components/Spa/SpaHistorique';

type SpaTab = 'caisse' | 'abonnements' | 'tarifs' | 'historique';

export const SpaPage: React.FC = () => {
  const { showToast } = useToast();
  const currentUser = AuthService.getCurrentUser();
  const admin = isAdmin(currentUser);
  const canSeeHistory = admin || isManager(currentUser);
  const [tab, setTab] = useState<SpaTab>('caisse');
  const [tarifs, setTarifs] = useState<SpaTarif[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const notify = (message: string, type: 'success' | 'error' = 'success') => showToast(message, type);

  const loadTarifs = async () => {
    try {
      setTarifs(await spaService.getTarifs(admin));
    } catch {
      notify('Impossible de charger les tarifs piscine.', 'error');
    }
  };

  useEffect(() => { void loadTarifs(); }, []);

  const tabs: Array<{ id: SpaTab; label: string; icon: React.ReactNode; visible: boolean }> = [
    { id: 'caisse', label: 'Caisse', icon: <CreditCard size={16} />, visible: true },
    { id: 'abonnements', label: 'Abonnements', icon: <Ticket size={16} />, visible: true },
    { id: 'tarifs', label: 'Tarifs', icon: <Tag size={16} />, visible: admin },
    { id: 'historique', label: 'Historique', icon: <History size={16} />, visible: canSeeHistory },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-primary text-xl font-bold sm:text-2xl md:text-3xl" style={{ fontFamily: 'Playfair Display, serif' }}>SPA — Piscine</h2>
          <p className="mt-1 text-xs text-muted sm:text-sm">Entrées, locations, abonnements et caisse de la piscine</p>
        </div>
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent">
          <Waves size={24} className="text-black" />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-base bg-surface p-1">
        {tabs.filter((item) => item.visible).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === item.id ? 'bg-accent-4 text-accent' : 'text-muted hover:text-primary'}`}
          >
            {item.icon}{item.label}
          </button>
        ))}
      </div>

      {tab === 'caisse' && (
        <SpaCaisse tarifs={tarifs.filter((tarif) => tarif.actif)} onChanged={() => setRefreshKey((key) => key + 1)} notify={notify} />
      )}
      {tab === 'abonnements' && <SpaAbonnements refreshKey={refreshKey} canCancel={admin} notify={notify} />}
      {tab === 'tarifs' && admin && <SpaTarifs tarifs={tarifs} onChanged={() => void loadTarifs()} notify={notify} />}
      {tab === 'historique' && canSeeHistory && <SpaHistorique refreshKey={refreshKey} notify={notify} />}
    </div>
  );
};

export default SpaPage;
