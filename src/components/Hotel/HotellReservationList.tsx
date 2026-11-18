// components/Hotel/ReservationList.tsx
import React, { useState, useEffect } from 'react';
import { Reservation, ReservationPayment } from '../../types/hotel.types';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/data';
import {
  Calendar,
  Edit,
  X,
  Loader,
  AlertCircle,
  Trash2,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  User,
  UserCheck,
  DoorOpen,
  CreditCard,
  Printer,
  Plus,
  Save
} from 'lucide-react';
import { printReservationTicket, receiptDataFromReservation } from '../../utils/hotelReceipt';
import { useReservations } from '../../hooks/useReservations';
import { useClients } from '../../hooks/useClients';
import { useRooms } from '../../hooks/useRooms';
import { toast } from 'react-hot-toast';
import AuthService from '../../services/authService';
import { reservationService } from '../../services/reservation.service';
import api from '../../lib/api';
import spaService from '../../services/spa.service';
import { escapeHtml } from '../../utils/thermalPrint';

interface ReservationListProps {
  reservations?: Reservation[];
  onEdit?: (reservation: Reservation) => void;
  onEncaisser?: (reservation: Reservation) => void;
  onCheckIn?: (reservation: Reservation) => void;
  onCancel?: (reservationId: number) => void;
  onDelete?: (reservationId: number) => void;
  refreshTrigger?: number;
  paymentCancelledTrigger?: number;
  view?: 'active' | 'history';
}

