// src/components/Finance/modals/RecordPaymentModal.tsx
import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, CheckCircle2, AlertCircle, Loader, FileText } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { financeService, Invoice, InvoiceWithDetails, Payment } from '../../../services/finance.service';
import { formatCurrency, formatDate } from '../../../utils/data';
import { toast } from 'react-hot-toast';

type MoyenPaiement = 'ESPECES' | 'MOBILE_MONEY' | 'CARTE' | 'VIREMENT' | 'AUTRE';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<InvoiceWithDetails | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<MoyenPaiement>('ESPECES');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const PAYMENT_METHODS: Record<MoyenPaiement, { label: string; icon: React.ReactNode }> = {
    ESPECES: { label: 'Espèces', icon: <DollarSign size={16} /> },
    MOBILE_MONEY: { label: 'Mobile Money', icon: <CreditCard size={16} /> },
    CARTE: { label: 'Carte bancaire', icon: <CreditCard size={16} /> },
    VIREMENT: { label: 'Virement', icon: <CreditCard size={16} /> },
    AUTRE: { label: 'Autre', icon: <CreditCard size={16} /> },
  };

  useEffect(() => {
    if (isOpen) {
      loadInvoices();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedInvoiceId && isOpen) {
      loadInvoiceDetails(selectedInvoiceId);
    } else {
      setSelectedInvoiceDetails(null);
    }
  }, [selectedInvoiceId, isOpen]);

  const resetForm = () => {
    setSelectedInvoiceId(null);
    setSelectedInvoiceDetails(null);
    setPaymentAmount('');
    setPaymentMethod('ESPECES');
    setErrors({});
    setApiError(null);
  };

  const loadInvoices = async () => {
    setIsLoadingInvoices(true);
    try {
      const data = await financeService.getInvoices();
      // Filter for unpaid or partially paid invoices
      const unpaidInvoices = data.filter(inv => inv.statut !== 'PAYEE');
      setInvoices(unpaidInvoices);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors du chargement des factures';
      toast.error(errorMessage);
      setApiError(errorMessage);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const loadInvoiceDetails = async (invoiceId: number) => {
    setIsLoadingDetails(true);
    try {
      const details = await financeService.getInvoiceDetail(invoiceId);
      setSelectedInvoiceDetails(details);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors du chargement des détails de la facture';
      toast.error(errorMessage);
      setApiError(errorMessage);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const calculatePaidAmount = (): number => {
    if (!selectedInvoiceDetails?.payments) return 0;
    return selectedInvoiceDetails.payments.reduce((sum, payment) => sum + Number(payment.montant), 0);
  };

  const calculateRemainingAmount = (): number => {
    if (!selectedInvoiceDetails) return 0;
    return Number(selectedInvoiceDetails.montant_total) - calculatePaidAmount();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!selectedInvoiceId) {
      newErrors.invoice_id = 'Veuillez sélectionner une facture';
    }
    
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      newErrors.montant = 'Le montant doit être supérieur à 0';
    }

    const remaining = calculateRemainingAmount();
    if (amount > remaining) {
      newErrors.montant = `Le montant ne peut pas dépasser le reste à payer (${formatCurrency(remaining)})`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs du formulaire');
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      await financeService.recordPayment({
        client_id: selectedInvoiceDetails!.client_id || 0,
        invoice_id: selectedInvoiceId!,
        montant: Number(paymentAmount),
        moyen_paiement: paymentMethod
      });

      toast.success('Paiement enregistré avec succès');
      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de l\'enregistrement du paiement';
      setApiError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const paidAmount = calculatePaidAmount();
  const remainingAmount = calculateRemainingAmount();
  const totalAmount = selectedInvoiceDetails?.montant_total || 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer un Paiement" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
            <AlertCircle size={16} />
            {apiError}
          </div>
        )}

        {/* Invoice Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <div className="flex items-center gap-2">
              <FileText size={16} />
              Facture
            </div>
          </label>
          {isLoadingInvoices ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={24} className="animate-spin text-muted" />
            </div>
          ) : (
            <div className="space-y-2">
              <select
                value={selectedInvoiceId || ''}
                onChange={(e) => setSelectedInvoiceId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                disabled={isSubmitting}
              >
                <option value="">Sélectionner une facture impayée</option>
                {invoices.map(invoice => (
                  <option key={invoice.id} value={invoice.id}>
                    Facture #{invoice.id} - {formatCurrency(invoice.montant_total)} - {invoice.statut}
                  </option>
                ))}
              </select>
              {errors.invoice_id && (
                <p className="text-red-500 text-xs">{errors.invoice_id}</p>
              )}
              {invoices.length === 0 && !isLoadingInvoices && (
                <p className="text-muted text-xs">Aucune facture impayée disponible</p>
              )}
            </div>
          )}
        </div>

        {/* Invoice Details */}
        {selectedInvoiceDetails && (
          <div className="bg-surface-2 border border-base rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Détails de la facture #{selectedInvoiceDetails.id}</h4>
            
            {/* Items */}
            <div className="space-y-2">
              {selectedInvoiceDetails.items?.map((item, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-muted">{item.description}</span>
                  <span className="text-primary">{formatCurrency(item.montant)}</span>
                </div>
              ))}
            </div>

            {/* Payment Summary */}
            <div className="border-t border-base pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Montant total</span>
                <span className="text-primary font-medium">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Déjà payé</span>
                <span className="text-success font-medium">{formatCurrency(paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Reste à payer</span>
                <span className="text-accent font-bold">{formatCurrency(remainingAmount)}</span>
              </div>
            </div>

            {/* Previous Payments */}
            {selectedInvoiceDetails.payments && selectedInvoiceDetails.payments.length > 0 && (
              <div className="border-t border-base pt-3">
                <p className="text-xs text-muted mb-2">Paiements précédents:</p>
                <div className="space-y-1">
                  {selectedInvoiceDetails.payments.map((payment, index) => (
                    <div key={index} className="flex justify-between text-xs">
                      <span className="text-muted">
                        {payment.moyen_paiement} - {payment.created_at ? formatDate(payment.created_at) : ''}
                      </span>
                      <span className="text-success">{formatCurrency(payment.montant)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Amount */}
        {selectedInvoiceDetails && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center gap-2">
                <DollarSign size={16} />
                Montant du paiement
              </div>
            </label>
            <div className="space-y-2">
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Entrez le montant"
                min="0"
                step="100"
                max={remainingAmount}
                className="w-full bg-surface border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                disabled={isSubmitting}
              />
              {errors.montant && (
                <p className="text-red-500 text-xs">{errors.montant}</p>
              )}
              <button
                type="button"
                onClick={() => setPaymentAmount(remainingAmount.toString())}
                className="text-accent text-xs hover:underline"
              >
                Paiement complet ({formatCurrency(remainingAmount)})
              </button>
            </div>
          </div>
        )}

        {/* Payment Method */}
        {selectedInvoiceDetails && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center gap-2">
                <CreditCard size={16} />
                Moyen de paiement
              </div>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PAYMENT_METHODS).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaymentMethod(key as MoyenPaiement)}
                  disabled={isSubmitting}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                    paymentMethod === key
                      ? 'bg-accent border-accent text-black'
                      : 'bg-surface border-base hover:border-accent'
                  }`}
                >
                  {config.icon}
                  {config.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {selectedInvoiceDetails && (
          <div className="flex gap-3 pt-4 border-t border-base">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 border border-base rounded-lg text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-accent text-black px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Enregistrer le paiement
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default RecordPaymentModal;