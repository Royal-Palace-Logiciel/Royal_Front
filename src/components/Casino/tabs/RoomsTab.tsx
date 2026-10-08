import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Unlock,
  LockKeyhole,
  Wallet,
  Coins,
  LogIn,
  ChevronRight,
  DoorOpen,
  ArrowRightLeft,
} from 'lucide-react';
import {
  SectionCard,
  Spinner,
  EmptyState,
  ErrorBanner,
  Badge,
  Button,
  formatAriary,
  formatDateTime,
  statutSalleTone,
} from '../common';
import { roomsApi, cashiersApi, sessionsApi } from '../../../services/casino.service';
import { RoomFormModal, CashierFormModal } from '../modals/RoomCashierModal';
import { OpenSessionModal, CloseSessionModal } from '../modals/SessionModal';
import { CashOperationModal } from '../modals/CashOperationModal';
import { ChipOperationModal } from '../modals/ChipOperationModal';
import { VisitCheckInModal } from '../modals/VisitCheckInModal';
import { CaisseTransferModal } from '../modals/CaisseTransferModal';
import { PendingCaisseTransfers } from '../modals/PendingCaisseTransfers';
import type { Room, Cashier, CashSession, SessionSummary, SessionTransaction } from '../../../types/casino.types';
import { TYPE_SALLE_LABELS } from '../../../types/casino.types';

