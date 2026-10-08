import React, { useEffect, useState } from 'react';
import { Boxes, PackagePlus, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import barService, { BarEquipmentPayload } from '../../services/bar.service';
import type { BarEquipment } from '../../types/bar.type';
import { apiMessage } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button, Input, Modal, Select } from '../UI';

const emptyForm = (): BarEquipmentPayload => ({
  nom: '',
  categorie: 'Divers',
  description: '',
  quantite: 1,
  etat: 'EN_SERVICE',
});

const equipmentStates: Record<BarEquipment['etat'], { label: string; className: string }> = {
  EN_SERVICE: { label: 'En service', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  A_REPARER: { label: 'À réparer', className: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  HORS_SERVICE: { label: 'Hors service', className: 'border-red-500/30 bg-red-500/10 text-red-400' },
};

export const BarEquipmentManager: React.FC = () => {
  const [equipments, setEquipments] = useState<BarEquipment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<BarEquipment | null>(null);
  const [form, setForm] = useState<BarEquipmentPayload>(emptyForm);
  const { showToast } = useToast();

  const loadEquipments = async () => {
    setLoading(true);
    setError(null);
    let lastError: unknown;
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await barService.getBarEquipments();
          const rows = Array.isArray(response) ? response : response.data;
          setEquipments(Array.isArray(rows) ? rows : []);
          return;
        } catch (err) {
          lastError = err;
          if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
      }
      const detail = lastError instanceof Error ? lastError.message : '';
      setError(apiMessage(lastError) || (detail ? `Impossible de charger les équipements du bar. (${detail})` : 'Impossible de charger les équipements du bar.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEquipments();
  }, []);

  const openCreateModal = () => {
    setEditingEquipment(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (equipment: BarEquipment) => {
    setEditingEquipment(equipment);
    setForm({
      nom: equipment.nom,
      categorie: equipment.categorie || 'Divers',
      description: equipment.description || '',
      quantite: Number(equipment.quantite),
      etat: equipment.etat,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { ...form, nom: form.nom.trim(), categorie: form.categorie.trim() || 'Divers' };
    if (!payload.nom) {
      setError("Le nom de l'équipement est requis.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingEquipment) {
        await barService.updateBarEquipment(editingEquipment.id, payload);
        showToast('Équipement modifié', 'success');
      } else {
        await barService.createBarEquipment(payload);
        showToast('Équipement ajouté', 'success');
      }
      setIsModalOpen(false);
      await loadEquipments();
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      setError(apiMessage(err) || (detail ? `L'équipement n'a pas pu être enregistré. (${detail})` : "L'équipement n'a pas pu être enregistré."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (equipment: BarEquipment) => {
    if (!window.confirm(`Supprimer l’équipement « ${equipment.nom} » ?`)) return;
    try {
      await barService.deleteBarEquipment(equipment.id);
      showToast('Équipement supprimé', 'success');
      await loadEquipments();
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      setError(apiMessage(err) || (detail ? `L'équipement n'a pas pu être supprimé. (${detail})` : "L'équipement n'a pas pu être supprimé."));
    }
  };

  const visibleEquipments = equipments.filter((equipment) => {
    const query = search.trim().toLowerCase();
    return !query || equipment.nom.toLowerCase().includes(query) || equipment.categorie.toLowerCase().includes(query);
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-base bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Boxes size={21} />
          </div>
          <div>
            <h2 className="font-semibold text-primary">Équipement du bar</h2>
            <p className="text-sm text-muted">{equipments.length} équipement{equipments.length === 1 ? '' : 's'} enregistré{equipments.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un équipement" className="pl-9" aria-label="Rechercher un équipement" />
          </div>
          <Button icon={<Plus size={17} />} onClick={openCreateModal} className="justify-center whitespace-nowrap">
            Ajouter un équipement
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => void loadEquipments()} disabled={loading} className="inline-flex items-center gap-2 rounded-md px-2 py-1 font-medium text-red-200 transition hover:bg-red-500/10 disabled:opacity-50">
            <RefreshCw size={14} />
            Réessayer
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-base bg-surface p-8 text-center text-sm text-muted">Chargement des équipements…</div>
      ) : visibleEquipments.length === 0 ? (
        <div className="rounded-xl border border-base bg-surface px-4 py-12 text-center">
          <PackagePlus size={28} className="mx-auto text-muted" />
          <p className="mt-3 font-medium text-primary">{search ? 'Aucun résultat' : 'Aucun équipement enregistré'}</p>
          <p className="mt-1 text-sm text-muted">{search ? 'Essayez un autre nom ou une autre catégorie.' : 'Ajoutez le premier équipement du bar.'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleEquipments.map((equipment) => {
            const state = equipmentStates[equipment.etat] || equipmentStates.EN_SERVICE;
            return (
              <article key={equipment.id} className="rounded-xl border border-base bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary">{equipment.nom}</p>
                    <p className="mt-1 text-sm text-muted">{equipment.categorie || 'Divers'} · Quantité : {equipment.quantite}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${state.className}`}>{state.label}</span>
                </div>
                {equipment.description && <p className="mt-3 whitespace-pre-wrap text-sm text-secondary">{equipment.description}</p>}
                <div className="mt-4 flex justify-end gap-2 border-t border-base pt-3">
                  <button type="button" onClick={() => openEditModal(equipment)} title="Modifier" aria-label={`Modifier ${equipment.nom}`} className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-primary">
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => void handleDelete(equipment)} title="Supprimer" aria-label={`Supprimer ${equipment.nom}`} className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEquipment ? 'Modifier un équipement' : 'Ajouter un équipement'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nom de l’équipement" value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} placeholder="Ex. Shaker, machine à glaçons" required />
          <Input label="Catégorie" value={form.categorie} onChange={(event) => setForm({ ...form, categorie: event.target.value })} placeholder="Ex. Bar, cuisine, mobilier" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Quantité" type="number" min="0" step="1" value={form.quantite} onChange={(event) => setForm({ ...form, quantite: Number(event.target.value) })} required />
            <Select
              label="État"
              value={form.etat}
              onChange={(event) => setForm({ ...form, etat: event.target.value as BarEquipment['etat'] })}
              options={[
                { value: 'EN_SERVICE', label: 'En service' },
                { value: 'A_REPARER', label: 'À réparer' },
                { value: 'HORS_SERVICE', label: 'Hors service' },
              ]}
            />
          </div>
          <label className="block text-sm text-secondary">
            <span className="mb-1 block">Description</span>
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="w-full rounded-xl border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:ring-2 focus:ring-accent/50" placeholder="Détails complémentaires" />
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1 justify-center">Annuler</Button>
            <Button type="submit" disabled={saving} icon={saving ? undefined : <Plus size={16} />} className="flex-1 justify-center">
              {saving ? 'Enregistrement…' : editingEquipment ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
};