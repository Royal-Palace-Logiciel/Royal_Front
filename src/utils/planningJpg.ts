import type { PlanningAssignment } from '../services/planning.service';

const weekdays = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const scheduleLabel = (schedule: string) => schedule.replace(/:/g, 'h').replace(/\s*[–-]\s*/, ' - ');

function wrapText(context: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (line && context.measureText(nextLine).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let lastLine = lines[maxLines - 1];
    while (lastLine && context.measureText(`${lastLine}…`).width > maxWidth) lastLine = lastLine.slice(0, -1);
    lines[maxLines - 1] = `${lastLine}…`;
  }
  return lines.length ? lines : ['—'];
}

export async function exportWeeklyPlanningJpg({
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
  const width = 1920;
  const margin = 40;
  const postWidth = 120;
  const titleHeight = 120;
  const headerHeight = 72;
  const rowHeight = 112;
  const footerHeight = 56;
  const slotSet = new Set<number>([1, 2, 3, 4, 5, 6]);
  weekDates.forEach((date) => (assignmentsByDate[date] || []).forEach((assignment) => slotSet.add(assignment.slot)));
  const slots = [...slotSet].sort((left, right) => left - right);
  const height = titleHeight + headerHeight + rowHeight * slots.length + footerHeight;
  const dayWidth = (width - margin * 2 - postWidth) / weekDates.length;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de créer l’image du planning.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#232f40';
  context.font = 'bold 36px Arial';
  context.fillText(`Planning ${category}`, margin, 52);
  context.fillStyle = '#5f6c7c';
  context.font = '22px Arial';
  context.fillText(`${dateLabel(weekDates[0])} - ${dateLabel(weekDates[weekDates.length - 1])}`, margin, 90);

  const headerTop = titleHeight;
  context.font = 'bold 20px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let index = 0; index < weekDates.length; index += 1) {
    const x = margin + postWidth + index * dayWidth;
    if (index < weekDates.length) {
      context.fillStyle = '#222d3e';
      context.fillRect(x, headerTop, dayWidth, headerHeight);
      context.fillStyle = '#ffffff';
      context.font = 'bold 18px Arial';
      context.fillText(weekdays[index], x + dayWidth / 2, headerTop + 25);
      context.font = '16px Arial';
      context.fillStyle = '#e5be63';
      context.fillText(dateLabel(weekDates[index]), x + dayWidth / 2, headerTop + 51);
    }
  }
  context.fillStyle = '#222d3e';
  context.fillRect(margin, headerTop, postWidth, headerHeight);
  context.fillStyle = '#ffffff';
  context.font = 'bold 18px Arial';
  context.fillText('POSTE', margin + postWidth / 2, headerTop + headerHeight / 2);

  slots.forEach((slot, rowIndex) => {
    const y = headerTop + headerHeight + rowIndex * rowHeight;
    context.fillStyle = rowIndex % 2 === 0 ? '#f1f4f8' : '#fafbfd';
    context.fillRect(margin, y, width - margin * 2, rowHeight);
    context.strokeStyle = '#dae0e8';
    context.lineWidth = 2;
    context.strokeRect(margin, y, postWidth, rowHeight);
    context.fillStyle = '#2a6373';
    context.font = 'bold 22px Arial';
    context.textAlign = 'center';
    context.fillText(`${prefix}${slot}`, margin + postWidth / 2, y + rowHeight / 2);

    weekDates.forEach((date, index) => {
      const x = margin + postWidth + index * dayWidth;
      context.strokeStyle = '#dae0e8';
      context.strokeRect(x, y, dayWidth, rowHeight);
      const assignment = (assignmentsByDate[date] || []).find((item) => item.slot === slot);
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.fillStyle = '#2b3644';
      context.font = 'bold 22px Arial';
      wrapText(context, assignment?.employeeName.trim() || '—', dayWidth - 28, 2).forEach((line, lineIndex) => context.fillText(line, x + 14, y + 18 + lineIndex * 27));
      const schedule = assignment?.schedule.trim();
      if (schedule) {
        context.fillStyle = '#5d6b7a';
        context.font = '18px Arial';
        context.fillText(scheduleLabel(schedule), x + 14, y + rowHeight - 32);
      }
    });
  });

  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillStyle = '#5f6c7c';
  context.font = '16px Arial';
  const total = weekDates.reduce((count, date) => count + (assignmentsByDate[date] || []).filter((assignment) => assignment.employeeName.trim()).length, 0);
  context.fillText(`${total} affectation${total === 1 ? '' : 's'} sur la semaine`, margin, height - footerHeight / 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('La création du JPG a échoué.')), 'image/jpeg', 0.95);
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const slug = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  anchor.href = url;
  anchor.download = `planning-${slug}-${weekDates[0]}-${weekDates[weekDates.length - 1]}.jpg`;
  anchor.click();
  URL.revokeObjectURL(url);
}
