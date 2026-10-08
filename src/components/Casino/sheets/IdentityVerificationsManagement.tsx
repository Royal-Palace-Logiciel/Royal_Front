import React, { useState } from 'react';
import { Trash2, Edit2, Plus } from 'lucide-react';
import { casinoBorder, casinoCurrency } from './types';
import { identityVerificationApi } from '../../../services/casinoTablesJeu.service';

interface IdentityVerification {
  id?: number;
  full_name: string;
  id_type: string;
  id_number: string;
  issue_date: string;
  transaction_type: string;
  amount: number;
  verified_at: string;
  fiche_id?: number;
}

interface IdentityVerificationsManagementProps {
  verifications: Array<IdentityVerification & { fiche_id?: number }>;
  onUpdate: (updatedVerifications: Array<IdentityVerification & { fiche_id?: number }>) => void;
}

export const IdentityVerificationsManagement: React.FC<IdentityVerificationsManagementProps> = ({
  verifications,
  onUpdate,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<IdentityVerification | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = (verification: IdentityVerification) => {
    setEditingId(verification.id ?? null);
    setEditData({ ...verification });
  };

  const handleSaveEdit = async () => {
    if (!editData || !editingId) return;
    setIsLoading(true);
    try {
      await identityVerificationApi.update(editingId, {
        full_name: editData.full_name,
        id_type: editData.id_type,
        id_number: editData.id_number,
        issue_date: editData.issue_date,
        transaction_type: editData.transaction_type as 'ACHAT' | 'APPORT' | 'ECHANGE',
        amount: editData.amount,
      });
      onUpdate(
        verifications.map((v) =>
          v.id === editingId ? { ...v, ...editData } : v
        )
      );
      setEditingId(null);
      setEditData(null);
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      alert('Erreur lors de la mise à jour de la vérification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsLoading(true);
    try {
      await identityVerificationApi.remove(id);
      onUpdate(verifications.filter((v) => v.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      alert('Erreur lors de la suppression de la vérification');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border p-4" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-primary text-lg font-bold">Gestion des vérifications d'identité</h3>
        <span className="text-muted text-xs bg-yellow-500/20 rounded px-2 py-1">
          {verifications.length} vérification{verifications.length !== 1 ? 's' : ''}
        </span>
      </div>

      {verifications.length === 0 ? (
        <p className="text-muted text-center text-xs py-4">Aucune vérification d'identité enregistrée</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg)' }}>
                <th className="border p-2 text-left text-secondary" style={casinoBorder}>Joueur</th>
                <th className="border p-2 text-left text-secondary" style={casinoBorder}>Nom</th>
                <th className="border p-2 text-left text-secondary" style={casinoBorder}>Pièce</th>
                <th className="border p-2 text-left text-secondary" style={casinoBorder}>Type</th>
                <th className="border p-2 text-right text-secondary" style={casinoBorder}>Montant</th>
                <th className="border p-2 text-center text-secondary" style={casinoBorder}>Vérifié</th>
                <th className="border p-2 text-center text-secondary" style={casinoBorder}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {verifications.map((verification) => (
                <tr key={verification.id} style={{ backgroundColor: 'var(--color-surface)' }}>
                  <td className="border p-2 text-primary border-b" style={casinoBorder}>
                    Fiche {verification.fiche_id}
                  </td>
                  <td className="border p-2 text-primary border-b" style={casinoBorder}>
                    {verification.full_name}
                  </td>
                  <td className="border p-2 text-primary border-b" style={casinoBorder}>
                    {verification.id_type} n° {verification.id_number}
                  </td>
                  <td className="border p-2 text-yellow-300 border-b font-semibold" style={casinoBorder}>
                    {verification.transaction_type}
                  </td>
                  <td className="border p-2 text-primary text-right border-b" style={casinoBorder}>
                    {casinoCurrency.format(verification.amount)} Ar
                  </td>
                  <td className="border p-2 text-secondary text-center border-b text-[10px]" style={casinoBorder}>
                    {new Date(verification.verified_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="border p-2 text-center border-b" style={casinoBorder}>
                    <button
                      type="button"
                      onClick={() => handleEdit(verification)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Éditer"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(verification.id ?? null)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-red-400 hover:text-red-300 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="w-full max-w-lg rounded-2xl border p-5 text-white shadow-2xl" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
            <h3 className="mb-4 text-lg font-bold">Éditer la vérification</h3>

            <div className="grid gap-3 text-xs mb-4">
              <label className="flex flex-col gap-1">
                <span className="text-muted">Nom complet</span>
                <input
                  type="text"
                  value={editData.full_name}
                  onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                  className="w-full bg-transparent px-2 py-2 text-xs text-primary outline-none border-b border-gray-600"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted">Type de pièce</span>
                <input
                  type="text"
                  value={editData.id_type}
                  onChange={(e) => setEditData({ ...editData, id_type: e.target.value })}
                  className="w-full bg-transparent px-2 py-2 text-xs text-primary outline-none border-b border-gray-600"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted">Numéro de pièce</span>
                <input
                  type="text"
                  value={editData.id_number}
                  onChange={(e) => setEditData({ ...editData, id_number: e.target.value })}
                  className="w-full bg-transparent px-2 py-2 text-xs text-primary outline-none border-b border-gray-600"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted">Date d'émission</span>
                <input
                  type="date"
                  value={editData.issue_date}
                  onChange={(e) => setEditData({ ...editData, issue_date: e.target.value })}
                  className="w-full bg-transparent px-2 py-2 text-xs text-primary outline-none border-b border-gray-600"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted">Montant</span>
                <input
                  type="number"
                  value={editData.amount}
                  onChange={(e) => setEditData({ ...editData, amount: Number(e.target.value) })}
                  className="w-full bg-transparent px-2 py-2 text-xs text-primary outline-none border-b border-gray-600"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setEditingId(null); setEditData(null); }}
                className="action secondary"
                disabled={isLoading}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="action"
                disabled={isLoading}
              >
                {isLoading ? 'Mise à jour...' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="w-full max-w-sm rounded-2xl border p-5 text-white shadow-2xl" style={{ backgroundColor: 'var(--color-surface)', ...casinoBorder }}>
            <h3 className="mb-2 text-lg font-bold text-red-400">Confirmer la suppression</h3>
            <p className="text-muted text-sm mb-4">
              Êtes-vous sûr de vouloir supprimer cette vérification d'identité ? Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="action secondary"
                disabled={isLoading}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="action"
                style={{ backgroundColor: '#dc2626' }}
                disabled={isLoading}
              >
                {isLoading ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
