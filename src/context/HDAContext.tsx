// src/context/HDAContext.tsx
import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  StockItem,
  CaisseTransaction,
  User,
  JeuCasino,
  ModuleType,
  Reservation,
  Commande,
  StockMovement,
  Chambre
} from '../types';
import {
  initialUsers,
  initialStockItems,
  initialTransactions,
  initialJeuxCasino,
  reservations,
  commandes,
  stockMovements,
  generateId
} from '../utils/data';
import AuthService from '../services/authService';

// ==================== STATE ====================

interface HDAState {
  orders: Commande[];
  users: User[];
  currentUser: User;
  stockItems: StockItem[];
  transactions: CaisseTransaction[];
  jeux: JeuCasino[];
  reservations: Reservation[];
  commandes: Commande[];
  stockMovements: StockMovement[];
  chambres: Chambre[];
  activeModule: ModuleType;
  sidebarCollapsed: boolean;
  notifications: Notification[];
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
  source?: string;
  actionUrl?: string;
}

// ==================== DONNÉES INITIALES POUR LES CHAMBRES ====================

const initialChambres: Chambre[] = [
  {
    id: 'ch1',
    numero: '101',
    type: 'simple',
    prix: 120,
    status: 'libre',
    etage: 1,
    capacite: 2,
  },
  {
    id: 'ch2',
    numero: '102',
    type: 'double',
    prix: 180,
    status: 'occupee',
    etage: 1,
    capacite: 2,
  },
  {
    id: 'ch3',
    numero: '201',
    type: 'suite',
    prix: 350,
    status: 'libre',
    etage: 2,
    capacite: 4,
  },
  {
    id: 'ch4',
    numero: '202',
    type: 'vip',
    prix: 250,
    status: 'reservee',
    etage: 2,
    capacite: 2,
  },
  {
    id: 'ch5',
    numero: '301',
    type: 'vip',
    prix: 500,
    status: 'libre',
    etage: 3,
    capacite: 4,
  }
];

// ==================== ACTIONS ====================

type Action =
  | { type: 'SET_MODULE'; payload: ModuleType }
  | { type: 'TOGGLE_SIDEBAR' }
  // Actions Stock
  | { type: 'ADD_STOCK_ITEM'; payload: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_STOCK_ITEM'; payload: StockItem }
  | { type: 'DELETE_STOCK_ITEM'; payload: string }
  // Actions Transactions
  | { type: 'ADD_TRANSACTION'; payload: Omit<CaisseTransaction, 'id' | 'date'> }
  | { type: 'ADD_CASINO_TRANSACTION'; payload: { jeuId: string; transaction: Omit<CaisseTransaction, 'id' | 'date'> } }
  // Actions Utilisateurs
  | { type: 'ADD_USER'; payload: Omit<User, 'id' | 'createdAt'> }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'DELETE_USER'; payload: string }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_CURRENT_USER'; payload: User }
  // Actions Réservations
  | { type: 'ADD_RESERVATION'; payload: Omit<Reservation, 'id' | 'createdAt'> }
  | { type: 'UPDATE_RESERVATION'; payload: Reservation }
  | { type: 'DELETE_RESERVATION'; payload: string }
  // Actions Commandes
  | { type: 'ADD_COMMANDE'; payload: Omit<Commande, 'id' | 'createdAt'> }
  | { type: 'UPDATE_COMMANDE'; payload: Commande }
  | { type: 'DELETE_COMMANDE'; payload: string }
  // Actions Jeux Casino
  | { type: 'UPDATE_JEU'; payload: JeuCasino }
  // Actions Notifications
  | { type: 'ADD_NOTIFICATION'; payload: Omit<Notification, 'id' | 'timestamp'> }
  | { type: 'CLEAR_NOTIFICATION'; payload: string }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'CLEAR_ALL_NOTIFICATIONS' }
  // Actions Chambres
  | { type: 'ADD_CHAMBRE'; payload: Chambre }
  | { type: 'UPDATE_CHAMBRE'; payload: Chambre }
  | { type: 'DELETE_CHAMBRE'; payload: string };

// ==================== REDUCER ====================

