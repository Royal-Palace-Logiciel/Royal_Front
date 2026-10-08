// src/utils/permissions.ts
// Utilitaires centralisés pour la gestion des permissions et accès aux modules

import { ModuleType, UserRole } from '../types';

/**
 * Matrice stricte des modules accessibles par rôle :
 * - admin : accès total à tous les modules
 * - manager : uniquement le(s) module(s) assigné(s) lors de sa création (max 2 managers par module)
 * - caissier : commandes et fonctions de caisse sur le module affecté
 * - stock_manager : uniquement les fonctions de gestion de stock (onglets stock)
 */
export const ROLE_MODULE_PERMISSIONS: Record<string, ModuleType[]> = {
  admin: ['dashboard', 'hebergement', 'hotel', 'restaurant', 'bar', 'alcool', 'casino', 'finances', 'clients', 'utilisateurs', 'rh', 'planning'],
  manager: ['dashboard', 'rh'],
  caissier: ['finances', 'restaurant', 'bar', 'alcool', 'casino', 'hebergement'],
  caisse: ['finances', 'restaurant', 'bar', 'alcool', 'casino', 'hebergement'],
  stock_manager: ['hotel', 'restaurant', 'bar', 'alcool', 'hebergement'],
  receptioniste: ['hebergement', 'hotel', 'bar', 'clients'],
  water: ['bar'],
  barman: ['bar'],
  hotesse: ['bar'],
  housekeeping: ['hotel', 'hebergement'],
  croupier: ['casino'],
};

/**
 * Modules réservés uniquement aux administrateurs.
 */
const ADMIN_ONLY_MODULES: ModuleType[] = ['utilisateurs'];

/**
 * Parse de façon robuste les modules d'un utilisateur, quel que soit leur format
 * (tableau de strings, tableau d'objets, JSON stringifié, CSV).
 */
export function parseUserModules(rawModules: any): string[] {
  if (!rawModules) return [];

  if (Array.isArray(rawModules)) {
    return rawModules
      .map((m: any) => (typeof m === 'string' ? m : m?.id ?? m?.name ?? null))
      .filter(Boolean);
  }

  if (typeof rawModules === 'string') {
    try {
      const parsed = JSON.parse(rawModules);
      if (Array.isArray(parsed)) {
        return parsed
          .map((m: any) => (typeof m === 'string' ? m : m?.id ?? m?.name ?? null))
          .filter(Boolean);
      }
    } catch {
      // Pas du JSON — traiter comme CSV
      return rawModules.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  return [];
}

/**
 * Détermine si un utilisateur peut accéder à un module donné.
 *
 * Règles strictes :
 * 1. Un utilisateur non authentifié n'a accès à rien.
 * 2. Un administrateur (role === 'admin') a accès à TOUS les modules.
 * 3. Le module 'utilisateurs' est strictement réservé à l'administrateur.
 * 4. Pour 'barman' / 'water' : accès UNIQUEMENT au module 'bar'.
 * 5. Pour 'manager' : accès UNIQUEMENT aux modules sélectionnés lors de sa création.
 * 6. Pour 'caissier' / 'caisse' : accès aux modules liés aux encaissements et finances.
 * 7. Pour 'stock_manager' : accès aux modules comportant une gestion de stock.
 *
 * @param user        - L'utilisateur courant (depuis AuthService.getCurrentUser())
 * @param moduleId    - L'identifiant du module à tester
 * @param allowedRoles - Les rôles autorisés pour ce module (optionnel)
 */
export function canAccessModule(
  user: { role: string; module?: string[] | any } | null,
  moduleId: string,
  allowedRoles?: string[]
): boolean {
  if (!user) return false;

  const role = user.role?.toLowerCase() || '';

  // 1. Admin : accès total
  if (role === 'admin') return true;

  // 2. Modules réservés strictement à l'admin
  if (ADMIN_ONLY_MODULES.includes(moduleId as ModuleType)) return false;

  // RH : tout utilisateur connecté y a accès (sa propre fiche + demande de congé),
  // y compris le barman — vérifié avant la restriction stricte ci-dessous pour ne
  // pas être court-circuité par elle. Le contenu réellement affiché/autorisé est
  // filtré dans RHPage et côté backend via /rh/me ; seuls admin/manager voient la
  // vue de gestion complète.
  if (moduleId === 'rh' && role !== 'hotesse') return true;

  // 3. Barman : accès UNIQUEMENT au module bar (en dehors de RH ci-dessus)
  if (role === 'water' || role === 'barman' || role === 'hotesse') {
    return moduleId === 'bar';
  }

  // 4. Manager : accès UNIQUEMENT aux modules assignés
  if (role === 'manager') {
    const userModules = parseUserModules(user.module);
    if (moduleId === 'dashboard') {
      return userModules.length === 0 || userModules.includes('dashboard');
    }
    return userModules.includes(moduleId);
  }

  // 5. Caissier : finances ou modules avec encaissement
  if (role === 'caissier' || role === 'caisse') {
    const userModules = parseUserModules(user.module);
    if (userModules.length > 0) {
      return userModules.includes(moduleId);
    }
    return ['finances', 'restaurant', 'bar', 'alcool', 'casino', 'hebergement'].includes(moduleId);
  }

  // 6. Stock Manager : uniquement modules de stock (restaurant, bar, hotel, hebergement)
  if (role === 'stock_manager') {
    const userModules = parseUserModules(user.module);
    if (userModules.length > 0) {
      return userModules.includes(moduleId);
    }
    return ['hotel', 'restaurant', 'bar', 'alcool', 'hebergement'].includes(moduleId);
  }

  // 7. Autres rôles métiers spécifiques
  if (ROLE_MODULE_PERMISSIONS[role]) {
    const allowed = ROLE_MODULE_PERMISSIONS[role];
    const userModules = parseUserModules(user.module);
    if (userModules.length > 0) {
      return userModules.includes(moduleId);
    }
    return allowed.includes(moduleId as ModuleType);
  }

  // Si allowedRoles est fourni, vérifier
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) return false;
    const userModules = parseUserModules(user.module);
    if (userModules.length > 0) {
      return userModules.includes(moduleId);
    }
    return true;
  }

  return false;
}

