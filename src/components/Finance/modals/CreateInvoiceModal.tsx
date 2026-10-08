// src/components/Finance/modals/CreateInvoiceModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, DollarSign, User, FileText, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { useClients } from '../../../hooks/useClients';
import { clientService } from '../../../services/client.service';
import { financeService } from '../../../services/finance.service';
import { formatCurrency } from '../../../utils/data';
import { toast } from 'react-hot-toast';

interface InvoiceItem {
  description: string;
  montant: number;
}

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { clients, loadClients } = useClients();
  
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', montant: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Quick client creation
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientData, setQuickClientData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadClients();
      resetForm();
    }
  }, [isOpen, loadClients]);

  const resetForm = () => {
    setSelectedClientId(null);
    setItems([{ description: '', montant: 0 }]);
    setErrors({});
    setApiError(null);
    setShowQuickClient(false);
    setQuickClientData({ nom: '', prenom: '', telephone: '' });
  };

  const addItem = () => {
    setItems([...items, { description: '', montant: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    if (field === 'montant') {
      newItems[index][field] = Number(value) || 0;
    } else {
      newItems[index][field] = value as string;
    }
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.montant) || 0), 0);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!selectedClientId) {
      newErrors.client_id = 'Veuillez sélectionner un client';
    }
    
    items.forEach((item, index) => {
      if (!item.description?.trim()) {
        newErrors[`item_${index}_description`] = 'Description requise';
      }
      if (!item.montant || item.montant <= 0) {
        newErrors[`item_${index}_montant`] = 'Montant doit être supérieur à 0';
      }
    });

    if (calculateTotal() <= 0) {
      newErrors.total = 'Le total doit être supérieur à 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleQuickClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quickClientData.nom?.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsCreatingClient(true);

    try {
      const newClient = await clientService.createClient({
        nom: quickClientData.nom.trim(),
        prenom: quickClientData.prenom.trim() || undefined,
        telephone: quickClientData.telephone.trim() || undefined,
        statut: 'ACTIF',
        is_casino_player: false,
      });

      toast.success('Client créé avec succès');
      await loadClients();
      setSelectedClientId(newClient.id);
      setShowQuickClient(false);
      setQuickClientData({ nom: '', prenom: '', telephone: '' });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la création du client';
      toast.error(errorMessage);
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs du formulaire');
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const validItems = items.map(item => ({
        description: item.description.trim(),
        montant: Number(item.montant)
      }));

      await financeService.createInvoice({
        client_id: selectedClientId!,
        items: validItems
      });

      toast.success('Facture créée avec succès');
      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la création de la facture';
      setApiError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = calculateTotal();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle Facture" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
            <AlertCircle size={16} />
            {apiError}
          </div>
        )}

        {/* Client Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <div className="flex items-center gap-2">
              <User size={16} />
              Client
            </div>
          </label>
          {showQuickClient ? (
            <div className="bg-surface-2 border border-base rounded-lg p-3 space-y-3">
              <input
                type="text"
                placeholder="Nom *"
                value={quickClientData.nom}
                onChange={(e) => setQuickClientData({ ...quickClientData, nom: e.target.value })}
                className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                disabled={isCreatingClient}
              />
              <input
                type="text"
                placeholder="Prénom"
                value={quickClientData.prenom}
                onChange={(e) => setQuickClientData({ ...quickClientData, prenom: e.target.value })}
                className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                disabled={isCreatingClient}
              />
              <input
                type="text"
                placeholder="Téléphone"
                value={quickClientData.telephone}
                onChange={(e) => setQuickClientData({ ...quickClientData, telephone: e.target.value })}
                className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                disabled={isCreatingClient}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleQuickClientSubmit}
                  disabled={isCreatingClient}
                  className="flex-1 bg-accent text-black px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreatingClient ? <Loader size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Créer Client
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickClient(false)}
                  disabled={isCreatingClient}
                  className="px-3 py-2 border border-base rounded-lg text-sm hover:bg-surface-2 disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              >
                <option value="">Sélectionner un client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.nom} {client.prenom ? client.prenom : ''} {client.telephone ? `(${client.telephone})` : ''}
                  </option>
                ))}
              </select>
              {errors.client_id && (
                <p className="text-red-500 text-xs">{errors.client_id}</p>
              )}
              <button
                type="button"
                onClick={() => setShowQuickClient(true)}
                className="text-accent text-xs hover:underline"
              >
                + Créer un nouveau client
              </button>
            </div>
          )}
        </div>

        {/* Invoice Items */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <div className="flex items-center gap-2">
              <FileText size={16} />
              Articles de la facture
            </div>
          </label>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                  {errors[`item_${index}_description`] && (
                    <p className="text-red-500 text-xs">{errors[`item_${index}_description`]}</p>
                  )}
                </div>
                <div className="w-32 space-y-2">
                  <input
                    type="number"
                    placeholder="Montant"
                    value={item.montant || ''}
                    onChange={(e) => updateItem(index, 'montant', e.target.value)}
                    min="0"
                    step="100"
                    className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                  {errors[`item_${index}_montant`] && (
                    <p className="text-red-500 text-xs">{errors[`item_${index}_montant`]}</p>
                  )}
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="mt-2 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 text-accent text-sm hover:underline"
            >
              <Plus size={16} />
              Ajouter un article
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-300">
              <DollarSign size={18} />
              <span className="font-medium">Total</span>
            </div>
            <span className="text-2xl font-bold text-accent">{formatCurrency(total)}</span>
          </div>
          {errors.total && (
            <p className="text-red-500 text-xs mt-1">{errors.total}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-base">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 border border-base rounded-lg text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-accent text-black px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Créer la facture
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateInvoiceModal;