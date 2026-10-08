import React, { useState } from 'react';
import { Modal, Input, Select, Button } from '../../UI';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse: '',
    type_piece: '',
    numero_piece: ''
  });

  const handleSubmit = () => {
    if (!form.nom || !form.prenom) return;
    onSubmit(form);
    setForm({ nom: '', prenom: '', telephone: '', email: '', adresse: '', type_piece: '', numero_piece: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau Client" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Nom" 
            value={form.nom} 
            onChange={(e) => setForm({...form, nom: e.target.value})} 
            placeholder="Nom" 
          />
          <Input 
            label="Prénom" 
            value={form.prenom} 
            onChange={(e) => setForm({...form, prenom: e.target.value})} 
            placeholder="Prénom" 
          />
        </div>
        <Input 
          label="Téléphone" 
          value={form.telephone} 
          onChange={(e) => setForm({...form, telephone: e.target.value})} 
          placeholder="+261 34 12 345 67" 
        />
        <Input 
          label="Email" 
          type="email" 
          value={form.email} 
          onChange={(e) => setForm({...form, email: e.target.value})} 
          placeholder="email@exemple.com" 
        />
        <Input 
          label="Adresse" 
          value={form.adresse} 
          onChange={(e) => setForm({...form, adresse: e.target.value})} 
          placeholder="Adresse complète" 
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select 
            label="Type de pièce" 
            value={form.type_piece} 
            onChange={(e) => setForm({...form, type_piece: e.target.value})}
            options={[
              { value: '', label: 'Sélectionner' },
              { value: 'CIN', label: 'CIN' },
              { value: 'PASSEPORT', label: 'Passeport' },
              { value: 'PERMIS', label: 'Permis de conduire' },
            ]}
          />
          <Input 
            label="Numéro de pièce" 
            value={form.numero_piece} 
            onChange={(e) => setForm({...form, numero_piece: e.target.value})} 
            placeholder="Numéro" 
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={!form.nom || !form.prenom}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
};