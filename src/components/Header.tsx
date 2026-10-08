// src/components/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronRight, X, LogOut, User, Settings, ChevronDown, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthService from '../services/authService'; // ← Import du service
import api from '../lib/api';
import { useHDA } from '../context/HDAContext'; // Gardé uniquement pour les notifications
import { generateNotifications } from '../services/notificationService';
import logo from '../assets/logo_s.png';

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Tableau de Bord',
  '/hebergement': 'Hébergement',
  '/hotel': 'Hôtel',
  '/restaurant': 'Restaurant',
  '/bar': 'Bar & Lounge',
  '/alcool': 'Alcool',
  '/casino': 'Casino',
  '/planning': 'Planning',
  '/finances': 'Finances',
  '/clients': 'Clients',
  '/utilisateurs': 'Utilisateurs',
  '/profile': 'Mon profil',
  '/settings': 'Paramètres',
};

const NOTIFICATION_COLORS = {
  warning: { bg: 'var(--color-accent-4)', text: 'var(--color-accent)', dot: 'var(--color-accent)' },
  error: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger)', dot: 'var(--color-danger)' },
  success: { bg: 'var(--color-success-bg)', text: 'var(--color-success)', dot: 'var(--color-success)' },
  info: { bg: 'var(--color-info-bg)', text: 'var(--color-info)', dot: 'var(--color-info)' },
};

