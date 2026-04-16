import { cn } from '../../lib/cn';

const variants = {
  active:
    'bg-emerald-50 text-emerald-800 ring-emerald-500/20 shadow-sm shadow-emerald-600/5',
  waiting:
    'bg-amber-50 text-amber-900 ring-amber-500/20 shadow-sm shadow-amber-500/5',
  urgent: 'bg-rose-50 text-rose-800 ring-rose-500/20 shadow-sm',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-400/15',
  priorityEmergency: 'bg-red-50 text-red-900 ring-red-500/25',
  priorityVip: 'bg-yellow-50 text-yellow-900 ring-yellow-500/25',
  priorityFollowup: 'bg-blue-50 text-blue-800 ring-blue-500/20',
  priorityNormal: 'bg-slate-100 text-slate-600 ring-slate-400/15',
  typeWalkin: 'bg-slate-50 text-slate-700 ring-slate-300/40',
  typeAppointment: 'bg-violet-50 text-violet-900 ring-violet-500/20',
};

export function Badge({ variant = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors',
        variants[variant] || variants.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}
