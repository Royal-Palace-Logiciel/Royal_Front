// src/hooks/useClients.ts
import { useState, useEffect, useCallback } from 'react';
import {
  clientService, Client, ClientFormData, ClientWithDetails, ClientKyc, ClientKycFormData,
} from '../services/client.service';

export const useClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger tous les clients
  const loadClients = useCallback(async (filters?: { nom?: string; statut?: string; is_casino_player?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await clientService.getClients(filters);

      // Sécurité avec cast (as any)
      const dataArray = Array.isArray(response)
        ? response
        : ((response as any)?.data || (response as any)?.clients || []);

      setClients(dataArray);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des clients');
      console.error('❌ loadClients error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Créer un client
  const createClient = useCallback(async (data: ClientFormData) => {
    try {
      setError(null);
      const newClient = await clientService.createClient(data);
      setClients(prev => [...prev, newClient]);
      return newClient;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
      console.error('❌ createClient error:', err);
      throw err;
    }
  }, []);

  // Mettre à jour un client
  const updateClient = useCallback(async (id: number, data: ClientFormData) => {
    try {
      setError(null);
      const updatedClient = await clientService.updateClient(id, data);
      setClients(prev => prev.map(client => client.id === id ? updatedClient : client));
      return updatedClient;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
      console.error('❌ updateClient error:', err);
      throw err;
    }
  }, []);

  // Supprimer un client
  const deleteClient = useCallback(async (id: number) => {
    try {
      setError(null);
      const result = await clientService.deleteClient(id);

      if (result.deleted) {
        setClients(prev => prev.filter(client => client.id !== id));
      } else if (result.deactivated) {
        setClients(prev => prev.map(client =>
          client.id === id ? { ...client, statut: 'INACTIF' as const } : client
        ));
      }

      return result;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
      console.error('❌ deleteClient error:', err);
      throw err;
    }
  }, []);

  // Rechercher des clients (nom, prénom, code_client, téléphone, email)
  const searchClients = useCallback(async (searchTerm: string) => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      await loadClients();
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await clientService.searchClients(term);
      setClients(Array.isArray(data) ? data : ((data as any)?.data || (data as any)?.clients || []));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la recherche');
      console.error('❌ searchClients error:', err);
    } finally {
      setLoading(false);
    }
  }, [loadClients]);

  // Récupérer un client avec solde (vue détaillée)
  const loadClientWithDetails = useCallback(async (id: number): Promise<ClientWithDetails | null> => {
    try {
      setError(null);
      return await clientService.getClientWithDetails(id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement de la fiche client');
      console.error('❌ loadClientWithDetails error:', err);
      throw err;
    }
  }, []);

  // Récupérer la fiche KYC d'un client
  const loadClientKyc = useCallback(async (id: number): Promise<ClientKyc | null> => {
    try {
      setError(null);
      return await clientService.getClientKyc(id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement de la fiche KYC');
      console.error('❌ loadClientKyc error:', err);
      throw err;
    }
  }, []);

  // Créer ou mettre à jour la fiche KYC d'un client
  const saveClientKyc = useCallback(async (id: number, data: ClientKycFormData): Promise<ClientKyc> => {
    try {
      setError(null);
      return await clientService.saveClientKyc(id, data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde de la fiche KYC');
      console.error('❌ saveClientKyc error:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  return {
    clients,
    loading,
    error,
    loadClients,
    searchClients,
    createClient,
    updateClient,
    deleteClient,
    loadClientWithDetails,
    loadClientKyc,
    saveClientKyc,
  };
};