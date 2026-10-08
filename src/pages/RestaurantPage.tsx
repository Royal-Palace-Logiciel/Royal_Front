// src/pages/RestaurantPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useHDA } from '../context/HDAContext';
import { formatCurrency } from '../utils/data';
import { escapeHtml, openPrintWindow, printThermal, thermalHeader } from '../utils/thermalPrint';
import { ShoppingCart, Clock, CheckCircle, TrendingUp, AlertTriangle, Trash2 } from 'lucide-react';

// Composants du module Restaurant
import { RestaurantHeader } from '../components/Restaurant/Entete/RestaurantHeader';
import { RestaurantTabs } from '../components/Restaurant/Tabs/RestaurantTabs';
import { CommandesTab } from '../components/Restaurant/Tabs/CommandesTab';
import { MenuTab } from '../components/Restaurant/Tabs/MenuTab';
import { StockTab } from '../components/Restaurant/Tabs/StockTab';
import { CaisseTab } from '../components/Restaurant/Tabs/CaisseTab';
import { HistoryTab } from '../components/Restaurant/Tabs/HistoryTab';
import { InventaireTab } from '../components/Restaurant/Tabs/InventaireTab';
import { RestaurantReports } from '../components/Restaurant/RestaurantReports';
import { OrderModal } from '../components/Restaurant/Modals/OrderModal';
import { ProductModal } from '../components/Restaurant/Modals/ProductModal';
import { ClientModal } from '../components/Restaurant/Modals/ClientModal';
import { Button, Modal } from '../components/UI';

// Services et types
import * as restaurantService from '../services/restaurantService';
import type {
  TableRestaurant,
  Order,
  Product,
  Category,
  Client,
} from '../components/Restaurant/types';

import AuthService from '../services/authService';
import { clientService } from '../services/client.service';
import { getDefaultTabForRole, isAdmin, isCashier } from '../utils/permissions';

const RESTAURANT_TABLE_COUNT = 16;

const normalizeTableNumber = (value: string | number) => String(value).trim().toUpperCase().replace(/^T/, '');

const buildRestaurantTables = (apiTables: TableRestaurant[] = []): TableRestaurant[] => (
  Array.from({ length: RESTAURANT_TABLE_COUNT }, (_, index) => {
    const tableNumber = index + 1;
    const apiTable = apiTables.find((table) => (
      Number(table.id) === tableNumber || normalizeTableNumber(table.numero) === String(tableNumber)
    ));

    return {
      id: apiTable?.id ?? tableNumber,
      numero: String(tableNumber),
      capacite: apiTable?.capacite ?? 4,
      statut: apiTable?.statut ?? 'LIBRE',
    };
  })
);

