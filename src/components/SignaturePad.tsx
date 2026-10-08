// src/components/SignaturePad.tsx
import { useRef, useState, useEffect } from 'react';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
  value?: string | null; // Data URL (base64 PNG) d'une signature déjà enregistrée
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  label?: string;
  height?: number;
}

// Composant de signature électronique générique et réutilisable (canvas tactile/souris).
// Pensé pour être utilisé partout où une signature client est nécessaire : la fiche
// KYC aujourd'hui, les opérations de caisse (recaves, crédits...) demain — il suffit
// de le brancher sur signatureService avec le bon (signable_type, signable_id).
const SignaturePad: React.FC<SignaturePadProps> = ({
  value,
  onChange,
  disabled = false,
  label = 'Signature du client',
  height = 160,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isEditing, setIsEditing] = useState(!value);

  // Se remettre en mode "aperçu" si une signature existante arrive après coup (ex: chargement async)
  useEffect(() => {
    if (value) setIsEditing(false);
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isEditing) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
  }, [isEditing]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    return {
      x: (point.clientX - rect.left) * (canvas.width / rect.width),
      y: (point.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    onChange(canvas.toDataURL('image/png'));
    setIsEditing(false);
  };

  const handleRedo = () => {
    setIsEditing(true);
    setHasDrawn(false);
    onChange(null);
  };

  // Mode "aperçu" : une signature existe déjà
  if (!isEditing && value) {
    return (
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">{label}</label>
        <div
          className="border border-base rounded-lg bg-white p-2 flex items-center justify-center"
          style={{ height }}
        >
          <img src={value} alt="Signature du client" className="max-h-full" />
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleRedo}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Refaire la signature
          </button>
        )}
      </div>
    );
  }

  // Mode "dessin"
  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-1">{label}</label>
      <canvas
        ref={canvasRef}
        width={500}
        height={height}
        className="w-full border border-base rounded-lg bg-white touch-none cursor-crosshair"
        style={{ height }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="px-3 py-1.5 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition text-muted hover:text-primary text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <Eraser size={14} />
          Effacer
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled || !hasDrawn}
          className="px-3 py-1.5 bg-accent text-black rounded-lg hover:bg-accent-2 transition text-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={14} />
          Valider la signature
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;