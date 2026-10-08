// hotel/modals/StockTransferModal.tsx
import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Package, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../../utils/data';
import { Room } from '../../../types/hotel.types';
import { Product } from '../../../types/product.types';
import { Modal } from '../../Modal';
import { stockService, StockLocation, StockItem } from '../../../services/stock.service';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  products: Product[];
  onTransfer: (data: {
    product_id: number;
    source_location_id: number;
    quantity: number;
    room_id: number;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  room,
  products,
  onTransfer,
  isLoading = false,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<number | ''>('');
  const [selectedSourceLocation, setSelectedSourceLocation] = useState<number | ''>('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);

  // Load stock locations when modal opens
  useEffect(() => {
    if (isOpen) {
      loadLocations();
      setSelectedProduct('');
      setSelectedSourceLocation('');
      setQuantity(1);
      setError(null);
    }
  }, [isOpen]);

  // Load stock when source location is selected
  useEffect(() => {
    if (selectedSourceLocation) {
      loadStockForLocation(Number(selectedSourceLocation));
    }
  }, [selectedSourceLocation]);

  const loadLocations = async () => {
    setLoadingLocations(true);
    try {
      const locs = await stockService.getLocations();
      // Filter out Hotel location (id=5) as it's the destination
      setLocations(locs.filter(loc => loc.id !== 5));
    } catch (err) {
      setError('Impossible de charger les emplacements de stock');
      console.error('Error loading locations:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadStockForLocation = async (locationId: number) => {
    setLoadingStock(true);
    try {
      const stock = await stockService.getByLocation(locationId);
      setStockItems(stock);
    } catch (err) {
      setError('Impossible de charger le stock');
      console.error('Error loading stock:', err);
    } finally {
      setLoadingStock(false);
    }
  };

  const getAvailableStock = (productId: number) => {
    const stockItem = stockItems.find(item => item.product_id === productId);
    return stockItem ? stockItem.quantite : 0;
  };

  const getAvailableProducts = () => {
    return products.filter(product => {
      const stock = getAvailableStock(product.id);
      return stock > 0 && (product.type_produit === 'CONSOMMABLE' || product.type_produit === 'PRODUIT_FINI');
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      setError('Veuillez sélectionner un produit');
      return;
    }

    if (!selectedSourceLocation) {
      setError('Veuillez sélectionner un emplacement source');
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
      await onTransfer({
        product_id: Number(selectedProduct),
        source_location_id: Number(selectedSourceLocation),
        quantity,
        room_id: room?.id || 0,
      });
      onClose();
    } catch (err) {
      setError('Erreur lors du transfert de stock');
      console.error('Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuantityChange = (delta: number) => {
    const maxStock = selectedProduct ? getAvailableStock(Number(selectedProduct)) : 1;
    setQuantity(prev => Math.max(1, Math.min(maxStock, prev + delta)));
  };

  const selectedProductData = products.find(p => p.id === selectedProduct);
  const selectedLocationData = locations.find(l => l.id === selectedSourceLocation);
  const availableProducts = getAvailableProducts();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-primary font-bold text-xl flex items-center gap-2">
              <Package size={20} className="text-accent" />
              Transfert de Stock vers Minibar
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

          {/* Source Location */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Source de Stock *
            </label>
            <select
              value={selectedSourceLocation}
              onChange={(e) => setSelectedSourceLocation(Number(e.target.value))}
              className="input-field w-full"
              required
              disabled={isSubmitting || isLoading || loadingLocations}
            >
              <option value="">Sélectionner la source</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.nom}
                </option>
              ))}
            </select>
            {loadingLocations && (
              <p className="text-sm text-muted mt-1">Chargement des emplacements...</p>
            )}
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Produit *
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(Number(e.target.value))}
              className="input-field w-full"
              required
              disabled={isSubmitting || isLoading || !selectedSourceLocation || loadingStock}
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
            {!selectedSourceLocation && (
              <p className="text-sm text-warning mt-1">
                Sélectionnez d'abord une source de stock
              </p>
            )}
            {selectedSourceLocation && availableProducts.length === 0 && (
              <p className="text-sm text-warning mt-1">
                Aucun produit disponible dans cette source
              </p>
            )}
          </div>

          {/* Quantity */}
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
                <ArrowRight size={16} className="text-primary rotate-180" />
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
                <ArrowRight size={16} className="text-primary" />
              </button>
              {selectedProductData?.unite && (
                <span className="text-sm text-muted ml-1">
                  {selectedProductData.unite}
                </span>
              )}
            </div>
          </div>

          {/* Transfer Summary */}
          {selectedProductData && selectedLocationData && (
            <div className="p-4 rounded-xl bg-surface-2 border border-surface-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted">{selectedLocationData.nom}</span>
                <ArrowRight size={16} className="text-accent" />
                <span className="text-muted">Minibar (Chambre {room?.numero})</span>
              </div>
              <div className="mt-2 font-medium text-primary">
                {selectedProductData.nom} × {quantity}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            disabled={isSubmitting || isLoading || !selectedProduct || !selectedSourceLocation}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Transfert en cours...
              </>
            ) : (
              <>
                <ArrowRight size={18} />
                Effectuer le Transfert
              </>
            )}
          </button>
        </form>
      </div>
    </Modal>
  );
};