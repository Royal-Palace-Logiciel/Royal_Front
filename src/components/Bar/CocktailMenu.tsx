// src/components/Bar/CocktailMenu.tsx
import React, { useState } from 'react';
import { BarProduct } from '../../types/bar.type';
import { Button, Input, Modal, Select } from '../UI';
import { Check, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import barService from '../../services/bar.service';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/data';

// Normalise un nom d'article pour détecter les doublons :
// "J&B (70 cl)" et "JB 70cl" donnent la même clé, "Gordon's" et "Gordons" aussi.
const FORMAT_REGEX = /(\d+(?:[.,]\d+)?)\s*(cl|ml|l)\b|\b(pm|gm)\b/g;

const normalizeName = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/(\d)[.,](\d)/g, '$1§$2') // protège les décimales (1,5 L = 1.5L)
  .replace(/[&'’`´.\-_/()[\]]/g, ' ')
  .replace(/§/g, '.')
  .replace(/\s+/g, ' ')
  .trim();

const getNameParts = (value: string) => {
  const normalized = normalizeName(value);
  const formats = new Set<string>();
  const base = normalized.replace(FORMAT_REGEX, (_match, qty, unit, size) => {
    formats.add(size ? size : `${String(qty).replace(',', '.')}${unit}`);
    return ' ';
  }).replace(/\s+/g, '');
  return { base, formats };
};

// Même nom de base et formats compatibles (identiques, ou l'un des deux sans format précisé)
const isSimilarName = (a: string, b: string) => {
  const pa = getNameParts(a);
  const pb = getNameParts(b);
  if (!pa.base || pa.base !== pb.base) return false;
  if (pa.formats.size === 0 || pb.formats.size === 0) return true;
  return [...pa.formats].some((format) => pb.formats.has(format));
};

interface Props {
  cocktails: BarProduct[];
  stockMap?: Record<number, { quantite: number; unite: string; seuil_minimum?: number }>;
  onStockUpdate?: () => void;
  onAddToOrder?: (cocktail: BarProduct) => boolean | void | Promise<void>;
  onProductAdded?: (newProduct: BarProduct) => void;
  onProductUpdated?: (updatedProduct: BarProduct) => void;
  onProductDeleted?: (productId: number) => void;
  userIsAdmin?: boolean; // Ajout de la prop
}

export const CocktailMenu: React.FC<Props> = ({
  cocktails,
  stockMap,
  onStockUpdate,
  onAddToOrder,
  onProductAdded,
  onProductUpdated,
  onProductDeleted,
  userIsAdmin = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes');
  const [selectedSubcategory, setSelectedSubcategory] = useState('Toutes');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  // États du formulaire d'ajout
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('Alcools');
  const [sousCategorie, setSousCategorie] = useState('');
  const [prix, setPrix] = useState('');
  const [quantite, setQuantite] = useState('');
  const [seuilMinimum, setSeuilMinimum] = useState('5');
  const [unite, setUnite] = useState('unités');
  const [alcool, setAlcool] = useState(true);

  // Articles similaires détectés avant l'ajout
  const [duplicateMatches, setDuplicateMatches] = useState<BarProduct[]>([]);

  // États du formulaire de modification
  const [editingProduct, setEditingProduct] = useState<BarProduct | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editCategorie, setEditCategorie] = useState('Alcools');
  const [editSousCategorie, setEditSousCategorie] = useState('');
  const [editPrix, setEditPrix] = useState('');
  const [editQuantite, setEditQuantite] = useState('');
  const [editSeuilMinimum, setEditSeuilMinimum] = useState('5');
  const [editUnite, setEditUnite] = useState('unités');
  const [editAlcool, setEditAlcool] = useState(true);

  const handleOpenModal = () => {
    setNom('');
    setCategorie('Alcools');
    setSousCategorie('');
    setPrix('');
    setQuantite('');
    setSeuilMinimum('5');
    setUnite('unités');
    setAlcool(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cocktail: BarProduct) => {
    setEditingProduct(cocktail);
    setEditNom(cocktail.nom || '');
    const [productCategory, productSubcategory = ''] = (cocktail.categorie || 'Alcools').split(/\s*(?:>|\/|\|)\s*/);
    setEditCategorie(productCategory || 'Alcools');
    setEditSousCategorie(productSubcategory);
    setEditPrix(String(cocktail.prix ?? ''));
    setEditAlcool(Boolean(cocktail.alcool));

    const currentStock = stockMap?.[cocktail.id];
    setEditQuantite(currentStock ? String(currentStock.quantite) : '0');
    setEditUnite(currentStock?.unite || 'unités');
    setEditSeuilMinimum(currentStock?.seuil_minimum ? String(currentStock.seuil_minimum) : '5');

    setIsEditModalOpen(true);
  };

  const getSubcategories = (category: string) => {
    if (category === 'Cocktails') return ['Avec alcool', 'Sans alcool'];
    if (category === 'Bières & Soft') return ['PM', 'GM'];
    return [];
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct(false);
  };

  // Ouvre la modification de l'article déjà inscrit à la place d'un nouvel ajout
  const handleEditExisting = (product: BarProduct) => {
    setDuplicateMatches([]);
    setIsModalOpen(false);
    handleOpenEditModal(product);
  };

  const createProduct = async (force: boolean) => {
    const trimmedNom = nom.trim();
    const parsedPrix = Number(prix.toString().replace(',', '.'));
    const parsedQuantite = Number(quantite);
    const parsedSeuil = Number(seuilMinimum);

    if (!trimmedNom || Number.isNaN(parsedPrix) || parsedPrix < 0) {
      showToast('Veuillez renseigner un nom et un prix valide.', 'error');
      return;
    }

    if (Number.isNaN(parsedQuantite) || parsedQuantite < 0) {
      showToast('Veuillez renseigner un stock initial valide.', 'error');
      return;
    }

    if (!force) {
      const matches = cocktails.filter((product) => isSimilarName(product.nom || '', trimmedNom));
      if (matches.length > 0) {
        setDuplicateMatches(matches);
        return;
      }
    }

    try {
      setIsSaving(true);
      setDuplicateMatches([]);
      const payload = {
        nom: trimmedNom,
        categorie: sousCategorie ? `${categorie} > ${sousCategorie}` : categorie,
        prix: parsedPrix,
        alcool,
        quantite: parsedQuantite,
        seuil_minimum: parsedSeuil,
        unite: unite.trim() || 'unités',
      };

      const created = await barService.createBarProduct(payload);

      showToast('Boisson et stock ajoutés avec succès', 'success');
      if (onProductAdded) {
        onProductAdded(created);
      }
      if (onStockUpdate) {
        onStockUpdate();
      }
      setIsModalOpen(false);
    } catch (err) {
      showToast("Erreur lors de la création de la boisson", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const trimmedNom = editNom.trim();
    const parsedPrix = Number(editPrix.toString().replace(',', '.'));
    const parsedQuantite = Number(editQuantite);
    const parsedSeuil = Number(editSeuilMinimum);

    if (!trimmedNom || Number.isNaN(parsedPrix) || parsedPrix < 0) {
      showToast('Veuillez renseigner un nom et un prix valide.', 'error');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        nom: trimmedNom,
        categorie: editSousCategorie ? `${editCategorie} > ${editSousCategorie}` : editCategorie,
        prix: parsedPrix,
        alcool: editAlcool,
        quantite: Number.isNaN(parsedQuantite) ? 0 : parsedQuantite,
        seuil_minimum: Number.isNaN(parsedSeuil) ? 5 : parsedSeuil,
        unite: editUnite.trim() || 'unités',
      };

      const updated = await barService.updateBarProduct(editingProduct.id, payload);

      showToast('Boisson modifiée avec succès', 'success');

      if (onProductUpdated) {
        onProductUpdated({
          ...editingProduct,
          ...(typeof updated === 'object' && updated !== null ? updated : {}),
          nom: trimmedNom,
          categorie: editSousCategorie ? `${editCategorie} > ${editSousCategorie}` : editCategorie,
          prix: parsedPrix,
          alcool: editAlcool,
        });
      }

      if (onStockUpdate) {
        onStockUpdate();
      }
      setIsEditModalOpen(false);
    } catch (err) {
      showToast("Erreur lors de la modification de la boisson", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette boisson ?')) return;

    try {
      await barService.deleteBarProduct(productId);
      showToast('Boisson supprimée avec succès', 'success');
      if (onProductDeleted) {
        onProductDeleted(productId);
      }
      if (onStockUpdate) {
        onStockUpdate();
      }
    } catch (err) {
      showToast("Erreur lors de la suppression de la boisson", 'error');
    }
  };

  const getCategoryParts = (cocktail: BarProduct) => {
    const [category, subcategory] = (cocktail.categorie || 'Autres')
      .split(/\s*(?:>|\/|\|)\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    return { category: category || 'Autres', subcategory: subcategory || '' };
  };

  const categoryNames = ['Toutes', ...Array.from(new Set(cocktails.map((cocktail) => getCategoryParts(cocktail).category)))];
  const subcategoryNames = ['Toutes', ...Array.from(new Set(
    cocktails
      .filter((cocktail) => selectedCategory === 'Toutes' || getCategoryParts(cocktail).category === selectedCategory)
      .map((cocktail) => getCategoryParts(cocktail).subcategory)
      .filter(Boolean)
  ))];

  // Filtrer les articles selon la recherche et la navigation du terminal.
  const filteredCocktails = cocktails.filter((cocktail) => {
    const query = searchTerm.trim().toLowerCase();
    const parts = getCategoryParts(cocktail);
    const matchesSearch = !query || cocktail.nom.toLowerCase().includes(query) || cocktail.categorie.toLowerCase().includes(query);
    const matchesCategory = selectedCategory === 'Toutes' || parts.category === selectedCategory;
    const matchesSubcategory = selectedSubcategory === 'Toutes' || parts.subcategory === selectedSubcategory;
    return matchesSearch && matchesCategory && matchesSubcategory;
  });

  const selectCategory = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory('Toutes');
    setSearchTerm('');
  };

  const handleAddArticle = async (cocktail: BarProduct) => {
    const stock = stockMap?.[cocktail.id];
    if (!stock || stock.quantite <= 0) {
      showToast('Rupture de stock', 'error');
      return;
    }

    try {
      const added = await onAddToOrder?.(cocktail);
      if (added === false) {
        showToast("Créez d'abord une commande", 'error');
        return;
      }
      showToast(`${cocktail.nom} ajouté`, 'success');
    } catch {
      showToast("Erreur lors de l'ajout", 'error');
    }
  };

  const menuItems = filteredCocktails.filter((cocktail) => {
    const parts = getCategoryParts(cocktail);
    return (selectedCategory === 'Toutes' || parts.category === selectedCategory)
      && (selectedSubcategory === 'Toutes' || parts.subcategory === selectedSubcategory);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface border border-base rounded-xl p-4 shadow-sm">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold">Bar & Lounge</p>
          <h2 className="text-xl sm:text-2xl font-bold text-primary">Les boissons disponibles</h2>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher un article" className="w-full pl-9 text-xs sm:text-sm" />
          </div>
          {userIsAdmin && (
            <Button icon={<Plus size={18} />} onClick={handleOpenModal} className="whitespace-nowrap">
              Ajouter une boisson
            </Button>
          )}
        </div>
      </div>

      {filteredCocktails.length === 0 ? (
        <div className="rounded-xl border border-base bg-surface text-center py-12 text-slate-500 text-sm">
          Aucune boisson trouvée.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)] gap-3 rounded-xl border border-base bg-surface p-3 shadow-sm">
          <aside className="border-b lg:border-b-0 lg:border-r border-base pb-3 lg:pb-0 lg:pr-3">
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible">
              {categoryNames.map((category) => {
                const active = selectedCategory === category;
                return (
                  <button key={category} type="button" onClick={() => selectCategory(category)} className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${active ? 'bg-accent text-black shadow-accent' : 'bg-surface-2 text-secondary hover:bg-surface-3'}`}>
                    <span>{category}</span>
                    {active && <Check size={15} />}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0">
            {subcategoryNames.length > 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto border-b border-base pb-3">
                {subcategoryNames.map((subcategory) => (
                  <button key={subcategory} type="button" onClick={() => setSelectedSubcategory(subcategory)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition ${selectedSubcategory === subcategory ? 'bg-info text-white' : 'bg-surface-2 text-muted hover:text-primary'}`}>
                    {subcategory}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
              {menuItems.map((cocktail) => {
                const stock = stockMap?.[cocktail.id];
                const isOutOfStock = !stock || stock.quantite <= 0;
                return (
                  <div key={cocktail.id} className={`group relative min-h-[104px] rounded-lg border border-base bg-emerald-500/90 p-3 text-left transition hover:-translate-y-0.5 hover:bg-emerald-400 ${isOutOfStock ? 'opacity-50 grayscale' : ''}`}>
                    {onAddToOrder ? (
                      <button type="button" disabled={isOutOfStock} onClick={() => void handleAddArticle(cocktail)} className="flex h-full w-full flex-col items-center justify-center gap-2 text-center text-white disabled:cursor-not-allowed">
                        <span className="text-sm font-bold leading-tight">{cocktail.nom}</span>
                        <span className="text-xs font-semibold text-emerald-950">{formatCurrency(cocktail.prix)}</span>
                        <span className={`text-[10px] font-semibold ${isOutOfStock ? 'text-red-950' : 'text-emerald-950'}`}>
                          Stock : {stock?.quantite ?? 0} {stock?.unite || 'unités'}
                        </span>
                      </button>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center text-white">
                        <span className="text-sm font-bold leading-tight">{cocktail.nom}</span>
                        <span className="text-xs font-semibold text-emerald-950">{formatCurrency(cocktail.prix)}</span>
                        <span className={`text-[10px] font-semibold ${isOutOfStock ? 'text-red-950' : 'text-emerald-950'}`}>
                          Stock : {stock?.quantite ?? 0} {stock?.unite || 'unités'}
                        </span>
                      </div>
                    )}
                    {userIsAdmin && (
                      <div className="absolute right-1.5 top-1.5 hidden gap-1 group-hover:flex group-focus-within:flex [@media(hover:none)]:flex" onClick={(event) => event.stopPropagation()}>
                        <button type="button" onClick={() => handleOpenEditModal(cocktail)} className="rounded bg-black/20 p-1 text-white" title="Modifier"><Edit3 size={13} /></button>
                        <button type="button" onClick={() => void handleDeleteProduct(cocktail.id)} className="rounded bg-black/20 p-1 text-white" title="Supprimer"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Modal d'ajout de boisson */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Ajouter une nouvelle boisson" size="md">
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <Input
            label="Nom de la boisson"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex: Mojito, Whisky..."
          />
          <>
            <Input
              label="Catégorie"
              value={categorie}
              onChange={(e) => { setCategorie(e.target.value); setSousCategorie(''); }}
              placeholder="Saisir ou rechercher une catégorie"
              list="bar-product-categories"
            />
            <datalist id="bar-product-categories">
              {categoryNames.filter((category) => category !== 'Toutes').map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </>
          {getSubcategories(categorie).length > 0 && (
            <Select
              label="Sous-catégorie"
              value={sousCategorie}
              onChange={(e) => setSousCategorie(e.target.value)}
              options={[{ value: '', label: 'Sélectionner une sous-catégorie' }, ...getSubcategories(categorie).map((value) => ({ value, label: value }))]}
            />
          )}
          <Input
            label="Prix (MGA)"
            type="number"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            placeholder="Ex: 4000"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Stock initial"
              type="number"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              placeholder="Ex: 50"
            />
            <Input
              label="Seuil d'alerte min."
              type="number"
              value={seuilMinimum}
              onChange={(e) => setSeuilMinimum(e.target.value)}
              placeholder="Ex: 5"
            />
          </div>

          <Input
            label="Unité (ex: bouteilles, portions, verres)"
            value={unite}
            onChange={(e) => setUnite(e.target.value)}
            placeholder="Ex: bouteilles"
          />

          <Select
            label="Contient de l'alcool ?"
            value={alcool ? 'oui' : 'non'}
            onChange={(e) => setAlcool(e.target.value === 'oui')}
            options={[
              { value: 'oui', label: 'Oui' },
              { value: 'non', label: 'Non' },
            ]}
          />

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Avertissement : article déjà inscrit */}
      <Modal isOpen={duplicateMatches.length > 0} onClose={() => setDuplicateMatches([])} title="Article déjà inscrit" size="md">
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            « <span className="font-semibold text-primary">{nom.trim()}</span> » ressemble à {duplicateMatches.length > 1 ? 'des articles déjà inscrits' : 'un article déjà inscrit'}.
            Voulez-vous modifier l'article existant plutôt que d'en créer un nouveau ?
          </p>

          <div className="space-y-2">
            {duplicateMatches.map((product) => {
              const stock = stockMap?.[product.id];
              return (
                <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg border border-base bg-surface-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">{product.nom}</p>
                    <p className="text-xs text-muted">
                      {product.categorie || 'Sans catégorie'} · {formatCurrency(product.prix)}
                      {stock ? ` · Stock : ${stock.quantite} ${stock.unite}` : ''}
                    </p>
                  </div>
                  <Button type="button" icon={<Edit3 size={14} />} onClick={() => handleEditExisting(product)} className="shrink-0">
                    Modifier
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDuplicateMatches([])} className="flex-1">
              Annuler
            </Button>
            <Button variant="secondary" type="button" onClick={() => void createProduct(true)} className="flex-1" disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Ajouter quand même'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de modification de boisson */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Modifier la boisson" size="md">
        <form onSubmit={handleUpdateProduct} className="space-y-4">
          <Input
            label="Nom de la boisson"
            value={editNom}
            onChange={(e) => setEditNom(e.target.value)}
            placeholder="Ex: Mojito, Whisky..."
          />
          <>
            <Input
              label="Catégorie"
              value={editCategorie}
              onChange={(e) => { setEditCategorie(e.target.value); setEditSousCategorie(''); }}
              placeholder="Saisir ou rechercher une catégorie"
              list="bar-product-edit-categories"
            />
            <datalist id="bar-product-edit-categories">
              {categoryNames.filter((category) => category !== 'Toutes').map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </>
          {getSubcategories(editCategorie).length > 0 && (
            <Select
              label="Sous-catégorie"
              value={editSousCategorie}
              onChange={(e) => setEditSousCategorie(e.target.value)}
              options={[{ value: '', label: 'Sélectionner une sous-catégorie' }, ...getSubcategories(editCategorie).map((value) => ({ value, label: value }))]}
            />
          )}
          <Input
            label="Prix (MGA)"
            type="number"
            value={editPrix}
            onChange={(e) => setEditPrix(e.target.value)}
            placeholder="Ex: 4000"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Stock actuel"
              type="number"
              value={editQuantite}
              onChange={(e) => setEditQuantite(e.target.value)}
              placeholder="Ex: 50"
            />
            <Input
              label="Seuil d'alerte min."
              type="number"
              value={editSeuilMinimum}
              onChange={(e) => setEditSeuilMinimum(e.target.value)}
              placeholder="Ex: 5"
            />
          </div>

          <Input
            label="Unité (ex: bouteilles, portions, verres)"
            value={editUnite}
            onChange={(e) => setEditUnite(e.target.value)}
            placeholder="Ex: bouteilles"
          />

          <Select
            label="Contient de l'alcool ?"
            value={editAlcool ? 'oui' : 'non'}
            onChange={(e) => setEditAlcool(e.target.value === 'oui')}
            options={[
              { value: 'oui', label: 'Oui' },
              { value: 'non', label: 'Non' },
            ]}
          />

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? 'Modification...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};