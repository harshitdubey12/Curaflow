import { motion } from 'framer-motion';

/**
 * Queue progress: higher when closer to being served (fewer people ahead).
 */
export function QueueProgress({ ahead, status, className }) {
  const isActive = status === 'IN_PROGRESS';
  const pct = isActive
    ? 100
    : Math.max(6, Math.min(96, Math.round(100 * (1 - ahead / (ahead + 4)))));

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-500">
        <span>Queue progress</span>
        <span className="tabular-nums text-slate-700">
          {isActive ? 'Serving you' : `${pct}%`}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/80">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 shadow-sm"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
      </div>
    </div>
  );
}