const hdaReducer = (state: HDAState, action: Action): HDAState => {
  switch (action.type) {
    // ===== NAVIGATION =====
    case 'SET_MODULE':
      return { ...state, activeModule: action.payload };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    // ===== STOCK =====
    case 'ADD_STOCK_ITEM': {
      const newItem: StockItem = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { ...state, stockItems: [...state.stockItems, newItem] };
    }

    case 'UPDATE_STOCK_ITEM':
      return {
        ...state,
        stockItems: state.stockItems.map(item =>
          item.id === action.payload.id
            ? { ...action.payload, updatedAt: new Date().toISOString() }
            : item
        )
      };

    case 'DELETE_STOCK_ITEM':
      return {
        ...state,
        stockItems: state.stockItems.filter(item => item.id !== action.payload)
      };

    // ===== TRANSACTIONS =====
    case 'ADD_TRANSACTION': {
      const newTransaction: CaisseTransaction = {
        ...action.payload,
        id: generateId(),
        date: new Date().toISOString(),
      };
      return { ...state, transactions: [newTransaction, ...state.transactions] };
    }

    case 'ADD_CASINO_TRANSACTION': {
      const { jeuId, transaction } = action.payload;
      const newTransaction: CaisseTransaction = {
        ...transaction,
        id: generateId(),
        date: new Date().toISOString(),
      };

      const updatedJeux = state.jeux.map(jeu => {
        if (jeu.id === jeuId) {
          const delta = transaction.type === 'entree' ? transaction.montant : -transaction.montant;
          return {
            ...jeu,
            caisse: {
              ...jeu.caisse,
              soldeTotal: jeu.caisse.soldeTotal + delta,
              totalEntrees: transaction.type === 'entree'
                ? jeu.caisse.totalEntrees + transaction.montant
                : jeu.caisse.totalEntrees,
              totalSorties: transaction.type === 'sortie'
                ? jeu.caisse.totalSorties + transaction.montant
                : jeu.caisse.totalSorties,
              transactions: [newTransaction, ...jeu.caisse.transactions]
            }
          };
        }
        return jeu;
      });

      return {
        ...state,
        jeux: updatedJeux,
        transactions: [newTransaction, ...state.transactions]
      };
    }

    // ===== UTILISATEURS =====
    case 'SET_USERS':
      return { ...state, users: action.payload };

    case 'ADD_USER': {
      const newUser: User = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      return { ...state, users: [...state.users, newUser] };
    }

    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map(u => u.id === action.payload.id ? action.payload : u),
        currentUser: state.currentUser?.id === action.payload.id ? action.payload : state.currentUser
      };

    case 'DELETE_USER':
      return {
        ...state,
        users: state.users.filter(u => u.id !== action.payload)
      };

    case 'SET_CURRENT_USER':
      return {
        ...state,
        currentUser: action.payload
      };

    // ===== RÉSERVATIONS =====
    case 'ADD_RESERVATION': {
      const newRes: Reservation = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      return { ...state, reservations: [newRes, ...state.reservations] };
    }

    case 'UPDATE_RESERVATION':
      return {
        ...state,
        reservations: state.reservations.map(r => r.id === action.payload.id ? action.payload : r)
      };

    case 'DELETE_RESERVATION':
      return {
        ...state,
        reservations: state.reservations.filter(r => r.id !== action.payload)
      };

    // ===== COMMANDES =====
    case 'ADD_COMMANDE': {
      const newCmd: Commande = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      return { ...state, commandes: [newCmd, ...state.commandes] };
    }

    case 'UPDATE_COMMANDE':
      return {
        ...state,
        commandes: state.commandes.map(c => c.id === action.payload.id ? action.payload : c)
      };

    case 'DELETE_COMMANDE':
      return {
        ...state,
        commandes: state.commandes.filter(c => c.id !== action.payload)
      };

    // ===== JEUX CASINO =====
    case 'UPDATE_JEU':
      return {
        ...state,
        jeux: state.jeux.map(j => j.id === action.payload.id ? action.payload : j)
      };

    // ===== NOTIFICATIONS =====
    case 'ADD_NOTIFICATION': {
      const notif: Notification = {
        ...action.payload,
        id: generateId(),
        timestamp: new Date().toISOString()
      };
      return { ...state, notifications: [notif, ...state.notifications.slice(0, 9)] };
    }

    case 'CLEAR_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };

    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload
      };

    case 'CLEAR_ALL_NOTIFICATIONS':
      return {
        ...state,
        notifications: []
      };

    // ===== CHAMBRES =====
    case 'ADD_CHAMBRE':
      return {
        ...state,
        chambres: [...state.chambres, action.payload]
      };

    case 'UPDATE_CHAMBRE':
      return {
        ...state,
        chambres: state.chambres.map(c =>
          c.id === action.payload.id ? action.payload : c
        )
      };

    case 'DELETE_CHAMBRE':
      return {
        ...state,
        chambres: state.chambres.filter(c => c.id !== action.payload)
      };

    default:
      return state;
  }
};

// ==================== STATE INITIAL ====================

