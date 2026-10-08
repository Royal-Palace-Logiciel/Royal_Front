import React, { useState, useEffect } from 'react';
import { BarProduct } from '../../types/bar.type';
import { formatCurrency } from '../../utils/data';
import barService from '../../services/bar.service';
import { useToast } from '../../context/ToastContext';

interface Props {
  cocktail: BarProduct;
  stock?: { quantite: number; unite: string };
  onStockUpdate?: () => void;
  onAddToOrder?: (cocktail: BarProduct) => boolean | void | Promise<void>;
}

export const CocktailCard: React.FC<Props> = ({ cocktail, stock, onStockUpdate, onAddToOrder }) => {
  const [adding, setAdding] = useState(false);
  const [lastTx, setLastTx] = useState<{ quantite: number; montant: number; created_at: string } | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchLastTx = async () => {
      try {
        const tx = await barService.getBarLatestTransaction(cocktail.id);
        if (tx) setLastTx(tx);
      } catch (_) {
        // silent — no transaction yet
      }
    };
    fetchLastTx();
  }, [cocktail.id]);

  const handleAdd = async () => {
    if (adding) return;
    if (!stock || stock.quantite <= 0) {
      showToast('Rupture de stock', 'error');
      return;
    }

    setAdding(true);
    try {
      const sessionRes = await barService.getBarOpenSessions();
      const sessions = sessionRes;
      const currentSession = Array.isArray(sessions) ? sessions.find((s) => s.fermeture_at === null || s.fermeture_at === undefined) : null;

      await barService.addBarTransaction({
        session_id: currentSession?.id,
        product_id: cocktail.id,
        quantite: 1,
        prix_unitaire: cocktail.prix,
      });
      await barService.updateBarStock(cocktail.id, { quantite: stock.quantite - 1 });
      showToast(`${cocktail.nom} ajouté à la commande`, 'success');
      if (onStockUpdate) onStockUpdate();
    } catch (err) {
      showToast('Erreur lors de l\'ajout', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleAddToCurrentOrder = async () => {
    if (adding) return;
    if (!stock || stock.quantite <= 0) {
      showToast('Rupture de stock', 'error');
      return;
    }

    setAdding(true);
    try {
      const sessionRes = await barService.getBarOpenSessions();
      const sessions = sessionRes;
      const currentSession = Array.isArray(sessions) ? sessions.find((s) => s.fermeture_at === null || s.fermeture_at === undefined) : null;

      await barService.addBarTransaction({
        session_id: currentSession?.id,
        product_id: cocktail.id,
        quantite: 1,
        prix_unitaire: cocktail.prix,
      });
      await barService.updateBarStock(cocktail.id, { quantite: stock.quantite - 1 });

      if (onAddToOrder) {
        const added = await onAddToOrder(cocktail);
        if (!added) {
          showToast('Créez d’abord une commande', 'error');
          return;
        }
      }

      showToast(`${cocktail.nom} ajouté à la commande`, 'success');
      if (onStockUpdate) onStockUpdate();
    } catch (err) {
      showToast('Erreur lors de l\'ajout', 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface border border-base rounded-2xl p-5 hover:border-accent hover:shadow-accent transition-all group">
        <div className="flex items-start justify-between mb-3">
          <span className="badge-accent px-2.5 py-1 rounded-lg text-xs font-medium">
            {cocktail.categorie}
          </span>
          {!cocktail.alcool && (
            <span className="badge-success px-2 py-0.5 rounded-full text-xs border border-success">
              Sans alcool
            </span>
          )}
        </div>

        <h4 className="text-primary font-semibold mb-2">{cocktail.nom}</h4>
        <p className="text-muted text-xs mb-4 leading-relaxed">{cocktail.ingredients}</p>

   

        {stock && (
          <div className="mt-3 pt-3 border-t border-base">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Stock</span>
              <span className={`font-semibold ${
                stock.quantite === 0 ? 'text-red-400' : stock.quantite <= 5 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {stock.quantite === 0 ? 'Rupture' : `${stock.quantite} ${stock.unite}`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  stock.quantite === 0 ? 'bg-red-500' : stock.quantite <= 5 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min((stock.quantite / 20) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

   
      </div>

    </div>
  );
};