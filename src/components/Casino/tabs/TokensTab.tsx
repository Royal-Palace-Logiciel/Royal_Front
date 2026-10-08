import React, { useEffect, useState } from 'react';
import { Coins, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorBanner, SectionCard, Spinner, formatAriary } from '../common';
import { chipTypesApi } from '../../../services/casino.service';
import { ChipTypeFormModal } from '../modals/ChipTypeFormModal';
import type { ChipType } from '../../../types/casino.types';

export const TokensTab: React.FC = () => {
  const [tokens, setTokens] = useState<ChipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChipType | null | false>(false);

  async function loadTokens() {
    setLoading(true);
    setError(null);
    try {
      setTokens(await chipTypesApi.list());
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Impossible de charger les jetons.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTokens(); }, []);

  async function removeToken(token: ChipType) {
    if (!window.confirm(`Supprimer le jeton « ${token.nom} » ?`)) return;
    try {
      await chipTypesApi.remove(token.id);
      await loadTokens();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || 'Suppression impossible.');
    }
  }

  if (loading) return <Spinner label="Chargement des jetons…" />;

  return (
    <div className="flex flex-col gap-4 w-full">
      {error && <ErrorBanner message={error} />}
      <SectionCard
        title="Paramétrer les jetons"
        action={<Button icon={<Plus size={15} />} onClick={() => setEditing(null)}>Nouveau jeton</Button>}
      >
        <p className="text-muted text-xs mb-4">Définissez la valeur, le stock, la couleur et le statut de chaque jeton.</p>
        {tokens.length === 0 ? <EmptyState label="Aucun jeton configuré." icon={<Coins size={24} />} /> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tokens.map((token) => (
              <div key={token.id} className="rounded-xl p-4 flex flex-col gap-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-full border-4 flex-shrink-0" style={{ backgroundColor: token.couleur, borderColor: 'rgba(255,255,255,.35)' }} />
                    <div className="min-w-0"><p className="text-primary font-semibold truncate">{token.nom}</p><p className="text-muted text-xs">{token.code}</p></div>
                  </div>
                  <Badge tone={token.statut === 'ACTIF' ? 'success' : 'neutral'}>{token.statut}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted text-[11px]">Valeur</p><p className="text-primary font-semibold">{formatAriary(token.valeur_nominale)}</p></div>
                  <div><p className="text-muted text-[11px]">Stock</p><p className="text-primary font-semibold">{token.quantite_stock}</p></div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button variant="secondary" className="flex-1 text-xs" icon={<Pencil size={13} />} onClick={() => setEditing(token)}>Modifier</Button>
                  <Button variant="secondary" className="text-xs" icon={<Trash2 size={13} />} onClick={() => removeToken(token)}>Supprimer</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      {editing !== false && <ChipTypeFormModal chipType={editing} onClose={() => setEditing(false)} onSuccess={() => { setEditing(false); loadTokens(); }} />}
    </div>
  );
};

export default TokensTab;
