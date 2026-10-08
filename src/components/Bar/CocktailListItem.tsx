// src/components/Bar/CocktailListItem.tsx
import React, { useState } from 'react';
import { BarProduct } from '../../types/bar.type';
import { formatCurrency } from '../../utils/data';
import { useToast } from '../../context/ToastContext';

interface Props {
  cocktail: BarProduct;
  stock?: { quantite: number; unite: string; seuil_minimum?: number };
  onStockUpdate?: () => void;
  onAddToOrder?: (cocktail: BarProduct) => boolean | void | Promise<void>;
  onEdit?: (cocktail: BarProduct) => void;
  onDelete?: (cocktailId: number) => void;
}

export const CocktailListItem: React.FC<Props> = ({
  cocktail,
  stock,
  onStockUpdate,
  onAddToOrder,
  onEdit,
  onDelete
}) => {
  const [adding, setAdding] = useState(false);
  const { showToast } = useToast();

  const handleAddToOrder = async () => {
    // Si aucun gestionnaire de commande n'est fourni (ex: dans l'onglet de gestion), le clic ne fait rien
    if (!onAddToOrder) return;

    if (adding) return;
    if (!stock || stock.quantite <= 0) {
      showToast('Rupture de stock', 'error');
      return;
    }

    setAdding(true);
    try {
      const added = await onAddToOrder(cocktail);
      if (added === false) {
        showToast('Créez d\'abord une commande', 'error');
        return;
      }

      showToast(`${cocktail.nom} ajouté`, 'success');
    } catch (err) {
      showToast('Erreur lors de l\'ajout', 'error');
    } finally {
      setAdding(false);
    }
  };

  const isOutOfStock = !stock || stock.quantite <= 0;
  const isLowStock = stock && stock.quantite > 0 && stock.quantite <= 5;
  const isClickable = Boolean(onAddToOrder);

  return (
    <div
      onClick={handleAddToOrder}
      className={`flex items-center justify-between gap-3 p-3 border-b border-base last:border-b-0 transition-colors group ${isOutOfStock ? 'opacity-65' : ''
        } ${isClickable ? 'cursor-pointer hover:bg-surface/30' : ''} ${adding ? 'opacity-60 cursor-wait' : ''
        }`}
    >
      {/* Info produit */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <h4 className="text-sm sm:text-base font-semibold text-primary truncate">
            {cocktail.nom}
          </h4>
          <span className="text-xs sm:text-sm font-bold text-accent whitespace-nowrap">
            {formatCurrency(cocktail.prix)}
          </span>
        </div>

        {/* Stock info */}
        {stock && (
          <div className="text-xs text-muted">
            Stock:{' '}
            <span
              className={`font-semibold ${isOutOfStock
                ? 'text-red-400'
                : isLowStock
                  ? 'text-amber-400'
                  : 'text-emerald-400'
                }`}
            >
              {isOutOfStock ? 'Rupture' : `${stock.quantite} ${stock.unite}`}
            </span>
          </div>
        )}
      </div>

      {/* Boutons Modifier & Supprimer à droite */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(cocktail)}
            className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium rounded-lg transition"
            title="Modifier la boisson"
          >
            Modifier
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(cocktail.id)}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition"
            title="Supprimer la boisson"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
};