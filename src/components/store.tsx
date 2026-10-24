'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Workflow } from '@/lib/model';
export type LearningData = {
  completed: string[];
  bookmarks: string[];
  workflows: Workflow[];
  history: { id: string; title: string; at: string; steps: number; outcome: string }[];
};
type User = { id: string; email: string; role: string; plan: string; tenant_id: string };
const empty: LearningData = { completed: [], bookmarks: [], workflows: [], history: [] };
type Store = {
  data: LearningData;
  update: (fn: (d: LearningData) => LearningData) => void;
  user: User | null;
  loaded: boolean;
  notify: (message: string) => void;
  quiet: boolean;
  setQuiet: (q: boolean) => void;
};
const Context = createContext<Store | null>(null);
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(
    url,
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  if (!r.headers.get('content-type')?.includes('application/json'))
    throw new Error(
      'The server returned an unexpected response. Please retry after the service is ready.',
    );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LearningData>(empty),
    [user, setUser] = useState<User | null>(null),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState(''),
    [quiet, setQuietState] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      let u: User | null = null;
      try {
        u = (await api<{ user: User | null }>('/api/auth/session')).user;
      } catch {}
      if (!active) return;
      setUser(u);
      try {
        const saved = JSON.parse(localStorage.getItem(`cyber-ai:${u?.id ?? 'guest'}`) ?? 'null');
        if (
          saved &&
          Array.isArray(saved.completed) &&
          Array.isArray(saved.workflows) &&
          Array.isArray(saved.history) &&
          Array.isArray(saved.bookmarks)
        )
          setData(saved);
        setQuietState(localStorage.getItem('cyber-ai:quiet') === 'true');
      } catch {}
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 6500);
    return () => clearTimeout(t);
  }, [message]);
  const update = (fn: (d: LearningData) => LearningData) => {
    if (!loaded) return;
    setData((old) => {
      const next = fn(old);
      try {
        localStorage.setItem(`cyber-ai:${user?.id ?? 'guest'}`, JSON.stringify(next));
      } catch {
        setMessage('Browser storage is full or unavailable. Export your work before closing.');
      }
      return next;
    });
  };
  const setQuiet = (value: boolean) => {
    setQuietState(value);
    localStorage.setItem('cyber-ai:quiet', String(value));
  };
  return (
    <Context.Provider value={{ data, update, user, loaded, notify: setMessage, quiet, setQuiet }}>
      <div className={quiet ? 'app quiet' : 'app'}>{children}</div>
      {message && (
        <div className="toast" role="status">
          {message}
          <button aria-label="Dismiss notification" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error('Store is missing');
  return value;
}
export function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<T>(url)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url, revision]);
  return { data, error, loading, reload: () => setRevision((n) => n + 1) };
}
