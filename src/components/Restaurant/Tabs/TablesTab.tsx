import React from 'react';
import { Badge, Button, DataTable } from '../../UI';
import { Plus, Trash2 } from 'lucide-react';
import type { TableRestaurant } from '../types';

const STATUTS_TABLE: Record<string, { label: string; variant: string }> = {
  LIBRE: { label: 'Libre', variant: 'success' },
  OCCUPEE: { label: 'Occupée', variant: 'warning' },
  RESERVEE: { label: 'Réservée', variant: 'info' },
  HORS_SERVICE: { label: 'Hors service', variant: 'danger' },
};

interface TablesTabProps {
  tables: TableRestaurant[];
  onAddTable: () => void;
  onDeleteTable: (id: number) => void;
  onSelectTable: (tableId: number) => void;
}

export const TablesTab: React.FC<TablesTabProps> = ({
  tables,
  onAddTable,
  onDeleteTable,
  onSelectTable
}) => {
  const columns = [
    { key: 'numero', label: 'N°', render: (t: TableRestaurant) => (
      <span className="text-primary font-medium">{t.numero}</span>
    )},
    { key: 'capacite', label: 'Capacité', render: (t: TableRestaurant) => (
      <span className="text-secondary">{t.capacite} pers.</span>
    )},
    { key: 'statut', label: 'Statut', render: (t: TableRestaurant) => {
      const status = STATUTS_TABLE[t.statut] || STATUTS_TABLE.LIBRE;
      return <Badge variant={status.variant as any}>{status.label}</Badge>;
    }},
    { key: 'actions', label: '', render: (t: TableRestaurant) => (
      <div className="flex gap-2">
        {t.statut === 'LIBRE' && (
          <Button size="sm" variant="secondary" onClick={() => onSelectTable(t.id)}>
            Commander
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={() => onDeleteTable(t.id)}>
          <Trash2 size={14} />
        </Button>
      </div>
    )},
  ];

  const data = tables.map(t => ({ ...t, id: String(t.id) }));

  return (
    <div className="rounded-2xl overflow-hidden w-full" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-primary font-semibold text-sm sm:text-base flex items-center gap-2">
          Tables
        </h3>
        <Button icon={<Plus size={16} />} onClick={onAddTable} className="w-full sm:w-auto text-sm">
          Ajouter une table
        </Button>
      </div>
      <div className="overflow-x-auto">
        <DataTable data={data} columns={columns as any} />
      </div>
    </div>
  );
};