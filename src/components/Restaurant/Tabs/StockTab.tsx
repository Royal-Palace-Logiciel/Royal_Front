import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Package, Plus, History, X, Truck, BookOpen,
  ChevronRight, AlertTriangle, RefreshCw, Trash2, Search, Loader2, Edit2, AlertCircle,
} from 'lucide-react';
import * as restaurantService from '../../../services/restaurantService';
import { financeService } from '../../../services/finance.service';
import { Button, DataTable, Modal, Input, Select, Badge } from '../../UI';
import { useHDA } from '../../../context/HDAContext';
import AuthService from '../../../services/authService';
import { isAdmin } from '../../../utils/permissions';
import { formatCurrency } from '../../../utils/data';

// ==================== TYPES ====================

interface StockItem {
  id: number;
  product_id: number;
  location_id: number;
  quantite: number;
  product_nom: string;
  unite: string;
  code: string;
  location_nom: string;
  type_produit: string;
  prix_achat?: number;
  prix_vente?: number;
  category_id?: number;
  subcategory_id?: number;
  category_nom?: string;
  subcategory_nom?: string;
  portion_size?: number;
  portion_unite?: string;
}

interface StockLocation { id: number; nom: string; }
interface Unit { id: number; code: string; nom: string; }
interface Supplier { id: number; nom: string; telephone?: string; email?: string; }
interface Category { id: number; nom: string; }
interface Subcategory { id: number; category_id: number; nom: string; }

interface Product {
  id: number; nom: string; unite: string;
  type_produit: string; code: string;
  prix_achat: number; prix_vente: number;
  actif: boolean; category_id: number | null;
  subcategory_id: number | null;
  category_nom?: string;
  subcategory_nom?: string;
  portion_size?: number | null;
  portion_unite?: string | null;
}

interface Purchase {
  id: number; supplier_nom: string; montant_total: number; statut: string;
}

type InnerTab = 'stock' | 'achats';

// ==================== HELPERS ====================

const inputClass = "w-full h-9 px-3 rounded-xl text-primary text-sm";
const inputStyle = { backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' };

const ModalShell: React.FC<{
  title: string; onClose: () => void; wide?: boolean; children: React.ReactNode;
}> = ({ title, onClose, wide, children }) =>
    createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div
          className={`rounded-xl p-6 w-full ${wide ? 'max-w-2xl' : 'max-w-sm'} max-h-[90vh] overflow-y-auto`}
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-primary font-semibold">{title}</h4>
            <button onClick={onClose} className="text-muted hover:text-primary"><X size={18} /></button>
          </div>
          {children}
        </div>
      </div>,
      document.body
    );

// ==================== TAB BAR ====================

const TabBar: React.FC<{ active: InnerTab; onChange: (t: InnerTab) => void }> = ({ active, onChange }) => (
  <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-surface-2)' }}>
      {([
      { key: 'stock' as const, label: 'Stock', icon: <Package size={14} /> },
      { key: 'achats' as const, label: 'Achats', icon: <Truck size={14} /> },
    ]).map(t => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
        style={{
          backgroundColor: active === t.key ? 'var(--color-accent)' : 'transparent',
          color: active === t.key ? '#fff' : 'var(--color-text-secondary)',
        }}
      >
        {t.icon}{t.label}
      </button>
    ))}
  </div>
);

// ==================== STOCK TAB ====================

export const StockTab: React.FC = () => {
  const [inner, setInner] = useState<InnerTab>('stock');
  return (
    <div className="rounded-2xl w-full" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="p-4">
        <h3 className="text-primary font-semibold flex items-center gap-2 mb-4">
          <Package size={18} className="text-accent" /> Gestion des Stocks — Restaurant
        </h3>
        <TabBar active={inner} onChange={setInner} />
        {inner === 'stock' && <StockPanel />}
        {inner === 'achats' && <AchatsPanel />}
      </div>
    </div>
  );
};

// ==================== PANEL STOCK ====================

