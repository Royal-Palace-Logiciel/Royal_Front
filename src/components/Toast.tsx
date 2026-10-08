// src/components/Toast.tsx (Version avec animation améliorée - TOASTS AU CENTRE)
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} className="text-emerald-400" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-400" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-amber-400" />;
      case 'info':
        return <Info size={20} className="text-blue-400" />;
      default:
        return <CheckCircle size={20} className="text-emerald-400" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/20';
      default:
        return 'bg-emerald-500/10 border-emerald-500/20';
    }
  };

  // Animation de sortie en fondu (toast centré)
  const getAnimationClass = () => {
    if (isExiting) {
      return 'opacity-0 scale-95';
    }
    return 'opacity-100 scale-100';
  };

  if (!isVisible) return null;

  return (
    <div
      className={`transform transition-all duration-300 ease-out ${getAnimationClass()}`}
    >
      <div
        className={`flex items-start gap-3 p-3 rounded-xl border ${getBackgroundColor()} shadow-2xl min-w-[280px] max-w-sm`}
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        {/* Icône */}
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary font-medium leading-relaxed">
            {message}
          </p>
        </div>

        {/* Bouton fermer */}
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => {
              setIsVisible(false);
              onClose();
            }, 300);
          }}
          className="flex-shrink-0 text-muted hover:text-primary transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type?: ToastType;
    duration?: number;
  }>;
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[10000] flex w-[calc(100%-2rem)] justify-end pointer-events-none sm:w-auto">
      <div className="pointer-events-auto flex w-full flex-col items-end gap-3 sm:w-auto">
        {[...toasts].reverse().map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => onRemove(toast.id)}
          />
        ))}
      </div>
    </div>,
    document.body
  );
};

export default Toast;