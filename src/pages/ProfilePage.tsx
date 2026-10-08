import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Calendar, Clock, Edit3, CheckCircle, XCircle } from 'lucide-react';
import AuthService from '../services/authService';
import { User as UserType } from '../services/authService';

const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First try to get current user from local storage
      const currentUser = AuthService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
      
      // Then try to fetch fresh data from API
      try {
        const freshUser = await AuthService.getProfile();
        // Map backend field names to frontend interface
        const mappedUser = {
          id: freshUser.id_admin || freshUser.id,
          nom: freshUser.nom,
          prenom: freshUser.prenom,
          email: freshUser.email,
          role: freshUser.role,
          actif: freshUser.statut === 'actif' || freshUser.actif,
          created_at: freshUser.date_creation || freshUser.created_at,
          updated_at: freshUser.updated_at,
        };
        setUser(mappedUser);
      } catch (apiError) {
        console.warn('Could not fetch fresh profile data, using cached data');
        // If API fails, we still have the cached user data
      }
    } catch (err) {
      setError('Erreur lors du chargement du profil');
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: 'Administrateur',
      manager: 'Manager',
      receptioniste: 'Réceptionniste',
      caisse: 'Caissier',
      water: 'Serveur',
      hotesse: 'Hôtesse',
      housekeeping: 'Ménage',
    };
    return roleLabels[role] || role;
  };

  const getRoleColor = (role: string) => {
    const roleColors: Record<string, string> = {
      admin: 'var(--color-danger)',
      manager: 'var(--color-accent)',
      receptioniste: 'var(--color-info)',
      caisse: 'var(--color-success)',
      water: 'var(--color-primary)',
      hotesse: 'var(--color-accent)',
      housekeeping: 'var(--color-muted)',
    };
    return roleColors[role] || 'var(--color-muted)';
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full mx-auto mb-4 animate-spin"
            style={{
              border: '3px solid var(--color-surface-2)',
              borderTopColor: 'var(--color-accent)',
            }}
          />
          <p className="text-muted text-sm">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-center">
          <XCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--color-danger)' }} />
          <p className="text-primary font-medium mb-2">Erreur de chargement</p>
          <p className="text-muted text-sm mb-4">{error || 'Aucune donnée utilisateur disponible'}</p>
          <button
            onClick={loadUserProfile}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'black',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="w-full">
        <h2 className="text-primary text-2xl font-bold mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          Mon Profil
        </h2>
        <p className="text-muted text-sm">Informations de votre compte utilisateur</p>
      </div>

      {/* Profile Card */}
      <div 
        className="rounded-2xl p-6 w-full"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Avatar Section */}
        <div className="flex items-center gap-6 mb-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: 'var(--color-accent)',
              boxShadow: 'var(--shadow-accent)',
            }}
          >
            <span className="text-black font-bold text-2xl">
              {user.prenom?.[0] || 'U'}{user.nom?.[0] || 'S'}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-primary font-semibold text-xl mb-1">
              {user.prenom} {user.nom}
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  color: getRoleColor(user.role),
                  border: '1px solid var(--color-border)',
                }}
              >
                <Shield size={12} className="inline mr-1" />
                {getRoleLabel(user.role)}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1"
                style={{
                  backgroundColor: user.actif ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  color: user.actif ? 'var(--color-success)' : 'var(--color-danger)',
                  border: `1px solid ${user.actif ? 'var(--color-success)' : 'var(--color-danger)'}`,
                }}
              >
                {user.actif ? <CheckCircle size={12} /> : <XCircle size={12} />}
                {user.actif ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <p className="text-muted text-sm">ID: #{user.id}</p>
          </div>
        </div>

        {/* Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email */}
          <div
            className="p-4 rounded-xl"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Mail size={16} className="text-muted" />
              <span className="text-muted text-xs font-medium uppercase tracking-wide">Email</span>
            </div>
            <p className="text-primary font-medium">{user.email}</p>
          </div>

          {/* Name */}
          <div
            className="p-4 rounded-xl"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <User size={16} className="text-muted" />
              <span className="text-muted text-xs font-medium uppercase tracking-wide">Nom complet</span>
            </div>
            <p className="text-primary font-medium">{user.nom} {user.prenom}</p>
          </div>

          {/* Role */}
          <div
            className="p-4 rounded-xl"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Shield size={16} className="text-muted" />
              <span className="text-muted text-xs font-medium uppercase tracking-wide">Rôle</span>
            </div>
            <p 
              className="font-medium"
              style={{ color: getRoleColor(user.role) }}
            >
              {getRoleLabel(user.role)}
            </p>
          </div>

          {/* Status */}
          <div
            className="p-4 rounded-xl"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              {user.actif ? <CheckCircle size={16} className="text-muted" /> : <XCircle size={16} className="text-muted" />}
              <span className="text-muted text-xs font-medium uppercase tracking-wide">Statut</span>
            </div>
            <p 
              className="font-medium"
              style={{ color: user.actif ? 'var(--color-success)' : 'var(--color-danger)' }}
            >
              {user.actif ? 'Actif' : 'Inactif'}
            </p>
          </div>

          {/* Created Date */}
          {user.created_at && (
            <div
              className="p-4 rounded-xl"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Calendar size={16} className="text-muted" />
                <span className="text-muted text-xs font-medium uppercase tracking-wide">Date de création</span>
              </div>
              <p className="text-primary font-medium">
                {new Date(user.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}

          {/* Updated Date */}
          {user.updated_at && (
            <div
              className="p-4 rounded-xl"
              style={{
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Clock size={16} className="text-muted" />
                <span className="text-muted text-xs font-medium uppercase tracking-wide">Dernière mise à jour</span>
              </div>
              <p className="text-primary font-medium">
                {new Date(user.updated_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={loadUserProfile}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
            }}
          >
            <Edit3 size={14} />
            Actualiser les informations
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
