import React from 'react';
import { CaisseManager } from '../../StockManager';

interface CaisseTabProps {
  orders?: any[];
  onPayment?: (orderId: number, paymentMethod?: string) => void | Promise<void>;
  onCloseAllOrders?: (orderIds: number[]) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
}
   



export const CaisseTab: React.FC<CaisseTabProps> = ({ orders = [], onPayment, onCloseAllOrders, onRefresh }) => {
  const getOrderTotal = (order: any) => {
    const itemTotal = (order.items || []).reduce((sum: number, item: any) => (
      sum + Number(item.prix_unitaire || item.prix || 0) * Number(item.quantite || 0)
    ), 0);
    return itemTotal > 0 ? itemTotal : Number(order.montant_total || order.total || 0);
  };

  const allOrders = orders.filter((order) => order.statut !== 'ANNULEE').map((order) => ({
    id: Number(order.id),
    client: order.client_nom || order.client?.nom || 'Client anonyme',
    table: order.table?.numero || order.table_numero || order.table_id,
    total: getOrderTotal(order),
    statut: order.statut,
    created_at: order.created_at,
    moyen_paiement: order.moyen_paiement,
    items: (order.items || []).map((item: any) => ({
      nom: item.product_nom || item.product?.nom || `Article #${item.product_id}`,
      quantite: item.quantite,
      prix: item.prix_unitaire || item.prix || 0,
      categorie: 'Restaurant',
    })),
  }));

  return (
    <div className="w-full">
      <CaisseManager
        module="restaurant"
        categories={['Ventes Restaurant', 'Stock', 'Personnel', 'Autre']}
        title="Caisse Restaurant"
        gradient="from-accent to-accent-2"
        allOrders={allOrders}
        pendingOrders={orders.filter((order) => order.statut !== 'PAYEE' && order.statut !== 'PAYE' && order.statut !== 'ANNULEE').map((order) => ({
          id: Number(order.id),
          client: order.client_nom || order.client?.nom || 'Client anonyme',
          table: order.table?.numero || order.table_numero || order.table_id,
          total: getOrderTotal(order),
          created_at: order.created_at,
          nombre_personnes: order.nombre_personnes,
          moyen_paiement: order.moyen_paiement,
          items: order.items,
        }))}
        onEncaisserCommande={onPayment ? async (orderId) => { await onPayment(orderId, 'ESPECES'); } : undefined}
        onCloseAllOrders={onCloseAllOrders}
        onRefresh={onRefresh}
      />
    </div>
  );
};