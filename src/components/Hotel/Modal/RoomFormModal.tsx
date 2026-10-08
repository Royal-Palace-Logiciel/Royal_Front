// hotel/modals/RoomFormModal.tsx
import React, { useState, useEffect } from 'react';
import { Room, RoomType } from '../../../types/hotel.types';
import { 
  X, 
  DoorOpen, 
  Users, 
  DollarSign, 
  Home,
  Bed,
  AlertCircle,
  CheckCircle,
  Clock,
  Wrench,
  Brush,
  Ban,
  Loader,
  Plus,
  Save,
  XCircle
} from 'lucide-react';
import { Modal } from '../../Modal';
import { useRoomTypes } from '../../../hooks/useRoomTypes';
import { roomService, roomTypeService } from '../../../services/room.service';
import AuthService from '../../../services/authService';

interface RoomFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Room | null;
  onSuccess?: () => void;
}

const statusOptions = [
  { value: 'LIBRE', label: 'Libre', icon: CheckCircle, color: 'success' },
  { value: 'OCCUPEE', label: 'Occupée', icon: Users, color: 'accent' },
  { value: 'RESERVEE', label: 'Réservée', icon: Clock, color: 'warning' },
  { value: 'NETTOYAGE', label: 'En nettoyage', icon: Brush, color: 'info' },
  { value: 'MAINTENANCE', label: 'En maintenance', icon: Wrench, color: 'danger' },
  { value: 'HORS_SERVICE', label: 'Hors service', icon: Ban, color: 'muted' },
];