export const RestaurantPage: React.FC = () => {
  const { state, dispatch } = useHDA();
  const currentUser = AuthService.getCurrentUser();
  const userIsAdmin = isAdmin(currentUser);
  const userIsCashier = isCashier(currentUser);

  // ---------- États ----------
  const [activeTab, setActiveTab] = useState(() => getDefaultTabForRole('commandes', currentUser?.role));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Données réelles (tables)
  const [tables, setTables] = useState<TableRestaurant[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  // Données mockées (produits, commandes, clients) – à migrer plus tard
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [restaurantStock, setRestaurantStock] = useState<Array<{ quantite: number; unite?: string }>>([]);
  const ordersRequestVersion = useRef(0);

  // Modales
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showOrderLocationModal, setShowOrderLocationModal] = useState(false);
  const [selectedOrderTable, setSelectedOrderTable] = useState<string | undefined>();
  const [selectedOrderLocation, setSelectedOrderLocation] = useState<string | undefined>();
  const [showProductModal, setShowProductModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<Order | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // ---------- Chargement initial ----------
  const fetchOrders = async () => {
    const requestVersion = ++ordersRequestVersion.current;
    try {
      const res = await restaurantService.getOrders({ source_module: 'RESTAURANT' });
      if (requestVersion === ordersRequestVersion.current && res.success && Array.isArray(res.data)) {
        setOrders(res.data as Order[]);
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des commandes live:', error);
    }
  };

  useEffect(() => {
    // Charger les tables depuis l'API
    const fetchTables = async () => {
      setTablesLoading(true);
      try {
        const res = await restaurantService.getTables();
        if (res.success) {
          setTables(buildRestaurantTables(Array.isArray(res.data) ? res.data : []));
        } else {
          console.warn('Échec du chargement des tables :', res.message);
        }
      } catch (error) {
        console.error('Erreur réseau lors du chargement des tables', error);
      } finally {
        setTablesLoading(false);
      }
    };
    fetchTables();
    fetchOrders();

    Promise.all([
      restaurantService.getProducts({ actif: true }),
      restaurantService.getCategories(),
      clientService.getClients(),
      restaurantService.getStocks(),
    ])
      .then(([productsRes, categoriesRes, clientsData, stockRes]) => {
        setProducts(productsRes.success && Array.isArray(productsRes.data) ? productsRes.data as Product[] : []);
        setCategories(categoriesRes.success && Array.isArray(categoriesRes.data) ? categoriesRes.data as Category[] : []);
        setClients(Array.isArray(clientsData) ? clientsData as Client[] : []);
        const stockData = Array.isArray(stockRes) ? stockRes : (stockRes as { data?: Array<{ quantite: number; unite?: string }> }).data;
        setRestaurantStock(Array.isArray(stockData) ? stockData : []);
      })
      .catch(error => {
        console.error('Erreur lors du chargement des données Restaurant', error);
        setProducts([]);
        setCategories([]);
        setClients([]);
        setRestaurantStock([]);
      });
  }, []);

  // ---------- Handlers Tables (API) ----------
  const handleNewOrder = () => {
    setShowOrderLocationModal(true);
  };

  const handleSelectOrderLocation = (tableId: number, locationLabel?: string) => {
    setSelectedOrderTable(String(tableId));
    setSelectedOrderLocation(locationLabel);
    setShowOrderLocationModal(false);
    setShowOrderModal(true);
  };

  const getRestaurantLocationLabel = (location?: string) => {
    const normalized = location?.trim().toUpperCase();
    if (normalized === 'POCKER GRATUIT' || normalized === 'GRATUIT POCKER' || normalized === 'POCKER') return 'Pocker gratuit';
    if (normalized === 'GRATUIT') return 'Gratuit';
    if (normalized === 'CHAMBRE') return 'Chambre';
    return undefined;
  };

  // ---------- Handlers Commandes ----------
  const handleAddOrder = async (formData: any) => {
    if (editingOrder) {
      try {
        const res = await restaurantService.updateOrder(Number(editingOrder.id), {
          client_id: formData.client_id || undefined,
          table_id: formData.table_id || undefined,
          items: (formData.items || []).map((item: any) => ({
            product_id: item.product_id,
            quantite: item.quantite,
            prix_unitaire: item.prix_unitaire,
            cuisson: item.cuisson,
          })),
          notes: formData.notes,
          location_type: formData.location_type,
          special_person_name: formData.special_person_name,
        });
        if (!res.success) throw new Error(res.message || 'Modification de la commande impossible.');
        await fetchOrders();
        setEditingOrder(null);
        setShowOrderModal(false);
        return;
      } catch (error) {
        console.error('Erreur modification commande restaurant', error);
        throw error;
      }
    }

    try {
      const res = await restaurantService.createOrder({
        client_id: formData.client_id || undefined,
        table_id: formData.table_id || undefined,
        items: (formData.items || []).map((item: any) => ({
          product_id: item.product_id,
          quantite: item.quantite,
          prix_unitaire: item.prix_unitaire,
          cuisson: item.cuisson,
        })),
        notes: formData.notes,
        location_type: formData.location_type,
        special_person_name: formData.special_person_name,
      });
      if (res.success) {
        await fetchOrders();
        setShowOrderModal(false);
        return;
      }
      throw new Error(res.message || 'Création de la commande impossible.');
    } catch (error) {
      console.error('Création commande restaurant échouée:', error);
      throw error;
    }
  };

  const handleUpdateOrderStatus = async (orderId: number | string, status: Order['statut']) => {
    const numericId = Number(orderId);
    try {
      const res = await restaurantService.updateOrderStatus(numericId, status);
      if (res && res.success) {
        await fetchOrders();
        return;
      }
    } catch (err) {
      console.warn('API update status échoué, bascule vers mode local:', err);
    }
    setOrders(prev => prev.map(o => o.id === numericId ? { ...o, statut: status } : o));
  };

  const handlePayment = async (orderId: number | string, paymentMethod = 'ESPECES') => {
    const numericId = Number(orderId);
    const order = orders.find(o => Number(o.id) === numericId);
    if (!order) {
      throw new Error(`Commande #${numericId} introuvable.`);
    }

    // Une lecture lancée avant l'encaissement ne doit pas remplacer l'état plus récent.
    ordersRequestVersion.current += 1;

    const calculatedMontant = Number(
      order?.montant_total ||
      (order as any)?.total ||
      (order?.items && order.items.length > 0
        ? order.items.reduce((s: number, i: any) => s + (Number(i.prix_unitaire || i.prix || 0) * Number(i.quantite || i.quantity || 1)), 0)
        : 0)
    );

    // La commande ne doit passer en PAYEE qu'après confirmation de l'API.
    try {
      const res = await restaurantService.processPayment({
        order_id: numericId,
        montant: calculatedMontant > 0 ? calculatedMontant : undefined as any,
        moyen_paiement: paymentMethod,
        client_id: order?.client_id || undefined,
      });
      if (res && res.success) {
        try {
          const tablesRes = await restaurantService.getTables();
          if (tablesRes.success) setTables(buildRestaurantTables(Array.isArray(tablesRes.data) ? tablesRes.data : []));
        } catch (tableError) {
          console.warn('Rafraîchissement des tables après paiement échoué:', tableError);
        }
      } else {
        throw new Error(res?.message || 'Le paiement n’a pas été confirmé.');
      }
    } catch (err) {
      console.warn('API payment échoué, bascule vers mode local:', err);
      if ((err as any)?.response?.status === 404) {
        await fetchOrders();
      }
      throw err;
    }

    // Mise à jour locale uniquement après le succès confirmé ci-dessus.
    setOrders(prev => prev.map(o => Number(o.id) === numericId ? { ...o, statut: 'PAYEE' } : o));
    if (order?.table) {
      setTables(prev => prev.map(t => t.id === order.table!.id ? { ...t, statut: 'LIBRE' } : t));
    }

    // Enregistrement dans le HDAContext (Caisse)
    if (order || calculatedMontant > 0) {
      dispatch({
        type: 'ADD_TRANSACTION',
        payload: {
          type: 'entree',
          montant: calculatedMontant,
          description: `Encaissement Commande #${numericId} ${order?.table?.numero ? '(Table ' + order.table.numero + ')' : ''}`,
          categorie: 'Ventes Restaurant',
          userId: String(state.currentUser?.id || 'caisse'),
          module: 'restaurant',
          userName: state.currentUser ? `${state.currentUser.prenom} ${state.currentUser.nom}` : 'Caisse',
        }
      });
    }
  };

  const handleCancelOrder = async (orderId: number | string) => {
    if (!window.confirm('Annuler cette commande ?')) return;
    const numericId = Number(orderId);
    try {
      const res = await restaurantService.updateOrderStatus(numericId, 'ANNULEE');
      if (res && res.success) {
        await fetchOrders();
        return;
      }
    } catch (err) {
      console.warn('API cancel échoué, bascule vers mode local:', err);
    }
    setOrders(prev => prev.map(o => o.id === numericId ? { ...o, statut: 'ANNULEE' } : o));
    const order = orders.find(o => o.id === numericId);
    if (order?.table) {
      setTables(prev => prev.map(t => t.id === order.table!.id ? { ...t, statut: 'LIBRE' } : t));
    }
  };

  const handleRequestDeleteOrder = (orderId: number | string) => {
    const order = orders.find((candidate) => Number(candidate.id) === Number(orderId));
    if (order) setPendingDeleteOrder(order);
  };

  const handleDeleteOrder = async () => {
    if (!pendingDeleteOrder) return;
    try {
      setIsDeletingOrder(true);
      await restaurantService.deleteOrder(Number(pendingDeleteOrder.id));
      setOrders(prev => prev.filter(order => order.id !== Number(pendingDeleteOrder.id)));
      setPendingDeleteOrder(null);
    } catch (error) {
      console.error('Erreur suppression commande', error);
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // Facture au format ticket 80 mm (imprimante thermique). La fenêtre est ouverte avant
  // le chargement de la commande pour ne pas être bloquée par le navigateur.
  const handlePrintInvoice = (orderId: number | string) => {
    const numericId = Number(orderId);
    const printWindow = openPrintWindow();
    if (!printWindow) return;
    (async () => {
      try {
        const res = await restaurantService.getOrderById(numericId);
        const order = (res as any).data ?? res;
        const items: any[] = order.items || [];
        const total = Number(order.montant_total || items.reduce((sum, item) => sum + Number(item.quantite) * Number(item.prix_unitaire || 0), 0));
        const client = clients.find((candidate) => candidate.id === order.client_id);
        const clientName = client ? `${client.nom || ''} ${client.prenom || ''}`.trim() : `${order.client_nom || ''} ${order.client_prenom || ''}`.trim();
        const lines = items.map((item) => {
          const quantity = Number(item.quantite || 0);
          const unitPrice = Number(item.prix_unitaire || 0);
          return `<div class="line"><div class="row"><span>${quantity} x ${escapeHtml(item.product_nom || `#${item.product_id || ''}`)}${item.cuisson ? ` (${escapeHtml(item.cuisson)})` : ''}</span><span>${escapeHtml(formatCurrency(quantity * unitPrice))}</span></div><div class="sub">PU ${escapeHtml(formatCurrency(unitPrice))}</div></div>`;
        }).join('');
        printThermal(`Facture #${numericId}`, `
          ${thermalHeader(`Facture #${numericId}`, ["Hotel de L'avenue — Restaurant"])}
          <p>Date : ${escapeHtml(order.created_at ? new Date(order.created_at).toLocaleString('fr-FR') : '—')}</p>
          ${order.table_numero ? `<p>Table : ${escapeHtml(order.table_numero)}</p>` : ''}
          ${clientName ? `<p>Client : ${escapeHtml(clientName)}</p>` : ''}
          ${order.notes ? `<p>Notes : ${escapeHtml(order.notes)}</p>` : ''}
          <div class="sep"></div>
          ${lines}
          <div class="row total"><span>TOTAL</span><span>${escapeHtml(formatCurrency(total))}</span></div>
          <div class="footer"><p>Merci de votre visite</p></div>
        `, { target: printWindow });
      } catch (err) {
        printWindow.close();
        console.error('Erreur récupération facture', err);
        alert('Impossible de récupérer la facture. Vous êtes peut-être déconnecté.');
      }
    })();
  };

  // Produits (mock)
  const handleAddProduct = async (formData: any) => {
    try {
      const res = await restaurantService.createProduct({ ...formData, prix_achat: 0 });
      if (!res.success) throw new Error(res.message || 'Création du produit impossible.');
      setProducts(prev => [...prev, res.data as Product]);
      setShowProductModal(false);
    } catch (error) {
      console.error('Erreur création produit', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      throw new Error(apiError.response?.data?.message || 'Impossible d’ajouter ce plat. Veuillez réessayer.');
    }
  };

  const handleCreateRestaurantCategory = async (name: string): Promise<Category> => {
    const existingCategory = categories.find(
      (category) => category.nom.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase()
    );
    if (existingCategory) return existingCategory;

    const response = await restaurantService.createCategory({ nom: name });
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Création de la catégorie impossible.');
    }
    const createdCategory = response.data as Category;
    setCategories((current) => current.some((category) => category.id === createdCategory.id)
      ? current
      : [...current, createdCategory]);
    return createdCategory;
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  const handleUpdateProduct = async (formData: any) => {
    if (!editingProduct) return;
    try {
      const res = await restaurantService.updateProduct(editingProduct.id, formData);
      if (!res.success) throw new Error(res.message || 'Modification du produit impossible.');
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? res.data as Product : p));
      setEditingProduct(null);
      setShowProductModal(false);
    } catch (error) {
      console.error('Erreur modification produit', error);
      alert('Impossible de modifier ce plat. Veuillez réessayer.');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    const product = products.find((item) => item.id === id);
    if (product) setPendingDeleteProduct(product);
  };

  const confirmDeleteProduct = async () => {
    if (!pendingDeleteProduct || isDeletingProduct) return;

    setIsDeletingProduct(true);
    try {
      await restaurantService.deleteProduct(pendingDeleteProduct.id);
      setProducts(prev => prev.filter(p => p.id !== pendingDeleteProduct.id));
      setPendingDeleteProduct(null);
    } catch (error) {
      console.error('Erreur suppression produit', error);
      alert('Impossible de supprimer ce plat car il est peut-être déjà utilisé.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Clients
  const handleAddClient = async (formData: any) => {
    try {
      const created = await clientService.createClient(formData);
      const normalizedClient: Client = {
        id: created.id,
        code_client: created.code_client || `CL${String(created.id).padStart(3, '0')}`,
        nom: created.nom,
        prenom: created.prenom || '',
        telephone: created.telephone || '',
        email: created.email || '',
        adresse: created.adresse || '',
        date_naissance: created.date_naissance || '',
        type_piece: created.type_piece || '',
        numero_piece: created.numero_piece || '',
        statut: created.statut,
      };
      setClients(prev => [...prev, normalizedClient]);
      setShowClientModal(false);
      alert('Client créé avec succès !');
    } catch (err) {
      console.error('Erreur création client', err);
      alert('Impossible de créer le client sur le serveur. Le client a été conservé localement.');
      const newClient: Client = {
        id: clients.length + 1,
        code_client: `CL${String(clients.length + 1).padStart(3, '0')}`,
        ...formData,
      };
      setClients([...clients, newClient]);
      setShowClientModal(false);
    }
  };

  // ---------- Statistiques ----------
  const stats: any[] = [
    { label: 'Total Commandes', value: orders.length, icon: <ShoppingCart size={20} className="text-black" /> },
    { label: 'En Cours', value: orders.filter(o => o.statut === 'EN_COURS' || o.statut === 'EN_ATTENTE').length, icon: <Clock size={20} className="text-black" /> },
    { label: 'Payées', value: orders.filter(o => o.statut === 'PAYE' || o.statut === 'PAYEE').length, icon: <CheckCircle size={20} className="text-black" /> },
    { label: 'CA Journée', value: formatCurrency(orders.filter(o => o.statut === 'PAYE' || o.statut === 'PAYEE').reduce((sum, o) => sum + o.montant_total, 0)), icon: <TrendingUp size={20} className="text-black" /> },
  ];

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden">
      {/* Header avec statistiques */}
      <RestaurantHeader stats={stats} />

      {/* Barre de recherche et filtres - Masquée uniquement sur l'onglet menu */}
      {activeTab !== 'menu' && (
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl text-primary placeholder-subtle text-sm"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                outline: 'none',
              }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-48 h-10 rounded-xl text-primary text-sm px-4"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              outline: 'none',
            }}
          >
            <option value="">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="EN_COURS">En cours</option>
            <option value="SERVIE">Servie</option>
            <option value="PAYEE">Payée</option>
          </select>
        </div>
      )}

      {/* Onglets */}
      <RestaurantTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Contenu des onglets */}
      <div className="w-full">
        {activeTab === 'commandes' && (
          <CommandesTab
            orders={orders}
            products={products}
            onUpdateStatus={handleUpdateOrderStatus}
            onPayment={handlePayment}
            onCancel={handleCancelOrder}
            onDelete={handleRequestDeleteOrder}
            onNewOrder={handleNewOrder}
            onEditOrder={(order) => {
              setEditingOrder(order);
              setSelectedOrderTable(String(order.table_id || order.table?.id || 0));
              setSelectedOrderLocation(getRestaurantLocationLabel(order.location_type));
              setShowOrderModal(true);
            }}
            onInvoice={handlePrintInvoice}
          />
        )}
        {activeTab === 'menu' && (
          <MenuTab
            products={products}
            categories={categories}
            userIsAdmin={userIsAdmin}
            onAddProduct={() => {
              setEditingProduct(null);
              setShowProductModal(true);
            }}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        )}
        {activeTab === 'stock' && <StockTab />}
        {(userIsAdmin || userIsCashier) && activeTab === 'caisse' && (
          <CaisseTab
            orders={orders}
            onPayment={handlePayment}
            onCloseAllOrders={async (orderIds) => {
              await restaurantService.closeAllOrders(orderIds);
            }}
            onRefresh={fetchOrders}
          />
        )}
        {activeTab === 'historique' && <HistoryTab orders={orders} />}
        {userIsAdmin && activeTab === 'inventaire' && <InventaireTab />}
        {activeTab === 'rapports' && <RestaurantReports orders={orders} stock={restaurantStock} />}
      </div>

      {/* Modales */}
      <Modal
        isOpen={pendingDeleteOrder !== null}
        onClose={() => { if (!isDeletingOrder) setPendingDeleteOrder(null); }}
        title="Supprimer la commande"
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-primary">Supprimer définitivement cette commande ?</p>
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                Cette action supprimera la commande et tous ses articles. Elle est irréversible.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingDeleteOrder(null)}
              disabled={isDeletingOrder}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void handleDeleteOrder()}
              disabled={isDeletingOrder}
              className="w-full sm:w-auto"
            >
              <Trash2 size={16} />
              {isDeletingOrder ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={pendingDeleteProduct !== null}
        onClose={() => { if (!isDeletingProduct) setPendingDeleteProduct(null); }}
        title="Supprimer le produit"
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <Trash2 size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-primary">Supprimer ce produit ?</p>
              <p className="mt-1 break-words text-sm leading-relaxed text-secondary">
                Le produit « {pendingDeleteProduct?.nom} » sera retiré du menu.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">Cette action est irréversible.</p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingDeleteProduct(null)}
              disabled={isDeletingProduct}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void confirmDeleteProduct()}
              disabled={isDeletingProduct}
              className="w-full sm:w-auto"
            >
              <Trash2 size={16} />
              {isDeletingProduct ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showOrderLocationModal}
        onClose={() => setShowOrderLocationModal(false)}
        title="Choisir l'emplacement de la commande"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">Sélectionnez une table ou un type de réservation.</p>
          <div className="grid grid-cols-4 gap-2">
            {[...tables].sort((firstTable, secondTable) => Number(firstTable.numero) - Number(secondTable.numero)).map((restaurantTable) => (
              <button
                key={restaurantTable.id}
                type="button"
                onClick={() => handleSelectOrderLocation(restaurantTable.id)}
                className="flex min-h-16 items-center justify-center rounded-lg border border-base bg-surface-2 px-2 py-2 text-center text-xs font-semibold text-primary transition hover:border-accent hover:bg-accent/10"
              >
                {String(restaurantTable.numero).toUpperCase().startsWith('T') ? restaurantTable.numero : `T${restaurantTable.numero}`}
              </button>
            ))}
            {tables.length === 0 && <p className="col-span-4 py-6 text-center text-xs text-muted">Aucune table disponible.</p>}
            {['Gratuit', 'Pocker gratuit', 'Chambre'].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleSelectOrderLocation(0, label)}
                className="flex min-h-16 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-center text-xs font-semibold text-amber-300 transition hover:border-amber-400 hover:bg-amber-500/20"
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="danger" size="sm" type="button" onClick={() => setShowOrderLocationModal(false)} className="w-auto self-end rounded-md px-3 py-1.5">
            Annuler
          </Button>
        </div>
      </Modal>
      <OrderModal
        isOpen={showOrderModal}
        onClose={() => { setShowOrderModal(false); setEditingOrder(null); setSelectedOrderTable(undefined); setSelectedOrderLocation(undefined); }}
        tables={tables}
        products={products}
        categories={categories}
        clients={clients}
        onSubmit={handleAddOrder}
        onNewClient={() => setShowClientModal(true)}
        orderToEdit={editingOrder || undefined}
        initialTableId={selectedOrderTable}
        initialLocation={selectedOrderLocation}
      />
      <ProductModal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}
        onCreateCategory={handleCreateRestaurantCategory}
        categories={categories}
        products={products}
        editingProduct={editingProduct}
      />
      <ClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onSubmit={handleAddClient}
      />
    </div>
  );
};