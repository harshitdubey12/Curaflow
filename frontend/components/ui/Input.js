import { cn } from '../../lib/cn';

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-sm transition-all duration-200',
        'placeholder:text-slate-400',
        'hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12',
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, children, ...props }) {
  return (
    <label
      className={cn('block text-sm font-medium text-slate-700', className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function Field({ label, children, className }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  );
}
