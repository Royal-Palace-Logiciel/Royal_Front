// components/Hotel/Modal/MaintenanceFormModal.tsx
import React, { useState, useEffect } from 'react';
import { RoomMaintenance, Room, Equipment, MaintenanceWorker } from '../../../types/hotel.types';
import { X, Loader, AlertCircle } from 'lucide-react';
import { Modal } from '../../Modal';
import { StockProductPicker } from '../StockProductPicker';

interface SelectedProduct {
  product_id: number;
  nom: string;
  unite: string;
  available_quantity: number;
  quantity: number;
}

interface MaintenanceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: RoomMaintenance | null;
  rooms: Room[];
  equipments: Equipment[];
  workers?: MaintenanceWorker[];
  defaultRoomId?: number;
  onSave: (data: any) => void;
}

export const MaintenanceFormModal: React.FC<MaintenanceFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  rooms,
  equipments,
  workers = [],
  defaultRoomId,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    room_id: 0,
    equipment_id: null as number | null,
    type_intervention: 'PLOMBERIE' as RoomMaintenance['type_intervention'],
    description: '',
    statut: 'OUVERT' as 'OUVERT' | 'EN_COURS' | 'TERMINE' | 'ANNULE',
    cout: 0,
    location: '',
    equipment_label: '',
    worker_id: null as number | null,
    execution_date: '',
    finish_date: '',
    materials_cost: 0,
    labor_cost: 0,
    other_intervention_description: '',
  });
  const [materialsUsed, setMaterialsUsed] = useState<SelectedProduct[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        room_id: initialData.room_id,
        equipment_id: initialData.equipment_id || null,
        type_intervention: initialData.type_intervention,
        description: initialData.description || '',
        statut: initialData.statut,
        cout: initialData.cout || 0,
        location: initialData.location || '',
        equipment_label: initialData.equipment_label || '',
        worker_id: initialData.worker_id || null,
        execution_date: initialData.execution_date || '',
        finish_date: initialData.finish_date || '',
        materials_cost: initialData.materials_cost || 0,
        labor_cost: initialData.labor_cost || 0,
        other_intervention_description: '',
      });
      let savedProducts: any = initialData.materials_used || [];
      if (typeof savedProducts === 'string') {
        try { savedProducts = JSON.parse(savedProducts); } catch { savedProducts = []; }
      }
      setMaterialsUsed(Array.isArray(savedProducts) ? savedProducts.map((item: any) => ({
        product_id: Number(item.product_id),
        nom: item.nom || `Produit #${item.product_id}`,
        unite: item.unite || 'unités',
        available_quantity: Number(item.available_quantity || item.quantity || 0),
        quantity: Number(item.quantity || 1),
      })) : []);
    } else {
      setFormData({
        room_id: defaultRoomId || 0,
        equipment_id: null,
        type_intervention: 'PLOMBERIE',
        description: '',
        statut: 'OUVERT',
        cout: 0,
        location: '', equipment_label: '', worker_id: null,
        execution_date: '', finish_date: '', materials_cost: 0, labor_cost: 0,
        other_intervention_description: '',
      });
      setMaterialsUsed([]);
    }
    setErrors({});
  }, [initialData, isOpen, defaultRoomId]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.location.trim()) newErrors.location = 'Veuillez saisir le lieu de l’intervention';
    if (formData.type_intervention === 'AUTRE' && !formData.other_intervention_description.trim()) {
      newErrors.other_intervention_description = 'Veuillez préciser le type d’intervention';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const submitData = {
        ...formData,
        description: formData.type_intervention === 'AUTRE' && formData.other_intervention_description.trim()
          ? `${formData.other_intervention_description.trim()}${formData.description.trim() ? ` — ${formData.description.trim()}` : ''}`
          : formData.description,
        materials_used: materialsUsed.map(m => ({
          product_id: m.product_id,
          quantity: m.quantity
        }))
      };
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
            {initialData ? '✏️ Modifier la maintenance' : '➕ Nouvelle maintenance'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Chambre */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Chambre de référence
            </label>
            <select
              value={formData.room_id}
              onChange={(e) => setFormData({ ...formData, room_id: Number(e.target.value) })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
              disabled={isSubmitting}
            >
              <option value={0}>Sélectionner une chambre</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  Chambre {room.numero} - {room.room_type?.nom || 'Standard'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Endroit exact *</label>
            <input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Ex. Toilettes femmes, 1er étage" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white" />
            {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location}</p>}
            <label className="block text-sm font-medium text-gray-300 mb-1.5 mt-3">Équipement concerné</label>
            <input value={formData.equipment_label} onChange={(e) => setFormData({ ...formData, equipment_label: e.target.value })} placeholder="Ex. Robinet, climatiseur..." className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white" />
          </div>

          {/* Équipement */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Équipement</label>
            <select
              value={formData.equipment_id || ''}
              onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value ? Number(e.target.value) : null })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
              disabled={isSubmitting}
            >
              <option value="">Aucun équipement</option>
              {equipments.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.nom} {eq.code ? `(${eq.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Type d'intervention */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Type d'intervention <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.type_intervention}
              onChange={(e) => setFormData({ ...formData, type_intervention: e.target.value as any })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
              disabled={isSubmitting}
            >
              <option value="PLOMBERIE">Plomberie</option>
              <option value="ELECTRICITE">Électricité</option>
              <option value="MACONNERIE">Maçonnerie</option>
              <option value="CLIMATISATION">Climatisation</option>
              <option value="AUTRE">Autres</option>
            </select>
          </div>

          {/* Other intervention description */}
          {formData.type_intervention === 'AUTRE' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Description de l'intervention autre <span className="text-red-400">*</span>
              </label>
              <textarea
                value={formData.other_intervention_description}
                onChange={(e) => setFormData({ ...formData, other_intervention_description: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent resize-none"
                rows={2}
                placeholder="Spécifiez le type d'intervention..."
                disabled={isSubmitting}
              />
              {errors.other_intervention_description && <p className="text-red-400 text-xs mt-1">{errors.other_intervention_description}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Ouvrier responsable</label>
            <select value={formData.worker_id || ''} onChange={(e) => setFormData({ ...formData, worker_id: e.target.value ? Number(e.target.value) : null })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="">{workers.length ? 'Sélectionner un ouvrier' : 'Aucun ouvrier enregistré'}</option>
              {workers.filter(worker => worker.statut === 'ACTIF').map(worker => <option key={worker.id} value={worker.id}>{worker.prenom} {worker.nom}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm text-gray-300 mb-1.5">Date d’exécution</label><input type="date" value={formData.execution_date} onChange={(e) => setFormData({ ...formData, execution_date: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" /></div>
            <div><label className="block text-sm text-gray-300 mb-1.5">Date de finition</label><input type="date" value={formData.finish_date} onChange={(e) => setFormData({ ...formData, finish_date: e.target.value })} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" /></div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Statut</label>
            <select
              value={formData.statut}
              onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
              disabled={isSubmitting}
            >
              <option value="OUVERT">🔴 Ouvert</option>
              <option value="EN_COURS">🟡 En cours (Démarrer maintenant)</option>
              <option value="TERMINE">✅ Terminé</option>
              <option value="ANNULE">⛔ Annulé</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent resize-none"
              rows={3}
              placeholder="Décrivez l'intervention..."
              disabled={isSubmitting}
            />
          </div>

          {/* Matériaux utilisés */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Matériaux/produits utilisés
            </label>
            <StockProductPicker
              onChange={setMaterialsUsed}
              initialProducts={materialsUsed}
              locationId={5}
            />
          </div>

          {/* Coûts */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Coût des matériaux</label>
            <input type="number" value={formData.materials_cost} onChange={(e) => setFormData({ ...formData, materials_cost: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white" min="0" />
            <label className="block text-sm font-medium text-gray-300 mb-1.5 mt-3">Main d’œuvre</label>
            <input type="number" value={formData.labor_cost} onChange={(e) => setFormData({ ...formData, labor_cost: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white" min="0" />
            <p className="text-accent font-semibold mt-2">Total estimé : {(Number(formData.materials_cost) + Number(formData.labor_cost)).toLocaleString('fr-FR')} Ar</p>
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