import React from 'react';
import { formatCurrency } from '../../utils/data';
import type { BarCommande } from '../../types/bar.type';

interface Props {
  commandes: BarCommande[];
  stockMap: Record<number, { quantite: number; unite: string }>;
}

export const BarStats: React.FC<Props> = ({ commandes, stockMap }) => {
  const revenu = commandes.reduce((total, commande) => total + Number(commande.total || 0), 0);
  const commandesActives = commandes.filter((commande) => commande.statut !== 'Servie').length;
  const stockFaible = Object.values(stockMap).filter((stock) => Number(stock.quantite) <= 5).length;
  const items = [
    { label: 'Revenu des commandes', value: formatCurrency(revenu), className: 'text-primary' },
    { label: 'Commandes actives', value: String(commandesActives), className: 'text-success' },
    { label: 'Produits à réapprovisionner', value: String(stockFaible), className: stockFaible > 0 ? 'text-danger' : 'text-success' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {items.map(item => (
        <div key={item.label} className="bg-surface border border-base rounded-2xl p-4 sm:p-5">
          <p className="text-muted text-xs mb-1">{item.label}</p>
          <p className={`${item.className} font-bold text-lg sm:text-xl`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
};
