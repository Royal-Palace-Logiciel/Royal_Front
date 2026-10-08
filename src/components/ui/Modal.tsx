// src/components/UI/Modal.tsx
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const maxWidth = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-lg' : size === 'xl' ? 'max-w-4xl' : size === '2xl' ? 'max-w-6xl' : size === 'full' ? 'w-[90vw] max-w-[1500px]' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`bg-surface rounded-xl w-full ${maxWidth} shadow-xl`} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-primary font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-primary">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};