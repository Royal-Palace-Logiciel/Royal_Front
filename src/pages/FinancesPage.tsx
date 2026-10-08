import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../utils/data';
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Download, Filter, Plus, CreditCard, CalendarRange } from 'lucide-react';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import financeService, { FinancialTransaction, ModuleCaisseSolde, FinancialStats, MonthlyDepartmentReport, PeriodDepartmentReport, isFinancialInflow, isFinancialOutflow } from '../services/finance.service';
import { CreateInvoiceModal } from '../components/Finance/modals/CreateInvoiceModal';
import { RecordPaymentModal } from '../components/Finance/modals/RecordPaymentModal';
import { Modal } from '../components/ui/Modal';
import { toast } from 'react-hot-toast';
import { useHDA } from '../context/HDAContext';

// Module configuration for financial tracking and reporting
// Note: 'hebergement' module removed from display as it's disabled in the main application
// Kept in normalizeModuleKey for historical data processing but hidden from UI
const moduleConfig: Record<string, { label: string; gradient: string; color: string }> = {
  hotel: { label: 'Hôtel', gradient: 'from-indigo-500 to-blue-600', color: '#6366f1' },
  restaurant: { label: 'Restaurant', gradient: 'from-orange-500 to-amber-600', color: '#f97316' },
  bar: { label: 'Bar & Lounge', gradient: 'from-rose-500 to-pink-600', color: '#f43f5e' },
  casino: { label: 'Casino', gradient: 'from-emerald-500 to-green-600', color: '#10b981' },
  // Removed General, Facturation, and Hébergement (disabled)
};

const financeModules = Object.keys(moduleConfig);
const defaultModuleConfig = { label: 'Module', gradient: 'from-gray-500 to-gray-600', color: '#6b7280' };

const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Normalizes module names to consistent keys for financial data processing
// Handles various naming conventions and historical data references
// Note: 'hebergement' is still processed for historical data but mapped to 'hotel' for display
const normalizeModuleKey = (value?: string): string => {
  const raw = String(value || 'general').trim().toLowerCase();

  // Map disabled hebergement to hotel for display purposes
  if (raw.includes('hebergement')) return 'hotel';
  if (raw.includes('hotel')) return 'hotel';
  if (raw.includes('restaurant')) return 'restaurant';
  if (raw.includes('bar')) return 'bar';
  if (raw.includes('casino')) return 'casino';
  if (raw.includes('facturation')) return 'facturation';
  if (raw.includes('general')) return 'general';

  return raw || 'general';
};

