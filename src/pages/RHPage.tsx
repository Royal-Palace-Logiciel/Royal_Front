import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarDays, Camera, Check, ChevronRight, Clock3, Download, Eye, FileText, Paperclip, Pencil, Plus, Save, ScanFace, Search, ShieldCheck, Trash2, UserPlus, UsersRound, WalletCards, X } from 'lucide-react';
import { FaceEnrollModal, FaceKioskModal } from '../components/RH/FaceAttendance';
import { apiMessage } from '../lib/api';
import { useToast } from '../context/ToastContext';
import AuthService from '../services/authService';
import rhService, { RHAttendance, RHDashboard, RHDepartmentBudget, RHDocument, RHDocumentType, RHEmployee, RHEmployeeMeta, RHEvaluation, RHLeave, RHPayroll } from '../services/rh.service';

type RHView = 'overview' | 'employees' | 'attendance' | 'payroll' | 'evaluations';
type Toast = (message: string, type: 'success' | 'error') => void;
const departments = ['Administration', 'Réception', 'Restauration', 'Casino', 'Maintenance', 'Hébergement', 'Sécurité'];
const contractTypes = ['CDI', 'CDD', 'Prestataire', 'Stagiaire'];
// Contrats soumis aux cotisations CNAPS / OSTIE / IRSA.
const salariedContracts = ['CDI', 'CDD'];
// Le prestataire est payé au jour de présence : son salaire est un taux journalier.
const DAILY_RATE_CONTRACT = 'Prestataire';
// Statuts de fin de contrat : une raison est obligatoire.
const departureStatuses = ['SORTI', 'RETRAITE', 'RENVOYE', 'DEMISSIONNE'];
const statusLabels: Record<string, string> = { ACTIF: 'Actif', EN_CONGE: 'En congé', SUSPENDU: 'Suspendu', SORTI: 'Sorti', RETRAITE: 'Retraité', RENVOYE: 'Renvoyé', DEMISSIONNE: 'Démissionné' };
// Statuts proposés dans le filtre et les compteurs de la page Employés.
const filterStatuses = ['ACTIF', 'SUSPENDU', 'EN_CONGE', 'RETRAITE', 'RENVOYE', 'DEMISSIONNE'];
const documentTypes: Array<[RHDocumentType, string]> = [['CIN', 'CIN'], ['RESIDENCE', 'Justificatif de résidence'], ['CV', 'CV'], ['CONTRAT', 'Contrat de travail']];
const documentLabel = (type: string) => documentTypes.find(([id]) => id === type)?.[1] || type;
// Date du jour selon l'horloge de l'ordinateur (et non en UTC comme toISOString, qui
// donnerait encore la veille entre minuit et 3 h à Madagascar).
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const emptyEmployee = { first_name: '', last_name: '', department: 'Administration', position: '', contract_type: 'CDI', status: 'ACTIF', joined_at: localDate(), salary: '', prime: '', pourboire: '', irsa: '', phone: '', address: '', email: '', birth_date: '', identification_number: '', contract_end_date: '', departure_reason: '', qualification: '', cnaps_number: '', dependents: '0' };
const formatMoney = (value: number) => `${new Intl.NumberFormat('fr-FR').format(Number(value || 0))} Ar`;
// Nombre de semaines d'un mois = nombre de lundis (même règle que le serveur, utils/hr.js).
const weeksInMonth = (period: string) => { const [y, m] = period.slice(0, 7).split('-').map(Number); let weeks = 0; for (let d = 1; d <= new Date(Date.UTC(y, m, 0)).getUTCDate(); d += 1) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1) weeks += 1; return weeks; };
const onePercent = (salary: string | number) => Math.round(Number(salary || 0) * 0.01 * 100) / 100;
const labelStatus = (status: string) => statusLabels[status] || status;
const colour = (status: string) => departureStatuses.includes(status) ? '#b64f4d' : status === 'SUSPENDU' ? '#9c6b2e' : status === 'EN_CONGE' ? '#a76625' : '#28796e';
// La page défile dans le <main> de MainLayout, pas dans le body : on le bloque tant
// qu'une fenêtre est ouverte, sinon la molette fait défiler la page derrière la fenêtre.
const useLockPageScroll = (locked: boolean) => {
  useEffect(() => {
    const main = document.querySelector('main');
    if (!locked || !main) return;
    const previous = main.style.overflowY;
    main.style.overflowY = 'hidden';
    return () => { main.style.overflowY = previous; };
  }, [locked]);
};
const monthStart = () => `${localDate().slice(0, 7)}-01`;
const monthEnd = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)).toISOString().slice(0, 10); };
const initials = (e: { first_name: string; last_name: string }) => `${e.first_name[0] || ''}${e.last_name[0] || ''}`.toUpperCase();

export const RHPage: React.FC = () => {
  const role = AuthService.getCurrentUser()?.role;
  // 'manager' désactivé ici pour l'instant : le backend (requireHR dans rhRoutes.js)
  // ne reconnaît que admin / rh_manager / rh ou un module 'rh' explicite, donc la vue
  // de gestion complète ci-dessous tombe en erreur pour un manager (paie, effectifs...).
  // En attendant, le manager voit l'espace self-service (fiche + congés + pointage),
  // comme les autres rôles non-admin.
  const isRHManager = role === 'admin'; // || role === 'manager'
  if (!isRHManager) return <MyRHSpace />;
  return <RHManagerView />;
};

// ─────────────────────────────────────────────
// Vue self-service : tout utilisateur non admin/manager (barman, réceptionniste,
// croupier, etc.). Toujours sur la route /rh, toujours dans cette page — pas
// d'onglet séparé. Lecture seule sur sa fiche + demande de congé uniquement.
// ─────────────────────────────────────────────
const MyRHSpace: React.FC = () => {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<RHEmployee | null>(null);
  const [leaves, setLeaves] = useState<RHLeave[]>([]);
  const [attendance, setAttendance] = useState<RHAttendance[]>([]);
  const [error, setError] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [leaveForm, setLeaveForm] = useState(false);

  const load = async () => {
    setError(''); setNotLinked(false);
    try {
      const [p, l, a] = await Promise.all([rhService.getMyProfile(), rhService.listMyLeaveRequests({ limit: 50 }), rhService.listMyAttendance({ limit: 31 })]);
      setProfile(p); setLeaves(l.rows); setAttendance(a.rows);
    } catch (e: any) {
      if (e?.response?.status === 404) setNotLinked(true);
      else setError('Vos données RH ne peuvent pas être chargées. Vérifiez votre connexion.');
    }
  };
  useEffect(() => { load(); }, []);

  if (notLinked) {
    return <div className="min-h-[calc(100vh-120px)] space-y-4 pb-8">
      <header><div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#2b7a78]"><ShieldCheck size={16} /> Ressources humaines</div><h1 className="text-3xl font-bold text-primary">Mon dossier</h1></header>
      <div className="rounded-xl border border-base bg-surface p-5 text-sm text-secondary">Aucune fiche RH n'est encore liée à votre compte. Contactez un administrateur pour la mise en place.</div>
    </div>;
  }

  return <div className="min-h-[calc(100vh-120px)] space-y-6 pb-8">
    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div><div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#2b7a78]"><ShieldCheck size={16} /> Ressources humaines</div><h1 className="text-3xl font-bold text-primary">Mon dossier</h1><p className="mt-1 text-sm text-secondary">Vos informations personnelles et vos demandes de congé.</p></div>
      <button onClick={() => setLeaveForm(true)} className="flex h-10 items-center gap-2 rounded-xl bg-[#2b7a78] px-4 text-sm font-semibold text-white"><Plus size={16} /> Demander un congé</button>
    </header>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {profile && <section className="rounded-2xl border border-base bg-surface p-5">
      <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2b7a78] text-sm font-semibold text-white">{initials(profile)}</span><div><h2 className="font-semibold text-primary">{profile.first_name} {profile.last_name}</h2><p className="text-sm text-secondary">{profile.matricule} · {profile.position}</p></div></div>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <p>Département <strong className="float-right">{profile.department}</strong></p>
        <p>Contrat <strong className="float-right">{profile.contract_type}</strong></p>
        <p>Date d'entrée <strong className="float-right">{profile.joined_at}</strong></p>
        <p>Statut <strong className="float-right" style={{ color: colour(profile.status) }}>{labelStatus(profile.status)}</strong></p>
      </div>
    </section>}
    <section className="rounded-2xl border border-base bg-surface p-5">
      <h2 className="font-semibold text-primary">Mes demandes de congé</h2>
      <div className="mt-4 space-y-3">
        {leaves.map((l) => <div key={l.id} className="rounded-xl border border-base p-3"><p className="text-sm">{l.leave_type} · {l.start_date} au {l.end_date} · {l.days} jour(s)</p><p className="text-xs">Statut : {l.status}{l.annual_remaining !== undefined ? ` · Solde annuel : ${l.annual_remaining}` : ''}</p>{l.reason && <p className="text-xs text-secondary">{l.reason}</p>}</div>)}
        {!leaves.length && <p className="text-sm text-secondary">Aucune demande de congé.</p>}
      </div>
    </section>
    <section className="rounded-2xl border border-base bg-surface p-5">
      <h2 className="font-semibold text-primary">Ma présence</h2>
      <p className="mt-1 text-xs text-secondary">Les pointages sont enregistrés par l’administration (reconnaissance faciale à l’entrée).</p>
      <div className="mt-4 space-y-2">
        {attendance.map((a) => <div key={a.id} className="rounded-xl border border-base p-3"><p className="text-sm">{a.attendance_date}</p><p className="text-xs text-secondary">Entrée : {a.check_in || '--:--'} · Sortie : {a.check_out || '--:--'} · Statut : {a.status || a.attendance_status}</p></div>)}
        {!attendance.length && <p className="text-sm text-secondary">Aucun pointage enregistré.</p>}
      </div>
    </section>
    {leaveForm && <MyLeaveModal close={() => setLeaveForm(false)} done={load} toast={showToast} />}
  </div>;
};

