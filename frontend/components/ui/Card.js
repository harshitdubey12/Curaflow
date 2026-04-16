import { cn } from '../../lib/cn';

export function Card({ className, children }) {
  return (
    <div
      className={cn(
        'group/card rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-card backdrop-blur-sm transition duration-300 sm:rounded-3xl sm:p-8',
        'hover:border-slate-200 hover:shadow-[0_16px_48px_-12px_rgba(15,23,42,0.1)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return <div className={cn('mb-5 sm:mb-6', className)}>{children}</div>;
}

export function CardTitle({ className, children }) {
  return (
    <h2
      className={cn(
        'text-xs font-semibold uppercase tracking-[0.14em] text-slate-400',
        className
      )}
    >
      {children}
    </h2>
  );
}
