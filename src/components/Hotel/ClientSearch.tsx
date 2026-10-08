// components/ClientSearch.tsx
import React, { useState, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  Loader, 
  X, 
  AlertCircle,
  CheckCircle,
  Clock,
  Sparkles,
  Users,
  Edit,
  Trash2
} from 'lucide-react';
import { Client } from '../../services/client.service';
import { useClients } from '../../hooks/useClients';
import { toast } from 'react-hot-toast';

interface ClientSearchProps {
  onSelect: (client: Client) => void;
  onEdit?: (client: Client) => void;
  onDelete?: (clientId: number) => void;
  selectedClient?: Client | null;
  className?: string;
}

export const ClientSearch: React.FC<ClientSearchProps> = ({ 
  onSelect, 
  onEdit,
  onDelete,
  selectedClient = null,
  className = ""
}) => {
  const { clients, loading, error, loadClients, deleteClient, updateClient, createClient } = useClients();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [editFormData, setEditFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    statut: 'ACTIF' as 'ACTIF' | 'INACTIF' | 'BLOCKED',
    is_casino_player: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Charger tous les clients au montage
  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const getInitials = (client: Client) => {
    return `${client.prenom?.[0] || ''}${client.nom?.[0] || ''}`.toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIF: 'bg-emerald-500/20 text-emerald-400',
      INACTIF: 'bg-gray-500/20 text-gray-400',
      BLOCKED: 'bg-red-500/20 text-red-400'
    };
    const labels: Record<string, string> = {
      ACTIF: 'Actif',
      INACTIF: 'Inactif',
      BLOCKED: 'Bloqué'
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.ACTIF}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Ouvrir le modal de modification
  const handleEditClick = (client: any) => {
    setClientToEdit(client);
    setEditFormData({
      nom: client.nom || '',
      prenom: client.prenom || '',
      telephone: client.telephone || '',
      email: client.email || '',
      statut: (client.statut as any) || 'ACTIF',
      is_casino_player: client.is_casino_player || false
    });
    setEditModalOpen(true);
  };

  // Soumettre la modification
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientToEdit) return;
    
    setIsSubmitting(true);
    try {
      // Préparer les données à envoyer
      const updatedData = {
        nom: editFormData.nom.trim(),
        prenom: editFormData.prenom.trim() || undefined,
        telephone: editFormData.telephone.trim() || undefined,
        email: editFormData.email.trim() || undefined,
        statut: editFormData.statut,
        is_casino_player: editFormData.is_casino_player
      };

      // Appeler updateClient du hook
      await updateClient(clientToEdit.id, updatedData);
      
      toast.success('Client modifié avec succès');
      setEditModalOpen(false);
      setClientToEdit(null);
      
      // Recharger la liste
      await loadClients();
      
      // Appeler onEdit si fourni
      if (onEdit) {
        onEdit({ ...clientToEdit, ...updatedData } as any);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la modification');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supprimer un client
  const handleDeleteClick = (client: Client) => {
    setClientToDelete(client);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteClient(clientToDelete.id);
      // Client avec historique : retiré de la liste, historique conservé (voir ClientsPage).
      toast.success(result?.archived ? 'Client supprimé de la liste (historique conservé).' : 'Client supprimé définitivement');
      setDeleteModalOpen(false);
      setClientToDelete(null);
      if (onDelete) {
        onDelete(clientToDelete.id);
      }
      await loadClients();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRowClick = (client: Client) => {
    onSelect(client);
  };

  // Si un client est sélectionné, afficher ses infos
  if (selectedClient) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-3 p-3 bg-gray-900 border-2 border-accent/50 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm flex-shrink-0">
            {getInitials(selectedClient)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">
              {selectedClient.prenom} {selectedClient.nom}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              {selectedClient.telephone && (
                <span className="flex items-center gap-1">
                  <Phone size={12} />
                  {selectedClient.telephone}
                </span>
              )}
              {selectedClient.email && (
                <span className="flex items-center gap-1 truncate max-w-[150px]">
                  <Mail size={12} />
                  {selectedClient.email}
                </span>
              )}
              {getStatusBadge(selectedClient.statut)}
            </div>
          </div>
          <button
            onClick={() => onSelect(null as any)}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Affichage du chargement
  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader size={32} className="animate-spin text-accent" />
        <span className="ml-3 text-gray-400 text-sm">Chargement des clients...</span>
      </div>
    );
  }

  // Affichage de l'erreur
  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={() => loadClients()} className="mt-2 text-accent text-sm hover:underline">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* En-tête avec compteur */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-gray-400" />
          <span className="text-sm text-gray-400">
            {clients.length} client{clients.length > 1 ? 's' : ''} disponible{clients.length > 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => loadClients()}
          className="text-xs text-gray-500 hover:text-gray-300 transition"
        >
          🔄 Actualiser
        </button>
      </div>

      {/* Tableau des clients */}
      {clients.length === 0 ? (
        <div className="text-center py-8 bg-gray-900/50 rounded-xl border border-gray-700">
          <User size={32} className="mx-auto text-gray-600 mb-2" />
          <p className="text-gray-400 text-sm">Aucun client trouvé</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 hidden sm:table-cell">Contact</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 hidden md:table-cell">Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Statut</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr 
                    key={client.id} 
                    className="border-b border-gray-800 hover:bg-gray-800/30 transition cursor-pointer"
                    onClick={() => handleRowClick(client)}
                  >
                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center text-accent font-semibold text-xs flex-shrink-0">
                          {getInitials(client)}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">
                            {client.prenom} {client.nom}
                          </p>
                          {client.is_casino_player && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-accent/20 text-accent text-[10px] font-medium rounded-full">
                              <Sparkles size={10} />
                              Casino
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="space-y-0.5 text-xs">
                        {client.telephone && (
                          <p className="text-gray-400 flex items-center gap-1">
                            <Phone size={12} className="text-gray-500" />
                            {client.telephone}
                          </p>
                        )}
                        {client.email && (
                          <p className="text-gray-400 flex items-center gap-1 truncate max-w-[150px]">
                            <Mail size={12} className="text-gray-500" />
                            {client.email}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Code */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-mono text-gray-500">
                        {client.code_client || `#${client.id}`}
                      </span>
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3">
                      {getStatusBadge(client.statut)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Bouton Modifier */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(client);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition text-xs font-medium"
                          title="Modifier"
                        >
                          <Edit size={14} className="text-blue-400" />
                          Modifier
                        </button>

                        {/* Bouton Supprimer */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(client);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition text-xs font-medium"
                          title="Supprimer"
                        >
                          <Trash2 size={14} className="text-red-400" />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de modification avec updateClient */}
      {editModalOpen && clientToEdit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">✏️ Modifier le client</h3>
              <button
                onClick={() => {
                  setEditModalOpen(false);
                  setClientToEdit(null);
                }}
                className="text-gray-400 hover:text-gray-300 transition"
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Nom <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.nom}
                  onChange={(e) => setEditFormData({ ...editFormData, nom: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Prénom
                </label>
                <input
                  type="text"
                  value={editFormData.prenom}
                  onChange={(e) => setEditFormData({ ...editFormData, prenom: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={editFormData.telephone}
                  onChange={(e) => setEditFormData({ ...editFormData, telephone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Statut
                </label>
                <select
                  value={editFormData.statut}
                  onChange={(e) => setEditFormData({ 
                    ...editFormData, 
                    statut: e.target.value as 'ACTIF' | 'INACTIF' | 'BLOCKED' 
                  })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
                  disabled={isSubmitting}
                >
                  <option value="ACTIF">Actif</option>
                  <option value="INACTIF">Inactif</option>
                  <option value="BLOCKED">Bloqué</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editFormData.is_casino_player}
                  onChange={(e) => setEditFormData({ ...editFormData, is_casino_player: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-accent focus:ring-accent"
                  disabled={isSubmitting}
                />
                <label className="text-sm text-gray-300">🎰 Joueur de casino</label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setClientToEdit(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition text-sm"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent-2 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Modification...
                    </>
                  ) : (
                    <>
                      <Edit size={16} />
                      Modifier
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      {deleteModalOpen && clientToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
              <h3 className="text-white font-bold mb-2">Confirmer la suppression</h3>
              <p className="text-gray-400 text-sm">
                Supprimer le client <br />
                <strong className="text-white">
                  {clientToDelete.prenom} {clientToDelete.nom}
                </strong>
              </p>
              <p className="text-red-400/80 text-xs mt-2">
                ⚠️ Cette action est irréversible
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setClientToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm flex items-center justify-center gap-2"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};