const MyLeaveModal = ({ close, done, toast }: { close: () => void; done: () => void; toast: (message: string, type: 'success' | 'error') => void }) => {
  const [f, setF] = useState({ leave_type: 'ANNUEL', start_date: '', end_date: '', reason: '' });
  return <div className="fixed inset-0 z-[60] bg-black/30 p-4"><form onSubmit={async (e) => { e.preventDefault(); try { await rhService.createMyLeaveRequest(f); toast('Demande envoyée.', 'success'); close(); done(); } catch (err: any) { toast(apiMessage(err) || 'Envoi impossible.', 'error'); } }} className="mx-auto mt-20 max-w-md rounded-2xl bg-surface p-6">
    <h2 className="font-bold">Demander un congé</h2>
    <div className="mt-4 space-y-3">
      <select value={f.leave_type} onChange={(e) => setF({ ...f, leave_type: e.target.value })} className="w-full rounded border p-2"><option value="ANNUEL">Annuel</option><option value="MALADIE">Maladie</option><option value="MATERNITE_PATERNITE">Maternité/paternité</option><option value="SANS_SOLDE">Sans solde</option></select>
      <input required type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className="w-full rounded border p-2" />
      <input required type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} className="w-full rounded border p-2" />
      <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Motif" className="w-full rounded border p-2" />
    </div>
    <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={close}>Annuler</button><button className="rounded bg-[#2b7a78] px-3 py-2 text-white">Envoyer</button></div>
  </form></div>;
};

