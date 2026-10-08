import React, { useEffect, useRef, useState } from 'react';
import { ScanLine, Camera, CheckCircle2 } from 'lucide-react';
import { Modal, Button, ErrorBanner, Badge } from '../common';
import { cardsApi } from '../../../services/casino.service';
import type { Client, LoyaltyCard, ClientProfile, SelectedPlayer } from '../../../types/casino.types';
import { NIVEAU_CARTE_LABELS, STATUT_SPECIAL_LABELS } from '../../../types/casino.types';

interface QrScanModalProps {
  onClose: () => void;
  onSelect: (player: SelectedPlayer) => void;
}

/**
 * Scanne le QR code d'une carte de fidélité pour retrouver un client en
 * caisse. La lecture est faite directement par la caméra via l'API native
 * `BarcodeDetector`; aucun code QR n'est saisi manuellement.
 */
export const QrScanModal: React.FC<QrScanModalProps> = ({ onClose, onSelect }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ card: LoyaltyCard; client: Client; profile: ClientProfile | null } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
        setCameraSupported(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);

        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const value = codes[0].rawValue as string;
              stopCamera();
              handleLookup(value);
              return;
            }
          } catch {
            // frame non exploitable, on continue
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setCameraSupported(false);
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  async function handleLookup(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const data = await cardsApi.scan(trimmed);
      setResult(data);
    } catch (e: any) {
      setError(
        e?.response?.status === 404 || e?.status === 404
          ? 'QR code inconnu — aucune carte associée.'
          : e?.response?.data?.error?.message || e?.message || 'Erreur de scan.'
      );
    } finally {
      setLoading(false);
    }
  }

  function confirmSelection() {
    if (!result) return;
    onSelect({ client: result.client, card: result.card, via: 'QR' });
  }

  return (
    <Modal
      title="Scanner une carte de fidélité"
      subtitle="Présentez le QR code de la carte devant la caméra"
      onClose={onClose}
      size="md"
      footer={
        result ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button icon={<CheckCircle2 size={16} />} onClick={confirmSelection}>
              Utiliser ce client
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}

        {!result && cameraSupported && (
          <div
            className="relative rounded-xl overflow-hidden aspect-video flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <ScanLine size={48} className="text-white/70" />
            </div>
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center text-muted text-xs gap-2">
                <Camera size={16} /> Activation de la caméra…
              </div>
            )}
          </div>
        )}

        {!result && !cameraSupported && (
          <div
            className="rounded-xl p-4 text-xs text-muted"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px dashed var(--color-border)' }}
          >
            Le scan direct n'est pas disponible dans ce navigateur. Autorisez l'accès à la caméra et utilisez
            Chrome ou Edge sur un appareil compatible QR code.
          </div>
        )}

        {result && (
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary font-bold">
                  {result.client.prenom} {result.client.nom}
                </p>
                <p className="text-muted text-xs">{result.client.code_client} · {result.client.telephone}</p>
              </div>
              <Badge tone="accent">{NIVEAU_CARTE_LABELS[result.card.niveau]}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone={result.card.statut === 'ACTIVE' ? 'success' : 'danger'}>{result.card.statut}</Badge>
              {result.profile && (
                <Badge tone="neutral">{STATUT_SPECIAL_LABELS[result.profile.statut_special]}</Badge>
              )}
              {result.card.plafond_credit != null && (
                <Badge tone="info">Plafond crédit : {result.card.plafond_credit.toLocaleString('fr-FR')} Ar</Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default QrScanModal;