const normalizeAuthUser = (u: ReturnType<typeof AuthService.getCurrentUser>): User | null => {
  if (!u) return null;
  return {
    id: String(u.id ?? u.id_admin ?? ''),
    nom: u.nom,
    prenom: u.prenom ?? '',
    email: u.email,
    role: (u.role as User['role']) ?? 'manager',
    module: Array.isArray(u.module) ? u.module as User['module'] : [],
    actif: u.actif ?? true,
    createdAt: u.created_at ?? u.date_creation ?? new Date().toISOString(),
    lastLogin: undefined,
  };
};

const initialState: HDAState = {
  users: initialUsers,
  currentUser: normalizeAuthUser(AuthService.getCurrentUser()) || initialUsers[0], // ⬅️ Récupération dynamique de la session active
  stockItems: initialStockItems,
  transactions: initialTransactions,
  jeux: initialJeuxCasino,
  reservations: reservations,
  commandes: commandes,
  orders: commandes,
  stockMovements: stockMovements,
  chambres: initialChambres,
  activeModule: 'dashboard',
  sidebarCollapsed: false,
  notifications: []
};

// ==================== CONTEXT ====================

interface HDAContextType {
  state: HDAState;
  dispatch: React.Dispatch<Action>;
  // Helpers
  getModuleTransactions: (module: ModuleType) => CaisseTransaction[];
  getModuleStock: (module: ModuleType) => StockItem[];
  getModuleCaisseSolde: (module: ModuleType) => { solde: number; entrees: number; sorties: number };
  getCasinoTotalCaisse: () => { solde: number; entrees: number; sorties: number };
  getGlobalStats: () => { totalRevenu: number; totalDepenses: number; soldeGlobal: number };
  addNotification: (type: 'info' | 'success' | 'warning' | 'error', message: string, source?: string, actionUrl?: string) => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const HDAContext = createContext<HDAContextType | undefined>(undefined);

export const HDAProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(hdaReducer, initialState);

  // ⬅️ Écouter les changements d'authentification (connexion / déconnexion)
  useEffect(() => {
    const handleAuthChange = () => {
      const activeUser = normalizeAuthUser(AuthService.getCurrentUser());
      if (activeUser) {
        dispatch({ type: 'SET_CURRENT_USER', payload: activeUser });
      }
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  // ===== HELPERS =====

  const getModuleTransactions = (module: ModuleType) => {
    return state.transactions.filter(t => t.module === module);
  };

  const getModuleStock = (module: ModuleType) => {
    return state.stockItems.filter(s => s.module === module);
  };

  const getModuleCaisseSolde = (module: ModuleType) => {
    const txs = getModuleTransactions(module);
    const entrees = txs.filter(t => t.type === 'entree').reduce((sum, t) => sum + t.montant, 0);
    const sorties = txs.filter(t => t.type === 'sortie').reduce((sum, t) => sum + t.montant, 0);
    return { solde: entrees - sorties, entrees, sorties };
  };

  const getCasinoTotalCaisse = () => {
    const solde = state.jeux.reduce((sum, j) => sum + j.caisse.soldeTotal, 0);
    const entrees = state.jeux.reduce((sum, j) => sum + j.caisse.totalEntrees, 0);
    const sorties = state.jeux.reduce((sum, j) => sum + j.caisse.totalSorties, 0);
    return { solde, entrees, sorties };
  };

  const getGlobalStats = () => {
    const modules: ModuleType[] = ['hebergement', 'hotel', 'restaurant', 'bar'];
    let totalRevenu = 0;
    let totalDepenses = 0;

    modules.forEach(m => {
      const { entrees, sorties } = getModuleCaisseSolde(m);
      totalRevenu += entrees;
      totalDepenses += sorties;
    });

    const casino = getCasinoTotalCaisse();
    totalRevenu += casino.entrees;
    totalDepenses += casino.sorties;

    return { totalRevenu, totalDepenses, soldeGlobal: totalRevenu - totalDepenses };
  };

  const addNotification = (type: 'info' | 'success' | 'warning' | 'error', message: string, source?: string, actionUrl?: string) => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: { type, message, source, actionUrl }
    });
  };

  const clearNotification = (id: string) => {
    dispatch({ type: 'CLEAR_NOTIFICATION', payload: id });
  };

  const clearAllNotifications = () => {
    dispatch({ type: 'CLEAR_ALL_NOTIFICATIONS' });
  };

  return (
    <HDAContext.Provider value={{
      state,
      dispatch,
      getModuleTransactions,
      getModuleStock,
      getModuleCaisseSolde,
      getCasinoTotalCaisse,
      getGlobalStats,
      addNotification,
      clearNotification,
      clearAllNotifications
    }}>
      {children}
    </HDAContext.Provider>
  );
};

export const useHDA = () => {
  const context = useContext(HDAContext);
  if (!context) throw new Error('useHDA must be used within HDAProvider');
  return context;
};