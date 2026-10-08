// Tarifs piscine (administrateur) : entrées, locations et formules d'abonnement.
import React, { useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Select } from '../UI';
import { formatCurrency } from '../../utils/data';
import spaService, { SPA_CATEGORIE_LABELS, SpaCategorie, SpaTarif, SpaTarifInput } from '../../services/spa.service';

interface Props {
  tarifs: SpaTarif[];
  onChanged: () => void;
  notify: (message: string, type?: 'success' | 'error') => void;
}

const EMPTY: SpaTarifInput = { nom: '', categorie: 'ENTREE', prix: 0, nbEntrees: null, dureeJours: null, actif: true, ordre: 0 };
const errorMessage = (error: any, fallback: string) => error?.response?.data?.error?.message || error?.message || fallback;
const optionalNumber = (value: string) => (value.trim() === '' ? null : Number(value));

export const SpaTarifs: React.FC<Props> = ({ tarifs, onChanged, notify }) => {
  const [editing, setEditing] = useState<{ id: number | null; form: SpaTarifInput } | null>(null);
  const [saving, setSaving] = useState(false);

  const setForm = (patch: Partial<SpaTarifInput>) => setEditing((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) await spaService.updateTarif(editing.id, editing.form);
      else await spaService.createTarif(editing.form);
      notify('Tarif enregistré.');
      setEditing(null);
      onChanged();
    } catch (error) {
      notify(errorMessage(error, 'Le tarif n’a pas pu être enregistré.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (tarif: SpaTarif) => {
    if (!window.confirm(`Désactiver « ${tarif.nom} » ? Il ne sera plus proposé à la vente.`)) return;
    try {
      await spaService.deleteTarif(tarif.id);
      notify('Tarif désactivé.');
      onChanged();
    } catch (error) {
      notify(errorMessage(error, 'Le tarif n’a pas pu être désactivé.'), 'error');
    }
  };

  const form = editing?.form;

  return (
    <section className="space-y-4 rounded-2xl border border-base bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-primary font-semibold">Tarifs</h3>
          <p className="text-xs text-muted">Prix des entrées, des locations et des abonnements proposés à la caisse.</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setEditing({ id: null, form: { ...EMPTY } })}>Nouveau tarif</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead><tr><th className="p-3">Nom</th><th>Catégorie</th><th>Prix</th><th>Abonnement</th><th>État</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {tarifs.map((tarif) => (
              <tr key={tarif.id} className={tarif.actif ? '' : 'opacity-60'}>
                <td className="p-3 font-medium">{tarif.nom}</td>
                <td>{SPA_CATEGORIE_LABELS[tarif.categorie]}</td>
                <td>{formatCurrency(tarif.prix)}</td>
                <td className="text-xs">{tarif.categorie === 'ABONNEMENT' ? [tarif.nbEntrees ? `${tarif.nbEntrees} entrées` : null, tarif.dureeJours ? `${tarif.dureeJours} jours` : null].filter(Boolean).join(' · ') : '—'}</td>
                <td className="text-xs">{tarif.actif ? 'Actif' : 'Désactivé'}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <button type="button" title="Modifier" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-primary" onClick={() => setEditing({ id: tarif.id, form: { nom: tarif.nom, categorie: tarif.categorie, prix: tarif.prix, nbEntrees: tarif.nbEntrees, dureeJours: tarif.dureeJours, actif: tarif.actif, ordre: tarif.ordre } })}><Edit2 size={15} /></button>
                    {tarif.actif && <button type="button" title="Désactiver" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => void handleDisable(tarif)}><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier le tarif' : 'Nouveau tarif'} size="md">
        {form && (
          <div className="space-y-4">
            <Input label="Nom" value={form.nom} onChange={(event) => setForm({ nom: event.target.value })} placeholder="Ex. Entrée adulte" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Catégorie"
                value={form.categorie}
                onChange={(event) => setForm({ categorie: event.target.value as SpaCategorie })}
                options={(Object.keys(SPA_CATEGORIE_LABELS) as SpaCategorie[]).map((categorie) => ({ value: categorie, label: SPA_CATEGORIE_LABELS[categorie] }))}
              />
              <Input label="Prix (Ar)" type="number" min="0" step="500" value={String(form.prix)} onChange={(event) => setForm({ prix: Number(event.target.value) })} />
            </div>
            {form.categorie === 'ABONNEMENT' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Nombre d’entrées (vide = illimité)" type="number" min="1" value={form.nbEntrees ?? ''} onChange={(event) => setForm({ nbEntrees: optionalNumber(event.target.value) })} />
                <Input label="Durée en jours (vide = sans limite)" type="number" min="1" value={form.dureeJours ?? ''} onChange={(event) => setForm({ dureeJours: optionalNumber(event.target.value) })} />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Ordre d’affichage" type="number" value={String(form.ordre)} onChange={(event) => setForm({ ordre: Number(event.target.value) || 0 })} />
              <label className="flex items-center gap-2 self-end pb-3 text-sm">
                <input type="checkbox" checked={form.actif} onChange={(event) => setForm({ actif: event.target.checked })} />
                Proposé à la vente
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>Annuler</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !form.nom.trim()}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};