export const FinancesPage: React.FC = () => {
  const { getModuleStock } = useHDA();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [financialStats, setFinancialStats] = useState<FinancialStats>({
    totalEntrees: 0,
    totalSorties: 0,
    beneficeNet: 0,
    totalRevenu: 0,
    totalDepenses: 0,
    soldeGlobal: 0,
    modules: [],
  });
  const [modulesSoldes, setModulesSoldes] = useState<Array<{ module: string } & ModuleCaisseSolde>>([]);

  // Monthly / department breakdown (CA & charges per month for a given department)
  const [monthlyDepartment, setMonthlyDepartment] = useState<string>(financeModules[0]);
  const [monthlyYear, setMonthlyYear] = useState<number>(new Date().getFullYear());
  const [monthlyMonthFilter, setMonthlyMonthFilter] = useState<number>(0); // 0 = tous les mois
  const [monthlyRows, setMonthlyRows] = useState<MonthlyDepartmentReport[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState<boolean>(false);
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [periodDate, setPeriodDate] = useState(() => toDateInputValue(new Date()));
  const [periodRows, setPeriodRows] = useState<PeriodDepartmentReport[]>([]);
  const [periodLoading, setPeriodLoading] = useState<boolean>(false);

  // Modal states
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [operation, setOperation] = useState({ module: financeModules[0], type_flux: 'ENTREE' as 'ENTREE' | 'SORTIE', montant: '', description: '' });
  const [isSavingOperation, setIsSavingOperation] = useState(false);

  // Fetch financial data on component mount
  useEffect(() => {
    fetchFinancialData();
  }, []);

  // Fetch the monthly/department breakdown whenever the year filter changes.
  // Fetched for all backend departments (not just the selected one) because
  // 'hebergement' must be merged into the 'hotel' bucket below, the same way
  // normalizeModuleKey already merges it for the "Caisses par Module" cards —
  // otherwise selecting "Hôtel" here would silently miss hebergement data
  // that's visible everywhere else on this page.
  useEffect(() => {
    let cancelled = false;
    const fetchMonthlyReport = async () => {
      setMonthlyLoading(true);
      try {
        const rows = await financeService.getMonthlyDepartmentReport({ year: monthlyYear });
        if (cancelled) return;

        const merged = new Map<string, MonthlyDepartmentReport>();
        rows.forEach((row) => {
          const department = normalizeModuleKey(row.department);
          const key = `${department}|${row.month}`;
          const existing = merged.get(key);
          if (existing) {
            existing.ca += row.ca;
            existing.charges += row.charges;
            existing.solde += row.solde;
            existing.resultat_final = (existing.resultat_final || 0) + (row.resultat_final || 0);
          } else {
            merged.set(key, { ...row, department });
          }
        });
        setMonthlyRows([...merged.values()]);
      } finally {
        if (!cancelled) setMonthlyLoading(false);
      }
    };
    fetchMonthlyReport();
    return () => { cancelled = true; };
  }, [monthlyYear]);

  useEffect(() => {
    if (reportPeriod === 'monthly') return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodDate)) {
      setPeriodRows([]);
      setPeriodLoading(false);
      return;
    }

    const selectedDate = new Date(`${periodDate}T12:00:00`);
    const startDate = new Date(selectedDate);
    if (reportPeriod === 'weekly') {
      startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));
    }
    const endDate = new Date(startDate);
    if (reportPeriod === 'weekly') endDate.setDate(endDate.getDate() + 6);
    const startDateValue = toDateInputValue(startDate);
    const endDateValue = toDateInputValue(endDate);

    let cancelled = false;
    const fetchPeriodReport = async () => {
      setPeriodLoading(true);
      setPeriodRows([]);
      try {
        const rows = await financeService.getPeriodDepartmentReport({
          period: reportPeriod,
          startDate: startDateValue,
          endDate: endDateValue,
        });
        if (cancelled) return;

        const merged = new Map<string, PeriodDepartmentReport>();
        rows.forEach((row) => {
          const department = normalizeModuleKey(row.department);
          const key = `${department}|${row.start_date}|${row.end_date}`;
          const existing = merged.get(key);
          if (existing) {
            existing.ca += row.ca;
            existing.charges += row.charges;
            existing.solde += row.solde;
            existing.resultat_final = (existing.resultat_final || 0) + (row.resultat_final || 0);
          } else {
            merged.set(key, { ...row, department });
          }
        });
        setPeriodRows([...merged.values()].filter((row) => row.department === monthlyDepartment));
      } finally {
        if (!cancelled) setPeriodLoading(false);
      }
    };
    fetchPeriodReport();
    return () => { cancelled = true; };
  }, [reportPeriod, periodDate, monthlyDepartment]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [transactionsData, statsData] = await Promise.all([
        financeService.getTransactions(),
        financeService.getFinancialStats(),
      ]);

      setTransactions(transactionsData);
      setFinancialStats(statsData);

      const balances = new Map(financeModules.map(module => [module, { module, entrees: 0, sorties: 0, solde: 0 }]));

      const backendModuleSummary = Array.isArray((statsData as any)?.modules) ? (statsData as any).modules : [];
      backendModuleSummary.forEach((summary: any) => {
        const module = normalizeModuleKey(summary?.module);
        const entrees = Number(summary?.entrees) || 0;
        const sorties = Number(summary?.sorties) || 0;
        balances.set(module, {
          module,
          entrees,
          sorties,
          solde: Number(summary?.solde) || (entrees - sorties),
        });
      });

      if (backendModuleSummary.length === 0) {
        transactionsData.forEach((transaction) => {
          const module = normalizeModuleKey(transaction.module);
          const balance = balances.get(module) || { module, entrees: 0, sorties: 0, solde: 0 };
          const amount = Number(transaction.montant) || 0;
          if (isFinancialInflow(transaction.type_flux)) balance.entrees += amount;
          if (isFinancialOutflow(transaction.type_flux)) balance.sorties += amount;
          balance.solde = balance.entrees - balance.sorties;
          balances.set(module, balance);
        });
      }

      setModulesSoldes([...balances.values()]);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    try {
      // Check if there is any data to export
      const hasTransactions = transactions.length > 0;
      const hasModuleData = modulesSoldes.length > 0;

      if (!hasTransactions && !hasModuleData) {
        alert('Aucune donnée financière à exporter. Veuillez vérifier que les données sont chargées.');
        return;
      }

      // Create CSV content
      const csvRows: string[][] = [];
      
      // Add header section with report metadata
      csvRows.push(['RAPPORT FINANCIER - HOTEL DE L\'AVENUE (HDA)']);
      csvRows.push(['Généré le:', new Date().toLocaleString('fr-FR')]);
      csvRows.push(['Nombre total de transactions:', transactions.length.toString()]);
      csvRows.push([]);
      
      // ── Section 1: Global statistics ──
      csvRows.push(['═══ STATISTIQUES GLOBALES ═══']);
      csvRows.push(['Indicateur', 'Montant (MGA)']);
      csvRows.push(['Solde Global', financialStats.soldeGlobal.toString()]);
      csvRows.push(['Total Revenus', financialStats.totalRevenu.toString()]);
      csvRows.push(['Total Dépenses', financialStats.totalDepenses.toString()]);
      csvRows.push([]);
      
      // ── Section 2: Module-specific caisse data ──
      csvRows.push(['═══ CAISSES PAR MODULE ═══']);
      csvRows.push(['Module', 'Solde (MGA)', 'Entrées (MGA)', 'Sorties (MGA)']);
      if (hasModuleData) {
        displayedModulesSoldes.forEach(m => {
          csvRows.push([
            moduleConfig[m.module]?.label || m.module,
            m.solde.toString(),
            m.entrees.toString(),
            m.sorties.toString()
          ]);
        });
      } else {
        csvRows.push(['Aucune donnée de caisse disponible']);
      }
      csvRows.push([]);
      
      // ── Section 3: Full transaction history (ALL transactions, not filtered) ──
      csvRows.push(['═══ HISTORIQUE COMPLET DES TRANSACTIONS ═══']);
      csvRows.push(['ID', 'Date', 'Module', 'Type de Flux', 'Description', 'Montant (MGA)', 'Référence', 'Statut Sync']);
      
      if (hasTransactions) {
        // Use raw transactions from backend (not the filtered allTransactions)
        // Sort by date descending for the export
        const sortedTransactions = [...transactions].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        sortedTransactions.forEach(tx => {
          const moduleName = moduleConfig[tx.module?.toLowerCase()]?.label || tx.module || 'Inconnu';
          csvRows.push([
            tx.id.toString(),
            tx.created_at ? formatDate(tx.created_at) : 'N/A',
            moduleName,
            tx.type_flux?.toUpperCase().includes('ENTREE') ? 'ENTRÉE' : 'SORTIE',
            tx.description || 'Transaction',
            Number(tx.montant).toString(),
            tx.ref_flux_global || '',
            tx.statut_sync || ''
          ]);
        });
      } else {
        csvRows.push(['Aucune transaction enregistrée']);
      }
      
      // Convert to CSV string with proper escaping
      const csvContent = csvRows.map(row => 
        row.map(cell => {
          const cellStr = String(cell ?? '');
          // Wrap in quotes if contains comma, quote, newline, or semicolon
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes(';')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      ).join('\n');
      
      // Create and trigger download with BOM for Excel UTF-8 compatibility
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const filename = `rapport_financier_HDA_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup the object URL
      URL.revokeObjectURL(url);
      
      console.log(`✅ Export financier réussi: ${filename} (${transactions.length} transactions)`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export des données financières. Veuillez réessayer.');
    }
  };

  const displayedModulesSoldes = modulesSoldes.map((module) => {
    return { ...module, solde: module.entrees - module.sorties };
  });
  const displayedTotalSorties = financialStats.totalDepenses;

  const pieData = displayedModulesSoldes.map(m => ({
    name: moduleConfig[m.module]?.label || m.module,
    value: m.entrees,
    color: moduleConfig[m.module]?.color || '#6b7280',
  }));

  const barData = displayedModulesSoldes.map(m => ({
    name: moduleConfig[m.module]?.label || m.module,
    entrees: m.entrees,
    sorties: m.sorties,
    solde: m.solde,
  }));

  // All transactions - convert backend format to frontend format
  const allTransactions = transactions
    .filter(tx => financeModules.includes(normalizeModuleKey(tx.module)))
    .filter(tx => activeFilter === 'all' || normalizeModuleKey(tx.module) === activeFilter.toLowerCase())
    .map(tx => {
      const module = normalizeModuleKey(tx.module);
      return {
        id: tx.id.toString(),
        type: isFinancialInflow(tx.type_flux) ? 'entree' : 'sortie',
        montant: Number(tx.montant),
        description: tx.description || 'Transaction',
        categorie: moduleConfig[module]?.label || tx.module || defaultModuleConfig.label,
        userId: '0',
        userName: 'Système',
        module,
        date: tx.created_at || new Date().toISOString(),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalEntrees = financialStats.totalRevenu;
  const totalSorties = displayedTotalSorties;

  // Full 12-month table for the selected department/year, filling in months with no data.
  const monthlyRowsByMonth = new Map(
    monthlyRows.filter(row => row.department === monthlyDepartment).map(row => [row.month, row])
  );
  const monthlyTableRows = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return monthlyRowsByMonth.get(month) || { department: monthlyDepartment, year: monthlyYear, month, ca: 0, charges: 0, solde: 0, resultat_final: 0 };
  });  const visibleMonthlyRows = monthlyMonthFilter === 0
    ? monthlyTableRows
    : monthlyTableRows.filter(row => row.month === monthlyMonthFilter);
  const selectedMonthRow = monthlyMonthFilter === 0 ? null : monthlyTableRows[monthlyMonthFilter - 1];
  const periodTotals = periodRows.reduce((totals, row) => ({
    ca: totals.ca + row.ca,
    charges: totals.charges + row.charges,
    solde: totals.solde + row.solde,
    resultat_final: totals.resultat_final + (row.resultat_final || 0),
  }), { ca: 0, charges: 0, solde: 0, resultat_final: 0 });
  const monthlyTotals = visibleMonthlyRows.reduce((totals, row) => ({
    ca: totals.ca + row.ca,
    charges: totals.charges + row.charges,
    solde: totals.solde + row.solde,
    resultat_final: totals.resultat_final + (row.resultat_final || 0),
  }), { ca: 0, charges: 0, solde: 0, resultat_final: 0 });

  const handleExportReportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const departmentName = moduleConfig[monthlyDepartment]?.label || monthlyDepartment;
      const reportTitle = reportPeriod === 'daily' ? 'Rapport journalier'
        : reportPeriod === 'weekly' ? 'Rapport hebdomadaire' : 'Rapport mensuel';
      let periodLabel: string;
      let rows: Array<{ label: string; ca: number; charges: number; solde: number; resultat_final?: number }>;
      let totals: { ca: number; charges: number; solde: number; resultat_final: number };

      if (reportPeriod === 'monthly') {
        periodLabel = monthlyMonthFilter === 0
          ? `Année ${monthlyYear}`
          : `${MONTH_LABELS[monthlyMonthFilter - 1]} ${monthlyYear}`;
        rows = visibleMonthlyRows.map((row) => ({
          label: MONTH_LABELS[row.month - 1],
          ca: row.ca,
          charges: row.charges,
          solde: row.solde,
          resultat_final: row.resultat_final || 0,
        }));
        totals = monthlyTotals;
      } else {
        const startDate = new Date(`${periodDate}T12:00:00`);
        if (reportPeriod === 'weekly') {
          startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));
        }
        const endDate = new Date(startDate);
        if (reportPeriod === 'weekly') endDate.setDate(endDate.getDate() + 6);
        const startLabel = startDate.toLocaleDateString('fr-FR');
        const endLabel = endDate.toLocaleDateString('fr-FR');
        periodLabel = reportPeriod === 'daily' ? startLabel : `Du ${startLabel} au ${endLabel}`;
        rows = periodRows.map((row) => ({
          label: reportPeriod === 'daily'
            ? new Date(`${row.start_date}T12:00:00`).toLocaleDateString('fr-FR')
            : `Du ${new Date(`${row.start_date}T12:00:00`).toLocaleDateString('fr-FR')} au ${new Date(`${row.end_date}T12:00:00`).toLocaleDateString('fr-FR')}`,
          ca: row.ca,
          charges: row.charges,
          solde: row.solde,
          resultat_final: row.resultat_final || 0,
        }));
        totals = periodTotals;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('HDA - Rapport financier', 14, 18);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`${reportTitle} | ${departmentName} | ${periodLabel}`, 14, 26);
      pdf.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 32);

      const summaryTop = 40;
      const summaryWidth = (pageWidth - 36) / 3;
      [
        { label: "Chiffre d'affaires", amount: totals.ca },
        { label: 'Charges', amount: totals.charges },
        { label: 'Solde', amount: totals.solde },
      ].forEach((item, index) => {
        const x = 14 + index * (summaryWidth + 4);
        pdf.setFillColor(245, 246, 248);
        pdf.roundedRect(x, summaryTop, summaryWidth, 19, 2, 2, 'F');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 96, 105);
        pdf.text(item.label, x + 5, summaryTop + 7);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(35, 39, 46);
        pdf.text(formatCurrency(item.amount), x + 5, summaryTop + 14);
        pdf.setFont('helvetica', 'normal');
      });

      let y = 68;
      pdf.setFillColor(35, 39, 46);
      pdf.rect(14, y, pageWidth - 28, 10, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text(reportPeriod === 'monthly' ? 'Mois' : 'Période', 19, y + 6.5);
      pdf.text('CA', 155, y + 6.5, { align: 'right' });
      pdf.text('Charges', 215, y + 6.5, { align: 'right' });
      pdf.text('Solde', pageWidth - 19, y + 6.5, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(35, 39, 46);
      y += 10;

      const tableRows = rows.length ? rows : [{ label: 'Aucune donnée pour cette période', ca: 0, charges: 0, solde: 0 }];
      tableRows.forEach((row) => {
        pdf.setDrawColor(225, 228, 232);
        pdf.line(14, y + 9, pageWidth - 14, y + 9);
        pdf.setFontSize(9);
        pdf.text(row.label, 19, y + 6);
        pdf.text(formatCurrency(row.ca), 155, y + 6, { align: 'right' });
        pdf.text(formatCurrency(row.charges), 215, y + 6, { align: 'right' });
        pdf.text(formatCurrency(row.solde), pageWidth - 19, y + 6, { align: 'right' });
        y += 10;
      });

      const periodSlug = reportPeriod === 'monthly'
        ? `${monthlyYear}-${monthlyMonthFilter ? String(monthlyMonthFilter).padStart(2, '0') : 'annee'}`
        : periodDate;
      pdf.save(`rapport-financier-${reportPeriod}-${monthlyDepartment}-${periodSlug}.pdf`);
    } catch (error) {
      console.error('Erreur lors de la génération du rapport PDF:', error);
      toast.error('Impossible de générer le rapport PDF.');
    }
  };

  const handleCreateOperation = async (event: React.FormEvent) => {
    event.preventDefault();
    const montant = Number(operation.montant);
    if (!montant || montant <= 0 || !operation.description.trim()) {
      toast.error('Indiquez un montant positif et une description.');
      return;
    }
    setIsSavingOperation(true);
    try {
      await financeService.createTransaction({ ...operation, montant, description: operation.description.trim() });
      toast.success(operation.type_flux === 'ENTREE' ? 'Entrée enregistrée.' : 'Sortie enregistrée.');
      setShowOperationModal(false);
      setOperation({ module: 'general', type_flux: 'ENTREE', montant: '', description: '' });
      await fetchFinancialData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Impossible d’enregistrer l’opération.');
    } finally {
      setIsSavingOperation(false);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-surface border border-base rounded-xl p-3">
          {payload.map((p: any) => (
            <div key={p.name} className="flex justify-between gap-4 text-sm">
              <span className="text-muted">{p.name === 'entrees' ? 'Entrées' : p.name === 'sorties' ? 'Sorties' : 'Solde'}:</span>
              <span className="text-primary font-semibold">{formatCurrency(p.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-primary text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>Finances</h2>
          <p className="text-muted text-sm mt-1">Vue consolidée de toutes les caisses</p>
        </div>
        <div className="flex items-center gap-3">
          {/* <button
            onClick={() => setShowOperationModal(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-black text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            <span className="hidden md:inline">Opération</span>
          </button> */}
          {/* <button 
            onClick={() => setShowCreateInvoiceModal(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 border border-base text-muted hover:text-primary text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            <span className="hidden md:inline">Facture</span>
          </button>
          <button 
            onClick={() => setShowRecordPaymentModal(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 border border-base text-muted hover:text-primary text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard size={16} />
            <span className="hidden md:inline">Paiement</span>
          </button> */}
          <button 
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 border border-base text-muted hover:text-primary text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            <span className="hidden md:inline">Exporter</span>
          </button>
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
            <DollarSign size={24} className="text-black" />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted">Chargement des données financières...</div>
        </div>
      ) : (
        <>
      {/* Global KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative overflow-hidden bg-accent-4 border border-accent/20 rounded-xl p-4">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl bg-accent/20" />
          <p className="text-muted text-xs mb-1">Solde Global</p>
          <p className="text-primary font-black text-xl sm:text-2xl leading-tight tracking-tight break-words">{formatCurrency(financialStats.soldeGlobal)}</p>
          <div className="flex items-center gap-1 text-accent text-xs mt-1.5">
            <TrendingUp size={14} />
            <span>+18.4% vs mois dernier</span>
          </div>
        </div>
        <div className="relative overflow-hidden bg-success-bg border border-success/20 rounded-xl p-4">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl bg-success/20" />
          <p className="text-muted text-xs mb-1">Total Revenus</p>
          <p className="text-success font-black text-xl sm:text-2xl leading-tight tracking-tight break-words">{formatCurrency(totalEntrees)}</p>
          <div className="flex items-center gap-1 text-success text-xs mt-1.5">
            <ArrowUpRight size={14} />
            <span>{allTransactions.filter(t => t.type === 'entree').length} transactions</span>
          </div>
        </div>
        <div className="relative overflow-hidden bg-danger-bg border border-danger/20 rounded-xl p-4">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl bg-danger/20" />
          <p className="text-muted text-xs mb-1">Total Dépenses</p>
          <p className="text-danger font-black text-xl sm:text-2xl leading-tight tracking-tight break-words">{formatCurrency(totalSorties)}</p>
          <div className="flex items-center gap-1 text-danger text-xs mt-1.5">
            <ArrowDownRight size={14} />
            <span>{allTransactions.filter(t => t.type === 'sortie').length} transactions</span>
          </div>
        </div>
      </div>

      {/* Caisses par Module */}
      <div>
        <h3 className="text-primary font-semibold text-sm mb-2.5">Caisses par Module</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {displayedModulesSoldes.map(m => {
            const config = moduleConfig[m.module] || defaultModuleConfig;
            const pct = totalEntrees > 0 ? (m.entrees / totalEntrees) * 100 : 0;
            return (
              <div key={m.module} className="bg-surface border border-base rounded-xl overflow-hidden hover:border-accent transition-all">
                <div className={`p-3 bg-gradient-to-r ${config.gradient}`}>
                  <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{config.label}</p>
                  <p className="text-white font-black text-[clamp(1rem,1.45vw,1.25rem)] leading-tight tracking-tight break-words mt-1">{formatCurrency(m.solde)}</p>
                  <p className="text-white/70 text-xs mt-0.5">{pct.toFixed(1)}% du total</p>
                </div>
                <div className="p-2.5 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Entrées</span>
                    <span className="text-success font-semibold text-right">{formatCurrency(m.entrees)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Sorties</span>
                    <span className="text-danger font-semibold text-right">{formatCurrency(m.sorties)}</span>
                  </div>
                  <div className="progress-bar h-1 mt-1.5">
                    <div className={`progress-fill h-full bg-gradient-to-r ${config.gradient}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rapports financiers */}
      <div className="bg-surface border border-base rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-base">
          <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-accent" />
            <h3 className="text-primary font-semibold">Rapports financiers</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'daily', label: 'Journalier' },
              { value: 'weekly', label: 'Hebdomadaire' },
              { value: 'monthly', label: 'Mensuel' },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => setReportPeriod(period.value as 'daily' | 'weekly' | 'monthly')}
                className={`tab px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reportPeriod === period.value ? 'active' : ''}`}
              >
                {period.label}
              </button>
            ))}
            <button
              onClick={handleExportReportPdf}
              disabled={reportPeriod === 'monthly' ? monthlyLoading : periodLoading || !periodDate}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-base text-muted hover:text-primary text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              Exporter PDF
            </button>
          </div>
        </div>

        {reportPeriod === 'monthly' ? (
      <div className="bg-surface border border-base rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-base">
          <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-accent" />
            <h3 className="text-primary font-semibold">CA &amp; Charges par mois et par département</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={monthlyDepartment}
              onChange={(event) => setMonthlyDepartment(event.target.value)}
              className="bg-surface-2 border border-base rounded-lg px-3 py-1.5 text-sm text-primary"
            >
              {financeModules.map((module) => (
                <option key={module} value={module}>{moduleConfig[module].label}</option>
              ))}
            </select>
            <select
              value={monthlyYear}
              onChange={(event) => setMonthlyYear(Number(event.target.value))}
              className="bg-surface-2 border border-base rounded-lg px-3 py-1.5 text-sm text-primary"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={monthlyMonthFilter}
              onChange={(event) => setMonthlyMonthFilter(Number(event.target.value))}
              className="bg-surface-2 border border-base rounded-lg px-3 py-1.5 text-sm text-primary"
            >
              <option value={0}>Tous les mois</option>
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedMonthRow && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4 border-b border-base bg-surface-2/40">
            <div>
              <p className="text-muted text-xs mb-1">CA — {MONTH_LABELS[monthlyMonthFilter - 1]} {monthlyYear}</p>
              <p className="text-success font-bold text-xl">{formatCurrency(selectedMonthRow.ca)}</p>
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Charges — {MONTH_LABELS[monthlyMonthFilter - 1]} {monthlyYear}</p>
              <p className="text-danger font-bold text-xl">{formatCurrency(selectedMonthRow.charges)}</p>
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Solde</p>
              <p className="text-primary font-bold text-xl">{formatCurrency(selectedMonthRow.solde)}</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {monthlyLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-muted text-sm">Chargement…</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-base">
                  <th className="px-6 py-3 font-medium">Mois</th>
                  <th className="px-6 py-3 font-medium text-right">CA</th>
                  <th className="px-6 py-3 font-medium text-right">Charges</th>
                  <th className="px-6 py-3 font-medium text-right">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base">
                {visibleMonthlyRows.map((row) => (
                  <tr key={row.month} className="hover:bg-surface-2">
                    <td className="px-6 py-3 text-primary">{MONTH_LABELS[row.month - 1]}</td>
                    <td className="px-6 py-3 text-right text-success">{formatCurrency(row.ca)}</td>
                    <td className="px-6 py-3 text-right text-danger">{formatCurrency(row.charges)}</td>
                    <td className={`px-6 py-3 text-right font-semibold ${row.solde >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(row.solde)}</td>
                  </tr>
                ))}
              </tbody>
              {visibleMonthlyRows.length > 1 && (
                <tfoot>
                  <tr className="border-t border-base font-semibold">
                    <td className="px-6 py-3 text-primary">Total</td>
                    <td className="px-6 py-3 text-right text-success">{formatCurrency(monthlyTotals.ca)}</td>
                    <td className="px-6 py-3 text-right text-danger">{formatCurrency(monthlyTotals.charges)}</td>
                    <td className={`px-6 py-3 text-right ${monthlyTotals.solde >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(monthlyTotals.solde)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-base">
              <select
                value={monthlyDepartment}
                onChange={(event) => setMonthlyDepartment(event.target.value)}
                className="bg-surface-2 border border-base rounded-lg px-3 py-1.5 text-sm text-primary"
              >
                {financeModules.map((module) => (
                  <option key={module} value={module}>{moduleConfig[module].label}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-muted">
                {reportPeriod === 'daily' ? 'Date' : 'Semaine du'}
                <input
                  type="date"
                  value={periodDate}
                  onChange={(event) => setPeriodDate(event.target.value)}
                  className="bg-surface-2 border border-base rounded-lg px-3 py-1.5 text-sm text-primary"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4 border-b border-base bg-surface-2/40">
              <div>
                <p className="text-muted text-xs mb-1">Chiffre d’affaires</p>
                <p className="text-success font-bold text-xl">{formatCurrency(periodTotals.ca)}</p>
              </div>
              <div>
                <p className="text-muted text-xs mb-1">Charges</p>
                <p className="text-danger font-bold text-xl">{formatCurrency(periodTotals.charges)}</p>
              </div>
              <div>
                <p className="text-muted text-xs mb-1">Solde</p>
                <p className="text-primary font-bold text-xl">{formatCurrency(periodTotals.solde)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              {periodLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="text-muted text-sm">Chargement…</div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-base">
                      <th className="px-6 py-3 font-medium">{reportPeriod === 'daily' ? 'Jour' : 'Semaine'}</th>
                      <th className="px-6 py-3 font-medium text-right">CA</th>
                      <th className="px-6 py-3 font-medium text-right">Charges</th>
                      <th className="px-6 py-3 font-medium text-right">Solde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base">
                    {periodRows.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-muted">Aucune donnée pour cette période</td></tr>
                    ) : periodRows.map((row) => (
                      <tr key={`${row.department}|${row.start_date}`} className="hover:bg-surface-2">
                        <td className="px-6 py-3 text-primary">
                          {reportPeriod === 'daily'
                            ? new Date(`${row.start_date}T12:00:00`).toLocaleDateString('fr-FR')
                            : `${new Date(`${row.start_date}T12:00:00`).toLocaleDateString('fr-FR')} – ${new Date(`${row.end_date}T12:00:00`).toLocaleDateString('fr-FR')}`}
                        </td>
                        <td className="px-6 py-3 text-right text-success">{formatCurrency(row.ca)}</td>
                        <td className="px-6 py-3 text-right text-danger">{formatCurrency(row.charges)}</td>
                        <td className={`px-6 py-3 text-right font-semibold ${row.solde >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(row.solde)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-base rounded-2xl p-6">
          <h3 className="text-primary font-semibold mb-6">Entrées vs Sorties par Module</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#aaaaaa', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#aaaaaa', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k MGA`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="entrees" fill="#4ade80" radius={[3, 3, 0, 0]} name="entrees" />
              <Bar dataKey="sorties" fill="#f87171" radius={[3, 3, 0, 0]} name="sorties" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface border border-base rounded-2xl p-6">
          <h3 className="text-primary font-semibold mb-4">Répartition des Revenus</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [formatCurrency(v), '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {pieData.map(entry => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted">{entry.name}</span>
                </div>
                <span className="text-primary font-medium">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All Transactions */}
      <div className="bg-surface border border-base rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-b border-base">
          <h3 className="text-primary font-semibold">Historique des Transactions</h3>
          <div className="flex flex-wrap gap-2">
            {[{ value: 'all', label: 'Tout' }, ...displayedModulesSoldes.map(m => ({ value: m.module, label: moduleConfig[m.module]?.label || m.module }))].map(f => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={`tab px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeFilter === f.value ? 'active' : ''
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-base max-h-96 overflow-y-auto">
          {allTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                <DollarSign size={32} className="text-muted" />
              </div>
              <p className="text-muted text-sm">Aucune transaction trouvée</p>
              <p className="text-muted text-xs mt-1">Les transactions apparaîtront ici une fois les données disponibles</p>
            </div>
          ) : (
            allTransactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tx.type === 'entree' ? 'bg-success-bg' : 'bg-danger-bg'}`}>
                  {tx.type === 'entree' ? <ArrowUpRight size={18} className="text-success" /> : <ArrowDownRight size={18} className="text-danger" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-primary text-sm font-medium truncate">{tx.description}</p>
                  <p className="text-muted text-xs">
                    <span className="capitalize" style={{ color: moduleConfig[normalizeModuleKey(tx.module)]?.color || moduleConfig.general.color }}>
                      {moduleConfig[normalizeModuleKey(tx.module)]?.label || tx.module || defaultModuleConfig.label}
                    </span>
                    {' • '}{tx.categorie} • {tx.userName} • {formatDate(tx.date)}
                  </p>
                </div>
                <div className={`font-bold whitespace-nowrap ${tx.type === 'entree' ? 'text-success' : 'text-danger'}`}>
                  {tx.type === 'entree' ? '+' : '-'}{formatCurrency(tx.montant)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
    )}
    
    {/* Modals */}
    <CreateInvoiceModal
      isOpen={showCreateInvoiceModal}
      onClose={() => setShowCreateInvoiceModal(false)}
      onSuccess={() => {
        fetchFinancialData();
        setShowCreateInvoiceModal(false);
      }}
    />
    
    <RecordPaymentModal
      isOpen={showRecordPaymentModal}
      onClose={() => setShowRecordPaymentModal(false)}
      onSuccess={() => {
        fetchFinancialData();
        setShowRecordPaymentModal(false);
      }}
    />
    <Modal isOpen={showOperationModal} onClose={() => setShowOperationModal(false)} title="Nouvelle opération de caisse" size="md">
      <form className="space-y-4" onSubmit={handleCreateOperation}>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Type de flux</label>
          <select
            value={operation.type_flux}
            onChange={(event) => setOperation({ ...operation, type_flux: event.target.value as 'ENTREE' | 'SORTIE' })}
            className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm"
          >
            <option value="ENTREE">Entrée</option>
            <option value="SORTIE">Sortie</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Module</label>
          <select
            value={operation.module}
            onChange={(event) => setOperation({ ...operation, module: event.target.value })}
            className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm"
          >
            {financeModules.map((module) => <option key={module} value={module}>{moduleConfig[module].label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Montant (MGA)</label>
          <input type="number" min="1" step="1" required value={operation.montant} onChange={(event) => setOperation({ ...operation, montant: event.target.value })} className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
          <input required value={operation.description} onChange={(event) => setOperation({ ...operation, description: event.target.value })} placeholder="Ex. Achat de fournitures" className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => setShowOperationModal(false)} className="px-4 py-2 rounded-lg border border-base text-sm">Annuler</button>
          <button type="submit" disabled={isSavingOperation} className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-medium disabled:opacity-50">{isSavingOperation ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
    </div>
  );
};
