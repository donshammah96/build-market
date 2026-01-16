'use client';

import * as React from 'react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  const variants = {
    default: 'bg-[#E0C9A6] text-[#142620] hover:bg-white uppercase tracking-widest border border-[#E0C9A6] transition-all duration-500',
    outline: 'bg-transparent text-[#E0C9A6] border border-[#E0C9A6] hover:bg-[#E0C9A6] hover:text-[#142620] transition duration-500 ease-out',
    ghost: 'hover:bg-[#E0C9A6]/10 text-[#E0C9A6]',
    link: 'text-white hover:text-[#E0C9A6] transition gap-2 no-underline p-0',
  };

  const sizes = {
    default: 'h-10 px-6 py-2 text-xs font-bold',
    sm: 'h-9 rounded-md px-3 text-xs',
    lg: 'h-14 px-8 text-sm tracking-[0.2em]',
    icon: 'h-10 w-10',
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-none ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0C9A6] disabled:opacity-50',
        variants[variant],
        sizes[size],
        className ?? ''
      )}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-12 w-full rounded-none border border-[#E0C9A6]/30 bg-[#0F1D18] px-4 py-2 text-sm text-[#E0C9A6] placeholder:text-[#E0C9A6]/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E0C9A6]',
      className ?? ''
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-12 w-full rounded-none border border-[#E0C9A6]/30 bg-[#0F1D18] px-4 py-2 text-sm text-[#E0C9A6] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E0C9A6] appearance-none',
      className ?? ''
    )}
    {...props}
  />
));
Select.displayName = 'Select';