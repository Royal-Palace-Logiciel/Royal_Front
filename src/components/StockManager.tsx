// src/components/StockManager.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, AlertCircle, Package, Loader2, DollarSign, RefreshCw, Printer, LockKeyhole } from 'lucide-react';
import api from '../lib/api';
import { DataTable, Modal, Input, Select, Button, Badge, CaisseCard } from './UI';
import BarTransactionsCard from './Bar/BarTransactionsCard';
import { formatCurrency } from '../utils/data';
import AuthService from '../services/authService';
import { isAdmin } from '../utils/permissions';
import { useHDA } from '../context/HDAContext';
import { ModuleType } from '../types';
import { financeService, FinancialTransaction, isFinancialInflow, isFinancialOutflow } from '../services/finance.service';
import barService from '../services/bar.service';
import type { BarSession } from '../types/bar.type';
import { escapeHtml, printThermal, thermalHeader } from '../utils/thermalPrint';

interface StockItem {
  id: number;
  product_id: number;
  nom: string;
  categorie: string;
  quantite: number;
  unite: string;
  prix: number;
  seuil_minimum: number;
}

interface StockManagerProps {
  module: 'hotel' | 'bar' | 'restaurant';
  categories: string[];
  refreshTrigger?: number;
}

export const StockManager: React.FC<StockManagerProps> = ({ module, categories, refreshTrigger }) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const currentUser = AuthService.getCurrentUser();
  const userIsAdmin = isAdmin(currentUser);

  const isHotel = module === 'hotel';
  const isBar = module === 'bar';
  const isRestaurant = module === 'restaurant';

  // Form state
  const [form, setForm] = useState({
    product_name: '',
    categorie: categories[0],
    prix: 0,
    quantite: 0,
    unite: 'unités',
    seuil_minimum: 5,
  });

  const uniteOptions = [
    { value: 'unités', label: 'Unités' },
    { value: 'bouteilles', label: 'Bouteilles' },
    { value: 'litres', label: 'Litres' },
    { value: 'cl', label: 'Cl' },
    { value: 'ml', label: 'Ml' },
    { value: 'pièces', label: 'Pièces' },
  ];

  const locationId = isHotel ? 5 : isBar ? 3 : 2;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/stock/stocks/with-products', {
        params: { location_id: locationId }
      });
      const payload = response.data?.data ?? response.data;
      const mappedItems = (Array.isArray(payload) ? payload : []).map((p: any) => ({
        id: p.id,
        product_id: p.product_id,
        nom: p.product_nom || p.nom,
        categorie: p.category_name || (p.category_id ? `Catégorie ${p.category_id}` : 'Stock'),
        quantite: p.quantite || 0,
        unite: p.product_unite || p.unite || 'unités',
        prix: p.prix_vente || 0,
        seuil_minimum: p.seuil_minimum ?? 5,
      }));
      setStockItems(mappedItems);
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [module, refreshTrigger]);

  const handleSubmit = async () => {
    const productName = form.product_name.trim();
    const quantite = Number(form.quantite);
    const prix = Number(form.prix);
    const seuilMinimum = Number(form.seuil_minimum);

    if (!productName) {
      setError('Le nom du produit est requis.');
      return;
    }
    if ((isHotel && !Number.isInteger(quantite)) || quantite < 0 || prix < 0 || !Number.isInteger(seuilMinimum) || seuilMinimum < 0) {
      setError('La quantité, le prix et le seuil doivent être des nombres positifs.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (editItem) {
        const updates = {
          nom: productName,
          categorie: form.categorie,
          prix: prix,
          unite: form.unite,
          quantite,
          seuil_minimum: seuilMinimum,
        };
        if (isHotel) {
          await api.put(`/api/hebergement/stock/${editItem.id}`, updates);
        } else {
          await api.put(`/api/stock/stocks/${editItem.id}`, {
            quantite,
            seuil_minimum: seuilMinimum,
          });
        }
      } else {
        await api.post('/api/stock/products-with-stock', {
          nom: productName,
          categorie: form.categorie || categories[0] || 'Hôtel',
          code: `${module.toUpperCase()}-${Date.now()}`,
          unite: form.unite,
          prix_vente: prix,
          quantite,
          seuil_minimum: seuilMinimum,
          location_id: locationId,
          source_module: module.toUpperCase(),
        });
      }

      await fetchData();
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Erreur lors de la sauvegarde du stock');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: StockItem) => {
    const productName = item.nom || `l'article #${item.product_id}`;
    if (!confirm(`Voulez-vous vraiment supprimer ${productName} du stock ?`)) return;
    
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/api/stock/stocks/${item.id}`);
      await fetchData();
    } catch (err) {
      setError('Erreur lors de la suppression');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      product_name: '',
      categorie: categories[0],
      prix: 0,
      quantite: 0,
      unite: 'unités',
      seuil_minimum: 5,
    });
    setEditItem(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item: StockItem) => {
    setEditItem(item);
    setForm({
      product_name: item.nom,
      categorie: item.categorie,
      prix: item.prix,
      quantite: item.quantite,
      unite: item.unite,
      seuil_minimum: item.seuil_minimum,
    });
    setShowModal(true);
  };

  // Calcul du statut
  const getStatus = (item: StockItem) => {
    const quantite = item.quantite || 0;
    const seuil = item.seuil_minimum || 5;
    if (quantite === 0) return 'epuise';
    if (quantite <= seuil) return 'faible';
    return 'disponible';
  };

  // Filtrer les articles
  const filteredItems = stockItems.filter(item => {
    const matchSearch = (item.nom || '').toLowerCase().includes(search.toLowerCase());
    const status = getStatus(item);
    const matchStatus = filterStatus === 'all' || status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Statistiques
  const totalValue = stockItems.reduce((sum, item) => sum + (item.quantite || 0) * (item.prix || 0), 0);
  const alerts = stockItems.filter(item => getStatus(item) !== 'disponible').length;
  const outOfStock = stockItems.filter(item => (item.quantite || 0) === 0).length;

  // Colonnes pour le DataTable
  const columns = [
    {
      key: 'product',
      label: 'Produit',
      render: (item: any) => (
        <div>
          <p className="text-white font-medium">{item.nom}</p>
          <p className="text-slate-500 text-xs">{item.categorie}</p>
        </div>
      )
    },
    {
      key: 'quantite',
      label: 'Stock',
      render: (item: StockItem) => (
        <div>
          <p className="text-white font-semibold">{item.quantite || 0} {item.unite || 'unités'}</p>
          <p className="text-slate-600 text-xs">Min: {item.seuil_minimum || 5}</p>
        </div>
      )
    },
    {
      key: 'prix',
      label: 'Prix Unit.',
      render: (item: any) => (
        <span className="text-white">{formatCurrency(item.prix || 0)}</span>
      )
    },
    {
      key: 'valeur',
      label: 'Valeur',
      render: (item: any) => (
        <span className="text-amber-400 font-semibold">
          {formatCurrency((item.quantite || 0) * (item.prix || 0))}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Statut',
      render: (item: StockItem) => {
        const status = getStatus(item);
        return (
          <Badge variant={status}>
            {status === 'disponible' ? 'Disponible' : status === 'faible' ? 'Faible' : 'Épuisé'}
          </Badge>
        );
      }
    },
    ...(userIsAdmin ? [{
      key: 'actions',
      label: '',
      render: (item: StockItem) => (
        <div className="flex gap-2">
          <button 
            onClick={() => openEditModal(item)} 
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            title="Modifier la quantité"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={() => handleDelete(item)} 
            className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition-all"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }] : [])
  ];

  if (loading && stockItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-amber-400 mr-2" size={20} />
        <span className="text-slate-400 text-sm">Chargement du stock...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Produits', value: stockItems.length, color: 'text-white', sub: 'articles total' },
          { label: 'Valeur Totale', value: formatCurrency(totalValue), color: 'text-amber-400', sub: 'en stock' },
          { label: 'Alertes', value: alerts, color: alerts > 0 ? 'text-amber-400' : 'text-emerald-400', sub: 'à surveiller' },
          { label: 'Épuisés', value: outOfStock, color: 'text-red-400', sub: 'rupture de stock' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800/50 rounded-2xl p-4">
            <p className="text-slate-500 text-xs font-medium mb-1">{stat.label}</p>
            <p className={`${stat.color} font-bold text-xl`}>{stat.value}</p>
            <p className="text-slate-600 text-xs">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tableau du stock */}
      <div className="bg-slate-900 border border-slate-800/50 rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-b border-slate-800/50">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Package size={18} className="text-amber-400" />
            Inventaire {isHotel ? 'Hôtel' : isBar ? 'Bar & Lounge' : 'Restaurant'}
          </h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Rechercher..." 
                className="w-full sm:w-48 h-9 pl-9 pr-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50" 
              />
            </div>
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)} 
              className="h-9 px-3 bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 text-sm focus:outline-none"
            >
              <option value="all">Tous</option>
              <option value="disponible">Disponible</option>
              <option value="faible">Faible</option>
              <option value="epuise">Épuisé</option>
            </select>
            {userIsAdmin && (
              <Button icon={<Plus size={16} />} onClick={openCreateModal}>
                Ajouter
              </Button>
            )}
          </div>
        </div>
        <DataTable data={filteredItems} columns={columns} />
      </div>

      {/* Modal de création/modification */}
      <Modal
        isOpen={showModal} 
        onClose={() => { setShowModal(false); resetForm(); }} 
        title={editItem ? 'Modifier le produit et le stock' : 'Ajouter un produit au stock'}
      >
        <div className="space-y-4">
          <Input
            label="Nom du produit"
            value={form.product_name}
            onChange={e => setForm({...form, product_name: e.target.value})}
            disabled={Boolean(editItem && !isHotel)}
            placeholder="Ex: Serviette, Savon, Produit..."
          />
          <Select
            label="Catégorie"
            value={form.categorie}
            onChange={e => setForm({...form, categorie: e.target.value})}
            disabled={Boolean(editItem && !isHotel)}
            options={[...new Set([...categories, ...(form.categorie ? [form.categorie] : [])])].map(c => ({ value: c, label: c }))}
          />
          <Input
            label="Prix unitaire (MGA)"
            type="number"
            min="0"
            step="1"
            value={form.prix}
            onChange={e => setForm({...form, prix: Number(e.target.value) || 0})}
            disabled={Boolean(editItem && !isHotel)}
            placeholder="0"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Quantité" 
              type="number" 
              min="0"
              step={isHotel ? '1' : 'any'}
              value={form.quantite} 
              onChange={e => setForm({...form, quantite: isHotel ? Math.max(0, Math.floor(Number(e.target.value) || 0)) : Number(e.target.value) || 0})}
              placeholder="0" 
            />
            <Select 
              label="Unité" 
              value={form.unite} 
              onChange={e => setForm({...form, unite: e.target.value})} 
              disabled={Boolean(editItem && !isHotel)}
              options={uniteOptions} 
            />
          </div>

          <Input 
            label="Seuil minimum d'alerte" 
            type="number" 
            min="0"
            step="1"
            value={form.seuil_minimum} 
            onChange={e => setForm({...form, seuil_minimum: Math.max(0, Math.floor(Number(e.target.value) || 0))})}
            disabled={Boolean(editItem && !isHotel)}
            placeholder="5" 
          />
          {editItem && !isHotel && (
            <p className="text-xs text-slate-400">Dans ce module, seule la quantité de stock est modifiée.</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSubmit} className="flex-1" disabled={loading}>
              {loading ? 'Enregistrement...' : (editItem ? 'Mettre à jour' : 'Ajouter')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

interface CaisseManagerProps {
  module: ModuleType;
  categories: string[];
  title?: string;
  gradient?: string;
  pendingOrders?: Array<{
    id: number;
    client?: string;
    table?: string | number;
    total: number;
    created_at?: string;
    nombre_personnes?: number;
    moyen_paiement?: string;
    items?: Array<{ nom?: string; product_nom?: string; quantite: number; prix?: number; prix_unitaire?: number }>;
  }>;
  allOrders?: Array<{
    id: number;
    client?: string;
    table?: string | number;
    total: number;
    statut?: string;
    moyen_paiement?: string;
    created_at?: string;
    items?: Array<{ nom?: string; quantite: number; prix?: number; categorie?: string }>;
  }>;
  onEncaisserCommande?: (orderId: number) => Promise<void> | void;
  onCloseAllOrders?: (orderIds: number[]) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
}

const getHotelCashRegisterSnapshot = (transactions: FinancialTransaction[]) => {
  const isClosedTransaction = (transaction: FinancialTransaction) =>
    transaction.cloturee === true || Number(transaction.cloturee) === 1;
  const openTransactions = transactions.filter((transaction) => !isClosedTransaction(transaction));
  if (openTransactions.length > 0) {
    return { transactions: openTransactions, isClosed: false };
  }

  const closedTransactions = transactions.filter(isClosedTransaction);
  if (closedTransactions.length === 0) {
    return { transactions: [], isClosed: false };
  }

  const latestCloseTime = Math.max(...closedTransactions.map((transaction) => {
    const closeTime = transaction.cloture_at ? new Date(transaction.cloture_at).getTime() : 0;
    return Number.isNaN(closeTime) ? 0 : closeTime;
  }));
  const latestCloseBatch = closedTransactions.filter((transaction) => {
    const closeTime = transaction.cloture_at ? new Date(transaction.cloture_at).getTime() : 0;
    return (Number.isNaN(closeTime) ? 0 : closeTime) === latestCloseTime;
  });

  return { transactions: latestCloseBatch, isClosed: true };
};

export const CaisseManager: React.FC<CaisseManagerProps> = ({ module, categories, title, gradient = 'from-amber-500 to-orange-500', pendingOrders = [], allOrders = [], onEncaisserCommande, onCloseAllOrders, onRefresh }) => {
  const { state, dispatch, getModuleStock, getModuleCaisseSolde } = useHDA();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ type: 'entree', montant: 0, description: '', categorie: categories[0] });
  const [backendTransactions, setBackendTransactions] = useState<FinancialTransaction[]>([]);
  const [hotelLedgerTransactions, setHotelLedgerTransactions] = useState<FinancialTransaction[]>([]);
  const [hotelTransactionsAreClosed, setHotelTransactionsAreClosed] = useState(false);
  const [moduleStockSummary, setModuleStockSummary] = useState<{ entrees: number; sorties: number; solde: number } | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [currentBarSession, setCurrentBarSession] = useState<BarSession | null>(null);
  const [isClosingBarSession, setIsClosingBarSession] = useState(false);
  const [showCloseOrdersModal, setShowCloseOrdersModal] = useState(false);
  const [isClosingOrders, setIsClosingOrders] = useState(false);
  const [showCloseHotelModal, setShowCloseHotelModal] = useState(false);
  const [isClosingHotel, setIsClosingHotel] = useState(false);
  const [transactionsRefreshTrigger, setTransactionsRefreshTrigger] = useState(0);

  const isBar = module === 'bar';
  const isRestaurant = module === 'restaurant';
  const isOrderRegister = isBar || isRestaurant;
  // const isHebergement = module === 'hebergement'; // COMMENTED OUT
  const isHebergement = false; // Disabled
  const isHotel = module === 'hotel';
  const isBackendCaisse = module === 'restaurant' /* || module === 'hebergement' */ || module === 'hotel' || module === 'bar'; // COMMENTED OUT hebergement
  const canViewBarBalance = !isBar || isAdmin(AuthService.getCurrentUser());
  const transactionTitle = isBar
    ? 'Transactions Bar'
    : isHebergement
      ? 'Transactions Hébergement'
      : isHotel
        ? 'Transactions Hôtel'
        : 'Transactions Restaurant';

  useEffect(() => {
    if (!isBackendCaisse) return;

    Promise.all([
      financeService.getTransactions({ module: module.toUpperCase(), include_closed: isHotel }),
      financeService.getFinancialStats(),
    ])
      .then(([transactions, stats]) => {
        if (isHotel) {
          const snapshot = getHotelCashRegisterSnapshot(transactions);
          setHotelLedgerTransactions(transactions);
          setBackendTransactions(snapshot.transactions);
          setHotelTransactionsAreClosed(snapshot.isClosed);
        } else {
          setBackendTransactions(transactions);
        }
        const summary = stats.modules.find((item) => item.module.toLowerCase() === module.toLowerCase());
        setModuleStockSummary(summary || null);
        setBackendError(null);
      })
      .catch(() => setBackendError('Impossible de charger les données de la caisse.'));
  }, [isBackendCaisse, isHotel, module]);

  useEffect(() => {
    if (!isBar) return;

    const currentUser = AuthService.getCurrentUser();
    if (!currentUser?.id) return;

    barService.getBarOpenSessions()
      .then((sessions) => {
        const session = sessions.find((item) => Number(item.user_id) === Number(currentUser.id));
        setCurrentBarSession(session || null);
      })
      .catch(() => setCurrentBarSession(null));
  }, [isBar]);

  const backendEntrees = backendTransactions
    .filter((transaction) => isFinancialInflow(transaction.type_flux))
    .reduce((total, transaction) => total + Number(transaction.montant), 0);
  const backendSorties = backendTransactions
    .filter((transaction) => isFinancialOutflow(transaction.type_flux))
    .reduce((total, transaction) => total + Number(transaction.montant), 0);
  const hotelTotalEntrees = hotelLedgerTransactions
    .filter((transaction) => isFinancialInflow(transaction.type_flux))
    .reduce((total, transaction) => total + Number(transaction.montant || 0), 0);
  const hotelTotalSorties = hotelLedgerTransactions
    .filter((transaction) => isFinancialOutflow(transaction.type_flux))
    .reduce((total, transaction) => total + Number(transaction.montant || 0), 0);
  const localCaisse = getModuleCaisseSolde(module);
  // Hôtel : la carte reflète la caisse ouverte (transactions non clôturées) ; le résumé
  // global /finance/summary inclut aussi les opérations déjà clôturées.
  const sortiesStock = moduleStockSummary && !isHotel ? Number(moduleStockSummary.sorties) : backendSorties;
  const solde = isHotel
    ? hotelTotalEntrees - hotelTotalSorties
    : isBackendCaisse ? backendEntrees - sortiesStock : localCaisse.solde;
  const entrees = isBackendCaisse
    ? (isHotel ? hotelTotalEntrees : Math.max(Number(moduleStockSummary?.entrees || 0), backendEntrees))
    : localCaisse.entrees;
  const sorties = isHotel ? hotelTotalSorties : isBackendCaisse ? sortiesStock : localCaisse.sorties;

  // Récupération des commandes payées avec extraction sécurisée du montant
  const restaurantOrders = (state.orders || state.commandes || []).filter(
    (o: any) => (o.module === 'restaurant' || !o.module) && (o.statut === 'Payée' || o.status === 'payee' || o.status === 'payée')
  );

  const orderTransactions = restaurantOrders.map((o: any) => ({
    type: 'entree',
    montant: o.montant || o.total || o.price || o.prix || 0,
    description: `Encaissement ${o.table ? 'Table ' + o.table : 'Commande'}`,
    categorie: 'Ventes Restaurant',
    userName: o.userName || 'Caisse',
    heure: o.heure || o.createdAt || new Date().toISOString()
  }));

  // Exclure les données factices/par défaut du state initial
  const dummyDescriptions = ['Service dîner gala', 'Déjeuner groupe - 15 couverts', 'Approvisionnement fruits de mer'];
  const manualTransactions = (state.transactions || []).filter((t: any) => 
    t.module === 'restaurant' && !dummyDescriptions.includes(t.description)
  );

  // Combinaison et tri pour afficher les plus récents en premier (pile/file descendants)
  const allRestaurantTransactions = [...orderTransactions, ...manualTransactions].sort((a: any, b: any) => {
    const dateA = new Date(a.heure || a.createdAt || 0).getTime();
    const dateB = new Date(b.heure || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  const handleSubmit = async () => {
    if (!form.description || !form.montant) return;

    if (isBackendCaisse) {
      try {
        const transaction = await financeService.createTransaction({
          module: module.toUpperCase(),
          type_flux: form.type === 'entree' ? 'ENTREE' : 'SORTIE',
          montant: form.montant,
          description: `${form.categorie} - ${form.description}`,
        });
        const [transactions, stats] = await Promise.all([
          financeService.getTransactions({ module: module.toUpperCase(), include_closed: isHotel }),
          financeService.getFinancialStats(),
        ]);
        if (isHotel) {
          setHotelLedgerTransactions(transactions);
          const snapshot = getHotelCashRegisterSnapshot(transactions);
          setBackendTransactions(snapshot.transactions.length ? snapshot.transactions : [transaction]);
          setHotelTransactionsAreClosed(snapshot.isClosed);
        } else {
          setBackendTransactions(transactions.length ? transactions : [transaction]);
        }
        const summary = stats.modules.find((item) => item.module.toLowerCase() === module.toLowerCase());
        setModuleStockSummary(summary || null);
        setBackendError(null);
      } catch {
        setBackendError('Impossible d’enregistrer la transaction.');
        return;
      }
      setShowModal(false);
      setForm({ type: 'entree', montant: 0, description: '', categorie: categories[0] });
      return;
    }

    dispatch({
      type: 'ADD_TRANSACTION',
      payload: {
        ...form,
        type: form.type as 'entree' | 'sortie',
        userId: state.currentUser.id,
        userName: `${state.currentUser.prenom} ${state.currentUser.nom}`,
        module,
      }
    });
    setShowModal(false);
    setForm({ type: 'entree', montant: 0, description: '', categorie: categories[0] });
  };

  const transactions = isBackendCaisse
    ? backendTransactions.map((transaction) => ({
        type: isFinancialInflow(transaction.type_flux) ? 'entree' : 'sortie',
        montant: transaction.montant,
        description: transaction.description,
        categorie: transaction.module,
        userName: 'Système',
        heure: transaction.created_at,
        moyen_paiement: transaction.reservation_moyen_paiement || transaction.moyen_paiement,
        pdj_inclus: transaction.pdj_inclus,
        reservation_client: [transaction.reservation_client_prenom, transaction.reservation_client_nom].filter(Boolean).join(' '),
        reservation_room: transaction.reservation_room_numero,
        is_reservation: String(transaction.ref_flux_global || '').includes('RESERVATION-'),
      }))
    : allRestaurantTransactions;

  const handleEncaisserCommande = async (orderId: number) => {
    if (onEncaisserCommande) {
      await onEncaisserCommande(orderId);
      if (isBackendCaisse) {
        try {
          const [txs, stats] = await Promise.all([
            financeService.getTransactions({ module: module.toUpperCase() }),
            financeService.getFinancialStats(),
          ]);
          setBackendTransactions(txs);
          const summary = stats.modules.find((item) => item.module.toLowerCase() === module.toLowerCase());
          setModuleStockSummary(summary || null);
        } catch (err) {
          console.warn('Failed to refresh backend caisse after encaissement:', err);
        }
      }
    }
  };

  const handlePrintAllOrders = () => {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    const connectedCashier = [AuthService.getCurrentUser()?.prenom, AuthService.getCurrentUser()?.nom].filter(Boolean).join(' ') || AuthService.getCurrentUser()?.email || 'Utilisateur connecté';
    const generatedAt = new Date().toLocaleString('fr-FR');
    const total = allOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const allItems = allOrders.flatMap((order) => order.items || []);
    const sales = new Map<string, { sold: number; net: number; category: string }>();
    allItems.forEach((item) => {
      const name = item.nom || 'Article';
      const sold = Number(item.quantite || 0);
      const net = sold * Number(item.prix || 0);
      const existing = sales.get(name) || { sold: 0, net: 0, category: item.categorie || 'Bar' };
      sales.set(name, { sold: existing.sold + sold, net: existing.net + net, category: existing.category });
    });
    const categories = new Map<string, { sold: number; total: number }>();
    sales.forEach((sale) => {
      const category = categories.get(sale.category) || { sold: 0, total: 0 };
      categories.set(sale.category, { sold: category.sold + sale.sold, total: category.total + sale.net });
    });
    const paymentLabels: Record<string, string> = { ESPECES: 'Espèces', CREDIT: 'Crédit', TPE: 'TPE', ORANGE_MONEY: 'Orange Money', MVOLA: 'MVola', GRATUIT: 'Gratuit' };
    const paymentMethods = ['ESPECES', 'CREDIT', 'TPE', 'ORANGE_MONEY', 'MVOLA', 'GRATUIT'];
    const paymentTotals = new Map<string, number>();
    allOrders.forEach((order) => {
      const payment = order.moyen_paiement || 'ESPECES';
      paymentTotals.set(payment, (paymentTotals.get(payment) || 0) + Number(order.total || 0));
    });
    const salesRows = Array.from(sales.entries()).map(([name, sale]) => `<div class="row"><span>${name}</span><span>${sale.sold}</span><span>${formatCurrency(sale.net)}</span><span>${formatCurrency(sale.net)}</span></div>`).join('');
    const categoryRows = Array.from(categories.entries()).map(([name, category]) => `<div class="category"><span>${name}</span><span>${category.sold}</span><strong>${formatCurrency(category.total)}</strong></div>`).join('');
    const paymentRows = paymentMethods.map((payment) => `<div class="row"><span>${paymentLabels[payment]}</span><strong>${formatCurrency(paymentTotals.get(payment) || 0)}</strong></div>`).join('');
    const orderDates = allOrders.map((order) => order.created_at).filter(Boolean).sort();
    const startDate = orderDates[0] ? new Date(orderDates[0]).toLocaleString('fr-FR') : (currentBarSession?.ouverture_at ? new Date(currentBarSession.ouverture_at).toLocaleString('fr-FR') : '-');
    const ticketLines = allItems.length;
    printWindow.document.write(`<!doctype html><html><head><title>Partial Cash Report</title><style>@page{size:80mm auto;margin:4mm}body{font-family:monospace;width:72mm;margin:0;color:#111;font-size:11px}h1{text-align:center;font-size:16px;margin:4px 0 12px}h2{text-align:center;font-size:14px;margin:14px 0 5px}.meta{margin:2px 0}.line{border-bottom:1px dashed #111;margin:7px 0}.row{display:grid;grid-template-columns:minmax(0,1fr) 34px 68px 68px;gap:3px;border-bottom:1px dotted #aaa;padding:2px 0}.row span:last-child,.row strong{text-align:right}.category{display:grid;grid-template-columns:minmax(0,1fr) 34px 68px;gap:3px;border-bottom:1px dotted #aaa;padding:2px 0}.category span:last-child,.category strong{text-align:right}.total{display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-top:4px}.summary{display:flex;justify-content:space-between;padding:2px 0}</style></head><body><h1>Partial Cash Report</h1><p class="meta">Caissier : <strong>${connectedCashier}</strong></p><p class="meta">Terminal : BAR-${currentBarSession?.id || 'CAISSE'}<br>Sequence : ${allOrders.length}<br>Start Date : ${startDate}<br>End Date : ${generatedAt}</p><div class="line"></div><h2>Sales</h2><div class="row"><strong>Name</strong><strong>Sold</strong><strong>Net</strong><strong>Total</strong></div>${salesRows || '<p>Aucune vente.</p>'}<div class="line"></div><div class="total"><span>Total</span><span>${formatCurrency(total)}</span></div><h2>Product Categories</h2><div class="category"><strong>Name</strong><strong>Sold</strong><strong>Total</strong></div>${categoryRows || '<p>Aucune catégorie.</p>'}<div class="line"></div><div class="total"><span>Total</span><span>${formatCurrency(total)}</span></div><h2>Lines Removed</h2><div class="category"><span>${connectedCashier}</span><span>0</span><strong>${formatCurrency(0)}</strong></div><h2>Taxes</h2><div class="category"><span>Tax Exempt</span><span></span><strong>${formatCurrency(total)}</strong></div><div class="line"></div><h2>Payments</h2><div class="category"><strong>Type</strong><span></span><strong>Total</strong></div>${paymentRows || '<div class="row"><span>Aucun paiement</span><span></span><strong>AR0</strong></div>'}<div class="line"></div><div class="total"><span>Total</span><span>${formatCurrency(total)}</span></div><h2>SUMMARY</h2><div class="summary"><span>Tickets</span><strong>${allOrders.length}</strong></div><div class="summary"><span>Ticket Lines</span><strong>${ticketLines}</strong></div><div class="summary"><span>Payments</span><strong>${allOrders.length}</strong></div><div class="summary"><span>Net Sales</span><strong>${formatCurrency(total)}</strong></div><div class="summary"><span>Tax</span><strong>${formatCurrency(0)}</strong></div></body></html>`);
    printWindow.document.close();
    Array.from(printWindow.document.querySelectorAll('h2'))
      .filter((heading) => ['Sales', 'Product Categories'].includes(heading.textContent?.trim() || ''))
      .forEach((heading) => {
        (heading as HTMLElement).style.display = 'none';
        let sibling = heading.nextElementSibling;
        while (sibling && sibling.tagName !== 'H2') {
          (sibling as HTMLElement).style.display = 'none';
          sibling = sibling.nextElementSibling;
        }
      });
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintDailyOrderDetails = () => {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    } as Record<string, string>)[character] || character);
    const moduleLabel = module === 'restaurant' ? 'Restaurant' : 'Bar & Lounge';
    const generatedAt = new Date().toLocaleString('fr-FR');
    const connectedCashier = [AuthService.getCurrentUser()?.prenom, AuthService.getCurrentUser()?.nom].filter(Boolean).join(' ') || AuthService.getCurrentUser()?.email || 'Utilisateur connecté';
    const orderDates = allOrders.map((order) => order.created_at).filter(Boolean).sort();
    const startDate = orderDates[0] ? new Date(orderDates[0]).toLocaleString('fr-FR') : '-';
    const terminal = isBar && currentBarSession?.id ? `BAR-${currentBarSession.id}` : `${module.toUpperCase()}-CAISSE`;
    const total = allOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const itemCount = allOrders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantite || 0), 0), 0);
    const sales = new Map<string, { sold: number; net: number; category: string }>();
    const categories = new Map<string, { sold: number; total: number }>();
    allOrders.forEach((order) => (order.items || []).forEach((item) => {
      const name = item.nom || 'Article';
      const sold = Number(item.quantite || 0);
      const net = sold * Number(item.prix || 0);
      const sale = sales.get(name) || { sold: 0, net: 0, category: item.categorie || 'Autre' };
      sales.set(name, { sold: sale.sold + sold, net: sale.net + net, category: sale.category });
    }));
    sales.forEach((sale) => {
      const category = categories.get(sale.category) || { sold: 0, total: 0 };
      categories.set(sale.category, { sold: category.sold + sale.sold, total: category.total + sale.net });
    });
    const paymentLabels: Record<string, string> = { ESPECES: 'Cash', CREDIT: 'Credit', TPE: 'TPE', ORANGE_MONEY: 'Orange Money', MVOLA: 'Mvola', GRATUIT: 'Gratuit' };
    const paymentMethods = ['ESPECES', 'CREDIT', 'TPE', 'ORANGE_MONEY', 'MVOLA', 'GRATUIT'];
    const paymentTotals = new Map<string, number>();
    allOrders.forEach((order) => {
      const payment = order.moyen_paiement || 'ESPECES';
      paymentTotals.set(payment, (paymentTotals.get(payment) || 0) + Number(order.total || 0));
    });
    const salesRows = Array.from(sales.entries()).map(([name, sale]) => `<div class="row four"><span>${escapeHtml(name)}</span><span>${sale.sold}</span><span>${formatCurrency(sale.net)}</span><span>${formatCurrency(sale.net)}</span></div>`).join('');
    const categoryRows = Array.from(categories.entries()).map(([name, category]) => `<div class="row three"><span>${escapeHtml(name)}</span><span>${category.sold}</span><span>${formatCurrency(category.total)}</span></div>`).join('');
    const paymentRows = paymentMethods.map((payment) => `<div class="row two"><span>${paymentLabels[payment]}</span><span>${formatCurrency(paymentTotals.get(payment) || 0)}</span></div>`).join('');
    const paidOrders = allOrders.filter((order) => ['Encaissée', 'PAYE', 'PAYEE'].includes(order.statut || ''));
    const ticketLines = allOrders.reduce((sum, order) => sum + (order.items || []).length, 0);
    const report = `<h1>Partial Cash Report</h1><p>Module : ${escapeHtml(moduleLabel)}</p><p>Cashier : ${escapeHtml(connectedCashier)}<br>Terminal : ${escapeHtml(terminal)}<br>Sequence : ${allOrders.length}<br>Start Date : ${escapeHtml(startDate)}<br>End Date : ${escapeHtml(generatedAt)}</p><div class="separator"></div><h2>Sales</h2><div class="row four head"><span>Name</span><span>Sold</span><span>Net</span><span>Total</span></div>${salesRows || '<p>Aucune vente.</p>'}<div class="separator"></div><div class="total">Total <strong>${formatCurrency(total)}</strong></div><div class="separator"></div><h2>Product Categories</h2><div class="row three head"><span>Category</span><span>Sold</span><span>Total</span></div>${categoryRows || '<p>Aucune catégorie.</p>'}<div class="separator"></div><div class="total">Total <strong>${formatCurrency(total)}</strong></div><div class="separator"></div><h2>Lines Removed</h2><div class="row two"><span>${escapeHtml(connectedCashier)}</span><span>${formatCurrency(0)}</span></div><h2>Taxes</h2><div class="row two"><span>Tax Exempt</span><span>${formatCurrency(0)}</span></div><h2>Payments</h2><div class="row two head"><span>Type</span><span>Total</span></div>${paymentRows}<div class="separator"></div><div class="total">Total <strong>${formatCurrency(total)}</strong></div><div class="separator"></div><h2>SUMMARY</h2><div class="row two"><span>Tickets</span><span>${allOrders.length}</span></div><div class="row two"><span>Ticket Lines</span><span>${ticketLines}</span></div><div class="row two"><span>Payments</span><span>${paidOrders.length}</span></div><div class="row two"><span>Net Sales</span><span>${formatCurrency(total)}</span></div><div class="row two"><span>Tax</span><span>${formatCurrency(0)}</span></div>`;
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Partial Cash Report</title><style>@page{size:80mm auto;margin:4mm}body{font-family:monospace;width:72mm;margin:0;color:#111;font-size:10px;line-height:1.3}h1{text-align:center;font-size:14px;margin:0 0 8px}h2{text-align:center;font-size:11px;margin:10px 0 4px}.separator{border-top:1px dashed #111;margin:7px 0}.row{display:grid;gap:3px;padding:2px 0}.row.four{grid-template-columns:minmax(0,1fr) 7ch 12ch 12ch;column-gap:7px}.row.four span:not(:first-child){white-space:nowrap}.row.three{grid-template-columns:minmax(0,1fr) 28px 60px}.row.two{grid-template-columns:minmax(0,1fr) 90px}.row span:not(:first-child){text-align:right}.head{font-weight:bold;border-bottom:1px solid #111}.total{display:flex;justify-content:space-between;font-weight:bold}.total strong{margin-left:auto}</style></head><body>${report}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintCloseReport = (closedFund?: number) => {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    const paidOrders = allOrders.filter((order) => order.statut === 'Encaissée');
    const reportOrders = paidOrders.length > 0 ? paidOrders : allOrders;
    const paymentTotals = new Map<string, number>();
    reportOrders.forEach((order) => {
      const payment = order.moyen_paiement || 'ESPECES';
      paymentTotals.set(payment, (paymentTotals.get(payment) || 0) + Number(order.total || 0));
    });
    const total = reportOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const generatedAt = new Date().toLocaleString('fr-FR');
    const connectedCashier = [AuthService.getCurrentUser()?.prenom, AuthService.getCurrentUser()?.nom].filter(Boolean).join(' ') || AuthService.getCurrentUser()?.email || 'Utilisateur connecté';
    const paymentLabels: Record<string, string> = { ESPECES: 'Espèces', CREDIT: 'Crédit', TPE: 'TPE', ORANGE_MONEY: 'Orange Money', MVOLA: 'MVola', GRATUIT: 'Gratuit' };
    const paymentMethods = ['ESPECES', 'CREDIT', 'TPE', 'ORANGE_MONEY', 'MVOLA', 'GRATUIT'];
    const paymentRows = paymentMethods.map((payment) => `<div class="row"><span>${paymentLabels[payment]}</span><strong>${formatCurrency(paymentTotals.get(payment) || 0)}</strong></div>`).join('');
    const openingDate = currentBarSession?.ouverture_at ? new Date(currentBarSession.ouverture_at).toLocaleString('fr-FR') : '-';
    const closingDate = new Date().toLocaleString('fr-FR');
    const finalFund = closedFund ?? currentBarSession?.fond_final;
    const expectedFund = Number(currentBarSession?.fond_initial || 0) + total;
    const variance = finalFund === undefined ? undefined : finalFund - expectedFund;
    printWindow.document.write(`<!doctype html><html><head><title>Close Cash Report</title><style>@page{size:80mm auto;margin:4mm}body{font-family:monospace;width:72mm;margin:0;color:#111;font-size:12px}h1{text-align:center;font-size:18px;margin:4px 0 12px}h2{font-size:13px;margin:14px 0 5px;border-bottom:1px dashed #111;padding-bottom:4px}.center{text-align:center}.row{display:flex;justify-content:space-between;padding:2px 0}.line{border-bottom:1px dashed #111;margin:8px 0}.label{display:flex;justify-content:space-between}.strong{font-weight:bold;font-size:15px}.small{font-size:11px;margin:3px 0}</style></head><body><h1>Close Cash Report</h1><p class="center">Caisse Bar & Lounge</p><p class="small">Caissier : <strong>${connectedCashier}</strong></p><p class="small">Session : ${currentBarSession?.id || '-'}<br>Ouverture : ${openingDate}<br>Clôture : ${closingDate}</p><h2>Payments Report <span style="float:right">Amount</span></h2>${paymentRows || '<div class="row"><span>Aucun paiement</span><strong>${formatCurrency(0)}</strong></div>'}<div class="line"></div><div class="label strong"><span>Total Sales</span><span>${formatCurrency(total)}</span></div><div class="row"><span>Number of Payments:</span><strong>${reportOrders.length}</strong></div><h2>Tax Analysis <span style="float:right">Amount</span></h2><div class="row"><span>Tax Exempt</span><strong>${formatCurrency(0)}</strong></div><div class="line"></div><div class="label strong"><span>Subtotal</span><span>${formatCurrency(total)}</span></div><div class="label"><span>Taxes</span><span>${formatCurrency(0)}</span></div><div class="label strong"><span>Totals</span><span>${formatCurrency(total)}</span></div>${finalFund !== undefined ? `<h2>Cash Control</h2><div class="row"><span>Fond initial</span><strong>${formatCurrency(Number(currentBarSession?.fond_initial || 0))}</strong></div><div class="row"><span>Fond final</span><strong>${formatCurrency(finalFund)}</strong></div><div class="row"><span>Ecart</span><strong>${formatCurrency(variance || 0)}</strong></div>` : ''}<div class="line"></div><p class="small">Terminal : BAR-${currentBarSession?.id || 'CAISSE'}<br>Sequence : ${reportOrders.length}<br>Imprimé le : ${generatedAt}</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleCloseBarSession = async () => {
    if (!currentBarSession) return;
    if (pendingOrders.length > 0) {
      setBackendError('Encaissez toutes les commandes avant de clôturer la caisse.');
      return;
    }

    const finalAmount = window.prompt('Indiquez le fond final de la caisse (MGA) :', String(Math.max(0, Math.round(solde))));
    if (finalAmount === null) return;

    const fondFinal = Number(finalAmount);
    if (!Number.isFinite(fondFinal) || fondFinal < 0) {
      setBackendError('Le fond final doit être un montant positif.');
      return;
    }

    try {
      setIsClosingBarSession(true);
      await barService.closeBarSession({ session_id: currentBarSession.id, fond_final: fondFinal });
      handlePrintCloseReport(fondFinal);
      setCurrentBarSession(null);
      setBackendError(null);
      window.alert('La caisse Bar & Lounge a été clôturée.');
    } catch (error: any) {
      setBackendError(error?.response?.data?.message || error?.message || 'Impossible de clôturer la caisse.');
    } finally {
      setIsClosingBarSession(false);
    }
  };

  const handlePrintClosingReport = () => {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    } as Record<string, string>)[character] || character);
    const connectedCashier = [AuthService.getCurrentUser()?.prenom, AuthService.getCurrentUser()?.nom].filter(Boolean).join(' ') || AuthService.getCurrentUser()?.email || 'Utilisateur connecté';
    const generatedAt = new Date().toLocaleString('fr-FR');
    const orderDates = allOrders.map((order) => order.created_at).filter(Boolean).sort();
    const startDate = orderDates[0] ? new Date(orderDates[0]).toLocaleString('fr-FR') : '-';
    const terminal = isBar && currentBarSession?.id ? `BAR-${currentBarSession.id}` : `${module.toUpperCase()}-CAISSE`;
    const total = allOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const ticketLines = allOrders.reduce((sum, order) => sum + (order.items || []).length, 0);
    const paidOrders = allOrders.filter((order) => ['Encaissée', 'PAYE', 'PAYEE'].includes(order.statut || ''));
    const paymentLabels: Record<string, string> = { ESPECES: 'Cash', CREDIT: 'Credit', TPE: 'TPE', ORANGE_MONEY: 'Orange Money', MVOLA: 'Mvola', GRATUIT: 'Gratuit' };
    const paymentMethods = ['ESPECES', 'CREDIT', 'TPE', 'ORANGE_MONEY', 'MVOLA', 'GRATUIT'];
    const paymentTotals = new Map<string, number>();
    allOrders.forEach((order) => {
      const payment = order.moyen_paiement || 'ESPECES';
      paymentTotals.set(payment, (paymentTotals.get(payment) || 0) + Number(order.total || 0));
    });
    const paymentRows = paymentMethods.map((payment) => `<div class="row two"><span>${paymentLabels[payment]}</span><span>${formatCurrency(paymentTotals.get(payment) || 0)}</span></div>`).join('');
    const report = `<h1>Partial Cash Report</h1><p>Cashier : ${escapeHtml(connectedCashier)}<br>Terminal : ${escapeHtml(terminal)}<br>Sequence : ${allOrders.length}<br>Start Date : ${escapeHtml(startDate)}<br>End Date : ${escapeHtml(generatedAt)}</p><div class="separator"></div><h2>Lines Removed</h2><div class="row two"><span>${escapeHtml(connectedCashier)}</span><span>${formatCurrency(0)}</span></div><h2>Taxes</h2><div class="row two"><span>Tax Exempt</span><span>${formatCurrency(0)}</span></div><h2>Payments</h2><div class="row two head"><span>Type</span><span>Total</span></div>${paymentRows}<div class="separator"></div><div class="total">Total <strong>${formatCurrency(total)}</strong></div><div class="separator"></div><h2>SUMMARY</h2><div class="row two"><span>Tickets</span><span>${allOrders.length}</span></div><div class="row two"><span>Ticket Lines</span><span>${ticketLines}</span></div><div class="row two"><span>Payments</span><span>${paidOrders.length}</span></div><div class="row two"><span>Net Sales</span><span>${formatCurrency(total)}</span></div><div class="row two"><span>Tax</span><span>${formatCurrency(0)}</span></div>`;
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Closing Cash Report</title><style>@page{size:80mm auto;margin:4mm}body{font-family:monospace;width:72mm;margin:0;color:#111;font-size:10px;line-height:1.3}h1{text-align:center;font-size:14px;margin:0 0 8px}h2{text-align:center;font-size:11px;margin:10px 0 4px}.separator{border-top:1px dashed #111;margin:7px 0}.row{display:grid;gap:3px;padding:2px 0}.row.two{grid-template-columns:minmax(0,1fr) 90px}.row span:last-child{text-align:right}.head{font-weight:bold;border-bottom:1px solid #111}.total{display:flex;justify-content:space-between;font-weight:bold}.total strong{margin-left:auto}</style></head><body>${report}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintSingleOrder = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    } as Record<string, string>)[character] || character);
    const connectedCashier = [AuthService.getCurrentUser()?.prenom, AuthService.getCurrentUser()?.nom].filter(Boolean).join(' ') || AuthService.getCurrentUser()?.email || 'Utilisateur connecté';
    const generatedAt = new Date().toLocaleString('fr-FR');
    const orderDate = order.created_at ? new Date(order.created_at).toLocaleString('fr-FR') : '-';
    const terminal = isBar && currentBarSession?.id ? `BAR-${currentBarSession.id}` : `${module.toUpperCase()}-CAISSE`;
    const orderTotal = Number(order.total || 0);
    const paymentLabel = order.moyen_paiement === 'CARTE' ? 'Carte bancaire' : order.moyen_paiement === 'TPE' ? 'TPE' : order.moyen_paiement === 'CREDIT' ? 'Crédit' : order.moyen_paiement === 'EURO' ? 'Euro' : order.moyen_paiement === 'ORANGE_MONEY' ? 'Orange Money' : order.moyen_paiement === 'MVOLA' ? 'MVola' : order.moyen_paiement === 'DOLLAR' ? 'Dollar' : order.moyen_paiement === 'VIREMENT' ? 'Virement' : order.moyen_paiement === 'CHEQUE' ? 'Chèque' : 'Espèces';
    
    const itemsRows = (order.items || []).map((item: any) => {
      const unitPrice = Number(item.prix_unitaire ?? item.prix ?? 0);
      const lineTotal = unitPrice * Number(item.quantite || 0);
      return `<div class="row"><span>${escapeHtml(item.nom || item.product_nom || 'Article')} x${item.quantite}</span><span>${formatCurrency(lineTotal)}</span></div>`;
    }).join('');

    const report = `<h1>Reçu de Commande</h1><p>Commande #${order.id}<br>Client : ${escapeHtml(order.client || 'Client anonyme')}<br>Table : ${escapeHtml(String(order.table || 'N/A'))}<br>Date : ${escapeHtml(orderDate)}<br>Caissier : ${escapeHtml(connectedCashier)}<br>Terminal : ${escapeHtml(terminal)}</p><div class="separator"></div><h2>Articles</h2>${itemsRows || '<p>Aucun article.</p>'}<div class="separator"></div><div class="total">Total <strong>${formatCurrency(orderTotal)}</strong></div><div class="separator"></div><div class="row"><span>Moyen de paiement</span><span>${escapeHtml(paymentLabel)}</span></div>`;
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reçu Commande</title><style>@page{size:80mm auto;margin:4mm}body{font-family:monospace;width:72mm;margin:0;color:#111;font-size:10px;line-height:1.3}h1{text-align:center;font-size:14px;margin:0 0 8px}h2{text-align:center;font-size:11px;margin:10px 0 4px}.separator{border-top:1px dashed #111;margin:7px 0}.row{display:grid;gap:3px;padding:2px 0}.row.two{grid-template-columns:minmax(0,1fr) 90px}.row span:last-child{text-align:right}.head{font-weight:bold;border-bottom:1px solid #111}.total{display:flex;justify-content:space-between;font-weight:bold}.total strong{margin-left:auto}</style></head><body>${report}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintSingleTransaction = (transaction: any) => {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    } as Record<string, string>)[character] || character);
    const connectedCashier = [AuthService.getCurrentUser()?.prenom, AuthService.getCurrentUser()?.nom].filter(Boolean).join(' ') || AuthService.getCurrentUser()?.email || 'Utilisateur connecté';
    const generatedAt = new Date().toLocaleString('fr-FR');
    const transactionDate = transaction.heure ? new Date(transaction.heure).toLocaleString('fr-FR') : '-';
    const terminal = isBar && currentBarSession?.id ? `BAR-${currentBarSession.id}` : `${module.toUpperCase()}-CAISSE`;
    const transactionAmount = Number(transaction.montant || 0);
    const isInflow = transaction.type === 'entree';

    const report = `<h1>Reçu de Transaction</h1><p>Description : ${escapeHtml(transaction.description)}<br>Catégorie : ${escapeHtml(transaction.categorie)}<br>Date : ${escapeHtml(transactionDate)}<br>Caissier : ${escapeHtml(transaction.userName || connectedCashier)}<br>Terminal : ${escapeHtml(terminal)}</p><div class="separator"></div><div class="total">${isInflow ? 'Encaissement' : 'Décaissement'} <strong>${formatCurrency(transactionAmount)}</strong></div><div class="separator"></div><p class="center">Généré le ${escapeHtml(generatedAt)}</p>`;
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reçu Transaction</title><style>@page{size:80mm auto;margin:4mm}body{font-family:monospace;width:72mm;margin:0;color:#111;font-size:10px;line-height:1.3}h1{text-align:center;font-size:14px;margin:0 0 8px}h2{text-align:center;font-size:11px;margin:10px 0 4px}.separator{border-top:1px dashed #111;margin:7px 0}.row{display:grid;gap:3px;padding:2px 0}.row.two{grid-template-columns:minmax(0,1fr) 90px}.row span:last-child{text-align:right}.head{font-weight:bold;border-bottom:1px solid #111}.total{display:flex;justify-content:space-between;font-weight:bold}.total strong{margin-left:auto}.center{text-align:center}</style></head><body>${report}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleCloseAllOrders = async () => {
    if (!onCloseAllOrders || allOrders.length === 0) return;

    setShowCloseOrdersModal(true);
  };

  const confirmCloseAllOrders = async () => {
    if (!onCloseAllOrders || allOrders.length === 0) return;

    setIsClosingOrders(true);
    try {
      handlePrintClosingReport();
      await onCloseAllOrders(allOrders.map((order) => order.id));
      setBackendTransactions([]);
      setTransactionsRefreshTrigger((value) => value + 1);
      await onRefresh?.();
      setShowCloseOrdersModal(false);
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : 'Impossible de clôturer les commandes.');
    } finally {
      setIsClosingOrders(false);
    }
  };

  // --- Caisse hôtel : impression globale et clôture des encaissements du jour ---
  const hotelPaymentLabels: Record<string, string> = {
    ESPECES: 'Espèces', TPE: 'TPE', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
    CARTE: 'Carte bancaire', VIREMENT: 'Virement', CREDIT: 'Crédit', GRATUIT: 'Gratuit',
  };

  const handlePrintHotelReport = (titleText = 'Rapport de caisse Hôtel') => {
    const connectedCashier = [AuthService.getCurrentUser()?.prenom, AuthService.getCurrentUser()?.nom].filter(Boolean).join(' ') || AuthService.getCurrentUser()?.email || 'Utilisateur connecté';
    const sorted = [...backendTransactions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const inflows = sorted.filter((transaction) => isFinancialInflow(transaction.type_flux));
    const outflows = sorted.filter((transaction) => isFinancialOutflow(transaction.type_flux));
    const totalIn = inflows.reduce((sum, transaction) => sum + Number(transaction.montant || 0), 0);
    const totalOut = outflows.reduce((sum, transaction) => sum + Number(transaction.montant || 0), 0);
    const paymentTotals = new Map<string, number>();
    inflows.forEach((transaction) => {
      const payment = transaction.moyen_paiement || transaction.reservation_moyen_paiement || 'ESPECES';
      paymentTotals.set(payment, (paymentTotals.get(payment) || 0) + Number(transaction.montant || 0));
    });
    const formatTime = (value: string) => (value ? new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');
    const transactionRow = (transaction: FinancialTransaction) => {
      const client = [transaction.reservation_client_prenom, transaction.reservation_client_nom].filter(Boolean).join(' ');
      const room = transaction.reservation_room_numero ? `Ch. ${transaction.reservation_room_numero}` : '';
      const payment = transaction.moyen_paiement || transaction.reservation_moyen_paiement;
      const detail = [formatTime(transaction.created_at), room, client, payment ? hotelPaymentLabels[payment] || payment : ''].filter(Boolean).join(' · ');
      return `<div class="row line"><span>${escapeHtml(transaction.description)}<br><span class="muted">${escapeHtml(detail)}</span></span><span>${formatCurrency(Number(transaction.montant || 0))}</span></div>`;
    };
    const startDate = sorted[0]?.created_at ? new Date(sorted[0].created_at).toLocaleString('fr-FR') : '-';

    const body = `
      ${thermalHeader(titleText, [`Caissier : ${connectedCashier}`, `Du ${startDate}`])}
      <h2>Encaissements (${inflows.length})</h2>
      ${inflows.map(transactionRow).join('') || '<p class="center">Aucun encaissement.</p>'}
      <div class="row total"><span>Total encaissé</span><span>${formatCurrency(totalIn)}</span></div>
      <h2>Par mode de paiement</h2>
      ${Array.from(paymentTotals.entries()).map(([payment, amount]) => `<div class="row"><span>${escapeHtml(hotelPaymentLabels[payment] || payment)}</span><span>${formatCurrency(amount)}</span></div>`).join('') || '<p class="center">-</p>'}
      ${outflows.length ? `<h2>Sorties (${outflows.length})</h2>${outflows.map(transactionRow).join('')}<div class="row total"><span>Total sorties</span><span>${formatCurrency(totalOut)}</span></div>` : ''}
      <div class="box row"><span>Solde</span><span>${formatCurrency(totalIn - totalOut)}</span></div>
      <div class="footer"><p>Opérations : ${sorted.length}</p><p>Signature caissier</p><br><br></div>`;
    return printThermal(titleText, body);
  };

  const confirmCloseHotelCaisse = async () => {
    if (backendTransactions.length === 0) return;
    const ids = backendTransactions.map((transaction) => transaction.id);
    // Impression avant l'appel réseau : une fenêtre ouverte après un await est bloquée.
    handlePrintHotelReport('Clôture de caisse Hôtel');
    setIsClosingHotel(true);
    try {
      await financeService.closeTransactions('HOTEL', ids);
      const [transactions, stats] = await Promise.all([
        financeService.getTransactions({ module: 'HOTEL', include_closed: true }),
        financeService.getFinancialStats(),
      ]);
      const snapshot = getHotelCashRegisterSnapshot(transactions);
      setHotelLedgerTransactions(transactions);
      setBackendTransactions(snapshot.transactions);
      setHotelTransactionsAreClosed(snapshot.isClosed);
      setModuleStockSummary(stats.modules.find((item) => item.module.toLowerCase() === 'hotel') || null);
      setTransactionsRefreshTrigger((value) => value + 1);
      setBackendError(null);
      setShowCloseHotelModal(false);
    } catch (error: any) {
      setBackendError(error?.response?.data?.message || 'Impossible de clôturer la caisse hôtel.');
    } finally {
      setIsClosingHotel(false);
    }
  };

  return (
    <div className="space-y-6">
      <Modal
        isOpen={showCloseOrdersModal}
        onClose={() => { if (!isClosingOrders) setShowCloseOrdersModal(false); }}
        title="Clôturer les commandes"
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
              <AlertCircle size={21} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-primary">Imprimer puis clôturer ?</p>
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                Les <strong>{allOrders.length} commande{allOrders.length > 1 ? 's' : ''}</strong> seront clôturées de la caisse.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Elles resteront disponibles dans l’historique administrateur.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCloseOrdersModal(false)}
              disabled={isClosingOrders}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => void confirmCloseAllOrders()}
              disabled={isClosingOrders}
              className="w-full sm:w-auto"
            >
              <Printer size={16} />
              {isClosingOrders ? 'Clôture...' : 'Imprimer et clôturer'}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={showCloseHotelModal}
        onClose={() => { if (!isClosingHotel) setShowCloseHotelModal(false); }}
        title="Clôturer la caisse Hôtel"
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
              <AlertCircle size={21} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-primary">Imprimer puis clôturer ?</p>
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                Les <strong>{backendTransactions.length} opération{backendTransactions.length > 1 ? 's' : ''}</strong> ({formatCurrency(solde)}) seront retirées de la caisse du jour.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Elles restent enregistrées dans les finances et l’historique.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowCloseHotelModal(false)} disabled={isClosingHotel} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button type="button" onClick={() => void confirmCloseHotelCaisse()} disabled={isClosingHotel} className="w-full sm:w-auto">
              <Printer size={16} />
              {isClosingHotel ? 'Clôture...' : 'Imprimer et clôturer'}
            </Button>
          </div>
        </div>
      </Modal>
      <div className="flex justify-end">
        <div className="flex flex-wrap justify-end gap-2">
          {!isBar && !isHotel && (
            <Button icon={<Plus size={16} />} onClick={() => setShowModal(true)}>
              Nouvelle transaction
            </Button>
          )}
        </div>
      </div>

      <div className={isOrderRegister || isHotel ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]' : ''}>
        {/* Caisse Card */}
        {canViewBarBalance && (
          <CaisseCard solde={solde} entrees={entrees} sorties={sorties} title={title || 'Caisse'} gradient={gradient} />
        )}
        {isOrderRegister && (
          <section className="rounded-2xl border border-accent/30 bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-primary">Commandes de la caisse</h3>
                <p className="mt-1 text-xs text-muted">Impression et clôture globales</p>
              </div>
              <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">{allOrders.length}</span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => handlePrintDailyOrderDetails()} disabled={allOrders.length === 0} className="justify-center">
                Imprimer toutes
              </Button>
              <Button size="sm" icon={<LockKeyhole size={14} />} onClick={() => void handleCloseAllOrders()} disabled={!onCloseAllOrders || allOrders.length === 0} className="justify-center">
                Clôturer toutes
              </Button>
              {currentBarSession && (
                <Button size="sm" variant="secondary" icon={<LockKeyhole size={14} />} onClick={() => void handleCloseBarSession()} disabled={isClosingBarSession || pendingOrders.length > 0} title={pendingOrders.length > 0 ? 'Encaissez les commandes restantes avant la clôture' : 'Clôturer la session de caisse'} className="justify-center sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  {isClosingBarSession ? 'Clôture...' : 'Clôturer la caisse'}
                </Button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-base pt-4 text-center">
              <div>
                <p className="text-lg font-semibold text-primary">{pendingOrders.length}</p>
                <p className="text-[11px] text-muted">À encaisser</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-400">{allOrders.filter((order) => ['Encaissée', 'PAYE', 'PAYEE'].includes(order.statut || '')).length}</p>
                <p className="text-[11px] text-muted">Encaissées</p>
              </div>
            </div>
          </section>
        )}
        {isHotel && (
          <section className="rounded-2xl border border-accent/30 bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-primary">Caisse du jour</h3>
                <p className="mt-1 text-xs text-muted">Impression et clôture des encaissements</p>
              </div>
              <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">{backendTransactions.length}</span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => handlePrintHotelReport()} disabled={backendTransactions.length === 0} className="justify-center">
                Imprimer tout
              </Button>
              <Button size="sm" icon={<LockKeyhole size={14} />} onClick={() => setShowCloseHotelModal(true)} disabled={backendTransactions.length === 0 || hotelTransactionsAreClosed} className="justify-center">
                Clôturer la caisse
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-base pt-4 text-center">
              <div>
                <p className="text-lg font-semibold text-emerald-400">{backendTransactions.filter((transaction) => isFinancialInflow(transaction.type_flux)).length}</p>
                <p className="text-[11px] text-muted">Encaissements</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-primary">{backendTransactions.filter((transaction) => isFinancialOutflow(transaction.type_flux)).length}</p>
                <p className="text-[11px] text-muted">Sorties</p>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-accent/30 bg-surface">
        <div className="flex items-center justify-between border-b border-base px-6 py-4">
          <div>
            <h3 className="font-semibold text-primary">Commandes à encaisser</h3>
            <p className="text-xs text-muted">Commandes servies en attente de paiement</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">{pendingOrders.length}</span>
            {onRefresh && <button type="button" onClick={() => void onRefresh()} title="Actualiser les commandes" className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-muted transition hover:bg-surface-3 hover:text-primary"><RefreshCw size={14} /></button>}
          </div>
        </div>
        {pendingOrders.length === 0 ? (
          <p className="px-6 py-6 text-center text-sm text-muted">Aucune commande à encaisser.</p>
        ) : (
          <div className="divide-y divide-base">
            {pendingOrders.map((order) => (
              <div key={order.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-primary">Commande #{order.id} · {order.client || 'Client anonyme'}</p>
                  <p className="text-xs text-muted">{order.table ? `Table ${order.table}` : 'Sans table'}{order.nombre_personnes ? ` · ${order.nombre_personnes} personne${order.nombre_personnes > 1 ? 's' : ''}` : ''}{order.created_at ? ` · ${new Date(order.created_at).toLocaleString('fr-FR')}` : ''}</p>
                  {order.moyen_paiement && <p className="text-xs text-muted">Paiement : {order.moyen_paiement === 'CARTE' ? 'Carte bancaire' : order.moyen_paiement === 'TPE' ? 'TPE' : order.moyen_paiement === 'CREDIT' ? 'Crédit' : order.moyen_paiement === 'EURO' ? 'Euro' : order.moyen_paiement === 'ORANGE_MONEY' ? 'Orange Money' : order.moyen_paiement === 'MVOLA' ? 'MVola' : order.moyen_paiement === 'DOLLAR' ? 'Dollar' : order.moyen_paiement === 'VIREMENT' ? 'Virement' : order.moyen_paiement === 'CHEQUE' ? 'Chèque' : 'Espèces'}</p>}
                  {order.items && order.items.length > 0 && (
                    <div className="mt-2 space-y-1 border-l-2 border-accent/40 pl-3">
                      {order.items.map((item, index) => {
                        const unitPrice = Number(item.prix_unitaire ?? item.prix ?? 0);
                        return <p key={`${order.id}-item-${index}`} className="text-xs text-secondary">{item.quantite} × {item.nom || item.product_nom || 'Article'} <span className="text-muted">({formatCurrency(unitPrice)} / unité = {formatCurrency(unitPrice * item.quantite)})</span></p>;
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="font-bold text-accent">{formatCurrency(order.total)}</span>
                  {onEncaisserCommande && <Button size="sm" icon={<DollarSign size={14} />} onClick={() => void handleEncaisserCommande(order.id)}>Encaisser</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transactions adaptées au module */}
      {!isHotel || !hotelTransactionsAreClosed ? (isBar ? (
        <BarTransactionsCard title={transactionTitle} refreshTrigger={transactionsRefreshTrigger} />
      ) : (
        <div className="bg-slate-900 border border-slate-800/50 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/50 flex items-center justify-between">
            <h3 className="text-white font-semibold">{transactionTitle}</h3>
          </div>
          <div className="divide-y divide-slate-800/50">
            {backendError && <p className="px-6 py-3 text-sm text-red-400">{backendError}</p>}
            {allOrders.map((order) => (
              <div key={`order-${order.id}`} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm bg-emerald-500/10 text-emerald-400">↗</div>
                  <div>
                    <p className="text-white font-medium text-sm">Commande #{order.id} · {order.client || 'Client anonyme'}</p>
                    <p className="text-slate-500 text-xs">Vente Restaurant{order.table ? ` · Table ${order.table}` : ''}{order.created_at ? ` · ${new Date(order.created_at).toLocaleString('fr-FR')}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-emerald-400">+ {formatCurrency(order.total)}</span>
                  <button
                    onClick={() => handlePrintSingleOrder(order)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                    title="Imprimer la transaction"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            ))}
            {transactions.length > 0 ? (
              transactions.map((t: any, index: number) => (
                <div key={index} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${t.type === 'entree' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {t.type === 'entree' ? '↗' : '↙'}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{t.description}</p>
                      <p className="text-slate-500 text-xs">{t.categorie} • {t.userName || 'Système'} {t.heure ? `• ${t.heure}` : ''}</p>
                      {isHotel && t.is_reservation && (
                        <p className="mt-1 text-xs text-slate-400">
                          {t.reservation_client ? `Client : ${t.reservation_client}` : ''}
                          {t.reservation_room ? ` • Chambre ${t.reservation_room}` : ''}
                          {t.reservation_client || t.reservation_room ? ' • ' : ''}
                          {t.pdj_inclus ? 'PDJ inclus' : 'PDJ non inclus'}
                          {t.moyen_paiement ? ` • Paiement : ${t.moyen_paiement.replace('_', ' ')}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold text-sm ${t.type === 'entree' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.type === 'entree' ? '+' : '-'} {formatCurrency(t.montant)}
                    </span>
                    <button
                      onClick={() => handlePrintSingleTransaction(t)}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                      title="Imprimer la transaction"
                    >
                      <Printer size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-500">
                <p className="text-sm">Aucune transaction pour le moment.</p>
              </div>
            )}
          </div>
        </div>
      )) : null}

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nouvelle Transaction">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {['entree', 'sortie'].map(type => (
              <button
                key={type}
                onClick={() => setForm({...form, type})}
                className={`h-12 rounded-xl font-semibold text-sm transition-all ${
                  form.type === type
                    ? type === 'entree' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {type === 'entree' ? '+ Entrée' : '- Sortie'}
              </button>
            ))}
          </div>
          <Input label="Montant (MGA)" type="number" value={form.montant} onChange={e => setForm({...form, montant: Number(e.target.value)})} placeholder="0.00" />
          <Input label="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Description de la transaction..." />
          <Select label="Catégorie" value={form.categorie} onChange={e => setForm({...form, categorie: e.target.value})} options={categories.map(c => ({ value: c, label: c }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Annuler</Button>
            <Button onClick={handleSubmit} className="flex-1">Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
