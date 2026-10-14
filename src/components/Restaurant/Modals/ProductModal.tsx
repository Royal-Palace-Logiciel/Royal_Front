// src/components/Restaurant/Modals/ProductModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, Input, Button } from '../../UI';
import { useToast } from '../../../context/ToastContext';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import * as restaurantService from '../../../services/restaurantService';
import type { Category, Product } from '../types';

interface StockIngredient {
  product_id: number;
  product_nom: string;
  unite: string;
  quantite: number;
}

interface RecipeIngredientDraft {
  ingredient_id: string;
  quantite: string;
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onCreateCategory: (name: string) => Promise<Category>;
  categories: Category[];
  products: Product[];
  editingProduct?: Product | null;
}

const normalizeProductName = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const isSimilarProductName = (first: string, second: string) => {
  const firstName = normalizeProductName(first);
  const secondName = normalizeProductName(second);
  return Boolean(firstName && secondName && firstName === secondName);
};

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onCreateCategory,
  categories,
  products,
  editingProduct
}) => {
  const { showToast } = useToast();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [stockIngredients, setStockIngredients] = useState<StockIngredient[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientDraft[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredientsError, setIngredientsError] = useState<string | null>(null);
  const [codePreviewError, setCodePreviewError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nom: '',
    code: '',
    category_id: 0,
    prix_vente: 0,
    type_produit: 'PRODUIT_FINI' as const,
    actif: true
  });

  useEffect(() => {
    if (!isOpen) return;
    setSubmissionError(null);
    setCategoryName(editingProduct
      ? categories.find((category) => category.id === editingProduct.category_id)?.nom || ''
      : '');
    setRecipeIngredients([]);
    if (editingProduct) {
      setForm({
        nom: editingProduct.nom || '',
        code: editingProduct.code || '',
        category_id: editingProduct.category_id || 0,
        prix_vente: editingProduct.prix_vente || 0,
        type_produit: (editingProduct.type_produit || 'PRODUIT_FINI') as any,
        actif: editingProduct.actif ?? true
      });
    } else {
      setForm({
        nom: '',
        code: '',
        category_id: 0,
        prix_vente: 0,
        type_produit: 'PRODUIT_FINI',
        actif: true
      });
    }
    if (editingProduct) {
      setCodePreviewError(null);
      return;
    }

    let cancelled = false;
    setCodePreviewError(null);
    restaurantService.getNextRestaurantProductCode()
      .then((response) => {
        if (!response.success) throw new Error(response.message || 'Aperçu du code produit indisponible.');
        if (!cancelled) setForm((current) => ({ ...current, code: response.data.code }));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Erreur aperçu code plat Restaurant:', error);
        setCodePreviewError('Le code sera généré automatiquement à l’enregistrement.');
      });
    return () => { cancelled = true; };
  }, [isOpen, editingProduct]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadIngredients = async () => {
      setIngredientsLoading(true);
      setIngredientsError(null);
      try {
        const locationsResponse = await restaurantService.getStockLocations();
        if (!locationsResponse.success || !Array.isArray(locationsResponse.data)) {
          throw new Error(locationsResponse.message || 'Impossible de charger les emplacements de stock.');
        }
        const restaurantLocation = locationsResponse.data.find(
          (location: { nom: string }) => location.nom.toLowerCase().includes('restaurant')
        );
        if (!restaurantLocation) {
          throw new Error('Aucun emplacement de stock Restaurant n’a été trouvé.');
        }

        const [stockResponse, recipeResponse] = await Promise.all([
          restaurantService.getStocks({
            location_id: restaurantLocation.id,
            type_produit: 'MATIERE_PREMIERE',
          }),
          editingProduct
            ? restaurantService.getProductRecipe(editingProduct.id)
            : Promise.resolve({ success: true, data: [] as restaurantService.RestaurantRecipeIngredient[] }),
        ]);
        if (!stockResponse.success || !Array.isArray(stockResponse.data)) {
          throw new Error(stockResponse.message || 'Impossible de charger les ingrédients du stock Restaurant.');
        }
        if (!recipeResponse.success || !Array.isArray(recipeResponse.data)) {
          throw new Error(recipeResponse.message || 'Impossible de charger la recette du plat.');
        }
        if (cancelled) return;

        setStockIngredients(stockResponse.data);
        setRecipeIngredients(recipeResponse.data.map((ingredient) => ({
          ingredient_id: String(ingredient.ingredient_id),
          quantite: String(ingredient.quantite),
        })));
      } catch (error) {
        if (cancelled) return;
        console.error('Erreur lors du chargement des ingrédients du restaurant:', error);
        setIngredientsError(error instanceof Error ? error.message : 'Impossible de charger les ingrédients.');
      } finally {
        if (!cancelled) setIngredientsLoading(false);
      }
    };
    void loadIngredients();
    return () => { cancelled = true; };
  }, [isOpen, editingProduct]);

  const handleSubmit = async () => {
    if (!form.nom.trim()) return;
    if (recipeIngredients.some((ingredient) =>
      !ingredient.ingredient_id || !Number.isFinite(Number(ingredient.quantite)) || Number(ingredient.quantite) <= 0
    )) {
      showToast('Choisissez un ingrédient et saisissez une quantité positive pour chaque ligne.', 'error');
      return;
    }

    if (!editingProduct) {
      const matches = products.filter((product) =>
        isSimilarProductName(product.nom, form.nom)
      );
      if (matches.length > 0) {
        showToast(`Le produit « ${form.nom.trim()} » est déjà enregistré et ne peut pas être ajouté une deuxième fois.`, 'error');
        return;
      }
    }
    setSubmissionError(null);

    try {
      let categoryId: number | null = null;
      if (categoryName.trim()) {
        const normalizedCategoryName = normalizeProductName(categoryName);
        const existingCategory = categories.find(
          (category) => normalizeProductName(category.nom) === normalizedCategoryName
        );
        const category = existingCategory || await onCreateCategory(categoryName.trim());
        categoryId = category.id;
      }

      const payload: any = {
        nom: form.nom.trim(),
        code: form.code,
        category_id: categoryId,
        prix_vente: form.prix_vente,
        unite: editingProduct?.unite || 'PIECE',
        type_produit: form.type_produit,
        actif: form.actif,
        ingredients: recipeIngredients.map((ingredient) => ({
          ingredient_id: Number(ingredient.ingredient_id),
          quantite: Number(ingredient.quantite),
        }))
      };

      if (editingProduct) payload.id = editingProduct.id;
      await onSubmit(payload);
      onClose();
    } catch (error) {
      const apiError = error as { response?: { status?: number; data?: { message?: string } } };
      if (apiError.response?.status === 409) {
        showToast(apiError.response.data?.message || `Le produit « ${form.nom.trim()} » est déjà enregistré et ne peut pas être ajouté une deuxième fois.`, 'error');
        return;
      }
      setSubmissionError(error instanceof Error ? error.message : 'Impossible d’ajouter ce produit. Veuillez réessayer.');
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={editingProduct ? "Modifier le plat" : "Ajouter un plat"} size="lg">
        <div className="space-y-4">
        <Input
          label="Nom du plat"
          value={form.nom}
          onChange={(e) => {
            setForm({ ...form, nom: e.target.value });
            setSubmissionError(null);
          }}
          placeholder="Ex: Burger Deluxe"
        />
        {submissionError && (
          <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {submissionError}
          </p>
        )}

        <Input
          label="Code du plat"
          value={form.code}
          readOnly
          placeholder="Génération du code..."
        />
        {codePreviewError && <p className="text-xs text-muted">{codePreviewError}</p>}

        <Input
          label="Catégorie (facultatif)"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="Ex: Pizza"
        />

        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Prix de vente (MGA)"
            type="number"
            value={form.prix_vente}
            onChange={(e) => setForm({ ...form, prix_vente: Number(e.target.value) })}
            placeholder="0"
            min={0}
            step={1000}
          />
        </div>

        <section className="space-y-3 rounded-xl border border-slate-700/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-primary">Ingrédients du plat</h4>
              <p className="text-xs text-subtle">
                Sélectionnez les ingrédients disponibles dans le stock Restaurant et définissez la quantité nécessaire.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setRecipeIngredients((current) => [...current, { ingredient_id: '', quantite: '' }])}
            >
              Ajouter
            </Button>
          </div>

          {ingredientsLoading && (
            <p className="flex items-center gap-2 text-xs text-subtle">
              <Loader2 size={14} className="animate-spin" /> Chargement des ingrédients...
            </p>
          )}
          {ingredientsError && <p role="alert" className="text-xs text-red-400">{ingredientsError}</p>}
          {!ingredientsLoading && !ingredientsError && stockIngredients.length === 0 && (
            <p className="text-xs text-subtle">Aucun ingrédient disponible dans le stock Restaurant.</p>
          )}

          {recipeIngredients.map((ingredient, index) => {
            const selectedIngredient = stockIngredients.find(
              (item) => String(item.product_id) === ingredient.ingredient_id
            );
            const usedIds = new Set(recipeIngredients
              .filter((_, ingredientIndex) => ingredientIndex !== index)
              .map((item) => item.ingredient_id));
            return (
              <div key={index} className="grid grid-cols-1 gap-2 rounded-lg bg-slate-800/70 p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(90px,0.7fr)_minmax(90px,0.9fr)_36px] sm:items-end">
                <label className="space-y-1 text-xs font-medium text-secondary">
                  <span>Ingrédient</span>
                  <select
                    value={ingredient.ingredient_id}
                    onChange={(event) => setRecipeIngredients((current) => current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, ingredient_id: event.target.value } : item
                    ))}
                    className="h-11 w-full rounded-xl border border-slate-700/50 bg-slate-900 px-3 text-sm text-white"
                  >
                    <option value="">Sélectionner un ingrédient</option>
                    {stockIngredients
                      .filter((item) => !usedIds.has(String(item.product_id)))
                      .map((item) => (
                        <option key={item.product_id} value={item.product_id}>
                          {item.product_nom} — {Number(item.quantite)} {item.unite} en stock
                        </option>
                      ))}
                  </select>
                </label>
                <Input
                  label="Quantité"
                  type="number"
                  min="0"
                  step="any"
                  value={ingredient.quantite}
                  onChange={(event) => setRecipeIngredients((current) => current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, quantite: event.target.value } : item
                  ))}
                  placeholder="0"
                />
                <label className="space-y-1 text-xs font-medium text-secondary">
                  <span>Unité</span>
                  <input
                    readOnly
                    value={selectedIngredient?.unite || ''}
                    placeholder="Choisir"
                    className="h-11 w-full rounded-xl border border-slate-700/50 bg-slate-900 px-3 text-sm text-white"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Supprimer cet ingrédient"
                  title="Supprimer cet ingrédient"
                  onClick={() => setRecipeIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="flex h-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </section>

        <div className="flex items-center gap-3 pt-1">
          <input
            type="checkbox"
            checked={form.actif}
            onChange={(e) => setForm({ ...form, actif: e.target.checked })}
            className="w-4 h-4 rounded border-base bg-surface-2 text-accent focus:ring-accent/20"
          />
          <label className="text-secondary text-sm">Produit actif (disponible à la vente)</label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            disabled={!form.nom.trim() || ingredientsLoading || Boolean(ingredientsError)}
          >
            {editingProduct ? 'Modifier' : 'Ajouter'}
          </Button>
        </div>
      </div>
      </Modal>
    </>
  );
};