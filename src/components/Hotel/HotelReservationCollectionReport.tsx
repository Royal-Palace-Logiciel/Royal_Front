import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, FileText, Printer, Save } from 'lucide-react';
import { formatCurrency } from '../../utils/data';
import { reservationService, type HotelReservationCollectionReport as CollectionReport } from '../../services/reservation.service';
import { clientService, type Client as HotelClient } from '../../services/client.service';
import type { Reservation, Room } from '../../types/hotel.types';

interface Props {
  reservations: Reservation[];
  rooms: Room[];
  refreshTrigger: number;
}

const paymentMethods: Array<{ key: keyof CollectionReport['paymentMethods']; label: string }> = [
  { key: 'ESPECES', label: 'Espèces' },
  { key: 'TPE', label: 'TPE' },
  { key: 'GRATUIT', label: 'Gratuit' },
  { key: 'VIREMENT', label: 'Virement' },
  { key: 'CREDIT', label: 'Crédit' },
  { key: 'ORANGE_MONEY', label: 'Orange Money' },
  { key: 'CARTE', label: 'Carte bancaire' },
  { key: 'MVOLA', label: 'MVola' },
];

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const displayDate = (value: string) => {
  if (!value || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR');
};

export const HotelReservationCollectionReport: React.FC<Props> = ({ reservations, rooms, refreshTrigger }) => {
  const today = localDate();
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [monthYear = '', monthNumber = ''] = selectedMonth.split('-');
  const monthLastDay = selectedMonth
    ? String(new Date(Number(monthYear), Number(monthNumber), 0).getDate()).padStart(2, '0')
    : '';
  const startDate = period === 'daily' ? selectedDate : `${selectedMonth}-01`;
  const endDate = period === 'daily'
    ? selectedDate
    : selectedMonth ? `${selectedMonth}-${monthLastDay}` : '';
  const [report, setReport] = useState<CollectionReport | null>(null);
  const [clients, setClients] = useState<HotelClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    clientService.getClients()
      .then((rows) => { if (active) setClients(rows); })
      .catch((error) => console.error('Erreur chargement des clients du rapport hôtelier:', error));
    return () => { active = false; };
  }, [refreshTrigger]);

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const guestName = (reservation: Reservation) => {
    const client = reservation.client || clientById.get(reservation.client_id);
    return [client?.prenom, client?.nom].filter(Boolean).join(' ') || `Client #${reservation.client_id}`;
  };

  useEffect(() => {
    let active = true;
    if (!startDate || !endDate || startDate > endDate) {
      setReport(null);
      setLoading(false);
      setMessage('La date de début doit précéder ou être égale à la date de fin.');
      return () => { active = false; };
    }

    setLoading(true);
    setMessage(null);
    setCopied(false);
    void reservationService.getHotelReservationCollectionReport(startDate, endDate)
      .then((data) => { if (active) setReport(data); })
      .catch((error) => {
        console.error('Erreur chargement du rapport des encaissements hôtel:', error);
        if (active) {
          setReport(null);
          setMessage('Impossible de charger le rapport. Vérifiez la connexion au serveur puis réessayez.');
        }
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [startDate, endDate, refreshTrigger]);

  const reservationsForPeriod = useMemo(() => reservations
    .filter((reservation) => !['ANNULEE', 'NO_SHOW'].includes(String(reservation.statut).toUpperCase()))
    .filter((reservation) => String(reservation.date_arrivee).slice(0, 10) <= endDate
      && String(reservation.date_depart).slice(0, 10) > startDate)
    .sort((left, right) => String(left.date_arrivee).localeCompare(String(right.date_arrivee))), [reservations, startDate, endDate]);

  const reportText = useMemo(() => [
    'RAPPORT DES ENCAISSEMENTS — HÔTEL',
    `Période : du ${displayDate(startDate)} au ${displayDate(endDate)}`,
    `Total encaissé : ${formatCurrency(report?.totalCollected || 0)}`,
    '',
    'ENCAISSEMENTS PAR MODE DE PAIEMENT',
    ...paymentMethods.map(({ key, label }) => `${label} : ${formatCurrency(report?.paymentMethods[key] || 0)}`),
    '',
    `CHAMBRES RÉSERVÉES (${reservationsForPeriod.length})`,
    ...reservationsForPeriod.map((reservation) => {
      const roomNumber = reservation.room?.numero
        || rooms.find((room) => room.id === reservation.room_id)?.numero
        || `#${reservation.room_id}`;
      const guest = guestName(reservation);
      const channel = reservation.type_reservation === 'BOOKING' ? 'Booking' : 'Sur place';
      return `Chambre ${roomNumber} — ${guest} — ${displayDate(String(reservation.date_arrivee).slice(0, 10))} au ${displayDate(String(reservation.date_depart).slice(0, 10))} — ${channel}`;
    }),
  ].join('\n'), [startDate, endDate, report, reservationsForPeriod, rooms, clients]);

  const saveReport = async () => {
    if (!report) return;
    setSaving(true);
    setMessage(null);
    try {
      await reservationService.saveHotelReservationCollectionReport({
        ...report,
        reservations: reservationsForPeriod,
      });
      setMessage('Rapport enregistré.');
    } catch (error) {
      console.error('Erreur enregistrement du rapport des encaissements hôtel:', error);
      setMessage('Impossible d’enregistrer le rapport.');
    } finally {
      setSaving(false);
    }
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
    } catch (error) {
      console.error('Erreur copie du rapport des encaissements hôtel:', error);
      setCopied(false);
      setMessage('La copie a échoué. Vérifiez les autorisations du navigateur.');
    }
  };

  const downloadPdf = async () => {
    if (!report) return;
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const tableWidth = pageWidth - margin * 2;
      let y = 16;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(34, 45, 62);
      pdf.text('Royal Palace - Rapport des encaissements', margin, y);
      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(90, 100, 112);
      pdf.text(`${period === 'daily' ? 'Rapport journalier' : 'Rapport mensuel'} | ${displayDate(startDate)} - ${displayDate(endDate)}`, margin, y);
      y += 8;

      pdf.setFillColor(245, 246, 248);
      pdf.roundedRect(margin, y, tableWidth, 18, 2, 2, 'F');
      pdf.setFontSize(9);
      pdf.setTextColor(90, 100, 112);
      pdf.text('TOTAL REELLEMENT ENCAISSE', margin + 5, y + 6);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(34, 45, 62);
      pdf.text(formatCurrency(report.totalCollected), margin + 5, y + 14);
      y += 24;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(34, 45, 62);
      pdf.text('Encaissements par mode de paiement', margin, y);
      y += 4;
      const paymentColWidth = tableWidth / 4;
      const paymentRowHeight = 12;
      paymentMethods.forEach(({ key, label }, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const x = margin + col * paymentColWidth;
        const top = y + row * paymentRowHeight;
        pdf.setFillColor(row % 2 === 0 ? 248 : 255, 249, 251);
        pdf.setDrawColor(225, 229, 234);
        pdf.rect(x, top, paymentColWidth, paymentRowHeight, 'FD');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(90, 100, 112);
        pdf.text(label, x + 3, top + 5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(34, 45, 62);
        pdf.text(formatCurrency(report.paymentMethods[key] || 0), x + 3, top + 10);
      });
      y += Math.ceil(paymentMethods.length / 4) * paymentRowHeight + 8;

      const columns = [
        { label: 'Chambre', width: 18 },
        { label: 'Client', width: 45 },
        { label: 'Arrivée', width: 24 },
        { label: 'Départ', width: 24 },
        { label: 'Origine', width: 27 },
        { label: 'Statut', width: 28 },
        { label: 'Total (Ar)', width: 35 },
        { label: 'Payé (Ar)', width: 35 },
        { label: 'Reste (Ar)', width: 35 },
      ];
      const drawPageHeading = (continued: boolean) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(34, 45, 62);
        pdf.text(`Reservations presentes sur la periode${continued ? ' - suite' : ''}`, margin, 14);
      };
      const drawTableHeader = (top: number) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setFillColor(34, 45, 62);
        pdf.setDrawColor(218, 224, 232);
        pdf.setTextColor(255, 255, 255);
        let x = margin;
        columns.forEach((column) => {
          pdf.rect(x, top, column.width, 9, 'FD');
          pdf.text(column.label, x + 2, top + 6);
          x += column.width;
        });
      };
      drawPageHeading(false);
      y = 18;
      drawTableHeader(y);
      y += 9;
      reservationsForPeriod.forEach((reservation, index) => {
        const total = Number(reservation.montant_total) || 0;
        const paid = Number(reservation.montant_paye) || 0;
        const values = [
          reservation.room?.numero || rooms.find((room) => room.id === reservation.room_id)?.numero || `#${reservation.room_id}`,
          guestName(reservation),
          displayDate(String(reservation.date_arrivee).slice(0, 10)),
          displayDate(String(reservation.date_depart).slice(0, 10)),
          reservation.type_reservation === 'BOOKING' ? 'Booking' : 'Sur place',
          reservation.statut,
          formatCurrency(total),
          formatCurrency(paid),
          formatCurrency(Math.max(0, total - paid)),
        ];
        const cellLines = values.map((value, cellIndex) =>
          pdf.splitTextToSize(String(value), columns[cellIndex].width - 4) as string[]
        );
        const rowHeight = Math.max(9, ...cellLines.map((lines) => lines.length * 3.5 + 3));
        if (y + rowHeight > pageHeight - 14) {
          pdf.addPage();
          drawPageHeading(true);
          y = 18;
          drawTableHeader(y);
          y += 9;
        }
        let x = margin;
        cellLines.forEach((lines, cellIndex) => {
          pdf.setFillColor(index % 2 === 0 ? 255 : 247, index % 2 === 0 ? 255 : 249, index % 2 === 0 ? 255 : 251);
          pdf.setDrawColor(225, 229, 234);
          pdf.rect(x, y, columns[cellIndex].width, rowHeight, 'FD');
          pdf.setFont('helvetica', cellIndex === 0 ? 'bold' : 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(45, 54, 66);
          pdf.text(lines, x + 2, y + 5);
          x += columns[cellIndex].width;
        });
        y += rowHeight;
      });

      for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
        pdf.setPage(page);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(135, 145, 157);
        pdf.text(`Royal Palace | ${displayDate(startDate)} - ${displayDate(endDate)}`, margin, pageHeight - 6);
        pdf.text(`${page} / ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      }
      pdf.setProperties({ title: 'Rapport des encaissements hôtel', creator: 'Royal Palace' });
      pdf.save(`hotel-encaissements-${period === 'daily' ? startDate : selectedMonth}.pdf`);
    } catch (error) {
      console.error('Erreur génération du PDF des encaissements hôtel:', error);
      setMessage('Impossible de générer le PDF. Réessayez.');
    }
  };

  return (
    <section className="space-y-4">
      <div className="print:hidden">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold">Hôtel</p>
        <h2 className="text-2xl font-bold text-primary">Rapport des encaissements</h2>
      </div>

      <div className="space-y-5 rounded-xl border border-base bg-surface p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h3 className="text-lg font-semibold text-primary">Encaissements des réservations hôtel</h3>
            <p className="text-xs text-muted">Encaissements enregistrés pendant la journée ou le mois sélectionné.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex rounded-lg border border-base bg-surface-2 p-1">
              <button type="button" onClick={() => setPeriod('daily')} aria-pressed={period === 'daily'} className={`rounded-md px-3 py-2 text-sm ${period === 'daily' ? 'bg-accent text-black' : 'text-muted'}`}>Journalier</button>
              <button type="button" onClick={() => setPeriod('monthly')} aria-pressed={period === 'monthly'} className={`rounded-md px-3 py-2 text-sm ${period === 'monthly' ? 'bg-accent text-black' : 'text-muted'}`}>Mensuel</button>
            </div>
            <label className="text-xs text-secondary">
              <span className="mb-1 block font-semibold">{period === 'daily' ? 'Journée' : 'Mois'}</span>
              {period === 'daily' ? (
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary" />
              ) : (
                <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary" />
              )}
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-accent/20 bg-surface-2 p-4">
          <p className="text-xs text-muted">Total encaissé {period === 'daily' ? 'le' : 'du mois de'} {period === 'daily' ? displayDate(startDate) : new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
          <p className="mt-1 text-2xl font-bold text-accent">{loading ? 'Chargement…' : formatCurrency(report?.totalCollected || 0)}</p>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-primary">Détail par mode de paiement</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {paymentMethods.map(({ key, label }) => (
              <div key={key} className="rounded-lg border border-base bg-surface-2 p-3">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 text-lg font-semibold text-primary">{formatCurrency(report?.paymentMethods[key] || 0)}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 font-semibold text-primary">Chambres réservées pendant la période</h4>
          {reservationsForPeriod.length === 0 ? (
            <p className="rounded-lg border border-base bg-surface-2 p-3 text-sm text-muted">Aucune réservation sur cette période.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-base">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-surface-2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Chambre</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Séjour</th>
                    <th className="px-3 py-2">Origine</th>
                    <th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {reservationsForPeriod.map((reservation) => (
                    <tr key={reservation.id} className="border-t border-base text-primary">
                      <td className="px-3 py-2 font-medium">{reservation.room?.numero || rooms.find((room) => room.id === reservation.room_id)?.numero || `#${reservation.room_id}`}</td>
                      <td className="px-3 py-2">{guestName(reservation)}</td>
                      <td className="px-3 py-2">{displayDate(String(reservation.date_arrivee).slice(0, 10))} – {displayDate(String(reservation.date_depart).slice(0, 10))}</td>
                      <td className="px-3 py-2">{reservation.type_reservation === 'BOOKING' ? 'Booking' : 'Sur place'}</td>
                      <td className="px-3 py-2">{reservation.statut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {message && <p role="status" className={`text-sm ${message.startsWith('Rapport') ? 'text-emerald-400' : 'text-red-400'}`}>{message}</p>}

        <div className="flex flex-col gap-3 border-t border-base pt-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Actions du rapport</p>
            <p className="text-xs text-muted">Enregistrez vos modifications ou préparez une version papier.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void saveReport()} disabled={saving || loading || !report} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5 hover:shadow-accent/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
              <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => void downloadPdf()} disabled={loading || !report} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-base bg-surface-2 px-4 py-2.5 text-sm font-semibold text-primary transition-all hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60">
              <FileText size={16} /> Télécharger PDF
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-base bg-surface-2 px-4 py-2.5 text-sm font-semibold text-primary transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10">
              <Printer size={16} /> Imprimer
            </button>
          </div>
        </div>

        {report && !loading && (
          <div className="space-y-2 print:hidden">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-primary">Rapport texte copiable</h4>
              <button
                type="button"
                onClick={() => void copyReport()}
                aria-label="Copier le rapport Hôtel pour WhatsApp"
                className="inline-flex items-center gap-2 rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-accent hover:text-accent"
              >
                <Clipboard size={16} aria-hidden="true" /> {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <textarea
              readOnly
              value={reportText}
              aria-label="Rapport Hôtel généré"
              className="min-h-[420px] w-full resize-y rounded-xl border border-base bg-surface-2 p-4 text-sm leading-6 text-primary outline-none"
            />
          </div>
        )}
      </div>
    </section>
  );
};
