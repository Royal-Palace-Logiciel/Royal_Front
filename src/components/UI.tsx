import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../utils/data';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  trend?: number;
  subtitle?: string;
  isCurrency?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, value, icon, gradient, trend, subtitle, isCurrency 
}) => {
  const displayValue = isCurrency ? formatCurrency(Number(value)) : value;
  
  return (
    <div className="relative overflow-hidden bg-slate-900 border border-slate-800/50 rounded-2xl p-6 hover:border-slate-700/50 transition-all duration-300 group">
      {/* Background glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 bg-gradient-to-br ${gradient} group-hover:opacity-20 transition-opacity`} />
      
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-white font-bold text-2xl mb-1">{displayValue}</p>
          {subtitle && <p className="text-slate-600 text-xs">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span className="text-xs font-semibold">{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
              <span className="text-slate-600 text-xs">vs hier</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

interface TableProps<T> {
  data: T[];
  columns: { key: string; label: string; render?: (item: T) => React.ReactNode }[];
  title?: string;
  className?: string;
}

export function DataTable<T extends { id: string | number }>({ data, columns, title, className }: TableProps<T>) {
  return (
    <div className={`bg-slate-900 border border-slate-800/50 rounded-2xl overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-slate-800/50">
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/50">
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-left text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-600 text-sm">
                  Aucune donnée disponible
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-sm">
                      {col.render 
                        ? col.render(item)
                        : <span className="text-slate-300">{String((item as Record<string, unknown>)[col.key] ?? '')}</span>
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, headerExtra, children, size = 'md' }) => {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'w-[90vw] max-w-[1500px]'
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden ${sizeClasses[size]} bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
          <h3 className="flex-1 text-white font-semibold text-lg">{title}</h3>
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => (
  <div className="space-y-1">
    {label && <label className="text-slate-400 text-sm font-medium">{label}</label>}
    <input
      {...props}
      className={`w-full h-11 px-4 bg-slate-800 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50 transition-all ${error ? 'border-red-500/50' : ''} ${className}`}
    />
    {error && <p className="text-red-400 text-xs">{error}</p>}
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => (
  <div className="space-y-1">
    {label && <label className="text-slate-400 text-sm font-medium">{label}</label>}
    <select
      {...props}
      className={`w-full h-11 px-4 bg-slate-800 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all appearance-none ${className}`}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', size = 'md', icon, className = '', ...props 
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-semibold shadow-lg shadow-amber-500/20',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/50',
    danger: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white',
    ghost: 'bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white'
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base'
  };

  return (
    <button
      {...props}
      className={`flex items-center gap-2 rounded-xl transition-all duration-200 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = '', className = '' }) => {
  const baseColors: Record<string, string> = {
    disponible: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    faible: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    epuise: 'bg-red-500/15 text-red-400 border border-red-500/30',
    actif: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    inactif: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    admin: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
    manager: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    caissier: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    stock_manager: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
    confirmee: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    en_cours: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    terminee: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    annulee: 'bg-red-500/15 text-red-400 border border-red-500/30',
    payee: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    libre: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    occupee: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    maintenance: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    reservee: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    entree: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    sortie: 'bg-red-500/15 text-red-400 border border-red-500/30',
  };

  const colorClass = baseColors[variant] || 'bg-slate-500/15 text-slate-400 border border-slate-500/30';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}>
      {children}
    </span>
  );
};

interface CaisseCardProps {
  solde: number;
  entrees: number;
  sorties: number;
  title?: string;
  gradient?: string;
}

export const CaisseCard: React.FC<CaisseCardProps> = ({ 
  solde, entrees, sorties, title = 'Caisse', gradient = 'from-amber-500 to-orange-500'
}) => (
  <div className="bg-slate-900 border border-slate-800/50 rounded-2xl overflow-hidden">
    <div className={`bg-gradient-to-r ${gradient} px-6 py-5`}>
      <p className="text-white/75 text-xs font-medium uppercase tracking-wide">{title}</p>
      <p className="text-white text-3xl font-black mt-1">{formatCurrency(Number(solde) || 0)}</p>
      <p className="text-white/70 text-xs mt-1">Solde actuel</p>
    </div>
    <div className="grid grid-cols-2 divide-x divide-slate-800/50">
      <div className="px-6 py-4">
        <p className="text-slate-500 text-xs">Entrées</p>
        <p className="text-emerald-400 text-lg font-bold mt-1">+ {formatCurrency(Number(entrees) || 0)}</p>
      </div>
      <div className="px-6 py-4">
        <p className="text-slate-500 text-xs">Sorties</p>
        <p className="text-red-400 text-lg font-bold mt-1">- {formatCurrency(Number(sorties) || 0)}</p>
      </div>
    </div>
  </div>
);
