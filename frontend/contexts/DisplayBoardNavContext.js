'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'curaflow:displayBoardPrefs';

const DisplayBoardNavContext = createContext(null);

export function DisplayBoardNavProvider({ children }) {
  const [prefs, setPrefsState] = useState({ doctorId: null, department: null });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      setPrefsState({
        doctorId: typeof p.doctorId === 'string' ? p.doctorId : null,
        department: typeof p.department === 'string' ? p.department : null,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const setDisplayBoardPrefs = useCallback((next) => {
    const merged = {
      doctorId: next?.doctorId ?? null,
      department: next?.department ?? null,
    };
    setPrefsState(merged);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  }, []);

  const displayHref = useMemo(() => {
    const p = new URLSearchParams();
    if (prefs.doctorId) p.set('doctorId', prefs.doctorId);
    if (prefs.department) p.set('department', prefs.department);
    const q = p.toString();
    return q ? `/display?${q}` : '/display';
  }, [prefs.doctorId, prefs.department]);

  const value = useMemo(
    () => ({ prefs, setDisplayBoardPrefs, displayHref }),
    [prefs, setDisplayBoardPrefs, displayHref]
  );

  return (
    <DisplayBoardNavContext.Provider value={value}>{children}</DisplayBoardNavContext.Provider>
  );
}

export function useDisplayBoardNav() {
  const ctx = useContext(DisplayBoardNavContext);
  if (!ctx) {
    return {
      prefs: { doctorId: null, department: null },
      setDisplayBoardPrefs: () => {},
      displayHref: '/display',
    };
  }
  return ctx;
}
