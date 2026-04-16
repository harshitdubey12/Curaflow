import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/ui/Card';

const item = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function Home() {
  return (
    <AppShell
      title="Patient flow, simplified"
      subtitle="A calm queue for clinics. Staff use the doctor view; patients check in on the web or WhatsApp."
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 sm:gap-8">
        <motion.div
          variants={item}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/patient" className="group block outline-none">
            <Card className="relative h-full overflow-hidden border-brand-200/40 bg-gradient-to-br from-white via-white to-brand-50/50 p-0 transition-all duration-500 hover:-translate-y-1 hover:border-brand-300/50 hover:shadow-glow">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-brand-400/15 to-transparent blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative flex h-full flex-col justify-between gap-8 p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                    For patients
                  </p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                    Join the queue
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                    Register with your phone, see your token, and track your place in line in real time.
                  </p>
                </div>
                <span className="inline-flex items-center text-sm font-semibold text-brand-600 transition-all duration-300 group-hover:gap-2">
                  Open patient view
                  <span
                    aria-hidden
                    className="ml-1 inline-block transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </div>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          variants={item}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/doctor" className="group block outline-none">
            <Card className="relative h-full overflow-hidden border-emerald-200/40 bg-gradient-to-br from-white via-white to-accent-50/40 p-0 transition-all duration-500 hover:-translate-y-1 hover:border-emerald-300/50 hover:shadow-[0_16px_48px_-12px_rgba(16,185,129,0.18)]">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-accent-400/20 to-transparent blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative flex h-full flex-col justify-between gap-8 p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-600">
                    For staff
                  </p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                    Doctor dashboard
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                    See who is next, call patients in order, and skip when needed.
                  </p>
                </div>
                <span className="inline-flex items-center text-sm font-semibold text-accent-700 transition-all duration-300 group-hover:gap-2">
                  Open dashboard
                  <span
                    aria-hidden
                    className="ml-1 inline-block transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </div>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          variants={item}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/analytics" className="group block outline-none">
            <Card className="relative h-full overflow-hidden border-indigo-200/40 bg-gradient-to-br from-white via-white to-indigo-50/40 p-0 transition-all duration-500 hover:-translate-y-1 hover:border-indigo-300/50 hover:shadow-glow">
              <div className="relative flex h-full flex-col justify-between gap-6 p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                    Insights
                  </p>
                  <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900">
                    Analytics
                  </h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
                    Visits per day, average wait, and peak hours.
                  </p>
                </div>
                <span className="inline-flex items-center text-sm font-semibold text-indigo-700 transition-all duration-300 group-hover:gap-2">
                  View dashboard →
                </span>
              </div>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          variants={item}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href="/broadcast" className="group block outline-none">
            <Card className="relative h-full overflow-hidden border-amber-200/40 bg-gradient-to-br from-white via-white to-amber-50/30 p-0 transition-all duration-500 hover:-translate-y-1 hover:border-amber-300/50 hover:shadow-glow">
              <div className="relative flex h-full flex-col justify-between gap-6 p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                    Outreach
                  </p>
                  <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900">
                    Broadcast
                  </h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
                    WhatsApp everyone: camps, closures, reminders.
                  </p>
                </div>
                <span className="inline-flex items-center text-sm font-semibold text-amber-800 transition-all duration-300 group-hover:gap-2">
                  Send message →
                </span>
              </div>
            </Card>
          </Link>
        </motion.div>
      </div>
    </AppShell>
  );
}
