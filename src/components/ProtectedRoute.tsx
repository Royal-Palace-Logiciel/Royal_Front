// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AuthService from '../services/authService';
import { canAccessModule, getDefaultRoute } from '../utils/permissions';

// ─────────────────────────────────────────────
// Page 403 — Accès interdit (inline, pas de fichier séparé)
// ─────────────────────────────────────────────
const ForbiddenPage: React.FC<{ redirectTo: string }> = ({ redirectTo }) => {
  const [countdown, setCountdown] = React.useState(5);

  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  if (countdown === 0) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg, #0a0a0f)',
        padding: '2rem',
        gap: '1.5rem',
        textAlign: 'center',
      }}
    >
      {/* Icône */}
      <div
        style={{
          width: '96px',
          height: '96px',
          borderRadius: '24px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
        }}
      >
        🔒
      </div>

      {/* Code erreur */}
      <div style={{ color: 'rgba(239, 68, 68, 0.7)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Erreur 403
      </div>

      {/* Titre */}
      <h1
        style={{
          color: 'var(--color-primary, #f1f1f1)',
          fontSize: '2rem',
          fontWeight: 700,
          margin: 0,
          fontFamily: 'Playfair Display, Georgia, serif',
        }}
      >
        Accès interdit
      </h1>

      {/* Description */}
      <p style={{ color: 'var(--color-muted, #888)', maxWidth: '420px', lineHeight: 1.6, margin: 0 }}>
        Vous n'êtes pas autorisé à accéder à cette section. Votre profil ne dispose pas des droits nécessaires pour ce module.
      </p>

      {/* Countdown */}
      <div
        style={{
          padding: '12px 24px',
          borderRadius: '12px',
          backgroundColor: 'var(--color-surface-2, #1a1a2e)',
          border: '1px solid var(--color-border, #2a2a3e)',
          color: 'var(--color-muted, #888)',
          fontSize: '14px',
        }}
      >
        Redirection automatique dans{' '}
        <span style={{ color: 'var(--color-accent, #d4af37)', fontWeight: 700 }}>
          {countdown}s
        </span>
      </div>

      {/* Bouton retour immédiat */}
      <a
        href={redirectTo}
        style={{
          padding: '10px 28px',
          borderRadius: '12px',
          backgroundColor: 'var(--color-accent, #d4af37)',
          color: '#000',
          fontWeight: 600,
          fontSize: '14px',
          textDecoration: 'none',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => ((e.target as HTMLElement).style.opacity = '0.85')}
        onMouseLeave={e => ((e.target as HTMLElement).style.opacity = '1')}
      >
        Retour maintenant
      </a>
    </div>
  );
};

// ─────────────────────────────────────────────
// Props du ProtectedRoute
// ─────────────────────────────────────────────
interface ProtectedRouteProps {
  /** Rôles autorisés à accéder à ce groupe de routes. */
  allowedRoles?: string[];
  /**
   * ID du module protégé. Si fourni, la vérification canAccessModule est effectuée
   * en plus de la vérification de rôle.
   */
  moduleId?: string;
}

// ─────────────────────────────────────────────
// ProtectedRoute
// ─────────────────────────────────────────────
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, moduleId }) => {
  const location = useLocation();
  const currentUser = AuthService.getCurrentUser();
  const isAuthenticated = AuthService.isAuthenticated();

  // 1. Non authentifié → redirection vers la page de login
  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 2. Vérification du rôle (si allowedRoles est fourni)
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = AuthService.hasRole(allowedRoles as any);
    if (!hasRole) {
      const redirectTo = getDefaultRoute(currentUser);
      return <ForbiddenPage redirectTo={redirectTo} />;
    }
  }

  // 3. Vérification de l'accès au module spécifique (si moduleId est fourni)
  if (moduleId) {
    // Les rôles autorisés pour ce module (si non précisés, on accepte tous les rôles)
    const moduleroles = allowedRoles ?? ['admin', 'manager', 'caissier', 'stock_manager'];
    const hasModuleAccess = canAccessModule(currentUser, moduleId, moduleroles);
    if (!hasModuleAccess) {
      const redirectTo = getDefaultRoute(currentUser);
      return <ForbiddenPage redirectTo={redirectTo} />;
    }
  }

  // 4. Accès autorisé → rendre les routes enfants
  return <Outlet />;
};

export default ProtectedRoute;