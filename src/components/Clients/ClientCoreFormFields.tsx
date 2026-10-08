// src/components/Clients/ClientCoreFormFields.tsx
// Champs de base du formulaire client (identiques à ceux de la page "Clients"),
// extraits pour être réutilisés partout où un client est créé/modifié — ex.
// dans le modal Hôtel lors d'une réservation — sans dupliquer les champs.
// La section KYC (conformité casino) reste propre à la page Clients : elle est
// optionnelle même là-bas (déclenchée par "Joueur de casino") et n'a pas sa
// place dans un ajout rapide de client pendant une réservation.
import React from 'react';
import { ClientFormData } from '../../services/client.service';
import SignaturePad from '../SignaturePad';

interface ClientCoreFormFieldsProps {
  formData: ClientFormData;
  formErrors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  isSubmitting?: boolean;
  signature: string | null;
  onSignatureChange: (dataUrl: string | null) => void;
}

export const ClientCoreFormFields: React.FC<ClientCoreFormFieldsProps> = ({
  formData,
  formErrors,
  onChange,
  isSubmitting = false,
  signature,
  onSignatureChange,
}) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Nom *</label>
        <input
          type="text"
          name="nom"
          value={formData.nom}
          onChange={onChange}
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          disabled={isSubmitting}
        />
        {formErrors.nom && <p className="text-danger text-xs mt-1">{formErrors.nom}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Prénom</label>
        <input
          type="text"
          name="prenom"
          value={formData.prenom || ''}
          onChange={onChange}
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          disabled={isSubmitting}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Email</label>
        <input
          type="email"
          name="email"
          value={formData.email || ''}
          onChange={onChange}
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          disabled={isSubmitting}
        />
        {formErrors.email && <p className="text-danger text-xs mt-1">{formErrors.email}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Téléphone</label>
        <input
          type="tel"
          name="telephone"
          value={formData.telephone || ''}
          onChange={onChange}
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          disabled={isSubmitting}
        />
        {formErrors.telephone && <p className="text-danger text-xs mt-1">{formErrors.telephone}</p>}
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-primary mb-1">Adresse</label>
        <input
          type="text"
          name="adresse"
          value={formData.adresse || ''}
          onChange={onChange}
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          disabled={isSubmitting}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Date de naissance</label>
        <input
          type="date"
          name="date_naissance"
          value={formData.date_naissance || ''}
          onChange={onChange}
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          disabled={isSubmitting}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Type de pièce</label>
        <select
          name="type_piece"
          value={formData.type_piece || ''}
          onChange={onChange}
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          disabled={isSubmitting}
        >
          <option value="">Sélectionner</option>
          <option value="CIN">Carte d'identité</option>
          <option value="Passeport">Passeport</option>
          <option value="Permis">Permis de conduire</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Numéro de pièce</label>
        <input
          type="text"
          name="numero_piece"
          value={formData.numero_piece || ''}
          onChange={onChange}
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          disabled={isSubmitting}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Code client</label>
        <input
          type="text"
          name="code_client"
          value={formData.code_client || ''}
          readOnly
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-muted cursor-not-allowed focus:outline-none"
          placeholder={`Généré automatiquement (CH…/${new Date().getFullYear()})`}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Statut</label>
        <select
          name="statut"
          value={formData.statut || 'ACTIF'}
          onChange={onChange}
          className="w-full px-4 py-2.5 bg-surface-2 border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          disabled={isSubmitting}
        >
          <option value="ACTIF">Actif</option>
          <option value="INACTIF">Inactif</option>
          <option value="BLOCKED">Bloqué</option>
        </select>
      </div>
    </div>

    <div className="border-t border-base pt-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="is_casino_player"
          checked={formData.is_casino_player || false}
          onChange={onChange}
          className="w-4 h-4 rounded border-base text-accent focus:ring-accent"
          disabled={isSubmitting}
        />
        <span>🎰 Joueur de casino</span>
      </label>
    </div>

    <div className="space-y-4 border-t border-base pt-4">
      <SignaturePad
        value={signature}
        onChange={onSignatureChange}
        disabled={isSubmitting}
        label="Signature électronique du client"
      />
    </div>
  </>
);
