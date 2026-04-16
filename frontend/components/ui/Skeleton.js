import { cn } from '../../lib/cn';

export function Skeleton({ className }) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%]', className)}
      aria-hidden
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
