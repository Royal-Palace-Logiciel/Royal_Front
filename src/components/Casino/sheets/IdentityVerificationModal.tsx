import React, { useState, useEffect } from 'react';
import { casinoBorder, casinoCurrency, casinoInput, IDENTITY_VERIFICATION_THRESHOLD, IdentityVerificationData } from './types';

interface IdentityVerificationModalProps {
  open: boolean;
  amount: number;
  transactionType: 'achat' | 'apport' | 'echange';
  onClose: () => void;
  onConfirm: (data: IdentityVerificationData) => Promise<void> | void;
  isLoading?: boolean;
}

const ID_TYPES = ['CIN', 'Passeport', 'Permis de conduire', 'Carte d\'identité nationale'];

export const IdentityVerificationModal: React.FC<IdentityVerificationModalProps> = ({ open, amount, transactionType, onClose, onConfirm, isLoading = false }) => {
  const [fullName, setFullName] = useState('');
  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [idNumber, setIdNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [selectedTransactionType, setSelectedTransactionType] = useState(transactionType);

  useEffect(() => {
    if (open) {
      setFullName('');
      setIdNumber('');
      setIssueDate('');
      setIsSubmitting(false);
      setValidationMessage('');
      setSelectedTransactionType(transactionType);
    }
  }, [open, transactionType]);

  if (!open) return null;

  const handleConfirm = async () => {
    const missingFields = [
      !fullName.trim() && 'le nom complet',
      !idNumber.trim() && 'le numéro de pièce',
      !issueDate.trim() && "la date d'émission",
    ].filter(Boolean);
    if (missingFields.length) {
      setValidationMessage(`Veuillez renseigner ${missingFields.join(', ')}.`);
      return;
    }
    setValidationMessage('');
    setIsSubmitting(true);
    try {
      await onConfirm({
        fullName: fullName.trim(),
        idType,
        idNumber: idNumber.trim(),
        issueDate,
        transactionType: selectedTransactionType,
        amount,
        verifiedAt: new Date().toISOString(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden" role="dialog" aria-modal="true" aria-label="Vérification d'identité">
      <div className="w-full max-w-lg rounded-2xl border p-5 text-white shadow-2xl" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">Vérification d'identité</p>
            <p className="text-sm text-muted">Transaction supérieure ou égale à {casinoCurrency.format(IDENTITY_VERIFICATION_THRESHOLD)} Ar</p>
          </div>
          <button type="button" className="text-xl leading-none" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        <div className="mb-4 rounded-lg bg-yellow-500/15 p-3 text-center">
          <p className="text-sm text-yellow-300">
            Montant : <span className="font-bold">{casinoCurrency.format(amount)} Ar</span>
          </p>
          <p className="text-xs text-yellow-200 mt-1">Type : {selectedTransactionType.toUpperCase()}</p>
          <select className="mt-2 rounded border bg-transparent px-2 py-1 text-xs" value={selectedTransactionType} onChange={(event) => setSelectedTransactionType(event.target.value as IdentityVerificationData['transactionType'])}>
            <option value="achat">Achat</option>
            <option value="apport">Apport</option>
            <option value="echange">Échange</option>
          </select>
        </div>

        <div className="grid gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-muted">Nom complet</span>
            <input className={casinoInput} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nom et prénom" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted">Type de pièce d'identité</span>
            <select className={casinoInput} value={idType} onChange={(event) => setIdType(event.target.value)} style={{ color: '#fff', backgroundColor: 'var(--color-surface)' }}>
              {ID_TYPES.map((type) => <option key={type} value={type} style={{ color: '#fff', backgroundColor: 'var(--color-surface)' }}>{type}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted">Numéro de pièce d'identité</span>
            <input className={casinoInput} value={idNumber} onChange={(event) => setIdNumber(event.target.value)} placeholder="N° de la pièce" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted">Date d'émission</span>
            <input type="date" className={casinoInput} value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          </label>
        </div>
        {validationMessage && <p className="mt-3 text-sm text-red-300" role="alert">{validationMessage}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="action secondary" onClick={onClose} disabled={isSubmitting}>Annuler</button>
          <button type="button" className="action" onClick={handleConfirm} disabled={isSubmitting || isLoading}>{isSubmitting || isLoading ? 'Enregistrement...' : 'Confirmer la vérification'}</button>
        </div>
      </div>
    </div>
  );
};
