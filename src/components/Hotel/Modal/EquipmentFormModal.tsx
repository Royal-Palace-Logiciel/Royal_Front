// hotel/Modal/EquipmentFormModal.tsx
import React, { useState, useEffect } from 'react';
import { Equipment } from '../../../types/hotel.types';
import { X, Loader, AlertCircle } from 'lucide-react';
import { Modal } from '../../Modal';

interface EquipmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Equipment | null;
  categories: string[];
  onSave: (data: any) => void;
}

export const EquipmentFormModal: React.FC<EquipmentFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  categories,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    categorie: '',
    description: '',
    zone: 'CHAMBRE' as 'CHAMBRE' | 'SALLE_DE_BAIN',
    quantite: 1,
    is_consumable: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        code: initialData.code || '',
        nom: initialData.nom || '',
        categorie: initialData.categorie || '',
        description: initialData.description || '',
        zone: initialData.zone || 'CHAMBRE',
        quantite: initialData.quantite || 1,
        is_consumable: initialData.is_consumable || false,
      });
    } else {
      setFormData({
        code: '',
        nom: '',
        categorie: '',
        description: '',
        zone: 'CHAMBRE',
        quantite: 1,
        is_consumable: false,
      });
      setCategorySearchTerm('');
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.nom.trim()) {
      newErrors.nom = 'Le nom est requis';
    }
    if (formData.quantite <= 0) {
      newErrors.quantite = 'La quantité doit être supérieure à 0';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // If creating a new category, use the search term as the category value
      const submitData = { ...formData };
      if (formData.categorie === 'new' && categorySearchTerm.trim()) {
        submitData.categorie = categorySearchTerm.trim();
      }
      await onSave(submitData);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg">
            {initialData ? '✏️ Modifier l\'équipement' : '➕ Nouvel équipement'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Emplacement de l’équipement</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, zone: 'CHAMBRE' })}
                className={`rounded-lg border p-3 text-left transition ${formData.zone === 'CHAMBRE' ? 'border-accent bg-accent/10 text-accent' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                disabled={isSubmitting}
              >
                <span className="block text-sm font-semibold">Chambre</span>
                <span className="block text-xs opacity-70">Équipement de la chambre</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, zone: 'SALLE_DE_BAIN' })}
                className={`rounded-lg border p-3 text-left transition ${formData.zone === 'SALLE_DE_BAIN' ? 'border-accent bg-accent/10 text-accent' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                disabled={isSubmitting}
              >
                <span className="block text-sm font-semibold">Salle de bain</span>
                <span className="block text-xs opacity-70">Équipement de la salle de bain</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Nom <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              placeholder="Nom de l'équipement"
              disabled={isSubmitting}
            />
            {errors.nom && (
              <p className="text-red-400 text-xs mt-1">{errors.nom}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent font-mono"
              placeholder="Code unique (ex: EQ-001)"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Catégorie</label>
            <div className="relative">
              <select
                value={formData.categorie}
                onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                disabled={isSubmitting}
              >
                <option value="">Sélectionner une catégorie</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="new">-- Nouvelle catégorie --</option>
              </select>
              {formData.categorie === 'new' && (
                <input
                  type="text"
                  value={categorySearchTerm}
                  onChange={(e) => {
                    setCategorySearchTerm(e.target.value);
                  }}
                  className="w-full mt-2 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="Nom de la nouvelle catégorie"
                  disabled={isSubmitting}
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Quantité</label>
            <input
              type="number"
              value={formData.quantite}
              onChange={(e) => setFormData({ ...formData, quantite: Number(e.target.value) || 1 })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              min="1"
              disabled={isSubmitting}
            />
            {errors.quantite && (
              <p className="text-red-400 text-xs mt-1">{errors.quantite}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Type d'équipement</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_consumable: false })}
                className={`p-2 rounded-lg border ${!formData.is_consumable ? 'border-accent bg-accent/10 text-accent' : 'border-gray-700 text-gray-300'}`}
                disabled={isSubmitting}
              >
                Non consommable
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_consumable: true })}
                className={`p-2 rounded-lg border ${formData.is_consumable ? 'border-accent bg-accent/10 text-accent' : 'border-gray-700 text-gray-300'}`}
                disabled={isSubmitting}
              >
                Consommable
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Sera ajouté au stock de l'hôtel
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent resize-none"
              rows={3}
              placeholder="Description de l'équipement..."
              disabled={isSubmitting}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
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
                  Sauvegarde...
                </>
              ) : (
                initialData ? 'Modifier' : 'Créer'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};