export const RoomsTab: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [activeSessions, setActiveSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedCashierId, setSelectedCashierId] = useState<number | null>(null);

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [transactions, setTransactions] = useState<SessionTransaction[]>([]);

  // Modales
  const [showRoomForm, setShowRoomForm] = useState<Room | null | false>(false);
  const [showCashierForm, setShowCashierForm] = useState<{ cashier?: Cashier | null; roomId?: number } | null>(null);
  const [showOpenSession, setShowOpenSession] = useState<Cashier | null>(null);
  const [showCloseSession, setShowCloseSession] = useState<CashSession | null>(null);
  const [showCashOp, setShowCashOp] = useState<'buy-in' | 'cash-out' | 'deposit' | null>(null);
  const [showChipOp, setShowChipOp] = useState<'BUY' | 'SELL' | null>(null);
  const [showCheckIn, setShowCheckIn] = useState<Room | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [r, c, s] = await Promise.all([roomsApi.list(), cashiersApi.list(), sessionsApi.active()]);
      setRooms(r);
      setCashiers(c);
      setActiveSessions(s);
      if (!selectedRoomId && r.length) setSelectedRoomId(r[0].id);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement des salles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roomCashiers = useMemo(() => cashiers.filter((c) => c.room_id === selectedRoomId), [cashiers, selectedRoomId]);
  const selectedCashier = useMemo(() => cashiers.find((c) => c.id === selectedCashierId) || null, [cashiers, selectedCashierId]);
  const selectedSession = useMemo(
    () => activeSessions.find((s) => s.cashier_id === selectedCashierId) || null,
    [activeSessions, selectedCashierId]
  );

  useEffect(() => {
    if (!selectedSession) {
      setSummary(null);
      setTransactions([]);
      return;
    }
    (async () => {
      try {
        const [sum, txs] = await Promise.all([
          sessionsApi.summary(selectedSession.id),
          sessionsApi.transactions(selectedSession.id),
        ]);
        setSummary(sum);
        setTransactions(txs);
      } catch {
        // silencieux : le résumé n'est pas bloquant
      }
    })();
  }, [selectedSession]);

  async function refreshSessionData() {
    if (!selectedSession) return;
    const [sum, txs] = await Promise.all([
      sessionsApi.summary(selectedSession.id),
      sessionsApi.transactions(selectedSession.id),
    ]);
    setSummary(sum);
    setTransactions(txs);
  }

  async function handleDeleteRoom(room: Room) {
    if (!confirm(`Supprimer définitivement la salle "${room.nom}" ?`)) return;
    try {
      await roomsApi.remove(room.id);
      loadAll();
    } catch (e: any) {
      const message = e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || 'Suppression impossible.';
      if (e?.response?.status === 409) {
        const deleteAll = confirm(`${message}\n\nATTENTION : supprimer cette salle effacera définitivement toutes ses caisses, tables, joueurs, opérations et son historique. Continuer ?`);
        if (!deleteAll) return;
        try {
          await roomsApi.remove(room.id);
          await loadAll();
          return;
        } catch (deleteError: any) {
          alert(
            deleteError?.response?.data?.error?.message ||
              deleteError?.response?.data?.message ||
              deleteError?.message ||
              'Impossible de supprimer définitivement la salle.'
          );
          return;
        }
      }
      alert(message);
    }
  }

  if (loading) return <Spinner label="Chargement des salles…" />;

  return (
    <div className="flex flex-col gap-4 w-full">
      {error && <ErrorBanner message={error} />}

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* Colonne salles */}
        <SectionCard
          title="Salles"
          action={
            <Button className="text-xs" icon={<Plus size={14} />} onClick={() => setShowRoomForm(null)}>
              Salle
            </Button>
          }
        >
          {rooms.length === 0 ? (
            <EmptyState label="Aucune salle configurée." />
          ) : (
            <div className="flex flex-col gap-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    setSelectedCashierId(null);
                  }}
                  className="flex items-center justify-between gap-2 rounded-xl p-2.5 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: selectedRoomId === room.id ? 'var(--color-accent)' : 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: selectedRoomId === room.id ? '#000' : 'var(--text-primary, inherit)' }}
                    >
                      {room.nom}
                    </p>
                    <p
                      className="text-[11px] truncate"
                      style={{ color: selectedRoomId === room.id ? 'rgba(0,0,0,0.6)' : undefined }}
                    >
                      {TYPE_SALLE_LABELS[room.type_salle]}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge tone={statutSalleTone(room.statut)}>{room.statut}</Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRoomForm(room);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center hover:opacity-70"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRoom(room);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center hover:opacity-70"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Colonne caisses + session active */}
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Caisses de la salle"
            action={
              selectedRoomId && (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="text-xs"
                    icon={<LogIn size={14} />}
                    onClick={() => setShowCheckIn(rooms.find((r) => r.id === selectedRoomId) || null)}
                  >
                    Check-in
                  </Button>
                  <Button
                    className="text-xs"
                    icon={<Plus size={14} />}
                    onClick={() => setShowCashierForm({ roomId: selectedRoomId })}
                  >
                    Caisse
                  </Button>
                </div>
              )
            }
          >
            {!selectedRoomId ? (
              <EmptyState label="Sélectionnez une salle." />
            ) : roomCashiers.length === 0 ? (
              <EmptyState label="Aucune caisse pour cette salle." icon={<DoorOpen size={22} />} />
            ) : (
              <div className="flex flex-col gap-2">
                {roomCashiers.map((cashier) => {
                  const session = activeSessions.find((s) => s.cashier_id === cashier.id);
                  return (
                    <div
                      key={cashier.id}
                      onClick={() => setSelectedCashierId(cashier.id)}
                      className="flex items-center justify-between gap-2 rounded-xl p-3 cursor-pointer transition-colors"
                      style={{
                        backgroundColor: selectedCashierId === cashier.id ? 'var(--color-bg)' : 'transparent',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight
                          size={14}
                          className="text-muted flex-shrink-0"
                          style={{ transform: selectedCashierId === cashier.id ? 'rotate(90deg)' : 'none' }}
                        />
                        <div className="min-w-0">
                          <p className="text-primary text-sm font-semibold truncate">{cashier.nom}</p>
                          <p className="text-muted text-[11px] truncate">{cashier.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {session ? (
                          <Badge tone="success">Session ouverte</Badge>
                        ) : (
                          <Badge tone="neutral">Fermée</Badge>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCashierForm({ cashier, roomId: cashier.room_id });
                          }}
                          className="w-6 h-6 rounded flex items-center justify-center hover:opacity-70"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {selectedCashier && (
            <SectionCard
              title={`Caisse — ${selectedCashier.nom}`}
              action={
                selectedSession ? (
                  <Button
                    variant="secondary"
                    className="text-xs"
                    icon={<LockKeyhole size={14} />}
                    onClick={() => setShowCloseSession(selectedSession)}
                  >
                    Clôturer
                  </Button>
                ) : (
                  <Button className="text-xs" icon={<Unlock size={14} />} onClick={() => setShowOpenSession(selectedCashier)}>
                    Ouvrir la session
                  </Button>
                )
              }
            >
              {!selectedSession ? (
                <EmptyState label="Aucune session ouverte pour cette caisse." icon={<Wallet size={22} />} />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <MiniStat label="Fond initial" value={formatAriary(selectedSession.fond_initial)} />
                    <MiniStat label="Entrées" value={formatAriary(summary?.total_entrees)} />
                    <MiniStat label="Sorties" value={formatAriary(summary?.total_sorties)} />
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button className="text-xs" icon={<Wallet size={14} />} onClick={() => setShowCashOp('buy-in')}>
                      Buy-in
                    </Button>
                    {/* <Button variant="secondary" className="text-xs" onClick={() => setShowCashOp('deposit')}>
                      Encaissement
                    </Button>
                    <Button variant="secondary" className="text-xs" onClick={() => setShowCashOp('cash-out')}>
                      Cash-out
                    </Button> */}
                    <Button variant="secondary" className="text-xs" icon={<Coins size={14} />} onClick={() => setShowChipOp('BUY')}>
                      Achat jetons
                    </Button>
                    <Button variant="secondary" className="text-xs" onClick={() => setShowChipOp('SELL')}>
                      Reprise jetons
                    </Button>
                    <Button variant="secondary" className="text-xs" icon={<ArrowRightLeft size={14} />} onClick={() => setShowTransfer(true)}>
                      Transfert inter-caisses
                    </Button>
                  </div>

                  <PendingCaisseTransfers casinoSession={selectedSession} onChanged={refreshSessionData} />

                  <div>
                    <p className="text-secondary text-xs font-semibold mb-2">Transactions de la session</p>
                    {transactions.length === 0 ? (
                      <EmptyState label="Aucune transaction pour cette session." />
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                        {transactions.map((t) => (
                          <div
                            key={`${t.source}-${t.id}`}
                            className="flex items-center justify-between text-xs rounded-lg p-2"
                            style={{ backgroundColor: 'var(--color-bg)' }}
                          >
                            <div>
                              <span className="text-primary font-medium">{t.type_operation}</span>
                              <span className="text-muted"> · {t.client_libre || (t.client_id ? `Client #${t.client_id}` : 'Anonyme')}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-primary font-semibold">{formatAriary(t.montant)}</p>
                              <p className="text-muted">{formatDateTime(t.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      {/* Modales */}
      {showRoomForm !== false && (
        <RoomFormModal
          room={showRoomForm}
          onClose={() => setShowRoomForm(false)}
          onSuccess={() => {
            setShowRoomForm(false);
            loadAll();
          }}
        />
      )}
      {showCashierForm && (
        <CashierFormModal
          rooms={rooms}
          roomId={showCashierForm.roomId}
          cashier={showCashierForm.cashier}
          onClose={() => setShowCashierForm(null)}
          onSuccess={() => {
            setShowCashierForm(null);
            loadAll();
          }}
        />
      )}
      {showOpenSession && (
        <OpenSessionModal
          cashier={showOpenSession}
          onClose={() => setShowOpenSession(null)}
          onSuccess={() => {
            setShowOpenSession(null);
            loadAll();
          }}
        />
      )}
      {showCloseSession && (
        <CloseSessionModal
          session={showCloseSession}
          summary={summary}
          onClose={() => setShowCloseSession(null)}
          onSuccess={() => {
            setShowCloseSession(null);
            loadAll();
          }}
        />
      )}
      {showCashOp && selectedSession && (
        <CashOperationModal
          sessionId={selectedSession.id}
          defaultKind={showCashOp}
          onClose={() => setShowCashOp(null)}
          onSuccess={() => {
            setShowCashOp(null);
            refreshSessionData();
          }}
        />
      )}
      {showChipOp && selectedSession && (
        <ChipOperationModal
          sessionId={selectedSession.id}
          defaultMovement={showChipOp}
          onClose={() => setShowChipOp(null)}
          onSuccess={() => {
            setShowChipOp(null);
            refreshSessionData();
          }}
        />
      )}
      {showCheckIn && (
        <VisitCheckInModal room={showCheckIn} onClose={() => setShowCheckIn(null)} onSuccess={() => setShowCheckIn(null)} />
      )}
      {showTransfer && selectedSession && (
        <CaisseTransferModal
          casinoSession={selectedSession}
          onClose={() => setShowTransfer(false)}
          onSuccess={() => {
            setShowTransfer(false);
            refreshSessionData();
          }}
        />
      )}
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
    <p className="text-muted text-[10px]">{label}</p>
    <p className="text-primary font-semibold">{value}</p>
  </div>
);

export default RoomsTab;