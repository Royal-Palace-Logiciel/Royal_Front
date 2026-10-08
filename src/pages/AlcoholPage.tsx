import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { CaisseManager } from '../components/StockManager';
import { AlcoholStockManager } from '../components/Bar/AlcoholStockManager';
import alcoholService from '../services/alcohol.service';
import { BarProduct, BarStockItem } from '../types/bar.type';

import { BarHeader } from '../components/Bar/BarHeader';
import { BarStats } from '../components/Bar/BarStats';
import { BarTabs } from '../components/Bar/BarTabs';

import { BarTabId } from '../data/Bar.data';
import { CocktailMenu } from '../components/Bar/CocktailMenu';
import { AddAlcoholModal } from '../components/Bar/AddAlcoholModal';
import { BestSellers } from '../components/Bar/BestSellers';
import { AlcoholCommandeView } from '../components/Bar/AlcoholCommandeView';
import type { BarCommande } from '../types/bar.type';
import type { AlcoholOrderStatus } from '../services/alcohol.service';

import AuthService from '../services/authService';
import { getDefaultTabForRole, isAdmin } from '../utils/permissions';

export const AlcoholPage: React.FC = () => {
  const currentUser = AuthService.getCurrentUser();
  const userIsAdmin = isAdmin(currentUser);
  const [activeTab, setActiveTab] = useState<BarTabId>(() => getDefaultTabForRole('bar', currentUser?.role) as BarTabId);

  const [cocktails, setCocktails] = useState<BarProduct[]>([]);
  const [stockMap, setStockMap] = useState<Record<number, { quantite: number; unite: string }>>({});
  const [commandes, setCommandes] = useState<BarCommande[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mise à jour des labels pour inclure 'Prête'
  const orderStatusLabels: Record<string, BarCommande['statut']> = {
    EN_ATTENTE: 'En attente',
    EN_PREPARATION: 'En préparation',
    PRETE: 'Prête',
    SERVIE: 'Servie',
    ENCAISSEE: 'Encaissée',
  };

  const alcoholCocktails = cocktails.filter((cocktail) => cocktail.alcool !== false);

  const loadOrders = async () => {
    try {
      const data = await alcoholService.getAlcoholOrders();
      setCommandes(Array.isArray(data) ? data.map((order) => ({
        id: order.id,
        client: order.client,
        table: order.table,
        statut: orderStatusLabels[order.statut] || (order.statut as BarCommande['statut']),
        total: Number(order.total || 0),
        created_at: order.created_at,
        items: order.items || [],
      })) : []);
    } catch (error) {
      console.error('Erreur chargement commandes alcool:', error);
    }
  };

  const handleCreateCommande = async ({ client, table, items }: { client: string; table: number; items: BarCommande['items'] }) => {
    try {
      const normalizedItems = items.map((item) => ({
        product_id: item.product_id,
        nom: item.nom,
        quantite: Number(item.quantite) || 1,
        prix: Number(item.prix) || 0,
        prix_unitaire: Number(item.prix) || 0,
      }));

      const createdOrder = await alcoholService.createAlcoholOrder({ client, table, items: normalizedItems });
      if (createdOrder) {
        await Promise.all([loadOrders(), fetchData()]);
      }
    } catch (error) {
      console.error('Erreur création commande alcool:', error);
      setError("La commande d'alcool n'a pas pu être créée.");
      throw error;
    }
  };

  const handleDeleteCommande = async (id: number) => {
    try {
      await alcoholService.deleteAlcoholOrder(id);
      await loadOrders();
    } catch (error) {
      console.error('Erreur suppression commande alcool:', error);
      setError("La commande d'alcool n'a pas pu être supprimée.");
      throw error;
    }
  };

  // Fonction handleUpdateStatut corrigée avec 'Prête'
  const handleUpdateStatut = async (id: number, statut: BarCommande['statut']) => {
    const statuses: Record<BarCommande['statut'], AlcoholOrderStatus> = {
      'En attente': 'EN_ATTENTE',
      'En préparation': 'EN_PREPARATION',
      'Prête': 'SERVIE',
      'Servie': 'SERVIE',
      'Encaissée': 'ENCAISSEE',
    };

    try {
      const mappedStatus = statuses[statut];
      if (!mappedStatus) {
        console.error(`Statut non reconnu: ${statut}`);
        setError(`Le statut "${statut}" n'est pas valide.`);
        return;
      }
      await alcoholService.updateAlcoholOrderStatus(id, mappedStatus);
      await loadOrders();
    } catch (error) {
      console.error('Erreur mise à jour statut commande alcool:', error);
      setError("Le statut de la commande d'alcool n'a pas pu être mis à jour.");
      throw error;
    }
  };

  const handleAddItemToCommande = (cocktail: BarProduct): boolean => {
    if (commandes.length === 0) {
      return false;
    }

    setCommandes((prev) => {
      const currentCommande = prev[0];
      const normalizedPrice = Number(cocktail.prix) || 0;
      const existingItem = currentCommande.items.find((item) => item.nom === cocktail.nom);
      const updatedItems = existingItem
        ? currentCommande.items.map((item) =>
            item.nom === cocktail.nom
              ? { ...item, quantite: item.quantite + 1, prix: normalizedPrice }
              : item
          )
        : [...currentCommande.items, { nom: cocktail.nom, quantite: 1, prix: normalizedPrice }];

      const total = updatedItems.reduce((sum, item) => sum + Number(item.prix || 0) * item.quantite, 0);
      const updatedCommande = { ...currentCommande, items: updatedItems, total };
      return [updatedCommande];
    });

    return true;
  };

  const handleProductAdded = (newProduct: BarProduct) => {
    setCocktails((prev) => [...prev, newProduct]);
  };

  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cocktailsRes, stockRes] = await Promise.all([
        alcoholService.getAlcoholProducts(),
        alcoholService.getAlcoholStock(),
      ]);
      const cocktailsData = Array.isArray(cocktailsRes) ? cocktailsRes : (cocktailsRes as { data?: BarProduct[] }).data;
      const stock = Array.isArray(stockRes) ? stockRes : (stockRes as { data?: BarStockItem[] }).data;
      if (Array.isArray(cocktailsData)) setCocktails(cocktailsData as BarProduct[]);
      if (Array.isArray(stock)) {
        const map: Record<number, { quantite: number; unite: string }> = {};
        (stock as BarStockItem[]).forEach((s) => {
          map[s.product_id] = { quantite: s.quantite, unite: s.unite || 'unités' };
        });
        setStockMap(map);
      }
    } catch (err) {
      console.error('Erreur chargement alcool:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    void loadOrders();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-lg">Chargement des alcools...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BarHeader title="Alcools" subtitle="Sélection premium d'alcools & spiritueux" />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <BarStats commandes={commandes} stockMap={stockMap} />

      <BarTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'bar' && (
        <div className="space-y-6">
          {userIsAdmin && (
            <div className="flex justify-end">
              <AddAlcoholModal onProductAdded={handleProductAdded} onStockUpdate={fetchData} />
            </div>
          )}
          <CocktailMenu
            cocktails={alcoholCocktails}
            stockMap={stockMap}
            onStockUpdate={fetchData}
            onAddToOrder={handleAddItemToCommande}
            onProductAdded={handleProductAdded}
          />
          <BestSellers commandes={commandes} />
        </div>
      )}

      {activeTab === 'commandes' && (
        <AlcoholCommandeView 
          commandes={commandes} 
          onCreateCommande={handleCreateCommande} 
          onDeleteCommande={handleDeleteCommande} 
          onUpdateStatut={handleUpdateStatut} 
          cocktails={alcoholCocktails} 
          stockMap={stockMap} 
        />
      )}

      {activeTab === 'stock' && (
        <AlcoholStockManager onStockUpdate={fetchData} />
      )}

      {userIsAdmin && activeTab === 'caisse' && (
        <CaisseManager
          module="bar"
          categories={['Ventes Alcools', 'Stock', 'Personnel', 'Événement', 'Autre']}
          title="Caisse Alcools"
          gradient="from-amber-500 to-orange-500"
        />
      )}
    </div>
  );
};

export default AlcoholPage;