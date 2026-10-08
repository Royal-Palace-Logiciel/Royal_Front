import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Package, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { Button, Input } from '../../UI';
import { formatCurrency } from '../../../utils/data';
import * as restaurantService from '../../../services/restaurantService';
import type { ProductHistoryItem, ProductHistoryGroup } from '../types';

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const formatDateLong = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

export const InventaireTab: React.FC = () => {
  const today = formatDateInput(new Date());
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [productName, setProductName] = useState('');
  const [items, setItems] = useState<ProductHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await restaurantService.getProductHistory({ dateFrom, dateTo, productName });
      if (res.success && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Erreur chargement inventaire restaurant:', err);
      setError("Impossible de charger l'inventaire des produits.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups: ProductHistoryGroup[] = useMemo(() => {
    const map = new Map<string, ProductHistoryGroup>();
    for (const item of items) {
      const existing = map.get(item.date_vente) ?? {
        date: item.date_vente,
        totalArticles: 0,
        totalMontant: 0,
        items: [],
      };
      existing.items.push(item);
      existing.totalArticles += item.quantite_totale;
      existing.totalMontant += item.montant_total;
      map.set(item.date_vente, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [items]);

  const grandTotalArticles = groups.reduce((sum, g) => sum + g.totalArticles, 0);
  const grandTotalMontant = groups.reduce((sum, g) => sum + g.totalMontant, 0);

  return (
    <section className="space-y-4">
      {/* En-tête + filtres */}
      <div className="rounded-2xl border border-accent/30 bg-surface p-4 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-base pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package size={18} className="text-accent" />
              <h3 className="font-semibold text-primary">Inventaire des produits vendus</h3>
            </div>
            <p className="mt-1 text-sm text-secondary">
              Liste des produits vendus par jour (commandes payées uniquement).
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input label="Du" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="Au" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              label="Nom du produit"
              type="text"
              placeholder="Ex: Poulet, Riz, Coca..."
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void loadHistory(); }}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" onClick={() => void loadHistory()} disabled={loading}>
              <Search size={14} /> {loading ? 'Recherche...' : 'Rechercher'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDateFrom(getFirstDayOfMonth());
                setDateTo(today);
                setProductName('');
                void loadHistory();
              }}
              disabled={loading}
            >
              <RefreshCw size={14} /> Réinitialiser
            </Button>
          </div>
        </div>
      </div>

      {/* Résumé global */}
      {!loading && !error && groups.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-base bg-surface p-4">
            <p className="text-xs text-muted">Jours avec ventes</p>
            <p className="mt-1 text-lg font-semibold text-accent">{groups.length}</p>
          </div>
          <div className="rounded-xl border border-base bg-surface p-4">
            <p className="text-xs text-muted">Total articles vendus</p>
            <p className="mt-1 text-lg font-semibold text-accent">{grandTotalArticles}</p>
          </div>
          <div className="rounded-xl border border-base bg-surface p-4">
            <p className="text-xs text-muted">Chiffre d'affaires</p>
            <p className="mt-1 text-lg font-semibold text-accent">{formatCurrency(grandTotalMontant)}</p>
          </div>
        </div>
      )}

      {/* États */}
      {loading && (
        <div className="rounded-xl border border-base bg-surface p-6 text-sm text-muted">
          Chargement de l'inventaire…
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}
      {!loading && !error && groups.length === 0 && (
        <div className="rounded-xl border border-base bg-surface p-6 text-center text-sm text-muted">
          Aucun produit vendu sur cette période.
        </div>
      )}

      {/* Liste groupée par jour */}
      {!loading && !error && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((group) => (
            <article key={group.date} className="rounded-xl border border-base bg-surface p-4">
              <div className="flex flex-col gap-3 border-b border-base/60 pb-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-accent" />
                  <p className="font-semibold text-primary capitalize">{formatDateLong(group.date)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="rounded-full bg-accent/15 px-3 py-1 font-semibold text-accent">
                    {group.totalArticles} article{group.totalArticles > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-accent">
                    <TrendingUp size={13} />
                    {formatCurrency(group.totalMontant)}
                  </span>
                </div>
              </div>

              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={`${group.date}-${item.product_id}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex min-w-[3rem] justify-center rounded-md bg-surface-2 px-2 py-0.5 text-xs font-bold text-accent">
                        {item.quantite_totale}×
                      </span>
                      <span className="truncate text-secondary">{item.produit}</span>
                      <span className="hidden text-xs text-muted sm:inline">· {item.categorie}</span>
                    </div>
                    <strong className="shrink-0 text-accent">{formatCurrency(item.montant_total)}</strong>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};