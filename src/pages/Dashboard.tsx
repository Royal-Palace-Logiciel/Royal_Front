import React, { useEffect, useState } from 'react';
import { useHDA } from '../context/HDAContext';
import { StatCard } from '../components/UI';
import { formatCurrency } from '../utils/data';
import { StockItem } from '../types';
import financeService, { FinancialStats, FinancialTransaction, isFinancialInflow } from '../services/finance.service';
import api from '../lib/api';
import {
  DollarSign, TrendingUp, TrendingDown, Package,
  AlertTriangle, Activity, Hotel,
  UtensilsCrossed, Wine, Dices, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

interface ModuleStockItem {
  id?: string | number;
  nom?: string;
  module?: string;
  categorie?: string;
  quantite: number;
  prixUnitaire: number;
  status?: string;
  unite?: string;
  stock?: number;
  prix?: number;
}

const EMPTY_FINANCIAL_STATS: FinancialStats = {
  totalEntrees: 0, totalSorties: 0, beneficeNet: 0,
  totalRevenu: 0, totalDepenses: 0, soldeGlobal: 0, modules: [],
};

const normalizeModule = (module?: string) => {
  const normalized = String(module || 'general')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Map disabled hebergement to hotel for display purposes
  if (normalized.includes('hebergement')) return 'hotel';
  return normalized;
};

// Revenue data for dashboard charts - hébergement removed from display as module is disabled
// Historical hébergement data is preserved in backend but not shown in UI
const revenueData = [
  { mois: 'Jan', hotel: 38000, restaurant: 28000, bar: 18000, casino: 95000 },
  { mois: 'Fév', hotel: 42000, restaurant: 31000, bar: 22000, casino: 88000 },
  { mois: 'Mar', hotel: 48000, restaurant: 35000, bar: 25000, casino: 112000 },
  { mois: 'Avr', hotel: 55000, restaurant: 40000, bar: 28000, casino: 125000 },
  { mois: 'Mai', hotel: 52000, restaurant: 38000, bar: 26000, casino: 108000 },
  { mois: 'Jun', hotel: 68000, restaurant: 48000, bar: 34000, casino: 145000 },
];

const COLORS = ['#d4a847', '#c4953a', '#e8c86a', '#f5e4a0'];

export const Dashboard: React.FC = () => {
  const { state } = useHDA();
  const [financialStats, setFinancialStats] = useState<FinancialStats>(EMPTY_FINANCIAL_STATS);
  const [recentTransactions, setRecentTransactions] = useState<FinancialTransaction[]>([]);
  const [liveStocks, setLiveStocks] = useState<{
    bar: ModuleStockItem[];
    restaurant: ModuleStockItem[];
    hotel: ModuleStockItem[];
    casino: ModuleStockItem[];
  }>({
    bar: [],
    restaurant: [],
    hotel: [],
    casino: [],
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [summary, transactions] = await Promise.all([
          financeService.getFinancialStats(),
          financeService.getTransactions(),
        ]);
        setFinancialStats(summary);
        setRecentTransactions(transactions.slice(0, 6));
      } catch (err) {
        console.error('Erreur chargement finances dashboard:', err);
      }

      // Récupérer dynamiquement les stocks depuis les APIs backend si disponibles
      try {
        const [barRes, restRes, hotelRes] = await Promise.allSettled([
          api.get('/api/bar/stock'),
          api.get('/api/restaurant/stock'),
          api.get('/api/stock/stocks/with-products?location_id=5'),
        ]);

        const barData = barRes.status === 'fulfilled' ? (barRes.value.data?.data || barRes.value.data || []) : [];
        const restData = restRes.status === 'fulfilled' ? (restRes.value.data?.data || restRes.value.data || []) : [];
        const hotelData = hotelRes.status === 'fulfilled' ? (hotelRes.value.data?.data || hotelRes.value.data || []) : [];

        setLiveStocks({
          bar: Array.isArray(barData) && barData.length > 0
            ? barData.map((b: any) => ({
                id: b.id,
                nom: b.product_nom || b.nom || 'Article Bar',
                categorie: b.product_categorie || b.categorie || 'Bar',
                quantite: Number(b.quantite ?? 0),
                stock: Number(b.quantite ?? 0),
                prix: Number(b.prix ?? b.prix_vente ?? b.prix_achat ?? 0),
                prixUnitaire: Number(b.prix ?? b.prix_vente ?? b.prix_achat ?? 0),
                unite: b.unite || b.product_unite || 'unités',
                module: 'bar',
                status: (b.quantite ?? 0) === 0 ? 'epuise' : (b.quantite ?? 0) <= (b.seuil_minimum ?? 5) ? 'faible' : 'disponible',
              }))
            : [],
          restaurant: Array.isArray(restData) && restData.length > 0
            ? restData.map((r: any) => ({
                id: r.id,
                nom: r.product_nom || r.nom || 'Article Restaurant',
                categorie: r.categorie || 'Restaurant',
                quantite: Number(r.quantite ?? 0),
                stock: Number(r.quantite ?? 0),
                prix: Number(r.prix_vente ?? r.prix_achat ?? r.prix ?? 0),
                prixUnitaire: Number(r.prix_vente ?? r.prix_achat ?? r.prix ?? 0),
                unite: r.unite || 'unités',
                module: 'restaurant',
                status: (r.quantite ?? 0) === 0 ? 'epuise' : (r.quantite ?? 0) <= (r.seuil_minimum ?? 5) ? 'faible' : 'disponible',
              }))
            : [],
          hotel: Array.isArray(hotelData) && hotelData.length > 0
            ? hotelData.map((h: any) => ({
                id: h.id,
                nom: h.product_nom || h.nom || 'Article Hôtel',
                categorie: h.categorie || 'Hôtel',
                quantite: Number(h.quantite ?? 0),
                stock: Number(h.quantite ?? 0),
                prix: Number(h.prix_vente ?? h.prix_achat ?? h.prix ?? 0),
                prixUnitaire: Number(h.prix_vente ?? h.prix_achat ?? h.prix ?? 0),
                unite: h.unite || h.product_unite || 'unités',
                module: 'hotel',
                status: (h.quantite ?? 0) === 0 ? 'epuise' : (h.quantite ?? 0) <= (h.seuil_minimum ?? 5) ? 'faible' : 'disponible',
              }))
            : [],
          casino: [],
        });
      } catch (err) {
        console.error('Erreur chargement stocks live:', err);
      }
    };
    loadDashboardData();
  }, []);

  const moduleSummary = (module: string) => financialStats.modules
    .filter(item => normalizeModule(item.module) === module)
    .reduce(
      (total, item) => ({
        module,
        entrees: total.entrees + Number(item.entrees || 0),
        sorties: total.sorties + Number(item.sorties || 0),
        solde: total.solde + Number(item.solde || 0),
      }),
      { module, entrees: 0, sorties: 0, solde: 0 }
    );
  // Note: 'hebergement' module removed from display as it's disabled
  const hotel = moduleSummary('hotel');
  const restaurant = moduleSummary('restaurant');
  const bar = moduleSummary('bar');
  const casino = moduleSummary('casino');

  // ==================== SOURCES DE DONNÉES PAR MODULE ====================
  const contextBarItems = state.stockItems.filter(s => s.module === 'bar');
  const contextRestaurantItems = state.stockItems.filter(s => s.module === 'restaurant');
  const contextHotelItems = state.stockItems.filter(s => s.module === 'hotel' || s.module === 'hebergement');
  const contextCasinoItems = state.stockItems.filter(s => s.module === 'casino');

  const barItems: (ModuleStockItem | StockItem)[] = liveStocks.bar.length > 0 ? liveStocks.bar : contextBarItems;
  const restaurantItems: (ModuleStockItem | StockItem)[] = liveStocks.restaurant.length > 0 ? liveStocks.restaurant : contextRestaurantItems;
  const hotelItems: (ModuleStockItem | StockItem)[] = liveStocks.hotel.length > 0 ? liveStocks.hotel : contextHotelItems;
  const casinoItems: (ModuleStockItem | StockItem)[] = liveStocks.casino.length > 0 ? liveStocks.casino : contextCasinoItems;

  // ==================== FORMULE DE CALCUL DE LA VALEUR DU STOCK ====================
  // Pour chaque article : quantité restante (stock) * prix unitaire
  const calculateItemValue = (item: any): number => {
    if (!item || typeof item !== 'object') return 0;
    const stockQuantity = Number(item.quantite ?? item.stock ?? 0);
    const unitPrice = Number(item.prixUnitaire ?? item.prix ?? item.prix_vente ?? item.prix_achat ?? 0);
    return (Number.isFinite(stockQuantity) && stockQuantity > 0 && Number.isFinite(unitPrice) && unitPrice > 0)
      ? stockQuantity * unitPrice
      : 0;
  };

  // Valeur totale par module
  const barStockValue = barItems.reduce((sum: number, item) => sum + calculateItemValue(item), 0);
  const restaurantStockValue = restaurantItems.reduce((sum: number, item) => sum + calculateItemValue(item), 0);
  const hotelStockValue = hotelItems.reduce((sum: number, item) => sum + calculateItemValue(item), 0);
  const casinoStockValue = casinoItems.reduce((sum: number, item) => sum + calculateItemValue(item), 0);

  // Valeur totale globale du stock tous modules confondus
  const totalStockValue = barStockValue + restaurantStockValue + hotelStockValue + casinoStockValue;

  // Liste consolidée pour les alertes de stock
  const allStockItems: (ModuleStockItem | StockItem)[] = [...barItems, ...restaurantItems, ...hotelItems, ...casinoItems];
  const stockAlerts = allStockItems.filter(s => s.status && s.status !== 'disponible').length;
  const displayAlertItems = allStockItems.filter(s => s.status && s.status !== 'disponible').slice(0, 6);

  const pieData = [
    { name: 'Hôtel', value: hotel.entrees },
    { name: 'Restaurant', value: restaurant.entrees },
    { name: 'Bar', value: bar.entrees },
    { name: 'Casino', value: casino.entrees },
  ];

  const moduleCards = [
    { label: 'Hôtel', solde: hotel.solde, entrees: hotel.entrees, sorties: hotel.sorties, icon: <Hotel size={16} className="text-black" />, gradient: 'from-accent to-accent-2' },
    { label: 'Restaurant', solde: restaurant.solde, entrees: restaurant.entrees, sorties: restaurant.sorties, icon: <UtensilsCrossed size={16} className="text-black" />, gradient: 'from-accent to-accent-2' },
    { label: 'Bar & Lounge', solde: bar.solde, entrees: bar.entrees, sorties: bar.sorties, icon: <Wine size={16} className="text-black" />, gradient: 'from-accent to-accent-2' },
    { label: 'Casino', solde: casino.solde, entrees: casino.entrees, sorties: casino.sorties, icon: <Dices size={16} className="text-black" />, gradient: 'from-accent to-accent-2' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <p style={{ color: 'var(--color-muted)', fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>{label}</p>
          {payload.map((entry: any) => (
            <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }} />
              <span style={{ color: 'var(--color-muted)' }}>{entry.name}:</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-8">
      {/* Hero Stats */}
      <div className="w-full">
        <div className="mb-6">
          <h2 className="text-primary text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
            Vue d'ensemble
          </h2>
          <p className="text-muted text-sm mt-1">Performance globale de la plateforme HDA</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <StatCard
            title="Solde Global"
            value={financialStats.beneficeNet}
            icon={<DollarSign size={20} className="text-black" />}
            gradient="from-accent to-accent-2"
            subtitle="Entrées moins sorties"
            isCurrency
          />
          <StatCard
            title="Revenus Totaux"
            value={financialStats.totalEntrees}
            icon={<TrendingUp size={20} className="text-black" />}
            gradient="from-accent to-accent-2"
            subtitle={`${recentTransactions.filter(t => isFinancialInflow(t.type_flux)).length} transactions récentes`}
            isCurrency
          />
          <StatCard
            title="Dépenses Totales"
            value={financialStats.totalSorties}
            icon={<TrendingDown size={20} className="text-black" />}
            gradient="from-accent to-accent-2"
            subtitle={`${recentTransactions.filter(t => !isFinancialInflow(t.type_flux)).length} transactions récentes`}
            isCurrency
          />
          <StatCard
            title="Valeur du Stock"
            value={totalStockValue}
            icon={<Package size={20} className="text-black" />}
            gradient="from-accent to-accent-2"
            subtitle={`${stockAlerts} alertes stock`}
            isCurrency
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* Revenue Chart */}
        <div 
          className="lg:col-span-2 rounded-2xl p-6 w-full"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-primary font-semibold">Entrées et sorties par module</h3>
              <p className="text-muted text-sm">Données issues du grand livre financier</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent)', fontSize: '14px', fontWeight: 600 }}>
              <TrendingUp size={16} />
              <span>Solde : {formatCurrency(financialStats.beneficeNet)}</span>
            </div>
          </div>
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleCards}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--color-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k MGA`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="entrees" name="Entrées" fill="#4ade80" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sorties" name="Sorties" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div 
          className="rounded-2xl p-6 w-full"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="mb-6">
            <h3 className="text-primary font-semibold">Répartition Revenus</h3>
            <p className="text-muted text-sm">Par module</p>
          </div>
          <div className="w-full h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {pieData.map((entry, i) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-muted">{entry.name}</span>
                </div>
                <span className="text-primary font-medium">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module Cards */}
      <div className="w-full">
        <h3 className="text-primary font-semibold mb-4">Performance par Module</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
          {moduleCards.map((mod) => (
            <div 
              key={mod.label} 
              className="rounded-2xl p-5 transition-all group relative overflow-hidden w-full"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.boxShadow = 'var(--shadow-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${mod.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center`}>
                  {mod.icon}
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${mod.solde >= 0 ? 'text-accent' : 'text-danger'}`}>
                  {mod.solde >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  Net
                </div>
              </div>
              <p className="text-muted text-xs font-medium mb-1">{mod.label}</p>
              <p className="text-primary font-bold text-xl">{formatCurrency(mod.solde)}</p>
              <div className="flex gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex-1">
                  <p className="text-xs text-muted">Entrées</p>
                  <p className="text-xs text-accent font-semibold">{formatCurrency(mod.entrees)}</p>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted">Sorties</p>
                  <p className="text-xs text-danger font-semibold">{formatCurrency(mod.sorties)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Recent Transactions */}
        <div 
          className="rounded-2xl overflow-hidden w-full"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h3 className="text-primary font-semibold">Dernières Transactions</h3>
            <button className="text-accent text-sm hover:text-accent-2 transition-colors">Tout voir</button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {recentTransactions.map(tx => {
              const isInflow = isFinancialInflow(tx.type_flux);
              return (
              <div key={tx.id} className="flex items-center gap-4 px-6 py-3 transition-colors" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isInflow ? 'bg-accent-4' : 'bg-danger-bg'
                }`}>
                  {isInflow
                    ? <ArrowUpRight size={16} className="text-accent" />
                    : <ArrowDownRight size={16} className="text-danger" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-primary text-sm font-medium truncate">{tx.description}</p>
                  <p className="text-muted text-xs capitalize">{tx.module} • {tx.type_flux}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${isInflow ? 'text-accent' : 'text-danger'}`}>
                    {isInflow ? '+' : '-'}{formatCurrency(tx.montant)}
                  </p>
                  <p className="text-subtle text-xs">
                    {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Stock Alerts */}
        <div 
          className="rounded-2xl overflow-hidden w-full"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h3 className="text-primary font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="text-accent" />
              Alertes Stock
            </h3>
            <span 
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: 'var(--color-accent-4)',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
              }}
            >
              {stockAlerts} alertes
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {displayAlertItems.map((item, index) => (
              <div key={item.id ?? `alert-${index}`} className="flex items-center gap-4 px-6 py-3 transition-colors" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  item.status === 'epuise' ? 'bg-danger-bg' : 'bg-accent-4'
                }`}>
                  <Package size={16} className={item.status === 'epuise' ? 'text-danger' : 'text-accent'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-primary text-sm font-medium truncate">{item.nom}</p>
                  <p className="text-muted text-xs capitalize">{item.module} • {item.categorie || 'Stock'}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'epuise' 
                      ? 'text-danger border border-danger' 
                      : 'text-accent border border-accent'
                  }`} style={{
                    backgroundColor: item.status === 'epuise' ? 'var(--color-danger-bg)' : 'var(--color-accent-4)',
                  }}>
                    {item.status === 'epuise' ? 'Épuisé' : `Faible: ${item.quantite} ${item.unite || 'unités'}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
