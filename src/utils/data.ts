import {
  StockItem,
  CaisseTransaction,
  User,
  JeuCasino,
  Reservation,
  Commande,
  SessionJeu,
  StockMovement
} from '../types';

// ==================== UTILS ====================

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MGA',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    disponible: 'text-emerald-400 bg-emerald-400/10',
    faible: 'text-amber-400 bg-amber-400/10',
    epuise: 'text-red-400 bg-red-400/10',
    libre: 'text-emerald-400 bg-emerald-400/10',
    occupee: 'text-blue-400 bg-blue-400/10',
    maintenance: 'text-orange-400 bg-orange-400/10',
    reservee: 'text-purple-400 bg-purple-400/10',
    confirmee: 'text-blue-400 bg-blue-400/10',
    en_cours: 'text-amber-400 bg-amber-400/10',
    terminee: 'text-emerald-400 bg-emerald-400/10',
    annulee: 'text-red-400 bg-red-400/10',
    payee: 'text-emerald-400 bg-emerald-400/10',
    actif: 'text-emerald-400 bg-emerald-400/10',
    inactif: 'text-slate-400 bg-slate-400/10',
  };
  return colors[status] || 'text-slate-400 bg-slate-400/10';
};

// ==================== DONNÉES INITIALES ====================

export const initialUsers: User[] = [];

