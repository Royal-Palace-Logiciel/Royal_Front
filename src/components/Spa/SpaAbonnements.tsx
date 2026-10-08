// Abonnements piscine : recherche d'un abonné, enregistrement de son entrée, historique des passages.
import React, { useEffect, useState } from 'react';
import { History, LogIn, Search, XCircle } from 'lucide-react';
import { Button, Modal } from '../UI';
import spaService, { SpaAbonnement, SpaAbonnementStatut } from '../../services/spa.service';

interface Props {
  refreshKey: number;
  canCancel: boolean;
  notify: (message: string, type?: 'success' | 'error') => void;
}

const STATUT_STYLES: Record<SpaAbonnementStatut, { label: string; className: string }> = {
  ACTIF: { label: 'Actif', className: 'bg-success text-success' },
  EXPIRE: { label: 'Expiré', className: 'bg-warning text-warning' },
  EPUISE: { label: 'Épuisé', className: 'bg-warning text-warning' },
  ANNULE: { label: 'Annulé', className: 'bg-danger text-danger' },
};
const formatDay = (value: string | null) => (value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR') : '—');
const errorMessage = (error: any, fallback: string) => error?.response?.data?.error?.message || error?.message || fallback;

export const SpaAbonnements: React.FC<Props> = ({ refreshKey, canCancel, notify }) => {
  const [abonnements, setAbonnements] = useState<SpaAbonnement[]>([]);
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [history, setHistory] = useState<{ abonnement: SpaAbonnement; passages: Array<{ id: number; date: string; enregistrePar: string }> } | null>(null);

  const load = async (q = search) => {
    setLoading(true);
    try {
      setAbonnements(await spaService.getAbonnements(q.trim()));
    } catch (error) {
      notify(errorMessage(error, 'Impossible de charger les abonnements.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [refreshKey]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const handlePassage = async (abonnement: SpaAbonnement) => {
    setBusyId(abonnement.id);
    try {
      const updated = await spaService.addPassage(abonnement.id);
      setAbonnements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notify(`Entrée enregistrée pour ${updated.clientNom}${updated.entreesRestantes !== null ? ` — ${updated.entreesRestantes} restante(s)` : ''}.`);
    } catch (error) {
      notify(errorMessage(error, 'L’entrée n’a pas pu être enregistrée.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (abonnement: SpaAbonnement) => {
    if (!window.confirm(`Annuler l’abonnement ${abonnement.numero} de ${abonnement.clientNom} ? Il ne pourra plus être utilisé.`)) return;
    try {
      await spaService.cancelAbonnement(abonnement.id);
      notify('Abonnement annulé.');
      await load();
    } catch (error) {
      notify(errorMessage(error, 'L’abonnement n’a pas pu être annulé.'), 'error');
    }
  };

  const openHistory = async (abonnement: SpaAbonnement) => {
    try {
      setHistory({ abonnement, passages: await spaService.getPassages(abonnement.id) });
    } catch (error) {
      notify(errorMessage(error, 'Historique indisponible.'), 'error');
    }
  };

  const visible = abonnements.filter((abonnement) => !onlyActive || abonnement.statut === 'ACTIF');

  return (
    <section className="space-y-4 rounded-2xl border border-base bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-primary font-semibold">Abonnements</h3>
          <p className="text-xs text-muted">Un abonnement se vend depuis la caisse. Ici, on enregistre l’entrée de l’abonné.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, téléphone ou n°" className="h-10 w-full pl-9 pr-3 text-sm sm:w-64" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} />
            Actifs seulement
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr><th className="p-3">Abonné</th><th>Formule</th><th>Validité</th><th>Entrées</th><th>Statut</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {loading && visible.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">Chargement…</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">Aucun abonnement.</td></tr>}
            {visible.map((abonnement) => (
              <tr key={abonnement.id}>
                <td className="p-3">
                  <p className="font-medium">{abonnement.clientNom}</p>
                  <p className="text-xs text-muted">{[abonnement.numero, abonnement.clientTelephone].filter(Boolean).join(' · ')}</p>
                </td>
                <td>{abonnement.formule}</td>
                <td className="text-xs">{formatDay(abonnement.dateDebut)} → {abonnement.dateFin ? formatDay(abonnement.dateFin) : 'sans limite'}</td>
                <td className="text-xs">
                  {abonnement.entreesRestantes !== null ? `${abonnement.entreesRestantes} / ${abonnement.entreesTotal} restantes` : 'Illimité'}
                  <span className="block text-muted">{abonnement.nombrePassages || 0} passage(s)</span>
                </td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUT_STYLES[abonnement.statut].className}`}>{STATUT_STYLES[abonnement.statut].label}</span></td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" icon={<LogIn size={14} />} disabled={abonnement.statut !== 'ACTIF' || busyId === abonnement.id} onClick={() => void handlePassage(abonnement)}>Entrée</Button>
                    <button type="button" title="Historique des passages" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-primary" onClick={() => void openHistory(abonnement)}><History size={15} /></button>
                    {canCancel && abonnement.statut === 'ACTIF' && (
                      <button type="button" title="Annuler l’abonnement" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => void handleCancel(abonnement)}><XCircle size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={Boolean(history)} onClose={() => setHistory(null)} title={history ? `Passages — ${history.abonnement.clientNom}` : ''} size="md">
        {history && (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {history.passages.length === 0 && <p className="text-sm text-muted">Aucun passage enregistré.</p>}
            {history.passages.map((passage) => (
              <div key={passage.id} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span>{new Date(passage.date).toLocaleString('fr-FR')}</span>
                <span className="text-muted">{passage.enregistrePar}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </section>
  );
};
