/**
 * Lightweight localStorage cache for queue UI when the network drops.
 * Conflict handling is intentionally minimal: last successful server response wins on reconnect.
 */
const PREFIX = 'curaflow';

function keyFor(kind, id) {
  return `${PREFIX}:${kind}:${id}`;
}

export function setOfflineCache(kind, id, data) {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({ savedAt: Date.now(), data });
    window.localStorage.setItem(keyFor(kind, id), payload);
  } catch {
    /* quota or private mode */
  }
}

export function getOfflineCache(kind, id, maxAgeMs = 1000 * 60 * 60 * 24) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(kind, id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.data === undefined) return null;
    if (maxAgeMs > 0 && Date.now() - (parsed.savedAt || 0) > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function onNetworkOnline(callback) {
  if (typeof window === 'undefined') return () => {};
  const fn = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine) callback();
  };
  window.addEventListener('online', fn);
  return () => window.removeEventListener('online', fn);
}

const PENDING_WRITES_KEY = `${PREFIX}:pendingPatientWrites`;

/**
 * Queue a cancel or reschedule when the device was offline; flushed once on reconnect.
 * @param {{ type: 'cancel' | 'reschedule', body: object }} action
 */
export function enqueuePendingPatientWrite(action) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(PENDING_WRITES_KEY);
    let arr = [];
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) arr = p;
    }
    arr.push({
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    });
    window.localStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(arr.slice(-8)));
  } catch {
    /* quota */
  }
}

/**
 * Retry pending cancel/reschedule calls. Returns how many succeeded.
 */
export async function flushPendingPatientWrites(apiBase, fetchImpl = fetch) {
  if (typeof window === 'undefined') return { flushed: 0, remaining: 0 };
  let raw;
  try {
    raw = window.localStorage.getItem(PENDING_WRITES_KEY);
  } catch {
    return { flushed: 0, remaining: 0 };
  }
  if (!raw) return { flushed: 0, remaining: 0 };
  let actions;
  try {
    actions = JSON.parse(raw);
  } catch {
    try {
      window.localStorage.removeItem(PENDING_WRITES_KEY);
    } catch {
      /* ignore */
    }
    return { flushed: 0, remaining: 0 };
  }
  if (!Array.isArray(actions) || actions.length === 0) return { flushed: 0, remaining: 0 };

  let flushed = 0;
  const remaining = [];
  for (const a of actions) {
    const url =
      a.type === 'cancel'
        ? `${apiBase}/queue/cancel`
        : a.type === 'reschedule'
          ? `${apiBase}/queue/reschedule`
          : null;
    if (!url || !a.body) {
      continue;
    }
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a.body),
      });
      if (res.ok) flushed += 1;
      else remaining.push(a);
    } catch {
      remaining.push(a);
    }
  }
  try {
    if (remaining.length) window.localStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(remaining));
    else window.localStorage.removeItem(PENDING_WRITES_KEY);
  } catch {
    /* ignore */
  }
  return { flushed, remaining: remaining.length };
}
