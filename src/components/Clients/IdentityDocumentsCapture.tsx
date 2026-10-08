// src/components/Clients/IdentityDocumentsCapture.tsx
// Photos / scans de la pièce d'identité (CIN, passeport...) : prise de photo via la
// caméra (webcam sur PC, appareil photo sur mobile) ou téléversement d'un fichier.
import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Loader, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import uploadService from '../../services/upload.service';

interface IdentityDocumentsCaptureProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const identityDocumentUrl = (url: string) => (/^https?:\/\//.test(url) ? url : `${API_BASE}${url}`);
const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

export const IdentityDocumentsCapture: React.FC<IdentityDocumentsCaptureProps> = ({ urls, onChange, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileCaptureRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map((file) => uploadService.uploadFile(file)));
      onChange([...urls, ...uploaded.map((file) => file.url)]);
      toast.success(files.length > 1 ? `${files.length} documents ajoutés` : 'Document ajouté');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Impossible de téléverser le document');
    } finally {
      setUploading(false);
    }
  };

  const openCamera = async () => {
    // Sans getUserMedia (ex. HTTP non sécurisé), on bascule sur l'appareil photo natif (mobile).
    if (!navigator.mediaDevices?.getUserMedia) {
      mobileCaptureRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      toast.error('Caméra inaccessible. Autorisez la caméra ou téléversez un fichier.');
      mobileCaptureRef.current?.click();
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      void uploadFiles([new File([blob], `piece-identite-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
    }, 'image/jpeg', 0.9);
  };

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    void uploadFiles(files);
  };

  const busy = disabled || uploading;

  return (
    <div className="md:col-span-2 space-y-3">
      <label className="block text-xs font-medium text-primary">Photos / scans de la pièce (CIN, passeport...)</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openCamera}
          disabled={busy}
          className="px-3 py-2 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition text-sm text-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera size={16} /> Prendre une photo
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="px-3 py-2 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition text-sm text-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={16} /> Téléverser un document
        </button>
        {uploading && <span className="flex items-center gap-1.5 text-xs text-muted"><Loader size={14} className="animate-spin" /> Téléversement...</span>}
      </div>
      <p className="text-xs text-muted">Recto, verso ou page du passeport. Images (JPG, PNG) ou PDF, 10 Mo max.</p>

      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleInput} />
      <input ref={mobileCaptureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInput} />

      {urls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {urls.map((url, index) => (
            <div key={`${url}-${index}`} className="relative rounded-lg border border-base overflow-hidden bg-surface-2">
              <a href={identityDocumentUrl(url)} target="_blank" rel="noreferrer" className="block">
                {isPdf(url) ? (
                  <div className="h-24 flex flex-col items-center justify-center gap-1 text-muted">
                    <FileText size={28} />
                    <span className="text-xs">PDF {index + 1}</span>
                  </div>
                ) : (
                  <img src={identityDocumentUrl(url)} alt={`Pièce d'identité ${index + 1}`} className="h-24 w-full object-cover" />
                )}
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(urls.filter((_, i) => i !== index))}
                  className="absolute top-1 right-1 p-1 rounded bg-black/60 text-red-400 hover:text-red-300"
                  title="Retirer ce document"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-base">
              <h4 className="font-semibold text-primary">Photographier la pièce d'identité</h4>
              <button type="button" onClick={stopCamera} className="p-2 hover:bg-surface-2 rounded-lg text-muted hover:text-primary">
                <X size={18} />
              </button>
            </div>
            <video ref={videoRef} playsInline muted className="w-full max-h-[60vh] bg-black object-contain" />
            <div className="flex justify-end gap-3 p-4 border-t border-base">
              <button type="button" onClick={stopCamera} className="px-4 py-2 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition text-muted hover:text-primary">
                Annuler
              </button>
              <button type="button" onClick={takePhoto} className="px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent-2 transition flex items-center gap-2 font-medium">
                <Camera size={16} /> Capturer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
