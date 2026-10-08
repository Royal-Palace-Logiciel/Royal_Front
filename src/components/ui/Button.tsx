// src/components/UI/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, className, ...props }) => {
  const baseClasses = 'h-10 px-4 rounded-xl font-medium transition-colors flex items-center justify-center';
  let variantClasses = '';
  if (variant === 'primary') variantClasses = 'bg-accent text-black hover:bg-accent-2 shadow-accent';
  else if (variant === 'secondary') variantClasses = 'bg-surface-2 text-secondary hover:bg-surface-3 border border-base';
  else if (variant === 'danger') variantClasses = 'bg-danger text-white hover:bg-danger-dark';

  return (
    <button className={`${baseClasses} ${variantClasses} ${className}`} style={{ backgroundColor: variant === 'primary' ? 'var(--color-accent)' : undefined }} {...props}>
      {children}
    </button>
  );
};