/**
 * Vérifie si un rôle ou utilisateur correspond à l'administrateur.
 */
export function isAdmin(userOrRole?: { role?: string } | string | null): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  return (role || '').toLowerCase() === 'admin';
}

export function isCashier(userOrRole?: { role?: string } | string | null): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  return ['caisse', 'caissier'].includes((role || '').toLowerCase());
}

export function isBarman(userOrRole?: { role?: string } | string | null): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  return ['water', 'barman'].includes((role || '').toLowerCase());
}

export function isHostess(userOrRole?: { role?: string } | string | null): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  return (role || '').toLowerCase() === 'hotesse';
}

export function isManager(userOrRole?: { role?: string } | string | null): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  return (role || '').toLowerCase() === 'manager';
}

/**
 * Filtre les onglets/sous-sections secondaires au sein d'un module en fonction du rôle :
 * - Barman : UNIQUEMENT l'onglet 'commandes'
 * - Caisse : UNIQUEMENT accessible pour l'administrateur ('admin'). Si l'utilisateur n'est pas admin, l'onglet 'caisse' est totalement exclu.
 * - Stock Manager : UNIQUEMENT l'onglet 'stock'
 * - Autres rôles non-admin : Tous les onglets sauf 'caisse'
 * - Admin : Tous les onglets
 */
export function filterTabsByRole<T extends { id: string }>(tabs: T[], userRole?: string): T[] {
  const role = userRole?.toLowerCase() || '';

  // 1. Si admin : accès à tous les onglets
  if (role === 'admin') {
    return tabs;
  }

  // Historique Bar et Inventaire réservés uniquement à l'admin.
  const visibleTabs = tabs.filter(t => t.id !== 'historique' && t.id !== 'historique-produits' && t.id !== 'inventory');

  // 2. Barman : UNIQUEMENT l'onglet commandes
  if (role === 'water' || role === 'barman' || role === 'hotesse') {
    return visibleTabs.filter(t => t.id === 'commandes');
  }

  if (role === 'caisse' || role === 'caissier') {
    return visibleTabs.filter(t => t.id === 'caisse' || t.id.includes('caisse') || t.id === 'commandes' || t.id === 'rapports');
  }

  // 3. Si non-admin : exclure systématiquement les onglets de caisse
  const nonCaisseTabs = visibleTabs.filter(t => t.id !== 'caisse' && !t.id.includes('caisse'));

  // 4. Stock Manager : restreindre uniquement au stock (pas d'inventaire)
  if (role === 'stock_manager') {
    const stockTabs = nonCaisseTabs.filter(t => t.id === 'stock' || t.id.includes('stock'));
    return stockTabs.length > 0 ? stockTabs : nonCaisseTabs;
  }

  return nonCaisseTabs;
}

/**
 * Retourne l'onglet par défaut d'un module selon le rôle de l'utilisateur
 */
export function getDefaultTabForRole(defaultTab: string, userRole?: string): string {
  const role = userRole?.toLowerCase() || '';
  if (role === 'water' || role === 'barman' || role === 'hotesse') return 'commandes';
  if (role === 'caisse' || role === 'caissier') return 'caisse';
  if (role === 'stock_manager') return 'stock';
  if (role !== 'admin' && (defaultTab === 'caisse' || defaultTab.includes('caisse'))) {
    return 'stock';
  }
  return defaultTab;
}

/**
 * Retourne la première route accessible par l'utilisateur lors de la connexion.
 * Pour un manager ou un autre rôle, redirige vers son premier module autorisé plutôt que le dashboard global.
 */
export function getDefaultRoute(user: { role: string; module?: string[] | any } | null): string {
  if (!user) return '/';

  const role = user.role?.toLowerCase() || '';

  if (role === 'admin') return '/dashboard';

  const modules = parseUserModules(user.module);
  if (modules.length > 0) {
    // Rediriger vers le premier module assigné valide
    const firstMod = modules[0];
    return `/${firstMod}`;
  }

  // Replis par défaut selon le rôle
  switch (role) {
    case 'water':
    case 'barman':
    case 'hotesse':
      return '/bar';
    case 'croupier':
      return '/casino';
    case 'caissier':
    case 'caisse':
      return '/finances';
    case 'stock_manager':
      return '/restaurant';
    case 'receptioniste':
      return '/hotel';
    case 'housekeeping':
      return '/hotel';
    default:
      return '/dashboard';
  }
}
