// src/utils/hotelReceipt.ts
// Tickets 80 mm (imprimante thermique) pour l'Hôtel :
//  - le ticket de la réservation (détail des prestations, déjà payé, reste à payer)
//  - l'historique des paiements (paiement initial + rectifications)
import { Reservation, ReservationExtraService, ReservationPayment } from '../types/hotel.types';
import { formatCurrency } from './data';
import { escapeHtml, printThermal, thermalHeader } from './thermalPrint';

export interface HotelReceiptData {
  reservationId?: number;
  clientName: string;
  roomNumber: string;
  dateArrivee?: string;
  dateDepart?: string;
  typeReservation?: string;
  pdjInclus?: boolean;
  hebergement: number;
  laundry: number;
  remisePourcentage?: number;
  extras: ReservationExtraService[];
  total: number;
  montantPaye: number;
  montantEncaisse?: number;
  montantCredit?: number;
  montantGratuit?: number;
  payments: ReservationPayment[];
  rectificationLines?: Array<{ label: string; montant: number }>;
}

const paymentLabels: Record<string, string> = {
  ESPECES: 'Espèces', TPE: 'TPE', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
  CARTE: 'Carte bancaire', VIREMENT: 'Virement', CREDIT: 'Crédit', GRATUIT: 'Gratuit',
};

