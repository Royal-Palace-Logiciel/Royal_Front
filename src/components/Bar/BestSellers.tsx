import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { formatCurrency } from '../../utils/data';
import type { BarCommande } from '../../types/bar.type';

interface Props {
  commandes?: BarCommande[];
}

export const BestSellers: React.FC<Props> = ({ commandes = [] }) => {
  const sellers = useMemo(() => {
    const totals = new Map<string, { ventes: number; montant: number }>();

    for (const commande of commandes) {
      for (const item of commande.items) {
        const current = totals.get(item.nom) || { ventes: 0, montant: 0 };
        current.ventes += Number(item.quantite) || 0;
        current.montant += (Number(item.quantite) || 0) * (Number(item.prix) || 0);
        totals.set(item.nom, current);
      }
    }

    return [...totals.entries()]
      .map(([nom, values]) => ({ nom, ...values }))
      .sort((a, b) => b.ventes - a.ventes || b.montant - a.montant)
      .filter((item) => item.ventes >= 10)
      .slice(0, 5);
  }, [commandes]);

  const maxSales = sellers[0]?.ventes || 1;

  return (
    <div className="bg-surface border border-base rounded-2xl p-6">
      <h3 className="text-primary font-semibold flex items-center gap-2 mb-4">
        <Star size={16} className="text-accent" />
        Meilleures Ventes
      </h3>
      <div className="space-y-3">
        {sellers.map((item, i) => (
          <div key={item.nom} className="flex items-center gap-4">
            <div className="w-7 h-7 rounded-full bg-accent-4 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-xs">#{i + 1}</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-primary text-sm font-medium">{item.nom}</span>
                <span className="text-accent font-semibold text-sm">{formatCurrency(item.montant)}</span>
              </div>
              <div className="progress-bar h-1.5">
                <div className="progress-fill h-full" style={{ width: `${(item.ventes / maxSales) * 100}%` }} />
              </div>
            </div>
            <span className="text-muted text-xs w-14 text-right">{item.ventes} ventes</span>
          </div>
        ))}
        {sellers.length === 0 && <p className="text-sm text-muted">Aucun article n’a encore atteint 10 ventes.</p>}
      </div>
    </div>
  );
};
