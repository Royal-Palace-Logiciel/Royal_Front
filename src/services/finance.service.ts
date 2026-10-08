// src/services/finance.service.ts
import api from '../lib/api';

// ==================== TYPES ====================

export interface Invoice {
  id: number;
  client_id: number | null;
  montant_total: number;
  statut: string;
  created_at?: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  montant: number;
}

export interface Payment {
  id: number;
  client_id: number | null;
  invoice_id: number | null;
  montant: number;
  moyen_paiement: string;
  created_at?: string;
}

export interface FinancialTransaction {
  id: number;
  client_id: number | null;
  module: string;
  type_flux: string;
  montant: number;
  moyen_paiement?: string;
  reference_id: number | null;
  ref_flux_global: string | null;
  description: string;
  statut_sync: string;
  synced_at: string | null;
  created_at: string;
  cloturee?: boolean | number;
  cloture_at?: string | null;
  pdj_inclus?: boolean;
  reservation_moyen_paiement?: string;
  reservation_client_nom?: string;
  reservation_client_prenom?: string;
  reservation_room_numero?: string;
}

export interface InvoiceWithDetails extends Invoice {
  items: InvoiceItem[];
  payments: Payment[];
}

export interface ModuleCaisseSolde {
  solde: number;
  entrees: number;
  sorties: number;
}

export interface MonthlyDepartmentReport {
  department: string;
  year: number;
  month: number;
  ca: number;
  charges: number;
  solde: number;
}

export interface PeriodDepartmentReport {
  department: string;
  start_date: string;
  end_date: string;
  ca: number;
  charges: number;
  solde: number;
}

export interface FinancialStats {
  totalEntrees: number;
  totalSorties: number;
  beneficeNet: number;
  totalRevenu: number;
  totalDepenses: number;
  soldeGlobal: number;
  modules: Array<{
    module: string;
    entrees: number;
    sorties: number;
    solde: number;
  }>;
}

export const isFinancialInflow = (typeFlux?: string) =>
  String(typeFlux || '').trim().toUpperCase().startsWith('ENTREE');

export const isFinancialOutflow = (typeFlux?: string) =>
  String(typeFlux || '').trim().toUpperCase().startsWith('SORTIE');

// ==================== API SERVICE ====================

