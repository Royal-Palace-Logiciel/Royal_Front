import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Package, Search, TrendingUp } from 'lucide-react';
import api from '../../lib/api';

const getToday = () => new Date().toISOString().slice(0, 10);
const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const formatDateLong = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

interface HistoryItem {
  date_vente: string;
  produit: string;
  categorie: string;
  quantite_totale: number;
  montant_total: number;
  type_mouvement: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
  source?: string;
  nb_operations?: number;
}

interface HistoryGroup {
  date: string;
  totalArticles: number;
  totalMontant: number;
  items: HistoryItem[];
}

export const HotelProductHistory: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth);
  const [dateTo, setDateTo] = useState(getToday);
  const [productName, setProductName] = useState('');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async (filters = { dateFrom, dateTo, productName }) => {
    setLoading(true);
    setError(null);
    try {
      // Use the new hotel product history endpoint
      const params: any = { locationId: 5 };
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.productName) {
        params.productName = filters.productName;
      }
      
      const response = await api.get('/api/hebergement/product-history', { params });
      const payload = response.data?.data ?? response.data;
      const movements = Array.isArray(payload) ? payload : [];
      
      // Transform backend response to match frontend expected format
      const historyItems: HistoryItem[] = movements.map((m: any) => ({
        date_vente: m.date_consommation,
        produit: m.produit,
        categorie: m.categorie,
        quantite_totale: m.quantite_totale,
        montant_total: 0, // Stock movements don't have monetary value like bar sales
        source: m.source,
        type_mouvement: m.type_mouvement,
        nb_operations: m.nb_operations,
      }));
      
      setItems(historyItems);
    } catch (err) {
      console.error('Erreur chargement historique produits:', err);
      setError("Impossible de charger l'historique des produits.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const groups: HistoryGroup[] = useMemo(() => {
    const map = new Map<string, HistoryGroup>();
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

  return (
    <section className="space-y-4">
      {/* En-tête */}
      <div className="rounded-2xl border border-accent/30 bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Package size={22} />
            </div>
            <div>
              <h2 className="font-semibold text-primary">Historique des produits hôtel</h2>
              <p className="mt-1 text-sm text-muted">
                Journal complet des entrées et sorties (stock, ménage, maintenance, équipements).
              </p>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-secondary">
            <span className="mb-1 block font-semibold">Date début</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="text-xs text-secondary">
            <span className="mb-1 block font-semibold">Date fin</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="text-xs text-secondary lg:col-span-2">
            <span className="mb-1 block font-semibold">Nom du produit</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                placeholder="Ex: Serviette, Savon, Produit..."
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void loadHistory(); }}
                className="w-full rounded-lg border border-base bg-surface-2 py-2 pl-9 pr-3 text-sm text-primary outline-none focus:border-accent"
              />
            </div>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            <Search size={15} />
            {loading ? 'Recherche...' : 'Rechercher'}
          </button>
          <button
            type="button"
            onClick={() => {
              const resetDateFrom = getFirstDayOfMonth();
              const resetDateTo = getToday();
              setDateFrom(resetDateFrom);
              setDateTo(resetDateTo);
              setProductName('');
              void loadHistory({ dateFrom: resetDateFrom, dateTo: resetDateTo, productName: '' });
            }}
            className="rounded-xl border border-base bg-surface-2 px-4 py-2 text-sm text-secondary hover:text-primary"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Résumé global */}
      {!loading && !error && groups.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-base bg-surface p-4">
            <p className="text-xs text-muted">Jours avec mouvements</p>
            <p className="mt-1 text-lg font-semibold text-accent">{groups.length}</p>
          </div>
          <div className="rounded-xl border border-base bg-surface p-4">
            <p className="text-xs text-muted">Unités déplacées</p>
            <p className="mt-1 text-lg font-semibold text-accent">{grandTotalArticles}</p>
          </div>
          <div className="rounded-xl border border-base bg-surface p-4">
            <p className="text-xs text-muted">Source</p>
            <p className="mt-1 text-lg font-semibold text-accent">Stock</p>
          </div>
        </div>
      )}

      {/* États */}
      {loading && (
        <div className="rounded-xl border border-base bg-surface p-6 text-sm text-muted">
          Chargement de l'historique…
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      {/* Aucun résultat */}
      {!loading && !error && groups.length === 0 && (
        <div className="rounded-xl border border-base bg-surface p-6 text-center text-sm text-muted">
          Aucun mouvement de stock sur cette période.
        </div>
      )}

      {/* Liste groupée par jour */}
      {!loading && !error && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((group) => (
            <article key={group.date} className="rounded-xl border border-base bg-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-base/60 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-accent" />
                  <p className="font-semibold text-primary capitalize">{formatDateLong(group.date)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="rounded-full bg-accent/15 px-3 py-1 text-accent font-semibold">
                    {group.totalArticles} article{group.totalArticles > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 text-accent font-semibold">
                    <TrendingUp size={13} />
                    Stock
                  </span>
                </div>
              </div>

              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={`${group.date}-${item.produit}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex min-w-[3rem] justify-center rounded-md bg-surface-2 px-2 py-0.5 text-xs font-bold text-accent">
                        {item.quantite_totale}×
                      </span>
                        <span className="text-secondary truncate">{item.produit}</span>
                        <span className="hidden text-xs text-muted sm:inline">· {item.categorie}</span>
                      {item.source && (
                        <span className="hidden text-xs text-accent sm:inline">· {item.source}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.nb_operations && item.nb_operations > 1 && (
                        <span className="text-xs text-muted">({item.nb_operations} opérations)</span>
                      )}
                      <strong className={`shrink-0 ${item.type_mouvement === 'ENTREE' ? 'text-emerald-400' : item.type_mouvement === 'SORTIE' ? 'text-amber-400' : 'text-blue-400'}`}>
                        {item.type_mouvement === 'ENTREE' ? 'Entrée' : item.type_mouvement === 'SORTIE' ? 'Sortie' : 'Ajustement'}
                      </strong>
                    </div>
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
