// src/pages/UtilisateursPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useHDA } from '../context/HDAContext';
import { User, UserRole, ModuleType } from '../types';
import { formatDate } from '../utils/data';
import { Modal, Input, Select, Button, Badge } from '../components/UI';
import { Users, Plus, Edit2, Trash2, Shield, Eye, EyeOff, Key } from 'lucide-react';
import api from '../lib/api';
// import { clientService, Client } from '../services/client.service';

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  receptioniste: 'Réceptionniste',
  caisse: 'Caissier',
  water: 'Barman',
  housekeeping: 'Personnel d’entretien',
  croupier: 'Croupier',
  hotesse: 'Hôtesse',
};

const formRoleLabels: Record<string, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  receptioniste: 'Réceptionniste (accès à l\'hôtel et au bar)',
  caisse: 'Caissier (encaissement uniquement)',
  water: 'Barman',
  croupier: 'Croupier (accès au casino)',
  hotesse: 'Hôtesse (commandes du Bar uniquement)',
};

const roleIcons: Record<string, string> = {
  admin: '👑',
  manager: '🎯',
  receptioniste: '🛎️',
  caisse: '💰',
  water: '🍸',
  housekeeping: '🧹',
  croupier: '🎲',
  hotesse: '🛎️',
};

// Module labels for user interface display
// Note: 'hebergement' module removed as it's disabled in the main application
const moduleLabels: Record<string, string> = {
  hotel: 'Hôtel',
  planning: 'Planning',
  restaurant: 'Restaurant',
  bar: 'Bar',
  casino: 'Casino',
};

// Available modules for user role assignments
// Note: 'hebergement' removed as the accommodation feature is currently disabled
const allModules: ModuleType[] = ['hotel', 'restaurant', 'bar', 'casino', 'planning'];
// Cashiers are currently only assigned to bar module (can be extended)
const cashierModules: ModuleType[] = ['bar'];

const getApiErrorMessage = (error: any, fallback: string) => {
  const data = error?.response?.data;
  return data?.error?.message || data?.message || error?.message || fallback;
};

const parseModules = (mod: any): ModuleType[] => {
  if (!mod) return [];
  if (Array.isArray(mod)) {
    return mod.map(m => (typeof m === 'object' && m !== null ? m.id : String(m))) as ModuleType[];
  }
  if (typeof mod === 'string') {
    try {
      const parsed = JSON.parse(mod);
      if (Array.isArray(parsed)) {
        return parsed.map(m => (typeof m === 'object' && m !== null ? m.id : String(m))) as ModuleType[];
      }
    } catch {
      return mod.split(',').map(s => s.trim()).filter(Boolean) as ModuleType[];
    }
  }
  return [];
};

interface UserPresence {
  online: boolean;
  lastSeen: string | null;
  lastLogin: string | null;
}

const formatRelative = (iso: string | null) => {
  if (!iso) return null;
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return formatDate(iso);
};

