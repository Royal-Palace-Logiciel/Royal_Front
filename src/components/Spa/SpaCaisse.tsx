// Caisse piscine : composition d'une vente (entrées, locations, abonnements),
// client de l'hôtel, ventes de la session en cours et clôture.
import React, { useEffect, useMemo, useState } from 'react';
import { Hotel, Lock, Minus, Plus, Printer, Trash2, X } from 'lucide-react';
import { Button, Input, Modal, Select } from '../UI';
import { formatCurrency } from '../../utils/data';
import { openPrintWindow } from '../../utils/thermalPrint';
import { reservationService } from '../../services/reservation.service';
import spaService, {
  SPA_CATEGORIE_LABELS, SPA_PAYMENT_LABELS, SpaCaisse as SpaCaisseData, SpaCategorie, SpaPaymentMethod, SpaTarif,
} from '../../services/spa.service';
import { printSpaClosure, printSpaVente } from './spaPrint';

interface Props {
  tarifs: SpaTarif[];
  onChanged: () => void;
  notify: (message: string, type?: 'success' | 'error') => void;
}

type HotelGuest = { reservationId: number; label: string; clientNom: string; chambre: string };

const CATEGORIES: SpaCategorie[] = ['ENTREE', 'LOCATION', 'ABONNEMENT'];
const PAYMENTS: SpaPaymentMethod[] = ['ESPECES', 'TPE', 'ORANGE_MONEY', 'MVOLA', 'CHAMBRE', 'OFFERT'];
const errorMessage = (error: any, fallback: string) => error?.response?.data?.error?.message || error?.message || fallback;

