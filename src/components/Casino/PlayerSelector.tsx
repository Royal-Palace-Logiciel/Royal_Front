import React, { useState } from 'react';
import { ScanLine, UserSearch, X, User } from 'lucide-react';
import { Field, Badge } from './common';
import { QrScanModal } from './modals/QrScanModal';
import { ClientPickerModal } from './modals/ClientPickerModal';
import type { SelectedPlayer } from '../../types/casino.types';
import { NIVEAU_CARTE_LABELS } from '../../types/casino.types';

interface PlayerSelectorProps {
  value: SelectedPlayer | null;
  onChange: (player: SelectedPlayer | null) => void;
  /** Autorise de continuer sans client rattaché (client_libre). */
  allowFree?: boolean;
  freeLabel?: string;
  freeValue?: string;
  onFreeLabelChange?: (v: string) => void;
}

/**
 * Bloc de sélection de joueur en caisse : scan de carte de fidélité en
 * priorité, ou sélection/ajout simple sans carte. Le client sélectionné
 * (avec sa carte le cas échéant) est rattaché à l'opération.
 */
export const PlayerSelector: React.FC<PlayerSelectorProps> = ({
  value,
  onChange,
  allowFree,
  freeLabel = 'Client de passage (sans fiche)',
  freeValue,
  onFreeLabelChange,
}) => {
  const [showScan, setShowScan] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  return (
    <Field label="Joueur">
      {value ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl p-3"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--color-accent)' }}
            >
              <User size={16} className="text-black" />
            </div>
            <div className="min-w-0">
              <p className="text-primary text-sm font-semibold truncate">
                {value.client.prenom} {value.client.nom}
              </p>
              <p className="text-muted text-xs truncate">
                {value.client.code_client} {value.client.telephone ? `· ${value.client.telephone}` : ''}
              </p>
            </div>
            {value.card && <Badge tone="accent">{NIVEAU_CARTE_LABELS[value.card.niveau]}</Badge>}
            {value.via === 'QR' && <Badge tone="info">Carte scannée</Badge>}
          </div>
          <button
            onClick={() => onChange(null)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-primary flex-shrink-0"
            aria-label="Retirer le joueur"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowScan(true)}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
            >
              <ScanLine size={16} /> Scanner la carte
            </button>
            <button
              onClick={() => setShowPicker(true)}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'inherit' }}
            >
              <UserSearch size={16} /> Sélection simple
            </button>
          </div>
          {allowFree && (
            <input
              value={freeValue || ''}
              onChange={(e) => onFreeLabelChange?.(e.target.value)}
              placeholder={freeLabel}
              className="w-full rounded-xl px-3 py-2 text-xs outline-none"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px dashed var(--color-border)' }}
            />
          )}
        </div>
      )}

      {showScan && (
        <QrScanModal
          onClose={() => setShowScan(false)}
          onSelect={(p) => {
            onChange(p);
            setShowScan(false);
          }}
        />
      )}
      {showPicker && (
        <ClientPickerModal
          onClose={() => setShowPicker(false)}
          onScanQr={() => {
            setShowPicker(false);
            setShowScan(true);
          }}
          onSelect={(p) => {
            onChange(p);
            setShowPicker(false);
          }}
        />
      )}
    </Field>
  );
};

export default PlayerSelector;
