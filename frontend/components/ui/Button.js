import { cn } from '../../lib/cn';

const variants = {
  primary:
    'bg-gradient-to-b from-cyan-600 to-cyan-700 text-white shadow-md shadow-cyan-600/20 ring-1 ring-white/10 hover:from-cyan-500 hover:to-cyan-600 hover:shadow-lg hover:shadow-cyan-600/25 focus-visible:ring-cyan-500/50',
  secondary:
    'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/90 hover:bg-slate-50 hover:ring-slate-300 focus-visible:ring-slate-400/40',
  outline:
    'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 focus-visible:ring-slate-400/40',
  outlineDanger:
    'bg-white text-rose-700 shadow-sm ring-1 ring-rose-200/90 hover:bg-rose-50 hover:ring-rose-300 focus-visible:ring-rose-400/40',
  danger:
    'bg-gradient-to-b from-rose-600 to-rose-700 text-white shadow-md shadow-rose-600/20 hover:from-rose-500 hover:to-rose-600 focus-visible:ring-rose-500/40',
  warning:
    'bg-gradient-to-b from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 focus-visible:ring-amber-400/40',
};

export function Button({ variant = 'primary', className, children, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-[48px] min-w-[120px] items-center justify-center rounded-2xl px-6 text-sm font-semibold tracking-tight transition-all duration-200 ease-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45',
        variants[variant] || variants.primary,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
