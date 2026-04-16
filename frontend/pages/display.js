import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import { getSocketClientOptions } from '../lib/socketClient';
import { motion } from 'framer-motion';
import { getApiBase } from '../lib/api';
import { setOfflineCache, getOfflineCache, onNetworkOnline } from '../lib/offlineService';

function formatDeptLabel(d) {
  if (d == null || String(d).trim() === '') return '';
  const s = String(d).trim().toLowerCase();
  if (s === 'general') return 'General';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DisplayPage() {
  const api = getApiBase();
  const router = useRouter();
  const doctorQ = router.query.doctorId != null ? String(router.query.doctorId) : '';
  const deptQ =
    router.query.department != null && String(router.query.department).trim() !== ''
      ? String(router.query.department).trim().toLowerCase()
      : '';

  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');

  const loadBoard = useCallback(async () => {
    const params = new URLSearchParams();
    if (doctorQ) params.set('doctorId', doctorQ);
    if (deptQ) params.set('department', deptQ);
    const qs = params.toString();
    const url = qs ? `${api}/display/board?${qs}` : `${api}/display/board`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setBoard(data);
      setError('');
      const cacheKey = `${doctorQ || 'default'}|${deptQ || 'all'}`;
      setOfflineCache('display', cacheKey, data);
    } catch (e) {
      const cacheKey = `${doctorQ || 'default'}|${deptQ || 'all'}`;
      const cached = getOfflineCache('display', cacheKey);
      if (cached) {
        setBoard(cached);
        setError('Offline: showing last saved board');
      } else {
        setError(e.message || 'Cannot load display');
      }
    }
  }, [api, doctorQ, deptQ]);

  useEffect(() => {
    if (!router.isReady) return undefined;
    loadBoard();
    const socket = io(api, getSocketClientOptions());
    socket.on('queue:update', () => {
      loadBoard();
    });
    const unsub = onNetworkOnline(() => {
      loadBoard();
    });
    return () => {
      socket.disconnect();
      unsub();
    };
  }, [api, loadBoard, router.isReady]);

  const current = board?.currentToken;
  const filterLabel = formatDeptLabel(board?.departmentFilter);
  const laneNote =
    board?.departmentFilter && board.departmentFilter !== 'all'
      ? `${filterLabel} desk`
      : 'All departments';
  const nextQueue = board?.nextQueue;
  const nextList = Array.isArray(nextQueue) && nextQueue.length
    ? nextQueue
    : (board?.nextTokens ?? []).map((token) => ({ token, department: null }));

  return (
    <>
      <Head>
        <title>Queue display · Curaflow</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <div
        className="fixed inset-0 flex flex-col bg-zinc-950 text-zinc-50"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          {board?.doctorName && (
            <p className="mb-2 text-center text-xl font-medium uppercase tracking-[0.2em] text-zinc-400">
              {board.doctorName}
            </p>
          )}
          <p className="mb-6 text-center text-sm font-medium text-zinc-500">{laneNote}</p>

          <p className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-cyan-400/95">
            Now serving
          </p>
          <motion.div
            key={current ?? 'empty'}
            initial={{ scale: 0.96, opacity: 0.85 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className={
              current != null
                ? 'rounded-3xl border-4 border-cyan-400/90 bg-gradient-to-b from-cyan-500/20 to-emerald-600/10 px-12 py-10 shadow-[0_0_80px_rgba(34,211,238,0.45)] sm:px-16 sm:py-12'
                : 'rounded-3xl border-4 border-zinc-700 px-12 py-10 sm:px-16 sm:py-12'
            }
          >
            <motion.p
              animate={
                current != null
                  ? {
                      scale: [1, 1.02, 1],
                      textShadow: [
                        '0 0 0 rgba(34,211,238,0)',
                        '0 0 48px rgba(34,211,238,0.55)',
                        '0 0 0 rgba(34,211,238,0)',
                      ],
                    }
                  : {}
              }
              transition={{
                duration: 2.4,
                repeat: current != null ? Infinity : 0,
                ease: 'easeInOut',
              }}
              className="text-center font-bold tabular-nums text-white"
              style={{ fontSize: 'clamp(4rem, 18vw, 12rem)', lineHeight: 1 }}
            >
              {current ?? '—'}
            </motion.p>
            {board?.currentDepartment && (
              <p className="mt-4 text-center text-lg font-semibold uppercase tracking-widest text-cyan-200/90">
                {formatDeptLabel(board.currentDepartment)}
              </p>
            )}
            {board?.currentPatientName && (
              <p className="mt-2 text-center text-base font-medium text-zinc-400">{board.currentPatientName}</p>
            )}
          </motion.div>

          <div className="mt-14 w-full max-w-5xl">
            <p className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Next in line
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {nextList.length ? (
                nextList.map((entry, i) => {
                  const tok = typeof entry === 'object' ? entry.token : entry;
                  const dep = typeof entry === 'object' ? entry.department : null;
                  return (
                    <div
                      key={`${tok}-${dep ?? 'x'}-${i}`}
                      className="flex min-w-[6rem] flex-col items-center rounded-2xl border border-zinc-700 bg-zinc-900/90 px-6 py-4 text-center shadow-lg shadow-black/30 sm:min-w-[7rem] sm:px-8 sm:py-5"
                    >
                      <span className="text-4xl font-semibold tabular-nums text-zinc-100 sm:text-5xl">{tok}</span>
                      {dep && (
                        <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          {formatDeptLabel(dep)}
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <span className="text-lg text-zinc-500">No queue ahead</span>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-10 max-w-lg text-center text-sm text-amber-300/90" role="status">
              {error}
            </p>
          )}
        </div>
        <div className="border-t border-zinc-800 py-3 text-center text-xs text-zinc-600">
          {board?.updatedAt ? `Updated ${new Date(board.updatedAt).toLocaleTimeString()}` : ''}
          {board?.waitingCount != null ? ` · Waiting ${board.waitingCount}` : ''}
        </div>
      </div>
    </>
  );
}
