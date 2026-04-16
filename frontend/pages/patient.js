import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getSocketClientOptions } from '../lib/socketClient';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '../components/AppShell';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Field } from '../components/ui/Input';
import { QueueProgress } from '../components/QueueProgress';
import { getApiBase } from '../lib/api';
import {
  setOfflineCache,
  getOfflineCache,
  onNetworkOnline,
  enqueuePendingPatientWrite,
  flushPendingPatientWrites,
} from '../lib/offlineService';
import { useOnline } from '../lib/useOnline';

const LAST_PHONE_KEY = 'curaflow:lastPhone';

function persistLastPhone(p) {
  if (typeof window === 'undefined' || !p?.trim()) return;
  try {
    window.localStorage.setItem(LAST_PHONE_KEY, p.trim());
  } catch {
    /* ignore */
  }
}

export default function PatientPage() {
  const online = useOnline();
  const api = getApiBase();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [visitType, setVisitType] = useState('walkin');
  const [priority, setPriority] = useState('0');
  const [language, setLanguage] = useState('en');
  /** empty = let AI infer from symptoms */
  const [department, setDepartment] = useState('');
  const [appointmentLocal, setAppointmentLocal] = useState('');
  const [status, setStatus] = useState(null);
  const [registerResult, setRegisterResult] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rescheduleLocal, setRescheduleLocal] = useState('');
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await fetch(`${api}/doctors`);
        const data = await res.json();
        const list = data.doctors || [];
        setDoctors(list);
        if (list[0]?.id) setDoctorId(list[0].id);
      } catch {
        /* non-fatal */
      }
    }
    loadDoctors();
  }, [api]);

  const refreshStatus = useCallback(async () => {
    const p = phone.trim();
    if (!p) return;
    const cacheKey = p.replace(/\s+/g, '');
    try {
      const encoded = encodeURIComponent(p);
      const res = await fetch(`${api}/queue/status/${encoded}`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
        setOfflineCache('patient', cacheKey, data);
        persistLastPhone(p);
      }
    } catch {
      const cached = getOfflineCache('patient', cacheKey);
      if (cached) setStatus(cached);
    }
  }, [api, phone]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const last = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_PHONE_KEY) : null;
        if (!last?.trim()) return;
        setPhone(last);
        const encoded = encodeURIComponent(last.trim());
        const res = await fetch(`${api}/queue/status/${encoded}`);
        const data = await res.json();
        const cacheKey = last.replace(/\s+/g, '');
        if (cancelled) return;
        if (res.ok) {
          setStatus(data);
          setOfflineCache('patient', cacheKey, data);
        } else {
          const cached = getOfflineCache('patient', cacheKey);
          if (cached) setStatus(cached);
        }
      } catch {
        if (cancelled) return;
        const last = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_PHONE_KEY) : null;
        if (last) {
          const cached = getOfflineCache('patient', last.replace(/\s+/g, ''));
          if (cached) setStatus(cached);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!phone.trim() || !status) return undefined;
    const socket = io(api, getSocketClientOptions());
    socket.on('queue:update', () => {
      refreshStatus();
    });
    return () => {
      socket.disconnect();
    };
  }, [api, phone, !!status, refreshStatus]);

  useEffect(() => {
    const off = onNetworkOnline(() => {
      flushPendingPatientWrites(api).then((r) => {
        if (r.flushed > 0) refreshStatus();
      });
      refreshStatus();
    });
    return off;
  }, [refreshStatus, api]);

  async function loadHistory() {
    if (!status?.patientId || !phone.trim()) return;
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const q = encodeURIComponent(phone.trim());
      const res = await fetch(`${api}/patient/${encodeURIComponent(status.patientId)}/history?phone=${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load history');
      setHistory(data);
    } catch (e) {
      setHistoryError(e.message || 'History failed');
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function cancelAppointment() {
    if (!status || status.status !== 'WAITING') return;
    setError('');
    setSubmitting(true);
    const body = {
      phone: phone.trim(),
      doctorId: status.doctorId,
    };
    try {
      const res = await fetch(`${api}/queue/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancel failed');
      setHistory(null);
      setStatus({
        tokenNumber: data.tokenNumber,
        status: 'CANCELLED',
        message: data.message || 'Your slot was cancelled.',
        doctorId: status.doctorId,
        patientId: data.patientId ?? status.patientId,
      });
    } catch (e) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueuePendingPatientWrite({ type: 'cancel', body });
        setError('You appear offline. We will retry cancel when you are back online.');
      } else {
        setError(e.message || 'Cancel failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function rescheduleAppointment(e) {
    e.preventDefault();
    if (!status || status.status !== 'WAITING') return;
    if (!rescheduleLocal) {
      setError('Pick a new date and time first');
      return;
    }
    setError('');
    setSubmitting(true);
    const d = new Date(rescheduleLocal);
    if (Number.isNaN(d.getTime())) {
      setError('Invalid date');
      setSubmitting(false);
      return;
    }
    const body = {
      phone: phone.trim(),
      doctorId: status.doctorId,
      appointmentTime: d.toISOString(),
    };
    try {
      const res = await fetch(`${api}/queue/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reschedule failed');
      await refreshStatus();
    } catch (e) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueuePendingPatientWrite({ type: 'reschedule', body });
        setError('You appear offline. We will retry reschedule when you are back online.');
      } else {
        setError(e.message || 'Reschedule failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function register(e) {
    e.preventDefault();
    setError('');
    setRegisterResult(null);
    setStatus(null);
    setSubmitting(true);
    try {
      const pr = Number.parseInt(priority, 10);
      const body = {
        name: name.trim(),
        phone: phone.trim(),
        symptoms: symptoms.trim() || undefined,
        doctorId: doctorId || undefined,
        type: visitType,
        priority: Number.isFinite(pr) ? pr : 0,
      };
      if (visitType === 'appointment' && appointmentLocal) {
        const d = new Date(appointmentLocal);
        if (!Number.isNaN(d.getTime())) body.appointmentTime = d.toISOString();
      }
      body.language = language;
      if (department) body.department = department;
      const res = await fetch(`${api}/patient/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existing?.tokenNumber != null) {
          throw new Error(
            `${data.error || 'Already in queue'} (token ${data.existing.tokenNumber}, status ${data.existing.status}).`
          );
        }
        throw new Error(data.error || 'Registration failed');
      }
      setRegisterResult(data);
      if (data.phone) {
        setPhone(data.phone);
        const stRes = await fetch(`${api}/queue/status/${encodeURIComponent(data.phone)}`);
        if (stRes.ok) {
          const st = await stRes.json();
          setStatus(st);
          setOfflineCache('patient', data.phone.replace(/\s+/g, ''), st);
          persistLastPhone(data.phone);
        }
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function checkStatus(e) {
    e.preventDefault();
    setError('');
    setStatus(null);
    setSubmitting(true);
    try {
      const encoded = encodeURIComponent(phone.trim());
      const res = await fetch(`${api}/queue/status/${encoded}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Not found');
      setStatus(data);
      setOfflineCache('patient', phone.trim().replace(/\s+/g, ''), data);
      persistLastPhone(phone);
    } catch (err) {
      setError(err.message || 'Status failed');
    } finally {
      setSubmitting(false);
    }
  }

  const statusVariant =
    status?.status === 'CANCELLED'
      ? 'urgent'
      : status?.status === 'IN_PROGRESS'
        ? 'active'
        : status?.status === 'SKIPPED'
          ? 'urgent'
          : 'waiting';

  useEffect(() => {
    if (!status?.appointmentTime || status.status !== 'WAITING') return;
    const d = new Date(status.appointmentTime);
    if (Number.isNaN(d.getTime())) return;
    const off = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - off).toISOString().slice(0, 16);
    setRescheduleLocal(local);
  }, [status?.appointmentTime, status?.status]);

  return (
    <AppShell
      wide
      title="Patient queue"
      subtitle="Join once (token numbers are unique across the whole clinic), then keep this page open for live updates as the line moves."
    >
      {!online && (
        <p
          className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          You appear offline. If you checked in before, your last saved place may still show below. Reconnect to refresh
          live status.
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Card>
            <CardHeader>
              <CardTitle>Check in</CardTitle>
              <p className="mt-2 text-sm text-slate-500">We will text you when your turn is near (if WhatsApp is configured).</p>
            </CardHeader>
            <form onSubmit={register} className="space-y-4">
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Doe" />
              </Field>
              <Field label="Mobile (with country code)">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="+1 555 123 4567"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
              <Field label="Doctor">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  required
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.specialization ? ` (${d.specialization})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Visit type">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value)}
                >
                  <option value="walkin">Walk-in</option>
                  <option value="appointment">Appointment</option>
                </select>
              </Field>
              {visitType === 'appointment' && (
                <Field label="Appointment time (optional)">
                  <Input
                    type="datetime-local"
                    value={appointmentLocal}
                    onChange={(e) => setAppointmentLocal(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500">Used to order your place among same priority visits.</p>
                </Field>
              )}
              <Field label="Message language (WhatsApp)">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </Field>
              <Field label="Priority (staff can override)">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="0">Normal</option>
                  <option value="1">Follow-up</option>
                  <option value="2">VIP</option>
                  <option value="3">Emergency</option>
                </select>
              </Field>
              <Field label="Symptoms (optional)">
                <Input
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Brief note for the clinic (helps route you to the right department)"
                />
              </Field>
              <Field label="Department">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500/30"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">Auto (from symptoms via AI)</option>
                  <option value="general">General</option>
                  <option value="dental">Dental</option>
                  <option value="skin">Skin</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Choose a department or leave Auto to classify from your symptoms.
                </p>
              </Field>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Joining…' : 'Join queue'}
              </Button>
            </form>

            <AnimatePresence>
              {registerResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0 }}
                  className="mt-6 overflow-hidden rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900"
                >
                  {registerResult.urgentCareMessage && (
                    <p
                      className="mb-3 rounded-lg border border-rose-300/90 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900"
                      role="alert"
                    >
                      {registerResult.urgentCareMessage}
                    </p>
                  )}
                  <p className="font-medium">You are in line</p>
                  <p className="mt-1 text-emerald-800/90">
                    Token <span className="font-semibold tabular-nums">{registerResult.tokenNumber}</span> · About{' '}
                    <span className="font-semibold tabular-nums">{registerResult.estimatedWaitMinutes}</span> min
                    estimated wait ({registerResult.ahead} ahead).
                    <span className="mt-2 block text-emerald-900/90">
                      Department:{' '}
                      <span className="font-medium capitalize">
                        {registerResult.department ?? 'general'}
                      </span>
                    </span>
                    {registerResult.needsDepartmentClarification && (
                      <span className="mt-1 block text-xs text-amber-800/90">
                        Add a bit more detail about symptoms next time for better auto routing.
                      </span>
                    )}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Already joined?</CardTitle>
              <p className="mt-2 text-sm text-slate-500">Enter the same phone number to refresh your place.</p>
            </CardHeader>
            <form onSubmit={checkStatus} className="space-y-4">
              <Field label="Phone number">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="+1 555 123 4567"
                  inputMode="tel"
                />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={submitting}>
                {submitting ? 'Loading…' : 'Show my status'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {status && (
          <motion.div
            key={`${status.tokenNumber}-${status.status}-${status.message || ''}-${status.currentRunningToken ?? ''}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="mt-10"
          >
            <Card
              className={
                status.status === 'CANCELLED'
                  ? 'border-rose-200/60 bg-gradient-to-br from-rose-50/50 to-white ring-1 ring-rose-500/10'
                  : 'border-cyan-200/40 bg-gradient-to-br from-white via-cyan-50/25 to-white ring-1 ring-cyan-500/10 shadow-[0_24px_64px_-28px_rgba(6,182,212,0.2)]'
              }
            >
              {status.status === 'CANCELLED' ? (
                <div className="px-4 pb-8 pt-2 sm:px-6">
                  <CardTitle>Appointment cancelled</CardTitle>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant}>Cancelled</Badge>
                  </div>
                  <p className="mt-4 text-base text-slate-700">{status.message}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Your token was{' '}
                    <span className="font-semibold tabular-nums text-slate-800">{status.tokenNumber}</span>. You can join
                    again anytime from Check in.
                  </p>
                </div>
              ) : (
                <div className="min-w-0">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <CardTitle>Your visit</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant}>
                      {status.status === 'IN_PROGRESS'
                        ? 'Now serving you'
                        : status.status === 'SKIPPED'
                          ? 'Skipped'
                          : 'Waiting'}
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Your token</p>
                  <p className="text-7xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-8xl sm:leading-none">
                    {status.tokenNumber}
                  </p>
                </div>

                <div className="grid w-full max-w-lg gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Now serving (your doctor)</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
                      {status.currentRunningToken ?? '—'}
                    </p>
                  </div>
                  {status.department && (
                    <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-4 shadow-sm">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Department</p>
                      <p className="mt-1 text-xl font-semibold capitalize text-slate-900">{status.department}</p>
                    </div>
                  )}
                  {status.appointmentTime && status.status === 'WAITING' && (
                    <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-4 shadow-sm sm:col-span-2 lg:col-span-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Scheduled time</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {new Date(status.appointmentTime).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-4 shadow-sm sm:col-span-2 lg:col-span-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Est. wait</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
                      {status.estimatedWaitMinutes}
                      <span className="ml-1 text-base font-medium text-slate-500">min</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-slate-100 pt-6">
                <QueueProgress ahead={status.ahead} status={status.status} />
                <p className="mt-4 text-center text-sm text-slate-500">
                  {status.status === 'IN_PROGRESS'
                    ? 'Please proceed to the consultation room when called.'
                    : (
                        <>
                          Position <span className="font-semibold text-slate-800">{status.position}</span> in line ·{' '}
                          <span className="font-semibold text-slate-800">{status.ahead}</span> ahead
                        </>
                      )}
                </p>
                {status.status === 'WAITING' && (
                  <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-end">
                    <form onSubmit={rescheduleAppointment} className="flex flex-1 flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Reschedule to
                      </label>
                      <Input
                        type="datetime-local"
                        value={rescheduleLocal}
                        onChange={(e) => setRescheduleLocal(e.target.value)}
                      />
                      <Button type="submit" variant="secondary" className="w-full sm:w-auto" disabled={submitting}>
                        Save new time
                      </Button>
                    </form>
                    <Button
                      type="button"
                      variant="warning"
                      className="w-full sm:w-auto"
                      disabled={submitting}
                      onClick={cancelAppointment}
                    >
                      Cancel my slot
                    </Button>
                  </div>
                )}
                {status.patientId && (
                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <p className="text-sm font-medium text-slate-800">Visit history</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Uses your phone on file to verify it is you.
                    </p>
                    <Button type="button" variant="secondary" className="mt-3" disabled={historyLoading} onClick={loadHistory}>
                      {historyLoading ? 'Loading…' : 'Load my past visits'}
                    </Button>
                    {history?.patient?.symptoms && (
                      <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-sm text-slate-700">
                        <span className="font-medium text-slate-800">Profile symptoms: </span>
                        {history.patient.symptoms}
                      </p>
                    )}
                    {historyError && (
                      <p className="mt-2 text-sm text-rose-600" role="alert">
                        {historyError}
                      </p>
                    )}
                    {history?.visits?.length > 0 && (
                      <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm text-slate-700">
                        {history.visits.map((v) => (
                          <li key={v.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                            <span className="font-medium tabular-nums text-slate-900">
                              {new Date(v.createdAt).toLocaleString()}
                            </span>
                            <span className="ml-2 text-slate-500">{v.status}</span>
                            {v.doctor?.name && <span className="ml-2 text-slate-600">· {v.doctor.name}</span>}
                            {v.symptoms && (
                              <span className="mt-1 block text-xs text-slate-600">Visit symptoms: {v.symptoms}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {history && !history.visits?.length && !historyError && (
                      <p className="mt-2 text-sm text-slate-500">No past visits stored yet.</p>
                    )}
                  </div>
                )}
              </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