const formatDay = (value?: string) => (value ? new Date(value).toLocaleDateString('fr-FR') : '—');
const formatDateTimeFr = (value?: string) => (value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const nightsBetween = (from?: string, to?: string) => {
  if (!from || !to) return 0;
  return Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
};

const RECEIPT_CSS = `
  .due { border: 1px solid #000; margin-top: 5px; padding: 4px; font-weight: bold; font-size: 14px; }
  .paid { font-weight: bold; }
`;

const printTicket = (title: string, body: string) => printThermal(title, body, { css: RECEIPT_CSS });

const headerMarkup = (title: string, data: HotelReceiptData) => `
  ${thermalHeader(title, data.reservationId ? [`Réservation n° ${data.reservationId}`] : [])}
  <p><strong>Client :</strong> ${escapeHtml(data.clientName || '—')}</p>
  <p><strong>Chambre :</strong> ${escapeHtml(data.roomNumber || '—')}</p>
  <p><strong>Séjour :</strong> ${escapeHtml(formatDay(data.dateArrivee))} → ${escapeHtml(formatDay(data.dateDepart))} (${nightsBetween(data.dateArrivee, data.dateDepart)} nuit(s))</p>
`;

const paymentsMarkup = (payments: ReservationPayment[]) => payments.map((payment, index) => {
  const modes = payment.details?.modes_paiement || [];
  const modeLines = modes.map((mode) => `
    <div class="row"><span>${escapeHtml(paymentLabels[mode.moyen_paiement] || mode.moyen_paiement)}</span><span>${escapeHtml(formatCurrency(mode.montant))}</span></div>
  `).join('');
  return `
    <div class="line">
      <div class="row paid"><span>Encaissement n°${index + 1}</span><span>${escapeHtml(formatCurrency(payment.montant))}</span></div>
      ${modeLines || `<div class="sub">${escapeHtml(paymentLabels[payment.moyen_paiement || ''] || payment.moyen_paiement || '—')}</div>`}
      <div class="sub">${escapeHtml(formatDateTimeFr(payment.created_at))}${payment.created_by_nom ? ` · ${escapeHtml(`${payment.created_by_prenom || ''} ${payment.created_by_nom}`.trim())}` : ''}</div>
      ${Number(payment.montant_encaisse || 0) > 0 ? `<div class="sub">Argent reçu : ${escapeHtml(formatCurrency(payment.montant_encaisse || 0))}</div>` : ''}
      ${Number(payment.montant_credit || 0) > 0 ? `<div class="sub">Crédit : ${escapeHtml(formatCurrency(payment.montant_credit || 0))}</div>` : ''}
      ${Number(payment.montant_gratuit || 0) > 0 ? `<div class="sub">Gratuit autorisé : ${escapeHtml(formatCurrency(payment.montant_gratuit || 0))}</div>` : ''}
    </div>
  `;
}).join('');

const balanceMarkup = (data: HotelReceiptData) => {
  const due = Math.round((data.total - data.montantPaye) * 100) / 100;
  return `
    <div class="row total"><span>TOTAL RÉSERVATION</span><span>${escapeHtml(formatCurrency(data.total))}</span></div>
    ${Number(data.montantEncaisse || 0) > 0 ? `<div class="row"><span>Argent encaissé</span><span>${escapeHtml(formatCurrency(data.montantEncaisse || 0))}</span></div>` : ''}
    ${Number(data.montantGratuit || 0) > 0 ? `<div class="row"><span>Couvert gratuitement</span><span>${escapeHtml(formatCurrency(data.montantGratuit || 0))}</span></div>` : ''}
    ${Number(data.montantCredit || 0) > 0 ? `<div class="row"><span>Crédit restant</span><span>${escapeHtml(formatCurrency(data.montantCredit || 0))}</span></div>` : ''}
    ${data.montantPaye > 0 ? `<div class="row"><span>Déjà couvert</span><span>- ${escapeHtml(formatCurrency(data.montantPaye))}</span></div>` : ''}
    <div class="row due"><span>${due > 0 ? 'RESTE À PAYER' : due < 0 ? 'TROP-PERÇU' : 'SOLDÉ'}</span><span>${escapeHtml(formatCurrency(Math.abs(due)))}</span></div>
  `;
};

// Ticket de la réservation : toutes les prestations + historique + reste à payer.
export const printReservationTicket = (data: HotelReceiptData) => {
  const extras = data.extras.map((item) => `
    <div class="line">
      <div class="row"><span>${item.type === 'TRANSFERT' ? 'Transfert' : 'Excursion'} : ${escapeHtml(item.description)}</span><span>${escapeHtml(formatCurrency(Number(item.prix) || 0))}</span></div>
      ${(item.date || item.heure || item.personnes) ? `<div class="sub">${escapeHtml([item.date ? formatDay(item.date) : '', item.heure, item.personnes ? `${item.personnes} pers.` : ''].filter(Boolean).join(' · '))}</div>` : ''}
    </div>`).join('');

  const body = `
    ${headerMarkup('Ticket réservation', data)}
    <p><strong>Type :</strong> ${data.typeReservation === 'BOOKING' ? 'Booking.com' : 'Sur place'} · ${data.pdjInclus ? 'PDJ inclus' : 'PDJ non inclus'}</p>
    <h2>PRESTATIONS</h2>
    <div class="row line"><span>Hébergement</span><span>${escapeHtml(formatCurrency(data.hebergement))}</span></div>
    ${data.laundry > 0 ? `<div class="row line"><span>Blanchisserie</span><span>${escapeHtml(formatCurrency(data.laundry))}</span></div>` : ''}
    ${Number(data.remisePourcentage || 0) > 0 ? `<div class="row line"><span>Remise hébergement</span><span>${data.remisePourcentage}%</span></div>` : ''}
    ${extras}
    ${data.payments.length ? `<h2>PAIEMENTS</h2>${paymentsMarkup(data.payments)}` : ''}
    ${data.rectificationLines && data.rectificationLines.length ? `<h2>RECTIFICATION</h2>${data.rectificationLines.map((line) => `<div class="row line"><span>${escapeHtml(line.label)}</span><span>${line.montant > 0 ? '+' : ''}${escapeHtml(formatCurrency(line.montant))}</span></div>`).join('')}` : ''}
    ${balanceMarkup(data)}
    <div class="footer"><p>Merci de votre visite</p></div>
  `;
  printTicket(`Réservation ${data.reservationId ?? ''}`, body);
};

// Ticket de l'historique des paiements uniquement.
export const printPaymentHistoryTicket = (data: HotelReceiptData) => {
  const body = `
    ${headerMarkup('Historique des paiements', data)}
    <h2>PAIEMENTS</h2>
    ${data.payments.length ? paymentsMarkup(data.payments) : '<p class="muted">Aucun paiement enregistré.</p>'}
    <div class="row total"><span>TOTAL COUVERT</span><span>${escapeHtml(formatCurrency(data.montantPaye))}</span></div>
    ${balanceMarkup(data)}
    <div class="footer"><p>Merci de votre visite</p></div>
  `;
  printTicket(`Historique paiements ${data.reservationId ?? ''}`, body);
};

// Construit les données du ticket depuis une réservation telle que renvoyée par l'API
// (utilisé depuis la liste des réservations).
export const receiptDataFromReservation = (reservation: Reservation & { client_nom?: string; client_prenom?: string; room_numero?: string }, payments: ReservationPayment[]): HotelReceiptData => {
  let extras: ReservationExtraService[] = [];
  if (Array.isArray(reservation.services_extras)) extras = reservation.services_extras;
  else if (reservation.services_extras) {
    try { const parsed = JSON.parse(reservation.services_extras); extras = Array.isArray(parsed) ? parsed : []; } catch { extras = []; }
  }
  const extrasTotal = extras.reduce((sum, item) => sum + (Number(item.prix) || 0), 0);
  const laundry = reservation.laundry_included ? Number(reservation.laundry_price || 0) : 0;
  const total = Number(reservation.montant_total || 0);
  const clientName = reservation.client
    ? `${reservation.client.prenom || ''} ${reservation.client.nom || ''}`.trim()
    : `${reservation.client_prenom || ''} ${reservation.client_nom || ''}`.trim();
  return {
    reservationId: reservation.id,
    clientName,
    roomNumber: String(reservation.room?.numero ?? reservation.room_numero ?? ''),
    dateArrivee: reservation.date_arrivee,
    dateDepart: reservation.date_depart,
    typeReservation: reservation.type_reservation,
    pdjInclus: Boolean(reservation.pdj_inclus),
    hebergement: Math.max(0, total - extrasTotal - laundry),
    laundry,
    remisePourcentage: Number(reservation.remise_pourcentage || 0),
    extras,
    total,
    montantPaye: Number(reservation.montant_paye || 0),
    montantEncaisse: Number(reservation.montant_encaisse ?? reservation.montant_paye ?? 0),
    montantCredit: Number(reservation.montant_credit || 0),
    montantGratuit: Number(reservation.montant_gratuit || 0),
    payments,
  };
};
