import React, { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/data';
import { reservationService, type Stay } from '../../services/reservation.service';
import { clientService, type Client as HotelClient } from '../../services/client.service';
import type { Reservation, Room } from '../../types/hotel.types';

interface Props {
  reservations: Reservation[];
  rooms: Room[];
  refreshTrigger: number;
}

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const displayDate = (value: string) => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const displayTime = (value: string | null) => value ? value.slice(11, 16) : '—';

export const HotelDailyOperationsReport: React.FC<Props> = ({ reservations, rooms, refreshTrigger }) => {
  const [reportDate, setReportDate] = useState(localDate);
  const [stays, setStays] = useState<Stay[]>([]);
  const [clients, setClients] = useState<HotelClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    reservationService.getStays()
      .then((rows) => { if (active) setStays(rows); })
      .catch((cause) => {
        console.error('Erreur lors du chargement des séjours pour le rapport journalier:', cause);
        if (active) setError('Impossible de charger les arrivées et départs. Réessayez.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshTrigger, reloadKey]);

  useEffect(() => {
    let active = true;
    clientService.getClients()
      .then((rows) => { if (active) setClients(rows); })
      .catch((cause) => console.error('Erreur lors du chargement des clients du rapport hôtelier:', cause));
    return () => { active = false; };
  }, [refreshTrigger, reloadKey]);

  const reservationById = useMemo(() => new Map(reservations.map((reservation) => [reservation.id, reservation])), [reservations]);
  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const dailyReservations = useMemo(() => reservations
    .filter((reservation) => String(reservation.created_at || '').slice(0, 10) === reportDate)
    .sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || ''))), [reservations, reportDate]);
  const dailyCheckIns = useMemo(() => stays
    .filter((stay) => String(stay.checkin_at || '').slice(0, 10) === reportDate)
    .sort((left, right) => String(left.checkin_at || '').localeCompare(String(right.checkin_at || ''))), [stays, reportDate]);
  const dailyCheckOuts = useMemo(() => stays
    .filter((stay) => String(stay.checkout_at || '').slice(0, 10) === reportDate)
    .sort((left, right) => String(left.checkout_at || '').localeCompare(String(right.checkout_at || ''))), [stays, reportDate]);

  const guestName = (reservation?: Reservation) => reservation
    ? [reservation.client?.prenom || clientById.get(reservation.client_id)?.prenom, reservation.client?.nom || clientById.get(reservation.client_id)?.nom].filter(Boolean).join(' ') || `Client #${reservation.client_id}`
    : 'Réservation introuvable';
  const roomNumber = (reservation?: Reservation) => reservation
    ? roomById.get(reservation.room_id)?.numero || reservation.room?.numero || `#${reservation.room_id}`
    : '—';

  const downloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const [pdfReservations, pdfStays, pdfClients] = await Promise.all([
        reservationService.getReservations(),
        reservationService.getStays(),
        clientService.getClients(),
      ]);
      {
        const report = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const width = report.internal.pageSize.getWidth();
        const height = report.internal.pageSize.getHeight();
        const margin = 12;
        const columns = [25, 46, 17, 16, 12, 30, 40];
        const headings = ['Arriv./Dép.', 'Nom du client', 'N° Fact.', 'Ch.', 'A/D', 'Montant', 'Mode de paiement'];
        const dailyStayEvents = pdfStays.filter((stay) =>
          String(stay.checkin_at || '').slice(0, 10) === reportDate
          || String(stay.checkout_at || '').slice(0, 10) === reportDate
        );
        const reportReservations = new Map<number, Reservation>();
        pdfReservations
          .filter((reservation) => String(reservation.created_at || '').slice(0, 10) === reportDate)
          .forEach((reservation) => reportReservations.set(reservation.id, reservation));
        dailyStayEvents.forEach((stay) => {
          const reservation = stay.reservation_id ? pdfReservations.find((row) => row.id === stay.reservation_id) : undefined;
          if (reservation) reportReservations.set(reservation.id, reservation);
        });
        const departed = await Promise.all([...reportReservations.values()].map(async (reservation) => {
          const stay = dailyStayEvents.find((event) => event.reservation_id === reservation.id && event.checkout_at) || dailyStayEvents.find((event) => event.reservation_id === reservation.id);
          const nights = reservation?.date_arrivee && reservation.date_depart
            ? Math.max(0, Math.round((new Date(`${reservation.date_depart}T00:00:00`).getTime() - new Date(`${reservation.date_arrivee}T00:00:00`).getTime()) / 86400000)) : 0;
          const guests = reservation.occupants?.map((guest) => [guest.prenom, guest.nom].filter(Boolean).join(' ')).filter(Boolean) || [];
          const clientRecord = reservation.client || pdfClients.find((row) => row.id === reservation.client_id);
          const clientName = [clientRecord?.prenom, clientRecord?.nom].filter(Boolean).join(' ') || `Client #${reservation.client_id}`;
          const client = [clientName, ...guests].join('\n');
          const paymentLabels: Record<string, string> = {
            ESPECES: 'ESPÈCES', TPE: 'TPE', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
            CARTE: 'Carte bancaire', VIREMENT: 'Virement', CHEQUE: 'Chèque', CREDIT: 'Crédit', GRATUIT: 'Gratuit',
          };
          let modes: Array<{ mode: string; amount: number }> = [];
          try {
            const payments = await reservationService.getReservationPayments(reservation.id);
            payments.filter((payment) => String(payment.created_at || '').slice(0, 10) === reportDate && payment.statut !== 'ANNULE')
              .forEach((payment) => {
                const allocations = payment.details?.modes_paiement;
                if (allocations?.length) {
                  allocations.forEach((allocation) => modes.push({ mode: allocation.moyen_paiement, amount: Number(allocation.montant || 0) }));
                } else if (payment.moyen_paiement) {
                  modes.push({ mode: payment.moyen_paiement, amount: Number(payment.montant_encaisse ?? payment.montant ?? 0) });
                }
              });
          } catch (cause) {
            console.warn(`Paiements détaillés indisponibles pour la réservation #${reservation.id}`, cause);
          }
          if (!modes.length) {
            const fallback = reservation.moyen_paiement || (Number(reservation.montant_credit || 0) > 0 ? 'CREDIT' : '—');
            modes = [{ mode: fallback, amount: Number(reservation.montant_encaisse ?? reservation.montant_paye ?? 0) }];
          }
          const labelModes = [...new Set(modes.map(({ mode }) => paymentLabels[mode] || mode.replaceAll('_', ' ')))].join(' + ');
          return { stay, reservation, nights, client, modes, labelModes };
        }));
        const drawHeading = (continued = false) => {
          report.setFillColor(29, 40, 54);
          report.rect(0, 0, width, 31, 'F');
          report.setFont('times', 'bold'); report.setFontSize(13); report.setTextColor(222, 184, 104);
          report.text('ROYAL PALACE', width / 2, 15, { align: 'center' });
          report.setFontSize(15); report.setTextColor(255, 255, 255);
          report.text(`DÉPARTS EFFECTUÉS ENTRE ${displayDate(reportDate)}${continued ? ' (suite)' : ''}`, width / 2, 23, { align: 'center' });
          report.setFont('helvetica', 'normal'); report.setFontSize(7); report.setTextColor(225, 230, 236);
          report.text('RAPPORT JOURNALIER DES OPERATIONS HOTELIERES', width / 2, 28, { align: 'center' });
          report.setDrawColor(190, 150, 68); report.setLineWidth(0.8); report.line(margin, 34, width - margin, 34);
        };
        const drawColumns = (top: number) => {
          let x = margin;
          report.setFont('helvetica', 'bold'); report.setFontSize(7);
          headings.forEach((heading, index) => {
            report.setFillColor(39, 54, 70); report.setDrawColor(39, 54, 70);
            report.rect(x, top, columns[index], 9, 'FD'); report.setTextColor(255, 255, 255);
            report.text(heading, x + columns[index] / 2, top + 5.7, { align: 'center' }); x += columns[index];
          });
          return top + 9;
        };
        drawHeading();
        report.setFont('times', 'bolditalic'); report.setFontSize(12); report.text('Factures sur séjour', margin, 34);
        let y = drawColumns(47);
        departed.forEach((item, rowIndex) => {
          const cells = [
            `${displayDate(item.reservation?.date_arrivee || '')}\nAU\n${displayDate(item.stay?.checkout_at || item.reservation?.date_depart || reportDate)}`,
            item.client,
            String(item.reservation?.id || item.stay.reservation_id || '—'),
            String(roomById.get(item.reservation.room_id)?.numero || item.reservation.room?.numero || `#${item.reservation.room_id}`), String(item.nights),
            formatCurrency(item.reservation?.montant_total || 0), item.labelModes,
          ].map((value, index) => report.splitTextToSize(value, columns[index] - 3) as string[]);
          const rowHeight = Math.max(10, ...cells.map((lines) => lines.length * 4 + 4));
          if (y + rowHeight > height - 42) { report.addPage(); drawHeading(true); y = drawColumns(47); }
          let x = margin;
          cells.forEach((lines, index) => {
            report.setFillColor(rowIndex % 2 ? 248 : 255, rowIndex % 2 ? 249 : 255, rowIndex % 2 ? 251 : 255);
            report.setDrawColor(205, 211, 218); report.setLineWidth(0.18); report.rect(x, y, columns[index], rowHeight, 'FD');
            report.setFont('helvetica', index === 1 ? 'bold' : 'normal'); report.setFontSize(8); report.setTextColor(37, 48, 60);
            report.text(lines, x + columns[index] / 2, y + 5, { align: 'center' }); x += columns[index];
          });
          y += rowHeight;
        });
        if (!departed.length) {
          report.setFont('times', 'italic'); report.setFontSize(10);
          report.text('Aucun départ enregistré pour cette journée.', width / 2, y + 10, { align: 'center' }); y += 18;
        }
        y += 8;
        const totals = new Map<string, number>();
        departed.forEach(({ modes }) => modes.forEach(({ mode, amount }) => totals.set(mode, (totals.get(mode) || 0) + amount)));
        const addTotal = (label: string, amount: number, prominent = false) => {
          if (y > height - 16) { report.addPage(); drawHeading(true); y = 35; }
          if (prominent) {
            report.setFillColor(244, 240, 230);
            report.roundedRect(margin, y - 7, width - margin * 2, 15, 2, 2, 'F');
          }
          report.setFont('helvetica', 'bold'); report.setFontSize(prominent ? 8 : 7);
          report.setTextColor(prominent ? 39 : 92, prominent ? 54 : 98, prominent ? 70 : 108);
          report.text(label.toUpperCase(), margin + (prominent ? 4 : 0), y);
          const value = `${formatCurrency(amount)} AR`;
          report.setFontSize(prominent ? 13 : 9); report.setTextColor(29, 40, 54);
          report.text(value, width - margin - (prominent ? 4 : 0), y, { align: 'right' });
          if (!prominent) { report.setDrawColor(220, 224, 229); report.setLineWidth(0.2); report.line(margin, y + 3, width - margin, y + 3); }
          y += prominent ? 19 : 12;
        };
        addTotal(`Total recettes encaissées du ${displayDate(reportDate)}`, [...totals.values()].reduce((sum, amount) => sum + amount, 0), true);
        const paymentLabels: Record<string, string> = { ESPECES: 'ESPÈCES', TPE: 'TPE', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money', CARTE: 'Carte bancaire', VIREMENT: 'Virement', CHEQUE: 'Chèque', CREDIT: 'Crédit', GRATUIT: 'Gratuit' };
        totals.forEach((amount, mode) => addTotal(paymentLabels[mode] || mode.replaceAll('_', ' '), amount));
        report.setProperties({ title: 'Départs effectués - rapport journalier hôtel', creator: 'Royal Palace' });
        report.save(`hotel-operations-journalieres-${reportDate}.pdf`);
        return;
      }
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      let y = 0;

      const drawPageHeader = (continued = false) => {
        pdf.setFillColor(247, 248, 250);
        pdf.rect(0, 0, pageWidth, 30, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(34, 45, 62);
        pdf.text(`Royal Palace - Rapport journalier des operations${continued ? ' (suite)' : ''}`, margin, 13);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 100, 112);
        pdf.text(`Journee du ${displayDate(reportDate)} | Genere le ${new Date().toLocaleString('fr-FR')}`, margin, 21);
      };

      const drawTable = (
        title: string,
        headers: string[],
        rows: string[][],
        widths: number[],
      ) => {
        const tableWidth = widths.reduce((total, width) => total + width, 0);
        const drawHeader = (top: number) => {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7);
          pdf.setTextColor(34, 45, 62);
          pdf.text(title, margin, top);
          const headerY = top + 3;
          let x = margin;
          headers.forEach((header, index) => {
            pdf.setFillColor(34, 45, 62);
            pdf.setDrawColor(218, 224, 232);
            pdf.rect(x, headerY, widths[index], 9, 'FD');
            pdf.setTextColor(255, 255, 255);
            pdf.text(pdf.splitTextToSize(header, widths[index] - 3) as string[], x + 1.5, headerY + 4);
            x += widths[index];
          });
          return headerY + 9;
        };

        y = drawHeader(y);
        rows.forEach((row, rowIndex) => {
          const cells = row.map((value, index) => pdf.splitTextToSize(value, widths[index] - 3) as string[]);
          const rowHeight = Math.max(8, ...cells.map((lines) => lines.length * 3.5 + 3));
          if (y + rowHeight > pageHeight - 14) {
            pdf.addPage();
            drawPageHeader(true);
            y = drawHeader(35);
          }
          let x = margin;
          cells.forEach((lines, index) => {
            pdf.setFillColor(rowIndex % 2 === 0 ? 255 : 247, rowIndex % 2 === 0 ? 255 : 249, rowIndex % 2 === 0 ? 255 : 251);
            pdf.setDrawColor(225, 229, 234);
            pdf.rect(x, y, widths[index], rowHeight, 'FD');
            pdf.setFont('helvetica', index === 0 ? 'bold' : 'normal');
            pdf.setFontSize(7);
            pdf.setTextColor(45, 54, 66);
            pdf.text(lines, x + 1.5, y + 4.5);
            x += widths[index];
          });
          y += rowHeight;
        });
        y += 7;
        if (tableWidth > pageWidth - margin * 2) {
          throw new Error('Largeur du tableau PDF supérieure à la page.');
        }
      };

      drawPageHeader();
      y = 35;
      const summaryWidth = (pageWidth - margin * 2 - 8) / 3;
      [
        { label: 'Reservations creees', value: dailyReservations.length },
        { label: 'Check-in', value: dailyCheckIns.length },
        { label: 'Check-out', value: dailyCheckOuts.length },
      ].forEach((metric, index) => {
        const x = margin + index * (summaryWidth + 4);
        pdf.setFillColor(245, 246, 248);
        pdf.roundedRect(x, y, summaryWidth, 16, 2, 2, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(90, 100, 112);
        pdf.text(metric.label, x + 4, y + 6);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(34, 45, 62);
        pdf.text(String(metric.value), x + 4, y + 13);
      });
      y += 23;

      const reservationRows = dailyReservations.map((reservation) => [
        `#${reservation.id}`,
        String(reservation.created_at || '').slice(11, 16) || '—',
        String(roomNumber(reservation)),
        guestName(reservation),
        `${displayDate(reservation.date_arrivee)} - ${displayDate(reservation.date_depart)}`,
        reservation.statut,
        formatCurrency(reservation.montant_total || 0),
      ]);
      drawTable(
        'Reservations creees dans la journee',
        ['N°', 'Heure', 'Chambre', 'Client', 'Sejour prevu', 'Statut', 'Total'],
        reservationRows,
        [16, 18, 22, 42, 42, 28, 35],
      );

      const stayRows = (items: Stay[], field: 'checkin_at' | 'checkout_at') => items.map((stay) => {
        const reservation = stay.reservation_id ? reservationById.get(stay.reservation_id) : undefined;
        return [
          `#${stay.reservation_id || '—'}`,
          displayTime(stay[field]),
          String(roomNumber(reservation)),
          guestName(reservation),
          reservation?.statut || '—',
          formatCurrency(reservation?.montant_total || 0),
          formatCurrency(reservation?.montant_paye || 0),
        ];
      });
      const stayHeaders = ['N° réservation', 'Heure', 'Chambre', 'Client', 'Statut', 'Total', 'Payé'];
      const stayWidths = [26, 18, 22, 48, 32, 38, 38];
      drawTable('Check-in effectues dans la journee', stayHeaders, stayRows(dailyCheckIns, 'checkin_at'), stayWidths);
      drawTable('Check-out effectues dans la journee', stayHeaders, stayRows(dailyCheckOuts, 'checkout_at'), stayWidths);

      for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
        pdf.setPage(page);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(135, 145, 157);
        pdf.text(`Royal Palace | ${displayDate(reportDate)}`, margin, pageHeight - 6);
        pdf.text(`${page} / ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      }
      pdf.setProperties({ title: 'Rapport journalier des operations hôtel', creator: 'Royal Palace' });
      pdf.save(`hotel-operations-journalieres-${reportDate}.pdf`);
    } catch (cause) {
      console.error('Erreur génération du PDF journalier des opérations:', cause);
      setError('Impossible de générer le PDF. Réessayez.');
    }
  };

  const renderStayTable = (title: string, rows: Stay[], field: 'checkin_at' | 'checkout_at') => (
    <div className="min-w-0 space-y-3 rounded-2xl border border-base bg-surface p-4 sm:p-5">
      <h4 className="font-semibold text-primary">{title} <span className="text-muted">({rows.length})</span></h4>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-base bg-surface-2 p-3 text-sm text-muted">Aucun mouvement pour cette journée.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-base">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-muted">
              <tr><th className="px-3 py-2">Heure</th><th className="px-3 py-2">Chambre</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Réservation</th><th className="px-3 py-2">Total / Payé</th></tr>
            </thead>
            <tbody>
              {rows.map((stay) => {
                const reservation = stay.reservation_id ? reservationById.get(stay.reservation_id) : undefined;
                return (
                  <tr key={stay.id} className="border-t border-base text-primary">
                    <td className="px-3 py-2">{displayTime(stay[field])}</td>
                    <td className="px-3 py-2 font-medium">{roomNumber(reservation)}</td>
                    <td className="px-3 py-2">{guestName(reservation)}</td>
                    <td className="px-3 py-2">#{stay.reservation_id || '—'}</td>
                    <td className="px-3 py-2">{reservation ? `${formatCurrency(reservation.montant_total || 0)} / ${formatCurrency(reservation.montant_paye || 0)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <section className="min-w-0 space-y-5 rounded-2xl border border-base bg-surface p-3 shadow-sm sm:p-5 lg:p-6">
      <div className="flex min-w-0 flex-col gap-4 rounded-2xl bg-gradient-to-br from-surface-2/80 to-transparent p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Hôtel</p>
          <h2 className="text-xl font-bold text-primary">Rapport journalier des opérations</h2>
          <p className="text-xs text-muted">Réservations créées, check-in et check-out enregistrés à cette date.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] lg:w-auto lg:min-w-[470px]">
          <label className="min-w-0 text-xs text-secondary">
            <span className="mb-1 block font-semibold">Journée</span>
            <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </label>
          <button type="button" onClick={() => void downloadPdf()} disabled={loading || Boolean(error)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 self-end rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            <FileText size={16} /> Télécharger PDF
          </button>
          <button type="button" onClick={() => setReloadKey((current) => current + 1)} aria-label="Actualiser le rapport" className="inline-flex min-h-11 w-full items-center justify-center gap-2 self-end rounded-xl border border-base bg-surface-2 px-3 py-2 text-sm text-primary transition hover:bg-surface sm:w-auto">
            <RefreshCw size={15} /> <span className="sm:hidden lg:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Réservations créées', value: dailyReservations.length },
          { label: 'Check-in', value: dailyCheckIns.length },
          { label: 'Check-out', value: dailyCheckOuts.length },
        ].map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-2xl border border-base bg-surface-2 p-4 transition hover:border-accent/30 sm:p-5">
            <p className="text-xs text-muted">{metric.label}</p>
            <p className="mt-1 text-xl font-bold text-primary">{loading ? '…' : metric.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted"><RefreshCw size={15} className="animate-spin" /> Chargement des séjours…</p>
      ) : (
        <>
          <div className="space-y-2">
            <h4 className="font-semibold text-primary">Réservations créées dans la journée <span className="text-muted">({dailyReservations.length})</span></h4>
            {dailyReservations.length === 0 ? (
              <p className="rounded-lg border border-base bg-surface-2 p-3 text-sm text-muted">Aucune réservation créée pour cette journée.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-base">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-surface-2 text-xs uppercase text-muted">
                    <tr><th className="px-3 py-2">Heure</th><th className="px-3 py-2">Chambre</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Séjour</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Total</th></tr>
                  </thead>
                  <tbody>
                    {dailyReservations.map((reservation) => (
                      <tr key={reservation.id} className="border-t border-base text-primary">
                        <td className="px-3 py-2">{String(reservation.created_at || '').slice(11, 16) || '—'}</td>
                        <td className="px-3 py-2 font-medium">{roomNumber(reservation)}</td>
                        <td className="px-3 py-2">{guestName(reservation)}</td>
                        <td className="px-3 py-2">{displayDate(reservation.date_arrivee)} – {displayDate(reservation.date_depart)}</td>
                        <td className="px-3 py-2">{reservation.statut}</td>
                        <td className="px-3 py-2">{formatCurrency(reservation.montant_total || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {renderStayTable('Check-in effectués dans la journée', dailyCheckIns, 'checkin_at')}
          {renderStayTable('Check-out effectués dans la journée', dailyCheckOuts, 'checkout_at')}
        </>
      )}
    </section>
  );
};
