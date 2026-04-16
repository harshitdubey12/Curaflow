'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../components/AppShell';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { getApiBase, getApiUnreachableHelp } from '../lib/api';
import { getStaffHeaders } from '../lib/staffHeaders';

export default function AnalyticsPage() {
  const api = getApiBase();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${api}/analytics`, { headers: { ...getStaffHeaders() } });
        const json = await res.json();
        if (!res.ok) {
          let msg = json.error || 'Failed to load';
          if (res.status === 401) {
            msg = `${msg} Set NEXT_PUBLIC_CLINIC_STAFF_KEY in frontend env to match CLINIC_STAFF_API_KEY on the API.`;
          }
          throw new Error(msg);
        }
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message || getApiUnreachableHelp());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const maxDay =
    data?.patientsPerDay?.length > 0
      ? Math.max(1, ...data.patientsPerDay.map((d) => d.count))
      : 1;

  return (
    <AppShell
      wide
      title="Clinic analytics"
      subtitle={
        'Visit volume, wait times, and peak hours. Dates and hours use the clinic timezone from the API (see cards).'
      }
    >
      {loading && (
        <div className="grid gap-6 lg:grid-cols-3" role="status" aria-busy="true">
          <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm lg:col-span-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-4 w-full max-w-xs" />
          </div>
          <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm lg:col-span-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm lg:col-span-3">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      {data && !loading && (
        <div className="grid gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="h-full border-cyan-200/45 bg-gradient-to-br from-white to-cyan-50/35">
              <CardHeader>
                <CardTitle>Average wait</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Minutes from join to completion. Uses stored wait time, or queue duration when missing.
                </p>
              </CardHeader>
              <p className="px-6 pb-6 text-4xl font-semibold tabular-nums text-slate-900">
                {data.avgWaitTime != null ? data.avgWaitTime : 0}
                <span className="ml-2 text-lg font-medium text-slate-500">min</span>
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <CardTitle>Peak hours</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Top three hours by visit registration count ({data.timezone ?? 'clinic timezone'}).{' '}
                  {data.peakHoursBasis === 'visit_created_at' &&
                    'Uses check-in time (Visit.createdAt), not consultation start.'}
                </p>
              </CardHeader>
              <div className="space-y-3 px-6 pb-6">
                {data.peakHours?.length === 0 && (
                  <p className="text-sm text-slate-500">No visits yet. Data will appear after patients check in.</p>
                )}
                {data.peakHours?.map((p) => (
                  <div
                    key={p.hour}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {String(p.hour).padStart(2, '0')}:00 – {String(p.hour).padStart(2, '0')}:59
                    </span>
                    <span className="tabular-nums text-sm font-semibold text-slate-900">{p.count} visits</span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="lg:col-span-3"
          >
            <Card>
              <CardHeader>
                <CardTitle>Peak hours (consultation started)</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Top three hours by when the patient was called in (Visit.startTime), {data.timezone ?? 'clinic timezone'}
                  . Empty until you have completed visits with a recorded start time.
                </p>
              </CardHeader>
              <div className="space-y-3 px-6 pb-6">
                {(!data.peakHoursConsultation || data.peakHoursConsultation.length === 0) && (
                  <p className="text-sm text-slate-500">No consultation start times yet.</p>
                )}
                {data.peakHoursConsultation?.map((p) => (
                  <div
                    key={`c-${p.hour}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {String(p.hour).padStart(2, '0')}:00 – {String(p.hour).padStart(2, '0')}:59
                    </span>
                    <span className="tabular-nums text-sm font-semibold text-slate-900">{p.count} starts</span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="lg:col-span-3"
          >
            <Card>
              <CardHeader>
                <CardTitle>Patients per day</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Last 14 calendar days in {data.timezone ?? 'clinic timezone'} (visit registrations).
                </p>
              </CardHeader>
              <div className="space-y-2 px-6 pb-6">
                {data.patientsPerDay?.every((d) => d.count === 0) && (
                  <p className="text-sm text-slate-500">No visit data in this window yet.</p>
                )}
                <div className="flex h-48 items-end gap-1 sm:gap-2">
                  {data.patientsPerDay?.map((d, idx) => (
                    <div key={`${d.date}-${idx}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-cyan-600 to-sky-500 opacity-90 transition hover:opacity-100"
                        style={{
                          height: `${Math.max(8, (d.count / maxDay) * 100)}%`,
                          minHeight: d.count > 0 ? '12px' : '4px',
                        }}
                        title={`${d.date}: ${d.count}`}
                      />
                      <span className="hidden text-[10px] text-slate-400 sm:block">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AppShell>
  );
}