const numberBelowThousandInFrench = (value: number): string => {
  const units = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
  const underHundred = (n: number): string => {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 70) {
      const ten = Math.floor(n / 10);
      const unit = n % 10;
      if (unit === 0) return tens[ten];
      if (unit === 1) return `${tens[ten]} et un`;
      return `${tens[ten]}-${units[unit]}`;
    }
    if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${teens[n - 70]}`;
    if (n === 80) return 'quatre-vingts';
    return `quatre-vingt-${n < 90 ? units[n - 80] : teens[n - 90]}`;
  };
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const prefix = hundreds === 0 ? '' : hundreds === 1 ? 'cent' : `${units[hundreds]} cent${remainder === 0 ? 's' : ''}`;
  return [prefix, remainder ? underHundred(remainder) : ''].filter(Boolean).join(' ');
};

const amountInFrenchWords = (amount: number): string => {
  let value = Math.max(0, Math.round(Number(amount) || 0));
  if (value === 0) return 'zéro';
  const parts: string[] = [];
  const billions = Math.floor(value / 1_000_000_000);
  if (billions) { parts.push(`${numberBelowThousandInFrench(billions)} milliard${billions > 1 ? 's' : ''}`); value %= 1_000_000_000; }
  const millions = Math.floor(value / 1_000_000);
  if (millions) { parts.push(`${numberBelowThousandInFrench(millions)} million${millions > 1 ? 's' : ''}`); value %= 1_000_000; }
  const thousands = Math.floor(value / 1000);
  if (thousands) { parts.push(`${thousands === 1 ? '' : `${numberBelowThousandInFrench(thousands)} `}mille`); value %= 1000; }
  if (value) parts.push(numberBelowThousandInFrench(value));
  return parts.join(' ');
};

export const ReservationList: React.FC<ReservationListProps> = ({ onEdit, onEncaisser, onCheckIn, refreshTrigger, paymentCancelledTrigger, view = 'active' }) => {
  const {
    reservations,
    loading: reservationsLoading,
    error: reservationsError,
    stats,
    loadReservations,
    cancelReservation,
    deleteReservation
  } = useReservations();

  const { clients, loading: clientsLoading, loadClients } = useClients();
  const { rooms, loading: roomsLoading, loadRooms } = useRooms();
  const [users, setUsers] = useState<any[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<string>('TOUS');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedPayments, setExpandedPayments] = useState<ReservationPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [enrichedReservations, setEnrichedReservations] = useState<Reservation[]>([]);
  const [checkedOutReservationIds, setCheckedOutReservationIds] = useState<Set<number>>(new Set());
  const [staysLoading, setStaysLoading] = useState(true);
  const [barSpendByReservation, setBarSpendByReservation] = useState<Record<number, number>>({});
  const [invoiceBeingEdited, setInvoiceBeingEdited] = useState<{ reservation: Reservation; invoice: any } | null>(null);
  const [invoiceEditPaymentModes, setInvoiceEditPaymentModes] = useState<Array<{ name: string; amount: number }>>([]);
  const [invoiceDraftItems, setInvoiceDraftItems] = useState<Array<{ description: string; quantite: number; prix_unitaire: number }>>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  const handlePrintInvoice = async (reservation: Reservation) => {
    const popup = window.open('', '_blank');
    if (!popup) {
      toast.error('Autorisez les fenêtres contextuelles pour imprimer la facture.');
      return;
    }
    popup.opener = null;
    popup.document.write('<!doctype html><html><head><title>Facture</title></head><body>Chargement de la facture…</body></html>');
    try {
      const [invoices, detailedReservation, reservationPayments] = await Promise.all([
        reservationService.getHotelInvoices(reservation.id),
        reservationService.getReservationById(reservation.id).catch(() => reservation),
        reservationService.getReservationPayments(reservation.id).catch(() => []),
      ]);
      const invoice = Array.isArray(invoices)
        ? invoices.find((item: any) => item.invoice_type === (reservation.statut === 'TERMINEE' ? 'FINALE' : 'PROFORMA')) || invoices[0]
        : invoices;
      if (!invoice) throw new Error('Facture introuvable');
      if (!popup) throw new Error('La fenêtre d’impression a été bloquée');
      const rows = (invoice.items || []).map((item: any) =>
        `<tr><td>${escapeHtml(item.description || '')} × ${Number(item.quantite || 1)}</td><td>${Number(item.montant || 0).toLocaleString('fr-FR')} Ar</td></tr>`
      ).join('');
      popup.document.write(`<html><head><meta charset="utf-8"><title>${escapeHtml(invoice.numero || 'Facture')}</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #ddd}.total{font-weight:bold;font-size:18px}</style></head><body><h1>${invoice.invoice_type === 'FINALE' ? 'Facture finale' : 'Facture proforma'}</h1><p>N° ${escapeHtml(invoice.numero || '')}</p><table>${rows}</table><p class="total">Total : ${Number(invoice.montant_total || 0).toLocaleString('fr-FR')} Ar</p><p>Statut : ${escapeHtml(invoice.statut || '')}</p></body></html>`);
      const reservationClient = (detailedReservation.client || reservation.client) as any;
      const clientName = [reservationClient?.prenom, reservationClient?.nom].filter(Boolean).join(' ')
        || (detailedReservation as any).client_nom || (reservation as any).client_nom || `Client #${reservation.client_id}`;
      const clientAddress = reservationClient?.adresse || '';
      const isCompanyClient = ['SOCIETE', 'TOUR_OPERATEUR'].includes(String(reservationClient?.type_client || (detailedReservation as any).client_type_client || '').toUpperCase());
      const occupantNames = (detailedReservation.occupants || reservation.occupants || [])
        .map((occupant) => [occupant.prenom, occupant.nom].filter(Boolean).join(' ').trim())
        .filter(Boolean);
      const occupantLine = isCompanyClient && occupantNames.length
        ? `<br><span class="label">Occupant${occupantNames.length > 1 ? 's' : ''}</span><strong>${occupantNames.map(escapeHtml).join('<br>')}</strong>`
        : '';
      const roomNumber = detailedReservation.room?.numero || reservation.room?.numero || (detailedReservation as any).room_numero || (reservation as any).room_numero
        || rooms.find((room) => room.id === reservation.room_id)?.numero || String(reservation.room_id || '');
      const nights = Math.max(0, Math.ceil((new Date(reservation.date_depart).getTime() - new Date(reservation.date_arrivee).getTime()) / 86400000));
      const paymentModes: Record<string, string> = {
        ESPECES: 'Espèces', TPE: 'TPE', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
        CARTE: 'Carte bancaire', VIREMENT: 'Virement', CREDIT: 'Crédit', GRATUIT: 'Gratuit',
      };
      const paymentTotals = new Map<string, number>();
      reservationPayments.forEach((payment) => {
        const modes = payment.details?.modes_paiement;
        if (modes?.length) {
          modes.forEach((mode) => {
            const key = String(mode.moyen_paiement || '').toUpperCase();
            if (key) paymentTotals.set(key, (paymentTotals.get(key) || 0) + Number(mode.montant || 0));
          });
        } else if (payment.moyen_paiement) {
          const key = payment.moyen_paiement.toUpperCase();
          paymentTotals.set(key, (paymentTotals.get(key) || 0) + Number(payment.montant_encaisse ?? payment.montant ?? 0));
        }
      });
      const paymentMode = paymentTotals.size
        ? [...paymentTotals.entries()].map(([key, amount]) => `${paymentModes[key] || key.replace(/_/g, ' ')} (${amount.toLocaleString('fr-FR')} Ar)`).join(' · ')
        : paymentModes[String(detailedReservation.moyen_paiement || reservation.moyen_paiement || '').toUpperCase()]
          || detailedReservation.moyen_paiement || reservation.moyen_paiement || 'À préciser';
      const totalAmount = Number(invoice.montant_total || 0);
      const issuedDate = formatDate(invoice.issued_at || invoice.created_at || reservation.created_at || new Date().toISOString());
      popup.document.open();
      popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(invoice.numero || 'Facture')}</title>
        <style>
          @page{size:A4;margin:12mm}*{box-sizing:border-box}body{min-height:273mm;margin:0;display:flex;flex-direction:column;color:#202833;font:12px/1.45 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .top-rule{height:4px;background:#b58a36;margin:0 0 18px}.letterhead{display:grid;grid-template-columns:40% 60%;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid #b9c0c8}
          .logo{width:100%;max-width:245px;height:auto;object-fit:contain}.address{font-size:10.5px;line-height:1.55}.address strong{font-size:11px;color:#243447}
          .title-row{display:flex;justify-content:space-between;align-items:flex-end;margin:20px 0 12px}.title{font-size:20px;letter-spacing:.08em;color:#243447;margin:0}.invoice-no{text-align:right;font-size:12px}
          .meta{display:grid;grid-template-columns:1.2fr 1fr 1fr;border:1px solid #aab2bc;background:#f2f4f6;margin:12px 0 20px}.meta-cell{padding:10px 12px;border-right:1px solid #c6ccd3;min-height:58px}.meta-cell:last-child{border-right:0}.label{display:block;color:#687483;font-size:9px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.meta strong{font-size:12px}
          .stay{display:flex;flex-wrap:wrap;gap:12px 24px;margin:0 0 18px}.stay span{color:#536170}.stay strong{color:#202833}
          table{width:100%;border-collapse:collapse}thead{display:table-header-group}th{padding:9px 8px;text-align:left;background:#243447;color:white;text-transform:uppercase;letter-spacing:.06em;font-size:9px}th:last-child,td:last-child{text-align:right}td{padding:10px 8px;border-bottom:1px solid #d9dee4}tbody tr:nth-child(even){background:#f7f8fa}.qty,.unit{text-align:center!important}.unit{white-space:nowrap}
          .total-wrap{display:flex;justify-content:flex-end;margin:15px 0 28px}.total{min-width:250px;border-top:2px solid #b58a36;padding:10px 0;display:flex;justify-content:space-between;align-items:baseline;font-size:12px}.total strong{font-size:18px;color:#243447}
          .sign{margin-top:24px;text-align:right;color:#65717e;font-size:10px}
          .footer{margin-top:auto;border-top:1px solid #b9c0c8;padding-top:7px;color:#536170;font-size:8.5px;line-height:1.45}.footer-summary{margin-bottom:7px;line-height:1.55}.footer-summary strong{font-style:italic;color:#243447}.footer-legal{text-align:center;border-top:1px solid #d8dde3;padding-top:5px}.footer-legal strong{color:#243447;letter-spacing:.04em}
          @media screen{body{max-width:210mm;min-height:273mm;margin:18px auto;padding:12mm;box-shadow:0 4px 24px #17212b22}}
        </style></head><body><div class="top-rule"></div>
        <header class="letterhead"><img class="logo" src="/logo_n.png" alt="Royal Palace Antsirabe"><div class="address"><strong>Lot 512 C 61 Tsarasaotra, Antsirabe 110</strong><br>CIF 0046292 / DGI-M du 09/05/2025<br>NIF 4000133786<br>STAT 55101 12 2011 0 00244<br>Tél. 034 49 040 40 / 020 44 490 40<br>Mail : royalpalace.resa@moov.mg</div></header>
        <div class="title-row"><h1 class="title">${invoice.invoice_type === 'FINALE' ? 'FACTURE' : 'FACTURE PROFORMA'}</h1><div class="invoice-no"><strong>N° ${escapeHtml(invoice.numero || '')}</strong><br>${escapeHtml(issuedDate)}</div></div>
        <section class="meta"><div class="meta-cell"><span class="label">Client</span><strong>${escapeHtml(clientName)}</strong>${occupantLine}${clientAddress ? `<br>${escapeHtml(clientAddress)}` : ''}</div><div class="meta-cell"><span class="label">Chambre</span><strong>${escapeHtml(roomNumber)}</strong></div><div class="meta-cell"><span class="label">Date de facture</span><strong>${escapeHtml(issuedDate)}</strong></div></section>
        <div class="stay"><span>Date arrivée : <strong>${escapeHtml(formatDate(reservation.date_arrivee))}</strong></span><span>Date départ : <strong>${escapeHtml(formatDate(reservation.date_depart))}</strong></span><span>Nuits : <strong>${nights}</strong></span></div>
        <table><thead><tr><th>Désignation</th><th class="qty">Qté</th><th class="unit">Prix unitaire</th><th>Total</th></tr></thead><tbody>${(invoice.items || []).map((item: any) => `<tr><td>${escapeHtml(item.description || '')}</td><td class="qty">${Number(item.quantite || 1)}</td><td class="unit">${Number(item.prix_unitaire || 0).toLocaleString('fr-FR')} Ar</td><td>${Number(item.montant || 0).toLocaleString('fr-FR')} Ar</td></tr>`).join('')}</tbody></table>
        <div class="total-wrap"><div class="total"><span>TOTAL À PAYER</span><strong>${totalAmount.toLocaleString('fr-FR')} Ar</strong></div></div>
        <div class="sign">${escapeHtml(issuedDate)}<br>La Direction</div>
        <footer class="footer"><div class="footer-summary">Arrêté la présente facture à la somme de : <strong>${amountInFrenchWords(totalAmount)} Ariary</strong><br>Échéance : 1 mois après réception de la facture<br>Mode de paiement : ${escapeHtml(paymentMode)}</div><div class="footer-legal"><strong>Service et taxes compris · ROYAL PALACE · ANTSIRABE</strong><br>CIF 0046292 / DGI-M du 09/05/2025 · NIF 4000133786 · STAT 55101 12 2011 0 00244</div></footer>
        </body></html>`);
      popup.document.close();
      popup.focus();
      window.setTimeout(() => popup.print(), 250);
    } catch (error) {
      popup.close();
      toast.error(error instanceof Error ? error.message : 'Impossible d’imprimer la facture');
    }
  };

  const handleEditInvoice = async (reservation: Reservation) => {
    setInvoiceLoading(true);
    try {
      const [invoices, payments] = await Promise.all([
        reservationService.getHotelInvoices(reservation.id),
        reservationService.getReservationPayments(reservation.id).catch(() => []),
      ]);
      const invoice = Array.isArray(invoices)
        ? invoices.find((item: any) => item.invoice_type === 'PROFORMA')
        : invoices?.invoice_type === 'PROFORMA' ? invoices : null;
      if (!invoice || Number(invoice.editable) !== 1) {
        toast.error('Cette facture n’est plus modifiable.');
        return;
      }
      setInvoiceDraftItems((invoice.items || []).map((item: any) => ({
        description: item.description || '',
        quantite: Number(item.quantite || 1),
        prix_unitaire: Number(item.prix_unitaire || 0),
      })));
      const paymentLabels: Record<string, string> = {
        ESPECES: 'Espèces', TPE: 'TPE', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
        CARTE: 'Carte bancaire', VIREMENT: 'Virement', CREDIT: 'Crédit', GRATUIT: 'Gratuit',
      };
      const paymentTotals = new Map<string, number>();
      payments.forEach((payment) => {
        const modes = payment.details?.modes_paiement;
        if (modes?.length) {
          modes.forEach((mode) => {
            const key = String(mode.moyen_paiement || '').toUpperCase();
            if (key) paymentTotals.set(key, (paymentTotals.get(key) || 0) + Number(mode.montant || 0));
          });
        } else if (payment.moyen_paiement) {
          const key = payment.moyen_paiement.toUpperCase();
          paymentTotals.set(key, (paymentTotals.get(key) || 0) + Number(payment.montant_encaisse ?? payment.montant ?? 0));
        }
      });
      if (paymentTotals.size === 0 && reservation.moyen_paiement) {
        const key = reservation.moyen_paiement.toUpperCase();
        paymentTotals.set(key, 0);
      }
      setInvoiceEditPaymentModes([...paymentTotals.entries()].map(([key, amount]) => ({
        name: paymentLabels[key] || key.replace(/_/g, ' '),
        amount,
      })));
      setInvoiceBeingEdited({ reservation, invoice });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Impossible de charger la facture.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleSaveInvoice = async () => {
    if (!invoiceBeingEdited || invoiceSaving) return;
    if (!invoiceDraftItems.length || invoiceDraftItems.some((item) => !item.description.trim() || item.quantite <= 0 || item.prix_unitaire < 0)) {
      toast.error('Vérifiez la description, la quantité et le prix de chaque ligne.');
      return;
    }
    setInvoiceSaving(true);
    try {
      await reservationService.updateHotelInvoice(invoiceBeingEdited.reservation.id, invoiceBeingEdited.invoice.id, invoiceDraftItems);
      setInvoiceBeingEdited(null);
      await loadReservations();
      toast.success('Facture mise à jour.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Impossible de modifier la facture.');
    } finally {
      setInvoiceSaving(false);
    }
  };
  const [spaSpendByReservation, setSpaSpendByReservation] = useState<Record<number, number>>({});
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const isDirection = ['admin', 'manager'].includes(String(AuthService.getCurrentUser()?.role || '').toLowerCase());

  useEffect(() => {
    if (expandedId === null) {
      setExpandedPayments([]);
      return;
    }
    let cancelled = false;
    setPaymentsLoading(true);
    reservationService.getReservationPayments(expandedId)
      .then((rows) => { if (!cancelled) setExpandedPayments(rows); })
      .catch(() => { if (!cancelled) setExpandedPayments([]); })
      .finally(() => { if (!cancelled) setPaymentsLoading(false); });
    return () => { cancelled = true; };
  }, [expandedId]);

  // 🟢 État local pour stocker les IDs des réservations déjà encaissées
  const [encaissedIds, setEncaissedIds] = useState<number[]>([]);

  // Charger toutes les données
  useEffect(() => {
    const loadAllData = async () => {
      await Promise.all([loadReservations(), loadClients(), loadRooms()]);
      // Load users for history filtering
      try {
        const response = await api.get('/api/hebergement/users');
        setUsers(response.data.data || []);
      } catch (err) {
        console.warn('Failed to load users:', err);
        setUsers([]);
      }
    };
    loadAllData();
  }, [loadReservations, loadClients, loadRooms]);

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadReservations();
    }
  }, [loadReservations, refreshTrigger]);

  useEffect(() => {
    let cancelled = false;
    setStaysLoading(true);
    reservationService.getStays()
      .then((stays) => {
        if (!cancelled) {
          setCheckedOutReservationIds(new Set(
            stays.filter((stay) => stay.checkout_at).map((stay) => stay.reservation_id)
          ));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Erreur lors du chargement des séjours:', error);
          toast.error('Impossible de vérifier les check-out des réservations.');
        }
      })
      .finally(() => {
        if (!cancelled) setStaysLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  // Clear encaissedIds when payment is cancelled
  useEffect(() => {
    if (paymentCancelledTrigger !== undefined) {
      setEncaissedIds([]);
    }
  }, [paymentCancelledTrigger]);

  useEffect(() => {
    let isMounted = true;

    const loadBarSpendByReservation = async () => {
      try {
        const response = await api.get('/api/bar/orders');
        const orders = Array.isArray(response?.data?.data)
          ? response.data.data
          : Array.isArray(response?.data)
            ? response.data
            : [];

        const totals: Record<number, number> = {};

        for (const order of orders) {
          const amount = Number(order?.total ?? 0);
          if (!Number.isFinite(amount) || amount <= 0) continue;

          const reservationId = Number(order?.hotel_reservation_id ?? 0);
          const roomId = Number(order?.room_id ?? 0);

          if (reservationId > 0) {
            totals[reservationId] = (totals[reservationId] || 0) + amount;
          } else if (roomId > 0) {
            totals[roomId] = (totals[roomId] || 0) + amount;
          }
        }

        if (isMounted) {
          setBarSpendByReservation(totals);
        }
      } catch (error) {
        if (isMounted) {
          setBarSpendByReservation({});
        }
      }
    };

    void loadBarSpendByReservation();

    // Ventes piscine (module SPA) portées sur la note de chambre.
    spaService.getRoomCharges()
      .then((rows) => { if (isMounted) setSpaSpendByReservation(Object.fromEntries(rows.map((row) => [row.hotelReservationId, row.total]))); })
      .catch(() => { if (isMounted) setSpaSpendByReservation({}); });

    return () => {
      isMounted = false;
    };
  }, [reservations]);

  // Enrichir les réservations
  useEffect(() => {
    if (reservations.length > 0 && clients.length > 0 && rooms.length > 0) {
      const enriched = reservations.map(res => ({
        ...res,
        client: clients.find(c => c.id === res.client_id),
        room: rooms.find(r => r.id === res.room_id)
      }));
      setEnrichedReservations(enriched);
    } else {
      setEnrichedReservations(reservations);
    }
  }, [reservations, clients, rooms]);

  // Filtrer
  const filteredReservations = enrichedReservations.filter(res => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      res.client?.nom?.toLowerCase().includes(searchLower) ||
      res.client?.prenom?.toLowerCase().includes(searchLower) ||
      res.room?.numero?.includes(searchTerm);

    // Filter by tab (active vs history)
    const matchesTab = view === 'active'
      ? !['ANNULEE', 'NO_SHOW'].includes(res.statut) && !checkedOutReservationIds.has(res.id)
      : ['ANNULEE', 'NO_SHOW'].includes(res.statut) || checkedOutReservationIds.has(res.id);

    // Custom status filtering based on user's requirements
    let matchesStatus = true;
    if (selectedStatus === 'TOUS') {
      matchesStatus = true;
    } else if (selectedStatus === 'CHECKED_IN') {
      matchesStatus = res.statut === 'CHECKED_IN';
    } else if (selectedStatus === 'ARRIVAL') {
      // Upcoming reservations: date_arrivee >= today, not checked in yet
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const arrivalDate = new Date(res.date_arrivee);
      arrivalDate.setHours(0, 0, 0, 0);
      matchesStatus = res.statut === 'CONFIRMEE' && arrivalDate >= today;
    } else if (selectedStatus === 'DEPARTURE') {
      // Completed reservations: based on checkout date (date_depart)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const departureDate = new Date(res.date_depart);
      departureDate.setHours(0, 0, 0, 0);
      matchesStatus = res.statut === 'TERMINEE' && departureDate <= today;
    } else {
      matchesStatus = res.statut === selectedStatus;
    }

    // Filter by date range
    let matchesDateRange = true;
    if (filterFromDate) {
      matchesDateRange = matchesDateRange && new Date(res.date_arrivee) >= new Date(filterFromDate);
    }
    if (filterToDate) {
      matchesDateRange = matchesDateRange && new Date(res.date_depart) <= new Date(filterToDate);
    }

    // Filter by date range in history tab (for user search)
    let matchesHistoryDateRange = true;
    if (view === 'history') {
      if (historyFromDate) {
        matchesHistoryDateRange = matchesHistoryDateRange && new Date(res.date_arrivee) >= new Date(historyFromDate);
      }
      if (historyToDate) {
        matchesHistoryDateRange = matchesHistoryDateRange && new Date(res.date_depart) <= new Date(historyToDate);
      }
    }

    // Filter by user name in history tab
    let matchesUser = true;
    if (view === 'history' && userSearchTerm) {
      const userSearchLower = userSearchTerm.toLowerCase();
      const creatorName = `${res.created_by_prenom || ''} ${res.created_by_nom || ''}`.toLowerCase();
      const modifierName = `${res.modified_by_prenom || ''} ${res.modified_by_nom || ''}`.toLowerCase();
      matchesUser = creatorName.includes(userSearchLower) || modifierName.includes(userSearchLower);
    }

    return matchesSearch && matchesTab && matchesStatus && matchesDateRange && matchesHistoryDateRange && matchesUser;
  });
  const filteredReservationsTotal = filteredReservations.reduce(
    (total, reservation) => total + (Number(reservation.montant_total) || 0),
    0
  );

  const isLoading = reservationsLoading || clientsLoading || roomsLoading || staysLoading;

  // Ticket 80 mm de la réservation (prestations + historique des paiements)
  const handlePrintTicket = async (res: Reservation) => {
    try {
      const payments = await reservationService.getReservationPayments(res.id);
      printReservationTicket(receiptDataFromReservation(res, payments));
    } catch {
      toast.error("Impossible de préparer le ticket d'impression");
    }
  };

  const getStatusBadge = (statut: string) => {
    const colors: Record<string, string> = {
      CONFIRMEE: 'bg-emerald-500/20 text-emerald-400',
      EN_COURS: 'bg-blue-500/20 text-blue-400',
      TERMINEE: 'bg-gray-500/20 text-gray-400',
      ANNULEE: 'bg-red-500/20 text-red-400',
      NO_SHOW: 'bg-orange-500/20 text-orange-400'
    };
    const labels: Record<string, string> = {
      CONFIRMEE: 'Confirmée',
      EN_COURS: 'En cours',
      TERMINEE: 'Terminée',
      ANNULEE: 'Annulée',
      NO_SHOW: 'No Show'
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[statut] || colors.CONFIRMEE}`}>
        {labels[statut] || statut}
      </span>
    );
  };

  // Gestion des actions
  const handleCancel = async (reservation: Reservation) => {
    if (window.confirm(`Annuler la réservation de ${reservation.client?.prenom} ${reservation.client?.nom} ?`)) {
      try {
        setIsProcessing(true);
        await cancelReservation(reservation.id);
        toast.success('Réservation annulée');
        await loadReservations();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erreur');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleNoShow = async (reservation: Reservation) => {
    if (window.confirm(`Marquer comme No Show la réservation de ${reservation.client?.prenom} ${reservation.client?.nom} ?`)) {
      try {
        setIsProcessing(true);
        await reservationService.updateReservationStatus(reservation.id, 'NO_SHOW');
        toast.success('Réservation marquée comme No Show');
        await loadReservations();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erreur');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDeleteClick = (reservation: Reservation) => {
    setReservationToDelete(reservation);
    setIsDeleteModalOpen(true);
  };

  const handleValidateDiscount = async (reservation: Reservation) => {
    try {
      await reservationService.validateDiscount(reservation.id);
      toast.success('Remise validée par la direction');
      await loadReservations();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Impossible de valider la remise');
    }
  };

  const handleConfirmDelete = async () => {
    if (!reservationToDelete) return;
    try {
      setIsProcessing(true);
      await deleteReservation(reservationToDelete.id);
      toast.success('Réservation supprimée');
      setIsDeleteModalOpen(false);
      setReservationToDelete(null);
      await loadReservations();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={32} className="animate-spin text-accent" />
        <span className="ml-3 text-gray-400 text-sm">Chargement...</span>
      </div>
    );
  }

  if (reservationsError) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
        <p className="text-red-400">{reservationsError}</p>
        <button type="button" onClick={() => loadReservations()} className="mt-3 text-accent hover:underline text-sm">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats compactes */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">Total</p>
            <p className="text-white font-bold text-lg">{stats.total || 0}</p>
          </div>
          <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">Confirmées</p>
            <p className="text-emerald-400 font-bold text-lg">{stats.confirmees || 0}</p>
          </div>
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">En cours</p>
            <p className="text-blue-400 font-bold text-lg">{stats.en_cours || 0}</p>
          </div>
          <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 text-center">
            <p className="text-gray-500 text-xs">Annulées</p>
            <p className="text-red-400 font-bold text-lg">{stats.annulees || 0}</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent"
        />
        <input
          type="date"
          value={filterFromDate}
          onChange={(e) => setFilterFromDate(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          placeholder="Du"
        />
        <input
          type="date"
          value={filterToDate}
          onChange={(e) => setFilterToDate(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          placeholder="Au"
        />
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
        >
          <option value="TOUS">Tous</option>
          <option value="CHECKED_IN">Check-in</option>
          <option value="ARRIVAL">Arrivée</option>
          <option value="DEPARTURE">Départ</option>
        </select>
        <button
          type="button"
          onClick={() => Promise.all([loadReservations(), loadClients(), loadRooms()])}
          className="px-3 py-2 bg-accent text-black rounded-lg text-sm hover:bg-accent-2 transition"
        >
          🔄
        </button>
      </div>

      {/* History date filters */}
      {view === 'history' && (
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            list="users-list"
            placeholder="Rechercher par utilisateur..."
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          />
          <datalist id="users-list">
            {users.map(user => (
              <option key={user.id_admin} value={`${user.prenom} ${user.nom}`}>
                {user.prenom} {user.nom} ({user.role})
              </option>
            ))}
          </datalist>
          <input
            type="date"
            value={historyFromDate}
            onChange={(e) => setHistoryFromDate(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
            placeholder="Du"
          />
          <input
            type="date"
            value={historyToDate}
            onChange={(e) => setHistoryToDate(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
            placeholder="Au"
          />
        </div>
      )}

      {/* Liste */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2">
          <span className="text-xs text-gray-400">
            {filteredReservations.length} réservation{filteredReservations.length > 1 ? 's' : ''}
          </span>
          {view === 'history' && (
            <span className="text-sm font-semibold text-accent">
              Valeur totale listée : {formatCurrency(filteredReservationsTotal)}
            </span>
          )}
        </div>

        {filteredReservations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <Calendar size={32} className="mx-auto text-gray-600 mb-2" />
            Aucune réservation
          </div>
        ) : (
          filteredReservations.map((res) => (
            <div
              key={res.id}
              className={`bg-gray-900 border rounded-lg overflow-hidden transition-all
                ${res.statut === 'ANNULEE' ? 'border-red-800/30' : 'border-gray-700'}`}
            >
              {/* Ligne principale */}
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  {/* Info client */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs flex-shrink-0">
                      {res.client?.prenom?.[0] || '?'}{res.client?.nom?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm truncate">
                          {res.client?.prenom} {res.client?.nom || 'Inconnu'}
                        </span>
                        {getStatusBadge(res.statut)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-0.5">
                          <DoorOpen size={12} />
                          {res.room?.numero || 'N/A'}
                        </span>
                        <span>{formatDate(res.date_arrivee)} → {formatDate(res.date_depart)}</span>
                        <span className={res.type_reservation === 'BOOKING' ? 'text-blue-400' : 'text-gray-500'}>
                          {res.type_reservation === 'BOOKING' ? 'Booking' : 'Sur place'}
                        </span>
                        {res.laundry_included && (
                          <span className="text-purple-400">Blanchisserie {formatCurrency(res.laundry_price || 0)}</span>
                        )}
                                        <span className={res.pdj_inclus ? 'text-emerald-400' : 'text-gray-500'}>
                          {res.pdj_inclus ? 'PDJ inclus' : 'PDJ non inclus'}
                        </span>
                        {(() => {
                          const barSpend = Number(barSpendByReservation[res.id] ?? barSpendByReservation[res.room_id] ?? 0);
                          return barSpend > 0 ? (
                            <span className="text-amber-300">Bar {formatCurrency(barSpend)}</span>
                          ) : null;
                        })()}
                        {Number(spaSpendByReservation[res.id] || 0) > 0 && (
                          <span className="text-cyan-300">Piscine {formatCurrency(spaSpendByReservation[res.id])}</span>
                        )}
                        {res.moyen_paiement && res.statut === 'TERMINEE' && (
                          <span className="text-sky-300">Paiement : {res.moyen_paiement.replace('_', ' ')}</span>
                        )}
                        <span className="text-accent font-medium">{formatCurrency(res.montant_total || 0)}</span>
                        {Number(res.montant_encaisse || 0) > 0 && <span className="text-emerald-300">Encaissé {formatCurrency(res.montant_encaisse || 0)}</span>}
                        {Number(res.montant_gratuit || 0) > 0 && <span className="text-violet-300">Gratuit {formatCurrency(res.montant_gratuit || 0)}</span>}
                        {Number(res.montant_credit || 0) > 0 && <span className="text-orange-300">Crédit {formatCurrency(res.montant_credit || 0)}</span>}
                        {(() => {
                          const paid = Number(res.montant_paye || 0);
                          const due = Number(res.montant_total || 0) - paid;
                          if (paid <= 0 && due <= 0) return null;
                          const statusLabels: Record<string, string> = {
                            IMPAYE: 'Impayé', PARTIELLEMENT_PAYE: 'Partiellement payé', PAYE: 'Payé', CREDIT: 'Crédit', GRATUIT: 'Gratuit',
                          };
                          return <span className={due > 0 ? 'text-orange-300 font-medium' : 'text-emerald-400'}>
                            {statusLabels[res.statut_paiement || ''] || (due > 0 ? 'Solde restant' : 'Payé')} · Couvert {formatCurrency(paid)} · Reste {formatCurrency(Math.max(0, due))}
                          </span>;
                        })()}
                        {Number(res.remise_pourcentage || 0) > 0 && (
                          <span className={res.remise_validee_par ? 'text-emerald-400' : 'text-orange-400'}>
                            Remise {res.remise_pourcentage}% {res.remise_validee_par ? 'validée' : 'à valider'}
                          </span>
                        )}
                        {/* User tracking information */}
                        {view === 'history' && (
                          <>
                            {res.created_by_nom && (
                              <span className="text-green-400">
                                Créé par: {res.created_by_prenom} {res.created_by_nom}
                              </span>
                            )}
                            {res.modified_by_nom && res.modified_by_nom !== res.created_by_nom && (
                              <span className="text-yellow-400">
                                Modifié par: {res.modified_by_prenom} {res.modified_by_nom}
                              </span>
                            )}
                            {res.created_at && (
                              <span className="text-gray-500">
                                {formatDateTime(res.created_at)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isDirection && Number(res.remise_pourcentage || 0) > 0 && !res.remise_validee_par && (
                      <button type="button" onClick={() => handleValidateDiscount(res)} className="px-2 py-1 text-xs rounded bg-orange-500/20 text-orange-300">
                        Valider remise
                      </button>
                    )}
                    {/* Bouton Check-in - Only show for confirmed reservations */}
                    {onCheckIn && res.statut === 'CONFIRMEE' && (
                      <button
                        type="button"
                        onClick={() => onCheckIn(res)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs rounded-lg transition-colors font-medium mr-1"
                        title="Check-in du client"
                      >
                        <UserCheck size={12} />
                        <span className="hidden sm:inline">Check-in</span>
                      </button>
                    )}
                    {/* Bouton Encaisser dynamique - Only show after check-in */}
                    {onEncaisser && (res.statut === 'CHECKED_IN' || res.statut === 'EN_COURS') && !encaissedIds.includes(res.id) && Number(res.montant_total || 0) - Number(res.montant_paye || 0) > 0.01 && (
                      <button
                        type="button"
                        onClick={() => onEncaisser(res)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs rounded-lg transition-colors font-medium mr-1"
                        title="Encaisser cette réservation"
                      >
                        <CreditCard size={12} />
                        <span className="hidden sm:inline">Encaisser</span>
                      </button>
                    )}
                    {/* Réservation déjà payée avec rectification (blanchisserie, transfert...) */}
                    {onEncaisser && res.statut === 'TERMINEE' && Number(res.montant_paye || 0) > 0 && Number(res.montant_total || 0) - Number(res.montant_paye || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => onEncaisser(res)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 text-xs rounded-lg transition-colors font-medium mr-1"
                        title="Encaisser la rectification"
                      >
                        <CreditCard size={12} />
                        <span className="hidden sm:inline">Encaisser rectification</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handlePrintTicket(res)}
                      className="p-1.5 hover:bg-gray-800 rounded"
                      title="Imprimer le ticket (80 mm)"
                    >
                      <Printer size={14} className="text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePrintInvoice(res)}
                      className="px-2 py-1 text-xs rounded border border-base text-gray-300 hover:bg-gray-800"
                      title="Imprimer la facture proforma ou finale"
                    >
                      Facture
                    </button>
                    {res.statut !== 'TERMINEE' && res.statut !== 'ANNULEE' && (
                      <button
                        type="button"
                        onClick={() => void handleEditInvoice(res)}
                        disabled={invoiceLoading}
                        className="px-2 py-1 text-xs rounded border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                        title="Modifier la facture proforma"
                      >
                        Modifier facture
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === res.id ? null : res.id)}
                      className="p-1.5 hover:bg-gray-800 rounded"
                    >
                      {expandedId === res.id ?
                        <ChevronUp size={14} className="text-gray-400" /> :
                        <ChevronDown size={14} className="text-gray-400" />
                      }
                    </button>
                    {onEdit && (
                      <button type="button" onClick={() => onEdit(res)} className="p-1.5 hover:bg-gray-800 rounded">
                        <Edit size={14} className="text-gray-400" />
                      </button>
                    )}
                    {res.statut !== 'ANNULEE' && res.statut !== 'TERMINEE' && (
                      <button type="button" onClick={() => handleCancel(res)} className="p-1.5 hover:bg-red-500/10 rounded">
                        <X size={14} className="text-red-400" />
                      </button>
                    )}
                    {res.statut === 'CONFIRMEE' && (
                      <button type="button" onClick={() => handleNoShow(res)} className="p-1.5 hover:bg-orange-500/10 rounded" title="Marquer comme No Show">
                        <User size={14} className="text-orange-400" />
                      </button>
                    )}
                    <button type="button" onClick={() => handleDeleteClick(res)} className="p-1.5 hover:bg-red-500/10 rounded">
                      <Trash2 size={14} className="text-gray-500 hover:text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Détails étendus */}
                {expandedId === res.id && (
                  <div className="mt-2 border-t border-gray-800 pt-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-gray-500">Client</p>
                        <p className="text-gray-300">{res.client?.prenom} {res.client?.nom}</p>
                        {res.client?.telephone && <p className="flex items-center gap-1 text-gray-400"><Phone size={12} /> {res.client.telephone}</p>}
                        {res.client?.email && <p className="flex items-center gap-1 truncate text-gray-400"><Mail size={12} /> {res.client.email}</p>}
                      </div>
                      <div>
                        <p className="text-gray-500">Chambre</p>
                        <p className="text-gray-300">N° {res.room?.numero || 'N/A'}</p>
                        <p className="text-gray-400">{res.room?.room_type?.nom || 'Standard'}</p>
                        <p className="text-gray-400">{res.room?.capacite || 0} pers.</p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-gray-800 pt-2">
                      <p className="mb-2 font-semibold text-gray-300">Historique des encaissements</p>
                      {paymentsLoading ? <p className="text-gray-500">Chargement…</p> : expandedPayments.length === 0 ? (
                        <p className="text-gray-500">Aucun encaissement enregistré.</p>
                      ) : (
                        <div className="space-y-2">
                          {expandedPayments.map((payment, index) => {
                            const modes = payment.details?.modes_paiement;
                            return (
                              <div key={payment.id} className="rounded-lg bg-gray-900/60 p-2.5">
                                <div className="flex flex-wrap justify-between gap-2 text-gray-300">
                                  <strong>Encaissement {index + 1} · {formatDateTime(payment.created_at)}</strong>
                                  <strong>{formatCurrency(payment.montant)}</strong>
                                </div>
                                <div className="mt-1 space-y-0.5 text-gray-400">
                                  {modes?.length ? modes.map((mode, modeIndex) => (
                                    <div key={`${payment.id}-${modeIndex}`} className="flex justify-between">
                                      <span>{mode.moyen_paiement.replace('_', ' ')}</span><span>{formatCurrency(mode.montant)}</span>
                                    </div>
                                  )) : <div>{payment.moyen_paiement || 'Mode historique'} · {formatCurrency(payment.montant)}</div>}
                                  <div className="flex flex-wrap justify-between gap-2 border-t border-gray-800 pt-1">
                                    <span>Reçu {formatCurrency(payment.montant_encaisse ?? payment.montant)}</span>
                                    {Number(payment.montant_credit || 0) > 0 && <span>Crédit {formatCurrency(payment.montant_credit || 0)}</span>}
                                    {Number(payment.montant_gratuit || 0) > 0 && <span>Gratuit {formatCurrency(payment.montant_gratuit || 0)}</span>}
                                  </div>
                                  <div>Effectué par {`${payment.created_by_prenom || ''} ${payment.created_by_nom || ''}`.trim() || 'Utilisateur inconnu'}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {invoiceBeingEdited && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-300 bg-white text-black">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h3 className="font-semibold text-black">Modifier la facture proforma</h3>
                <p className="mt-1 text-sm text-gray-600">Réservation #{invoiceBeingEdited.reservation.id} · {invoiceBeingEdited.invoice.numero}</p>
              </div>
              <button type="button" onClick={() => setInvoiceBeingEdited(null)} className="rounded p-1 text-gray-600 hover:bg-gray-100" aria-label="Fermer"><X size={18} /></button>
            </div>
            <div className="space-y-3 overflow-y-auto p-5">
              <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900">Mode de paiement enregistré</h4>
                {invoiceEditPaymentModes.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {invoiceEditPaymentModes.map((mode) => (
                      <span key={mode.name} className="rounded-full bg-white px-3 py-1 text-sm text-gray-800 ring-1 ring-amber-200">
                        {mode.name}{mode.amount > 0 ? ` · ${formatCurrency(mode.amount)}` : ''}
                      </span>
                    ))}
                  </div>
                ) : <p className="mt-1 text-sm text-gray-600">À préciser</p>}
              </section>
              {invoiceDraftItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-300 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_90px_130px_110px_36px] sm:items-end">
                  <label className="text-xs text-gray-700">Description
                    <input value={item.description} onChange={(event) => setInvoiceDraftItems((rows) => rows.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black" />
                  </label>
                  <label className="text-xs text-gray-700">Quantité
                    <input type="number" min="0.01" step="0.01" value={item.quantite} onChange={(event) => setInvoiceDraftItems((rows) => rows.map((row, i) => i === index ? { ...row, quantite: Number(event.target.value) } : row))} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black" />
                  </label>
                  <label className="text-xs text-gray-700">Prix unitaire (Ar)
                    <input type="number" min="0" step="1" value={item.prix_unitaire} onChange={(event) => setInvoiceDraftItems((rows) => rows.map((row, i) => i === index ? { ...row, prix_unitaire: Number(event.target.value) } : row))} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-black" />
                  </label>
                  <div className="text-sm font-semibold text-black sm:pb-2">{formatCurrency(item.quantite * item.prix_unitaire)}</div>
                  <button type="button" onClick={() => setInvoiceDraftItems((rows) => rows.filter((_, i) => i !== index))} className="rounded p-2 text-red-400 hover:bg-red-500/10" title="Supprimer la ligne"><Trash2 size={16} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setInvoiceDraftItems((rows) => [...rows, { description: '', quantite: 1, prix_unitaire: 0 }])} className="flex items-center gap-2 rounded-lg border border-dashed border-gray-500 bg-white px-3 py-2 text-sm font-medium text-black hover:border-gray-700 hover:bg-gray-100"><Plus size={16} className="text-gray-800" /> Ajouter une ligne</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-5">
              <strong className="text-black">Total : {formatCurrency(invoiceDraftItems.reduce((sum, item) => sum + item.quantite * item.prix_unitaire, 0))}</strong>
              <div className="flex gap-2">
                <button type="button" onClick={() => setInvoiceBeingEdited(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800 hover:bg-gray-100">Annuler</button>
                <button type="button" onClick={() => void handleSaveInvoice()} disabled={invoiceSaving} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50">{invoiceSaving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de suppression */}
      {isDeleteModalOpen && reservationToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
              <h3 className="text-white font-bold mb-2">Confirmer la suppression</h3>
              <p className="text-gray-400 text-sm">
                Supprimer la réservation de <br />
                <strong className="text-white">
                  {reservationToDelete.client?.prenom} {reservationToDelete.client?.nom}
                </strong>
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm flex items-center justify-center gap-2"
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader size={16} className="animate-spin" /> : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
