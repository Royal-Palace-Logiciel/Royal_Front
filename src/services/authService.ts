// src/services/authService.ts
import api from "../lib/api";

// ----------------------------------------------------------------------
// Rôles utilisateur (correspond à la table users)
// ----------------------------------------------------------------------
export const UserRole = {
  ADMIN: "admin",
  MANAGER: "manager",
  RECEPTIONIST: "receptioniste",
  CASHIER: "caisse",
  WAITER: "water",
  HOUSEKEEPING: "housekeeping",
  CROUPIER: "croupier",
  HOSTESS: "hotesse",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

// ----------------------------------------------------------------------
// Validation du mot de passe
// ----------------------------------------------------------------------
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_VALIDATION_ERRORS = {
  EMPTY: "Le mot de passe ne peut pas être vide",
  TOO_SHORT: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`,
};

interface PasswordValidationResult {
  valid: boolean;
  error: string | null;
}

const validatePassword = (password: string | null | undefined): PasswordValidationResult => {
  if (!password || password.trim().length === 0) {
    return { valid: false, error: PASSWORD_VALIDATION_ERRORS.EMPTY };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: PASSWORD_VALIDATION_ERRORS.TOO_SHORT };
  }
  return { valid: true, error: null };
};

// ----------------------------------------------------------------------
// Interface utilisateur
// ----------------------------------------------------------------------
export interface User {
  id: number;
  id_admin?: number;
  nom: string;
  prenom?: string;
  email: string;
  role: UserRoleType;
  actif: boolean;
  module?: string[];
  statut?: string;
  created_at?: string;
  date_creation?: string;
  updated_at?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  user?: T;
  token?: string;
  refreshToken?: string;
  refresh_token?: string;
  redirectTo?: string;
  error?: string;
}

// ----------------------------------------------------------------------
// Stockage sécurisé
// ----------------------------------------------------------------------
class SecureStorage {
  static setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      sessionStorage.setItem(key, value);
    }
  }

  static getItem(key: string): string | null {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  }

  static removeItem(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  static clear(): void {
    localStorage.clear();
    sessionStorage.clear();
  }
}

// ----------------------------------------------------------------------
// AuthService
// ----------------------------------------------------------------------
class AuthService {
  // Fonction utilitaire robuste pour parser les modules peu importe leur format (JSON, tableau, string)
  static parseModules(mod: any): string[] {
    if (!mod) return [];
    if (Array.isArray(mod)) {
      return mod.map(m => (typeof m === 'object' && m !== null ? m.id : String(m))).filter(Boolean);
    }
    if (typeof mod === 'string') {
      try {
        const parsed = JSON.parse(mod);
        if (Array.isArray(parsed)) {
          return parsed.map(m => (typeof m === 'object' && m !== null ? m.id : String(m))).filter(Boolean);
        }
      } catch {
        return mod.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  static async login(email: string, mot_de_passe: string): Promise<{ user: User; token: string }> {
    try {
      const response = await api.post("/api/auth/login", {
        email,
        mot_de_passe,
        password: mot_de_passe
      });

      const resData = response.data;
      const dataContainer = resData.data || resData;

      const token = resData.token || dataContainer.token;
      const user = resData.user || dataContainer.user || dataContainer.data;
      const refreshToken = resData.refreshToken || dataContainer.refreshToken || dataContainer.refresh_token;

      if (resData.success === false || dataContainer.success === false) {
        throw new Error(resData.error || resData.message || dataContainer.error || dataContainer.message || "Échec de la connexion");
      }

      if (!user || !token) {
        throw new Error("Données de connexion incomplètes reçues du serveur.");
      }

      const mappedUser: User = {
        id: user.id_admin || user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        actif: user.statut === 'actif' || user.actif === true,
        module: this.parseModules(user.module),
        created_at: user.date_creation || user.created_at,
        updated_at: user.updated_at,
      };

      this.setAuthData(mappedUser, token, refreshToken);
      return { user: mappedUser, token };
    } catch (error: any) {
      throw this.handleError(error, "Erreur lors de la connexion");
    }
  }

  static async register(userData: {
    nom: string;
    prenom?: string;
    email: string;
    mot_de_passe: string;
    role?: string;
    module?: string[];
    actif?: boolean;
  }): Promise<any> {
    try {
      const response = await api.post("/api/auth/register", {
        ...userData,
        password: userData.mot_de_passe
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, "Erreur lors de l'inscription");
    }
  }

  static async logout(): Promise<void> {
    try {
      const refreshToken = SecureStorage.getItem("refresh-token");
      if (refreshToken) {
        await api.post("/api/auth/logout", { refreshToken }).catch(() => { });
      }
    } finally {
      SecureStorage.clear();
      window.dispatchEvent(new Event("auth-change"));
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
  }

  static async refreshToken(): Promise<string> {
    const refreshToken = SecureStorage.getItem("refresh-token");
    if (!refreshToken) {
      throw new Error("Aucun refresh token disponible");
    }
    try {
      console.log("🔄 Rafraîchissement du token...");
      const response = await api.post("/api/auth/refresh-token", { refreshToken });
      const data = response.data as ApiResponse;
      const newToken = data.token || data.data?.token;
      if (!newToken) {
        throw new Error(data.error || "Échec du rafraîchissement");
      }
      SecureStorage.setItem("auth-token", newToken);
      return newToken;
    } catch (error: any) {
      this.logout();
      throw error;
    }
  }

  static async getProfile(): Promise<User> {
    try {
      const response = await api.get("/api/auth/me");
      const data = response.data as ApiResponse<User>;
      const profileUser = data.user || data.data;
      if (!data.success || !profileUser) {
        throw new Error(data.message || "Profil non trouvé");
      }
      return profileUser;
    } catch (error: any) {
      throw this.handleError(error, "Erreur lors du chargement du profil");
    }
  }

  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      throw new Error(validation.error!);
    }
    try {
      const response = await api.post("/api/auth/change-password", {
        oldPassword,
        newPassword,
      });
      const data = response.data as ApiResponse;
      if (!data.success) {
        throw new Error(data.error || "Échec du changement de mot de passe");
      }
    } catch (error: any) {
      throw this.handleError(error, "Erreur lors du changement de mot de passe");
    }
  }

  static async getConnectionHistory(page = 1, limit = 20): Promise<{ data: any[]; meta?: { page: number; limit: number; total: number } }> {
    try {
      const response = await api.get("/api/auth/connection-history", { params: { page, limit } });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error, "Erreur lors du chargement de l'historique de connexion");
    }
  }

  private static setAuthData(user: User, token: string, refreshToken?: string): void {
    SecureStorage.setItem("auth-token", token);
    if (refreshToken) {
      SecureStorage.setItem("refresh-token", refreshToken);
    }
    SecureStorage.setItem("user-data", JSON.stringify(user));
    window.dispatchEvent(new Event("auth-change"));
  }

  static getCurrentUser(): User | null {
    try {
      const data = SecureStorage.getItem("user-data");
      if (!data) return null;
      const user = JSON.parse(data) as User;
      return {
        id: user.id_admin || user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        actif: user.statut === 'actif' || user.actif,
        module: this.parseModules(user.module),
        created_at: user.date_creation || user.created_at,
        updated_at: user.updated_at,
      };
    } catch {
      return null;
    }
  }

  static getToken(): string | null {
    return SecureStorage.getItem("auth-token");
  }

  static isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  static hasRole(requiredRole: UserRoleType | UserRoleType[]): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(user.role);
  }

  static getRedirectPath(): string {
    const user = this.getCurrentUser();
    if (!user) return "/login";

    const role = user.role?.toLowerCase();
    if (role === 'admin') {
      return "/dashboard";
    }

    if (user.module && Array.isArray(user.module) && user.module.length > 0) {
      return `/${user.module[0]}`;
    }

    switch (role) {
      case 'caissier':
      case 'caisse':
        return "/finances";
      case 'stock_manager':
        return "/restaurant";
      case 'receptioniste':
        return "/hotel";
      case 'water':
      case 'hotesse':
        return "/bar";
      case 'housekeeping':
        return "/hotel";
      default:
        return "/dashboard";
    }
  }

  private static handleError(error: any, defaultMessage: string): Error {
    if (error.code === "ERR_NETWORK") {
      return new Error("Impossible de se connecter au serveur. Vérifiez que le backend est démarré sur le port 4000.");
    }
    const resData = error.response?.data;
    if (resData) {
      const errField = resData.error || resData.message;
      if (errField) {
        if (typeof errField === 'string') return new Error(errField);
        if (typeof errField === 'object') {
          const values = Object.values(errField).flat();
          return new Error(values.join(', ') || JSON.stringify(errField));
        }
      }
    }
    switch (error.response?.status) {
      case 401:
        return new Error("Identifiants invalides ou mot de passe incorrect.");
      case 403:
        return new Error("Accès interdit.");
      default:
        return new Error(error.message || defaultMessage);
    }
  }
}

export default AuthService;
