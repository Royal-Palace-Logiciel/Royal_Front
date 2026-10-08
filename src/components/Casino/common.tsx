import React from 'react';
import { X, Loader2, Inbox } from 'lucide-react';
import { Button } from '../../components/UI';

// -------------------------------------------------------------------------
// Modal
// -------------------------------------------------------------------------

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

export const Modal: React.FC<ModalProps> = ({ title, subtitle, onClose, children, footer, size = 'md' }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${SIZE_MAP[size]} rounded-2xl overflow-hidden flex flex-col max-h-[90vh]`}
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 p-4 md:p-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="min-w-0">
            <h3
              className="text-primary text-lg font-bold truncate"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              {title}
            </h3>
            {subtitle && <p className="text-muted text-xs mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary transition-colors"
            style={{ backgroundColor: 'var(--color-bg)' }}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 md:p-5 overflow-y-auto">{children}</div>

        {footer && (
          <div
            className="p-4 md:p-5 flex-shrink-0 flex items-center justify-end gap-2 flex-wrap"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------
// Champs de formulaire
// -------------------------------------------------------------------------

export const Field: React.FC<{ label: string; hint?: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  hint,
  required,
  children,
}) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-secondary text-xs font-medium">
      {label} {required && <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>}
    </label>
    {children}
    {hint && <p className="text-muted text-[11px]">{hint}</p>}
  </div>
);

const inputBase =
  'w-full rounded-xl px-3 py-2.5 text-sm text-primary outline-none transition-colors focus:ring-2';

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
};

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`${inputBase} ${props.className || ''}`} style={{ ...inputStyle, ...props.style }} />
);

export const NumberInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    type="number"
    {...props}
    className={`${inputBase} ${props.className || ''}`}
    style={{ ...inputStyle, ...props.style }}
  />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea
    {...props}
    rows={props.rows || 3}
    className={`${inputBase} resize-none ${props.className || ''}`}
    style={{ ...inputStyle, ...props.style }}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }> = ({
  children,
  ...props
}) => (
  <select {...props} className={`${inputBase} ${props.className || ''}`} style={{ ...inputStyle, ...props.style }}>
    {children}
  </select>
);

// -------------------------------------------------------------------------
// Badge
// -------------------------------------------------------------------------

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'info';

const BADGE_TONES: Record<BadgeTone, { bg: string; text: string }> = {
  neutral: { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  success: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  warning: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  danger: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  accent: { bg: 'var(--color-accent)', text: '#000' },
  info: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
};

export const Badge: React.FC<{ tone?: BadgeTone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className,
}) => {
  const t = BADGE_TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${className || ''}`}
      style={{ backgroundColor: t.bg, color: t.text }}
    >
      {children}
    </span>
  );
};

export function statutSalleTone(s: string): BadgeTone {
  if (s === 'OUVERTE') return 'success';
  if (s === 'EN_TRAVAUX') return 'warning';
  return 'neutral';
}

export function statutSpecialTone(s: string): BadgeTone {
  switch (s) {
    case 'VIP':
      return 'accent';
    case 'A_SURVEILLER':
      return 'warning';
    case 'EXCLU':
    case 'AUTO_EXCLU':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function categorieScoreTone(c: string): BadgeTone {
  if (c === 'BON') return 'success';
  if (c === 'MOYEN') return 'warning';
  if (c === 'MAUVAIS') return 'danger';
  return 'neutral';
}

// -------------------------------------------------------------------------
// États
// -------------------------------------------------------------------------

export const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 py-8 text-muted text-sm">
    <Loader2 size={18} className="animate-spin" />
    {label || 'Chargement...'}
  </div>
);

export const EmptyState: React.FC<{ label: string; icon?: React.ReactNode }> = ({ label, icon }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted text-sm">
    {icon || <Inbox size={22} />}
    {label}
  </div>
);

export const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div
    className="rounded-xl px-3 py-2.5 text-xs font-medium"
    style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
  >
    {message}
  </div>
);

// -------------------------------------------------------------------------
// Carte / section
// -------------------------------------------------------------------------

export const SectionCard: React.FC<{
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, action, children, className }) => (
  <div
    className={`rounded-2xl p-4 md:p-5 w-full ${className || ''}`}
    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
  >
    {(title || action) && (
      <div className="flex items-center justify-between mb-3 gap-2">
        {title && <h4 className="text-primary text-sm md:text-base font-bold">{title}</h4>}
        {action}
      </div>
    )}
    {children}
  </div>
);

export { Button };

// -------------------------------------------------------------------------
// Formatage
// -------------------------------------------------------------------------

export function formatAriary(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toLocaleString('fr-FR')} Ar`;
}

export function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function clientLabel(c?: { nom?: string; prenom?: string | null; code_client?: string } | null): string {
  if (!c) return '—';
  const name = [c.prenom, c.nom].filter(Boolean).join(' ');
  return c.code_client ? `${name} (${c.code_client})` : name;
}
