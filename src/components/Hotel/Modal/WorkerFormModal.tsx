// components/Hotel/Modal/WorkerFormModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Loader, Paperclip, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../Modal';
import { MaintenanceWorkerFormData } from '../../../services/maintenanceWorker.service';
import { uploadService } from '../../../services/upload.service';

const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const fileUrlToAbsolute = (url: string) => (url.startsWith('http') ? url : `${API_ORIGIN}${url}`);
const fileNameFromUrl = (url: string) => decodeURIComponent(url.split('/').pop() || url);

interface WorkerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MaintenanceWorkerFormData) => Promise<void> | void;
}

interface FileUploadFieldProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

const FileUploadField: React.FC<FileUploadFieldProps> = ({ label, value, onChange, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-sélectionner le même fichier plus tard
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await uploadService.uploadFile(file);
      onChange(uploaded.url);
      toast.success(`${label} téléversé`);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Échec du téléversement du fichier');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileSelected}
        disabled={disabled || uploading}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 transition text-sm disabled:opacity-50"
        >
          {uploading ? <Loader size={14} className="animate-spin" /> : <Paperclip size={14} />}
          {value ? 'Remplacer' : 'Choisir un fichier'}
        </button>
        {value && !uploading && (
          <a
            href={fileUrlToAbsolute(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent hover:underline truncate"
            title={fileNameFromUrl(value)}
          >
            <Check size={12} />
            {fileNameFromUrl(value)}
          </a>
        )}
      </div>
    </div>
  );
};

const emptyForm: MaintenanceWorkerFormData = {
  nom: '',
  prenom: '',
  telephone: '',
  email: '',
  specialite: '',
  date_debut: '',
  date_fin: '',
  time_slot: '',
  photo_url: '',
  id_photo_url: '',
  contract_url: '',
  quote_url: '',
};

export const WorkerFormModal: React.FC<WorkerFormModalProps> = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<MaintenanceWorkerFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(emptyForm);
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.nom.trim()) newErrors.nom = 'Veuillez saisir le nom de l’ouvrier';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // date_debut/date_fin sont des colonnes DATE : une chaîne vide (champ non
    // rempli) provoque une erreur SQL côté serveur, contrairement à undefined
    // qui est simplement omis (la colonne garde sa valeur NULL par défaut).
    const payload: MaintenanceWorkerFormData = {
      ...formData,
      date_debut: formData.date_debut || undefined,
      date_fin: formData.date_fin || undefined,
    };

    setIsSubmitting(true);
    try {
      await onSave(payload);
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
          <h3 className="text-white font-bold text-lg">➕ Nouvel ouvrier</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Nom <span className="text-red-400">*</span>
            </label>
            <input
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
              disabled={isSubmitting}
            />
            {errors.nom && <p className="text-red-400 text-xs mt-1">{errors.nom}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Prénom</label>
              <input
                value={formData.prenom}
                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Téléphone</label>
              <input
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Spécialité</label>
            <input
              value={formData.specialite}
              onChange={(e) => setFormData({ ...formData, specialite: e.target.value })}
              placeholder="Ex. Plomberie, électricité..."
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Date début collaboration</label>
              <input
                type="date"
                value={formData.date_debut}
                onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Date fin collaboration</label>
              <input
                type="date"
                value={formData.date_fin}
                onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Créneau horaire</label>
            <input
              value={formData.time_slot}
              onChange={(e) => setFormData({ ...formData, time_slot: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-accent"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-3">
            <FileUploadField
              label="Photo personnelle"
              value={formData.photo_url}
              onChange={(url) => setFormData({ ...formData, photo_url: url })}
              disabled={isSubmitting}
            />
            <FileUploadField
              label="Photo pièce d'identité"
              value={formData.id_photo_url}
              onChange={(url) => setFormData({ ...formData, id_photo_url: url })}
              disabled={isSubmitting}
            />
            <FileUploadField
              label="Contrat"
              value={formData.contract_url}
              onChange={(url) => setFormData({ ...formData, contract_url: url })}
              disabled={isSubmitting}
            />
            <FileUploadField
              label="Devis"
              value={formData.quote_url}
              onChange={(url) => setFormData({ ...formData, quote_url: url })}
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
                "Ajouter l'ouvrier"
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