export const initialStockItems: StockItem[] = [
  // Hébergement
  { id: 's1', nom: 'Draps King Size', categorie: 'Linge', quantite: 45, unite: 'pièce', prixUnitaire: 35, seuilMinimum: 20, status: 'disponible', module: 'hebergement', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's2', nom: 'Serviettes de Bain', categorie: 'Linge', quantite: 8, unite: 'pièce', prixUnitaire: 15, seuilMinimum: 30, status: 'faible', module: 'hebergement', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's3', nom: 'Savons Hôtel', categorie: 'Hygiène', quantite: 200, unite: 'unité', prixUnitaire: 2, seuilMinimum: 50, status: 'disponible', module: 'hebergement', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's4', nom: 'Oreillers Premium', categorie: 'Linge', quantite: 0, unite: 'pièce', prixUnitaire: 45, seuilMinimum: 10, status: 'epuise', module: 'hebergement', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  // Hôtel
  { id: 's5', nom: 'Produits Spa', categorie: 'Bien-être', quantite: 60, unite: 'kit', prixUnitaire: 25, seuilMinimum: 20, status: 'disponible', module: 'hotel', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's6', nom: 'Mini-Bar Boissons', categorie: 'Nourriture', quantite: 5, unite: 'lot', prixUnitaire: 120, seuilMinimum: 15, status: 'faible', module: 'hotel', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's7', nom: 'Peignoirs', categorie: 'Linge', quantite: 80, unite: 'pièce', prixUnitaire: 55, seuilMinimum: 30, status: 'disponible', module: 'hotel', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  // Restaurant
  { id: 's8', nom: 'Filet de Boeuf', categorie: 'Viande', quantite: 12, unite: 'kg', prixUnitaire: 45, seuilMinimum: 10, status: 'disponible', module: 'restaurant', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's9', nom: 'Homard Frais', categorie: 'Fruits de mer', quantite: 3, unite: 'kg', prixUnitaire: 85, seuilMinimum: 5, status: 'faible', module: 'restaurant', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's10', nom: 'Truffe Noire', categorie: 'Épices', quantite: 0, unite: 'g', prixUnitaire: 8, seuilMinimum: 100, status: 'epuise', module: 'restaurant', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's11', nom: 'Farine T55', categorie: 'Épicerie', quantite: 50, unite: 'kg', prixUnitaire: 1.5, seuilMinimum: 20, status: 'disponible', module: 'restaurant', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  // Bar
  { id: 's12', nom: 'Whisky Aged 18Y', categorie: 'Spiritueux', quantite: 24, unite: 'bouteille', prixUnitaire: 180, seuilMinimum: 10, status: 'disponible', module: 'bar', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's13', nom: 'Champagne Brut', categorie: 'Vins', quantite: 7, unite: 'bouteille', prixUnitaire: 95, seuilMinimum: 12, status: 'faible', module: 'bar', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's14', nom: 'Gin Premium', categorie: 'Spiritueux', quantite: 18, unite: 'bouteille', prixUnitaire: 65, seuilMinimum: 8, status: 'disponible', module: 'bar', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's15', nom: 'Sirop de Framboise', categorie: 'Sirop', quantite: 2, unite: 'litre', prixUnitaire: 12, seuilMinimum: 5, status: 'faible', module: 'bar', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  // Casino
  { id: 's16', nom: 'Jetons de Poker', categorie: 'Jeux', quantite: 5000, unite: 'pièce', prixUnitaire: 2, seuilMinimum: 1000, status: 'disponible', module: 'casino', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
  { id: 's17', nom: 'Cartes à Jouer', categorie: 'Jeux', quantite: 8, unite: 'jeu', prixUnitaire: 15, seuilMinimum: 20, status: 'faible', module: 'casino', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
];

export const initialTransactions: CaisseTransaction[] = [
  // Hébergement
  { id: 't1', type: 'entree', montant: 2500, description: 'Réservation suite VIP - Client Marceau', categorie: 'Hébergement', userId: 'u1', userName: 'Jean Dupont', module: 'hebergement', date: new Date(Date.now() - 3600000).toISOString() },
  { id: 't2', type: 'entree', montant: 1200, description: 'Chambre double 3 nuits', categorie: 'Hébergement', userId: 'u1', userName: 'Jean Dupont', module: 'hebergement', date: new Date(Date.now() - 7200000).toISOString() },
  { id: 't3', type: 'sortie', montant: 350, description: 'Achat linge de lit', categorie: 'Stock', userId: 'u4', userName: 'Emma Leroy', module: 'hebergement', date: new Date(Date.now() - 86400000).toISOString() },
  // Hôtel

  // Restaurant
  { id: 't6', type: 'entree', montant: 680, description: 'Service dîner gala', categorie: 'Restaurant', userId: 'u2', userName: 'Sophie Martin', module: 'restaurant', date: new Date(Date.now() - 3600000).toISOString() },
  { id: 't7', type: 'entree', montant: 420, description: 'Déjeuner groupe - 15 couverts', categorie: 'Restaurant', userId: 'u2', userName: 'Sophie Martin', module: 'restaurant', date: new Date(Date.now() - 7200000).toISOString() },
  { id: 't8', type: 'sortie', montant: 250, description: 'Approvisionnement fruits de mer', categorie: 'Stock', userId: 'u2', userName: 'Sophie Martin', module: 'restaurant', date: new Date(Date.now() - 86400000).toISOString() },
  // Bar
  { id: 't9', type: 'entree', montant: 1850, description: 'Soirée cocktail privée', categorie: 'Bar', userId: 'u2', userName: 'Sophie Martin', module: 'bar', date: new Date(Date.now() - 3600000).toISOString() },
  { id: 't10', type: 'sortie', montant: 420, description: 'Achat spiritueux premium', categorie: 'Stock', userId: 'u2', userName: 'Sophie Martin', module: 'bar', date: new Date(Date.now() - 259200000).toISOString() },
  // Casino
  { id: 't11', type: 'entree', montant: 8500, description: 'Gain casino - Table Roulette', categorie: 'Jeux', userId: 'u3', userName: 'Marc Bernard', module: 'casino', sousModule: 'roulette', date: new Date(Date.now() - 3600000).toISOString() },
  { id: 't12', type: 'entree', montant: 12000, description: 'Gain casino - Blackjack VIP', categorie: 'Jeux', userId: 'u3', userName: 'Marc Bernard', module: 'casino', sousModule: 'blackjack', date: new Date(Date.now() - 7200000).toISOString() },
  { id: 't13', type: 'sortie', montant: 4200, description: 'Paiement jackpot machine à sous', categorie: 'Jeux', userId: 'u3', userName: 'Marc Bernard', module: 'casino', sousModule: 'machines_sous', date: new Date(Date.now() - 14400000).toISOString() },
  { id: 't14', type: 'entree', montant: 6800, description: 'Tournoi poker - Inscriptions', categorie: 'Jeux', userId: 'u3', userName: 'Marc Bernard', module: 'casino', sousModule: 'poker', date: new Date(Date.now() - 86400000).toISOString() },
];

export const initialJeuxCasino: JeuCasino[] = [
  {
    id: 'j1', nom: 'Roulette Européenne', type: 'roulette', tables: 3, mise_min: 5, mise_max: 5000, actif: true, icon: '🎯',
    couleur: 'from-red-600 to-red-800',
    caisse: {
      module: 'casino', soldeTotal: 45200, totalEntrees: 62000, totalSorties: 16800,
      transactions: initialTransactions.filter(t => t.sousModule === 'roulette')
    }
  },
  {
    id: 'j2', nom: 'Blackjack', type: 'blackjack', tables: 5, mise_min: 10, mise_max: 10000, actif: true, icon: '🃏',
    couleur: 'from-slate-700 to-slate-900',
    caisse: {
      module: 'casino', soldeTotal: 78500, totalEntrees: 115000, totalSorties: 36500,
      transactions: initialTransactions.filter(t => t.sousModule === 'blackjack')
    }
  },
  {
    id: 'j3', nom: 'Poker Texas Hold\'em', type: 'poker', tables: 8, mise_min: 20, mise_max: 50000, actif: true, icon: '♠️',
    couleur: 'from-emerald-700 to-emerald-900',
    caisse: {
      module: 'casino', soldeTotal: 92000, totalEntrees: 145000, totalSorties: 53000,
      transactions: initialTransactions.filter(t => t.sousModule === 'poker')
    }
  },
  {
    id: 'j4', nom: 'Machines à Sous', type: 'machines_sous', tables: 50, mise_min: 0.25, mise_max: 500, actif: true, icon: '🎰',
    couleur: 'from-purple-600 to-purple-900',
    caisse: {
      module: 'casino', soldeTotal: 35800, totalEntrees: 89000, totalSorties: 53200,
      transactions: initialTransactions.filter(t => t.sousModule === 'machines_sous')
    }
  },
  {
    id: 'j5', nom: 'Baccara', type: 'baccara', tables: 2, mise_min: 100, mise_max: 100000, actif: true, icon: '👑',
    couleur: 'from-amber-600 to-amber-800',
    caisse: {
      module: 'casino', soldeTotal: 156000, totalEntrees: 280000, totalSorties: 124000,
      transactions: []
    }
  },
  {
    id: 'j6', nom: 'Craps', type: 'craps', tables: 2, mise_min: 5, mise_max: 2000, actif: true, icon: '🎲',
    couleur: 'from-blue-600 to-blue-900',
    caisse: {
      module: 'casino', soldeTotal: 28500, totalEntrees: 45000, totalSorties: 16500,
      transactions: []
    }
  },
  {
    id: 'j7', nom: 'Keno', type: 'keno', tables: 1, mise_min: 1, mise_max: 100, actif: false, icon: '🎱',
    couleur: 'from-teal-600 to-teal-900',
    caisse: {
      module: 'casino', soldeTotal: 12200, totalEntrees: 25000, totalSorties: 12800,
      transactions: []
    }
  },
  {
    id: 'j8', nom: 'Loterie Prestige', type: 'loterie', tables: 1, mise_min: 2, mise_max: 50, actif: true, icon: '🏆',
    couleur: 'from-rose-600 to-rose-900',
    caisse: {
      module: 'casino', soldeTotal: 18900, totalEntrees: 35000, totalSorties: 16100,
      transactions: []
    }
  },
];

export const stockMovements: StockMovement[] = [
  { id: 'sm1', itemId: 's2', itemNom: 'Serviettes de Bain', type: 'sortie', quantite: 22, motif: 'Utilisation chambres', userId: 'u4', userName: 'Emma Leroy', module: 'hebergement', date: new Date(Date.now() - 86400000).toISOString() },
  { id: 'sm2', itemId: 's8', itemNom: 'Filet de Boeuf', type: 'entree', quantite: 5, motif: 'Livraison fournisseur', userId: 'u2', userName: 'Sophie Martin', module: 'restaurant', date: new Date(Date.now() - 43200000).toISOString() },
  { id: 'sm3', itemId: 's12', itemNom: 'Whisky Aged 18Y', type: 'sortie', quantite: 4, motif: 'Service soirée VIP', userId: 'u2', userName: 'Sophie Martin', module: 'bar', date: new Date(Date.now() - 7200000).toISOString() },
  { id: 'sm4', itemId: 's16', itemNom: 'Jetons de Poker', type: 'sortie', quantite: 500, motif: 'Tournoi hebdomadaire', userId: 'u3', userName: 'Marc Bernard', module: 'casino', date: new Date(Date.now() - 3600000).toISOString() },
];

export const reservations: Reservation[] = [
  { id: 'r1', clientNom: 'Fontaine', clientPrenom: 'Alexandre', clientTel: '+33 6 12 34 56 78', chambres: ['101', '102'], dateArrivee: '2024-06-20', dateDepart: '2024-06-25', nuits: 5, montantTotal: 4500, status: 'en_cours', createdAt: '2024-06-15T10:00:00Z' },
  { id: 'r2', clientNom: 'Petrov', clientPrenom: 'Natasha', clientTel: '+7 900 123 45 67', chambres: ['201'], dateArrivee: '2024-06-22', dateDepart: '2024-06-28', nuits: 6, montantTotal: 2800, status: 'confirmee', createdAt: '2024-06-10T14:00:00Z' },
  { id: 'r3', clientNom: 'Wang', clientPrenom: 'Li', chambres: ['Suite R'], dateArrivee: '2024-06-18', dateDepart: '2024-06-21', nuits: 3, montantTotal: 7500, status: 'terminee', createdAt: '2024-06-05T09:00:00Z' },
];

export const commandes: Commande[] = [
  { id: 'c1', tableNumero: 'T5', items: [{ menuItemId: 'm1', nom: 'Filet de Boeuf', quantite: 2, prixUnitaire: 65 }, { menuItemId: 'm3', nom: 'Château Margaux', quantite: 1, prixUnitaire: 180 }], montantTotal: 310, status: 'servie', serveur: 'Antoine', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'c2', tableNumero: 'T3', items: [{ menuItemId: 'm2', nom: 'Homard Thermidor', quantite: 1, prixUnitaire: 95 }, { menuItemId: 'm4', nom: 'Dessert du Chef', quantite: 2, prixUnitaire: 25 }], montantTotal: 145, status: 'payee', serveur: 'Marie', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'c3', tableNumero: 'VIP1', items: [{ menuItemId: 'm5', nom: 'Menu Dégustation', quantite: 4, prixUnitaire: 150 }], montantTotal: 600, status: 'en_cours', serveur: 'Jean-Paul', createdAt: new Date(Date.now() - 1800000).toISOString() },
];
