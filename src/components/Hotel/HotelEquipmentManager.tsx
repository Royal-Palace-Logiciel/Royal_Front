// hotel/EquipmentManager.tsx
import React, { useState, useEffect } from 'react';
import { Equipment, RoomEquipment, Room } from '../../types/hotel.types';
import { Plus, Edit, Trash2, Check, X, Wrench, Loader, AlertCircle } from 'lucide-react';
import { AssignEquipmentModal } from './Modal/AssignEquipmentModal';

import { useEquipment } from '../../hooks/useEquipment';
import { useRooms } from '../../hooks/useRooms';
import { toast } from 'react-hot-toast';
import { EquipmentFormModal } from './Modal/EquipmentFormModal';

interface EquipmentManagerProps {
  initialRoomId?: number | null;
}

export const EquipmentManager: React.FC<EquipmentManagerProps> = ({ initialRoomId = null }) => {
  const { 
    equipments, 
    roomEquipments, 
    loading, 
    error,
    loadAll,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    assignEquipment,
    updateRoomEquipment,
    deleteRoomEquipment
  } = useEquipment();

  const { rooms, loadRooms } = useRooms();

  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'TOUS' | 'ASSIGNED' | 'BON' | 'EN_PANNE'>('TOUS');

  useEffect(() => {
    if (initialRoomId) setSelectedRoomId(initialRoomId);
  }, [initialRoomId]);

  // Charger les données
  useEffect(() => {
    loadAll();
    loadRooms();
  }, []);

  // Charger les stats
  useEffect(() => {
    if (equipments.length > 0) {
      const total = equipments.length;
      const assigned = roomEquipments.length;
      setStats({ total, assigned });
    }
  }, [equipments, roomEquipments]);

  // Gestion de la suppression
  const handleDeleteClick = (equipment: Equipment) => {
    setEquipmentToDelete(equipment);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!equipmentToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteEquipment(equipmentToDelete.id);
      toast.success('Équipement supprimé avec succès');
      setIsDeleteModalOpen(false);
      setEquipmentToDelete(null);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const groupedRoomEquipments = React.useMemo(() => {
    const map = new Map<string, RoomEquipment>();

    for (const item of roomEquipments) {
      const normalizedZone = item.zone || 'CHAMBRE';
      const key = `${item.room_id}:${item.equipment_id}:${normalizedZone}`;
      const existing = map.get(key);

      if (existing) {
        map.set(key, {
          ...existing,
          quantite: Number(existing.quantite || 0) + Number(item.quantite || 0),
          statut: existing.statut || item.statut || 'BON',
        });
      } else {
        map.set(key, { ...item, zone: normalizedZone, quantite: Number(item.quantite || 0) });
      }
    }

    return map;
  }, [roomEquipments]);

  const filteredEquipments = React.useMemo(() => {
    const query = categoryFilter.trim().toLowerCase();
    const assignmentsByEquipment = Array.from(groupedRoomEquipments.values());

    return equipments.filter((eq: Equipment) => {
      if (query && !(eq.categorie || '').toLowerCase().includes(query)) return false;

      if (statusFilter === 'TOUS') return true;
      const assigned = assignmentsByEquipment.filter(re => re.equipment_id === eq.id);
      if (statusFilter === 'ASSIGNED') return assigned.length > 0;
      return assigned.some(re => re.statut === statusFilter);
    });
  }, [equipments, categoryFilter, statusFilter, groupedRoomEquipments]);

  // Gestion de l'assignation
  const handleAssign = async (roomId: number, quantity: number, zone: 'CHAMBRE' | 'SALLE_DE_BAIN') => {
    if (!selectedEquipment) return;

    try {
      const existing = roomEquipments.find((item) => {
        return item.room_id === roomId && item.equipment_id === selectedEquipment.id && (item.zone || 'CHAMBRE') === zone;
      });

      if (existing) {
        const nextQuantity = Number(existing.quantite || 0) + Number(quantity || 0);
        await updateRoomEquipment(existing.id, {
          room_id: roomId,
          equipment_id: selectedEquipment.id,
          quantite: nextQuantity,
          zone,
          statut: existing.statut || 'BON'
        });
      } else {
        await assignEquipment({
          room_id: roomId,
          equipment_id: selectedEquipment.id,
          quantite: quantity,
          zone,
          statut: 'BON'
        });
      }

      toast.success('Équipement assigné avec succès');
      setIsAssignModalOpen(false);
      setSelectedEquipment(null);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'assignation');
    }
  };

  // Gestion de la création/modification
  const handleSaveEquipment = async (data: any) => {
    try {
      if (editingEquipment) {
        await updateEquipment(editingEquipment.id, data);
        toast.success('Équipement modifié avec succès');
      } else {
        await createEquipment(data);
        toast.success('Équipement créé avec succès');
      }
      setIsEquipmentModalOpen(false);
      setEditingEquipment(null);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  // Affichage du chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={32} className="animate-spin text-accent" />
        <span className="ml-3 text-muted">Chargement des équipements...</span>
      </div>
    );
  }

  // Affichage de l'erreur
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-red-400 text-center">
        <AlertCircle size={40} className="mx-auto mb-3" />
        <p className="text-lg font-medium">{error}</p>
        <button 
          onClick={() => loadAll()}
          className="mt-3 px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent-2 transition"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 shadow-soft-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">Inventaire hôtel</p>
            <h3 className="text-xl font-bold text-white">Gestion des équipements</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingEquipment(null);
              setIsEquipmentModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300"
          >
            <Plus size={18} />
            Nouvel équipement
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_2fr] lg:items-end">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Afficher par chambre
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-400/70"
            >
              <option value="">Sélectionner une chambre</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>Chambre {room.numero}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Filtrer par catégorie
            </label>
            <input
              type="text"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              placeholder="Rechercher par catégorie..."
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-400/70"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[120px] flex-1 flex-col rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-blue-200/80">Total</span>
              <strong className="mt-1 text-xl font-bold text-blue-300">{equipments.length}</strong>
            </div>
            <div className="flex min-w-[120px] flex-1 flex-col rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Assignés</span>
              <strong className="mt-1 text-xl font-bold text-emerald-300">{roomEquipments.length}</strong>
            </div>
            <div className="flex min-w-[120px] flex-1 flex-col rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-red-200/80">En panne</span>
              <strong className="mt-1 text-xl font-bold text-red-300">
                {roomEquipments.filter(re => re.statut === 'EN_PANNE').length || 0}
              </strong>
            </div>
          </div>
        </div>

        {selectedRoomId !== '' && (() => {
          const assigned = Array.from(groupedRoomEquipments.values()).filter(item => item.room_id === selectedRoomId);
          const renderZone = (zone: 'CHAMBRE' | 'SALLE_DE_BAIN') => assigned.filter(item => (item.zone || 'CHAMBRE') === zone);
          return (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {(['CHAMBRE', 'SALLE_DE_BAIN'] as const).map(zone => (
                <div key={zone} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {zone === 'CHAMBRE' ? 'Chambre' : 'Salle de bain'}
                    </h4>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                      {renderZone(zone).length} élément{renderZone(zone).length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {renderZone(zone).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 bg-slate-900/70 px-3 py-4 text-sm text-slate-400">
                      Aucun équipement
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {renderZone(zone).map(item => {
                        const equipment = equipments.find(entry => entry.id === item.equipment_id);
                        return (
                          <div
                            key={`${item.room_id}-${item.equipment_id}-${item.zone || 'CHAMBRE'}`}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
                          >
                            <span className="text-slate-200">
                              {equipment?.nom || `Équipement #${item.equipment_id}`}
                            </span>
                            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                              x{item.quantite}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatusFilter('TOUS')}
            className={`rounded-2xl border p-4 text-left transition ${
              statusFilter === 'TOUS'
                ? 'border-slate-400 bg-slate-800 ring-2 ring-slate-400/40'
                : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Total</p>
            <p className="mt-2 text-2xl font-bold text-white">{stats.total || 0}</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'ASSIGNED' ? 'TOUS' : 'ASSIGNED')}
            className={`rounded-2xl border p-4 text-left transition ${
              statusFilter === 'ASSIGNED'
                ? 'border-blue-400 bg-blue-500/20 ring-2 ring-blue-400/40'
                : 'border-blue-500/30 bg-blue-500/10 hover:border-blue-400/60'
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-blue-200/80">Assignés</p>
            <p className="mt-2 text-2xl font-bold text-blue-300">{stats.assigned || 0}</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'BON' ? 'TOUS' : 'BON')}
            className={`rounded-2xl border p-4 text-left transition ${
              statusFilter === 'BON'
                ? 'border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-400/40'
                : 'border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400/60'
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Bon état</p>
            <p className="mt-2 text-2xl font-bold text-emerald-300">
              {roomEquipments.filter(re => re.statut === 'BON').length || 0}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'EN_PANNE' ? 'TOUS' : 'EN_PANNE')}
            className={`rounded-2xl border p-4 text-left transition ${
              statusFilter === 'EN_PANNE'
                ? 'border-red-400 bg-red-500/20 ring-2 ring-red-400/40'
                : 'border-red-500/30 bg-red-500/10 hover:border-red-400/60'
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-red-200/80">En panne</p>
            <p className="mt-2 text-2xl font-bold text-red-300">
              {roomEquipments.filter(re => re.statut === 'EN_PANNE').length || 0}
            </p>
          </button>
        </div>
      )}

      {equipments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 py-14 text-center">
          <Wrench size={48} className="mx-auto mb-4 text-slate-500" />
          <p className="text-lg font-semibold text-white">Aucun équipement trouvé</p>
          <p className="mt-2 text-sm text-slate-400">Commencez par ajouter votre premier élément d’inventaire.</p>
          <button
            type="button"
            onClick={() => {
              setEditingEquipment(null);
              setIsEquipmentModalOpen(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
          >
            <Plus size={16} />
            Ajouter un équipement
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEquipments.map(eq => {
            const assigned = Array.from(groupedRoomEquipments.values()).filter(re => re.equipment_id === eq.id);
            const assignedCount = assigned.length;

            return (
              <div
                key={eq.id}
                className="group rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow-soft-sm transition hover:-translate-y-0.5 hover:border-amber-400/50 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-base font-semibold text-white">{eq.nom}</h4>
                      {eq.code && (
                        <span className="rounded-full border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                          #{eq.code}
                        </span>
                      )}
                      {eq.is_consumable && (
                        <span className="rounded-full border border-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                          Consommable
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{eq.categorie || 'Non catégorisé'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">Quantité: {eq.quantite || 1}</span>
                    </div>
                    {eq.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{eq.description}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEquipment(eq);
                        setIsAssignModalOpen(true);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-500/20"
                      title="Assigner à une chambre"
                      aria-label="Assigner à une chambre"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEquipment(eq);
                        setIsEquipmentModalOpen(true);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-300 transition hover:bg-blue-500/20"
                      title="Modifier"
                      aria-label="Modifier"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(eq)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
                      title="Supprimer"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span>Chambres affectées</span>
                    <span className="font-semibold text-slate-200">{assignedCount}</span>
                  </div>

                  {assignedCount > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {assigned.slice(0, 3).map(re => {
                        const room = rooms.find(r => r.id === re.room_id);
                        return (
                          <span
                            key={`${re.room_id}-${re.equipment_id}-${re.zone || 'CHAMBRE'}`}
                            className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                              re.statut === 'BON'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : re.statut === 'EN_PANNE'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {room?.numero || `#${re.room_id}`} {re.quantite > 1 ? `×${re.quantite}` : ''}
                          </span>
                        );
                      })}
                      {assignedCount > 3 && (
                        <span className="rounded-full bg-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300">
                          +{assignedCount - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Aucune chambre affectée</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal d'assignation */}
      <AssignEquipmentModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedEquipment(null);
        }}
        equipment={selectedEquipment}
        rooms={rooms}
        onAssign={handleAssign}
      />

      {/* Modal de création/modification */}
      <EquipmentFormModal
        isOpen={isEquipmentModalOpen}
        onClose={() => {
          setIsEquipmentModalOpen(false);
          setEditingEquipment(null);
        }}
        initialData={editingEquipment}
        categories={[]}
        onSave={handleSaveEquipment}
      />

      {/* Modal de confirmation de suppression */}
      {isDeleteModalOpen && equipmentToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
              <h3 className="text-white font-bold mb-2">Confirmer la suppression</h3>
              <p className="text-gray-400 text-sm">
                Supprimer l'équipement <br />
                <strong className="text-white">
                  {equipmentToDelete.nom}
                </strong>
              </p>
              <p className="text-red-400/80 text-xs mt-2">
                ⚠️ Cette action est irréversible
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setEquipmentToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm flex items-center justify-center gap-2"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};