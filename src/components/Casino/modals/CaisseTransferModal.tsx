import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Send } from 'lucide-react';
import { Modal, Field, NumberInput, TextInput, TextArea, Select, Button, ErrorBanner, formatAriary } from '../common';
import { sessionsApi, cashiersApi } from '../../../services/casino.service';
import { caisseTransfersApi } from '../../../services/caisseTransfers.service';
import type { CashSession, Cashier } from '../../../types/casino.types';
import type { CaisseTransfer, ModuleCaisse } from '../../../types/caisseTransfers.types';
import { CAISSE_TRANSFER_MODULES_SUPPORTES, MODULE_CAISSE_LABELS } from '../../../types/caisseTransfers.types';

interface CaisseTransferModalProps {
  /** Session de caisse casino à partir de laquelle on déclare le transfert. */
  casinoSession: CashSession;
  /**
   * Transfert existant à reprendre (bouton « Procéder » sur un transfert
   * sortant en attente) : pré-remplit sens/module/caisse/montant/motif.
   * Le transfert d'origine n'est PAS modifié par ce composant — c'est à
   * l'appelant de le refuser/annuler une fois le nouveau créé avec succès.
   */
  prefill?: CaisseTransfer;
  onClose: () => void;
  onSuccess: (created: CaisseTransfer) => void;
}

type Sens = 'ENVOI' | 'RECEPTION';

function computeInitialState(casinoSessionId: number, prefill?: CaisseTransfer) {
  if (!prefill) {
    return {
      sens: 'ENVOI' as Sens,
      moduleAutre: 'RESTAURANT' as ModuleCaisse,
      casinoSessionCibleId: '' as number | '',
      sessionAutreId: '',
      montant: '',
      motif: '',
    };
  }
  const sens: Sens = prefill.module_source === 'CASINO' && prefill.session_source_id === casinoSessionId ? 'ENVOI' : 'RECEPTION';
  const moduleAutre = sens === 'ENVOI' ? prefill.module_destination : prefill.module_source;
  const idAutre = sens === 'ENVOI' ? prefill.session_destination_id : prefill.session_source_id;
  return {
    sens,
    moduleAutre,
    casinoSessionCibleId: moduleAutre === 'CASINO' ? idAutre : ('' as number | ''),
    sessionAutreId: moduleAutre !== 'CASINO' ? String(idAutre) : '',
    montant: String(prefill.montant),
    motif: prefill.motif || '',
  };
}

/**
 * Déclare un transfert de fonds entre la caisse casino courante et une
 * autre caisse (casino ou autre département). Ce n'est PAS un crédit
 * client — pure remise de fonds entre deux tiroirs de caisse. Le transfert
 * reste `EN_ATTENTE` tant que la caisse destinataire n'a pas confirmé la
 * réception physique (voir `PendingCaisseTransfers`).
 */
