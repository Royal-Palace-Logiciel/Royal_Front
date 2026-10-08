import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ContactRound, Download, Dices, Pencil, Plus, Save, ShieldCheck, Sparkles, Trash2, UtensilsCrossed, Wine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import planningService, { PlanningAssignment } from '../services/planning.service';
import rhService, { RHEmployee } from '../services/rh.service';
import { exportWeeklyPlanningPdf } from '../utils/planningPdf';
import { exportWeeklyPlanningJpg } from '../utils/planningJpg';

const categories: Array<{ name: string; icon: LucideIcon; description: string; prefix: string; color: string }> = [
  { name: 'Videur', icon: ShieldCheck, description: 'Équipe de sécurité', prefix: 'V', color: '#ff6b00' },
  { name: 'Femme de ménage', icon: Sparkles, description: 'Personnel d’entretien', prefix: 'F', color: '#ff9f1c' },
  { name: 'Agents d’accueil', icon: ContactRound, description: 'Accueil et réception', prefix: 'A', color: '#ff355e' },
  { name: 'Bar', icon: Wine, description: 'Équipe du bar', prefix: 'B', color: '#39ff14' },
  { name: 'Restaurant', icon: UtensilsCrossed, description: 'Équipe de restauration', prefix: 'R', color: '#00e5ff' },
  { name: 'Poker', icon: Dices, description: 'Équipe poker', prefix: 'P', color: '#4d7dff' },
];

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => localDate(new Date());
const getWeekDates = (dateValue: string) => {
  const monday = new Date(`${dateValue}T12:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return localDate(day);
  });
};
const defaultSchedule = '00:00 – 00:00';
const videurSchedules: Record<number, Record<number, string>> = {
  1: { 1: '19:00 – 05:00', 4: '19:00 – 05:00', 5: '19:00 – 05:00', 6: '19:00 – 05:00' },
  2: { 2: '19:00 – 05:00', 3: '19:00 – 05:00', 5: '19:00 – 05:00', 6: '19:00 – 05:00' },
  3: { 2: '19:00 – 05:00', 3: '19:00 – 05:00', 5: '19:00 – 05:00', 6: '19:00 – 05:00' },
  4: { 4: '19:00 – 05:00', 5: '19:00 – 05:00', 6: '19:00 – 05:00' },
  5: { 5: '19:00 – 05:00', 6: '19:00 – 05:00', 0: '19:00 – 05:00' },
  6: { 5: '19:00 – 05:00', 6: '19:00 – 05:00', 0: '07:00 – 17:00' },
};
const cleaningSchedules: Record<number, Record<number, string>> = {
  1: { 1: '07:00 – 15:00', 2: '07:00 – 15:00', 3: '07:00 – 15:00', 4: '07:00 – 15:00', 5: '07:00 – 15:00', 6: 'OFF', 0: '07:00 – 15:00' },
  2: { 1: '08:00 – 16:00', 2: '08:00 – 16:00', 3: 'OFF', 4: '08:00 – 16:00', 5: '08:00 – 16:00', 6: '08:00 – 16:00', 0: '08:00 – 16:00' },
  3: { 1: '09:00 – 17:00', 2: 'OFF', 3: '09:00 – 17:00', 4: '09:00 – 17:00', 5: '09:00 – 17:00', 6: '09:00 – 17:00', 0: '09:00 – 17:00' },
  4: { 1: '09:00 – 17:00', 2: '09:00 – 17:00', 3: '09:00 – 17:00', 4: '09:00 – 17:00', 5: '10:00 – 17:00', 6: '07:00 – 15:00', 0: 'OFF' },
  5: { 1: '17:00 – 23:00', 2: '17:00 – 01:00', 3: 'OFF', 4: '18:00 – 02:00', 5: '20:00 – 04:00', 6: '20:00 – 04:00', 0: '17:00 – 02:00' },
  6: { 3: '18:00 – 02:00', 5: '18:00 – 02:00', 6: '18:00 – 02:00' },
};
const accueilSchedules: Record<number, Record<number, string>> = {
  1: { 2: '17:00 – 07:00', 3: '17:00 – 07:00', 5: '17:00 – 07:00', 6: '17:00 – 07:00' },
  2: { 1: '17:00 – 07:00', 3: '07:00 – 17:00', 4: '07:00 – 17:00', 5: '07:00 – 17:00', 0: '07:00 – 17:00' },
  3: { 1: '07:00 – 17:00', 2: '07:00 – 17:00', 4: '17:00 – 07:00', 6: '07:00 – 17:00', 0: '07:00 – 17:00' },
};
const pokerSchedules: Record<number, Record<number, string>> = {
  1: { 2: '20:00 – 04:00', 3: '20:00 – 04:00', 4: '20:00 – 04:00', 5: '20:00 – 04:00', 6: '20:00 – 04:00' },
  2: { 2: '20:00 – 04:00', 3: '20:00 – 04:00', 4: '20:00 – 04:00', 5: '20:00 – 04:00', 6: '20:00 – 04:00' },
  3: { 2: '20:00 – 04:00', 3: '20:00 – 04:00', 4: '20:00 – 04:00', 5: '20:00 – 04:00', 6: '20:00 – 04:00' },
  4: { 3: '20:00 – 04:00', 4: '20:00 – 04:00', 5: '20:00 – 04:00', 6: '20:00 – 04:00' },
};
const scheduleForDate = (date: string, category: string, slot: number) => {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (category === 'Videur') return videurSchedules[slot]?.[weekday] || '';
  if (category === 'Femme de ménage') return cleaningSchedules[slot]?.[weekday] || '';
  if (category === 'Agents d’accueil') return accueilSchedules[slot]?.[weekday] || '';
  if (category === 'Poker') return pokerSchedules[slot]?.[weekday] || '';
  return defaultSchedule;
};
const emptyAssignments = (date: string, category: string): PlanningAssignment[] => Array.from({ length: 6 }, (_, index) => ({ slot: index + 1, employeeId: null, employeeName: '', schedule: scheduleForDate(date, category, index + 1) }));
const fullName = (employee: RHEmployee) => `${employee.first_name} ${employee.last_name}`.trim();
const displayDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const normalizeSchedule = (schedule: string) => {
  if (!schedule.trim()) return '';
  if (schedule.trim().toUpperCase() === 'OFF') return 'OFF';
  const match = /^((?:[01]\d|2[0-3]):[0-5]\d)(?:\s*[–-]\s*((?:[01]\d|2[0-3]):[0-5]\d))?$/.exec(schedule.trim());
  return match ? `${match[1]} – ${match[2] || '00:00'}` : defaultSchedule;
};
const normalizeAssignments = (assignments: PlanningAssignment[], date: string, category: string) => {
  const rows = new Map(emptyAssignments(date, category).map((item) => [item.slot, item]));
  assignments.forEach((item) => {
    const schedule = normalizeSchedule(item.schedule ?? scheduleForDate(date, category, item.slot));
    rows.set(item.slot, { ...item, schedule: category === 'Videur' && schedule === defaultSchedule ? '' : schedule });
  });
  return [...rows.values()].sort((left, right) => left.slot - right.slot);
};

const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const SchedulePicker = ({ value, disabled, onChange, label }: { value: string; disabled: boolean; onChange: (value: string) => void; label: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = normalizeSchedule(value);
  const isOff = normalizedValue === 'OFF';
  const [start, end] = (normalizedValue && !isOff ? normalizedValue : defaultSchedule).split(' – ');
  const displaySchedule = isOff ? 'OFF' : normalizedValue.replace(/:/g, 'h').replace(' – ', ' - ');
  const update = (nextStart: string, nextEnd: string) => onChange(`${nextStart || '00:00'} – ${nextEnd || '00:00'}`);
  const pickerClass = 'h-9 w-full min-w-0 rounded-md border border-base bg-surface px-2 text-sm tabular-nums text-primary outline-none focus:border-accent/60 disabled:opacity-60';
  return <div className="min-w-0 space-y-1">
    <button type="button" disabled={disabled} aria-label={`Modifier l’horaire ${label}`} aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className="flex h-9 w-full min-w-[168px] items-center justify-between gap-1 rounded-md border border-base bg-surface px-2 text-left font-mono text-sm tabular-nums text-primary hover:border-accent/60 disabled:opacity-60">
      <span className="whitespace-nowrap">{displaySchedule || '\u00a0'}</span>
      <ChevronDown size={14} className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && <div className="w-full min-w-[168px] space-y-3 rounded-md border border-base bg-surface-2 p-3">
      <button type="button" disabled={disabled} aria-pressed={isOff} onClick={() => onChange(isOff ? defaultSchedule : 'OFF')} className={`h-9 w-full rounded-md border px-2 text-left text-sm font-semibold ${isOff ? 'border-accent bg-accent-4 text-accent' : 'border-base bg-surface text-secondary hover:border-accent/60'}`}>OFF</button>
      <label className="block space-y-1 text-xs text-secondary">Début<input type="time" step={60} value={start} disabled={disabled} aria-label={`Heure de début ${label}`} onChange={(event) => update(event.target.value, end)} className={pickerClass} /></label>
      <label className="block space-y-1 text-xs text-secondary">Fin<input type="time" step={60} value={end} disabled={disabled} aria-label={`Heure de fin ${label}`} onChange={(event) => update(start, event.target.value)} className={pickerClass} /></label>
    </div>}
  </div>;
};

// Cellule d'une affectation : employé (avec modification) + horaire.
const AssignmentCell = ({ assignment, label, prefix, isEditing, saving, onEdit, onStopEdit, onEmployeeChange, onScheduleChange }: {
  assignment: PlanningAssignment; label: string; prefix: string; isEditing: boolean; saving: boolean;
  onEdit: () => void; onStopEdit: () => void; onEmployeeChange: (name: string) => void; onScheduleChange: (schedule: string) => void;
}) => <div className="min-w-0 space-y-1.5">
  {isEditing
    ? <input autoFocus list="planning-employees" value={assignment.employeeName} onChange={(event) => onEmployeeChange(event.target.value)} onBlur={onStopEdit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} disabled={saving} placeholder="Employé" aria-label={`Employé ${prefix}, ${label}`} className="h-9 w-full min-w-0 rounded-lg border border-base bg-surface-2 px-2 text-sm text-primary outline-none transition focus:border-accent/60 disabled:opacity-60" />
    : <button type="button" onClick={onEdit} disabled={saving} title="Modifier l'employé" aria-label={`Modifier ${prefix} ${label}`} className="flex min-h-9 w-full min-w-0 items-center justify-between gap-1 rounded-lg border border-base bg-surface-2 px-2 py-1 text-left hover:border-accent/50 disabled:opacity-50">
      <span className="min-w-0 truncate text-xs text-primary">{assignment.employeeName || <span className="text-muted">Employé</span>}</span>
      <Pencil size={12} className="shrink-0 text-accent" />
    </button>}
  <SchedulePicker value={assignment.schedule} disabled={saving} label={`${prefix} ${label}`} onChange={onScheduleChange} />
</div>;

export default function PlanningPage() {
  const { showToast } = useToast();
  const [category, setCategory] = useState(categories[0].name);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekAssignments, setWeekAssignments] = useState<Record<string, PlanningAssignment[]>>({});
  const [dirtyDates, setDirtyDates] = useState<string[]>([]);
  const [employees, setEmployees] = useState<RHEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);

  const activeCategory = categories.find((item) => item.name === category) || categories[0];
  const CategoryIcon = activeCategory.icon;
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const slots = useMemo(() => {
    const allSlots = new Set<number>([1, 2, 3, 4, 5, 6]);
    weekDates.forEach((date) => (weekAssignments[date] || []).forEach((item) => allSlots.add(item.slot)));
    return [...allSlots].sort((left, right) => left - right);
  }, [weekAssignments, weekDates]);
  // Jour affiché sur mobile/tablette : le jour sélectionné s'il est dans la semaine.
  const [mobileDayIndex, setMobileDayIndex] = useState(0);
  useEffect(() => { setMobileDayIndex(Math.max(0, weekDates.indexOf(selectedDate))); }, [weekDates, selectedDate]);
  const mobileDate = weekDates[mobileDayIndex] || weekDates[0];
  const getAssignment = (date: string, slot: number): PlanningAssignment =>
    (weekAssignments[date] || []).find((item) => item.slot === slot) || { slot, employeeId: null, employeeName: '', schedule: scheduleForDate(date, category, slot) };
  const assignedCount = weekDates.reduce((total, date) => total + (weekAssignments[date] || []).filter((item) => item.employeeName.trim()).length, 0);

  useEffect(() => {
    let active = true;
    rhService.listEmployees({ limit: 100, status: 'ACTIF' })
      .then((result) => { if (active) setEmployees(result.rows); })
      .catch(() => { if (active) setEmployees([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setDirtyDates([]);
    Promise.all(weekDates.map((date) => planningService.getDaily(date, category)))
      .then((days) => {
        if (active) setWeekAssignments(Object.fromEntries(days.map((day) => [day.date, normalizeAssignments(day.assignments, day.date, category)])));
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError?.response?.data?.error?.message || 'Impossible de charger cette semaine de planning.');
        setWeekAssignments(Object.fromEntries(weekDates.map((date) => [date, emptyAssignments(date, category)])));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [weekDates, category]);

  const confirmSelectionChange = () => !dirtyDates.length || window.confirm('Des modifications ne sont pas enregistrées. Voulez-vous les abandonner ?');

  const selectCategory = (nextCategory: string) => {
    if (nextCategory !== category && confirmSelectionChange()) setCategory(nextCategory);
  };

  const selectDate = (nextDate: string) => {
    if (nextDate !== selectedDate && confirmSelectionChange()) setSelectedDate(nextDate);
  };

  const shiftWeek = (amount: number) => {
    if (!confirmSelectionChange()) return;
    const monday = new Date(`${weekDates[0]}T12:00:00`);
    monday.setDate(monday.getDate() + amount * 7);
    setSelectedDate(localDate(monday));
  };

  const updateAssignment = (date: string, slot: number, patch: Partial<PlanningAssignment>) => {
    setWeekAssignments((current) => ({
      ...current,
      [date]: (current[date] || emptyAssignments(date, category)).map((item) => item.slot === slot ? { ...item, ...patch } : item),
    }));
    setDirtyDates((current) => current.includes(date) ? current : [...current, date]);
  };

  const updateEmployee = (date: string, slot: number, employeeName: string) => {
    const match = employees.find((employee) => fullName(employee).toLocaleLowerCase('fr') === employeeName.trim().toLocaleLowerCase('fr'));
    updateAssignment(date, slot, { employeeName, employeeId: match?.id ?? null });
  };

  const addAssignment = () => {
    const nextSlot = Math.max(0, ...slots) + 1;
    setWeekAssignments((current) => Object.fromEntries(weekDates.map((date) => [
      date,
      [...(current[date] || emptyAssignments(date, category)), { slot: nextSlot, employeeId: null, employeeName: '', schedule: scheduleForDate(date, category, nextSlot) }],
    ])));
    setDirtyDates((current) => [...new Set([...current, ...weekDates])]);
  };

  const removeAssignment = (slot: number) => {
    setWeekAssignments((current) => Object.fromEntries(weekDates.map((date) => [
      date,
      (current[date] || emptyAssignments(date, category)).filter((item) => item.slot !== slot),
    ])));
    setDirtyDates((current) => [...new Set([...current, ...weekDates])]);
  };

  const save = async () => {
    const datesToSave = [...dirtyDates];
    if (!datesToSave.length) return;
    setSaving(true);
    setError('');
    const results = await Promise.allSettled(datesToSave.map((date) => planningService.saveDaily({
      date,
      category,
      assignments: (weekAssignments[date] || []).filter((item) => item.employeeName.trim()).map((item) => ({ ...item, employeeName: item.employeeName.trim(), schedule: item.schedule.trim() })),
    })));
    const savedDays: Array<[string, PlanningAssignment[]]> = [];
    const failedDates: string[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') savedDays.push([datesToSave[index], normalizeAssignments(result.value.assignments, datesToSave[index], category)]);
      else failedDates.push(datesToSave[index]);
    });
    if (savedDays.length) setWeekAssignments((current) => ({ ...current, ...Object.fromEntries(savedDays) }));
    setDirtyDates(failedDates);
    if (failedDates.length) {
      const message = `Enregistrement impossible pour ${failedDates.map(displayDate).join(', ')}.`;
      setError(message);
      showToast(message, 'error');
    } else {
      showToast(`Planning ${category} enregistré pour la semaine.`, 'success');
    }
    setSaving(false);
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      await exportWeeklyPlanningPdf({ category, prefix: activeCategory.prefix, weekDates, assignmentsByDate: weekAssignments });
      showToast(`PDF ${category} téléchargé.`, 'success');
    } catch {
      showToast('La génération du PDF a échoué.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const exportJpg = async () => {
    setExporting(true);
    try {
      await exportWeeklyPlanningJpg({ category, prefix: activeCategory.prefix, weekDates, assignmentsByDate: weekAssignments });
      showToast(`Image JPG HD ${category} téléchargée.`, 'success');
    } catch {
      showToast('La génération de l’image JPG a échoué.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const weekLabel = `${displayDate(weekDates[0])} – ${displayDate(weekDates[weekDates.length - 1])}`;
  const dirty = dirtyDates.length > 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-accent"><CalendarDays size={16} /> Organisation des équipes</div>
          <h1 className="text-2xl font-bold text-primary sm:text-3xl">Planning</h1>
          <p className="mt-1 text-sm text-secondary">Organisez les équipes du lundi au dimanche, jour par jour.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-base bg-surface px-4 py-3 text-sm text-secondary">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-4 text-accent"><CalendarDays size={17} /></span>
          <span><strong className="block text-primary">{assignedCount} affectation{assignedCount > 1 ? 's' : ''}</strong><span className="text-xs">sur la semaine sélectionnée</span></span>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-base bg-surface p-3">
          <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">Catégories</p>
          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {categories.map((item) => {
              const Icon = item.icon;
              const selected = category === item.name;
              return <button key={item.name} type="button" onClick={() => selectCategory(item.name)} disabled={saving} aria-current={selected ? 'page' : undefined} style={selected ? { borderColor: `${item.color}66`, backgroundColor: `${item.color}10`, boxShadow: `0 0 16px ${item.color}18` } : undefined} className={`flex min-h-[66px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${selected ? '' : 'border-transparent bg-surface-2 hover:border-base hover:bg-surface'}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color: item.color, backgroundColor: selected ? `${item.color}24` : 'var(--color-surface)', boxShadow: selected ? `0 0 12px ${item.color}44` : 'none' }}><Icon size={18} /></span>
                <span className="min-w-0"><strong className={`block truncate text-sm ${selected ? 'text-primary' : 'text-secondary'}`}>{item.name}</strong><span className="hidden text-xs text-muted sm:block">{item.description}</span></span>
              </button>;
            })}
          </nav>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-base bg-surface p-4 sm:p-5 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ color: activeCategory.color, backgroundColor: `${activeCategory.color}18`, boxShadow: `0 0 14px ${activeCategory.color}33` }}><CategoryIcon size={23} /></span>
              <div><h2 className="text-xl font-semibold text-primary">{category} <span className="font-normal text-secondary">– Personnel</span></h2><p className="mt-1 text-sm capitalize text-muted">{weekLabel}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => shiftWeek(-1)} disabled={saving} aria-label="Semaine précédente" className="flex h-10 w-10 items-center justify-center rounded-lg border border-base bg-surface-2 text-secondary hover:text-primary disabled:opacity-50"><ChevronLeft size={18} /></button>
              <label className="relative flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-base bg-surface-2 px-3 text-secondary sm:flex-none">
                <CalendarDays size={16} className="shrink-0" />
                <input aria-label="Date de la semaine" type="date" value={selectedDate} onChange={(event) => event.target.value && selectDate(event.target.value)} disabled={saving} className="w-full min-w-0 bg-transparent text-sm text-primary outline-none sm:w-[135px]" />
              </label>
              <button type="button" onClick={() => shiftWeek(1)} disabled={saving} aria-label="Semaine suivante" className="flex h-10 w-10 items-center justify-center rounded-lg border border-base bg-surface-2 text-secondary hover:text-primary disabled:opacity-50"><ChevronRight size={18} /></button>
              <button type="button" onClick={() => selectDate(today())} disabled={saving} className="h-10 rounded-lg border border-base px-3 text-sm font-medium text-secondary hover:bg-surface-2 hover:text-primary disabled:opacity-50">Cette semaine</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-base bg-surface">
            <div className="flex flex-col justify-between gap-3 border-b border-base px-4 py-4 sm:px-5 md:flex-row md:items-center">
              <div><h3 className="font-semibold text-primary">Personnel prévu</h3><p className="mt-1 text-xs text-muted">Lundi à dimanche · chaque journée est enregistrée séparément.</p></div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>button]:justify-center">
                <button type="button" onClick={addAssignment} disabled={loading || saving || exporting} className="flex h-10 items-center gap-2 rounded-lg border border-base px-3 text-sm font-medium text-secondary hover:bg-surface-2 hover:text-primary disabled:opacity-50"><Plus size={16} /> Ajouter une ligne</button>
                <button type="button" onClick={exportPdf} disabled={loading || saving || exporting} className="flex h-10 items-center gap-2 rounded-lg border border-accent/40 bg-accent-4 px-3 text-sm font-medium text-accent hover:bg-accent/15 disabled:opacity-50"><Download size={16} />{exporting ? 'Création…' : 'Exporter PDF'}</button>
                <button type="button" onClick={exportJpg} disabled={loading || saving || exporting} className="flex h-10 items-center gap-2 rounded-lg border border-accent/40 bg-accent-4 px-3 text-sm font-medium text-accent hover:bg-accent/15 disabled:opacity-50"><Download size={16} />{exporting ? 'Création…' : 'Exporter JPG HD'}</button>
                <button type="button" onClick={save} disabled={loading || saving || exporting || !dirty} className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"><Save size={16} />{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </div>

            {error && <div role="alert" className="mx-5 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
            {loading ? <div className="px-5 py-12 text-center text-sm text-muted">Chargement du planning…</div> : <>
              <datalist id="planning-employees">{employees.map((employee) => <option key={employee.id} value={fullName(employee)} />)}</datalist>
              {/* Grand écran : tableau de la semaine */}
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full min-w-[1352px] table-fixed text-left">
                  <thead>
                    <tr className="bg-surface-2/60 text-[11px] uppercase tracking-wide text-muted">
                      <th className="w-16 px-3 py-3 font-medium">Poste</th>
                      {weekDates.map((date, index) => <th key={date} className="px-2 py-3 font-medium"><span className="block text-primary">{dayNames[index]}</span><span className="mt-0.5 block font-normal normal-case">{new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => <tr key={slot} className="border-t border-base/70">
                      <th scope="row" className="px-3 py-3 text-left align-top"><span className="flex h-9 w-10 items-center justify-center rounded-lg text-sm font-semibold" style={{ color: activeCategory.color, backgroundColor: `${activeCategory.color}18` }}>{activeCategory.prefix}{slot}</span></th>
                      {weekDates.map((date) => {
                        const editingKey = `${date}-${slot}`;
                        return <td key={editingKey} className="min-w-0 px-2 py-3 align-top">
                          <AssignmentCell assignment={getAssignment(date, slot)} label={displayDate(date)} prefix={`${activeCategory.prefix}${slot}`} isEditing={editingAssignment === editingKey} saving={saving}
                            onEdit={() => setEditingAssignment(editingKey)} onStopEdit={() => setEditingAssignment((current) => current === editingKey ? null : current)}
                            onEmployeeChange={(name) => updateEmployee(date, slot, name)} onScheduleChange={(schedule) => updateAssignment(date, slot, { schedule })} />
                        </td>;
                      })}
                    </tr>)}
                  </tbody>
                </table>
              </div>

              {/* Mobile / tablette : un jour à la fois */}
              <div className="xl:hidden">
                <div className="flex gap-2 overflow-x-auto border-b border-base px-4 py-3">
                  {weekDates.map((date, index) => {
                    const active = index === mobileDayIndex;
                    const count = (weekAssignments[date] || []).filter((item) => item.employeeName.trim()).length;
                    return <button key={date} type="button" onClick={() => setMobileDayIndex(index)} className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-1.5 text-xs transition-colors ${active ? 'border-accent bg-accent-4 text-accent' : 'border-base bg-surface-2 text-secondary'}`}>
                      <span className="font-semibold">{dayNames[index].slice(0, 3)}</span>
                      <span>{new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                      {count > 0 && <span className="mt-0.5 text-[10px] text-muted">{count} pers.</span>}
                    </button>;
                  })}
                </div>
                <p className="px-4 pt-3 text-sm font-semibold capitalize text-primary">{displayDate(mobileDate)}</p>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {slots.map((slot) => {
                    const editingKey = `${mobileDate}-${slot}`;
                    return <div key={slot} className="flex items-start gap-3 rounded-xl border border-base bg-surface-2/40 p-3">
                      <span className="flex h-9 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold" style={{ color: activeCategory.color, backgroundColor: `${activeCategory.color}18` }}>{activeCategory.prefix}{slot}</span>
                      <div className="min-w-0 flex-1">
                        <AssignmentCell assignment={getAssignment(mobileDate, slot)} label={displayDate(mobileDate)} prefix={`${activeCategory.prefix}${slot}`} isEditing={editingAssignment === editingKey} saving={saving}
                          onEdit={() => setEditingAssignment(editingKey)} onStopEdit={() => setEditingAssignment((current) => current === editingKey ? null : current)}
                          onEmployeeChange={(name) => updateEmployee(mobileDate, slot, name)} onScheduleChange={(schedule) => updateAssignment(mobileDate, slot, { schedule })} />
                      </div>
                    </div>;
                  })}
                </div>
              </div>
              <div className="flex flex-col justify-between gap-2 border-t border-base px-5 py-3 text-xs text-muted sm:flex-row sm:items-center"><span>{assignedCount} affectation{assignedCount > 1 ? 's' : ''} sur la période affichée</span><span>{dirty ? 'Modifications non enregistrées' : 'Planning synchronisé'}</span></div>
            </>}
          </div>
        </section>
      </div>
    </div>
  );
}
