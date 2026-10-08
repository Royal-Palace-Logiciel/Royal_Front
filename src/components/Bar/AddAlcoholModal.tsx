// src/components/Bar/AddAlcoholModal.tsx
import React, { useState } from 'react';
import { BarProduct } from '../../types/bar.type';
import { Button, Input, Modal, Select } from '../UI';
import { Plus } from 'lucide-react';
import alcoholService from '../../services/alcohol.service';
import { useToast } from '../../context/ToastContext';

interface Props {
  onProductAdded?: (newProduct: BarProduct) => void;
  onStockUpdate?: () => void;
}

export const AddAlcoholModal: React.FC<Props> = ({ onProductAdded, onStockUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  // États du formulaire d'ajout
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('Alcools');
  const [sousCategorie, setSousCategorie] = useState('');
  const [prix, setPrix] = useState('');
  const [quantite, setQuantite] = useState('');
  const [seuilMinimum, setSeuilMinimum] = useState('5');
  const [unite, setUnite] = useState('cl');
  const [alcool, setAlcool] = useState(true);

  const getSubcategories = (category: string) => {
    if (category === 'Cocktails') return ['Avec alcool', 'Sans alcool'];
    if (category === 'Bières & Soft') return ['PM', 'GM'];
    return [];
  };

  const handleOpenModal = () => {
    setNom('');
    setCategorie('Alcools');
    setSousCategorie('');
    setPrix('');
    setQuantite('');
    setSeuilMinimum('5');
    setUnite('cl');
    setAlcool(true);
    setIsModalOpen(true);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNom = nom.trim();
    const parsedPrix = Number(prix.toString().replace(',', '.'));
    const parsedQuantite = Number(quantite);
    const parsedSeuil = Number(seuilMinimum);

    if (!trimmedNom || Number.isNaN(parsedPrix) || parsedPrix < 0) {
      showToast('Veuillez renseigner un nom et un prix valide.', 'error');
      return;
    }

    if (Number.isNaN(parsedQuantite) || parsedQuantite < 0) {
      showToast('Veuillez renseigner un stock initial valide.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        nom: trimmedNom,
        categorie: sousCategorie ? `${categorie} > ${sousCategorie}` : categorie,
        prix: parsedPrix,
        alcool,
        quantite: parsedQuantite,
        seuil_minimum: parsedSeuil,
        unite: unite.trim() || 'cl',
      };

      const created = await alcoholService.createAlcoholProduct(payload);

      showToast('Boisson et stock ajoutés avec succès', 'success');
      if (onProductAdded) {
        onProductAdded(created);
      }
      if (onStockUpdate) {
        onStockUpdate();
      }
      setIsModalOpen(false);
    } catch (err) {
      showToast("Erreur lors de la création de la boisson", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button icon={<Plus size={18} />} onClick={handleOpenModal} className="whitespace-nowrap">
        Ajouter une boisson
      </Button>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Ajouter une nouvelle boisson" size="md">
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <Input
            label="Nom de la boisson"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex: Mojito, Whisky..."
          />
          <Select
            label="Catégorie"
            value={categorie}
            onChange={(e) => { setCategorie(e.target.value); setSousCategorie(''); }}
            options={[
              { value: 'Alcools', label: 'Alcools' },
              { value: 'Bières & Soft', label: 'Bières & Soft' },
              { value: 'Cocktails', label: 'Cocktails' },
              { value: 'Sans alcool', label: 'Sans alcool' },
            ]}
          />
          {getSubcategories(categorie).length > 0 && (
            <Select
              label="Sous-catégorie"
              value={sousCategorie}
              onChange={(e) => setSousCategorie(e.target.value)}
              options={[{ value: '', label: 'Sélectionner une sous-catégorie' }, ...getSubcategories(categorie).map((value) => ({ value, label: value }))]}
            />
          )}
          <Input
            label="Prix (MGA)"
            type="number"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            placeholder="Ex: 4000"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Stock initial"
              type="number"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              placeholder="Ex: 50"
            />
            <Input
              label="Seuil d'alerte min."
              type="number"
              value={seuilMinimum}
              onChange={(e) => setSeuilMinimum(e.target.value)}
              placeholder="Ex: 5"
            />
          </div>

          <Select
            label="Unité (dosage)"
            value={unite}
            onChange={(e) => setUnite(e.target.value)}
            options={[
              { value: 'cl', label: 'cl' },
              { value: 'L', label: 'L' },
            ]}
          />

          <Select
            label="Contient de l'alcool ?"
            value={alcool ? 'oui' : 'non'}
            onChange={(e) => setAlcool(e.target.value === 'oui')}
            options={[
              { value: 'oui', label: 'Oui' },
              { value: 'non', label: 'Non' },
            ]}
          />

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};