export const SpaCaisse: React.FC<Props> = ({ tarifs, onChanged, notify }) => {
  const [caisse, setCaisse] = useState<SpaCaisseData | null>(null);
  const [panier, setPanier] = useState<Record<number, number>>({});
  const [moyenPaiement, setMoyenPaiement] = useState<SpaPaymentMethod>('ESPECES');
  const [clientNom, setClientNom] = useState('');
  const [clientTelephone, setClientTelephone] = useState('');
  const [guests, setGuests] = useState<HotelGuest[]>([]);
  const [reservationId, setReservationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const loadCaisse = async () => {
    try {
      setCaisse(await spaService.getCaisse());
    } catch (error) {
      notify(errorMessage(error, 'Impossible de charger la caisse piscine.'), 'error');
    }
  };

  useEffect(() => { void loadCaisse(); }, []);

  const isHotelPayment = moyenPaiement === 'CHAMBRE' || moyenPaiement === 'OFFERT';
  useEffect(() => {
    if (!isHotelPayment || guests.length > 0) return;
    reservationService.getReservations().then((reservations: any[]) => {
      const active = ['CONFIRMEE', 'CHECKED_IN', 'EN_COURS'];
      setGuests(reservations
        .filter((reservation) => active.includes(reservation?.statut))
        .map((reservation) => {
          const nom = [reservation.client?.prenom ?? reservation.client_prenom, reservation.client?.nom ?? reservation.client_nom].filter(Boolean).join(' ') || `Client #${reservation.client_id ?? reservation.id}`;
          const chambre = reservation.room?.numero ? `Chambre ${reservation.room.numero}` : (reservation.room_id ? `Chambre ${reservation.room_id}` : 'Chambre');
          return { reservationId: Number(reservation.id), clientNom: nom, chambre, label: `${chambre} — ${nom}` };
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')));
    }).catch(() => notify('La liste des clients de l’hôtel n’a pas pu être chargée.', 'error'));
  }, [isHotelPayment]);

  const lignes = useMemo(() => tarifs
    .filter((tarif) => (panier[tarif.id] || 0) > 0)
    .map((tarif) => ({ tarif, quantite: panier[tarif.id] })), [tarifs, panier]);
  const total = lignes.reduce((sum, ligne) => sum + ligne.tarif.prix * ligne.quantite, 0);
  const hasAbonnement = lignes.some((ligne) => ligne.tarif.categorie === 'ABONNEMENT');
  const selectedGuest = guests.find((guest) => String(guest.reservationId) === reservationId);

  const changeQuantity = (tarifId: number, delta: number) => {
    setPanier((current) => {
      const next = Math.max(0, (current[tarifId] || 0) + delta);
      const copy = { ...current };
      if (next === 0) delete copy[tarifId]; else copy[tarifId] = next;
      return copy;
    });
  };

  const resetVente = () => {
    setPanier({});
    setClientNom('');
    setClientTelephone('');
    setReservationId('');
    setMoyenPaiement('ESPECES');
  };

  const handleVente = async () => {
    if (lignes.length === 0) return notify('Ajoutez au moins un article.', 'error');
    if (isHotelPayment && !selectedGuest) return notify('Choisissez le client de l’hôtel.', 'error');
    const nom = clientNom.trim() || selectedGuest?.clientNom || '';
    if (hasAbonnement && !nom) return notify('Saisissez le nom du client pour l’abonnement.', 'error');
    const printWindow = openPrintWindow();
    setSaving(true);
    try {
      const vente = await spaService.createVente({
        lignes: lignes.map((ligne) => ({ tarifId: ligne.tarif.id, quantite: ligne.quantite })),
        moyenPaiement,
        clientNom: nom || undefined,
        clientTelephone: clientTelephone.trim() || undefined,
        hotelReservationId: isHotelPayment ? selectedGuest?.reservationId : null,
        chambre: isHotelPayment ? selectedGuest?.chambre : undefined,
      });
      printSpaVente(vente, printWindow);
      notify(`Vente enregistrée : ${formatCurrency(vente.montant)}`);
      resetVente();
      await loadCaisse();
      onChanged();
    } catch (error) {
      printWindow?.close();
      notify(errorMessage(error, 'La vente n’a pas pu être enregistrée.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm(`Annuler la vente n° ${id} ? Les abonnements qu’elle a créés seront supprimés.`)) return;
    try {
      await spaService.cancelVente(id);
      notify('Vente annulée.');
      await loadCaisse();
      onChanged();
    } catch (error) {
      notify(errorMessage(error, 'La vente n’a pas pu être annulée.'), 'error');
    }
  };

  const handleClose = async () => {
    const printWindow = openPrintWindow();
    setSaving(true);
    try {
      const closure = await spaService.closeCaisse();
      printSpaClosure(closure, printWindow);
      notify(`Caisse clôturée : ${formatCurrency(closure.summary.totalEncaisse)} encaissés.`);
      setConfirmClose(false);
      await loadCaisse();
      onChanged();
    } catch (error) {
      printWindow?.close();
      notify(errorMessage(error, 'La clôture a échoué.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const summary = caisse?.summary;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <section className="space-y-4 rounded-2xl border border-base bg-surface p-4 sm:p-5">
        <h3 className="text-primary font-semibold">Nouvelle vente</h3>
        {CATEGORIES.map((categorie) => {
          const items = tarifs.filter((tarif) => tarif.categorie === categorie);
          if (items.length === 0) return null;
          return (
            <div key={categorie}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{SPA_CATEGORIE_LABELS[categorie]}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((tarif) => {
                  const quantite = panier[tarif.id] || 0;
                  return (
                    <div key={tarif.id} className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition ${quantite ? 'border-accent bg-accent-4' : 'border-base bg-surface-2'}`}>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => changeQuantity(tarif.id, 1)}>
                        <span className="block truncate text-sm font-medium text-primary">{tarif.nom}</span>
                        <span className="text-xs text-accent">{formatCurrency(tarif.prix)}</span>
                        {tarif.categorie === 'ABONNEMENT' && (
                          <span className="block text-[11px] text-muted">
                            {[tarif.nbEntrees ? `${tarif.nbEntrees} entrées` : null, tarif.dureeJours ? `${tarif.dureeJours} jours` : null].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </button>
                      {quantite > 0 && (
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label="Retirer" className="rounded-lg border border-base bg-surface p-1 text-secondary" onClick={() => changeQuantity(tarif.id, -1)}><Minus size={14} /></button>
                          <span className="w-6 text-center text-sm font-bold text-primary">{quantite}</span>
                          <button type="button" aria-label="Ajouter" className="rounded-lg border border-base bg-surface p-1 text-secondary" onClick={() => changeQuantity(tarif.id, 1)}><Plus size={14} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {tarifs.length === 0 && <p className="text-sm text-muted">Aucun tarif actif. Un administrateur peut en créer dans l’onglet Tarifs.</p>}

        <div className="grid gap-3 border-t border-base pt-4 sm:grid-cols-2">
          <Select
            label="Paiement"
            value={moyenPaiement}
            onChange={(event) => setMoyenPaiement(event.target.value as SpaPaymentMethod)}
            options={PAYMENTS.map((method) => ({ value: method, label: SPA_PAYMENT_LABELS[method] }))}
          />
          {isHotelPayment ? (
            <Select
              label="Client de l’hôtel"
              value={reservationId}
              onChange={(event) => setReservationId(event.target.value)}
              options={[{ value: '', label: guests.length ? 'Choisir une chambre…' : 'Aucune réservation en cours' }, ...guests.map((guest) => ({ value: String(guest.reservationId), label: guest.label }))]}
            />
          ) : (
            <Input label={hasAbonnement ? 'Nom du client *' : 'Nom du client (facultatif)'} value={clientNom} onChange={(event) => setClientNom(event.target.value)} placeholder="Ex. Rakoto Jean" />
          )}
          {(hasAbonnement || !isHotelPayment) && (
            <Input label="Téléphone (facultatif)" value={clientTelephone} onChange={(event) => setClientTelephone(event.target.value)} placeholder="034 00 000 00" />
          )}
          {isHotelPayment && hasAbonnement && (
            <Input label="Nom de l’abonné (si différent)" value={clientNom} onChange={(event) => setClientNom(event.target.value)} placeholder={selectedGuest?.clientNom || ''} />
          )}
        </div>
        {isHotelPayment && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Hotel size={14} />
            {moyenPaiement === 'CHAMBRE' ? 'Le montant est porté sur la note de la chambre (visible dans le module Hôtel).' : 'Entrée offerte au client de l’hôtel : rien n’est encaissé.'}
          </p>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-base bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted">Total</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
          </div>
          <div className="flex gap-2">
            {lignes.length > 0 && <Button variant="secondary" icon={<X size={16} />} onClick={resetVente}>Vider</Button>}
            <Button icon={<Printer size={16} />} onClick={handleVente} disabled={saving || lignes.length === 0}>
              {saving ? 'Enregistrement…' : 'Encaisser et imprimer'}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-base bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-primary font-semibold">Caisse en cours</h3>
            {caisse && <p className="text-xs text-muted">Ouverte le {new Date(caisse.session.ouvertAt).toLocaleString('fr-FR')}</p>}
          </div>
          <Button variant="danger" size="sm" icon={<Lock size={14} />} onClick={() => setConfirmClose(true)} disabled={!summary}>Clôturer</Button>
        </div>
        {summary && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface-2 p-2"><p className="text-[11px] text-muted">Ventes</p><p className="font-bold text-primary">{summary.nombreVentes}</p></div>
            <div className="rounded-xl bg-surface-2 p-2"><p className="text-[11px] text-muted">Entrées</p><p className="font-bold text-primary">{summary.nombreEntrees}</p></div>
            <div className="rounded-xl bg-surface-2 p-2"><p className="text-[11px] text-muted">Encaissé</p><p className="font-bold text-accent">{formatCurrency(summary.totalEncaisse)}</p></div>
          </div>
        )}
        <div className="max-h-[480px] space-y-2 overflow-y-auto">
          {caisse?.ventes.length === 0 && <p className="py-6 text-center text-sm text-muted">Aucune vente depuis l’ouverture.</p>}
          {caisse?.ventes.map((vente) => (
            <div key={vente.id} className="rounded-xl border border-base p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">
                    n° {vente.id} · {formatCurrency(vente.montant)}
                    <span className="ml-2 text-xs font-normal text-muted">{SPA_PAYMENT_LABELS[vente.moyenPaiement]}</span>
                  </p>
                  <p className="truncate text-xs text-muted">{vente.lignes.map((ligne) => `${ligne.quantite} × ${ligne.nom}`).join(', ')}</p>
                  {(vente.clientNom || vente.chambre) && <p className="truncate text-xs text-secondary">{[vente.clientNom, vente.chambre].filter(Boolean).join(' — ')}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" title="Réimprimer" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-primary" onClick={() => printSpaVente(vente)}><Printer size={15} /></button>
                  <button type="button" title="Annuler la vente" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-danger" onClick={() => void handleCancel(vente.id)}><Trash2 size={15} /></button>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-subtle">{new Date(vente.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          ))}
        </div>
      </section>

      <Modal isOpen={confirmClose} onClose={() => setConfirmClose(false)} title="Clôturer la caisse piscine" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            {summary?.nombreVentes || 0} vente(s), {formatCurrency(summary?.totalEncaisse || 0)} encaissés. Le ticket de clôture sera imprimé et une nouvelle caisse s’ouvrira.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmClose(false)}>Annuler</Button>
            <Button className="flex-1" onClick={handleClose} disabled={saving}>{saving ? 'Clôture…' : 'Clôturer'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
