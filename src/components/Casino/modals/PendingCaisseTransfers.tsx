import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, X, RefreshCcw } from 'lucide-react';
import { Badge, Button, ErrorBanner, formatAriary, formatDateTime } from '../common';
import { caisseTransfersApi } from '../../../services/caisseTransfers.service';
import { CaisseTransferModal } from './CaisseTransferModal';
import type { CashSession } from '../../../types/casino.types';
import type { CaisseTransfer } from '../../../types/caisseTransfers.types';
import { caisseLabel } from '../../../types/caisseTransfers.types';

interface PendingCaisseTransfersProps {
  /** Session de caisse casino pour laquelle afficher les transferts en attente. */
  casinoSession: CashSession;
  onChanged?: () => void;
}

/**
 * Transferts EN_ATTENTE touchant une session de caisse casino donnée
 * (comme source ou destination), avec actions :
 *  - entrant  → Confirmer / Refuser (réception physique)
 *  - sortant  → Procéder (rouvre le formulaire pré-rempli pour corriger et
 *    recréer) / Refuser (annule sans remplacement)
 *
 * « Procéder » ne modifie jamais le transfert existant (aucune route PUT
 * côté backend) : il crée un nouveau transfert avec les mêmes valeurs
 * pré-remplies, puis refuse l'ancien une fois le nouveau créé avec succès.
 */
export const PendingCaisseTransfers: React.FC<PendingCaisseTransfersProps> = ({ casinoSession, onChanged }) => {
  const [transfers, setTransfers] = useState<CaisseTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [proceedingTransfer, setProceedingTransfer] = useState<CaisseTransfer | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await caisseTransfersApi.pendingForCasinoSession(casinoSession.id);
      setTransfers(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erreur de chargement des transferts en attente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casinoSession.id]);

  async function handleConfirm(t: CaisseTransfer) {
    setActingId(t.id);
    setError(null);
    try {
      await caisseTransfersApi.confirm(t.id);
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erreur lors de la confirmation.');
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(t: CaisseTransfer) {
    const motif = window.prompt('Motif du refus (montant physique différent, etc.) :') || undefined;
    setActingId(t.id);
    setError(null);
    try {
      await caisseTransfersApi.reject(t.id, { motif_refus: motif });
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erreur lors du refus.');
    } finally {
      setActingId(null);
    }
  }

  async function handleProceedSuccess(created: CaisseTransfer) {
    const old = proceedingTransfer;
    setProceedingTransfer(null);
    if (old) {
      try {
        await caisseTransfersApi.reject(old.id, { motif_refus: `Remplacé par le transfert #${created.id}` });
      } catch {
        // best effort : le nouveau transfert existe déjà ; un échec ici
        // n'est pas bloquant, juste visible dans la liste après rechargement
      }
    }
    await load();
    onChanged?.();
  }

  if (loading) return null; // discret : ne bloque pas l'écran de caisse
  if (transfers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {error && <ErrorBanner message={error} />}
      <p className="text-secondary text-xs font-semibold">
        Transferts en attente de confirmation ({transfers.length})
      </p>
      {transfers.map((t) => {
        const entrant = t.module_destination === 'CASINO' && t.session_destination_id === casinoSession.id;
        const autreLabel = entrant
          ? caisseLabel(t.module_source, t.session_source_id, t.cashier_source_code, t.cashier_source_nom)
          : caisseLabel(t.module_destination, t.session_destination_id, t.cashier_destination_code, t.cashier_destination_nom);

        return (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-xl p-3"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {entrant ? (
                <ArrowDownToLine size={16} className="flex-shrink-0" style={{ color: '#3b82f6' }} />
              ) : (
                <ArrowUpFromLine size={16} className="flex-shrink-0" style={{ color: '#ef4444' }} />
              )}
              <div className="min-w-0">
                <p className="text-primary text-sm font-semibold truncate">
                  {formatAriary(t.montant)} — {entrant ? 'à recevoir de' : 'envoyé vers'} {autreLabel}
                </p>
                <p className="text-muted text-[11px] truncate">
                  {t.motif || 'Sans motif'} · {formatDateTime(t.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {entrant ? (
                <>
                  <Button
                    className="text-[11px] py-1"
                    icon={<Check size={12} />}
                    onClick={() => handleConfirm(t)}
                    disabled={actingId === t.id}
                  >
                    Confirmer
                  </Button>
                  <Button
                    variant="secondary"
                    className="text-[11px] py-1"
                    icon={<X size={12} />}
                    onClick={() => handleReject(t)}
                    disabled={actingId === t.id}
                  >
                    Refuser
                  </Button>
                </>
              ) : (
                <>
                  <Badge tone="warning">En attente de {autreLabel}</Badge>
                  <Button
                    variant="secondary"
                    className="text-[11px] py-1"
                    icon={<RefreshCcw size={12} />}
                    onClick={() => setProceedingTransfer(t)}
                    disabled={actingId === t.id}
                  >
                    Procéder
                  </Button>
                  <Button
                    variant="secondary"
                    className="text-[11px] py-1"
                    icon={<X size={12} />}
                    onClick={() => handleReject(t)}
                    disabled={actingId === t.id}
                  >
                    Refuser
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {proceedingTransfer && (
        <CaisseTransferModal
          casinoSession={casinoSession}
          prefill={proceedingTransfer}
          onClose={() => setProceedingTransfer(null)}
          onSuccess={handleProceedSuccess}
        />
      )}
    </div>
  );
};

export default PendingCaisseTransfers;