// Historique des clôtures de caisse piscine, avec détail et réimpression du ticket.
import React, { useEffect, useState } from 'react';
import { Eye, Printer } from 'lucide-react';
import { Modal } from '../UI';
import { formatCurrency } from '../../utils/data';
import { openPrintWindow } from '../../utils/thermalPrint';
import spaService, { SPA_PAYMENT_LABELS, SpaClosure } from '../../services/spa.service';
import { printSpaClosure } from './spaPrint';

interface Props {
  refreshKey: number;
  notify: (message: string, type?: 'success' | 'error') => void;
}

export const SpaHistorique: React.FC<Props> = ({ refreshKey, notify }) => {
  const [closures, setClosures] = useState<SpaClosure[]>([]);
  const [selected, setSelected] = useState<SpaClosure | null>(null);

  useEffect(() => {
    spaService.getClosures().then(setClosures).catch(() => notify('Impossible de charger les clôtures.', 'error'));
  }, [refreshKey]);

  const openDetail = async (id: number) => {
    try {
      setSelected(await spaService.getClosure(id));
    } catch {
      notify('Détail de clôture indisponible.', 'error');
    }
  };

  const reprint = async (id: number) => {
    const printWindow = openPrintWindow();
    try {
      printSpaClosure(await spaService.getClosure(id), printWindow);
    } catch {
      printWindow?.close();
      notify('Impression impossible.', 'error');
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-base bg-surface p-4 sm:p-5">
      <h3 className="text-primary font-semibold">Clôtures de caisse</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead><tr><th className="p-3">Date de clôture</th><th>Référence</th><th>Ventes</th><th>Entrées</th><th>Encaissé</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {closures.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">Aucune clôture.</td></tr>}
            {closures.map((closure) => (
              <tr key={closure.id}>
                <td className="p-3">{new Date(closure.dateCloture).toLocaleString('fr-FR')}</td>
                <td className="text-xs">{closure.reference}</td>
                <td>{closure.summary.nombreVentes}</td>
                <td>{closure.summary.nombreEntrees}</td>
                <td className="font-semibold">{formatCurrency(closure.summary.totalEncaisse)}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <button type="button" title="Détail" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-primary" onClick={() => void openDetail(closure.id)}><Eye size={15} /></button>
                    <button type="button" title="Réimprimer" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-primary" onClick={() => void reprint(closure.id)}><Printer size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `Clôture ${selected.reference}` : ''} size="lg">
        {selected && (
          <div className="max-h-[65vh] space-y-2 overflow-y-auto">
            {selected.ventes?.length === 0 && <p className="text-sm text-muted">Aucune vente dans cette clôture.</p>}
            {selected.ventes?.map((vente) => (
              <div key={vente.id} className="flex justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">n° {vente.id} · {vente.lignes.map((ligne) => `${ligne.quantite} × ${ligne.nom}`).join(', ')}</p>
                  <p className="text-xs text-muted">{new Date(vente.date).toLocaleString('fr-FR')}{vente.clientNom ? ` · ${vente.clientNom}` : ''}{vente.chambre ? ` · ${vente.chambre}` : ''}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatCurrency(vente.montant)}</p>
                  <p className="text-xs text-muted">{SPA_PAYMENT_LABELS[vente.moyenPaiement]}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </section>
  );
};