export const financeService = {
  // ==================== INVOICES ====================
  
  async getInvoices(params?: { client_id?: number; statut?: string }): Promise<Invoice[]> {
    try {
      const response = await api.get('/api/finance/invoices', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Erreur getInvoices:', error);
      return [];
    }
  },

  async getInvoiceById(id: number) {
    try {
      const response = await api.get(`/api/finance/invoices/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getInvoiceById:', error);
      return null;
    }
  },

  async getInvoiceDetail(id: number) {
    try {
      const response = await api.get(`/api/finance/invoices/${id}/detail`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getInvoiceDetail:', error);
      return null;
    }
  },

  async createInvoice(data: { client_id: number; items: Array<{ description: string; montant: number }> }) {
    try {
      const response = await api.post('/api/finance/invoices', data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur createInvoice:', error);
      throw error;
    }
  },

  // ==================== PAYMENTS ====================
  
  async getPayments(params?: { client_id?: number; invoice_id?: number }) {
    try {
      const response = await api.get('/api/finance/payments', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Erreur getPayments:', error);
      return [];
    }
  },

  async getPaymentById(id: number) {
    try {
      const response = await api.get(`/api/finance/payments/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getPaymentById:', error);
      return null;
    }
  },

  async recordPayment(data: { client_id: number; invoice_id: number; montant: number; moyen_paiement: string }) {
    try {
      const response = await api.post('/api/finance/payments', data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur recordPayment:', error);
      throw error;
    }
  },

  // ==================== FINANCIAL TRANSACTIONS ====================
  
  async getTransactions(params?: { client_id?: number; module?: string; type_flux?: string; include_closed?: boolean }) {
    // The API paginates at 20 rows by default. Finance needs the complete
    // ledger; otherwise a module total can exist while its history is absent.
    const allTransactions: FinancialTransaction[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await api.get('/api/finance/transactions', {
        params: { ...params, page, limit: 100, sort: 'created_at', order: 'DESC' }
      });
      allTransactions.push(...(response.data.data || []));
      totalPages = Number(response.data.meta?.totalPages || 1);
      page += 1;
    } while (page <= totalPages);

    return allTransactions;
  },

  async getTransactionById(id: number) {
    try {
      const response = await api.get(`/api/finance/transactions/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getTransactionById:', error);
      return null;
    }
  },

  async createTransaction(data: {
    module: string;
    type_flux: 'ENTREE' | 'SORTIE';
    montant: number;
    description: string;
    client_id?: number | null;
    reference_id?: number | null;
  }) {
    const response = await api.post('/api/finance/transactions', data);
    return response.data.data as FinancialTransaction;
  },

  // Clôture de caisse : les transactions sortent de la caisse du jour (restent en historique).
  async closeTransactions(module: string, transactionIds: number[]) {
    const response = await api.post('/api/finance/transactions/close', { module, transaction_ids: transactionIds });
    return response.data.data as { closed_transactions: number };
  },

  // ==================== CLIENT STATEMENTS ====================
  
  async getClientStatement(clientId: number) {
    try {
      const response = await api.get(`/api/finance/clients/${clientId}/statement`);
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Erreur getClientStatement:', error);
      return [];
    }
  },

  // ==================== FINANCIAL STATISTICS ====================
  
  async getFinancialStats(): Promise<FinancialStats> {
    try {
      const response = await api.get('/api/finance/summary');
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur getFinancialStats:', error);
      return {
        totalEntrees: 0,
        totalSorties: 0,
        beneficeNet: 0,
        totalRevenu: 0,
        totalDepenses: 0,
        soldeGlobal: 0,
        modules: []
      };
    }
  },

  // ==================== MODULE CAISSE SOLDE ====================
  
  async getModuleCaisseSolde(module: string): Promise<ModuleCaisseSolde> {
    try {
      const transactions = await this.getTransactions({ module });
      
      const entrees = transactions
        .filter((t: { type_flux: string; }) => isFinancialInflow(t.type_flux))
        .reduce((sum: number, t: { montant: any; }) => sum + Number(t.montant), 0);
      
      const sorties = transactions
        .filter((t: { type_flux: string; }) => isFinancialOutflow(t.type_flux))
        .reduce((sum: number, t: { montant: any; }) => sum + Number(t.montant), 0);
      
      return {
        solde: entrees - sorties,
        entrees,
        sorties
      };
    } catch (error) {
      console.error('❌ Erreur getModuleCaisseSolde:', error);
      return {
        solde: 0,
        entrees: 0,
        sorties: 0
      };
    }
  },

  // ==================== MONTHLY / DEPARTMENT REPORTING ====================

  async getMonthlyDepartmentReport(params?: { department?: string; year?: number }): Promise<MonthlyDepartmentReport[]> {
    try {
      const response = await api.get('/api/finance/reports/monthly', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Erreur getMonthlyDepartmentReport:', error);
      return [];
    }
  },

  async getPeriodDepartmentReport(params: {
    period: 'daily' | 'weekly';
    department?: string;
    startDate: string;
    endDate: string;
  }): Promise<PeriodDepartmentReport[]> {
    try {
      const response = await api.get('/api/finance/reports/period', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Erreur getPeriodDepartmentReport:', error);
      return [];
    }
  },

  // ==================== INVOICE ITEMS ====================
  
  async getInvoiceItems(params?: { invoice_id?: number }) {
    try {
      const response = await api.get('/api/finance/invoice-items', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Erreur getInvoiceItems:', error);
      return [];
    }
  }
};

export default financeService;
