import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, Printer, Save } from 'lucide-react';
import { formatCurrency } from '../../utils/data';
import { printThermalText } from '../../utils/thermalPrint';
import * as restaurantService from '../../services/restaurantService';
import type { Order } from './types';

type ReportStock = { quantite: number; unite?: string };

type Props = { orders: Order[]; stock: ReportStock[] };

const personnelFields = [['gerante', 'Gérante'], ['hotesse', 'Hôtesses'], ['cuisine', 'Cuisine'], ['accueil', 'Accueil'], ['securite', 'Sécurité']] as const;

export const RestaurantReports: React.FC<Props> = ({ orders, stock }) => {
  const ventes = orders.filter((order) => ['PAYE', 'PAYEE'].includes(order.statut));
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [personnel, setPersonnel] = useState({ gerante: 'Mme Malala', hotesse: '', cuisine: '', accueil: '', securite: '' });
  const [manual, setManual] = useState({ gratuit: '', depense: '', bouteille: '', pourboire: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedReportText, setSavedReportText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoadingReport(true);
    setSaveMessage(null);
    void restaurantService.getRestaurantDailyReport(reportDate)
      .then((saved) => {
        if (!active || !saved) return;
        setPersonnel((current) => ({ ...current, ...(saved.personnel || {}) }));
        setManual((current) => ({ ...current, ...(saved.manual || {}) }));
      })
      .catch((error) => console.error('Erreur chargement rapport restaurant:', error))
      .finally(() => { if (active) setIsLoadingReport(false); });
    return () => { active = false; };
  }, [reportDate]);

  const metrics = useMemo(() => {
    const ordersForDate = orders.filter((order) => String(order.created_at || '').slice(0, 10) === reportDate);
    const ventesForDate = ordersForDate.filter((order) => ['PAYE', 'PAYEE'].includes(order.statut));
    const amountByPayment = (method: string) => ventesForDate
      .filter((order) => String(order.moyen_paiement || 'ESPECES').toUpperCase() === method)
      .reduce((sum, order) => sum + Number(order.montant_total || 0), 0);
    const freeOrders = ordersForDate.filter((order) => String(order.moyen_paiement || '').toUpperCase() === 'GRATUIT');
    const unpaidOrders = ordersForDate.filter((order) => !['PAYE', 'PAYEE'].includes(order.statut));
    return {
      c1: amountByPayment('ESPECES'),
      mvola: amountByPayment('MVOLA'),
      tpe: amountByPayment('TPE'),
      gratuit: freeOrders.reduce((sum, order) => sum + Number(order.montant_total || 0), 0),
      tableOccupee: new Set(ventesForDate.map((order) => order.table_id).filter((table) => Number(table) > 0)).size,
      np: unpaidOrders.reduce((sum, order) => sum + Number(order.montant_total || 0), 0),
      credit: amountByPayment('CREDIT'),
      bouteilles: ordersForDate.length === 0 ? 0 : stock.filter((item) => /bouteille/i.test(item.unite || '')).reduce((sum, item) => sum + Number(item.quantite || 0), 0),
    };
  }, [orders, reportDate, stock]);

  const buildReportText = () => [
    'RAPPORT JOURNALIER - RESTAURANT',
    `Date : ${new Date(`${reportDate}T00:00:00`).toLocaleDateString('fr-FR')}`,
    '', 'PERSONNEL PRESENT',
    `Gerante : ${personnel.gerante || '-'}`, `Hotesse : ${personnel.hotesse || '-'}`, `Cuisine : ${personnel.cuisine || '-'}`, `Accueil : ${personnel.accueil || '-'}`, `Securite : ${personnel.securite || '-'}`,
    '', 'INDICATEURS DE LA JOURNEE',
    `C1 : ${formatCurrency(metrics.c1)}`, `Mvola : ${formatCurrency(metrics.mvola)}`, `TPE : ${formatCurrency(metrics.tpe)}`, `Gratuit : ${manual.gratuit || formatCurrency(metrics.gratuit)}`, `Tables occupees : ${metrics.tableOccupee}`, `NP : ${formatCurrency(metrics.np)}`, `Credit : ${formatCurrency(metrics.credit)}`, `Bouteilles : ${manual.bouteille || metrics.bouteilles}`, `Depense : ${manual.depense || '0'}`, `Pourboire : ${manual.pourboire || '0'}`,
  ].join('\n');

  const saveReport = async () => {
    setIsSaving(true); setSaveMessage(null);
    try {
      await restaurantService.saveRestaurantDailyReport({ reportDate, personnel, manual, metrics });
      setSavedReportText(buildReportText()); setCopied(false); setSaveMessage('Rapport enregistré dans la base de données.');
    } catch (error) { console.error('Erreur enregistrement rapport restaurant:', error); setSaveMessage('Impossible d’enregistrer le rapport.'); }
    finally { setIsSaving(false); }
  };

  const updatePersonnel = (key: keyof typeof personnel, value: string) => setPersonnel((current) => ({ ...current, [key]: value }));
  const updateManual = (key: keyof typeof manual, value: string) => setManual((current) => ({ ...current, [key]: value }));

  return (
    <section className="space-y-4">
      <div className="print:hidden"><p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold">Restaurant</p><h2 className="text-2xl font-bold text-primary">Rapports</h2></div>
      <div className="space-y-5 rounded-xl border border-base bg-surface p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="text-lg font-semibold text-primary">Rapport journalier — Restaurant</h3><p className="text-xs text-muted">Personnel, caisse et activités de la journée.</p></div><input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary" /></div>
        <div><h4 className="mb-3 font-semibold text-primary">Personnel présent</h4><div className="grid gap-3 md:grid-cols-2">{personnelFields.map(([key, label]) => <label key={key} className="text-xs text-secondary"><span className="mb-1 block font-semibold">{label}</span><input value={personnel[key]} onChange={(event) => updatePersonnel(key, event.target.value)} placeholder="Noms séparés par des virgules" className="w-full rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent" /></label>)}</div></div>
        <div><h4 className="mb-3 font-semibold text-primary">Indicateurs de la journée</h4><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([['C1', metrics.c1], ['Mvola', metrics.mvola], ['TPE', metrics.tpe], ['Gratuit', metrics.gratuit], ['Tables occupées', metrics.tableOccupee], ['NP', metrics.np], ['Crédit', metrics.credit], ['Bouteilles', metrics.bouteilles]] as const).map(([label, value]) => <div key={label} className="rounded-lg border border-base bg-surface-2 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-lg font-semibold text-accent">{typeof value === 'number' && label !== 'Tables occupées' && label !== 'Bouteilles' ? formatCurrency(value) : value}</p></div>)}{([['Dépense', 'depense'], ['Bouteille ajoutée', 'bouteille'], ['Pourboire', 'pourboire'], ['Gratuit détaillé', 'gratuit']] as const).map(([label, key]) => <label key={key} className="text-xs text-secondary"><span className="mb-1 block font-semibold">{label}</span><input value={manual[key]} onChange={(event) => updateManual(key, event.target.value)} placeholder="Montant ou détail" className="w-full rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent" /></label>)}</div></div>
        {saveMessage && <p className={`text-sm ${saveMessage.startsWith('Rapport') ? 'text-emerald-400' : 'text-red-400'}`}>{saveMessage}</p>}
        <div className="flex flex-col gap-3 border-t border-base pt-4 print:hidden sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-primary">Actions du rapport</p><p className="text-xs text-muted">Enregistrez vos modifications ou préparez une version papier.</p></div><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => void saveReport()} disabled={isSaving || isLoadingReport} aria-label="Enregistrer le rapport Restaurant" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5 hover:shadow-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"><Save size={17} aria-hidden="true" /> {isSaving ? 'Enregistrement en cours…' : 'Enregistrer le rapport'}</button><button type="button" onClick={() => printThermalText('Rapport Restaurant', buildReportText())} aria-label="Imprimer le rapport Restaurant" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-base bg-surface-2 px-4 py-2.5 text-sm font-semibold text-primary transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"><Printer size={17} aria-hidden="true" /> Imprimer le rapport</button></div></div>
        {savedReportText && <div className="space-y-2 print:hidden"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-primary">Rapport texte copiable</h4><button type="button" className="action secondary" onClick={() => void navigator.clipboard.writeText(savedReportText).then(() => setCopied(true))}><Clipboard size={15} /> {copied ? 'Copié' : 'Copier'}</button></div><textarea readOnly value={savedReportText} aria-label="Rapport Restaurant généré" className="min-h-[420px] w-full resize-y rounded-xl border border-base bg-surface-2 p-4 text-sm leading-6 text-primary outline-none" /></div>}
      </div>
    </section>
  );
};
