import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, ChevronDown, X } from 'lucide-react';
import api from '../../lib/api';

interface Product {
  id: number;
  product_id: number;
  nom: string;
  categorie: string;
  quantite: number;
  unite: string;
}

interface SelectedProduct {
  product_id: number;
  nom: string;
  unite: string;
  available_quantity: number;
  quantity: number;
}

interface StockProductPickerProps {
  onChange: (products: SelectedProduct[]) => void;
  initialProducts?: SelectedProduct[];
  locationId?: number;
}

export const StockProductPicker: React.FC<StockProductPickerProps> = ({
  onChange,
  initialProducts = [],
  locationId = 5
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProducts();
  }, [locationId]);

  useEffect(() => {
    setSelectedProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (products.length === 0) return;
    setSelectedProducts(current => current.map(selected => {
      const product = products.find(item => item.product_id === selected.product_id);
      return product ? {
        ...selected,
        nom: product.nom || selected.nom,
        unite: product.unite || selected.unite,
        available_quantity: product.quantite,
      } : selected;
    }));
  }, [products]);

  useEffect(() => {
    onChange(selectedProducts);
  }, [selectedProducts, onChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/stock/stocks/with-products', {
        params: { location_id: locationId }
      });
      const payload = response.data?.data ?? response.data;
      // Map backend field names to frontend expectations
      const mappedProducts = (Array.isArray(payload) ? payload : []).map((p: any) => ({
        id: p.id,
        product_id: p.product_id,
        nom: p.product_nom || p.nom,
        categorie: p.category_name || p.categorie || 'Stock',
        quantite: p.quantite,
        unite: p.product_unite || p.unite
      }));
      setProducts(mappedProducts);
      console.log('Loaded products:', mappedProducts);
    } catch (err) {
      setError('Erreur lors du chargement des produits');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.nom && p.nom.toLowerCase().includes(search.toLowerCase())
  );

  const addProduct = (product: Product) => {
    if (!product.product_id || selectedProducts.find(sp => sp.product_id === product.product_id)) {
      return; // Already selected or missing product_id
    }
    setSelectedProducts([...selectedProducts, {
      product_id: product.product_id,
      nom: product.nom || 'Produit sans nom',
      unite: product.unite || 'unité',
      available_quantity: product.quantite || 0,
      quantity: 1
    }]);
    setSearch('');
    setDropdownOpen(false);
  };

  const removeProduct = (product_id: number) => {
    setSelectedProducts(selectedProducts.filter(sp => sp.product_id !== product_id));
  };

  const updateQuantity = (product_id: number, quantity: number) => {
    setSelectedProducts(selectedProducts.map(sp => {
      if (sp.product_id === product_id) {
        const maxQuantity = sp.available_quantity;
        const validQuantity = Math.min(Math.max(quantity, 0), maxQuantity);
        return { ...sp, quantity: validQuantity };
      }
      return sp;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      addProduct(filteredProducts[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div ref={dropdownRef} className="relative">
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Produits disponibles
        </label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setDropdownOpen(true); setHighlightedIndex(-1); }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un produit..."
            className="w-full h-10 pl-9 pr-8 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setDropdownOpen(true); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {dropdownOpen && (
          <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl">
            {loading && (
              <div className="py-4 text-center text-slate-500 text-sm">
                Chargement des produits...
              </div>
            )}

            {error && (
              <div className="py-4 text-center text-red-400 text-sm">
                {error}
              </div>
            )}

            {!loading && !error && filteredProducts.length === 0 && (
              <div className="py-4 text-center text-slate-500 text-sm">
                {search ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
              </div>
            )}

            {!loading && !error && filteredProducts.map((product, index) => {
              const isSelected = selectedProducts.find(sp => sp.product_id === product.product_id);
              return (
                <button
                  key={product.id}
                  onClick={() => !isSelected && addProduct(product)}
                  disabled={isSelected || !product.quantite || product.quantite <= 0}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-all ${
                    index === highlightedIndex ? 'bg-slate-700' : 'hover:bg-slate-700'
                  } ${isSelected
                    ? 'text-slate-500 cursor-not-allowed'
                    : !product.quantite || product.quantite <= 0
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-300 cursor-pointer'
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{product.nom || 'Produit sans nom'}</p>
                    <p className="text-xs text-slate-500">{product.categorie || 'Non catégorisé'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm ${product.quantite > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                      {product.quantite || 0} {product.unite || 'unité'}
                    </p>
                    {isSelected && (
                      <p className="text-xs text-slate-500">Sélectionné</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedProducts.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Produits sélectionnés
          </label>
          <div className="space-y-2">
            {selectedProducts.map(sp => (
              <div key={sp.product_id} className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{sp.nom}</p>
                  <p className="text-slate-500 text-xs">
                    Disponible: {sp.available_quantity} {sp.unite}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    max={sp.available_quantity}
                    value={sp.quantity}
                    onChange={e => updateQuantity(sp.product_id, Math.floor(Number(e.target.value) || 0))}
                    className="w-20 h-8 px-2 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:border-amber-500/50"
                  />
                  <span className="text-slate-400 text-sm">{sp.unite}</span>
                  <button
                    onClick={() => removeProduct(sp.product_id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
