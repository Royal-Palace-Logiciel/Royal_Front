import React, { useState } from 'react';
import { Modal, Input, Select, Button } from '../../UI';

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const TableModal: React.FC<TableModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    numero: '',
    capacite: 4,
    statut: 'LIBRE' as const
  });

  const handleSubmit = () => {
    if (!form.numero) return;
    onSubmit(form);
    setForm({ numero: '', capacite: 4, statut: 'LIBRE' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter une table" size="lg">
      <div className="space-y-4">
        <Input 
          label="Numéro de table" 
          value={form.numero} 
          onChange={(e) => setForm({...form, numero: e.target.value})} 
          placeholder="Ex: T1, VIP1, Terrasse2..." 
        />
        <Input 
          label="Capacité (nombre de personnes)" 
          type="number" 
          value={form.capacite} 
          onChange={(e) => setForm({...form, capacite: Number(e.target.value)})} 
          min={1}
          max={20}
        />
        <Select 
          label="Statut initial" 
          value={form.statut} 
          onChange={(e) => setForm({...form, statut: e.target.value as any})}
          options={[
            { value: 'LIBRE', label: 'Libre' },
            { value: 'HORS_SERVICE', label: 'Hors service' },
          ]}
        />
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={!form.numero}>
            Ajouter
          </Button>
        </div>
      </div>
    </Modal>
  );
};