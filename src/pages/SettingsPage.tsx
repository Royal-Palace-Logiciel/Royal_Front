import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Lock, Bell, X, Check, AlertCircle, LogIn, LogOut, Clock, Shield, Info, User } from 'lucide-react';
import AuthService from '../services/authService';

interface SettingsItem {
  label: string;
  action: string;
  onClick?: () => void;
}

interface SettingsCategory {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: SettingsItem[];
}

const SettingsPage: React.FC = () => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [connectionHistory, setConnectionHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
  });


  useEffect(() => {
    // Load notification settings from localStorage
    const savedSettings = localStorage.getItem('notification-settings');
    if (savedSettings) {
      setNotificationSettings(JSON.parse(savedSettings));
    }
  }, []);

  const saveNotificationSettings = (settings: typeof notificationSettings) => {
    setNotificationSettings(settings);
    localStorage.setItem('notification-settings', JSON.stringify(settings));
  };



  const loadConnectionHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError('');
      const response = await AuthService.getConnectionHistory(1, 20);
      setConnectionHistory(response.data || []);
      setShowHistoryModal(true);
    } catch (error: any) {
      setHistoryError(error.message || 'Erreur lors du chargement de l\'historique');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('Tous les champs sont requis');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setIsChangingPassword(true);
      await AuthService.changePassword(passwordData.oldPassword, passwordData.newPassword);
      setPasswordSuccess('Mot de passe changé avec succès');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error: any) {
      setPasswordError(error.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const settingsCategories: SettingsCategory[] = [
    {
      title: 'Sécurité',
      description: 'Gérer votre mot de passe et la sécurité du compte',
      icon: <Lock size={20} className="text-black" />,
      items: [
        { 
          label: 'Changer le mot de passe', 
          action: 'Modifier',
          onClick: () => setShowPasswordModal(true)
        },
        { 
          label: 'Historique de connexion', 
          action: 'Voir',
          onClick: loadConnectionHistory
        },
      ],
    },
    {
      title: 'Notifications',
      description: 'Configurer les alertes et notifications',
      icon: <Bell size={20} className="text-black" />,
      items: [
        { 
          label: 'Notifications email', 
          action: notificationSettings.emailNotifications ? 'Activé' : 'Désactivé',
          onClick: () => setShowNotificationsModal(true)
        },
        { 
          label: 'Notifications push', 
          action: notificationSettings.pushNotifications ? 'Activé' : 'Désactivé',
          onClick: () => setShowNotificationsModal(true)
        },
      ],
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="w-full">
        <h2 className="text-primary text-2xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          Paramètres
        </h2>
        <p className="text-muted text-sm">Configurez vos préférences et paramètres de compte</p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {settingsCategories.map((category, index) => (
          <div
            key={index}
            className="rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Category Header */}
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  boxShadow: 'var(--shadow-accent)',
                }}
              >
                {category.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-primary font-semibold mb-1">{category.title}</h3>
                <p className="text-muted text-xs">{category.description}</p>
              </div>
            </div>

            {/* Category Items */}
            <div className="space-y-2">
              {category.items.map((item, itemIndex) => (
                <button
                  key={itemIndex}
                  onClick={item.onClick}
                  disabled={!item.onClick}
                  className="w-full flex items-center justify-between p-3 rounded-lg transition-all"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    cursor: item.onClick ? 'pointer' : 'default',
                    opacity: item.onClick ? '1' : '0.7',
                  }}
                  onMouseEnter={(e) => {
                    if (item.onClick) {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                  }}
                >
                  <span className="text-primary text-sm font-medium">{item.label}</span>
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: item.onClick ? 'var(--color-accent)' : 'var(--color-surface-3)',
                      color: item.onClick ? 'black' : 'var(--color-muted)',
                    }}
                  >
                    {item.action}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div
        className="p-5 rounded-2xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <SettingsIcon size={20} className="text-muted" />
          <h3 className="text-primary font-semibold">Informations système</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-muted text-xs mb-1">Version</p>
            <p className="text-primary text-sm font-medium">1.0.0</p>
          </div>
          <div>
            <p className="text-muted text-xs mb-1">Environnement</p>
            <p className="text-primary text-sm font-medium">Production</p>
          </div>
          <div>
            <p className="text-muted text-xs mb-1">Dernière mise à jour</p>
            <p className="text-primary text-sm font-medium">12 Août 2026</p>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-md"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    boxShadow: 'var(--shadow-accent)',
                  }}
                >
                  <Lock size={20} className="text-black" />
                </div>
                <h3 className="text-primary font-semibold text-lg">Changer le mot de passe</h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--color-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Success Message */}
            {passwordSuccess && (
              <div
                className="p-3 rounded-xl mb-4 flex items-center gap-3"
                style={{
                  backgroundColor: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success)',
                }}
              >
                <Check size={20} className="text-success flex-shrink-0" />
                <p className="text-success text-sm">{passwordSuccess}</p>
              </div>
            )}

            {/* Error Message */}
            {passwordError && (
              <div
                className="p-3 rounded-xl mb-4 flex items-center gap-3"
                style={{
                  backgroundColor: 'var(--color-danger-bg)',
                  border: '1px solid var(--color-danger)',
                }}
              >
                <AlertCircle size={20} className="text-danger flex-shrink-0" />
                <p className="text-danger text-sm">{passwordError}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="text-primary text-sm font-medium mb-2 block">
                  Mot de passe actuel
                </label>
                <input
                  type="password"
                  value={passwordData.oldPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-primary)',
                  }}
                  placeholder="Entrez votre mot de passe actuel"
                  disabled={isChangingPassword}
                />
              </div>

              <div>
                <label className="text-primary text-sm font-medium mb-2 block">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-primary)',
                  }}
                  placeholder="Entrez votre nouveau mot de passe"
                  disabled={isChangingPassword}
                />
              </div>

              <div>
                <label className="text-primary text-sm font-medium mb-2 block">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-primary)',
                  }}
                  placeholder="Confirmez votre nouveau mot de passe"
                  disabled={isChangingPassword}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={isChangingPassword}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-primary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'black',
                    opacity: isChangingPassword ? '0.7' : '1',
                  }}
                  onMouseEnter={(e) => {
                    if (!isChangingPassword) {
                      e.currentTarget.style.opacity = '0.9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = isChangingPassword ? '0.7' : '1';
                  }}
                >
                  {isChangingPassword ? 'Changement...' : 'Changer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connection History Modal */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    boxShadow: 'var(--shadow-accent)',
                  }}
                >
                  <Clock size={20} className="text-black" />
                </div>
                <h3 className="text-primary font-semibold text-lg">Historique de connexion</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--color-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {historyError && (
              <div
                className="p-3 rounded-xl mb-4 flex items-center gap-3"
                style={{
                  backgroundColor: 'var(--color-danger-bg)',
                  border: '1px solid var(--color-danger)',
                }}
              >
                <AlertCircle size={20} className="text-danger flex-shrink-0" />
                <p className="text-danger text-sm">{historyError}</p>
              </div>
            )}

            {/* Loading State */}
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div 
                  className="w-8 h-8 rounded-full animate-spin"
                  style={{
                    border: '3px solid var(--color-surface-2)',
                    borderTopColor: 'var(--color-accent)',
                  }}
                />
              </div>
            ) : (
              <>
                {/* History List */}
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                  {connectionHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock size={48} className="mx-auto mb-3" style={{ color: 'var(--color-muted)' }} />
                      <p className="text-muted text-sm">Aucun historique de connexion disponible</p>
                    </div>
                  ) : (
                    connectionHistory.map((log: any, index: number) => (
                      <div
                        key={log.id || index}
                        className="flex items-center justify-between p-4 rounded-xl"
                        style={{
                          backgroundColor: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: log.action === 'LOGIN' 
                                ? 'var(--color-success-bg)' 
                                : 'var(--color-danger-bg)',
                              color: log.action === 'LOGIN' 
                                ? 'var(--color-success)' 
                                : 'var(--color-danger)',
                            }}
                          >
                            {log.action === 'LOGIN' ? <LogIn size={20} /> : <LogOut size={20} />}
                          </div>
                          <div>
                            <p className="text-primary font-medium text-sm">
                              {log.action === 'LOGIN' ? 'Connexion' : 'Déconnexion'}
                            </p>
                            <p className="text-muted text-xs">
                              {new Date(log.created_at).toLocaleString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                        <span
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            backgroundColor: log.action === 'LOGIN' 
                              ? 'var(--color-success-bg)' 
                              : 'var(--color-danger-bg)',
                            color: log.action === 'LOGIN' 
                              ? 'var(--color-success)' 
                              : 'var(--color-danger)',
                          }}
                        >
                          {log.action === 'LOGIN' ? 'Réussi' : 'Sortie'}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-muted text-xs text-center">
                    {connectionHistory.length} entrées affichées
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotificationsModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowNotificationsModal(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-md"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    boxShadow: 'var(--shadow-accent)',
                  }}
                >
                  <Bell size={20} className="text-black" />
                </div>
                <h3 className="text-primary font-semibold text-lg">Paramètres de notification</h3>
              </div>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--color-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Notification Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                <div>
                  <p className="text-primary font-medium text-sm">Notifications email</p>
                  <p className="text-muted text-xs">Recevoir les notifications par email</p>
                </div>
                <button
                  onClick={() => saveNotificationSettings({ ...notificationSettings, emailNotifications: !notificationSettings.emailNotifications })}
                  className="w-12 h-6 rounded-full relative transition-colors"
                  style={{
                    backgroundColor: notificationSettings.emailNotifications ? 'var(--color-accent)' : 'var(--color-surface-3)',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full absolute top-0.5 transition-transform"
                    style={{
                      backgroundColor: 'white',
                      transform: notificationSettings.emailNotifications ? 'translateX(26px)' : 'translateX(2px)',
                    }}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                <div>
                  <p className="text-primary font-medium text-sm">Notifications push</p>
                  <p className="text-muted text-xs">Recevoir les notifications push</p>
                </div>
                <button
                  onClick={() => saveNotificationSettings({ ...notificationSettings, pushNotifications: !notificationSettings.pushNotifications })}
                  className="w-12 h-6 rounded-full relative transition-colors"
                  style={{
                    backgroundColor: notificationSettings.pushNotifications ? 'var(--color-accent)' : 'var(--color-surface-3)',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full absolute top-0.5 transition-transform"
                    style={{
                      backgroundColor: 'white',
                      transform: notificationSettings.pushNotifications ? 'translateX(26px)' : 'translateX(2px)',
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-6">
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;