export const UtilisateursPage: React.FC = () => {
  const { state, dispatch } = useHDA();
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, UserPresence>>({});
  const [onlineOnly, setOnlineOnly] = useState(false);
  // const [casinoPlayers, setCasinoPlayers] = useState<Client[]>([]);
  // const [showPlayerModal, setShowPlayerModal] = useState(false);
  // const [playerForm, setPlayerForm] = useState({ nom: '', prenom: '', telephone: '' });
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', role: 'manager' as UserRole,
    module: [] as ModuleType[], actif: true, password: ''
  });

  const fetchRealUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/admin/users', { params: { limit: 100 } });
      const rawUsers = response.data?.data;
      if (!Array.isArray(rawUsers)) {
        throw new Error('Réponse utilisateurs invalide');
      }

      const formattedUsers: User[] = rawUsers.map((u: any) => ({
        id: String(u.id_admin),
        nom: u.nom,
        prenom: u.prenom || '',
        email: u.email,
        role: (u.role || 'manager') as User['role'],
        module: parseModules(u.module),
        actif: u.statut === 'actif',
        createdAt: u.date_creation || new Date().toISOString(),
        lastLogin: u.last_login || null,
      }));
      dispatch({ type: 'SET_USERS', payload: formattedUsers });
    } catch (err: any) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible de charger les utilisateurs.'));
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  // const fetchCasinoPlayers = useCallback(async () => {
  //   try {
  //     setCasinoPlayers(await clientService.getClients({ is_casino_player: true }));
  //   } catch (err: any) {
  //     setErrorMessage(getApiErrorMessage(err, 'Impossible de charger les joueurs Casino.'));
  //   }
  // }, []);

  useEffect(() => {
    fetchRealUsers();
    // fetchCasinoPlayers();
  }, [fetchRealUsers]);

  // Statut en ligne : rafraîchi toutes les 30 secondes
  const fetchPresence = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/users-presence');
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setPresence(Object.fromEntries(rows.map((row: any) => [String(row.id_admin), {
        online: Boolean(row.online),
        lastSeen: row.last_seen || null,
        lastLogin: row.last_login || null,
      }])));
    } catch {
      // Statut en ligne indisponible : la liste des utilisateurs reste utilisable.
    }
  }, []);

  useEffect(() => {
    fetchPresence();
    const interval = window.setInterval(fetchPresence, 30000);
    return () => window.clearInterval(interval);
  }, [fetchPresence]);

  // const createCasinoPlayer = async () => {
  //   if (!playerForm.nom.trim()) {
  //     setErrorMessage('Le nom du joueur est requis.');
  //     return;
  //   }
  //   try {
  //     setIsSubmitting(true);
  //     setErrorMessage('');
  //     await clientService.createClient({
  //       nom: playerForm.nom.trim(),
  //       prenom: playerForm.prenom.trim() || undefined,
  //       telephone: playerForm.telephone.trim() || undefined,
  //       is_casino_player: true,
  //       statut: 'ACTIF',
  //     });
  //     setPlayerForm({ nom: '', prenom: '', telephone: '' });
  //     setShowPlayerModal(false);
  //     await fetchCasinoPlayers();
  //   } catch (err: any) {
  //     setErrorMessage(getApiErrorMessage(err, 'Impossible de créer le joueur.'));
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  const isOnline = (user: User) => Boolean(presence[String(user.id)]?.online);
  const filtered = state.users
    .filter(u => `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
    .filter(u => !onlineOnly || isOnline(u))
    .sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)));

  const openEdit = (user: User) => {
    setEditUser(user);
    setErrorMessage('');
    setForm({
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      module: parseModules(user.module),
      actif: user.actif,
      password: ''
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.nom || !form.prenom || !form.email) {
      setErrorMessage('Le nom, le prénom et l\'email sont requis');
      return;
    }
    if (!editUser && !form.password) {
      setErrorMessage('Le mot de passe est requis pour créer un compte');
      return;
    }

    // Validation : Règle des managers (au moins 1 module)
    if (form.role === 'manager') {
      const selectedMods = parseModules(form.module);
      if (selectedMods.length < 1) {
        setErrorMessage('Un manager doit obligatoirement gérer au moins 1 module.');
        return;
      }
    }

    // Validation for cashier role: must be assigned to valid cashier modules (bar, restaurant, hotel, casino)
    if (form.role === 'caisse') {
      const selectedCashierModules = parseModules(form.module);
      if (selectedCashierModules.length < 1 || selectedCashierModules.some(m => !['bar', 'restaurant', 'hotel', 'casino'].includes(m))) {
        setErrorMessage('Un caissier doit être affecté à au moins une caisse : Bar, Restaurant, Hôtel ou Casino.');
        return;
      }
    }

    if (form.role === 'water' && parseModules(form.module).length !== 1) {
      setErrorMessage('Un barman doit être affecté au module Bar.');
      return;
    }

    if (form.role === 'hotesse' && (parseModules(form.module).length !== 1 || parseModules(form.module)[0] !== 'bar')) {
      setErrorMessage('Une hôtesse est affectée uniquement au module Bar.');
      return;
    }

    if (form.role === 'receptioniste') {
      const receptionModules = parseModules(form.module);
      if (receptionModules.length < 1 || receptionModules.some(m => !['hotel', 'bar'].includes(m))) {
        setErrorMessage('Un réceptionniste doit être affecté au module Hôtel et/ou Bar.');
        return;
      }
    }

    if (form.role === 'croupier' && (parseModules(form.module).length !== 1 || parseModules(form.module)[0] !== 'casino')) {
      setErrorMessage('Un croupier est affecté uniquement au module Casino.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      if (editUser) {
        await api.put(`/api/admin/users/${editUser.id}`, {
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          role: form.role,
          module: form.module,
          statut: form.actif ? 'actif' : 'inactif'
        });
      } else {
        await api.post('/api/auth/register', {
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          mot_de_passe: form.password,
          role: form.role,
          module: form.module,
          statut: form.actif ? 'actif' : 'inactif',
        });
      }

      await fetchRealUsers();
      setShowModal(false);
      setEditUser(null);
      setForm({ nom: '', prenom: '', email: '', role: 'manager', module: [], actif: true, password: '' });
    } catch (err: any) {
      setErrorMessage(getApiErrorMessage(err, 'Une erreur est survenue.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;

    try {
      setDeletingUserId(id);
      setErrorMessage('');
      await api.delete(`/api/admin/users/${id}`);
      await fetchRealUsers();
    } catch (err: any) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible de supprimer cet utilisateur.'));
    } finally {
      setDeletingUserId(null);
    }
  };

  const toggleModule = (mod: ModuleType) => {
    const currentModules = parseModules(form.module);
    const exists = currentModules.includes(mod);

    if (form.role === 'croupier' || form.role === 'hotesse') return;

    setErrorMessage('');
    setForm(prev => {
      const cur = parseModules(prev.module);
      return {
        ...prev,
        module: cur.includes(mod) ? cur.filter(m => m !== mod) : [...cur, mod]
      };
    });
  };

  const activeCount = state.users.filter(u => u.actif).length;
  const managerCount = state.users.filter(u => u.role === 'manager').length;
  const onlineCount = state.users.filter(isOnline).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-primary text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
            Utilisateurs
          </h2>
          <p className="text-muted text-sm mt-1">Gestion des accès et permissions</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
          <Users size={24} className="text-black" />
        </div>
      </div>

      {errorMessage && !showModal && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Utilisateurs', value: state.users.length, color: 'text-primary' },
          { label: 'En ligne', value: onlineCount, color: 'text-success' },
          { label: 'Actifs', value: activeCount, color: 'text-success' },
          { label: 'Inactifs', value: state.users.length - activeCount, color: 'text-muted' },
          { label: 'Managers', value: managerCount, color: 'text-accent' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-base rounded-2xl p-5">
            <p className="text-muted text-xs mb-1">{s.label}</p>
            <p className={`${s.color} font-bold text-xl`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-surface border border-base rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-b border-base">
          <h3 className="text-primary font-semibold flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            Gestion des Accès
          </h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full sm:w-48 h-9 pl-9 pr-3 bg-surface-2 border border-base rounded-xl text-primary placeholder-muted text-sm focus:outline-none focus:border-accent/50"
              />
            </div>
            <button
              type="button"
              onClick={() => setOnlineOnly(v => !v)}
              className={`h-9 px-3 rounded-xl border text-sm flex items-center gap-2 whitespace-nowrap transition-all ${onlineOnly ? 'bg-success-bg text-success border-success/40' : 'bg-surface-2 text-muted border-base hover:text-primary'}`}
              title="Afficher uniquement les utilisateurs connectés"
            >
              <span className="w-2 h-2 rounded-full bg-success" />
              En ligne ({onlineCount})
            </button>
            <Button icon={<Plus size={16} />} onClick={() => { setEditUser(null); setErrorMessage(''); setShowModal(true); }}>
              Ajouter
            </Button>
          </div>
        </div>

        <div className="divide-y divide-base">
          {isLoading ? (
            <div className="px-6 py-8 text-center text-muted text-sm">Chargement des utilisateurs…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted text-sm">
              Aucun utilisateur trouvé.
            </div>
          ) : (
            filtered.map(user => {
              const userModulesList = parseModules(user.module);
              const userPresence = presence[String(user.id)];
              const online = Boolean(userPresence?.online);
              const lastActivity = userPresence?.lastSeen || userPresence?.lastLogin || user.lastLogin || null;
              return (
                <div key={user.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-2 transition-colors">
                  <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${user.role === 'manager' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                    user.role === 'caisse' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                      'bg-gradient-to-br from-slate-600 to-slate-700'
                    }`}>
                    <span className="text-black font-bold text-sm">{user.prenom?.[0] || ''}{user.nom?.[0] || ''}</span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-surface)] ${online ? 'bg-success' : 'bg-surface-3'}`}
                      title={online ? 'En ligne' : 'Hors ligne'}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-primary font-medium">{user.prenom} {user.nom}</p>
                      <span className="text-sm">{roleIcons[user.role]}</span>
                    </div>
                    <p className="text-muted text-xs">{user.email}</p>
                  </div>

                  <div className="hidden md:block">
                    <Badge variant={user.role}>{roleLabels[user.role] || user.role}</Badge>
                  </div>

                  <div className="hidden lg:flex flex-wrap gap-1 max-w-48">
                    {userModulesList.slice(0, 3).map(m => (
                      <span key={m} className="px-2 py-0.5 rounded-full text-xs bg-surface-2 text-muted border border-base">
                        {moduleLabels[m] || m}
                      </span>
                    ))}
                    {userModulesList.length > 3 && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-surface-2 text-muted border border-base">
                        +{userModulesList.length - 3}
                      </span>
                    )}
                  </div>

                  <div>
                    <Badge variant={user.actif ? 'actif' : 'inactif'}>
                      {user.actif ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>

                  <div className="hidden sm:block text-right min-w-24">
                    {online ? (
                      <p className="text-success text-xs font-medium flex items-center justify-end gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> En ligne
                      </p>
                    ) : (
                      <>
                        <p className="text-muted text-xs">Hors ligne</p>
                        <p className="text-muted text-[11px]">
                          {lastActivity ? `Vu ${formatRelative(lastActivity)}` : 'Jamais connecté'}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => openEdit(user)} className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-muted hover:text-primary transition-all">
                      <Edit2 size={14} />
                    </button>
                    {String(user.id) !== String(state.currentUser?.id) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={deletingUserId !== null}
                        aria-label={`Supprimer ${user.prenom} ${user.nom}`}
                        title="Supprimer l'utilisateur"
                        className="w-8 h-8 rounded-lg bg-danger-bg hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center text-danger transition-all"
                      >
                        <Trash2 size={14} className={deletingUserId === user.id ? 'animate-pulse' : ''} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Joueurs Casino : profils clients sans compte de connexion - HIDDEN */}
      {/* <div className="bg-surface border border-base rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-base">
          <div>
            <h3 className="text-primary font-semibold">Joueurs Casino</h3>
            <p className="text-muted text-xs mt-1">Fiches joueurs sans email, mot de passe ni accès à l’application.</p>
          </div>
          <Button icon={<Plus size={16} />} onClick={() => { setErrorMessage(''); setShowPlayerModal(true); }}>Ajouter un joueur</Button>
        </div>
        <div className="divide-y divide-base">
          {casinoPlayers.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted">Aucun joueur Casino enregistré.</p>
          ) : casinoPlayers.map((player) => (
            <div key={player.id} className="flex items-center justify-between gap-4 px-6 py-3">
              <div>
                <p className="text-primary text-sm font-medium">{player.prenom} {player.nom}</p>
                <p className="text-muted text-xs">{player.code_client || `Joueur #${player.id}`}{player.telephone ? ` · ${player.telephone}` : ''}</p>
              </div>
              <Badge variant={player.statut === 'ACTIF' ? 'actif' : 'inactif'}>{player.statut}</Badge>
            </div>
          ))}
        </div>
      </div> */}

      {/* Role Legend */}
      <div className="bg-surface border border-base rounded-2xl p-6">
        <h3 className="text-primary font-semibold mb-4 flex items-center gap-2">
          <Key size={16} className="text-accent" />
          Niveaux d'Accès
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.entries(formRoleLabels) as [string, string][]).map(([role, label]) => (
            <div key={role} className="flex items-start gap-3 p-4 rounded-xl bg-surface-2/50 border border-base">
              <span className="text-2xl">{roleIcons[role]}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-primary font-medium text-sm">{label}</p>
                  <Badge variant={role}>{role}</Badge>
                </div>
                <p className="text-muted text-xs">
                  {role === 'admin' && 'Accès complet à tous les modules et paramètres'}
                  {role === 'manager' && 'Gestion de 1 ou 2 modules attribués'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditUser(null); }} title={editUser ? 'Modifier l\'utilisateur' : 'Nouvel Utilisateur'} size="lg">
        <div className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm">
              {errorMessage}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Prénom" value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} placeholder="Prénom" autoComplete="off" />
            <Input label="Nom" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Nom de famille" autoComplete="off" />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@hda.com" autoComplete="off" />

          <div className="relative">
            <Input label="Mot de passe" type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete="new-password" />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 bottom-3 text-muted hover:text-primary">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <Select label="Rôle" value={form.role} onChange={e => {
            const role = e.target.value as UserRole;
            setForm({ ...form, role, module: role === 'caisse' ? cashierModules : role === 'water' || role === 'hotesse' ? ['bar'] : role === 'receptioniste' ? ['hotel', 'bar'] : role === 'croupier' ? ['casino'] : form.module });
          }}
            options={Object.entries(formRoleLabels).map(([k, v]) => ({ value: k, label: v }))} />

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-muted text-sm font-medium">{form.role === 'caisse' ? 'Caisse(s) autorisée(s)' : 'Modules autorisés'}</label>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(form.role === 'caisse' ? (['bar', 'restaurant', 'hotel'] as ModuleType[]) : form.role === 'water' || form.role === 'hotesse' ? (['bar'] as ModuleType[]) : form.role === 'receptioniste' ? (['hotel', 'bar'] as ModuleType[]) : form.role === 'croupier' ? (['casino'] as ModuleType[]) : allModules).map(mod => {
                const currentModules = parseModules(form.module);
                const isSelected = currentModules.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => toggleModule(mod)}
                    disabled={form.role === 'water' || form.role === 'hotesse' || form.role === 'croupier'}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${isSelected
                      ? 'bg-accent-4 text-accent border-accent/40'
                      : 'bg-surface-2 text-muted border-base hover:text-primary'
                      }`}
                  >
                    {moduleLabels[mod]}
                  </button>
                );
              })}
            </div>
            {form.role === 'caisse' && <p className="mt-2 text-xs text-muted">Le caissier peut être affecté à : Bar, Restaurant, Hôtel ou Casino.</p>}
            {form.role === 'water' && <p className="mt-2 text-xs text-muted">Le barman travaille dans le module Bar. Plusieurs barmans peuvent être ajoutés.</p>}
            {form.role === 'hotesse' && <p className="mt-2 text-xs text-muted">L’hôtesse accède uniquement aux commandes du Bar qu’elle a créées.</p>}
            {form.role === 'receptioniste' && <p className="mt-2 text-xs text-muted">Le réceptionniste travaille dans les modules Hôtel et Bar.</p>}
            {form.role === 'croupier' && <p className="mt-2 text-xs text-muted">Le croupier travaille uniquement dans le module Casino.</p>}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setForm({ ...form, actif: !form.actif })}
              className={`w-12 h-6 rounded-full transition-all ${form.actif ? 'bg-success' : 'bg-surface-3'} relative`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.actif ? 'right-0.5' : 'left-0.5'}`} />
            </button>
            <span className="text-muted text-sm">{form.actif ? 'Compte actif' : 'Compte inactif'}</span>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowModal(false); setEditUser(null); }} className="flex-1">Annuler</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Enregistrement…' : editUser ? 'Mettre à jour' : 'Créer le compte'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* <Modal isOpen={showPlayerModal} onClose={() => setShowPlayerModal(false)} title="Nouveau joueur Casino" size="md">
        <div className="space-y-4">
          {errorMessage && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm">{errorMessage}</div>}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Prénom" value={playerForm.prenom} onChange={e => setPlayerForm({ ...playerForm, prenom: e.target.value })} />
            <Input label="Nom *" value={playerForm.nom} onChange={e => setPlayerForm({ ...playerForm, nom: e.target.value })} />
          </div>
          <Input label="Téléphone" value={playerForm.telephone} onChange={e => setPlayerForm({ ...playerForm, telephone: e.target.value })} />
          <p className="text-xs text-muted">Ce profil ne crée aucun compte utilisateur : le joueur ne pourra pas se connecter.</p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowPlayerModal(false)} className="flex-1">Annuler</Button>
            <Button onClick={createCasinoPlayer} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Création…' : 'Créer la fiche'}</Button>
          </div>
        </div>
      </Modal> */}
    </div>
  );
};

export default UtilisateursPage;
