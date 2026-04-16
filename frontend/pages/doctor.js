import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { getSocketClientOptions } from '../lib/socketClient';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '../components/AppShell';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';
import { Input, Field } from '../components/ui/Input';
import { getApiBase, getApiUnreachableHelp } from '../lib/api';
import { setOfflineCache, getOfflineCache, onNetworkOnline } from '../lib/offlineService';
import { getStaffHeaders } from '../lib/staffHeaders';
import { useOnline } from '../lib/useOnline';
import { useDisplayBoardNav } from '../contexts/DisplayBoardNavContext';

function priorityVariant(p) {
  if (p >= 3) return 'priorityEmergency';
  if (p === 2) return 'priorityVip';
  if (p === 1) return 'priorityFollowup';
  return 'priorityNormal';
}

function priorityLabel(p) {
  if (p >= 3) return 'Emergency';
  if (p === 2) return 'VIP';
  if (p === 1) return 'Follow-up';
  return 'Normal';
}

function typeVariant(t) {
  return String(t).toLowerCase() === 'appointment' ? 'typeAppointment' : 'typeWalkin';
}

function typeLabel(t) {
  return String(t).toLowerCase() === 'appointment' ? 'Appointment' : 'Walk-in';
}

export default function DoctorPage() {
  const online = useOnline();
  const api = getApiBase();
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const selectedDoctorIdRef = useRef('');
  const deptFilterRef = useRef('all');
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [priorityBusyId, setPriorityBusyId] = useState(null);
  const [deptFilter, setDeptFilter] = useState('all');
  const [payAmount, setPayAmount] = useState('');
  const [historyPhone, setHistoryPhone] = useState('');
  const [doctorHistory, setDoctorHistory] = useState(null);
  const [doctorHistoryError, setDoctorHistoryError] = useState('');
  const [doctorHistoryLoading, setDoctorHistoryLoading] = useState(false);

  const { displayHref, setDisplayBoardPrefs } = useDisplayBoardNav();

  useEffect(() => {
    if (!selectedDoctorId) return;
    setDisplayBoardPrefs({
      doctorId: selectedDoctorId,
      department: deptFilter !== 'all' ? deptFilter : null,
    });
  }, [selectedDoctorId, deptFilter, setDisplayBoardPrefs]);

  const loadSnapshot = useCallback(
    async (doctorId, department) => {
      if (!doctorId) return;
      const deptQ =
        department && department !== 'all'
          ? `&department=${encodeURIComponent(department)}`
          : '';
      const cacheKey = `${doctorId}:${department || 'all'}`;
      try {
        const res = await fetch(
          `${api}/queue/snapshot?doctorId=${encodeURIComponent(doctorId)}${deptQ}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Load failed');
        setSnap(data);
        setOfflineCache('doctor', cacheKey, data);
        setError('');
      } catch {
        const cached = getOfflineCache('doctor', cacheKey);
        if (cached) {
          setSnap(cached);
          setError('Offline: showing last saved queue snapshot');
        } else {
          setError(getApiUnreachableHelp());
        }
      }
    },
    [api]
  );

  useEffect(() => {
    selectedDoctorIdRef.current = selectedDoctorId;
  }, [selectedDoctorId]);

  useEffect(() => {
    deptFilterRef.current = deptFilter;
  }, [deptFilter]);

  useEffect(() => {
    let socket;
    async function boot() {
      try {
        const dr = await fetch(`${api}/doctors`);
        const djson = await dr.json();
        const list = djson.doctors || [];
        setDoctors(list);
        const first = list[0]?.id || '';
        setSelectedDoctorId(first);
        if (first) await loadSnapshot(first, 'all');
      } catch {
        setError(getApiUnreachableHelp());
      } finally {
        setLoading(false);
      }
    }
    boot();

    socket = io(api, getSocketClientOptions());
    socket.on('queue:update', () => {
      const id = selectedDoctorIdRef.current;
      const d = deptFilterRef.current;
      if (id) {
        loadSnapshot(id, d).catch(() => {
          /* ignore transient refresh errors */
        });
      }
    });

    const unsubOnline = onNetworkOnline(() => {
      const id = selectedDoctorIdRef.current;
      const d = deptFilterRef.current;
      if (id) loadSnapshot(id, d);
    });

    return () => {
      socket.disconnect();
      unsubOnline();
    };
  }, [api, loadSnapshot]);

  useEffect(() => {
    const a = snap?.currentPatient?.amount;
    if (a != null && a !== '') setPayAmount(String(a));
    else if (!snap?.currentPatient?.visitId) setPayAmount('');
  }, [snap?.currentPatient?.visitId, snap?.currentPatient?.amount]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    loadSnapshot(selectedDoctorId, deptFilter).catch(() => {
      setError('Could not refresh queue for this doctor.');
    });
  }, [selectedDoctorId, deptFilter, loadSnapshot]);

  async function postAction(path, doctorId) {
    setError('');
    setBusy(true);
    try {
      const body = { doctorId };
      if (deptFilter && deptFilter !== 'all') {
        body.department = deptFilter;
      }
      const res = await fetch(`${api}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
    } catch (e) {
      setError(e.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function loadDoctorPatientHistory() {
    const raw = historyPhone.trim();
    if (!raw) {
      setDoctorHistoryError('Enter a phone number');
      return;
    }
    setDoctorHistoryError('');
    setDoctorHistoryLoading(true);
    setDoctorHistory(null);
    try {
      const lr = await fetch(`${api}/patient/lookup?phone=${encodeURIComponent(raw)}`, {
        headers: { ...getStaffHeaders() },
      });
      const lu = await lr.json();
      if (!lr.ok) throw new Error(lu.error || 'Lookup failed');
      const hr = await fetch(
        `${api}/patient/${encodeURIComponent(lu.patientId)}/history?phone=${encodeURIComponent(raw)}`
      );
      const data = await hr.json();
      if (!hr.ok) throw new Error(data.error || 'History failed');
      setDoctorHistory(data);
    } catch (e) {
      setDoctorHistoryError(e.message || 'Failed to load history');
    } finally {
      setDoctorHistoryLoading(false);
    }
  }

  async function markVisitPaid() {
    const vid = snap?.currentPatient?.visitId;
    if (!vid || !selectedDoctorId) return;
    setError('');
    setBusy(true);
    try {
      const raw = payAmount.trim();
      const res = await fetch(`${api}/visit/${encodeURIComponent(vid)}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          paymentStatus: 'paid',
          amount: raw === '' ? undefined : Number(raw),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      await loadSnapshot(selectedDoctorId, deptFilter);
    } catch (e) {
      setError(e.message || 'Payment update failed');
    } finally {
      setBusy(false);
    }
  }

  async function updateRowPriority(queueEntryId, value) {
    if (!queueEntryId || !selectedDoctorId) return;
    setError('');
    setPriorityBusyId(queueEntryId);
    try {
      const res = await fetch(`${api}/queue/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          queueEntryId,
          priority: Number(value),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
    } catch (e) {
      setError(e.message || 'Priority update failed');
    } finally {
      setPriorityBusyId(null);
    }
  }

  if (loading) {
    return (
      <AppShell title="Doctor" subtitle="Loading queue…" wide>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <SkeletonCard />
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-3xl" />
          </div>
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      wide
      title="Doctor dashboard"
      subtitle="Pick a doctor, then run the queue for that room. Token numbers are unique clinic-wide (all rooms share one sequence). Use the priority menu on each waiting row to set Normal, Follow-up, VIP, or Emergency (WhatsApp signups default to Normal)."
    >
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {!online && (
        <p
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          You appear offline. Showing the last saved queue when available; reconnect to sync live data.
        </p>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="max-w-md flex-1">
          <label className="mb-2 block text-sm font-medium text-slate-700">Doctor</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-500/30"
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.specialization ? ` · ${d.specialization}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="max-w-xs">
          <label className="mb-2 block text-sm font-medium text-slate-700">Department</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-500/30"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="general">General</option>
            <option value="dental">Dental</option>
            <option value="skin">Skin</option>
          </select>
        </div>
      </div>
      <p className="mb-6 text-sm text-slate-600">
        <Link
          href={displayHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-cyan-700 underline decoration-cyan-600/30 underline-offset-2 hover:text-cyan-800"
        >
          Open TV display
        </Link>
        <span className="text-slate-500">
          {' '}
          (uses this doctor and department filter so the screen matches this desk)
        </span>
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          layout
          className="lg:col-span-2 space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="relative overflow-hidden border-2 border-cyan-400/35 bg-gradient-to-br from-white via-cyan-50/30 to-emerald-50/25 shadow-[0_20px_60px_-24px_rgba(6,182,212,0.35)] ring-1 ring-cyan-500/10">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl" />
            <CardHeader className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Now serving</CardTitle>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {snap?.doctorName ? `Room · ${snap.doctorName}` : 'Active consultation'}
                </p>
              </div>
              <Badge variant="active">Live</Badge>
            </CardHeader>

            <AnimatePresence mode="wait">
              {snap?.currentPatient ? (
                <motion.div
                  key={snap.currentToken}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
                >
                  <div>
                    <p className="text-5xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-6xl">
                      {snap.currentToken}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{snap.currentPatient.name}</p>
                    <p className="text-sm text-slate-500 tabular-nums">{snap.currentPatient.phone}</p>
                    {snap.currentPatient.department && (
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Dept · <span className="capitalize text-slate-700">{snap.currentPatient.department}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="active">In progress</Badge>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative py-4"
                >
                  <p className="text-sm text-slate-500">No active patient. Tap Next to call the next token.</p>
                  <p className="mt-2 text-xs text-slate-400">Waiting: {snap?.waitingCount ?? 0} in line</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {snap?.currentPatient?.visitId && (
            <Card className="mt-4 border-amber-200/70 bg-gradient-to-br from-amber-50/50 to-white">
              <CardHeader>
                <CardTitle>Consultation payment</CardTitle>
                <p className="mt-1 text-xs text-slate-500">Manual tracking only. No card processing on this screen.</p>
              </CardHeader>
              <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:flex-wrap sm:items-end">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
                  <p className="text-lg font-semibold capitalize text-slate-900">
                    {snap.currentPatient.paymentStatus || 'pending'}
                  </p>
                </div>
                <div className="sm:min-w-[10rem]">
                  <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="pay-amt">
                    Amount
                  </label>
                  <input
                    id="pay-amt"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-cyan-500/30"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={busy}
                  onClick={markVisitPaid}
                >
                  Mark as paid
                </Button>
              </div>
            </Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Button
              className="w-full sm:flex-1 sm:text-base"
              disabled={busy || !selectedDoctorId}
              onClick={() => postAction('/queue/next', selectedDoctorId)}
            >
              Next
            </Button>
            <Button
              variant="outlineDanger"
              className="w-full sm:flex-1 sm:text-base"
              disabled={busy || !selectedDoctorId}
              onClick={() => postAction('/queue/skip', selectedDoctorId)}
            >
              Skip
            </Button>
          </div>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35 }}
          className="space-y-4"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Waiting</CardTitle>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{snap?.waitingCount ?? 0}</p>
              </div>
              <Badge variant="waiting">Queue</Badge>
            </CardHeader>
            <p className="text-xs text-slate-500">Updates in real time when patients join or you advance the line.</p>
          </Card>
        </motion.aside>
      </div>

      <Card className="mt-8 border-slate-200/80 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.12)]">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Upcoming</CardTitle>
          <span className="text-xs font-medium text-slate-400">Token · Patient · Dept · Priority · Type</span>
        </CardHeader>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/40 lg:rounded-xl">
          <div className="hidden grid-cols-[72px_1fr_88px_140px_100px_auto] gap-3 border-b border-slate-100/90 bg-white/90 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 lg:grid">
            <span>Token</span>
            <span>Patient</span>
            <span>Dept</span>
            <span>Priority</span>
            <span>Type</span>
            <span className="text-right">Status</span>
          </div>

          <AnimatePresence initial={false}>
            {snap?.waiting?.length ? (
              snap.waiting.map((row, i) => (
                <motion.div
                  key={row.queueEntryId || `t-${row.token}`}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 360, damping: 30 }}
                  className="grid grid-cols-1 gap-4 border-b border-slate-100/80 bg-white px-4 py-5 last:border-0 lg:grid-cols-[72px_1fr_88px_140px_100px_auto] lg:items-center lg:gap-3 lg:py-4"
                >
                  <div className="flex items-start justify-between gap-3 lg:block lg:justify-start">
                    <span className="text-3xl font-bold tabular-nums leading-none text-slate-900 lg:text-2xl lg:font-semibold">
                      {row.token}
                    </span>
                    <div className="flex flex-wrap justify-end gap-2 lg:hidden">
                      <Badge variant={priorityVariant(row.priority ?? 0)}>{priorityLabel(row.priority ?? 0)}</Badge>
                      <Badge variant={typeVariant(row.type)}>{typeLabel(row.type)}</Badge>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900">{row.name}</span>
                    <p className="mt-0.5 text-sm tabular-nums text-slate-500">{row.phone}</p>
                  </div>
                  <div className="text-sm font-medium capitalize text-slate-700">{row.department ?? 'general'}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.queueEntryId ? (
                      <select
                        className="w-full max-w-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm outline-none transition focus:ring-2 focus:ring-cyan-500/25"
                        aria-label={`Priority for token ${row.token}`}
                        value={String(row.priority ?? 0)}
                        disabled={priorityBusyId === row.queueEntryId}
                        onChange={(e) => updateRowPriority(row.queueEntryId, e.target.value)}
                      >
                        <option value="0">Normal</option>
                        <option value="1">Follow-up</option>
                        <option value="2">VIP</option>
                        <option value="3">Emergency</option>
                      </select>
                    ) : (
                      <Badge variant={priorityVariant(row.priority ?? 0)}>{priorityLabel(row.priority ?? 0)}</Badge>
                    )}
                  </div>
                  <div className="hidden lg:block">
                    <Badge variant={typeVariant(row.type)}>{typeLabel(row.type)}</Badge>
                  </div>
                  <div className="flex justify-end">
                    <Badge variant="waiting">Waiting</Badge>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white px-4 py-14 text-center text-sm text-slate-500"
              >
                No one waiting. New patients will appear here automatically.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Patient history</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Enter the patient&apos;s phone (same as on file). Lookup verifies the number before showing visits.
          </p>
        </CardHeader>
        <div className="space-y-4 px-4 pb-6 sm:px-6">
          <Field label="Patient phone">
            <Input
              value={historyPhone}
              onChange={(e) => setHistoryPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>
          <Button type="button" variant="secondary" disabled={doctorHistoryLoading} onClick={loadDoctorPatientHistory}>
            {doctorHistoryLoading ? 'Loading…' : 'Load visit history'}
          </Button>
          {doctorHistoryError && (
            <p className="text-sm text-rose-600" role="alert">
              {doctorHistoryError}
            </p>
          )}
          {doctorHistory?.patient?.symptoms && (
            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium text-slate-800">Profile symptoms: </span>
              {doctorHistory.patient.symptoms}
            </p>
          )}
          {doctorHistory?.visits?.length > 0 && (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {doctorHistory.visits.map((v) => (
                <li key={v.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-slate-800">
                  <span className="font-medium tabular-nums">{new Date(v.createdAt).toLocaleString()}</span>
                  <span className="ml-2 text-slate-500">{v.status}</span>
                  {v.doctor?.name && <span className="ml-2 text-slate-600">· {v.doctor.name}</span>}
                  {v.symptoms && (
                    <span className="mt-1 block text-xs text-slate-600">Visit symptoms: {v.symptoms}</span>
                  )}
                  {v.paymentStatus && (
                    <span className="mt-1 block text-xs text-slate-500">
                      Payment: {v.paymentStatus}
                      {v.amount != null ? ` · ${v.amount}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {doctorHistory && !doctorHistory.visits?.length && !doctorHistoryError && (
            <p className="text-sm text-slate-500">No visits on file for this patient.</p>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
