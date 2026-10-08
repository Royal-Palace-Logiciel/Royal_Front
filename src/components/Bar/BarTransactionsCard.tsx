import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatDate } from '../../utils/data';
import { ArrowUpRight, RefreshCw, Loader2, AlertCircle, Printer } from 'lucide-react';
import { getBarTransactions } from '../../services/bar.service';
import AuthService from '../../services/authService';
import { escapeHtml, printThermal, thermalHeader } from '../../utils/thermalPrint';

interface Transaction {
  id: number;
  order_id?: number | null;
  table_id?: number | null;
  product_id: number;
  quantite: number;
  prix_unitaire: number;
  created_at: string;
  nom: string;
  categorie: string;
}

interface BarTransactionsCardProps {
  title?: string;
  refreshTrigger?: number;
}

export default function BarTransactionsCard({ title = 'Transactions Caisse', refreshTrigger = 0 }: BarTransactionsCardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getBarTransactions();
      const data = (response as any).data ?? response;
      setTransactions(data as Transaction[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshTrigger]);

  const totalVentes = transactions.reduce((sum, tx) => sum + (tx.quantite * tx.prix_unitaire), 0);
  const totalQuantite = transactions.reduce((sum, tx) => sum + tx.quantite, 0);

  const handlePrintTransaction = (transaction: Transaction) => {
    const connectedCashier = [AuthService.getCurrentUser()?.prenom, AuthService.getCurrentUser()?.nom].filter(Boolean).join(' ') || AuthService.getCurrentUser()?.email || 'Utilisateur connecté';
    const transactionDate = transaction.created_at ? new Date(transaction.created_at).toLocaleString('fr-FR') : '-';
    const transactionTotal = transaction.quantite * transaction.prix_unitaire;

    const report = `${thermalHeader('Reçu de Transaction Bar', [`Transaction #${transaction.id}`])}<p>Produit : ${escapeHtml(transaction.nom)}<br>Catégorie : ${escapeHtml(transaction.categorie)}<br>Quantité : ${transaction.quantite}<br>Prix unitaire : ${escapeHtml(formatCurrency(transaction.prix_unitaire))}<br>Date : ${escapeHtml(transactionDate)}<br>Caissier : ${escapeHtml(connectedCashier)}${transaction.order_id ? `<br>Commande #${transaction.order_id}` : ''}${transaction.table_id ? `<br>Table ${transaction.table_id}` : ''}</p><div class="row total"><span>TOTAL</span><span>${escapeHtml(formatCurrency(transactionTotal))}</span></div>`;
    printThermal('Reçu Transaction Bar', report);
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800/50 rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-400 mr-2" size={20} />
        <span className="text-slate-400 text-sm">Chargement des transactions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-sm flex items-center gap-2">
        <AlertCircle size={16} className="text-red-400" />
        <span className="text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800/50 rounded-xl p-4">
          <p className="text-slate-500 text-xs font-medium mb-1">Total Ventes</p>
          <p className="text-amber-400 font-bold text-lg">{formatCurrency(totalVentes)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800/50 rounded-xl p-4">
          <p className="text-slate-500 text-xs font-medium mb-1">Transactions</p>
          <p className="text-white font-bold text-lg">{transactions.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800/50 rounded-xl p-4">
          <p className="text-slate-500 text-xs font-medium mb-1">Qt&eacute; Totale</p>
          <p className="text-emerald-400 font-bold text-lg">{totalQuantite}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800/50 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
          <h3 className="text-white font-semibold flex items-center gap-2">
            {title}
          </h3>
          <button
            onClick={fetchTransactions}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="divide-y divide-slate-800/30 max-h-[500px] overflow-y-auto">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-600">Aucune transaction</div>
          ) : transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/20 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <ArrowUpRight size={18} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{tx.nom}</p>
                <p className="text-slate-500 text-xs">{tx.categorie}{tx.order_id ? ` • Commande #${tx.order_id}` : ''}{tx.table_id ? ` • Table ${tx.table_id}` : ''} • {formatDate(tx.created_at)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white text-sm font-semibold">x{tx.quantite}</p>
                <p className="text-amber-400 text-sm font-bold">{formatCurrency(tx.quantite * tx.prix_unitaire)}</p>
              </div>
              <button
                onClick={() => handlePrintTransaction(tx)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all flex-shrink-0"
                title="Imprimer la transaction"
              >
                <Printer size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}