// ─────────────────────────────────────────────
// Vue de gestion complète : admin / manager, inchangée.
// ─────────────────────────────────────────────
const RHManagerView: React.FC = () => {
  const { showToast } = useToast();
  const [view, setView] = useState<RHView>('overview'); const [employees, setEmployees] = useState<RHEmployee[]>([]); const [dashboard, setDashboard] = useState<RHDashboard | null>(null); const [attendance, setAttendance] = useState<RHAttendance[]>([]); const [leaves, setLeaves] = useState<RHLeave[]>([]); const [payroll, setPayroll] = useState<RHPayroll[]>([]); const [evaluations, setEvaluations] = useState<RHEvaluation[]>([]);
  const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [period, setPeriod] = useState(localDate().slice(0, 7)); const [attendanceDate, setAttendanceDate] = useState(localDate()); const [leaveForm, setLeaveForm] = useState(false);
  // Formulaire employé : null = fermé, { employee: null } = création, { employee } = modification.
  const [employeeModal, setEmployeeModal] = useState<{ employee: RHEmployee | null } | null>(null);
  const [viewedEmployee, setViewedEmployee] = useState<RHEmployee | null>(null);
  const [statusFilter, setStatusFilter] = useState(''); const [contractFilter, setContractFilter] = useState('');
  const [employeeMeta, setEmployeeMeta] = useState<RHEmployeeMeta | null>(null);
  const [evalFrom, setEvalFrom] = useState(monthStart()); const [evalTo, setEvalTo] = useState(monthEnd());
  const [budgets, setBudgets] = useState<RHDepartmentBudget[]>([]); const [budgetMonths, setBudgetMonths] = useState(1);
  const [kioskOpen, setKioskOpen] = useState(false); const [faceEnrollFor, setFaceEnrollFor] = useState<RHEmployee | null>(null);
  const [payrollSearch, setPayrollSearch] = useState('');
  const [selectedPayroll, setSelectedPayroll] = useState<RHPayroll | null>(null);
  const [payrollAdjustment, setPayrollAdjustment] = useState<RHPayroll | null>(null);
  const [payrollToDelete, setPayrollToDelete] = useState<RHPayroll | null>(null); const [deletingPayroll, setDeletingPayroll] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<RHEmployee | null>(null); const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState<Record<string, string>>({
    overtime_amount: '',
    bonuses: '',
    pourboire: '',
    allowances: '',
    advances: '',
    deduction_amount: '',
    deduction_frequency: 'MENSUEL',
    deduction_reason: '',
  });
  const employeeParams = () => ({ limit: 100, search, status: statusFilter || undefined, contract_type: contractFilter || undefined });
  const applyEmployees = (es: { rows: RHEmployee[]; meta?: unknown }) => { setEmployees(es.rows); setEmployeeMeta((es.meta as RHEmployeeMeta) || null); };
  // Garde la ligne de paie sélectionnée alignée sur les données rechargées.
  const applyPayroll = (rows: RHPayroll[]) => { setPayroll(rows); setSelectedPayroll((current) => current ? rows.find((row) => row.id === current.id) || null : null); };
  const load = async () => {
    setError('');
    try { const [es, d, l, a, p, ev] = await Promise.all([rhService.listEmployees(employeeParams()), rhService.getDashboard(), rhService.listLeaveRequests({ limit: 100 }), rhService.listAttendance({ date: attendanceDate, limit: 100 }), rhService.listPayroll({ period, limit: 100 }), rhService.listEvaluations({ limit: 100, from: evalFrom || undefined, to: evalTo || undefined })]); applyEmployees(es); setDashboard(d); setLeaves(l.rows); setAttendance(a.rows); applyPayroll(p.rows); setEvaluations(ev.rows); } catch { setError('Les données RH ne peuvent pas être chargées. Vérifiez votre accès et la connexion au serveur.'); }
  };
  const loadEmployees = () => rhService.listEmployees(employeeParams()).then(applyEmployees).catch(() => setError('Impossible de charger les employés.'));
  const loadEvaluationData = () => {
    if (!evalFrom || !evalTo || evalTo < evalFrom) return;
    rhService.listEvaluations({ limit: 100, from: evalFrom, to: evalTo }).then((r) => setEvaluations(r.rows)).catch(() => setError('Impossible de charger les évaluations.'));
    rhService.listBudgets({ from: evalFrom, to: evalTo }).then((r) => { setBudgets(r.rows); setBudgetMonths(r.months); }).catch(() => setError('Impossible de charger les budgets salariaux.'));
  };
  const refreshAttendance = () => rhService.listAttendance({ date: attendanceDate, limit: 100 }).then((r) => setAttendance(r.rows)).catch(() => setError('Impossible de charger les présences.'));
  useEffect(() => { load(); }, []); // Sensitive data is never cached in localStorage.
  useEffect(() => { rhService.listAttendance({ date: attendanceDate, limit: 100 }).then((r) => setAttendance(r.rows)).catch(() => setError('Impossible de charger les présences.')); }, [attendanceDate]);
  useEffect(() => { rhService.listPayroll({ period, limit: 100 }).then((r) => applyPayroll(r.rows)).catch(() => setError('Impossible de charger la paie.')); }, [period]);
  useEffect(() => { loadEmployees(); }, [statusFilter, contractFilter]);
  useEffect(() => { loadEvaluationData(); }, [evalFrom, evalTo]);
  useLockPageScroll(!!(payrollAdjustment || payrollToDelete || employeeModal || viewedEmployee || leaveForm || kioskOpen || faceEnrollFor));
  useEffect(() => { if (!payrollToDelete) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deletingPayroll) setPayrollToDelete(null); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [payrollToDelete, deletingPayroll]);
  const pendingLeaves = leaves.filter((l) => l.status === 'EN_ATTENTE'); const totals = useMemo(() => payroll.reduce((a, p) => ({ base: a.base + Number(p.base_salary), extras: a.extras + Number(p.overtime_amount) + Number(p.bonuses) + Number(p.pourboire || 0) + Number(p.allowances), deductions: a.deductions + Number(p.advances) + Number(p.deductions), contributions: a.contributions + Number(p.cnaps || 0) + Number(p.ostie || 0) + Number(p.irsa || 0), net: a.net + Number(p.net_amount) }), { base: 0, extras: 0, deductions: 0, contributions: 0, net: 0 }), [payroll]);
  const refreshAfterAction = () => load();
  const saveBudget = async (department: string, value: string) => { const amount = Number(value); if (value === '' || !Number.isFinite(amount) || amount < 0) { showToast('Saisissez un budget valide.', 'error'); return; } try { await rhService.updateBudget(department, amount); showToast(`Budget ${department} enregistré.`, 'success'); loadEvaluationData(); } catch (e: any) { showToast(apiMessage(e) || 'Enregistrement du budget impossible.', 'error'); } };
  const handleLeave = async (id: number, status: 'APPROUVE' | 'REFUSE') => { try { await rhService.updateLeaveStatus(id, status); showToast(status === 'APPROUVE' ? 'Congé approuvé.' : 'Congé refusé.', 'success'); refreshAfterAction(); } catch (e: any) { showToast(apiMessage(e) || 'Mise à jour impossible.', 'error'); } };
  const generate = async () => { try { const r = await rhService.generatePayroll(period); applyPayroll(r.rows); showToast('Paie préparée : les absences et congés sans solde ont été calculés.', 'success'); } catch (e: any) { showToast(apiMessage(e) || 'Préparation impossible.', 'error'); } };
  const point = async (employeeId: number, action: 'in' | 'out') => { try { action === 'in' ? await rhService.checkIn(employeeId) : await rhService.checkOut(employeeId); showToast(action === 'in' ? 'Arrivée enregistrée.' : 'Départ enregistré.', 'success'); const r = await rhService.listAttendance({ date: attendanceDate, limit: 100 }); setAttendance(r.rows); } catch (e: any) { showToast(apiMessage(e) || 'Pointage impossible.', 'error'); } };
  const validatePayroll = async (line: RHPayroll) => { try { await rhService.updatePayrollStatus(line.id, 'VALIDE'); showToast('Paie validée.', 'success'); refreshAfterAction(); } catch (e: any) { showToast(apiMessage(e) || 'Action impossible.', 'error'); } };
  const openPayrollAdjustment = (line: RHPayroll) => {
    setSelectedPayroll(line);
    setPayrollAdjustment(line);
    setAdjustmentForm({
      overtime_amount: String(line.overtime_amount ?? 0),
      bonuses: String(line.bonuses ?? 0),
      pourboire: String(line.pourboire ?? 0),
      allowances: String(line.allowances ?? 0),
      advances: String(line.advances ?? 0),
      deduction_amount: String(Number(line.deduction_amount ?? 0)),
      deduction_frequency: line.deduction_frequency || 'MENSUEL',
      deduction_reason: line.deduction_reason || '',
    });
  };
  const savePayrollAdjustment = async () => {
    if (!payrollAdjustment) return;
    const fields = ['overtime_amount', 'bonuses', 'pourboire', 'allowances', 'advances', 'deduction_amount'] as const;
    const payload: Record<string, unknown> = { deduction_frequency: adjustmentForm.deduction_frequency, deduction_reason: adjustmentForm.deduction_reason.trim() };
    for (const field of fields) {
      const value = adjustmentForm[field];
      if (value === '' || !/^\d+(\.\d{1,2})?$/.test(value)) {
        showToast('Saisissez un montant valide pour chaque champ.', 'error');
        return;
      }
      payload[field] = Number(value);
    }
    if (Number(adjustmentForm.deduction_amount) > 0 && !adjustmentForm.deduction_reason.trim()) {
      showToast('Indiquez le motif de la retenue.', 'error');
      return;
    }
    try {
      await rhService.updatePayroll(payrollAdjustment.id, payload);
      showToast('Ajustement enregistré avec succès.', 'success');
      setPayrollAdjustment(null);
      refreshAfterAction();
    } catch (e: any) {
      showToast(apiMessage(e) || 'Mise à jour impossible.', 'error');
    }
  };
  const confirmRemovePayroll = async () => { const line = payrollToDelete; if (!line || deletingPayroll) return; setDeletingPayroll(true); try { await rhService.deletePayroll(line.id); setPayroll((rows) => rows.filter((row) => row.id !== line.id)); if (selectedPayroll?.id === line.id) setSelectedPayroll(null); setPayrollToDelete(null); showToast('Ligne de paie supprimée.', 'success'); refreshAfterAction(); } catch (e: any) { showToast(apiMessage(e) || 'Suppression impossible.', 'error'); } finally { setDeletingPayroll(false); } };
  const confirmRemoveEmployee = async () => { const employee = employeeToDelete; if (!employee || deletingEmployee) return; setDeletingEmployee(true); try { await rhService.deleteEmployee(employee.id); setEmployees((rows) => rows.filter((row) => row.id !== employee.id)); if (viewedEmployee?.id === employee.id) setViewedEmployee(null); setEmployeeToDelete(null); showToast('Employé supprimé.', 'success'); refreshAfterAction(); } catch (e: any) { showToast(apiMessage(e) || 'Suppression impossible.', 'error'); } finally { setDeletingEmployee(false); } };
  const downloadPayslip = async (line: RHPayroll) => { try { const response = await rhService.downloadPayslip(period, line.employee_id); const url = URL.createObjectURL(response.data); const a = document.createElement('a'); a.href = url; a.download = `bulletin-${line.matricule}-${period}.pdf`; a.click(); URL.revokeObjectURL(url); } catch { showToast('Téléchargement du bulletin impossible.', 'error'); } };
  // Net recalculé en direct dans « Ajuster la paie », avec la même formule que le serveur.
  const adjustmentNet = (() => {
    if (!payrollAdjustment) return 0;
    const n = (key: string) => Number(adjustmentForm[key] || 0);
    const weeks = adjustmentForm.deduction_frequency === 'HEBDOMADAIRE' ? weeksInMonth(payrollAdjustment.period_month || `${period}-01`) : 1;
    const gains = Number(payrollAdjustment.base_salary || 0) + n('overtime_amount') + n('bonuses') + n('pourboire') + n('allowances');
    const withheld = n('advances') + n('deduction_amount') * weeks + Number(payrollAdjustment.absence_deductions || 0) + Number(payrollAdjustment.cnaps || 0) + Number(payrollAdjustment.ostie || 0) + Number(payrollAdjustment.irsa || 0);
    return Math.round((gains - withheld) * 100) / 100;
  })();
  const nav: Array<[RHView, string, React.ReactNode]> = [['overview', 'Vue d’ensemble', <BarChart3 size={17} />], ['employees', 'Employés', <UsersRound size={17} />], ['attendance', 'Présences & congés', <CalendarDays size={17} />], ['payroll', 'Paie', <WalletCards size={17} />], ['evaluations', 'Évaluations', <FileText size={17} />]];
  return <div className="min-h-[calc(100vh-120px)] space-y-6 pb-8"><header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#2b7a78]"><ShieldCheck size={16} /> Administration du personnel</div><h1 className="text-3xl font-bold text-primary">Ressources humaines</h1><p className="mt-1 text-sm text-secondary">Données RH sécurisées et actions traçables.</p></div><button onClick={() => setEmployeeModal({ employee: null })} className="flex h-10 items-center gap-2 rounded-xl bg-[#2b7a78] px-4 text-sm font-semibold text-white"><UserPlus size={16} /> Nouvel employé</button></header>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="flex gap-1 overflow-x-auto border-b border-base">{nav.map(([id, label, icon]) => <button key={id} onClick={() => setView(id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm ${view === id ? 'border-[#2b7a78] text-[#2b7a78]' : 'border-transparent text-secondary'}`}>{icon}{label}</button>)}</div>
    {view === 'overview' && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Effectif total', dashboard?.total || 0, `${dashboard?.active || 0} actifs`, <UsersRound size={20} />], ['Présences aujourd’hui', `${attendance.filter(a => ['PRESENT', 'RETARD'].includes(a.attendance_status || '')).length}/${attendance.length}`, `${dashboard?.absent || 0} absence(s)`, <Clock3 size={20} />], ['Congés en cours', dashboard?.onLeave || 0, `${dashboard?.pendingLeave || 0} à traiter`, <CalendarDays size={20} />], ['Masse salariale', formatMoney(dashboard?.payrollTotal || 0), 'Estimation mensuelle', <WalletCards size={20} />]].map(([label, value, detail, icon]) => <div key={String(label)} className="rounded-2xl border border-base bg-surface p-5 shadow-sm"><div className="flex justify-between"><div><p className="text-sm text-secondary">{label}</p><p className="mt-2 text-2xl font-bold text-primary">{value}</p></div><span className="text-[#2b7a78]">{icon as React.ReactNode}</span></div><p className="mt-4 text-xs text-secondary">{detail}</p></div>)}</div><div className="grid gap-5 xl:grid-cols-2"><section className="rounded-2xl border border-base bg-surface p-5"><h2 className="font-semibold text-primary">Effectif par département</h2><div className="mt-4 space-y-3">{(dashboard?.departments || []).map(d => <div key={d.department} className="flex justify-between text-sm"><span>{d.department}</span><strong>{d.total}</strong></div>)}</div></section><section className="rounded-2xl border border-base bg-surface p-5"><h2 className="font-semibold text-primary">À traiter</h2><div className="mt-3 space-y-2">{pendingLeaves.map(l => <button key={l.id} onClick={() => setView('attendance')} className="flex w-full items-center gap-3 rounded-xl bg-surface-2 p-3 text-left"><CalendarDays size={16} /><span className="flex-1"><strong className="block text-sm">Demande de congé</strong><small>{l.first_name} {l.last_name} · {l.days} jour(s)</small></span><ChevronRight size={16} /></button>)}{(dashboard?.expiringContracts || []).map(c => <button key={c.id} onClick={() => setView('employees')} className="flex w-full items-center gap-3 rounded-xl bg-surface-2 p-3 text-left"><AlertTriangle size={16} /><span className="flex-1"><strong className="block text-sm">Contrat à renouveler</strong><small>{c.first_name} {c.last_name} · {c.contract_end_date}</small></span><ChevronRight size={16} /></button>)}{!pendingLeaves.length && !(dashboard?.expiringContracts || []).length && <p className="text-sm text-secondary">Aucune action en attente.</p>}</div></section></div></>}
    {view === 'employees' && <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {filterStatuses.map((status) => <button key={status} type="button" onClick={() => setStatusFilter(statusFilter === status ? '' : status)} className={`rounded-2xl border bg-surface p-3 text-left transition ${statusFilter === status ? 'border-[#2b7a78] ring-1 ring-[#2b7a78]' : 'border-base'}`}><p className="text-xs text-secondary">{labelStatus(status)}</p><p className="mt-1 text-2xl font-bold" style={{ color: colour(status) }}>{employeeMeta?.statusCounts?.[status] || 0}</p></button>)}
        <button type="button" onClick={() => { setStatusFilter(''); setContractFilter(''); }} className="rounded-2xl border border-base bg-surface-2 p-3 text-left"><p className="text-xs text-secondary">Total général</p><p className="mt-1 text-2xl font-bold text-primary">{employeeMeta?.grandTotal || 0}</p></button>
      </div>
      <section className="rounded-2xl border border-base bg-surface">
        <div className="flex flex-col gap-3 border-b border-base p-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-semibold text-primary">Registre des employés <span className="text-sm font-normal text-secondary">({employeeMeta?.total ?? employees.length} résultat(s))</span></h2>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-base px-3"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadEmployees()} placeholder="Rechercher" className="h-9 bg-transparent outline-none" /></label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrer par statut" className="h-9 rounded-xl border border-base bg-surface px-2 text-sm"><option value="">Tous les statuts</option>{filterStatuses.map(s => <option key={s} value={s}>{labelStatus(s)}</option>)}</select>
            <select value={contractFilter} onChange={e => setContractFilter(e.target.value)} aria-label="Filtrer par type de contrat" className="h-9 rounded-xl border border-base bg-surface px-2 text-sm"><option value="">Tous les contrats</option>{contractTypes.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface-2 text-secondary"><tr><th className="p-3">Employé</th><th>Poste</th><th>Contrat</th><th>Statut</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{employees.map(e => <tr key={e.id} className="border-t border-base"><td className="p-3"><strong className="flex items-center gap-1">{e.first_name} {e.last_name}{Number(e.face_samples || 0) > 0 && <span title="Visage enregistré"><ScanFace size={14} className="text-[#2b7a78]" /></span>}</strong><small className="block text-secondary">{e.matricule}</small></td><td>{e.department} · {e.position}</td><td>{e.contract_type}</td><td><span style={{ color: colour(e.status) }}>{labelStatus(e.status)}</span></td><td className="p-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => setViewedEmployee(e)} className="flex items-center gap-1 rounded-lg border border-base px-2 py-1 text-xs"><Eye size={14}/> Voir</button><button type="button" onClick={() => setEmployeeModal({ employee: e })} title="Modifier le dossier" className="flex items-center gap-1 rounded-lg border border-base px-2 py-1 text-xs"><Pencil size={14}/> Modifier</button><button type="button" onClick={() => setEmployeeToDelete(e)} title="Supprimer l'employé" className="flex items-center gap-1 rounded-lg border border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"><Trash2 size={14}/> Supprimer</button></div></td></tr>)}{!employees.length && <tr><td colSpan={5} className="p-6 text-center text-secondary">Aucun employé ne correspond aux filtres.</td></tr>}</tbody></table></div>
      </section>
    </>}
    {view === 'attendance' && <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]"><section className="rounded-2xl border border-base bg-surface p-5"><div className="flex justify-between"><div><h2 className="font-semibold text-primary">Suivi des présences</h2><input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="mt-2 rounded border p-1" /></div><button type="button" onClick={() => setKioskOpen(true)} className="flex h-10 items-center gap-2 self-start rounded-xl bg-[#2b7a78] px-3 text-sm font-semibold text-white"><ScanFace size={17}/> Pointage par visage</button></div><div className="mt-4 space-y-2">{attendance.map(a => <div key={a.employee_id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3"><span className="rounded bg-[#2b7a78] p-2 text-xs text-white">{initials({ first_name: a.first_name || '', last_name: a.last_name || '' })}</span><span className="flex-1"><strong className="block text-sm">{a.first_name} {a.last_name}</strong><small>{a.department} · {a.attendance_status}</small></span><span className="text-right text-xs">{([['in', a.check_in, a.check_in_method, a.has_check_in_photo], ['out', a.check_out, a.check_out_method, a.has_check_out_photo]] as const).map(([kind, time, method, hasPhoto]) => <span key={kind} className="flex items-center justify-end gap-1">{method === 'VISAGE' && <span title="Pointé par reconnaissance faciale"><ScanFace size={12} className="text-[#2b7a78]" /></span>}{time || '--:--'}{hasPhoto && a.attendance_id ? <button type="button" onClick={() => openAttendancePhoto(a.attendance_id!, kind, showToast)} title="Voir la photo du pointage" className="text-[#2b7a78]"><Camera size={12} /></button> : null}</span>)}</span>{attendanceDate === localDate() && <span className="flex gap-1"><button onClick={() => point(a.employee_id, 'in')} className="rounded bg-[#2b7a78] px-2 py-1 text-xs text-white">Entrée</button><button onClick={() => point(a.employee_id, 'out')} className="rounded border px-2 py-1 text-xs">Sortie</button></span>}</div>)}</div></section><section className="rounded-2xl border border-base bg-surface p-5"><div className="flex justify-between"><div><h2 className="font-semibold text-primary">Demandes de congé</h2><p className="text-xs text-secondary">Solde annuel affiché après traitement</p></div><button onClick={() => setLeaveForm(true)} className="rounded bg-[#2b7a78] px-2 text-white"><Plus size={16}/></button></div><div className="mt-4 space-y-3">{leaves.map(l => <div key={l.id} className="rounded-xl border border-base p-3"><strong className="text-sm">{l.first_name} {l.last_name}</strong><p className="text-xs text-secondary">{l.leave_type} · {l.start_date} au {l.end_date} · {l.days} jours</p><p className="text-xs">Statut : {l.status}{l.annual_remaining !== undefined ? ` · Solde annuel : ${l.annual_remaining}` : ''}</p>{l.status === 'EN_ATTENTE' && <div className="mt-2 flex gap-2"><button onClick={() => handleLeave(l.id, 'APPROUVE')} className="rounded bg-[#2b7a78] px-2 py-1 text-xs text-white"><Check size={13}/></button><button onClick={() => handleLeave(l.id, 'REFUSE')} className="rounded border px-2 py-1 text-xs"><X size={13}/></button></div>}</div>)}</div></section></div>}
    {view === 'payroll' && <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><section className="rounded-2xl border border-base bg-surface p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-primary">Préparation de la paie</h2><input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="mt-2 rounded border p-1" /></div><button onClick={generate} className="rounded-xl bg-[#2b7a78] px-3 py-2 text-xs text-white">Préparer la paie</button></div><div className="mt-4 mb-3"><label className="flex items-center gap-2 rounded-xl border border-base bg-surface-2 px-3 py-2 text-sm text-secondary"><Search size={16} /><input value={payrollSearch} onChange={e => setPayrollSearch(e.target.value)} placeholder="Rechercher un employé" className="w-full bg-transparent outline-none" /></label></div><div className="mt-4 space-y-2">{payroll.filter((p) => `${p.first_name} ${p.last_name} ${p.matricule}`.toLowerCase().includes(payrollSearch.toLowerCase())).map(p => <button key={p.id} type="button" onClick={() => setSelectedPayroll(p)} className="block w-full rounded-xl bg-surface-2 p-3 text-left"><div className="flex justify-between"><strong className="text-sm">{p.first_name} {p.last_name}</strong><strong>{formatMoney(p.net_amount)}</strong></div><small>{p.contract_type === DAILY_RATE_CONTRACT ? `${p.presence_days ?? 0} j de présence` : 'Base'} {formatMoney(p.base_salary)} · HS {formatMoney(p.overtime_amount)} · Avance {formatMoney(p.advances)}</small><div className="mt-2 flex gap-2"><button type="button" disabled={p.status !== 'BROUILLON'} onClick={(e) => { e.stopPropagation(); openPayrollAdjustment(p); }} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Ajuster</button><button type="button" disabled={p.status !== 'BROUILLON'} onClick={(e) => { e.stopPropagation(); validatePayroll(p); }} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Valider</button><button type="button" onClick={(e) => { e.stopPropagation(); downloadPayslip(p); }} className="rounded border px-2 py-1 text-xs"><Download size={13}/></button><button type="button" disabled={p.status === 'PAYE'} onClick={(e) => { e.stopPropagation(); setPayrollToDelete(p); }} title="Supprimer cette ligne de paie" className="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-40"><Trash2 size={13}/></button><span className={`text-xs ${p.status === 'BROUILLON' ? 'text-[#a76625]' : 'text-[#28796e]'}`}>{p.status === 'BROUILLON' ? 'À payer' : 'Payé'}</span></div></button>)}</div></section><section className="rounded-2xl border border-base bg-surface p-5"><h2 className="font-semibold text-primary">Résumé réel de la période</h2>{selectedPayroll ? <div className="mt-4 rounded-xl border border-base bg-surface-2 p-3"><p className="text-sm text-secondary">Employé ciblé</p><h3 className="mt-1 text-lg font-bold text-primary">{selectedPayroll.first_name} {selectedPayroll.last_name}</h3></div> : <div className="mt-4 text-sm text-secondary">Aucun employé sélectionné.</div>}<div className="mt-5 space-y-3 text-sm">{selectedPayroll ? <><p>Salaires de base <strong className="float-right">{formatMoney(Number(selectedPayroll.base_salary || 0))}</strong></p><p>Variables <strong className="float-right">{formatMoney(Number(selectedPayroll.overtime_amount || 0) + Number(selectedPayroll.bonuses || 0) + Number(selectedPayroll.pourboire || 0) + Number(selectedPayroll.allowances || 0))}</strong></p><p>Avances et retenues <strong className="float-right">-{formatMoney(Number(selectedPayroll.advances || 0) + Number(selectedPayroll.deductions || 0))}</strong></p><p>CNAPS, OSTIE et IRSA <strong className="float-right">-{formatMoney(Number(selectedPayroll.cnaps || 0) + Number(selectedPayroll.ostie || 0) + Number(selectedPayroll.irsa || 0))}</strong></p><p className="border-t pt-3 font-semibold">Net à payer <strong className="float-right text-[#2b7a78]">{formatMoney(Number(selectedPayroll.net_amount || 0))}</strong></p></> : <><p>Salaires de base <strong className="float-right">{formatMoney(totals.base)}</strong></p><p>Variables <strong className="float-right">{formatMoney(totals.extras)}</strong></p><p>Avances et retenues <strong className="float-right">-{formatMoney(totals.deductions)}</strong></p><p>CNAPS, OSTIE et IRSA <strong className="float-right">-{formatMoney(totals.contributions)}</strong></p><p className="border-t pt-3 font-semibold">Net à payer <strong className="float-right text-[#2b7a78]">{formatMoney(totals.net)}</strong></p></>}</div><p className="mt-5 text-xs text-secondary">CDI/CDD : CNAPS et OSTIE à 1 % du salaire, IRSA reprise de la fiche employé. Prestataires : taux journalier × jours de présence du mois.</p></section></div>}
    {view === 'evaluations' && <div className="space-y-5">
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-base bg-surface p-4">
        <CalendarDays size={18} className="mb-2 text-[#2b7a78]" />
        <label className="text-sm text-secondary">Du<input type="date" value={evalFrom} max={evalTo || undefined} onChange={e => setEvalFrom(e.target.value)} className="mt-1 block h-9 rounded border p-1" /></label>
        <label className="text-sm text-secondary">Au<input type="date" value={evalTo} min={evalFrom || undefined} onChange={e => setEvalTo(e.target.value)} className="mt-1 block h-9 rounded border p-1" /></label>
        <button type="button" onClick={() => { setEvalFrom(monthStart()); setEvalTo(monthEnd()); }} className="h-9 rounded-xl border border-base px-3 text-sm">Mois en cours</button>
        {evalFrom && evalTo && evalTo < evalFrom && <p className="text-sm text-red-600">La date de fin doit être postérieure à la date de début.</p>}
      </section>
      <BudgetSection budgets={budgets} months={budgetMonths} save={saveBudget} />
      <section className="rounded-2xl border border-base bg-surface p-5"><h2 className="font-semibold text-primary">Évaluations de performance</h2><div className="mt-4 space-y-2">{evaluations.map(e => <div key={e.id} className="rounded-xl bg-surface-2 p-3 text-sm"><strong>{e.first_name ? `${e.first_name} ${e.last_name}` : `Employé #${e.employee_id}`}</strong>{e.department ? ` · ${e.department}` : ''} · {e.period} · {e.evaluation_date} · score {e.score ?? '—'} · {e.status}<small className="block text-secondary">{e.comment || 'Aucun commentaire'}</small></div>)}{!evaluations.length && <p className="text-sm text-secondary">Aucune évaluation sur cette période.</p>}</div></section>
    </div>}
    {payrollToDelete && <div onClick={() => !deletingPayroll && setPayrollToDelete(null)} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl border border-base bg-surface shadow-2xl"><div className="p-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500"><Trash2 size={26}/></div><h2 className="mt-4 text-lg font-bold text-primary">Supprimer cette ligne de paie ?</h2><p className="mt-2 text-sm text-secondary">La ligne de <strong className="text-primary">{payrollToDelete.first_name} {payrollToDelete.last_name}</strong> sera définitivement retirée de la paie. Cette action est irréversible.</p><div className="mt-4 space-y-1 rounded-xl bg-surface-2 p-3 text-left text-xs text-secondary"><p className="flex justify-between"><span>Période</span><strong className="text-primary">{String(payrollToDelete.period_month || period).slice(0, 7)}</strong></p><p className="flex justify-between"><span>Net à payer</span><strong className="text-primary">{formatMoney(payrollToDelete.net_amount)}</strong></p><p className="flex justify-between"><span>Statut</span><strong className="text-primary">{payrollToDelete.status}</strong></p></div></div><div className="flex gap-2 border-t border-base bg-surface-2 p-4"><button type="button" disabled={deletingPayroll} onClick={() => setPayrollToDelete(null)} className="flex-1 rounded-xl border border-base px-4 py-2 text-sm font-medium text-primary transition hover:bg-surface disabled:opacity-40">Annuler</button><button type="button" autoFocus disabled={deletingPayroll} onClick={confirmRemovePayroll} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">{deletingPayroll ? 'Suppression…' : 'Supprimer'}</button></div></div></div>}
    {employeeToDelete && <div onClick={() => !deletingEmployee && setEmployeeToDelete(null)} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl border border-base bg-surface shadow-2xl"><div className="p-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500"><Trash2 size={26}/></div><h2 className="mt-4 text-lg font-bold text-primary">Supprimer cet employé ?</h2><p className="mt-2 text-sm text-secondary">Le dossier de <strong className="text-primary">{employeeToDelete.first_name} {employeeToDelete.last_name}</strong> sera définitivement supprimé, avec ses présences, congés, paies, évaluations et pièces jointes. Cette action est irréversible.</p><div className="mt-4 space-y-1 rounded-xl bg-surface-2 p-3 text-left text-xs text-secondary"><p className="flex justify-between"><span>Matricule</span><strong className="text-primary">{employeeToDelete.matricule}</strong></p><p className="flex justify-between"><span>Poste</span><strong className="text-primary">{employeeToDelete.department} · {employeeToDelete.position}</strong></p><p className="flex justify-between"><span>Statut</span><strong className="text-primary">{labelStatus(employeeToDelete.status)}</strong></p></div><p className="mt-3 text-xs text-secondary">Pour garder l’historique, préférez le statut Démissionné, Renvoyé ou Retraité via « Modifier ».</p></div><div className="flex gap-2 border-t border-base bg-surface-2 p-4"><button type="button" disabled={deletingEmployee} onClick={() => setEmployeeToDelete(null)} className="flex-1 rounded-xl border border-base px-4 py-2 text-sm font-medium text-primary transition hover:bg-surface disabled:opacity-40">Annuler</button><button type="button" autoFocus disabled={deletingEmployee} onClick={confirmRemoveEmployee} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">{deletingEmployee ? 'Suppression…' : 'Supprimer'}</button></div></div></div>}
    {employeeModal && <EmployeeFormModal key={employeeModal.employee?.id ?? 'new'} employee={employeeModal.employee} close={() => setEmployeeModal(null)} saved={refreshAfterAction} toast={showToast} />}
    {viewedEmployee && <EmployeeDetailModal employee={viewedEmployee} close={() => setViewedEmployee(null)} edit={() => { setEmployeeModal({ employee: viewedEmployee }); setViewedEmployee(null); }} enrollFace={() => { setFaceEnrollFor(viewedEmployee); setViewedEmployee(null); }} toast={showToast} />}
    {faceEnrollFor && <FaceEnrollModal employee={faceEnrollFor} close={() => setFaceEnrollFor(null)} saved={loadEmployees} toast={showToast} />}
    {kioskOpen && <FaceKioskModal close={() => { setKioskOpen(false); refreshAttendance(); }} onPunch={refreshAttendance} />}
    {payrollAdjustment && <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-black/40 p-4"><div className="mx-auto my-8 max-w-lg rounded-2xl bg-surface p-6 sm:my-16"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-primary">Ajuster la paie</h2><button type="button" onClick={() => setPayrollAdjustment(null)} className="rounded border p-2"><X size={16} /></button></div><div className="mt-4 space-y-4"><p className="text-sm text-secondary">Employé : <strong className="text-primary">{payrollAdjustment.first_name} {payrollAdjustment.last_name}</strong></p>{(() => {
      const amountInput = (key: string, label: string) => <label key={key} className="block text-sm"><span className="mb-1 block text-secondary">{label}</span><input type="number" min="0" step="0.01" value={adjustmentForm[key]} onChange={(e) => setAdjustmentForm((current) => ({ ...current, [key]: e.target.value }))} className="h-10 w-full rounded border p-2" /></label>;
      const weekly = adjustmentForm.deduction_frequency === 'HEBDOMADAIRE';
      const weeks = weeksInMonth(payrollAdjustment.period_month || `${period}-01`);
      const deductionMonth = Number(adjustmentForm.deduction_amount || 0) * (weekly ? weeks : 1);
      return <>
        {amountInput('overtime_amount', 'Heures supplémentaires (Ar)')}
        <div className="grid grid-cols-2 gap-3">{amountInput('bonuses', 'Primes (Ar)')}{amountInput('pourboire', 'Pourboire (Ar)')}</div>
        {amountInput('allowances', 'Allocations (Ar)')}
        {amountInput('advances', 'Avances (Ar)')}
        <fieldset className="space-y-3 rounded-xl border border-base p-3">
          <legend className="px-1 text-sm font-semibold text-primary">Retenue</legend>
          <div className="flex gap-2 text-sm">{([['MENSUEL', 'Totalité du mois'], ['HEBDOMADAIRE', 'Par semaine']] as const).map(([value, label]) => <label key={value} className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 ${adjustmentForm.deduction_frequency === value ? 'border-[#2b7a78] bg-[#2b7a78]/10 font-semibold text-[#2b7a78]' : 'border-base'}`}><input type="radio" name="deduction_frequency" value={value} checked={adjustmentForm.deduction_frequency === value} onChange={() => setAdjustmentForm((current) => ({ ...current, deduction_frequency: value }))} className="sr-only" />{label}</label>)}</div>
          {amountInput('deduction_amount', weekly ? 'Montant par semaine (Ar)' : 'Montant du mois (Ar)')}
          <label className="block text-sm"><span className="mb-1 block text-secondary">Motif{Number(adjustmentForm.deduction_amount) > 0 ? ' *' : ''}</span><input value={adjustmentForm.deduction_reason} maxLength={255} onChange={(e) => setAdjustmentForm((current) => ({ ...current, deduction_reason: e.target.value }))} placeholder="Ex. casse, remboursement de prêt…" className="h-10 w-full rounded border p-2" /></label>
          <p className="text-xs text-secondary">Retenue déduite ce mois : <strong className="text-primary">{weekly ? `${formatMoney(Number(adjustmentForm.deduction_amount || 0))} × ${weeks} semaines = ` : ''}{formatMoney(deductionMonth)}</strong>{Number(payrollAdjustment.absence_deductions || 0) > 0 && <> · absences calculées en plus : {formatMoney(Number(payrollAdjustment.absence_deductions))}</>}</p>
        </fieldset>
        {Number(payrollAdjustment.base_salary || 0) === 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">Salaire de base à 0 : complétez le salaire sur la fiche employé, puis relancez « Préparer la paie ».</p>}
        <div className={`flex items-center justify-between rounded-xl p-3 text-sm ${adjustmentNet < 0 ? 'border border-red-300 bg-red-50 text-red-700' : 'bg-surface-2'}`}>
          <span className="font-semibold">Net à payer</span>
          <strong className="text-lg">{formatMoney(adjustmentNet)}</strong>
        </div>
        {adjustmentNet < 0 && <p className="text-xs text-red-700">Les avances et retenues dépassent la rémunération de {formatMoney(-adjustmentNet)}. Réduisez l’avance ou la retenue pour pouvoir enregistrer.</p>}
      </>;
    })()}<div className="flex justify-end gap-2"><button type="button" onClick={() => setPayrollAdjustment(null)} className="rounded border px-3 py-2 text-sm">Annuler</button><button type="button" disabled={adjustmentNet < 0} onClick={savePayrollAdjustment} className="rounded bg-[#2b7a78] px-3 py-2 text-sm text-white disabled:opacity-40">Enregistrer</button></div></div></div></div>}
    {leaveForm && <LeaveModal employees={employees} close={() => setLeaveForm(false)} done={refreshAfterAction} toast={showToast}/>}</div>;
};
const LeaveModal = ({ employees, close, done, toast }: { employees: RHEmployee[]; close: () => void; done: () => void; toast: (message: string, type: 'success' | 'error') => void }) => { const [f,setF]=useState({employee_id:'',leave_type:'ANNUEL',start_date:'',end_date:'',reason:''}); return <div className="fixed inset-0 z-[60] bg-black/30 p-4"><form onSubmit={async e=>{e.preventDefault();try{await rhService.createLeaveRequest({...f,employee_id:Number(f.employee_id)});toast('Demande créée.','success');close();done()}catch(err:any){toast(apiMessage(err)||'Création impossible.','error')}}} className="mx-auto mt-20 max-w-md rounded-2xl bg-surface p-6"><h2 className="font-bold">Nouvelle demande de congé</h2><div className="mt-4 space-y-3"><select required value={f.employee_id} onChange={e=>setF({...f,employee_id:e.target.value})} className="w-full rounded border p-2"><option value="">Employé</option>{employees.filter(e=>!departureStatuses.includes(e.status)).map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select><select value={f.leave_type} onChange={e=>setF({...f,leave_type:e.target.value})} className="w-full rounded border p-2"><option value="ANNUEL">Annuel</option><option value="MALADIE">Maladie</option><option value="MATERNITE_PATERNITE">Maternité/paternité</option><option value="SANS_SOLDE">Sans solde</option></select><input required type="date" value={f.start_date} onChange={e=>setF({...f,start_date:e.target.value})} className="w-full rounded border p-2"/><input required type="date" value={f.end_date} onChange={e=>setF({...f,end_date:e.target.value})} className="w-full rounded border p-2"/><input value={f.reason} onChange={e=>setF({...f,reason:e.target.value})} placeholder="Motif" className="w-full rounded border p-2"/></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={close}>Annuler</button><button className="rounded bg-[#2b7a78] px-3 py-2 text-white">Envoyer</button></div></form></div> };

// ─────────────────────────────────────────────
// Pièces jointes du dossier (CIN, justificatif de résidence, CV, contrat).
// Les fichiers ne sont pas publics : ils sont lus via l'API RH authentifiée.
// ─────────────────────────────────────────────
const openDocument = async (employeeId: number, doc: RHDocument, toast: Toast) => {
  // Fenêtre ouverte avant l'appel réseau pour ne pas être bloquée par le navigateur.
  const tab = window.open('', '_blank');
  try {
    const url = URL.createObjectURL(await rhService.downloadDocument(employeeId, doc.id));
    if (tab) tab.location.href = url;
    else { const a = document.createElement('a'); a.href = url; a.download = doc.original_name; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    tab?.close();
    toast('Ouverture de la pièce jointe impossible.', 'error');
  }
};

// Photo prise au pointage par reconnaissance faciale (preuve en cas de doute).
const openAttendancePhoto = async (attendanceId: number, kind: 'in' | 'out', toast: Toast) => {
  const tab = window.open('', '_blank');
  try {
    const url = URL.createObjectURL(await rhService.attendancePhoto(attendanceId, kind));
    if (tab) tab.location.href = url; else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    tab?.close();
    toast('Photo du pointage indisponible.', 'error');
  }
};

const DocumentRows = ({ employeeId, documents, toast, remove }: { employeeId: number; documents: RHDocument[]; toast: Toast; remove?: (doc: RHDocument) => void }) => <div className="space-y-2">
  {documents.map((doc) => <div key={doc.id} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 text-sm">
    <Paperclip size={14} className="shrink-0 text-[#2b7a78]" />
    <span className="min-w-0 flex-1"><strong className="block text-xs text-secondary">{documentLabel(doc.doc_type)}</strong><span className="block truncate">{doc.original_name}</span></span>
    <button type="button" onClick={() => openDocument(employeeId, doc, toast)} title="Ouvrir" className="rounded border border-base p-1"><Eye size={14} /></button>
    {remove && <button type="button" onClick={() => remove(doc)} title="Supprimer" className="rounded border border-red-600 p-1 text-red-600"><Trash2 size={14} /></button>}
  </div>)}
  {!documents.length && <p className="text-sm text-secondary">Aucune pièce jointe.</p>}
</div>;

const useEmployeeDocuments = (employeeId: number | undefined) => {
  const [documents, setDocuments] = useState<RHDocument[]>([]);
  const reload = () => { if (employeeId) rhService.listDocuments(employeeId).then(setDocuments).catch(() => setDocuments([])); };
  useEffect(reload, [employeeId]);
  return { documents, reload };
};

// ─────────────────────────────────────────────
// Formulaire Nouvel employé / Modifier employé.
// ─────────────────────────────────────────────
const EmployeeFormModal = ({ employee, close, saved, toast }: { employee: RHEmployee | null; close: () => void; saved: () => void; toast: Toast }) => {
  const [f, setF] = useState<Record<string, string>>(() => ({ ...emptyEmployee, ...(employee ? Object.fromEntries(Object.entries(employee).map(([k, v]) => [k, v == null ? '' : String(v)])) : {}) }));
  const [pending, setPending] = useState<Array<{ key: string; doc_type: RHDocumentType; file: File }>>([]);
  const [saving, setSaving] = useState(false);
  const { documents, reload: reloadDocuments } = useEmployeeDocuments(employee?.id);
  // Visage : pour une fiche existante, il est enregistré directement depuis la fenêtre de
  // capture. Pour un nouvel employé, les captures attendent la création de la fiche.
  const [faceOpen, setFaceOpen] = useState(false);
  const [faceSamples, setFaceSamples] = useState(Number(employee?.face_samples || 0));
  const [pendingFace, setPendingFace] = useState<number[][] | null>(null);
  const set = (key: string, value: string) => setF((current) => ({ ...current, [key]: value }));
  const isDailyRate = f.contract_type === DAILY_RATE_CONTRACT;
  const isSalaried = salariedContracts.includes(f.contract_type);
  const isDeparture = departureStatuses.includes(f.status);
  // En congé et Sorti ne se choisissent pas ici (congé approuvé / ancienne procédure de sortie) :
  // on ne les propose que si c'est déjà le statut actuel.
  const statusOptions = ['ACTIF', 'SUSPENDU', 'RETRAITE', 'RENVOYE', 'DEMISSIONNE', ...(employee && ['EN_CONGE', 'SORTI'].includes(employee.status) ? [employee.status] : [])];
  const presenceDays = Number(employee?.presence_days || 0);

  const addFiles = (docType: RHDocumentType, files: FileList | null) => {
    // Copie immédiate : la FileList est vidée juste après (input.value = '' pour pouvoir
    // rechoisir le même fichier). Lue plus tard dans setPending, elle serait déjà vide.
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const stamp = Date.now();
    setPending((current) => [...current, ...selected.map((file, i) => ({ key: `${docType}-${stamp}-${i}`, doc_type: docType, file }))]);
  };
  const removeDocument = async (doc: RHDocument) => {
    if (!employee || !window.confirm(`Supprimer « ${doc.original_name} » ?`)) return;
    try { await rhService.deleteDocument(employee.id, doc.id); toast('Pièce jointe supprimée.', 'success'); reloadDocuments(); } catch (e: any) { toast(apiMessage(e) || 'Suppression impossible.', 'error'); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (isDeparture && !f.departure_reason.trim()) { toast('La raison est obligatoire pour ce statut.', 'error'); return; }
    if (f.contract_end_date && f.joined_at && f.contract_end_date < f.joined_at) { toast('La date de débauche doit être postérieure à la date d’embauche.', 'error'); return; }
    const payload: Record<string, unknown> = {
      first_name: f.first_name, last_name: f.last_name, department: f.department, position: f.position, contract_type: f.contract_type,
      joined_at: f.joined_at, contract_end_date: f.contract_end_date || null,
      salary: Number(f.salary), prime: Number(f.prime || 0), pourboire: Number(f.pourboire || 0), irsa: isSalaried ? Number(f.irsa || 0) : 0,
      phone: f.phone || null, address: f.address || null, email: f.email || null, birth_date: f.birth_date || null, identification_number: f.identification_number || null,
      qualification: f.qualification.trim() || null, cnaps_number: f.cnaps_number.trim() || null, dependents: Number(f.dependents || 0),
    };
    if (employee && !(f.status === employee.status && ['EN_CONGE', 'SORTI'].includes(employee.status))) payload.status = f.status;
    if (payload.status && isDeparture) payload.departure_reason = f.departure_reason.trim();
    setSaving(true);
    try {
      const row = employee ? await rhService.updateEmployee(employee.id, payload) : await rhService.createEmployee(payload);
      let failed = 0;
      for (const doc of pending) { try { await rhService.uploadDocument(row.id, doc.doc_type, doc.file); } catch { failed += 1; } }
      let faceError = '';
      if (pendingFace) { try { await rhService.enrollFace(row.id, pendingFace); } catch (e: any) { faceError = apiMessage(e) || 'enregistrement du visage impossible'; } }
      if (failed) toast(`Dossier enregistré, mais ${failed} pièce(s) jointe(s) n’ont pas pu être envoyées (images ou PDF uniquement).`, 'error');
      else if (faceError) toast(`Dossier enregistré, mais visage non enregistré : ${faceError} Réessayez depuis « Modifier ».`, 'error');
      else toast('Dossier employé enregistré.', 'success');
      close(); saved();
    } catch (e: any) {
      toast(apiMessage(e) || 'Enregistrement impossible.', 'error');
    } finally { setSaving(false); }
  };

  const input = (key: string, label: string, type = 'text', required = false) => <label key={key} className="text-sm">{label}{required && ' *'}<input required={required} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} value={f[key] || ''} onChange={e => set(key, e.target.value)} className="mt-1 h-10 w-full rounded border p-2" /></label>;
  const readOnly = (label: string, value: number, hint: string) => <label className="text-sm">{label}<input readOnly value={formatMoney(value)} className="mt-1 h-10 w-full rounded border bg-surface-2 p-2 text-secondary" /><small className="text-xs text-secondary">{hint}</small></label>;

  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/30 p-4"><form onSubmit={submit} className="mx-auto my-8 max-w-2xl space-y-5 rounded-2xl bg-surface p-6">
    <div className="flex justify-between"><h2 className="text-xl font-bold">{employee ? `Modifier ${employee.first_name} ${employee.last_name}` : 'Nouvel employé'}</h2><button type="button" onClick={close}><X /></button></div>

    <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold text-[#2b7a78]">Identité</legend>
      {input('first_name', 'Prénom', 'text', true)}{input('last_name', 'Nom', 'text', true)}
      {input('birth_date', 'Date de naissance', 'date')}{input('identification_number', 'N° identité')}
      {input('phone', 'Téléphone')}{input('email', 'E-mail', 'email')}
      {input('address', 'Adresse')}
      <label className="text-sm">Personnes à charge<input type="number" min="0" max="255" step="1" value={f.dependents || '0'} onChange={e => set('dependents', e.target.value)} className="mt-1 h-10 w-full rounded border p-2" /></label>
    </fieldset>

    <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold text-[#2b7a78]">Poste et contrat</legend>
      <label className="text-sm">Département<select value={f.department} onChange={e => set('department', e.target.value)} className="mt-1 h-10 w-full rounded border p-2">{departments.map(d => <option key={d}>{d}</option>)}</select></label>
      {input('position', 'Poste', 'text', true)}
      <label className="text-sm">Type de contrat<select value={f.contract_type} onChange={e => set('contract_type', e.target.value)} className="mt-1 h-10 w-full rounded border p-2">{contractTypes.map(c => <option key={c}>{c}</option>)}</select></label>
      {input('qualification', 'Qualification (ex. OP1)')}
      {input('cnaps_number', 'N° CNaPS (affiliation)')}
      <div />
      {input('joined_at', 'Date d’embauche', 'date', true)}{input('contract_end_date', 'Date de débauche (fin de contrat)', 'date')}
    </fieldset>

    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold text-[#2b7a78]">Rémunération</legend>
      {input('salary', isDailyRate ? 'Taux journalier (Ar)' : 'Salaire (Ar)', 'number', true)}
      <div className="grid gap-3 sm:grid-cols-2">{input('prime', 'Prime (Ar)', 'number')}{input('pourboire', 'Pourboire (Ar)', 'number')}</div>
      {isDailyRate && <div className="rounded-xl border border-base bg-surface-2 p-3 text-sm">
        <p>Jours de présence ce mois-ci : <strong>{presenceDays}</strong>{!employee && <span className="text-secondary"> (le compteur démarre après le premier pointage)</span>}</p>
        <p>Rémunération estimée : <strong>{presenceDays} × {formatMoney(Number(f.salary || 0))} = {formatMoney(presenceDays * Number(f.salary || 0))}</strong></p>
        <p className="mt-1 text-xs text-secondary">Le compteur est calculé à partir des pointages du mois et repart automatiquement à 0 le 1er de chaque mois.</p>
      </div>}
      {isSalaried && <div className="grid gap-3 sm:grid-cols-3">
        {readOnly('CNAPS', onePercent(f.salary), '1 % du salaire, calcul automatique')}
        {readOnly('OSTIE', onePercent(f.salary), '1 % du salaire, calcul automatique')}
        {input('irsa', 'IRSA (Ar)', 'number')}
      </div>}
    </fieldset>

    {employee && <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold text-[#2b7a78]">Statut</legend>
      <label className="text-sm">Statut d’emploi<select value={f.status} onChange={e => set('status', e.target.value)} className="mt-1 h-10 w-full rounded border p-2">{statusOptions.map(s => <option key={s} value={s}>{labelStatus(s)}</option>)}</select></label>
      {isDeparture && <label className="text-sm sm:col-span-2">Raison *<textarea required value={f.departure_reason || ''} onChange={e => set('departure_reason', e.target.value)} rows={2} maxLength={255} placeholder="Motif du départ" className="mt-1 w-full rounded border p-2" /></label>}
    </fieldset>}

    <fieldset><legend className="mb-2 text-sm font-semibold text-[#2b7a78]">Visage (pointage)</legend>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base p-3 text-sm">
        <span className="flex items-center gap-2"><ScanFace size={18} className="text-[#2b7a78]" />{pendingFace ? <span>Visage capturé : il sera enregistré avec la fiche.</span> : faceSamples > 0 ? <span>Visage enregistré pour le pointage.</span> : <span className="text-secondary">Aucun visage : pointage manuel uniquement.</span>}</span>
        <span className="flex gap-2">
          {pendingFace && <button type="button" onClick={() => setPendingFace(null)} className="rounded border border-base px-3 py-1 text-xs">Retirer</button>}
          <button type="button" onClick={() => setFaceOpen(true)} className="rounded border border-[#2b7a78] px-3 py-1 text-xs text-[#2b7a78]">{pendingFace || faceSamples > 0 ? (employee ? 'Gérer' : 'Refaire') : 'Enregistrer le visage'}</button>
        </span>
      </div>
    </fieldset>

    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold text-[#2b7a78]">Pièces jointes</legend>
      <div className="grid gap-2 sm:grid-cols-2">{documentTypes.map(([type, label]) => <label key={type} className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-base p-3 text-sm hover:bg-surface-2"><Paperclip size={15} className="text-[#2b7a78]" /><span className="flex-1">{label}</span><span className="text-xs text-secondary">Ajouter</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden" onChange={e => { addFiles(type, e.target.files); e.target.value = ''; }} /></label>)}</div>
      <p className="text-xs text-secondary">Images ou PDF, sans limite de taille.</p>
      {pending.map(doc => <div key={doc.key} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 text-sm"><Paperclip size={14} className="text-secondary" /><span className="min-w-0 flex-1"><strong className="block text-xs text-secondary">{documentLabel(doc.doc_type)} · à envoyer</strong><span className="block truncate">{doc.file.name}</span></span><button type="button" onClick={() => setPending(current => current.filter(item => item.key !== doc.key))} title="Retirer" className="rounded border p-1"><X size={14} /></button></div>)}
      {employee && <DocumentRows employeeId={employee.id} documents={documents} toast={toast} remove={removeDocument} />}
    </fieldset>

    <div className="flex justify-end gap-2"><button type="button" onClick={close} className="rounded border px-4 py-2">Annuler</button><button disabled={saving} className="rounded bg-[#2b7a78] px-4 py-2 text-white disabled:opacity-60">{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
  </form>
  {faceOpen && (employee
    ? <FaceEnrollModal employee={{ ...employee, face_samples: faceSamples }} close={() => setFaceOpen(false)} saved={(count) => { setFaceSamples(count); saved(); }} toast={toast} />
    : <FaceEnrollModal employee={{ first_name: f.first_name, last_name: f.last_name }} close={() => setFaceOpen(false)} onCaptured={setPendingFace} toast={toast} />)}
  </div>;
};

// ─────────────────────────────────────────────
// Fiche détaillée (bouton « Voir » de la liste des employés), en lecture seule.
// ─────────────────────────────────────────────
const EmployeeDetailModal = ({ employee: e, close, edit, enrollFace, toast }: { employee: RHEmployee; close: () => void; edit: () => void; enrollFace: () => void; toast: Toast }) => {
  const { documents } = useEmployeeDocuments(e.id);
  const isDailyRate = e.contract_type === DAILY_RATE_CONTRACT;
  const row = (label: string, value: React.ReactNode) => <p className="flex justify-between gap-4 border-b border-base py-2 text-sm"><span className="text-secondary">{label}</span><strong className="text-right text-primary">{value || '—'}</strong></p>;
  return <div onClick={close} className="fixed inset-0 z-[60] overflow-y-auto bg-black/30 p-4"><div role="dialog" aria-modal="true" onClick={ev => ev.stopPropagation()} className="mx-auto my-8 max-w-2xl rounded-2xl bg-surface p-6">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2b7a78] text-sm font-semibold text-white">{initials(e)}</span><div><h2 className="text-xl font-bold text-primary">{e.first_name} {e.last_name}</h2><p className="text-sm text-secondary">{e.matricule} · <span style={{ color: colour(e.status) }}>{labelStatus(e.status)}</span></p></div></div>
      <button type="button" onClick={close}><X /></button>
    </div>
    <div className="mt-5 grid gap-x-6 sm:grid-cols-2">
      <div>{row('Département', e.department)}{row('Poste', e.position)}{row('Qualification', e.qualification)}{row('Type de contrat', e.contract_type)}{row('N° CNaPS', e.cnaps_number)}{row('Personnes à charge', String(e.dependents ?? 0))}{row('Date d’embauche', e.joined_at)}{row('Date de débauche', e.contract_end_date)}{row('Date de naissance', e.birth_date)}{row('N° identité', e.identification_number)}</div>
      <div>{row('Téléphone', e.phone)}{row('E-mail', e.email)}{row('Adresse', e.address)}{row(isDailyRate ? 'Taux journalier' : 'Salaire', formatMoney(e.salary))}{row('Prime', formatMoney(e.prime || 0))}{row('Pourboire', formatMoney(e.pourboire || 0))}
        {isDailyRate && row('Jours de présence (mois en cours)', `${e.presence_days || 0} j · ${formatMoney((e.presence_days || 0) * e.salary)}`)}
        {salariedContracts.includes(e.contract_type) && <>{row('CNAPS (1 %)', formatMoney(e.cnaps || 0))}{row('OSTIE (1 %)', formatMoney(e.ostie || 0))}{row('IRSA', formatMoney(e.irsa || 0))}</>}
      </div>
    </div>
    {departureStatuses.includes(e.status) && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>{labelStatus(e.status)}</strong>{e.departure_date ? ` le ${e.departure_date}` : ''}<p className="mt-1">Raison : {e.departure_reason || '—'}</p></div>}
    <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-base p-3 text-sm">
      <span className="flex items-center gap-2"><ScanFace size={18} className="text-[#2b7a78]" />{Number(e.face_samples || 0) > 0 ? <span>Visage enregistré pour le pointage{e.face_consent_at ? <span className="text-secondary"> · accord du {e.face_consent_at.slice(0, 10)}</span> : null}</span> : <span className="text-secondary">Aucun visage enregistré : pointage manuel uniquement.</span>}</span>
      <button type="button" onClick={enrollFace} className="shrink-0 rounded border border-base px-3 py-1 text-xs">{Number(e.face_samples || 0) > 0 ? 'Gérer' : 'Enregistrer le visage'}</button>
    </div>
    <h3 className="mt-5 mb-2 font-semibold text-primary">Pièces jointes</h3>
    <DocumentRows employeeId={e.id} documents={documents} toast={toast} />
    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={close} className="rounded border px-4 py-2">Fermer</button><button type="button" onClick={edit} className="flex items-center gap-2 rounded bg-[#2b7a78] px-4 py-2 text-white"><Pencil size={15} /> Modifier</button></div>
  </div></div>;
};

// ─────────────────────────────────────────────
// Évaluation : budget salarial par département sur la période filtrée.
// Budget saisi par mois, multiplié par le nombre de mois couverts.
// Réalisé = masse salariale brute des fiches de paie de la période.
// ─────────────────────────────────────────────
const BudgetSection = ({ budgets, months, save }: { budgets: RHDepartmentBudget[]; months: number; save: (department: string, value: string) => void }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => { setDrafts(Object.fromEntries(budgets.map((b) => [b.department, String(b.monthly_budget)]))); }, [budgets]);
  const total = budgets.reduce((a, b) => ({ headcount: a.headcount + b.headcount, budget: a.budget + b.budget, actual: a.actual + b.actual, net: a.net + b.net, toPay: a.toPay + b.to_pay, paid: a.paid + b.paid }), { headcount: 0, budget: 0, actual: 0, net: 0, toPay: 0, paid: 0 });
  return <section className="rounded-2xl border border-base bg-surface">
    <div className="border-b border-base p-4"><h2 className="font-semibold text-primary">Salaires et budget par département</h2><p className="text-xs text-secondary">Période couvrant {months} mois · total des salaires = net des fiches de paie : à payer (brouillon) et payé (validé) · réalisé = masse brute (base + HS + primes + pourboires + indemnités), comparée au budget.</p></div>
    <div className="grid gap-3 border-b border-base p-4 sm:grid-cols-3">
      <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-secondary">Total des salaires</p><p className="mt-1 text-xl font-bold text-primary">{formatMoney(total.net)}</p></div>
      <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-secondary">À payer</p><p className="mt-1 text-xl font-bold text-[#a76625]">{formatMoney(total.toPay)}</p></div>
      <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-secondary">Payé</p><p className="mt-1 text-xl font-bold text-[#28796e]">{formatMoney(total.paid)}</p></div>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm">
      <thead className="bg-surface-2 text-secondary"><tr><th className="p-3">Département</th><th>Effectif</th><th>Total salaires</th><th>À payer</th><th>Payé</th><th>Budget mensuel</th><th>Budget période</th><th>Réalisé (brut)</th><th>Écart</th><th className="p-3">Utilisation</th></tr></thead>
      <tbody>
        {budgets.map((b) => { const over = b.budget > 0 && b.actual > b.budget; return <tr key={b.department} className="border-t border-base">
          <td className="p-3 font-medium">{b.department}</td><td>{b.headcount}</td>
          <td className="font-medium">{formatMoney(b.net)}</td><td className="text-[#a76625]">{formatMoney(b.to_pay)}</td><td className="text-[#28796e]">{formatMoney(b.paid)}</td>
          <td><div className="flex items-center gap-1"><input type="number" min="0" step="1000" value={drafts[b.department] ?? ''} onChange={e => setDrafts((d) => ({ ...d, [b.department]: e.target.value }))} className="h-8 w-32 rounded border p-1" />{drafts[b.department] !== String(b.monthly_budget) && <button type="button" onClick={() => save(b.department, drafts[b.department] ?? '')} title="Enregistrer le budget" className="rounded bg-[#2b7a78] p-1.5 text-white"><Save size={13} /></button>}</div></td>
          <td>{formatMoney(b.budget)}</td><td>{formatMoney(b.actual)}</td>
          <td className={over ? 'text-red-600' : 'text-[#28796e]'}>{formatMoney(b.remaining)}</td>
          <td className="p-3">{b.usage === null ? <span className="text-xs text-secondary">Budget non défini</span> : <div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded bg-surface-2"><div className={`h-full ${over ? 'bg-red-500' : 'bg-[#2b7a78]'}`} style={{ width: `${Math.min(100, b.usage)}%` }} /></div><span className="text-xs">{b.usage} %</span></div>}</td>
        </tr>; })}
        {budgets.length > 0 && <tr className="border-t-2 border-base font-semibold"><td className="p-3">Total</td><td>{total.headcount}</td><td>{formatMoney(total.net)}</td><td>{formatMoney(total.toPay)}</td><td>{formatMoney(total.paid)}</td><td /><td>{formatMoney(total.budget)}</td><td>{formatMoney(total.actual)}</td><td className={total.budget > 0 && total.actual > total.budget ? 'text-red-600' : ''}>{formatMoney(total.budget - total.actual)}</td><td /></tr>}
      </tbody>
    </table></div>
  </section>;
};
