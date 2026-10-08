// src/components/UI/Select.tsx
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className, ...props }) => (
  <div>
    {label && <label className="block text-sm text-secondary mb-1">{label}</label>}
    <select
      className={`w-full h-10 px-3 rounded-xl text-primary bg-surface-2 border border-base focus:outline-none focus:ring-2 focus:ring-accent/50 ${className}`}
      style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);