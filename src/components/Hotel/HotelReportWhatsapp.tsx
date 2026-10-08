// components/Hotel/HotelReportWhatsapp.tsx
//
// Destinataires WhatsApp du rapport de nuitée, session et état des envois.
//
// L'envoi est décidé et exécuté par le serveur : le rapport ne part que s'il a
// changé depuis le dernier envoi, et au plus une fois par intervalle (10 min
// par défaut). Cet écran montre cette décision, permet de rattacher le compte
// WhatsApp par QR code et de forcer un envoi ; fermer l'onglet n'interrompt rien.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Link2Off,
  Loader,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  Trash2,
  TriangleAlert,
  Users,
  XCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'react-hot-toast';
import {
  hotelReportWhatsappService,
  type WhatsappGroup,
  type WhatsappSession,
  type WhatsappStatus,
} from '../../services/hotelReport.service';

const STATUS_REFRESH_MS = 30_000;
/** Le QR expire vite : tant qu'il est affiché, on suit la session de près. */
const SESSION_POLL_MS = 5_000;

interface Props {
  reportDate: string;
  /** Change quand le rapport est enregistré : l'état serveur a pu bouger. */
  savedAt?: string | null;
}

export const HotelReportWhatsapp: React.FC<Props> = ({ reportDate, savedAt }) => {
  const [status, setStatus] = useState<WhatsappStatus | null>(null);
  const [session, setSession] = useState<WhatsappSession | null>(null);
  const [groups, setGroups] = useState<WhatsappGroup[]>([]);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [numero, setNumero] = useState('');
  const [nom, setNom] = useState('');
  const lastQrRef = useRef<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await hotelReportWhatsappService.getStatus(reportDate));
    } catch (error) {
      console.error('Erreur chargement état WhatsApp:', error);
    }
  }, [reportDate]);

  const loadSession = useCallback(async () => {
    try {
      setSession(await hotelReportWhatsappService.getSession());
    } catch (error) {
      console.error('Erreur chargement session WhatsApp:', error);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    void Promise.all([loadStatus(), loadSession()]).finally(() => setIsLoading(false));
  }, [loadStatus, loadSession, savedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => { void loadStatus(); }, STATUS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  // Tant que la session n'est pas prête, on la suit de près : le QR tourne.
  const sessionPending = session?.transport === 'web' && session.statut !== 'READY' && session.statut !== 'INACTIF';
  useEffect(() => {
    if (!sessionPending) return;
    const timer = window.setInterval(() => { void loadSession(); }, SESSION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [sessionPending, loadSession]);

  // Rendu du QR en image : le serveur ne transmet que la chaîne brute.
  useEffect(() => {
    const qr = session?.qr;
    if (!qr) {
      setQrImage(null);
      lastQrRef.current = null;
      return;
    }
    if (lastQrRef.current === qr) return;
    lastQrRef.current = qr;
    void QRCode.toDataURL(qr, { width: 260, margin: 1 })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [session?.qr]);

  // Les groupes ne sont lisibles qu'une fois le compte rattaché.
  useEffect(() => {
    if (session?.statut !== 'READY') {
      setGroups([]);
      return;
    }
    void hotelReportWhatsappService.listGroups().then(setGroups).catch(() => setGroups([]));
  }, [session?.statut]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      setSession(await hotelReportWhatsappService.connectSession());
      toast.success('Session WhatsApp démarrée. Scannez le QR code.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Démarrage impossible.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Délier le compte WhatsApp du serveur ? Il faudra scanner un nouveau QR code.')) return;
    try {
      setSession(await hotelReportWhatsappService.disconnectSession(true));
      toast.success('Compte délié.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Impossible de délier le compte.');
    }
  };

  const addRecipient = async (valeur: string, label?: string, type: 'NUMERO' | 'GROUPE' = 'NUMERO') => {
    if (!valeur.trim()) return;
    try {
      await hotelReportWhatsappService.addRecipient(valeur.trim(), label?.trim() || undefined, type);
      setNumero('');
      setNom('');
      await loadStatus();
      toast.success(type === 'GROUPE' ? 'Groupe ajouté.' : 'Destinataire ajouté.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Destinataire refusé.');
    }
  };

  const toggleRecipient = async (id: number, actif: boolean) => {
    try {
      await hotelReportWhatsappService.setRecipientActive(id, actif);
      await loadStatus();
    } catch {
      toast.error('Impossible de modifier ce destinataire.');
    }
  };

  const removeRecipient = async (id: number, label: string) => {
    if (!window.confirm(`Retirer ${label} de la liste d’envoi ?`)) return;
    try {
      await hotelReportWhatsappService.removeRecipient(id);
      await loadStatus();
      toast.success('Destinataire retiré.');
    } catch {
      toast.error('Suppression impossible.');
    }
  };

  const sendNow = async () => {
    setIsSending(true);
    try {
      const result = await hotelReportWhatsappService.sendNow(reportDate);
      await loadStatus();
      if (result.statut === 'ENVOYE') toast.success('Rapport envoyé.');
      else if (result.statut === 'PARTIEL') toast('Envoi partiel : voir le détail.', { icon: '⚠️' });
      else toast.error('Envoi échoué : voir le détail.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Envoi impossible.');
    } finally {
      setIsSending(false);
    }
  };

  const dernier = status?.dernierEnvoi;
  const actifs = status?.destinataires.filter((d) => d.actif).length ?? 0;
  const estWeb = session?.transport === 'web';
  const pret = session?.statut === 'READY';
  const dejaAjoutes = new Set(status?.destinataires.map((d) => d.numero) ?? []);

  return (
    <div className="space-y-4 rounded-2xl border border-base bg-surface p-4 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Send size={15} className="text-accent" />
            Envoi WhatsApp
          </h4>
          <p className="mt-0.5 text-xs text-muted">
            {status
              ? `Le serveur envoie le rapport dès qu’il change, au plus une fois toutes les ${status.intervalleMinutes} min.`
              : 'Chargement…'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sendNow()}
          disabled={isSending || actifs === 0 || (estWeb ? !pret : !status?.configure)}
          className="flex items-center gap-1.5 rounded-xl border border-base px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {isSending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
          Envoyer maintenant
        </button>
      </div>

      {/* Session WhatsApp Web : QR code à scanner depuis le téléphone */}
      {estWeb && (
        <div className="rounded-xl border border-base bg-surface-2 p-3">
          {pret ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-emerald-400">
                Compte rattaché{session?.numero ? ` : +${session.numero}` : ''}
              </span>
              <button
                type="button"
                onClick={() => void disconnect()}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-base px-2.5 py-1.5 text-xs text-muted hover:bg-surface hover:text-primary"
              >
                <Link2Off size={13} />
                Délier
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {qrImage ? (
                <img
                  src={qrImage}
                  alt="QR code à scanner depuis WhatsApp"
                  className="h-40 w-40 flex-shrink-0 rounded-lg bg-white p-2"
                />
              ) : (
                <div className="flex h-40 w-40 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-base text-muted">
                  <QrCode size={28} />
                </div>
              )}
              <div className="text-xs text-muted">
                <p className="font-semibold text-primary">Rattacher le compte WhatsApp</p>
                <p className="mt-1">
                  Sur le téléphone : WhatsApp → Paramètres → <strong>Appareils connectés</strong> → Connecter un appareil,
                  puis scannez ce QR code. Le numéro continue de fonctionner normalement sur le téléphone.
                </p>
                {session?.erreur && <p className="mt-1 text-red-400">{session.erreur}</p>}
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={isConnecting}
                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-base px-3 py-1.5 text-xs text-primary hover:bg-surface disabled:opacity-50"
                >
                  {isConnecting ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {session?.statut === 'STOPPED' || session?.statut === 'ERROR' ? 'Démarrer la session' : 'Régénérer le QR'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alertes de configuration : sans elles, le silence serait inexplicable. */}
      {status && !estWeb && !status.configure && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <TriangleAlert size={14} className="mt-0.5 flex-shrink-0" />
          WhatsApp n’est pas configuré sur le serveur : renseignez WHATSAPP_PHONE_NUMBER_ID et WHATSAPP_ACCESS_TOKEN.
        </p>
      )}
      {status && !status.actif && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <TriangleAlert size={14} className="mt-0.5 flex-shrink-0" />
          L’envoi automatique est désactivé : passez HOTEL_REPORT_WHATSAPP_ENABLED à « true ». L’envoi manuel reste possible.
        </p>
      )}

      {/* Destinataires */}
      <div className="space-y-2">
        {isLoading && !status && (
          <p className="flex items-center gap-2 text-xs text-muted"><Loader size={13} className="animate-spin" /> Chargement…</p>
        )}
        {status?.destinataires.length === 0 && (
          <p className="text-xs text-muted">Aucun destinataire. Ajoutez un numéro, ou choisissez un groupe ci-dessous.</p>
        )}
        {status?.destinataires.map((destinataire) => (
          <div key={destinataire.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
            <label className="flex items-center gap-2 text-xs text-primary">
              <input
                type="checkbox"
                checked={destinataire.actif}
                onChange={(event) => void toggleRecipient(destinataire.id, event.target.checked)}
                className="accent-current"
              />
              <span className="font-medium">{destinataire.nom || 'Sans nom'}</span>
            </label>
            {destinataire.type === 'GROUPE' ? (
              <span className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                <Users size={10} /> Groupe
              </span>
            ) : (
              <span className="font-mono text-xs text-muted">+{destinataire.numero}</span>
            )}
            <button
              type="button"
              onClick={() => void removeRecipient(destinataire.id, destinataire.nom || destinataire.numero)}
              title="Retirer ce destinataire"
              className="ml-auto rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Ajout d'un numéro */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={numero}
          onChange={(event) => setNumero(event.target.value)}
          placeholder="261348429933"
          className="w-44 rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent"
        />
        <input
          value={nom}
          onChange={(event) => setNom(event.target.value)}
          placeholder="Nom (facultatif)"
          className="w-44 rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm text-primary outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void addRecipient(numero, nom)}
          className="flex items-center gap-1.5 rounded-lg border border-base px-3 py-2 text-xs font-medium text-primary hover:bg-surface-2"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </div>

      {/* Groupes du compte rattaché */}
      {groups.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Vos groupes WhatsApp</p>
          <div className="flex flex-wrap gap-2">
            {groups.map((groupe) => (
              <button
                key={groupe.id}
                type="button"
                disabled={dejaAjoutes.has(groupe.id)}
                onClick={() => void addRecipient(groupe.id, groupe.nom, 'GROUPE')}
                className="flex items-center gap-1.5 rounded-lg border border-base px-3 py-1.5 text-xs text-primary hover:bg-surface-2 disabled:opacity-40"
              >
                <Users size={13} />
                {groupe.nom}
                {dejaAjoutes.has(groupe.id) ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* État du prochain envoi et du dernier */}
      <div className="space-y-1 border-t border-base pt-3 text-xs">
        {status?.prochaineDecision && (
          <p className="text-muted">
            <span className="font-semibold">Prochain envoi :</span>{' '}
            {status.envoiPossible ? 'au prochain passage — ' : ''}{status.prochaineDecision}
          </p>
        )}
        {dernier ? (
          <p className={`flex items-start gap-1.5 ${
            dernier.statut === 'ENVOYE' ? 'text-emerald-400' : dernier.statut === 'PARTIEL' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {dernier.statut === 'ENVOYE' ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" /> : <XCircle size={13} className="mt-0.5 flex-shrink-0" />}
            <span>
              Dernier envoi {new Date(dernier.sentAt).toLocaleString('fr-FR')}
              {dernier.declencheur === 'MANUEL' ? ' (manuel)' : ''}
              {dernier.erreur ? ` — ${dernier.erreur}` : ''}
            </span>
          </p>
        ) : (
          <p className="text-muted">Aucun envoi pour cette nuitée.</p>
        )}
      </div>
    </div>
  );
};

export default HotelReportWhatsapp;
