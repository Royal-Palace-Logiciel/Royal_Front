// src/components/Restaurant/Tabs/MenuTab.tsx
import React, { useState, useEffect } from 'react';
import { Badge, Button } from '../../UI';
import { formatCurrency } from '../../../utils/data';
import { Plus, Edit, Trash2, Search, UtensilsCrossed } from 'lucide-react';
import type { Product, Category } from '../types';

interface MenuTabProps {
  products: Product[];
  categories: Category[];
  userIsAdmin: boolean;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: number) => void;
}

export const MenuTab: React.FC<MenuTabProps> = ({
  products,
  categories,
  userIsAdmin,
  onAddProduct,
  onEditProduct,
  onDeleteProduct
}) => {
  const [selectedCategory, setSelectedCategory] = useState<number | 'tous'>('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [productColors, setProductColors] = useState<Record<string, string>>({});

  // Charger les couleurs du localStorage au chargement et à chaque modification
  useEffect(() => {
    const loadColors = () => {
      const saved = JSON.parse(localStorage.getItem('hda_product_colors') || '{}');
      setProductColors(saved);
    };
    loadColors();
    window.addEventListener('storage', loadColors);
    return () => window.removeEventListener('storage', loadColors);
  }, [products]);

  const menuProducts = products.filter(p =>
    ['PRODUIT_FINI', 'BOISSON', 'SERVICE'].includes(p.type_produit)
  );

  const filteredProducts = menuProducts.filter(p => {
    const matchesCategory = selectedCategory === 'tous' || p.category_id === selectedCategory;
    const matchesSearch = p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 w-full">
      {/* En-tête */}
      <div
        className="rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div>
          <span className="text-xs uppercase tracking-wider text-amber-500 font-bold block mb-1">RESTAURANT & CARTE</span>
          <h3 className="text-primary font-bold text-xl flex items-center gap-2">
            <UtensilsCrossed className="text-amber-500" size={22} />
            Gestion du Menu & Carte
          </h3>
          <p className="text-sm text-subtle mt-0.5">
            {userIsAdmin
              ? "Gérez vos plats, boissons et spécialités par catégorie."
              : "Consultez la carte et les menus disponibles."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} />
            <input
              type="text"
              placeholder="Rechercher un plat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl text-sm transition-all"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Bouton d'ajout visible uniquement pour l'admin */}
          {userIsAdmin && (
            <Button icon={<Plus size={16} />} onClick={onAddProduct} className="text-sm h-10 whitespace-nowrap">
              Ajouter un plat
            </Button>
          )}
        </div>
      </div>

      {/* Conteneur unique */}
      <div
        className="rounded-2xl p-4 sm:p-6 shadow-sm"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Filtres verticaux (Masque les catégories à 0 et garde "Toutes") */}
          <div className="lg:col-span-1 space-y-2">
            <button
              onClick={() => setSelectedCategory('tous')}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex justify-between items-center ${selectedCategory === 'tous' ? 'bg-amber-500 text-white shadow-md' : 'text-primary hover:bg-surface-2'
                }`}
              style={{
                backgroundColor: selectedCategory === 'tous' ? '#f59e0b' : 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span>Toutes</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 font-bold">{menuProducts.length}</span>
            </button>

            {categories
              .map((cat) => ({
                ...cat,
                count: menuProducts.filter(p => p.category_id === cat.id).length,
              }))
              .filter((cat) => cat.count > 0)
              .map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex justify-between items-center ${isSelected ? 'bg-amber-500 text-white shadow-md' : 'text-primary hover:bg-surface-2'
                      }`}
                    style={{
                      backgroundColor: isSelected ? '#f59e0b' : 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <span>{cat.nom}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 font-bold">{cat.count}</span>
                  </button>
                );
              })}
          </div>

          {/* Grille des produits */}
          <div className="lg:col-span-3">
            {filteredProducts.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl border border-dashed p-8"
                style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
              >
                <UtensilsCrossed className="mx-auto text-subtle mb-3" size={40} />
                <p className="text-primary font-medium text-base">Aucun élément trouvé</p>
                <p className="text-sm text-subtle mt-1">Essayez de modifier votre recherche ou changez de catégorie.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((p) => {
                  const categoryObj = categories.find(c => c.id === p.category_id);

                  // Récupère la couleur depuis l'objet produit (BDD) ou le localStorage en secours
                  const customBg = p.couleur || productColors[p.id] || productColors[p.nom?.trim().toLowerCase()] || '';

                  return (
                    <div
                      key={p.id}
                      className="group rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-lg border relative"
                      style={{
                        backgroundColor: customBg || 'var(--color-surface-2)',
                        borderColor: customBg ? 'transparent' : 'var(--color-border)',
                        color: customBg ? '#ffffff' : 'inherit',
                      }}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <span
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg uppercase tracking-wider border"
                            style={{
                              backgroundColor: customBg ? 'rgba(0,0,0,0.2)' : 'var(--color-surface)',
                              borderColor: customBg ? 'rgba(255,255,255,0.1)' : 'var(--color-border)',
                              color: customBg ? '#ffffff' : 'var(--color-subtle)'
                            }}
                          >
                            {categoryObj ? categoryObj.nom : 'Général'}
                          </span>
                          <Badge variant={p.actif ? 'success' : 'danger'}>
                            {p.actif ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>

                        <h4
                          className="font-bold text-base line-clamp-1 mb-1 transition-colors"
                          style={{ color: customBg ? '#ffffff' : 'var(--color-primary)' }}
                        >
                          {p.nom}
                        </h4>
                        {p.code && (
                          <p
                            className="text-xs mb-3 font-mono"
                            style={{ color: customBg ? 'rgba(255,255,255,0.8)' : 'var(--color-subtle)' }}
                          >
                            Code: {p.code}
                          </p>
                        )}
                      </div>

                      <div
                        className="pt-3 flex items-center justify-between mt-3 border-t"
                        style={{ borderColor: customBg ? 'rgba(255,255,255,0.2)' : 'var(--color-border)' }}
                      >
                        <div>
                          <span
                            className="text-xs block"
                            style={{ color: customBg ? 'rgba(255,255,255,0.8)' : 'var(--color-subtle)' }}
                          >
                            Prix de vente
                          </span>
                          <span
                            className="text-base sm:text-lg font-bold"
                            style={{ color: customBg ? '#ffffff' : 'var(--color-accent)' }}
                          >
                            {formatCurrency(p.prix_vente)}
                          </span>
                        </div>

                        {/* Boutons Modifier/Supprimer affichés uniquement si l'utilisateur est admin */}
                        {userIsAdmin && (
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => onEditProduct(p)} title="Modifier">
                              <Edit size={14} />
                            </Button>
                            {p.actif && (
                              <Button size="sm" variant="danger" onClick={() => onDeleteProduct(p.id)} title="Supprimer">
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};