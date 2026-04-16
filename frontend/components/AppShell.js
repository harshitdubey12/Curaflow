'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/cn';
import { useDisplayBoardNav } from '../contexts/DisplayBoardNavContext';

export function AppShell({ title, subtitle, children, className, wide = false }) {
  const router = useRouter();
  const { displayHref } = useDisplayBoardNav();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <div className={cn('relative min-h-screen overflow-x-hidden', className)}>
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgb(14 116 144 / 0.07), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgb(59 130 246 / 0.05), transparent)',
        }}
      />

      <AnimatePresence>
        {menuOpen && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] md:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-transform duration-300 ease-out md:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <Link href="/" className="group flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-md ring-1 ring-white/20 transition group-hover:scale-[1.02]">
              C
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-slate-900">Curaflow</p>
              <p className="text-[11px] font-medium text-slate-400">Clinic queue</p>
            </div>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Navigate</p>
          {NAV.map(({ href, label, Icon }) => {
            const navHref = href === '/display' ? displayHref : href;
            const active =
              href === '/display'
                ? router.pathname === '/display'
                : router.pathname === href;
            return (
              <Link
                key={href}
                href={navHref}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-cyan-200' : 'text-slate-400')} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <p className="px-3 text-[11px] leading-relaxed text-slate-400">
            Demo-ready · Real-time queue · Secure patient data
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col md:pl-[280px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md md:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-expanded={menuOpen}
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="truncate text-sm font-semibold text-slate-900">{title || 'Curaflow'}</span>
          <span className="w-10" aria-hidden />
        </header>

        <header className="sticky top-0 z-20 hidden h-14 shrink-0 items-center border-b border-slate-200/80 bg-white/90 px-8 backdrop-blur-md md:flex lg:px-10">
          <p className="truncate text-base font-semibold tracking-tight text-slate-900">{title || 'Curaflow'}</p>
        </header>

        <main
          className={cn(
            'flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-10 lg:pt-12',
            wide ? 'max-w-[1440px]' : 'max-w-5xl',
            'mx-auto w-full'
          )}
        >
          {(title || subtitle) && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="mb-10 max-w-2xl md:mb-8 md:hidden"
              >
                {title && (
                  <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-3 text-base leading-relaxed text-slate-500 sm:text-lg">{subtitle}</p>
                )}
              </motion.div>
              {subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 }}
                  className="mb-10 hidden max-w-2xl text-sm leading-relaxed text-slate-500 md:block"
                >
                  {subtitle}
                </motion.p>
              )}
            </>
          )}
          {children}
        </main>

        <footer className="border-t border-slate-200/60 bg-white/50 py-8 text-center backdrop-blur-sm md:pl-0">
          <p className="text-xs font-medium tracking-wide text-slate-400">Curaflow · clinic queue</p>
        </footer>
      </div>
    </div>
  );
}

function IconHome({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function IconUser({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function IconClipboard({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}
function IconMonitor({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconChart({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconMegaphone({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  );
}
function IconUsers({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

const NAV = [
  { href: '/', label: 'Home', Icon: IconHome },
  { href: '/patient', label: 'Patient', Icon: IconUser },
  { href: '/doctor', label: 'Doctor', Icon: IconClipboard },
  { href: '/display', label: 'Display', Icon: IconMonitor },
  { href: '/analytics', label: 'Analytics', Icon: IconChart },
  { href: '/admin/doctors', label: 'Roster', Icon: IconUsers },
  { href: '/broadcast', label: 'Broadcast', Icon: IconMegaphone },
];
