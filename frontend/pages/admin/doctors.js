'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '../../components/AppShell';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Field } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { getApiBase, getApiUnreachableHelp } from '../../lib/api';
import { getStaffHeaders } from '../../lib/staffHeaders';

/** Same default id as backend DEFAULT_DOCTOR_ID / seed (do not delete). */
const DEFAULT_CLINIC_DOCTOR_ID = 'clinic-default-doctor';

export default function AdminDoctorsPage() {
  const api = getApiBase();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [addName, setAddName] = useState('');
  const [addSpec, setAddSpec] = useState('');
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSpec, setEditSpec] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`${api}/doctors`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setDoctors(data.doctors || []);
    } catch (e) {
      setError(e.message || getApiUnreachableHelp());
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  async function addDoctor(e) {
    e.preventDefault();
    const n = addName.trim();
    if (!n) {
      setError('Enter a name');
      return;
    }
    setError('');
    setAdding(true);
    try {
      const res = await fetch(`${api}/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getStaffHeaders() },
        body: JSON.stringify({
          name: n,
          specialization: addSpec.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setAddName('');
      setAddSpec('');
      await load();
    } catch (err) {
      setError(err.message || 'Create failed');
    } finally {
      setAdding(false);
    }
  }

  function startEdit(d) {
    setEditingId(d.id);
    setEditName(d.name);
    setEditSpec(d.specialization ?? '');
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    const n = editName.trim();
    if (!n) {
      setError('Name cannot be empty');
      return;
    }
    setError('');
    setBusyId(editingId);
    try {
      const res = await fetch(`${api}/doctors/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getStaffHeaders() },
        body: JSON.stringify({
          name: n,
          specialization: editSpec.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function removeDoctor(d) {
    if (d.id === DEFAULT_CLINIC_DOCTOR_ID) return;
    const ok = window.confirm(
      `Remove "${d.name}" from the roster? Patients will no longer be able to pick this room. This cannot be undone.`
    );
    if (!ok) return;
    setError('');
    setBusyId(d.id);
    try {
      const res = await fetch(`${api}/doctors/${encodeURIComponent(d.id)}`, {
        method: 'DELETE',
        headers: { ...getStaffHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      if (editingId === d.id) setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <AppShell title="Doctor roster" subtitle="Loading…" wide>
        <Skeleton className="h-40 w-full rounded-3xl" />
      </AppShell>
    );
  }

  return (
    <AppShell
      wide
      title="Doctor roster"
      subtitle="Add rooms or providers and edit how they appear in the queue and on the TV. Delete removes a doctor only if they have no queue history yet. When CLINIC_STAFF_API_KEY is set on the API, the same key must be in the frontend as NEXT_PUBLIC_CLINIC_STAFF_KEY."
    >
      <AnimatePresence>
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

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Add doctor</CardTitle>
          <p className="mt-2 text-sm text-slate-500">
            New entries appear immediately in patient check-in and the doctor dashboard.
          </p>
        </CardHeader>
        <form onSubmit={addDoctor} className="space-y-4 px-1 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          <div className="min-w-[220px] flex-1">
            <Field label="Display name">
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Dr. Priya Sharma"
                required
              />
            </Field>
          </div>
          <div className="min-w-[200px] flex-1">
            <Field label="Specialization (optional)">
              <Input
                value={addSpec}
                onChange={(e) => setAddSpec(e.target.value)}
                placeholder="Dental, General medicine, …"
              />
            </Field>
          </div>
          <Button type="submit" disabled={adding} className="w-full sm:w-auto">
            {adding ? 'Adding…' : 'Add doctor'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All doctors</CardTitle>
          <p className="mt-2 text-sm text-slate-500">
            Edit names as they should show on the display and in dropdowns. Use Remove only for unused doctors; the default
            clinic row cannot be removed.
          </p>
        </CardHeader>
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
          {doctors.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No doctors yet.</p>
          ) : (
            doctors.map((d) => (
              <div key={d.id} className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                {editingId === d.id ? (
                  <form onSubmit={saveEdit} className="flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="min-w-[200px] flex-1">
                      <Field label="Name">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                      </Field>
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <Field label="Specialization">
                        <Input
                          value={editSpec}
                          onChange={(e) => setEditSpec(e.target.value)}
                          placeholder="Optional"
                        />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={busyId === d.id}>
                        {busyId === d.id ? 'Saving…' : 'Save'}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{d.name}</p>
                      {d.specialization && (
                        <p className="mt-1 text-sm text-slate-500">{d.specialization}</p>
                      )}
                      <p className="mt-2 font-mono text-xs text-slate-400">ID {d.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={() => startEdit(d)}>
                        Edit
                      </Button>
                      {d.id === DEFAULT_CLINIC_DOCTOR_ID ? (
                        <span className="self-center text-xs text-slate-400">Default clinic (cannot remove)</span>
                      ) : (
                        <Button
                          type="button"
                          variant="outlineDanger"
                          disabled={busyId === d.id}
                          onClick={() => removeDoctor(d)}
                        >
                          {busyId === d.id ? 'Removing…' : 'Remove'}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </AppShell>
  );
}