export const RoomFormModal: React.FC<RoomFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}) => {
  const isAdmin = String(AuthService.getCurrentUser()?.role || '').toLowerCase() === 'admin';
  const { roomTypes, loading: loadingTypes, loadRoomTypes } = useRoomTypes();
  
  const [formData, setFormData] = useState<Partial<Room>>({
    numero: '',
    room_type_id: null,
    capacite: null,
    prix_nuit: null,
    etage: 0,
    statut: 'LIBRE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // État pour le modal d'ajout de type
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [newTypeData, setNewTypeData] = useState({ nom: '', description: '' });
  const [isSubmittingType, setIsSubmittingType] = useState(false);
  const [typeErrors, setTypeErrors] = useState<Record<string, string>>({});

  // Réinitialiser le formulaire quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          numero: initialData.numero,
          room_type_id: initialData.room_type_id,
          capacite: initialData.capacite,
          prix_nuit: initialData.prix_nuit,
          etage: initialData.etage,
          statut: initialData.statut,
        });
      } else {
        setFormData({
          numero: '',
          room_type_id: null,
          capacite: null,
          prix_nuit: null,
          etage: 0,
          statut: 'LIBRE',
        });
      }
      setErrors({});
      setApiError(null);
    }
  }, [initialData, isOpen]);

  // Validation du formulaire
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.numero || formData.numero.trim() === '') {
      newErrors.numero = 'Veuillez saisir un numéro de chambre';
    }
    if (formData.prix_nuit !== null && formData.prix_nuit !== undefined && formData.prix_nuit < 0) {
      newErrors.prix_nuit = 'Le prix ne peut pas être négatif';
    }
    if (formData.capacite !== null && formData.capacite !== undefined && formData.capacite < 1) {
      newErrors.capacite = 'La capacité doit être au moins 1';
    }
    if (!formData.room_type_id) {
      newErrors.room_type_id = 'Veuillez sélectionner un type de chambre';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validation du formulaire de type
  const validateTypeForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!newTypeData.nom || newTypeData.nom.trim() === '') {
      newErrors.nom = 'Veuillez saisir un nom';
    }
    
    setTypeErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const submitData = {
        numero: formData.numero!,
        room_type_id: formData.room_type_id!,
        capacite: formData.capacite ?? null,
        etage: formData.etage ?? 0,
        statut: formData.statut!,
        ...(isAdmin ? { prix_nuit: formData.prix_nuit ?? null } : {}),
      };

      if (initialData) {
        await roomService.updateRoom(initialData.id, submitData);
        console.log('✅ Chambre mise à jour');
      } else {
        await roomService.createRoom(submitData);
        console.log('✅ Chambre créée');
      }

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error: any) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      
      if (error.response?.data?.message) {
        setApiError(error.response.data.message);
      } else {
        setApiError('Une erreur est survenue lors de la sauvegarde');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Soumission du formulaire de type
  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateTypeForm()) {
      return;
    }

    setIsSubmittingType(true);

    try {
      const newType = await roomTypeService.createRoomType({
        nom: newTypeData.nom.trim(),
        description: newTypeData.description.trim() || undefined
      });

      // Recharger la liste des types
      await loadRoomTypes();
      
      // Sélectionner automatiquement le nouveau type
      if (newType && newType.id) {
        setFormData(prev => ({
          ...prev,
          room_type_id: newType.id
        }));
      }

      // Fermer le modal d'ajout
      setIsTypeModalOpen(false);
      setNewTypeData({ nom: '', description: '' });
      
      console.log('✅ Type de chambre créé avec succès');
    } catch (error: any) {
      console.error('❌ Erreur lors de la création du type:', error);
      if (error.response?.data?.message) {
        setTypeErrors({ general: error.response.data.message });
      } else {
        setTypeErrors({ general: 'Erreur lors de la création du type' });
      }
    } finally {
      setIsSubmittingType(false);
    }
  };

  // Si les types de chambres sont en cours de chargement
  if (loadingTypes) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <div className="p-6 flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <Loader size={32} className="animate-spin text-accent mx-auto mb-3" />
            <p className="text-muted">Chargement des types de chambres...</p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      {/* Modal principal */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <div className="p-6 max-w-lg w-full">
          {/* Header */}
          <div className="relative mb-6">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-accent/10 to-transparent rounded-full blur-2xl" />
            <div className="flex items-center justify-between relative z-10">
              <div>
                <h3 className="text-2xl font-bold text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {initialData ? '✏️ Modifier la chambre' : '🆕 Nouvelle chambre'}
                </h3>
                <p className="text-muted text-sm mt-1">
                  {initialData 
                    ? 'Modifiez les détails de la chambre' 
                    : 'Créez une nouvelle chambre'}
                </p>
              </div>
                  {isAdmin && <button
                onClick={onClose} 
                className="p-2 rounded-xl hover:bg-surface-2 transition-all duration-300 hover:rotate-90"
                disabled={isSubmitting}
              >
                <X size={22} className="text-muted" />
                  </button>}
            </div>
          </div>

          {/* Erreur API */}
          {apiError && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Numéro */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">
                <DoorOpen size={14} className="inline mr-1.5" />
                Numéro de chambre *
              </label>
              <div className="relative">
                <DoorOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={formData.numero || ''}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  className={`input-field w-full text-sm py-2.5 pl-9 pr-3.5 rounded-lg ${
                    errors.numero ? 'border-danger focus:border-danger' : ''
                  }`}
                  placeholder="Ex: 101, 205..."
                  style={{ minHeight: '42px' }}
                  disabled={isSubmitting}
                  required
                />
              </div>
              {errors.numero && (
                <p className="text-danger text-xs flex items-center gap-1">
                  <AlertCircle size={11} /> {errors.numero}
                </p>
              )}
            </div>

            {/* Type de chambre avec bouton d'ajout */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-primary">
                  <Bed size={14} className="inline mr-1.5" />
                  Type de chambre *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsTypeModalOpen(true);
                    setNewTypeData({ nom: '', description: '' });
                    setTypeErrors({});
                  }}
                  className="text-xs text-accent hover:text-accent/80 font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus size={14} />
                  Ajouter un type
                </button>
              </div>
              <div className="relative">
                <Bed size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <select
                  value={formData.room_type_id || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    room_type_id: e.target.value ? Number(e.target.value) : null,
                    prix_nuit: roomTypes.find(type => type.id === Number(e.target.value))?.prix_base ?? formData.prix_nuit,
                  })}
                  className={`input-field w-full text-sm py-2.5 pl-9 pr-3.5 rounded-lg ${
                    errors.room_type_id ? 'border-danger focus:border-danger' : ''
                  }`}
                  style={{ minHeight: '42px' }}
                  disabled={isSubmitting}
                >
                  <option value="">Sélectionner un type</option>
                  {roomTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.nom} {type.description && `- ${type.description}`}
                    </option>
                  ))}
                </select>
              </div>
              {errors.room_type_id && (
                <p className="text-danger text-xs flex items-center gap-1">
                  <AlertCircle size={11} /> {errors.room_type_id}
                </p>
              )}
            </div>

            {/* Capacité */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">
                <Users size={14} className="inline mr-1.5" />
                Capacité (personnes)
              </label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="number"
                  value={formData.capacite ?? ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    capacite: e.target.value ? Number(e.target.value) : null 
                  })}
                  className={`input-field w-full text-sm py-2.5 pl-9 pr-3.5 rounded-lg ${
                    errors.capacite ? 'border-danger focus:border-danger' : ''
                  }`}
                  min="1"
                  max="10"
                  placeholder="Nombre de personnes"
                  style={{ minHeight: '42px' }}
                  disabled={isSubmitting || !isAdmin}
                />
              </div>
              {!isAdmin && <p className="text-muted text-xs">Tarif modifiable uniquement par un administrateur.</p>}
              {errors.capacite && (
                <p className="text-danger text-xs flex items-center gap-1">
                  <AlertCircle size={11} /> {errors.capacite}
                </p>
              )}
            </div>

            {/* Prix */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">
                <DollarSign size={14} className="inline mr-1.5" />
                Prix par nuit (Ar)
              </label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="number"
                  value={formData.prix_nuit ?? ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    prix_nuit: e.target.value ? Number(e.target.value) : null 
                  })}
                  className={`input-field w-full text-sm py-2.5 pl-9 pr-3.5 rounded-lg ${
                    errors.prix_nuit ? 'border-danger focus:border-danger' : ''
                  }`}
                  min="0"
                  step="1000"
                  placeholder="Prix en Ariary"
                  style={{ minHeight: '42px' }}
                  disabled={isSubmitting}
                />
              </div>
              {errors.prix_nuit && (
                <p className="text-danger text-xs flex items-center gap-1">
                  <AlertCircle size={11} /> {errors.prix_nuit}
                </p>
              )}
            </div>

            {/* Statut */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">
                <Home size={14} className="inline mr-1.5" />
                Statut
              </label>
              <div className="grid grid-cols-3 gap-2">
                {statusOptions.map((status) => {
                  const Icon = status.icon;
                  const isSelected = formData.statut === status.value;
                  return (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => setFormData({ 
                        ...formData, 
                        statut: status.value as Room['statut']
                      })}
                      className={`p-2.5 rounded-lg border-2 transition-all text-center ${
                        isSelected
                          ? `border-${status.color} bg-${status.color}/10`
                          : 'border-base hover:border-accent/30'
                      } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ minHeight: '48px' }}
                      disabled={isSubmitting}
                    >
                      <Icon size={15} className={`mx-auto mb-0.5 text-${status.color}`} />
                      <span className={`text-[11px] font-medium ${isSelected ? `text-${status.color}` : 'text-muted'}`}>
                        {status.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3 pt-3 border-t border-base">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-base text-primary font-medium text-sm hover:bg-surface-2 transition-all duration-300"
                disabled={isSubmitting}
                style={{ minHeight: '44px' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 rounded-lg btn-primary font-medium text-sm transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
                style={{ minHeight: '44px' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Home size={16} />
                    {initialData ? 'Mettre à jour' : 'Créer'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal d'ajout de type de chambre */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg dark:bg-surface-2 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-base dark:border-surface-3 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-primary dark:text-white">
                <Plus size={20} className="inline mr-2 text-accent" />
                Ajouter un type de chambre
              </h3>
              <button
                onClick={() => {
                  setIsTypeModalOpen(false);
                  setNewTypeData({ nom: '', description: '' });
                  setTypeErrors({});
                }}
                className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
              >
                <X size={20} className="text-muted" />
              </button>
            </div>

            {/* Erreur générale */}
            {typeErrors.general && (
              <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{typeErrors.general}</span>
              </div>
            )}

            <form onSubmit={handleTypeSubmit} className="space-y-4">
              {/* Nom du type */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-primary dark:text-gray-300">
                  Nom du type *
                </label>
                <input
                  type="text"
                  value={newTypeData.nom}
                  onChange={(e) => setNewTypeData({ ...newTypeData, nom: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-lg border ${
                    typeErrors.nom ? 'border-danger' : 'border-base dark:border-surface-3'
                  } bg dark:bg-surface text-primary dark:text-white focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all`}
                  placeholder="Ex: Standard, Deluxe, Suite..."
                  disabled={isSubmittingType}
                  autoFocus
                />
                {typeErrors.nom && (
                  <p className="text-danger text-xs flex items-center gap-1">
                    <AlertCircle size={11} /> {typeErrors.nom}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-primary dark:text-gray-300">
                  Description
                </label>
                <textarea
                  value={newTypeData.description}
                  onChange={(e) => setNewTypeData({ ...newTypeData, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-base dark:border-surface-3 bg dark:bg-surface text-primary dark:text-white focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                  placeholder="Description du type de chambre..."
                  rows={3}
                  disabled={isSubmittingType}
                />
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-3 border-t border-base dark:border-surface-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsTypeModalOpen(false);
                    setNewTypeData({ nom: '', description: '' });
                    setTypeErrors({});
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-base dark:border-surface-3 text-primary dark:text-gray-300 font-medium text-sm hover:bg-surface-2 dark:hover:bg-surface-3 transition-all duration-300"
                  disabled={isSubmittingType}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmittingType}
                >
                  {isSubmittingType ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Créer le type
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styles pour les animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.25s ease-out;
        }
      `}</style>
    </>
  );
};