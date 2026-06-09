import React from 'react';
import { cn } from '@/utils';

export function Button({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }) {
  const baseStyles = "inline-flex items-center justify-center rounded-full text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:pointer-events-none ring-offset-[#0A0A0A]";
  const variants = {
    primary: "bg-amber-500 text-black hover:bg-amber-400",
    secondary: "bg-white/5 text-gray-200 hover:bg-white/10",
    outline: "border border-white/10 hover:bg-white/10 text-gray-200",
    ghost: "hover:bg-white/5 text-gray-400 hover:text-white",
    danger: "bg-red-500/20 text-red-500 hover:bg-red-500/30",
  };
  
  return (
    <button className={cn(baseStyles, variants[variant], "h-10 py-2 px-6", className)} {...props} />
  );
}
