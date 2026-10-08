// src/services/userService.ts
import api from '../lib/api';
import { User, UserRole, ModuleType } from '../types';

export interface UserInput {
  nom: string;
  prenom: string;
  email: string;
  mot_de_passe?: string;
  rôle?: UserRole;
  role?: UserRole;
  module?: ModuleType[];
  statut?: 'actif' | 'inactif';
}

export const UserService = {
  // Récupérer tous les utilisateurs
  async getAllUsers(): Promise<User[]> {
    const response = await api.get('/api/admin/users');
    const rawData = response.data.data || response.data;
    
    if (!Array.isArray(rawData)) return [];

    return rawData.map((u: any) => ({
      id: u.id_admin || u.id,
      nom: u.nom,
      prenom: u.prenom || '',
      email: u.email,
      role: u.role || 'manager',
      module: u.module || [],
      actif: u.statut === 'actif' || u.actif === true,
      lastLogin: u.lastLogin || u.date_creation || null,
      createdAt: u.created_at || u.createdAt || new Date().toISOString()
    }));
  },

  // Récupérer un utilisateur par son ID
  async getUserById(id: string | number): Promise<User> {
    const response = await api.get(`/api/admin/users/${id}`);
    const u = response.data.data || response.data;
    
    return {
      id: u.id_admin || u.id,
      nom: u.nom,
      prenom: u.prenom || '',
      email: u.email,
      role: u.role || 'manager',
      module: u.module || [],
      actif: u.statut === 'actif' || u.actif === true,
      lastLogin: u.lastLogin || u.date_creation || null,
      createdAt: u.created_at || u.createdAt || new Date().toISOString()
    };
  },

  // Mettre à jour un utilisateur existant
  async updateUser(id: string | number, data: Partial<UserInput>): Promise<any> {
    const response = await api.put(`/api/admin/users/${id}`, data);
    return response.data;
  },

  // Supprimer un utilisateur
  async deleteUser(id: string | number): Promise<any> {
    const response = await api.delete(`/api/admin/users/${id}`);
    return response.data;
  }
};

export default UserService;