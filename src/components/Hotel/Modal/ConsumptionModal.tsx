// hotel/modals/ConsumptionModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, AlertTriangle, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '../../../utils/data';
import { Room } from '../../../types/hotel.types';
import { Modal } from '../../Modal';
import { Product } from '../../../types/product.types';

interface ConsumptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  products: Product[];
  minibarItems: any[]; // Items from the minibar for this room
  onConsume: (productId: number, quantity: number) => Promise<void> | void;
  isLoading?: boolean;
}

export const ConsumptionModal: React.FC<ConsumptionModalProps> = ({
  isOpen,
  onClose,
  room,
  products,
  minibarItems,
  onConsume,
  isLoading = false,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<number | ''>('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Réinitialiser l'état quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setSelectedProduct('');
      setQuantity(1);
      setError(null);
    }
  }, [isOpen]);

  // Filtrer les produits disponibles pour le mini-bar
  const availableProducts = products.filter(p => {
    // Check if product is in the minibar for this room
    const inMinibar = minibarItems.some(item => item.product_id === p.id && item.quantite > 0);
    if (!inMinibar) return false;
    
    // Inclure les produits consommables et finis
    if (p.type_produit === 'PRODUIT_FINI' || p.type_produit === 'CONSOMMABLE') {
      return true;
    }
    // Si le type est null/undefined, on considère que c'est un produit valide
    if (!p.type_produit) {
      return true;
    }
    return false;
  });

  // Récupérer le produit sélectionné
  const selectedProductData = products.find(p => p.id === selectedProduct);
  
  // Récupérer le stock disponible pour le produit sélectionné
  const getAvailableStock = (productId: number) => {
    const minibarItem = minibarItems.find(item => item.product_id === productId);
    return minibarItem ? minibarItem.quantite : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      setError('Veuillez sélectionner un produit');
      return;
    }

    if (quantity <= 0) {
      setError('La quantité doit être supérieure à 0');
      return;
    }

    const availableStock = getAvailableStock(Number(selectedProduct));
    if (quantity > availableStock) {
      setError(`Stock insuffisant. Disponible: ${availableStock}`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConsume(Number(selectedProduct), quantity);
      onClose();
    } catch (err) {
      setError('Erreur lors de l\'enregistrement de la consommation');
      console.error('Erreur:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuantityChange = (delta: number) => {
    const maxStock = selectedProduct ? getAvailableStock(Number(selectedProduct)) : 1;
    setQuantity(prev => Math.max(1, Math.min(maxStock, prev + delta)));
  };

  // Calcul du total
  const totalAmount = selectedProductData 
    ? (selectedProductData.prix_vente || 0) * quantity 
    : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-primary font-bold text-xl flex items-center gap-2">
              <ShoppingCart size={20} className="text-accent" />
              Consommation Mini-bar
            </h3>
            {room && (
              <p className="text-sm text-muted mt-1">
                Chambre {room.numero}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-2 transition-colors"
            disabled={isSubmitting || isLoading}
          >
            <X size={20} className="text-muted hover:text-primary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Message d'erreur */}
          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 flex items-center gap-2 text-danger text-sm">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Sélection du produit */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Produit *
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(Number(e.target.value))}
              className="input-field w-full"
              required
              disabled={isSubmitting || isLoading}
            >
              <option value="">Sélectionner un produit</option>
              {availableProducts.map(product => {
                const stock = getAvailableStock(product.id);
                return (
                  <option key={product.id} value={product.id}>
                    {product.nom} - {formatCurrency(product.prix_vente || 0)}
                    {product.unite && ` (${product.unite})`}
                    {` (Stock: ${stock})`}
                  </option>
                );
              })}
            </select>
            {availableProducts.length === 0 && (
              <p className="text-sm text-warning mt-1">
                Aucun produit disponible pour le mini-bar
              </p>
            )}
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Quantité
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleQuantityChange(-1)}
                className="p-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors disabled:opacity-50"
                disabled={quantity <= 1 || isSubmitting || isLoading}
              >
                <Minus size={16} className="text-primary" />
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => {
                  const maxStock = selectedProduct ? getAvailableStock(Number(selectedProduct)) : 1;
                  setQuantity(Math.max(1, Math.min(maxStock, Number(e.target.value))));
                }}
                className="input-field w-20 text-center"
                min="1"
                disabled={isSubmitting || isLoading}
              />
              <button
                type="button"
                onClick={() => handleQuantityChange(1)}
                className="p-2 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors disabled:opacity-50"
                disabled={quantity >= (selectedProduct ? getAvailableStock(Number(selectedProduct)) : 1) || isSubmitting || isLoading}
              >
                <Plus size={16} className="text-primary" />
              </button>
              {selectedProductData?.unite && (
                <span className="text-sm text-muted ml-1">
                  {selectedProductData.unite}
                </span>
              )}
            </div>
          </div>

          {/* Résumé du total */}
          {selectedProductData && (
            <div className="p-4 rounded-xl bg-surface-2 border border-surface-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted">Total</p>
                  <p className="text-primary font-medium">
                    {selectedProductData.nom} × {quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted">Montant</p>
                  <p className="text-xl font-bold text-accent">
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-base text-primary font-medium hover:bg-surface-2 transition-colors disabled:opacity-50"
              disabled={isSubmitting || isLoading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl btn-primary font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedProduct || isSubmitting || isLoading || availableProducts.length === 0}
            >
              {isSubmitting || isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  En cours...
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};