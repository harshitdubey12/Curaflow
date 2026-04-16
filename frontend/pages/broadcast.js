'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '../components/AppShell';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { getApiBase, getApiUnreachableHelp } from '../lib/api';
import { getStaffHeaders } from '../lib/staffHeaders';

function broadcastErrorMessage(res, data) {
  let msg = data?.error || 'Broadcast failed';
  if (res.status === 401) {
    msg = `${msg} Set NEXT_PUBLIC_CLINIC_STAFF_KEY to match CLINIC_STAFF_API_KEY on the API.`;
  }
  return msg;
}

export default function BroadcastPage() {
  const api = getApiBase();
  const [message, setMessage] = useState('');
  const [messageHi, setMessageHi] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function send(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Enter a message to send.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${api}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getStaffHeaders() },
        body: JSON.stringify({
          message: trimmed,
          messageHi: messageHi.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(broadcastErrorMessage(res, data));
      setResult(data);
      setMessage('');
      setMessageHi('');
    } catch (err) {
      setError(err.message || getApiUnreachableHelp());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Broadcast"
      subtitle="Send one WhatsApp message to every patient on file. Uses your Twilio settings; sends are throttled to protect rate limits."
    >
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card className="max-w-2xl border-slate-200/70 bg-gradient-to-br from-white to-slate-50/50 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.15)]">
          <CardHeader>
            <CardTitle>Message all patients</CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              Example: free screening camp, holiday hours, or parking updates. Optional Hindi text is sent to patients
              who chose Hindi on registration; others get the main message.
            </p>
          </CardHeader>
          <form onSubmit={send} className="space-y-4 px-6 pb-6">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Message
              </span>
              <textarea
                className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/25"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Free health camp tomorrow 9am–1pm at the main clinic."
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Message (Hindi, optional)
              </span>
              <textarea
                className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/25"
                value={messageHi}
                onChange={(e) => setMessageHi(e.target.value)}
                placeholder="हिंदी में संदेश (वैकल्पिक)। खाली छोड़ने पर हिंदी रोगियों को अंग्रेज़ी संदेश + संक्षिप्त सूचना भेजी जाएगी।"
              />
            </label>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send broadcast'}
            </Button>
          </form>
        </Card>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 max-w-2xl rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-5 py-4 text-sm text-emerald-900"
          >
            <p className="font-semibold">Broadcast finished</p>
            <p className="mt-2 text-emerald-800/95">
              Total {result.total} · Sent {result.sent} · Failed {result.failed} · Skipped {result.skipped}
            </p>
            {result.errors?.length > 0 && (
              <ul className="mt-3 max-h-40 list-inside list-disc overflow-y-auto text-xs text-emerald-900/90">
                {result.errors.slice(0, 8).map((x, i) => (
                  <li key={i}>
                    {x.phone}: {x.error}
                  </li>
                ))}
                {result.errors.length > 8 && <li>…and more</li>}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