export const Header: React.FC = () => {
  // On garde le contexte HDA seulement pour les notifications
  const { state, dispatch } = useHDA();
  const { notifications } = state;

  const navigate = useNavigate();
  const location = useLocation();

  // Récupération initiale de l'utilisateur connecté
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());

  // Écouter les changements d'authentification (login/logout)
  useEffect(() => {
    const updateUser = () => setCurrentUser(AuthService.getCurrentUser());
    window.addEventListener('auth-change', updateUser);
    return () => window.removeEventListener('auth-change', updateUser);
  }, []);

  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Gestion du click outside pour les deux dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Présence en ligne : signale au serveur que l'utilisateur est toujours connecté,
  // même s'il reste sur une page sans faire de requête.
  useEffect(() => {
    if (!currentUser) return;
    const sendHeartbeat = () => { api.post('/api/auth/heartbeat').catch(() => { }); };
    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 60000);
    return () => window.clearInterval(interval);
  }, [currentUser]);

  // Load notifications on mount and periodically refresh
  useEffect(() => {
    loadNotifications();
    
    // Refresh notifications every 2 minutes
    const interval = setInterval(() => {
      loadNotifications();
    }, 120000); // 2 minutes
    
    return () => clearInterval(interval);
  }, []);

  // For testing: add a sample notification if empty after initial load
  useEffect(() => {
    if (notifications.length === 0 && !loadingNotifs) {
      const timer = setTimeout(() => {
        if (notifications.length === 0) {
          // Add a welcome notification for testing
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            payload: { 
              type: 'info', 
              message: 'Système de notifications actif - Cliquez sur la cloche pour voir les alertes',
              source: 'Système',
              actionUrl: '/dashboard'
            } 
          });
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notifications.length, loadingNotifs, dispatch]);

  // Load notifications function
  const loadNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const notifs = await generateNotifications();
      dispatch({ type: 'SET_NOTIFICATIONS', payload: notifs });
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoadingNotifs(false);
    }
  };

  // Déconnexion via AuthService
  const handleLogout = () => {
    AuthService.logout();
    setShowUserMenu(false);
  };

  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dateStr = clock.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = clock.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const currentPage = ROUTE_LABELS[location.pathname] || 'Tableau de Bord';

  // Si pas d'utilisateur connecté (par exemple, après logout ou refresh), on ne rend pas le header
  if (!currentUser) {
    return null;
  }

  return (
    <header
      className="h-16 flex items-center px-4 md:px-6 sticky top-0 z-40 gap-4 w-full max-w-full overflow-visible"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Date et heure centrées dans la Top Bar */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap lg:flex">
        <span className="text-xs font-semibold lowercase tracking-wide text-secondary">{dateStr}</span>
        <span className="text-xs font-medium tabular-nums text-subtle">{timeStr}</span>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <div
          className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mr-1 overflow-hidden"
          style={{
            boxShadow: 'var(--shadow-accent)',
          }}
        >
          <img
            src={logo}
            alt="HDA"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
        <span className="text-muted text-xs hidden sm:block flex-shrink-0">HDA</span>
        <ChevronRight size={12} className="text-subtle hidden sm:block flex-shrink-0" />
        <span className="text-primary font-semibold text-sm truncate">
          {currentPage}
        </span>
      </div>



      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifs(!showNotifs);
              setShowUserMenu(false);
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all relative"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              color: 'var(--color-muted)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-3)';
              e.currentTarget.style.color = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
              e.currentTarget.style.color = 'var(--color-muted)';
            }}
          >
            <Bell size={16} />
            {notifications.length > 0 && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2"
                style={{
                  backgroundColor: 'var(--color-accent)',
                }}
              />
            )}
          </button>

          {/* Dropdown Notifications */}
          {showNotifs && (
            <div
              className="absolute right-0 top-11 w-72 sm:w-80 rounded-2xl shadow-xl overflow-hidden"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 9999,
                position: 'absolute',
                maxHeight: '400px',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <h3 className="text-primary font-semibold text-xs">Alertes</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{notifications.length} non lues</span>
                  <button
                    onClick={loadNotifications}
                    className="text-muted hover:text-primary transition-colors"
                    disabled={loadingNotifs}
                    title="Actualiser"
                  >
                    <RefreshCw size={12} className={loadingNotifs ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-5 text-center text-muted text-xs">Aucune alerte</div>
                ) : (
                  <>
                    {notifications.map((notif) => {
                    const colors = NOTIFICATION_COLORS[notif.type] || NOTIFICATION_COLORS.info;
                    return (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${notif.actionUrl ? 'cursor-pointer' : ''}`}
                        style={{
                          borderBottom: '1px solid var(--color-surface-2)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        onClick={() => {
                          if (notif.actionUrl) {
                            navigate(notif.actionUrl);
                            setShowNotifs(false);
                          }
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                          style={{ backgroundColor: colors.dot }}
                        />
                        <div className="flex-1">
                          <p className="text-xs font-medium" style={{ color: colors.text }}>
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-subtle text-[10px]">
                              {new Date(notif.timestamp).toLocaleTimeString('fr-FR')}
                            </p>
                            {notif.source && (
                              <span className="text-[10px] text-muted">• {notif.source}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch({ type: 'CLEAR_NOTIFICATION', payload: notif.id });
                          }}
                          className="text-subtle hover:text-primary transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar avec menu utilisateur */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifs(false);
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all"
            style={{
              backgroundColor: showUserMenu ? 'var(--color-surface-3)' : 'transparent',
              border: '1px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (!showUserMenu) {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showUserMenu) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-opacity shadow-sm flex-shrink-0"
              style={{
                backgroundColor: 'var(--color-accent)',
                boxShadow: 'var(--shadow-accent)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.85';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.boxShadow = 'var(--shadow-accent)';
              }}
            >
              <span className="text-black font-bold text-xs">
                {currentUser.prenom?.[0] || 'U'}{currentUser.nom?.[0] || 'S'}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-muted transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown Menu Utilisateur */}
          {showUserMenu && (
            <div
              className="absolute right-0 top-12 w-56 rounded-2xl shadow-xl overflow-hidden"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 9999,
                position: 'absolute',
              }}
            >
              {/* En-tête utilisateur */}
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      boxShadow: 'var(--shadow-accent)',
                    }}
                  >
                    <span className="text-black font-bold text-sm">
                      {currentUser.prenom?.[0] || 'U'}{currentUser.nom?.[0] || 'S'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-primary font-medium text-sm truncate">
                      {currentUser.prenom} {currentUser.nom}
                    </p>
                    <p className="text-muted text-xs truncate">{currentUser.email}</p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                {/* Profil */}
                <button
                  onClick={() => {
                    navigate('/profile');
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{
                    color: 'var(--color-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-secondary)';
                  }}
                >
                  <User size={16} className="text-muted" />
                  <span>Mon profil</span>
                </button>

                {/* Paramètres */}
                <button
                  onClick={() => {
                    navigate('/settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{
                    color: 'var(--color-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-secondary)';
                  }}
                >
                  <Settings size={16} className="text-muted" />
                  <span>Paramètres</span>
                </button>

                {/* Séparateur */}
                <div
                  className="my-1 mx-4"
                  style={{ borderTop: '1px solid var(--color-border)' }}
                />

                {/* Déconnexion */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{
                    color: 'var(--color-danger)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <LogOut size={16} />
                  <span>Se déconnecter</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
