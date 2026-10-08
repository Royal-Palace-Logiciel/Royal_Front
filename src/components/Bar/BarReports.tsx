import React, { useEffect, useMemo, useState } from 'react';
import type { BarCommande, BarStockItem } from '../../types/bar.type';
import { formatCurrency } from '../../utils/data';
import { printThermalText } from '../../utils/thermalPrint';
import { Clipboard, Printer, Save } from 'lucide-react';
import barService from '../../services/bar.service';

interface Props {
  commandes: BarCommande[];
  stock: BarStockItem[];
}

const defaultPersonnel = {
  gerante: 'Mme Malala',
  hotesse: '',
  cuisine: '',
  accueil: '',
  securite: '',
};

const defaultManual = { gratuit: '', depense: '', bouteille: '', pourboire: '' };

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameDay = (dateStr?: string, targetDate?: string) => {
  if (!dateStr || !targetDate) return false;
  if (dateStr.slice(0, 10) === targetDate) return true;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` === targetDate;
};

export const BarReports: React.FC<Props> = ({ commandes, stock }) => {
  const [reportDate, setReportDate] = useState(getTodayDateString);
  const commandesDuJour = useMemo(() => commandes.filter((commande) => {
    return isSameDay(commande.created_at, reportDate);
  }), [commandes, reportDate]);
  const ventes = commandesDuJour.filter((commande) => commande.statut === 'Encaissée');
  const chiffreAffaires = ventes.reduce((total, commande) => total + commande.total, 0);
  const articlesVendus = ventes.reduce((total, commande) => total + commande.items.reduce((sum, item) => sum + item.quantite, 0), 0);
  const [personnel, setPersonnel] = useState(defaultPersonnel);
  const [manual, setManual] = useState(defaultManual);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedReportText, setSavedReportText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setPersonnel(defaultPersonnel);
    setManual(defaultManual);
    setSavedReportText('');
    setCopied(false);
    setIsLoadingReport(true);
    setSaveMessage(null);
    void barService.getBarDailyReport(reportDate)
      .then((saved) => {
        if (!active || !saved || !('personnel' in saved)) return;
        setPersonnel((current) => ({ ...current, ...(saved.personnel || {}) }));
        setManual((current) => ({ ...current, ...(saved.manual || {}) }));
      })
      .catch((error) => console.error('Erreur chargement rapport bar:', error))
      .finally(() => {
        if (active) setIsLoadingReport(false);
      });
    return () => { active = false; };
  }, [reportDate]);

  const metrics = useMemo(() => {
    const ordersForDate = commandesDuJour;
    const ventesForDate = ordersForDate.filter((order) => order.statut === 'Encaissée');
    const amountByPayment = (method: string) => ventesForDate
      .filter((order) => String(order.moyen_paiement || 'ESPECES').toUpperCase() === method)
      .reduce((sum, order) => sum + order.total, 0);

    const isFreeOrder = (order: BarCommande) => {
      const payment = String(order.moyen_paiement || '').trim().toUpperCase();
      const obs = String(order.observation || '').trim().toUpperCase();
      return (
        payment === 'GRATUIT' ||
        obs === 'GRATUIT' ||
        obs === 'POCKER' ||
        obs === 'POKER' ||
        obs === 'POCKER GRATUIT' ||
        obs === 'POKER GRATUIT' ||
        (Number(order.table) === 0 && payment === 'GRATUIT')
      );
    };

    const freeOrders = ordersForDate.filter(isFreeOrder);
    const gratuitDetails = freeOrders.map((order) => {
      const clientName = order.client?.trim() || 'Client anonyme';
      const obs = order.observation?.trim().toUpperCase();
      const isPoker = obs === 'POCKER' || obs === 'POKER' || obs === 'POCKER GRATUIT' || obs === 'POKER GRATUIT';
      const tag = isPoker ? ' (Poker)' : '';
      return {
        name: `${clientName}${tag}`,
        total: Number(order.total || 0),
      };
    });

    const unpaidOrders = ordersForDate.filter((order) => String(order.statut).toLowerCase() !== 'encaissée');
    return {
      c1: amountByPayment('ESPECES'),
      mvola: amountByPayment('MVOLA'),
      tpe: amountByPayment('TPE'),
      gratuit: freeOrders.reduce((sum, order) => sum + order.total, 0),
      gratuitDetails,
      tableOccupee: new Set(ventesForDate.map((order) => order.table).filter((table) => Number(table) > 0)).size,
      np: unpaidOrders.reduce((sum, order) => sum + order.total, 0),
      credit: amountByPayment('CREDIT'),
      bouteilles: ordersForDate.length === 0 ? 0 : stock.filter((item) => /bouteille/i.test(item.unite || '')).reduce((sum, item) => sum + item.quantite, 0),
    };
  }, [commandesDuJour, stock]);

  const saveReport = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await barService.saveBarDailyReport({ reportDate, personnel, manual, metrics });
      setSavedReportText(buildReportText());
      setCopied(false);
      setSaveMessage('Rapport enregistré dans la base de données.');
    } catch (error) {
      console.error('Erreur enregistrement rapport bar:', error);
      setSaveMessage('Impossible d’enregistrer le rapport.');
    } finally {
      setIsSaving(false);
    }
  };

  const buildReportText = () => [
    'RAPPORT JOURNALIER - LE POINT D\'EXCLAMATION BAR',
    `Date : ${new Date(`${reportDate}T00:00:00`).toLocaleDateString('fr-FR')}`,
    '',
    'PERSONNEL PRESENT',
    `Gerante : ${personnel.gerante || '-'}`,
    `Hotesse : ${personnel.hotesse || '-'}`,
    `Cuisine : ${personnel.cuisine || '-'}`,
    `Accueil : ${personnel.accueil || '-'}`,
    `Securite : ${personnel.securite || '-'}`,
    '',
    'INDICATEURS DE LA JOURNEE',
    `C1 : ${formatCurrency(metrics.c1)}`,
    `Mvola : ${formatCurrency(metrics.mvola)}`,
    `TPE : ${formatCurrency(metrics.tpe)}`,
    `Gratuit : ${manual.gratuit || formatCurrency(metrics.gratuit)}`,
    '',
    'DETAIL DES COMMANDES GRATUITES',
    ...((metrics.gratuitDetails && metrics.gratuitDetails.length)
      ? metrics.gratuitDetails.map((order, index) => `${index + 1} - ${order.name}  : ${formatCurrency(order.total)}`)
      : ['Aucune commande gratuite']),
    `Tables occupees : ${metrics.tableOccupee}`,
    `NP : ${formatCurrency(metrics.np)}`,
    `Credit : ${formatCurrency(metrics.credit)}`,
    `Bouteilles : ${manual.bouteille || metrics.bouteilles}`,
    `Depense : ${manual.depense || '0'}`,
    `Pourboire : ${manual.pourboire || '0'}`,
  ].join('\n');

  const copyReport = async () => {
    if (!savedReportText) return;
    await navigator.clipboard.writeText(savedReportText);
    setCopied(true);
  };

  const printReport = () => printThermalText('Rapport Bar', buildReportText());
  const updatePersonnel = (key: keyof typeof personnel, value: string) => setPersonnel((current) => ({ ...current, [key]: value }));
  const updateManual = (key: keyof typeof manual, value: string) => setManual((current) => ({ ...current, [key]: value }));
  const statuses: Array<{ label: string; value: BarCommande['statut'] }> = [
    { label: 'En attente', value: 'En attente' },
    { label: 'En cours', value: 'En préparation' },
    { label: 'Prête', value: 'Prête' },
    { label: 'Servie', value: 'Servie' },
    { label: 'Encaissée', value: 'Encaissée' },
  ];

  return (
    <section className="space-y-4">
      <div className="print:hidden">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-semibold">Bar & Lounge</p>
        <h2 className="text-2xl font-bold text-primary">Rapports</h2>
      </div>
      <div className="space-y-5 rounded-xl border border-base bg-surface p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h3 className="text-lg font-semibold text-primary">Rapport journalier — Le point d’exclamation bar</h3><p className="text-xs text-muted">Personnel, caisse et activités de la journée.</p></div>
          <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary" />
        </div>
        <div><h4 className="mb-3 font-semibold text-primary">Personnel présent</h4><div className="grid gap-3 md:grid-cols-2">
          {([['gerante', 'Gérante'], ['hotesse', 'Hôtesses'], ['cuisine', 'Cuisine'], ['accueil', 'Accueil'], ['securite', 'Sécurité']] as const).map(([key, label]) => <label key={key} className="text-xs text-secondary"><span className="mb-1 block font-semibold">{label}</span><input value={personnel[key]} onChange={(event) => updatePersonnel(key, event.target.value)} placeholder="Noms séparés par des virgules" className="w-full rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent" /></label>)}
        </div></div>
        <div><h4 className="mb-3 font-semibold text-primary">Indicateurs de la journée</h4><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([['C1', metrics.c1], ['Mvola', metrics.mvola], ['TPE', metrics.tpe], ['Gratuit', metrics.gratuit], ['Tables occupées', metrics.tableOccupee], ['NP', metrics.np], ['Crédit', metrics.credit], ['Bouteilles', metrics.bouteilles]] as const).map(([label, value]) => <div key={label} className="rounded-lg border border-base bg-surface-2 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-lg font-semibold text-accent">{typeof value === 'number' && label !== 'Tables occupées' && label !== 'Bouteilles' ? formatCurrency(value) : value}</p></div>)}
          {([['Dépense', 'depense'], ['Bouteille ajoutée', 'bouteille'], ['Pourboire', 'pourboire'], ['Gratuit détaillé', 'gratuit']] as const).map(([label, key]) => <label key={key} className="text-xs text-secondary"><span className="mb-1 block font-semibold">{label}</span><input value={manual[key]} onChange={(event) => updateManual(key, event.target.value)} placeholder="Montant ou détail" className="w-full rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent" /></label>)}
        </div></div>
        <div className="rounded-lg border border-base bg-surface-2 p-4">
          <h4 className="mb-3 font-semibold text-primary">Détail des commandes gratuites</h4>
          {metrics.gratuitDetails && metrics.gratuitDetails.length > 0 ? <div className="space-y-2">{metrics.gratuitDetails.map((order, index) => <div key={`${order.name}-${index}`} className="flex items-center justify-between gap-3 border-b border-base/60 pb-2 text-sm"><span className="text-secondary">{order.name}</span><strong className="text-accent">{formatCurrency(order.total)}</strong></div>)}</div> : <p className="text-sm text-muted">Aucune commande gratuite.</p>}
        </div>
        {saveMessage && <p className={`text-sm ${saveMessage.startsWith('Rapport') ? 'text-emerald-400' : 'text-red-400'}`}>{saveMessage}</p>}
        <div className="flex justify-end gap-2 print:hidden"><button type="button" onClick={() => void saveReport()} disabled={isSaving || isLoadingReport} className="action secondary"><Save size={15} /> {isSaving ? 'Enregistrement...' : 'Enregistrer le rapport'}</button><button type="button" onClick={printReport} className="action"><Printer size={15} /> Imprimer</button></div>
        {savedReportText && <div className="space-y-2 print:hidden"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-primary">Rapport texte copiable</h4><button type="button" className="action secondary" onClick={() => void copyReport()}><Clipboard size={15} /> {copied ? 'Copié' : 'Copier'}</button></div><textarea readOnly value={savedReportText} aria-label="Rapport Bar généré" className="min-h-[420px] w-full resize-y rounded-xl border border-base bg-surface-2 p-4 text-sm leading-6 text-primary outline-none" /></div>}
        <div className="hidden print:block text-sm text-black"><h3 className="text-xl font-bold">Le point d’exclamation bar — {new Date(reportDate).toLocaleDateString('fr-FR')}</h3><p className="mt-3"><strong>Gérante :</strong> {personnel.gerante || '—'}</p><p><strong>Hôtesse :</strong> {personnel.hotesse || '—'}</p><p><strong>Cuisine :</strong> {personnel.cuisine || '—'}</p><p><strong>Accueil :</strong> {personnel.accueil || '—'}</p><p><strong>Sécurité :</strong> {personnel.securite || '—'}</p><hr className="my-3" /><p>C1 : {formatCurrency(metrics.c1)}</p><p>Mvola : {formatCurrency(metrics.mvola)}</p><p>TPE : {formatCurrency(metrics.tpe)}</p><p>Gratuit : {manual.gratuit || formatCurrency(metrics.gratuit)}</p><p><strong>Détail gratuit :</strong></p>{(metrics.gratuitDetails || []).map((order, index) => <p key={`${order.name}-print-${index}`}>{order.name} : {formatCurrency(order.total)}</p>)}<p>Table occupée : {metrics.tableOccupee}</p><p>NP : {formatCurrency(metrics.np)}</p><p>Crédit : {formatCurrency(metrics.credit)}</p><p>Dépense : {manual.depense || '0'}</p><p>Bouteille : {manual.bouteille || metrics.bouteilles}</p><p>Pourboire : {manual.pourboire || '0'}</p></div>
      </div>
    </section>
  );
};
