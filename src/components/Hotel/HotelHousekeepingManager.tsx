// components/Hotel/HousekeepingManager.tsx
import React, { useState, useEffect } from 'react';
import { HousekeepingTask, Room } from '../../types/hotel.types';
import { formatDate } from '../../utils/data';
import { 
  Brush, 
  Check, 
  Clock, 
  User, 
  Loader, 
  AlertCircle, 
  Plus, 
  Edit, 
  Trash2, 
  X 
} from 'lucide-react';
import { useHousekeeping } from '../../hooks/useHousekeeping';
import { useRooms } from '../../hooks/useRooms';
import { HousekeepingFormModal } from './Modal/HousekeepingFormModal';
import { toast } from 'react-hot-toast';
import { TYPE_TACHE_LABELS } from '../../constants/housekeeping';

interface HousekeepingManagerProps {
  initialRoomId?: number | null;
  onTaskCompleted?: () => void;
}

export const HousekeepingManager: React.FC<HousekeepingManagerProps> = ({ initialRoomId = null, onTaskCompleted }) => {
  const {
    tasks,
    stats,
    loading,
    error,
    loadAll,
    createTask,
    updateTask,
    updateStatus,
    deleteTask
  } = useHousekeeping();

  const { rooms, loadRooms } = useRooms();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('TOUS');
  const [filterType, setFilterType] = useState<string>('TOUS');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<HousekeepingTask | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (initialRoomId) {
      setSelectedTask(null);
      setIsModalOpen(true);
    }
  }, [initialRoomId]);

  // Charger les données
  useEffect(() => {
    loadAll();
    loadRooms();
  }, []);

  // Filtrer les tâches
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === 'TOUS' || task.statut === filterStatus;
    const matchesType = filterType === 'TOUS' || task.type_tache === filterType;
    return matchesStatus && matchesType;
  });

  // Gestion de la suppression
  const handleDeleteClick = (task: HousekeepingTask) => {
    setTaskToDelete(task);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteTask(taskToDelete.id);
      toast.success('Tâche supprimée avec succès');
      setIsDeleteModalOpen(false);
      setTaskToDelete(null);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  // Gestion du statut
  const handleStatusChange = async (id: number, statut: string, productsUsed?: any[]) => {
    try {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;

      await updateStatus(id, statut, productsUsed);
      
      if (statut === 'TERMINE') onTaskCompleted?.();
      
      toast.success(`Statut mis à jour: ${statut}`);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  // Gestion de la sauvegarde
  const handleSave = async (data: any) => {
    try {
      if (selectedTask) {
        await updateTask(selectedTask.id, data);
        toast.success('Tâche modifiée avec succès');
      } else {
        await createTask(data);
        toast.success('Tâche créée avec succès');
      }
      setIsModalOpen(false);
      setSelectedTask(null);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const getStatusBadge = (statut: string) => {
    const colors: Record<string, string> = {
      A_FAIRE: 'bg-blue-500/20 text-blue-400',
      EN_COURS: 'bg-yellow-500/20 text-yellow-400',
      TERMINE: 'bg-emerald-500/20 text-emerald-400'
    };
    const labels: Record<string, string> = {
      A_FAIRE: '📋 À faire',
      EN_COURS: '🔄 En cours',
      TERMINE: '✅ Terminé'
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[statut] || colors.A_FAIRE}`}>
        {labels[statut] || statut}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      POST_OCCUPANCY: 'bg-emerald-500/20 text-emerald-400',
      AFTER_OCCUPANCY: 'bg-blue-500/20 text-blue-400',
      DEEP_CLEANING: 'bg-purple-500/20 text-purple-400',
      EXCEPTIONAL: 'bg-red-500/20 text-red-400',
      CHAMBRE: 'bg-emerald-500/20 text-emerald-400',
      ESCALIER_RAMPE: 'bg-blue-500/20 text-blue-400',
      DECORATIONS: 'bg-purple-500/20 text-purple-400',
      MUR: 'bg-orange-500/20 text-orange-400',
      PLAFOND: 'bg-orange-500/20 text-orange-400',
      SOL_MOQUETTE: 'bg-orange-500/20 text-orange-400',
      MEUBLES: 'bg-orange-500/20 text-orange-400',
      COULOIR: 'bg-orange-500/20 text-orange-400',
      TERASSE: 'bg-orange-500/20 text-orange-400',
      TOILETTES: 'bg-orange-500/20 text-orange-400'
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[type] || colors.CHAMBRE}`}>
        {TYPE_TACHE_LABELS[type] || type}
      </span>
    );
  };

  // Affichage du chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={32} className="animate-spin text-accent" />
        <span className="ml-3 text-gray-400">Chargement des tâches...</span>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-lg">🧹 Gestion du ménage</h3>
          <p className="text-gray-400 text-sm">
            {tasks.length} tâche{tasks.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedTask(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-black rounded-xl hover:bg-accent-2 transition font-medium"
        >
          <Plus size={18} />
          Planifier
        </button>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-xs">Total</p>
            <p className="text-white font-bold text-xl">{stats.total || 0}</p>
          </div>
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-xs">À faire</p>
            <p className="text-blue-400 font-bold text-xl">{stats.a_faire || 0}</p>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-xs">En cours</p>
            <p className="text-yellow-400 font-bold text-xl">{stats.en_cours || 0}</p>
          </div>
          <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-xs">Terminées</p>
            <p className="text-emerald-400 font-bold text-xl">{stats.termine || 0}</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-accent text-sm"
        >
          <option value="TOUS">Tous les statuts</option>
          <option value="A_FAIRE">À faire</option>
          <option value="EN_COURS">En cours</option>
          <option value="TERMINE">Terminé</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-accent text-sm"
        >
          <option value="TOUS">Tous les types</option>
          {Object.entries(TYPE_TACHE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Liste des tâches */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/50 rounded-2xl border-2 border-gray-700">
          <Brush size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">Aucune tâche de ménage trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const room = rooms.find(r => r.id === task.room_id);
            
            return (
              <div key={task.id} className="bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-accent/30 transition-all">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {getStatusBadge(task.statut)}
                      {getTypeBadge(task.type_tache)}
                      <span className="text-xs text-gray-500">ID: #{task.id}</span>
                    </div>
                    <h4 className="text-white font-semibold">
                      Chambre {room?.numero || 'N/A'}
                    </h4>
                    {task.commentaire && (
                      <p className="text-gray-400 text-sm mt-1">{task.commentaire}</p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                      {task.planned_at && (
                        <span>📅 Planifié: {formatDate(task.planned_at)}</span>
                      )}
                      {task.completed_at && (
                        <span>✅ Terminé: {formatDate(task.completed_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Actions rapides */}
                    {task.statut === 'A_FAIRE' && (
                      <button
                        onClick={() => handleStatusChange(task.id, 'EN_COURS')}
                        className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-medium transition"
                      >
                        Démarrer
                      </button>
                    )}
                    {task.statut === 'EN_COURS' && (
                      <button
                        onClick={() => handleStatusChange(task.id, 'TERMINE', task.products_used)}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium transition"
                      >
                        Terminer
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 hover:bg-blue-500/10 rounded-lg transition"
                      title="Modifier"
                    >
                      <Edit size={15} className="text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(task)}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg transition"
                      title="Supprimer"
                    >
                      <Trash2 size={15} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de création/modification */}
      <HousekeepingFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
        }}
        initialData={selectedTask}
        rooms={rooms}
        defaultRoomId={initialRoomId || undefined}
        onSave={handleSave}
      />

      {/* Modal de confirmation de suppression */}
      {isDeleteModalOpen && taskToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
              <h3 className="text-white font-bold mb-2">Confirmer la suppression</h3>
              <p className="text-gray-400 text-sm">
                Supprimer la tâche de ménage pour la <br />
                <strong className="text-white">
                  Chambre {rooms.find(r => r.id === taskToDelete.room_id)?.numero || 'N/A'}
                </strong>
              </p>
              <p className="text-red-400/80 text-xs mt-2">
                ⚠️ Cette action est irréversible
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setTaskToDelete(null);
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