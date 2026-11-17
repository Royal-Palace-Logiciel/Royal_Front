import React, { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/data';
import { reservationService, type Stay } from '../../services/reservation.service';
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

  const reservationById = useMemo(() => new Map(reservations.map((reservation) => [reservation.id, reservation])), [reservations]);
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
    ? [reservation.client?.prenom, reservation.client?.nom].filter(Boolean).join(' ') || `Client #${reservation.client_id}`
    : 'Réservation introuvable';
  const roomNumber = (reservation?: Reservation) => reservation
    ? roomById.get(reservation.room_id)?.numero || reservation.room?.numero || `#${reservation.room_id}`
    : '—';

  const downloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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
    <div className="space-y-2">
      <h4 className="font-semibold text-primary">{title} <span className="text-muted">({rows.length})</span></h4>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-base bg-surface-2 p-3 text-sm text-muted">Aucun mouvement pour cette journée.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base">
          <table className="w-full min-w-[640px] text-left text-sm">
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
    <section className="space-y-4 rounded-xl border border-base bg-surface p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Hôtel</p>
          <h2 className="text-xl font-bold text-primary">Rapport journalier des opérations</h2>
          <p className="text-xs text-muted">Réservations créées, check-in et check-out enregistrés à cette date.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-secondary">
            <span className="mb-1 block font-semibold">Journée</span>
            <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary" />
          </label>
          <button type="button" onClick={() => void downloadPdf()} disabled={loading || Boolean(error)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">
            <FileText size={16} /> Télécharger PDF
          </button>
          <button type="button" onClick={() => setReloadKey((current) => current + 1)} aria-label="Actualiser le rapport" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary">
            <RefreshCw size={15} /> Actualiser
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Réservations créées', value: dailyReservations.length },
          { label: 'Check-in', value: dailyCheckIns.length },
          { label: 'Check-out', value: dailyCheckOuts.length },
        ].map((metric) => (
          <div key={metric.label} className="rounded-lg border border-base bg-surface-2 p-3">
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
