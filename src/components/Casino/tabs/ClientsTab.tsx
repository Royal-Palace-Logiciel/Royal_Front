import React, { useState } from 'react';
import { Search, UserPlus, User, ScanLine } from 'lucide-react';
import { SectionCard, Field, TextInput, Button, Spinner, EmptyState, ErrorBanner, Badge } from '../common';
import { clientsApi } from '../../../services/casino.service';
import { QrScanModal } from '../modals/QrScanModal';
import { ClientPickerModal } from '../modals/ClientPickerModal';
import { ClientProfileModal } from '../modals/ClientProfileModal';
import type { Client } from '../../../types/casino.types';

export const ClientsTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [showScan, setShowScan] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await clientsApi.search(q.trim());
      setResults(data);
    } catch (e: any) {
      setError(e?.message || 'Erreur de recherche.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <SectionCard
        title="Rechercher un joueur"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs" icon={<ScanLine size={14} />} onClick={() => setShowScan(true)}>
              Scanner
            </Button>
            <Button className="text-xs" icon={<UserPlus size={14} />} onClick={() => setShowAdd(true)}>
              Ajout rapide
            </Button>
          </div>
        }
      >
        {error && <ErrorBanner message={error} />}
        <Field label="Nom, prénom, téléphone ou code client">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <TextInput
              className="pl-9"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Ex: Rakoto, 034…, CL-0021"
            />
          </div>
        </Field>

        <div className="flex flex-col gap-2 mt-3">
          {loading && <Spinner label="Recherche…" />}
          {!loading && query.trim().length >= 2 && results.length === 0 && <EmptyState label="Aucun client trouvé." />}
          {!loading &&
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
                className="flex items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors hover:opacity-90"
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
      </SectionCard>

      {showScan && (
        <QrScanModal
          onClose={() => setShowScan(false)}
          onSelect={(p) => {
            setShowScan(false);
            setSelectedClientId(p.client.id);
          }}
        />
      )}
      {showAdd && (
        <ClientPickerModal
          onClose={() => setShowAdd(false)}
          onSelect={(p) => {
            setShowAdd(false);
            setSelectedClientId(p.client.id);
          }}
        />
      )}
      {selectedClientId && <ClientProfileModal clientId={selectedClientId} onClose={() => setSelectedClientId(null)} />}
    </div>
  );
};

export default ClientsTab;