export const CaisseTransferModal: React.FC<CaisseTransferModalProps> = ({ casinoSession, prefill, onClose, onSuccess }) => {
  const initial = useMemo(() => computeInitialState(casinoSession.id, prefill), [casinoSession.id, prefill]);
  const sensVerrouille = !!prefill;

  const [sens, setSens] = useState<Sens>(initial.sens);
  const [moduleAutre, setModuleAutre] = useState<ModuleCaisse>(initial.moduleAutre);
  const [otherCasinoSessions, setOtherCasinoSessions] = useState<CashSession[]>([]);
  const [casinoCashiers, setCasinoCashiers] = useState<Cashier[]>([]);
  const [casinoSessionCibleId, setCasinoSessionCibleId] = useState<number | ''>(initial.casinoSessionCibleId);
  const [sessionAutreId, setSessionAutreId] = useState(initial.sessionAutreId);
  const [montant, setMontant] = useState(initial.montant);
  const [motif, setMotif] = useState(initial.motif);
  const [soldeTheorique, setSoldeTheorique] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Utile seulement si l'autre caisse est aussi une caisse casino (ex :
    // transfert entre deux salles). Permet de choisir dans une liste plutôt
    // que de saisir un id à l'aveugle, avec le code de caisse affiché.
    (async () => {
      try {
        const [sessions, cashiers] = await Promise.all([sessionsApi.active(), cashiersApi.list()]);
        setOtherCasinoSessions(sessions.filter((s) => s.id !== casinoSession.id));
        setCasinoCashiers(cashiers);
      } catch {
        // non bloquant : on retombe sur la saisie manuelle
      }
    })();
  }, [casinoSession.id]);

  useEffect(() => {
    // Repère indicatif seulement : le backend recalcule et fait foi (il
    // déduit en plus les transferts déjà EN_ATTENTE sur cette session, ce
    // que ce résumé ne fait pas). Chargé uniquement quand cette caisse est
    // la source, puisque c'est le seul cas où le solde peut bloquer l'envoi.
    if (sens !== 'ENVOI') {
      setSoldeTheorique(null);
      return;
    }
    (async () => {
      try {
        const summary = await sessionsApi.summary(casinoSession.id);
        setSoldeTheorique(summary.solde_theorique);
      } catch {
        setSoldeTheorique(null);
      }
    })();
  }, [sens, casinoSession.id]);

  const nonSupporte = !CAISSE_TRANSFER_MODULES_SUPPORTES.includes(moduleAutre);

  function cashierLabelFor(session: CashSession): string {
    const cashier = casinoCashiers.find((c) => c.id === session.cashier_id);
    return cashier ? `${cashier.code} — ${cashier.nom}` : `caisse #${session.cashier_id}`;
  }

  async function handleSubmit() {
    const amount = Number(montant);
    if (!amount || amount <= 0) {
      setError('Montant invalide.');
      return;
    }
    if (nonSupporte) {
      setError(`${MODULE_CAISSE_LABELS[moduleAutre]} n'a pas encore de session de caisse dédiée — transfert impossible pour l'instant.`);
      return;
    }

    const idAutreCaisse = moduleAutre === 'CASINO' ? Number(casinoSessionCibleId) : Number(sessionAutreId);
    if (!idAutreCaisse) {
      setError(moduleAutre === 'CASINO' ? "Sélectionnez la caisse casino destinataire/source." : `Renseignez l'id de session ${MODULE_CAISSE_LABELS[moduleAutre]}.`);
      return;
    }

    if (sens === 'ENVOI' && soldeTheorique !== null && amount > soldeTheorique) {
      setError(`Fonds insuffisants en caisse (solde théorique : ${formatAriary(soldeTheorique)}, demandé : ${formatAriary(amount)}).`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const created = await caisseTransfersApi.create({
        module_source: sens === 'ENVOI' ? 'CASINO' : moduleAutre,
        session_source_id: sens === 'ENVOI' ? casinoSession.id : idAutreCaisse,
        module_destination: sens === 'ENVOI' ? moduleAutre : 'CASINO',
        session_destination_id: sens === 'ENVOI' ? idAutreCaisse : casinoSession.id,
        montant: amount,
        motif: motif.trim() || undefined,
      });
      onSuccess(created);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erreur lors de la déclaration du transfert.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={prefill ? `Nouveau transfert (reprise du #${prefill.id})` : 'Transfert de fonds entre caisses'}
      subtitle="Déclaration — le transfert ne sera effectif qu'après confirmation de la caisse destinataire"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<Send size={16} />} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Envoi…' : prefill ? 'Recréer le transfert' : 'Déclarer le transfert'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        {prefill && (
          <p className="text-muted text-[11px]">
            Le transfert #{prefill.id} sera remplacé par celui-ci une fois créé avec succès (il passera à « Refusé »).
          </p>
        )}

        <Field label="Sens du transfert">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => !sensVerrouille && setSens('ENVOI')}
              disabled={sensVerrouille}
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium"
              style={{
                backgroundColor: sens === 'ENVOI' ? 'var(--color-accent)' : 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: sens === 'ENVOI' ? '#000' : 'inherit',
                opacity: sensVerrouille && sens !== 'ENVOI' ? 0.5 : 1,
                cursor: sensVerrouille ? 'not-allowed' : 'pointer',
              }}
            >
              <ArrowRightLeft size={16} /> Cette caisse envoie
            </button>
            <button
              onClick={() => !sensVerrouille && setSens('RECEPTION')}
              disabled={sensVerrouille}
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium"
              style={{
                backgroundColor: sens === 'RECEPTION' ? 'var(--color-accent)' : 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: sens === 'RECEPTION' ? '#000' : 'inherit',
                opacity: sensVerrouille && sens !== 'RECEPTION' ? 0.5 : 1,
                cursor: sensVerrouille ? 'not-allowed' : 'pointer',
              }}
            >
              <ArrowRightLeft size={16} /> Cette caisse reçoit
            </button>
          </div>
          <p className="text-muted text-[11px] mt-1">
            Caisse casino courante : <strong>#{casinoSession.id}</strong>. « Envoie » = source, « reçoit » = destination.
            {sensVerrouille && ' Sens verrouillé lors de la reprise d\'un transfert (changer de sens créerait un transfert incohérent avec l\'ancien).'}
          </p>
        </Field>

        <Field label={sens === 'ENVOI' ? 'Caisse destinataire' : 'Caisse émettrice'} required>
          <Select value={moduleAutre} onChange={(e) => setModuleAutre(e.target.value as ModuleCaisse)}>
            {Object.entries(MODULE_CAISSE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
                {!CAISSE_TRANSFER_MODULES_SUPPORTES.includes(value as ModuleCaisse) ? ' (bientôt disponible)' : ''}
              </option>
            ))}
          </Select>
        </Field>

        {nonSupporte && (
          <ErrorBanner
            message={`${MODULE_CAISSE_LABELS[moduleAutre]} n'a pas encore de table de session de caisse dédiée côté backend — ce module n'est pas encore raccordé aux transferts.`}
          />
        )}

        {!nonSupporte && moduleAutre === 'CASINO' && (
          <Field label="Session de caisse casino concernée" required>
            <Select value={casinoSessionCibleId} onChange={(e) => setCasinoSessionCibleId(Number(e.target.value))}>
              <option value="">— Sélectionner —</option>
              {otherCasinoSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {cashierLabelFor(s)} (session #{s.id})
                </option>
              ))}
            </Select>
            {otherCasinoSessions.length === 0 && (
              <p className="text-muted text-[11px] mt-1">Aucune autre session de caisse casino ouverte actuellement.</p>
            )}
          </Field>
        )}

        {!nonSupporte && moduleAutre !== 'CASINO' && (
          <Field
            label={`Id de session ${MODULE_CAISSE_LABELS[moduleAutre]}`}
            required
            hint="À obtenir auprès du caissier de ce département (pas encore de sélecteur inter-modules)."
          >
            <TextInput
              type="number"
              value={sessionAutreId}
              onChange={(e) => setSessionAutreId(e.target.value)}
              placeholder="14"
            />
          </Field>
        )}

        <Field label="Montant (Ariary)" required>
          <NumberInput value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="200000" min={1} />
        </Field>

        {sens === 'ENVOI' && soldeTheorique !== null && (
          <p
            className={`text-[11px] -mt-2 ${Number(montant) > soldeTheorique ? '' : 'text-muted'}`}
            style={Number(montant) > soldeTheorique ? { color: '#ef4444' } : undefined}
          >
            Solde théorique de la caisse #{casinoSession.id} : {formatAriary(soldeTheorique)}
          </p>
        )}

        <Field label="Motif">
          <TextArea value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Appoint pour le service du soir" rows={2} />
        </Field>

        {!!Number(montant) && (
          <p className="text-muted text-[11px]">
            Aucune écriture n'est générée à cette étape — {formatAriary(Number(montant))} ne sera comptabilisé
            qu'après confirmation de réception par la caisse destinataire.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default CaisseTransferModal;