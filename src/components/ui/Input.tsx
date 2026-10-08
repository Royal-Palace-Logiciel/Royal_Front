// src/components/UI/Input.tsx
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className, ...props }) => (
  <div>
    {label && <label className="block text-sm text-secondary mb-1">{label}</label>}
    <input
      className={`w-full h-10 px-3 rounded-xl text-primary bg-surface-2 border border-base focus:outline-none focus:ring-2 focus:ring-accent/50 ${className}`}
      style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
      {...props}
    />
  </div>
);