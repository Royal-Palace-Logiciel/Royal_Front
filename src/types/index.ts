// ==================== TYPES GLOBAUX ====================

export type ModuleType = 'hebergement' | 'hotel' | 'restaurant' | 'bar' | 'alcool' | 'casino' | 'finances' | 'utilisateurs' | 'dashboard' | 'clients' | 'rh' | 'planning';

// Valeurs autorisées par l'ENUM `users.role` du backend.
export type UserRole = 'admin' | 'manager' | 'receptioniste' | 'caisse' | 'water' | 'housekeeping' | 'croupier' | 'hotesse';

export type TransactionType = 'entree' | 'sortie';

export type StockStatus = 'disponible' | 'faible' | 'epuise';

// ==================== UTILISATEURS ====================

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  module: ModuleType[];
  avatar?: string;
  actif: boolean;
  createdAt: string;
  lastLogin?: string;
}

// ==================== STOCK ====================

export interface StockItem {
  id: string;
  nom: string;
  categorie: string;
  quantite: number;
  unite: string;
  prixUnitaire: number;
  seuilMinimum: number;
  fournisseur?: string;
  dateExpiration?: string;
  status: StockStatus;
  module: ModuleType;
  createdAt: string;
  updatedAt: string;
  typeProduit?: 'CONSOMMABLE' | 'NON_CONSOMMABLE';
  etat?: 'DISPONIBLE' | 'EN_LAVAGE' | 'USE' | 'ENDOMMAGE' | 'REBUT' | 'PERDU';
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemNom: string;
  type: 'entree' | 'sortie' | 'ajustement';
  quantite: number;
  motif: string;
  userId: string;
  userName: string;
  module: ModuleType;
  date: string;
}

// ==================== CAISSE ====================

export interface CaisseTransaction {
  id: string;
  type: TransactionType;
  montant: number;
  description: string;
  categorie: string;
  userId: string;
  userName: string;
  module: ModuleType;
  sousModule?: string; // Pour casino: nom du jeu
  date: string;
  reference?: string;
}

export interface CaisseState {
  module: ModuleType;
  soldeTotal: number;
  totalEntrees: number;
  totalSorties: number;
  transactions: CaisseTransaction[];
}

// ==================== HÉBERGEMENT ====================

export interface Chambre {
  id: string;
  numero: string;
  type: 'simple' | 'double' | 'suite' | 'vip';
  prix: number;
  status: 'libre' | 'occupee' | 'maintenance' | 'reservee';
  etage: number;
  capacite: number;
}

export interface Reservation {
  id: string;
  clientNom: string;
  clientPrenom: string;
  clientTel?: string;
  chambres: string[];
  dateArrivee: string;
  dateDepart: string;
  nuits: number;
  montantTotal: number;
  status: 'confirmee' | 'en_cours' | 'terminee' | 'annulee';
  createdAt: string;
}

// ==================== HÔTEL ====================

export interface HotelService {
  id: string;
  nom: string;
  type: 'chambre' | 'spa' | 'laundry' | 'room_service' | 'conference' | 'autre';
  prix: number;
  disponible: boolean;
}

// ==================== RESTAURANT ====================

export interface MenuItem {
  id: string;
  nom: string;
  categorie: 'entree' | 'plat' | 'dessert' | 'boisson' | 'special';
  prix: number;
  disponible: boolean;
  description?: string;
  image?: string;
}

export interface Commande {
  id: string;
  tableNumero: string;
  items: { menuItemId: string; nom: string; quantite: number; prixUnitaire: number }[];
  montantTotal: number;
  status: 'en_attente' | 'en_cours' | 'servie' | 'payee' | 'annulee';
  serveur?: string;
  createdAt: string;
}

// ==================== BAR ====================

export interface BoissonsItem {
  id: string;
  nom: string;
  categorie: 'cocktail' | 'biere' | 'vin' | 'spiritueux' | 'soft' | 'jus';
  prix: number;
  disponible: boolean;
  alcoolise: boolean;
}

// ==================== CASINO ====================

export type JeuType = 
  | 'roulette' 
  | 'blackjack' 
  | 'poker' 
  | 'machines_sous' 
  | 'baccara' 
  | 'craps'
  | 'keno'
  | 'loterie';

export interface JeuCasino {
  id: string;
  nom: string;
  type: JeuType;
  tables: number;
  mise_min: number;
  mise_max: number;
  actif: boolean;
  caisse: CaisseState;
  icon: string;
  couleur: string;
}

export interface SessionJeu {
  id: string;
  jeuId: string;
  jeuNom: string;
  joueurNom?: string;
  mise: number;
  gain: number;
  resultat: 'gain' | 'perte' | 'egalite';
  date: string;
}

// ==================== FINANCES ====================

export interface FinanceReport {
  module: ModuleType;
  nom: string;
  solde: number;
  totalEntrees: number;
  totalSorties: number;
  pourcentage: number;
  evolution: number; // % vs mois précédent
}

export interface BudgetLine {
  id: string;
  module: ModuleType;
  categorie: string;
  budgetPrevu: number;
  depenseReelle: number;
  periode: string; // YYYY-MM
}

// ==================== DASHBOARD ====================

export interface DashboardStats {
  totalRevenu: number;
  totalDepenses: number;
  soldeGlobal: number;
  totalStockValue: number;
  alertesStock: number;
  transactionsJour: number;
  evolutionRevenu: number;
  evolutionDepenses: number;
  modules: {
    [key in ModuleType]?: {
      solde: number;
      evolution: number;
    };
  };
}

// ==================== APP STATE ====================

export interface AppState {
  currentUser: User | null;
  currentModule: ModuleType;
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
}