const StockPanel: React.FC = () => {
  const { addNotification } = useHDA();
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [histLoading, setHistLoading] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPortionModal, setShowPortionModal] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<StockItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [portionTarget, setPortionTarget] = useState<StockItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Ajout produit
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [form, setForm] = useState({
    nom: '', category_id: '', subcategory_id: '', type_produit: 'MATIERE_PREMIERE', unite: '',
    uniteCustom: '', prix_achat: 0, prix_vente: 0, quantite: 0,
    portion_size: 0, portion_unite: 'g'
  });
  const [addErr, setAddErr] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Ajustement
  const [adjType, setAdjType] = useState<'ENTREE' | 'SORTIE'>('ENTREE');
  const [adjQty, setAdjQty] = useState(0);
  const [adjErr, setAdjErr] = useState('');
  const [adjLoading, setAdjLoading] = useState(false);

  // Portion management
  const [portionSize, setPortionSize] = useState(0);
  const [portionErr, setPortionErr] = useState('');
  const [portionLoading, setPortionLoading] = useState(false);

  const [productTypes, setProductTypes] = useState<{ id: number; nom: string; actif: boolean }[]>([]);

  const getErrorMessage = (err: unknown) => {
    if (typeof err === 'object' && err !== null && 'response' in err) {
      const response = (err as { response?: { data?: { message?: string; error?: { message?: string } } } }).response;
      return response?.data?.message || response?.data?.error?.message || 'Erreur réseau';
    }
    return err instanceof Error ? err.message : 'Erreur de connexion';
  };

  const computeStatus = (qty: number) => {
    if (qty === 0) return 'epuise';
    if (qty < 5) return 'faible';
    return 'disponible';
  };

  const notifyStockLevel = (nom: string, quantite: number, unite: string) => {
    if (quantite <= 3) {
      addNotification('error', `Stock critique: ${nom} (${quantite} ${unite})`, 'Restaurant', '/restaurant?tab=stock');
    } else if (quantite <= 5) {
      addNotification('warning', `Stock faible: ${nom} (${quantite} ${unite})`, 'Restaurant', '/restaurant?tab=stock');
    }
  };

  useEffect(() => {
    Promise.all([
      restaurantService.getStockLocations(),
      restaurantService.getUnits(),
      restaurantService.getCategories().catch(() => ({ success: false, data: [] })),
    ]).then(([loc, un, cat]) => {
      if (loc.success) {
        setLocations(loc.data);
        const restaurantLocation = loc.data.find((location: StockLocation) => location.nom.toLowerCase().includes('restaurant'));
        if (restaurantLocation) setSelectedLoc(restaurantLocation.id);
        else if (loc.data.length > 0) setSelectedLoc(loc.data[0].id);
      }
      if (un.success) {
        setUnits(un.data);
        if (un.data.length > 0) setForm(prev => ({ ...prev, unite: un.data[0].code }));
      }
      if (cat.success) setCategories(cat.data);
    });
  }, []);

  // Load subcategories when category changes
  useEffect(() => {
    if (form.category_id) {
      restaurantService.getSubcategories({ category_id: Number(form.category_id) })
        .then(res => {
          if (res.success) setSubcategories(res.data);
        })
        .catch(() => setSubcategories([]));
    } else {
      setSubcategories([]);
    }
  }, [form.category_id]);

  useEffect(() => {
    restaurantService.getProductTypes()
      .then(res => {
        if (res.success) setProductTypes(res.data);
      })
      .catch(console.error);
  }, []);

  const loadStocks = useCallback(() => {
    if (!selectedLoc) return;
    setLoading(true);
    setError(null);
    const params: Record<string, any> = { location_id: selectedLoc };
    if (typeFilter) params.type_produit = typeFilter;
    restaurantService.getStocks(params)
      .then(res => { 
        if (res.success) setStocks(res.data); 
        else setError('Erreur lors du chargement du stock');
      })
      .catch(err => {
        setError(getErrorMessage(err));
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [selectedLoc, typeFilter]);

  useEffect(() => { loadStocks(); }, [loadStocks]);

  const loadHistory = () => {
    if (!selectedLoc) return;
    setHistLoading(true);
    restaurantService.getStockMovements({ location_id: selectedLoc })
      .then(res => { if (res.success) { setMovements(res.data); setShowHistory(true); } })
      .catch(console.error)
      .finally(() => setHistLoading(false));
  };

  const quickAdjust = async (productId: number, delta: number) => {
    if (!selectedLoc) return;
    try {
      const res = await restaurantService.adjustStock({
        product_id: productId,
        location_id: selectedLoc,
        type_mouvement: delta > 0 ? 'ENTREE' : 'SORTIE',
        quantite: Math.abs(delta),
        source_module: 'MANUEL',
      });
      if (res.success) {
        setStocks(prev => {
          const updated = prev.map(s =>
            s.product_id === productId ? { ...s, quantite: res.data.newQty } : s
          );
          
          const updatedItem = updated.find(s => s.product_id === productId);
          if (updatedItem && updatedItem.quantite <= 5) {
            notifyStockLevel(updatedItem.product_nom, updatedItem.quantite, updatedItem.unite);
          }
          
          return updated;
        });
      }
    } catch (e: any) { alert(e.message); }
  };

  const handleAdjust = async () => {
    if (!adjustTarget || !selectedLoc || adjQty <= 0) { setAdjErr('Quantité invalide.'); return; }
    setAdjLoading(true); setAdjErr('');
    try {
      const res = await restaurantService.adjustStock({
        product_id: adjustTarget.product_id,
        location_id: selectedLoc,
        type_mouvement: adjType,
        quantite: adjQty,
        source_module: 'MANUEL',
      });
      if (res.success) {
        setStocks(prev => prev.map(s =>
          s.product_id === adjustTarget.product_id ? { ...s, quantite: res.data.newQty } : s
        ));
        setShowAdjustModal(false);
      }
    } catch (e: any) { setAdjErr(e.message); }
    finally { setAdjLoading(false); }
  };

  const handleAddProduct = async () => {
    if (!selectedLoc) return;
    const finalUnite = form.unite === 'AUTRE' ? form.uniteCustom.trim() : form.unite;
    if (!form.nom.trim()) { setAddErr('Nom requis.'); return; }
    if (!finalUnite) { setAddErr('Unité requise.'); return; }
    if (form.quantite <= 0) { setAddErr('Quantité initiale > 0.'); return; }
    setAddLoading(true); setAddErr('');
    try {
      const prodRes = await restaurantService.createProduct({
        nom: form.nom.trim(),
        unite: finalUnite,
        type_produit: form.type_produit,
        prix_achat: form.prix_achat,
        prix_vente: form.prix_vente,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        subcategory_id: form.subcategory_id ? Number(form.subcategory_id) : undefined,
        portion_size: form.portion_size > 0 ? form.portion_size : undefined,
        portion_unite: form.portion_unite,
      });
      if (!prodRes.data) throw new Error(prodRes.message || 'Erreur');
      await restaurantService.adjustStock({
        product_id: prodRes.data.id,
        location_id: selectedLoc,
        type_mouvement: 'ENTREE',
        quantite: form.quantite,
        source_module: 'INVENTAIRE',
      });

      const totalCost = form.quantite * Number(form.prix_achat || 0);
      if (totalCost > 0) {
        try {
          await financeService.createTransaction({
            module: 'RESTAURANT',
            type_flux: 'SORTIE',
            montant: totalCost,
            description: `Achat initial stock - ${form.nom.trim()} (${form.quantite} ${finalUnite})`,
          });
        } catch (fErr) {
          console.error('Erreur journalisation finance:', fErr);
        }
      }

      await loadStocks();
      setShowAddModal(false);
      setForm({ nom: '', category_id: '', subcategory_id: '', type_produit: 'MATIERE_PREMIERE', unite: '', uniteCustom: '', prix_achat: 0, prix_vente: 0, quantite: 0, portion_size: 0, portion_unite: 'g' });
      notifyStockLevel(form.nom.trim(), form.quantite, finalUnite);
      addNotification('success', `Produit ${form.nom.trim()} ajouté avec succès`, 'Restaurant');
    } catch (e: any) { setAddErr(e.message); }
    finally { setAddLoading(false); }
  };

  const openEdit = (item: StockItem) => {
    setEditItem(item);
    setForm({
      nom: item.product_nom || '',
      category_id: item.category_id ? String(item.category_id) : '',
      subcategory_id: item.subcategory_id ? String(item.subcategory_id) : '',
      type_produit: item.type_produit || 'MATIERE_PREMIERE',
      unite: item.unite || '',
      uniteCustom: '',
      prix_achat: Number(item.prix_achat || 0),
      prix_vente: Number(item.prix_vente || 0),
      quantite: Number(item.quantite || 0),
      portion_size: Number(item.portion_size || 0),
      portion_unite: item.portion_unite || 'g',
    });
    setShowEditModal(true);
  };

  const handleDeleteStock = async () => {
    if (!deleteTarget || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const res = await restaurantService.deleteStockItem({ product_id: deleteTarget.product_id, location_id: deleteTarget.location_id });
      if (res.success) {
        setStocks(prev => prev.filter(s => !(s.product_id === deleteTarget.product_id && s.location_id === deleteTarget.location_id)));
        setShowDeleteModal(false);
        setDeleteTarget(null);
        addNotification('success', 'Produit supprimé du stock', 'Restaurant');
      }
    } catch (e: any) {
      console.error('Delete error:', e);
      addNotification('error', e.message || 'Erreur lors de la suppression', 'Restaurant');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConsumePortion = async () => {
    if (!portionTarget || !selectedLoc || portionSize <= 0) {
      setPortionErr('Quantité de portion invalide.');
      return;
    }
    setPortionLoading(true);
    setPortionErr('');
    try {
      const res = await restaurantService.consumePortion({
        product_id: portionTarget.product_id,
        location_id: selectedLoc,
        portion_size: portionSize,
        portion_unit: 'g',
      });
      if (res.success) {
        setStocks(prev => prev.map(s =>
          s.product_id === portionTarget.product_id ? { ...s, quantite: res.data.new_quantity } : s
        ));
        setShowPortionModal(false);
        setPortionTarget(null);
        setPortionSize(0);
        addNotification('success', `Portion de ${portionSize}g consommée. Reste: ${res.data.new_quantity}g`, 'Restaurant');
      }
    } catch (e: any) {
      setPortionErr(e.message || 'Erreur lors de la consommation de portion');
    } finally {
      setPortionLoading(false);
    }
  };

  const currentUser = AuthService.getCurrentUser();
  const userIsAdmin = isAdmin(currentUser);

  const filteredStocks = stocks.filter(item => {
    const matchSearch = item.product_nom.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || item.type_produit === typeFilter;
    const status = computeStatus(Number(item.quantite));
    const matchStatus = filterStatus === 'all' || status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const enrichedStocks = filteredStocks.map(item => ({
    ...item,
    status: computeStatus(Number(item.quantite)),
    prixUnitaire: Number(item.prix_achat || item.prix_vente || 0),
    seuilMinimum: 5,
  }));

  const totalValue = enrichedStocks.reduce((sum, i) => sum + (Number(i.quantite) * i.prixUnitaire), 0);
  const alerts = enrichedStocks.filter(i => i.status !== 'disponible').length;

  const baseColumns = [
    { key: 'product_nom', label: 'Produit', render: (item: any) => (
      <div>
        <p className="text-white font-medium">{item.product_nom}</p>
        <p className="text-slate-500 text-xs">{item.type_produit} • {item.location_nom}</p>
        {item.category_nom && <p className="text-slate-600 text-xs">Catégorie: {item.category_nom}</p>}
        {item.subcategory_nom && <p className="text-slate-600 text-xs">Sous-catégorie: {item.subcategory_nom}</p>}
      </div>
    )},
    { key: 'quantite', label: 'Stock', render: (item: any) => (
      <div>
        <p className="text-white font-semibold">{Number(item.quantite).toFixed(2)} {item.unite}</p>
        <p className="text-slate-600 text-xs">Min: 5</p>
      </div>
    )},
    { key: 'prix_achat', label: 'Prix Achat', render: (item: any) => (
      <span className="text-white">{formatCurrency(item.prixUnitaire || item.prix_achat || 0)}</span>
    )},
    { key: 'valeur', label: 'Valeur', render: (item: any) => (
      <span className="text-amber-400 font-semibold">{formatCurrency(Number(item.quantite) * (item.prixUnitaire || item.prix_achat || 0))}</span>
    )},
    { key: 'status', label: 'Statut', render: (item: any) => (
      <Badge variant={item.status}>
        {item.status === 'disponible' ? 'Disponible' : item.status === 'faible' ? 'Faible' : 'Épuisé'}
      </Badge>
    )},
  ];

  const columns = userIsAdmin ? [
    ...baseColumns,
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex gap-2">
        <button onClick={() => { setPortionTarget(item); setPortionSize(0); setShowPortionModal(true); }} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all" title="Consommer une portion">
          <Package size={14} />
        </button>
        <button onClick={() => openEdit(item)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all" title="Modifier l'article">
          <Edit2 size={14} />
        </button>
        <button onClick={() => { setAdjustTarget(item); setAdjType('ENTREE'); setAdjQty(0); setAdjErr(''); setShowAdjustModal(true); }} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all" title="Ajuster le stock">
          <RefreshCw size={14} />
        </button>
        <button onClick={() => { setDeleteTarget(item); setShowDeleteModal(true); }} className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition-all" title="Supprimer l'article">
          <Trash2 size={14} />
        </button>
      </div>
    )},
  ] : baseColumns;

  return (
    <>
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-amber-400 mr-2" size={20} />
          <span className="text-slate-400 text-sm">Chargement du stock...</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stats Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Produits', value: enrichedStocks.length, color: 'text-white', sub: 'articles total' },
              { label: 'Valeur Totale', value: formatCurrency(totalValue), color: 'text-amber-400', sub: 'en stock' },
              { label: 'Alertes', value: alerts, color: alerts > 0 ? 'text-amber-400' : 'text-emerald-400', sub: 'à surveiller' },
              { label: 'Épuisés', value: enrichedStocks.filter(i => i.status === 'epuise').length, color: 'text-red-400', sub: 'rupture de stock' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-900 border border-slate-800/50 rounded-2xl p-4">
                <p className="text-slate-500 text-xs font-medium mb-1">{stat.label}</p>
                <p className={`${stat.color} font-bold text-xl`}>{stat.value}</p>
                <p className="text-slate-600 text-xs">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="bg-slate-900 border border-slate-800/50 rounded-2xl overflow-hidden mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-b border-slate-800/50">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={selectedLoc || ''}
                  onChange={e => setSelectedLoc(Number(e.target.value))}
                  className="h-9 px-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none"
                >
                  {locations.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                </select>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="h-9 px-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none"
                >
                  <option value="">Tous types</option>
                  {productTypes.map(type => (
                    <option key={type.id} value={type.nom}>{type.nom}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 px-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none">
                  <option value="all">Tous</option>
                  <option value="disponible">Disponible</option>
                  <option value="faible">Faible</option>
                  <option value="epuise">Épuisé</option>
                </select>
                <button onClick={loadStocks} className="h-9 px-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-400 hover:text-white transition-all">
                  <RefreshCw size={14} />
                </button>
                <button onClick={loadHistory} className="h-9 px-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-400 hover:text-white transition-all flex items-center gap-2">
                  <History size={14} /> Historique
                </button>
                {userIsAdmin && (
                  <Button icon={<Plus size={16} />} onClick={() => { setAddErr(''); setShowAddModal(true); }}>
                    Ajouter
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-slate-900 border border-slate-800/50 rounded-2xl overflow-hidden">
            <DataTable data={enrichedStocks} columns={columns} />
          </div>

          {/* Add Product Modal */}
          <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setForm({ nom: '', category_id: '', subcategory_id: '', type_produit: 'MATIERE_PREMIERE', unite: '', uniteCustom: '', prix_achat: 0, prix_vente: 0, quantite: 0, portion_size: 0, portion_unite: 'g' }); }} title="Ajouter un produit">
            <div className="space-y-4">
              <Input label="Nom du produit" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Ex: Poulet 200g" />
              <Select label="Type de produit" value={form.type_produit} onChange={e => setForm({...form, type_produit: e.target.value})} options={productTypes.map(t => ({ value: t.nom, label: t.nom }))} />
              <Select label="Catégorie" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value, subcategory_id: ''})} options={[{ value: '', label: 'Sans catégorie' }, ...categories.map(c => ({ value: String(c.id), label: c.nom }))]} />
              {form.category_id && subcategories.length > 0 && (
                <Select label="Sous-catégorie" value={form.subcategory_id} onChange={e => setForm({...form, subcategory_id: e.target.value})} options={[{ value: '', label: 'Sans sous-catégorie' }, ...subcategories.map(s => ({ value: String(s.id), label: s.nom }))]} />
              )}
              <Select label="Unité" value={form.unite} onChange={e => setForm({...form, unite: e.target.value})} options={units.map(u => ({ value: u.code, label: `${u.nom} (${u.code})` })).concat([{ value: 'AUTRE', label: 'Autre...' }])} />
              {form.unite === 'AUTRE' && (
                <Input label="Unité personnalisée" value={form.uniteCustom} onChange={e => setForm({...form, uniteCustom: e.target.value})} placeholder="Ex: paquet, bouteille..." />
              )}
              <div className="grid grid-cols-2 gap-4">
                <Input label="Prix d'achat (MGA)" type="number" value={form.prix_achat} onChange={e => setForm({...form, prix_achat: Number(e.target.value)})} />
                <Input label="Prix de vente (MGA)" type="number" value={form.prix_vente} onChange={e => setForm({...form, prix_vente: Number(e.target.value)})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Quantité initiale" type="number" value={form.quantite} onChange={e => setForm({...form, quantite: Number(e.target.value)})} />
                <Input label="Taille portion (ex: 150)" type="number" value={form.portion_size} onChange={e => setForm({...form, portion_size: Number(e.target.value)})} placeholder="Pour gestion par portion" />
              </div>
              {form.portion_size > 0 && (
                <Select label="Unité de portion" value={form.portion_unite} onChange={e => setForm({...form, portion_unite: e.target.value})} options={[
                  { value: 'g', label: 'Grammes (g)' },
                  { value: 'kg', label: 'Kilogrammes (kg)' },
                  { value: 'ml', label: 'Millilitres (ml)' },
                  { value: 'l', label: 'Litres (l)' },
                  { value: 'unité', label: 'Unité' }
                ]} />
              )}
              {addErr && <p className="text-red-400 text-sm">{addErr}</p>}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => { setShowAddModal(false); setForm({ nom: '', category_id: '', subcategory_id: '', type_produit: 'MATIERE_PREMIERE', unite: '', uniteCustom: '', prix_achat: 0, prix_vente: 0, quantite: 0, portion_size: 0, portion_unite: 'g' }); }} className="flex-1">Annuler</Button>
                <Button onClick={handleAddProduct} className="flex-1" disabled={addLoading}>{addLoading ? 'Ajout...' : 'Ajouter'}</Button>
              </div>
            </div>
          </Modal>

          {/* Edit Stock Modal */}
          <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditItem(null); }} title="Modifier le produit & stock">
            <div className="space-y-4">
              <Input label="Nom du produit" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Prix d'achat (MGA)" type="number" value={form.prix_achat} onChange={e => setForm({...form, prix_achat: Number(e.target.value)})} />
                <Input label="Prix de vente (MGA)" type="number" value={form.prix_vente} onChange={e => setForm({...form, prix_vente: Number(e.target.value)})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Quantité" type="number" value={form.quantite} onChange={e => setForm({...form, quantite: Number(e.target.value)})} />
                <Input label="Unité" value={form.unite} onChange={e => setForm({...form, unite: e.target.value})} placeholder="kg, pièce, l..." />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditItem(null); }} className="flex-1">Annuler</Button>
                <Button onClick={async () => {
                  if (!editItem || !selectedLoc) return;
                  try {
                    await restaurantService.updateProduct(editItem.product_id, {
                      nom: form.nom,
                      prix_achat: form.prix_achat,
                      prix_vente: form.prix_vente,
                      unite: form.unite,
                    });

                    const delta = form.quantite - Number(editItem.quantite);
                    if (delta !== 0) {
                      await restaurantService.adjustStock({
                        product_id: editItem.product_id,
                        location_id: selectedLoc,
                        type_mouvement: delta > 0 ? 'ENTREE' : 'SORTIE',
                        quantite: Math.abs(delta),
                        source_module: 'MANUEL',
                      });
                    }
                    await loadStocks();
                    setShowEditModal(false);
                    setEditItem(null);
                    notifyStockLevel(form.nom, form.quantite, form.unite);
                    addNotification('success', 'Article de stock mis à jour', 'Restaurant');
                  } catch (e: any) {
                    setError(e.message);
                  }
                }} className="flex-1">Mettre à jour</Button>
              </div>
            </div>
          </Modal>

          {/* Adjust Stock Modal */}
          {showAdjustModal && adjustTarget && (
            <ModalShell title="Ajuster le stock" onClose={() => setShowAdjustModal(false)}>
              <div className="space-y-3">
                <p className="text-sm text-slate-400">Produit: <span className="text-white font-medium">{adjustTarget.product_nom}</span></p>
                <p className="text-sm text-slate-400">Stock actuel: <span className="text-white font-medium">{Number(adjustTarget.quantite).toFixed(2)} {adjustTarget.unite}</span></p>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Type de mouvement</label>
                  <select
                    value={adjType}
                    onChange={e => setAdjType(e.target.value as 'ENTREE' | 'SORTIE')}
                    className="w-full h-9 px-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none"
                  >
                    <option value="ENTREE">Entrée (+)</option>
                    <option value="SORTIE">Sortie (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Quantité</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={adjQty}
                    onChange={e => setAdjQty(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none"
                  />
                </div>
                {adjErr && <p className="text-red-400 text-sm">{adjErr}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <button 
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-slate-800 text-slate-300 hover:bg-slate-700"
                    onClick={() => setShowAdjustModal(false)} 
                  >
                    Annuler
                  </button>
                  <button 
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-amber-500 text-black hover:bg-amber-400"
                    onClick={handleAdjust} 
                    disabled={adjLoading}
                  >
                    {adjLoading ? 'Traitement...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            </ModalShell>
          )}

          {/* Delete Modal */}
          {showDeleteModal && deleteTarget && (
            <ModalShell title="Confirmer la suppression" onClose={() => setShowDeleteModal(false)}>
              <div className="space-y-3">
                <p className="text-sm text-slate-300">Êtes-vous sûr de vouloir supprimer <span className="text-white font-medium">{deleteTarget.product_nom}</span> du stock ?</p>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-slate-800 text-slate-300 hover:bg-slate-700"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Annuler
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-red-500 text-white hover:bg-red-400"
                    onClick={handleDeleteStock}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? 'Suppression...' : 'Supprimer'}
                  </button>
                </div>
              </div>
            </ModalShell>
          )}

          {/* Portion Consumption Modal */}
          {showPortionModal && portionTarget && (
            <ModalShell title="Consommer une portion" onClose={() => setShowPortionModal(false)}>
              <div className="space-y-3">
                <p className="text-sm text-slate-400">Produit: <span className="text-white font-medium">{portionTarget.product_nom}</span></p>
                <p className="text-sm text-slate-400">Stock actuel: <span className="text-white font-medium">{Number(portionTarget.quantite).toFixed(2)} {portionTarget.unite}</span></p>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Taille de la portion (g)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={portionSize}
                    onChange={e => setPortionSize(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none"
                    placeholder="Ex: 150"
                  />
                </div>
                {portionSize > 0 && (
                  <p className="text-sm text-slate-400">
                    Stock restant après consommation: <span className="text-white font-medium">{Math.max(0, Number(portionTarget.quantite) - portionSize).toFixed(2)} {portionTarget.unite}</span>
                  </p>
                )}
                {portionErr && <p className="text-red-400 text-sm">{portionErr}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-slate-800 text-slate-300 hover:bg-slate-700"
                    onClick={() => setShowPortionModal(false)}
                  >
                    Annuler
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-amber-500 text-black hover:bg-amber-400"
                    onClick={handleConsumePortion}
                    disabled={portionLoading || portionSize <= 0}
                  >
                    {portionLoading ? 'Traitement...' : 'Consommer'}
                  </button>
                </div>
              </div>
            </ModalShell>
          )}

          {/* Stock History */}
          {showHistory && (
            <div className="mt-6 bg-slate-900 border border-slate-800/50 rounded-2xl overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800/50">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <History size={18} className="text-amber-400" />
                  Mouvements de stock récents
                </h3>
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white text-sm">Fermer</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800/50">
                      <th className="text-left p-4">Date</th>
                      <th className="text-left p-4">Produit</th>
                      <th className="text-left p-4">Type</th>
                      <th className="text-left p-4">Source</th>
                      <th className="text-right p-4">Quantité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(m => (
                      <tr key={m.id} className="border-b border-slate-800/30 hover:bg-slate-800/30">
                        <td className="p-4 text-slate-300">{new Date(m.created_at).toLocaleString('fr-FR')}</td>
                        <td className="p-4 text-white font-medium">{m.product_nom}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${m.type_mouvement === 'ENTREE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {m.type_mouvement}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{m.source_module || '—'}</td>
                        <td className="p-4 text-right text-white font-medium">{Number(m.quantite).toFixed(2)} {m.unite}</td>
                      </tr>
                    ))}
                    {movements.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-500">Aucun mouvement de stock</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

// ==================== PANEL ACHATS ====================

const AchatsPanel: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Nouvel achat
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [lines, setLines] = useState([{ product_id: '' as number | '', location_id: '' as number | '', quantite: 0, prix_unitaire: 0 }]);
  const [purchaseErr, setPurchaseErr] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // Nouveau fournisseur
  const [supNom, setSupNom] = useState('');
  const [supTel, setSupTel] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supErr, setSupErr] = useState('');
  const [supLoading, setSupLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      restaurantService.getSuppliers(),
      restaurantService.getProducts({ actif: true }),
      restaurantService.getStockLocations(),
      restaurantService.getPurchases(),
    ]).then(([sup, prod, loc, pur]: any[]) => {
      setSuppliers(sup?.data || sup || []);
      setProducts(prod?.data || prod || []);
      setLocations(loc?.data || loc || []);
      setPurchases(pur?.data || pur || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateLine = (i: number, field: string, val: any) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const total = lines.reduce((s, l) => s + (l.quantite * l.prix_unitaire), 0);

  const handlePurchase = async () => {
    if (!supplierId) { setPurchaseErr('Fournisseur requis.'); return; }
    for (const l of lines) {
      if (!l.product_id || !l.location_id || l.quantite <= 0 || l.prix_unitaire <= 0) {
        setPurchaseErr('Toutes les lignes doivent être complètes et > 0.'); return;
      }
    }
    setPurchaseLoading(true); setPurchaseErr('');
    try {
      const res = await restaurantService.createPurchase({
        supplier_id: Number(supplierId),
        items: lines.map(l => ({
          product_id: Number(l.product_id),
          location_id: Number(l.location_id),
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
        })),
      });
      if (res.success) {
        await load();
        setShowPurchaseModal(false);
        setSupplierId('');
        setLines([{ product_id: '', location_id: '', quantite: 0, prix_unitaire: 0 }]);
      }
    } catch (e: any) { setPurchaseErr(e.message); }
    finally { setPurchaseLoading(false); }
  };

  const handleSupplier = async () => {
    if (!supNom.trim()) { setSupErr('Nom requis.'); return; }
    setSupLoading(true); setSupErr('');
    try {
      const res = await restaurantService.createSupplier({ nom: supNom.trim(), telephone: supTel || undefined, email: supEmail || undefined });
      if (res.success) {
        setSuppliers(prev => [...prev, res.data]);
        setShowSupplierModal(false);
        setSupNom(''); setSupTel(''); setSupEmail('');
      }
    } catch (e: any) { setSupErr(e.message); }
    finally { setSupLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-primary font-semibold flex items-center gap-2">
          <Truck size={16} className="text-accent" /> Gestion des Achats
        </h4>
        <div className="flex gap-2">
          <button 
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-primary)' }}
            onClick={() => setShowSupplierModal(true)} 
          >
            <Plus size={14} /> Nouveau fournisseur
          </button>
          <button 
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--color-accent)', color: 'black' }}
            onClick={() => setShowPurchaseModal(true)} 
          >
            <Plus size={14} /> Nouvel achat
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted py-8 text-center">Chargement...</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead className="text-muted" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Fournisseur</th>
                <th className="text-right p-3">Montant</th>
                <th className="text-center p-3">Statut</th>
                <th className="text-center p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="p-3 text-secondary">#{p.id}</td>
                  <td className="p-3 text-primary font-medium">{p.supplier_nom}</td>
                  <td className="p-3 text-right text-accent font-semibold">{formatCurrency(p.montant_total)}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.statut === 'COMPLETED' ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'}`}>
                      {p.statut}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button 
                      className="text-xs text-muted hover:text-primary"
                      onClick={() => { setSelectedPurchase(p); setShowDetailModal(true); }}
                    >
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted">Aucun achat enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nouvel Achat */}
      {showPurchaseModal && (
        <ModalShell title="Nouvel achat" onClose={() => setShowPurchaseModal(false)} wide>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-secondary mb-1">Fournisseur <span className="text-danger">*</span></label>
              <select 
                value={supplierId} 
                onChange={e => setSupplierId(Number(e.target.value) || '')}
                className={inputClass} style={inputStyle}
              >
                <option value="">Sélectionner...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-secondary mb-1">Lignes de commande</label>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <select 
                      value={l.product_id} 
                      onChange={e => updateLine(i, 'product_id', e.target.value)}
                      className={inputClass} style={inputStyle}
                    >
                      <option value="">Produit...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <select 
                      value={l.location_id} 
                      onChange={e => updateLine(i, 'location_id', e.target.value)}
                      className={inputClass} style={inputStyle}
                    >
                      <option value="">Emplacement...</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" min="0.01" step="any" placeholder="Qté"
                      value={l.quantite || ''} onChange={e => updateLine(i, 'quantite', Number(e.target.value))}
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" min="0" step="any" placeholder="Prix"
                      value={l.prix_unitaire || ''} onChange={e => updateLine(i, 'prix_unitaire', Number(e.target.value))}
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div className="col-span-1">
                    <button 
                      onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                      className="w-full h-9 rounded-lg text-danger bg-danger-bg flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setLines(prev => [...prev, { product_id: '', location_id: '', quantite: 0, prix_unitaire: 0 }])}
                className="text-xs text-accent hover:underline"
              >
                + Ajouter une ligne
              </button>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-2)' }}>
              <span className="text-sm text-secondary">Total estimé:</span>
              <span className="text-lg font-bold text-accent">{formatCurrency(total)}</span>
            </div>
            {purchaseErr && <p className="text-xs text-danger">{purchaseErr}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button 
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-primary)' }}
                onClick={() => setShowPurchaseModal(false)} 
                disabled={purchaseLoading}
              >
                Annuler
              </button>
              <button 
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: 'var(--color-accent)', color: 'black' }}
                onClick={handlePurchase} 
                disabled={purchaseLoading}
              >
                {purchaseLoading ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Modal Nouveau Fournisseur */}
      {showSupplierModal && (
        <ModalShell title="Nouveau fournisseur" onClose={() => setShowSupplierModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-secondary mb-1">Nom <span className="text-danger">*</span></label>
              <input 
                type="text" placeholder="Ex: Metro Cash & Carry"
                value={supNom} onChange={e => setSupNom(e.target.value)}
                className={inputClass} style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm text-secondary mb-1">Téléphone</label>
              <input 
                type="tel" placeholder="Ex: +261 34 00 000 00"
                value={supTel} onChange={e => setSupTel(e.target.value)}
                className={inputClass} style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm text-secondary mb-1">Email</label>
              <input 
                type="email" placeholder="Ex: contact@fournisseur.mg"
                value={supEmail} onChange={e => setSupEmail(e.target.value)}
                className={inputClass} style={inputStyle}
              />
            </div>
            {supErr && <p className="text-xs text-danger">{supErr}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button 
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-primary)' }}
                onClick={() => setShowSupplierModal(false)} 
                disabled={supLoading}
              >
                Annuler
              </button>
              <button 
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: 'var(--color-accent)', color: 'black' }}
                onClick={handleSupplier} 
                disabled={supLoading}
              >
                {supLoading ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};