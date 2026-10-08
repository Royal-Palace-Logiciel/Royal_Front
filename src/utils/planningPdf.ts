import type { PlanningAssignment } from '../services/planning.service';

const weekdays = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];
const pdfText = (value: string) => value.replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/…/g, '...');
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', options);

export async function exportWeeklyPlanningPdf({
  category,
  prefix,
  weekDates,
  assignmentsByDate,
}: {
  category: string;
  prefix: string;
  weekDates: string[];
  assignmentsByDate: Record<string, PlanningAssignment[]>;
}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const postWidth = 20;
  const dayWidth = (pageWidth - margin * 2 - postWidth) / weekDates.length;
  const rowBottom = pageHeight - 15;
  let y = 0;

  const drawTableHeader = (top: number) => {
    const height = 12;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setFillColor(34, 45, 62);
    pdf.setDrawColor(218, 224, 232);
    pdf.rect(margin, top, postWidth, height, 'FD');
    pdf.setTextColor(255, 255, 255);
    pdf.text('POSTE', margin + postWidth / 2, top + 7.5, { align: 'center' });
    weekDates.forEach((date, index) => {
      const x = margin + postWidth + index * dayWidth;
      pdf.rect(x, top, dayWidth, height, 'FD');
      pdf.setFontSize(6.5);
      pdf.text(weekdays[index], x + dayWidth / 2, top + 5, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(229, 190, 99);
      pdf.text(dateLabel(date, { day: '2-digit', month: '2-digit', year: 'numeric' }), x + dayWidth / 2, top + 9, { align: 'center' });
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
    });
    return top + height;
  };

  const drawPageTitle = (continuation = false) => {
    pdf.setFillColor(247, 248, 250);
    pdf.rect(0, 0, pageWidth, 37, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(35, 47, 64);
    pdf.setFontSize(9);
    pdf.text(continuation ? 'PLANNING HEBDOMADAIRE - SUITE' : 'PLANNING HEBDOMADAIRE', margin, 12);
    pdf.setFontSize(17);
    pdf.text(pdfText(category), margin, 22);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(95, 108, 124);
    pdf.setFontSize(9);
    pdf.text(`${dateLabel(weekDates[0], { day: '2-digit', month: 'long', year: 'numeric' })} - ${dateLabel(weekDates[weekDates.length - 1], { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, 30);
  };

  drawPageTitle();
  y = drawTableHeader(41);

  const slotSet = new Set<number>([1, 2, 3, 4, 5, 6]);
  weekDates.forEach((date) => (assignmentsByDate[date] || []).forEach((item) => slotSet.add(item.slot)));
  const slots = [...slotSet].sort((left, right) => left - right);

  slots.forEach((slot, rowIndex) => {
    const cells = weekDates.map((date) => {
      const assignment = (assignmentsByDate[date] || []).find((item) => item.slot === slot);
      const name = assignment?.employeeName.trim() || '—';
      const lines = pdf.splitTextToSize(pdfText(name), dayWidth - 6) as string[];
      if (lines.length > 2) lines.splice(1, lines.length - 1, `${lines[1].slice(0, -2)}...`);
      return { assignment, lines };
    });
    const rowHeight = Math.max(17, ...cells.map(({ lines }) => lines.length * 4 + 9));
    if (y + rowHeight > rowBottom) {
      pdf.addPage();
      drawPageTitle(true);
      y = drawTableHeader(41);
    }

    pdf.setDrawColor(218, 224, 232);
    pdf.setFillColor(241, 244, 248);
    pdf.rect(margin, y, postWidth, rowHeight, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(42, 99, 115);
    pdf.text(`${prefix}${slot}`, margin + postWidth / 2, y + rowHeight / 2 + 1, { align: 'center' });

    cells.forEach(({ assignment, lines }, index) => {
      const x = margin + postWidth + index * dayWidth;
      pdf.setFillColor(rowIndex % 2 === 0 ? 255 : 250, rowIndex % 2 === 0 ? 255 : 251, rowIndex % 2 === 0 ? 255 : 253);
      pdf.rect(x, y, dayWidth, rowHeight, 'FD');
      pdf.setFont('helvetica', assignment?.employeeName.trim() ? 'bold' : 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(43, 54, 68);
      pdf.text(lines, x + 3, y + 5.5);
      const schedule = assignment?.schedule.trim();
      if (schedule) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(93, 107, 122);
        pdf.text(pdfText(schedule), x + 3, y + rowHeight - 3.5);
      }
    });
    y += rowHeight;
  });

  const totalAssignments = weekDates.reduce((total, date) => total + (assignmentsByDate[date] || []).filter((item) => item.employeeName.trim()).length, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(95, 108, 124);
  pdf.text(`${totalAssignments} affectation${totalAssignments === 1 ? '' : 's'} sur la semaine`, margin, Math.min(y + 7, rowBottom + 2));

  for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(135, 145, 157);
    pdf.text(`HDA Platform  |  ${dateLabel(weekDates[0], { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${dateLabel(weekDates[weekDates.length - 1], { day: '2-digit', month: '2-digit', year: 'numeric' })}`, margin, pageHeight - 7);
    pdf.text(`${page} / ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  pdf.setProperties({ title: pdfText(`Planning ${category}`), subject: 'Planning hebdomadaire du personnel', creator: 'HDA Platform' });
  const slug = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  pdf.save(`planning-${slug}-${weekDates[0]}-${weekDates[weekDates.length - 1]}.pdf`);
}
