import React, { useEffect, useState } from 'react';
import { CalendarDays, History, RefreshCw } from 'lucide-react';
import { Button, Input } from '../../UI';
import { formatCurrency } from '../../../utils/data';
import * as restaurantService from '../../../services/restaurantService';
import type { Order } from '../types';
import type { RestaurantHistoryPayment } from '../../../types/restaurant';

interface HistoryTabProps {
  orders: Order[];
}

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const HistoryTab: React.FC<HistoryTabProps> = () => {
  const today = formatDateInput(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [paidOrders, setPaidOrders] = useState<RestaurantHistoryPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError('La date de début doit être antérieure ou égale à la date de fin.');
      setTotalCollected(0);
      setTotalPayments(0);
      setPaidOrders([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    restaurantService.getHistoryTotal(fromDate, toDate)
      .then((response) => {
        if (cancelled) return;
        if (!response.success) throw new Error(response.message || 'Impossible de charger l’historique.');
        setTotalCollected(Number(response.data?.total_collected || 0));
        setTotalPayments(Number(response.data?.total_payments || 0));
        setPaidOrders(response.data?.paid_orders || []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error('Erreur chargement total historique Restaurant:', loadError);
        setError('Le total encaissé n’a pas pu être chargé.');
        setTotalCollected(0);
        setTotalPayments(0);
        setPaidOrders([]);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [fromDate, toDate]);

  return (
    <div className="space-y-4 rounded-2xl border border-base bg-surface p-4 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-base pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History size={18} className="text-accent" />
            <h3 className="font-semibold text-primary">Historique</h3>
          </div>
          <p className="mt-1 text-sm text-secondary">Total des encaissements Restaurant</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input label="Du" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input label="Au" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-secondary">{totalPayments} encaissement{totalPayments === 1 ? '' : 's'} sur la période</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => { setFromDate(today); setToDate(today); }} disabled={isLoading}>
          <RefreshCw size={14} /> Aujourd’hui
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-6 text-center text-sm text-red-300">{error}</div>
      ) : (
        <>
          <div className="rounded-2xl border border-accent/25 bg-accent/10 px-5 py-8 text-center">
            <p className="text-sm font-medium text-secondary">Total encaissé sur la période</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-accent">{isLoading ? 'Chargement...' : formatCurrency(totalCollected)}</p>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted"><CalendarDays size={14} /> Encaissements confirmés</div>
          </div>

          <section className="space-y-3">
            <h4 className="font-semibold text-primary">Commandes encaissées</h4>
            {isLoading ? (
              <p className="rounded-xl border border-base bg-surface-2 px-4 py-5 text-center text-sm text-muted">Chargement des commandes...</p>
            ) : paidOrders.length === 0 ? (
              <p className="rounded-xl border border-base bg-surface-2 px-4 py-5 text-center text-sm text-muted">Aucune commande encaissée sur cette période.</p>
            ) : (
              <div className="space-y-3">
                {paidOrders.map((payment) => (
                  <div key={payment.payment_id} className="overflow-hidden rounded-xl border border-base bg-surface-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base px-4 py-2 text-xs text-muted">
                      <span>Commande #{payment.order_id}{payment.table_numero ? ` · Table ${payment.table_numero}` : ''}</span>
                      <span>{new Date(payment.date_paiement).toLocaleString('fr-FR')}</span>
                    </div>
                    {payment.items.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted">Aucun article détaillé pour cette commande.</p>
                    ) : payment.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 border-b border-base px-4 py-2 last:border-b-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-md bg-surface px-2 py-1 text-xs font-semibold text-secondary">{item.quantite}×</span>
                          <p className="min-w-0 truncate text-sm text-primary">
                            {item.product_nom}
                            {item.category_nom && <span className="text-secondary"> · {item.category_nom}</span>}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-primary">{formatCurrency(item.prix_unitaire * item.quantite)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
