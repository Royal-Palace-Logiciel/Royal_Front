import React, { useEffect, useState } from 'react';
import { Search, UserPlus, User, ScanLine, CheckCircle2 } from 'lucide-react';
import { Modal, Field, TextInput, Button, Spinner, EmptyState, ErrorBanner, Badge } from '../common';
import { clientsApi } from '../../../services/casino.service';
import type { Client, SelectedPlayer } from '../../../types/casino.types';

interface ClientPickerModalProps {
  onClose: () => void;
  onSelect: (player: SelectedPlayer) => void;
  onScanQr?: () => void;
  /** Si vrai, un client n'est pas obligatoire (ex: opération "au comptant"). */
  allowSkip?: boolean;
  onSkip?: () => void;
}

/**
 * Sélection simple d'un client existant (recherche) ou ajout rapide,
 * sans passer par le scan de carte de fidélité.
 */
export const ClientPickerModal: React.FC<ClientPickerModalProps> = ({
  onClose,
  onSelect,
  onScanQr,
  allowSkip,
  onSkip,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'search' | 'add'>('search');

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'search') return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await clientsApi.search(q);
        setResults(data);
      } catch (e: any) {
        setError(e?.message || 'Erreur de recherche.');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, mode]);

  async function handleQuickAdd() {
    if (!nom.trim()) {
      setError('Le nom est requis.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const client = await clientsApi.quickAdd({
        nom: nom.trim(),
        prenom: prenom.trim() || undefined,
        telephone: telephone.trim() || undefined,
      });
      onSelect({ client, via: 'MANUEL' });
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'ajout du client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Sélectionner un client"
      subtitle="Recherche simple ou ajout rapide, sans carte de fidélité"
      onClose={onClose}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full gap-2 flex-wrap">
          <div className="flex gap-2">
            {onScanQr && (
              <Button variant="secondary" icon={<ScanLine size={16} />} onClick={onScanQr}>
                Scanner une carte
              </Button>
            )}
            {allowSkip && (
              <Button variant="secondary" onClick={onSkip}>
                Sans client
              </Button>
            )}
          </div>
          {mode === 'add' && (
            <Button icon={<CheckCircle2 size={16} />} onClick={handleQuickAdd} disabled={saving}>
              {saving ? 'Ajout…' : 'Ajouter et sélectionner'}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className="flex gap-1 rounded-xl p-1 w-fit"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          <button
            onClick={() => setMode('search')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: mode === 'search' ? 'var(--color-accent)' : 'transparent',
              color: mode === 'search' ? '#000' : 'var(--text-muted, inherit)',
            }}
          >
            Rechercher
          </button>
          <button
            onClick={() => setMode('add')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: mode === 'add' ? 'var(--color-accent)' : 'transparent',
              color: mode === 'add' ? '#000' : 'var(--text-muted, inherit)',
            }}
          >
            Ajout rapide
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        {mode === 'search' ? (
          <>
            <Field label="Nom, prénom, téléphone ou code client">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <TextInput
                  className="pl-9"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex: Rakoto, 034…, CL-0021"
                />
              </div>
            </Field>

            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {loading && <Spinner label="Recherche…" />}
              {!loading && query.trim().length >= 2 && results.length === 0 && (
                <EmptyState label="Aucun client trouvé." />
              )}
              {!loading &&
                results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect({ client: c, via: 'MANUEL' })}
                    className="flex items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--color-accent)' }}
                      >
                        <User size={15} className="text-black" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-primary text-sm font-semibold truncate">
                          {c.prenom} {c.nom}
                        </p>
                        <p className="text-muted text-xs truncate">
                          {c.code_client} {c.telephone ? `· ${c.telephone}` : ''}
                        </p>
                      </div>
                    </div>
                    {!!c.is_casino_player && <Badge tone="accent">Joueur</Badge>}
                  </button>
                ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Nom" required>
              <TextInput value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Rakoto" autoFocus />
            </Field>
            <Field label="Prénom">
              <TextInput value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Jean" />
            </Field>
            <Field label="Téléphone">
              <TextInput value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="034 12 345 67" />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ClientPickerModal;
