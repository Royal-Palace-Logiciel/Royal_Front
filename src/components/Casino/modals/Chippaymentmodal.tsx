import React, { useEffect, useMemo, useState } from 'react';
import { Coins, CheckCircle2 } from 'lucide-react';
import { Modal, Field, NumberInput, Select, Button, ErrorBanner, Spinner, formatAriary } from '../common';
import { PlayerSelector } from '../PlayerSelector';
import { chipTypesApi, chipsApi } from '../../../services/casino.service';
import type { ChipType, ChipTransaction, ModuleCiblePaiementJetons, SelectedPlayer } from '../../../types/casino.types';

interface ChipPaymentModalProps {
  /** Département qui encaisse le paiement (recette imputée à ce module). */
  moduleCible: ModuleCiblePaiementJetons;
  /** Montant total de la commande, en Ariary — sert de repère de conversion. */
  montantAPayer: number;
  /** Id de la commande/facture du module cible, pour rattacher le paiement. */
  referenceCommandeId?: number;
  onClose: () => void;
  onSuccess: (tx: ChipTransaction) => void;
}

/**
 * Encaisse un paiement en jetons pour une commande d'un autre département
 * (Restaurant, Bar, Boutique, Hébergement). Le client doit être identifié
 * (carte scannée ou fiche client) — un paiement en jetons ne peut pas être
 * anonyme, contrairement à un buy-in casino.
 *
 * À intégrer à l'écran de checkout du module cible :
 *   <ChipPaymentModal moduleCible="RESTAURANT" montantAPayer={commande.total}
 *     referenceCommandeId={commande.id} onClose={...} onSuccess={...} />
 */
export const ChipPaymentModal: React.FC<ChipPaymentModalProps> = ({
  moduleCible,
  montantAPayer,
  referenceCommandeId,
  onClose,
  onSuccess,
}) => {
  const [chipTypes, setChipTypes] = useState<ChipType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [chipTypeId, setChipTypeId] = useState<number | ''>('');
  const [quantite, setQuantite] = useState('');
  const [player, setPlayer] = useState<SelectedPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await chipTypesApi.list();
        const actifs = data.filter((c) => c.statut === 'ACTIF');
        setChipTypes(actifs);
        if (actifs.length) setChipTypeId(actifs[0].id);
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement des types de jetons.');
      } finally {
        setLoadingTypes(false);
      }
    })();
  }, []);

  const selectedType = useMemo(() => chipTypes.find((c) => c.id === chipTypeId), [chipTypes, chipTypeId]);
  const total = selectedType && quantite ? selectedType.valeur_nominale * Number(quantite) : 0;
  const ecart = total - montantAPayer;

  // Suggestion automatique de la quantité couvrant le montant à payer.
  useEffect(() => {
    if (selectedType && !quantite) {
      const suggestion = Math.ceil(montantAPayer / selectedType.valeur_nominale);
      if (suggestion > 0) setQuantite(String(suggestion));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  async function handleSubmit() {
    const qty = Number(quantite);
    if (!player) {
      setError('Le paiement en jetons nécessite un client identifié (carte ou fiche).');
      return;
    }
    if (!chipTypeId) {
      setError('Sélectionnez un type de jeton.');
      return;
    }
    if (!qty || qty <= 0) {
      setError('Quantité invalide.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tx = await chipsApi.pay({
        client_id: player.client.id,
        chip_type_id: Number(chipTypeId),
        quantite: qty,
        module_cible: moduleCible,
        reference_commande_id: referenceCommandeId,
      });
      onSuccess(tx);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du paiement en jetons.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Paiement en jetons"
      subtitle={`Montant à régler : ${formatAriary(montantAPayer)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<CheckCircle2 size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Encaissement…' : 'Encaisser'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        <PlayerSelector value={player} onChange={setPlayer} />
        <p className="text-muted text-[11px] -mt-2">
          Un paiement en jetons doit toujours être rattaché à un client identifié.
        </p>

        {loadingTypes ? (
          <Spinner label="Chargement des jetons…" />
        ) : (
          <Field label="Type de jeton remis" required>
            <Select value={chipTypeId} onChange={(e) => setChipTypeId(Number(e.target.value))}>
              {chipTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} — {formatAriary(c.valeur_nominale)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Quantité de jetons remis" required>
          <NumberInput value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="10" min={1} />
        </Field>

        {!!total && (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-primary font-semibold">
              Valeur remise : <span style={{ color: 'var(--color-accent)' }}>{formatAriary(total)}</span>
            </p>
            {ecart !== 0 && (
              <p className="text-xs" style={{ color: ecart > 0 ? '#3b82f6' : '#ef4444' }}>
                {ecart > 0
                  ? `Excédent de ${formatAriary(ecart)} — à rendre en espèces ou à créditer.`
                  : `Insuffisant de ${formatAriary(-ecart)} — complétez avec un autre moyen de paiement.`}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ChipPaymentModal;