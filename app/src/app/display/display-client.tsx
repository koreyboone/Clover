'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const CACHE_KEY = 'clover-display-cache-v1';
const POLL_INTERVAL_MS = 15_000;
const HEALTH_INTERVAL_MS = 10_000;

type Task = { id: string; title: string; status: string };
export type DisplaySnapshot = {
  household: string;
  deviceName: string;
  tasks: Task[];
  syncedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  incomplete: 'To do',
  awaiting_verification: 'Waiting for a parent',
  complete: 'Done',
  assisted: 'Done with help',
};

function readCache(): { snapshot: DisplaySnapshot | null; error: boolean } {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return { snapshot: null, error: false };
    const value = JSON.parse(raw) as Partial<DisplaySnapshot>;
    if (
      typeof value.household !== 'string' ||
      typeof value.deviceName !== 'string' ||
      typeof value.syncedAt !== 'string' ||
      !Array.isArray(value.tasks)
    ) {
      window.localStorage.removeItem(CACHE_KEY);
      return { snapshot: null, error: true };
    }
    return { snapshot: value as DisplaySnapshot, error: false };
  } catch {
    return { snapshot: null, error: true };
  }
}

function writeCache(snapshot: DisplaySnapshot): boolean {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function ClearDisplayCache() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      // The confirmed unpaired state still replaces this component and its in-memory data.
    }
  }, []);
  return null;
}

export function DisplayClient({
  initialSnapshot,
  actionError = false,
}: {
  initialSnapshot: DisplaySnapshot | null;
  actionError?: boolean;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connected, setConnected] = useState(false);
  const [cacheWarning, setCacheWarning] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const connectedRef = useRef(false);

  const updateConnection = useCallback((value: boolean) => {
    connectedRef.current = value;
    setConnected(value);
  }, []);

  useEffect(() => {
    if (initialSnapshot) {
      setSnapshot(initialSnapshot);
      if (!writeCache(initialSnapshot)) setCacheWarning(true);
      return;
    }
    updateConnection(false);
    const cached = readCache();
    if (cached.snapshot) setSnapshot(cached.snapshot);
    if (cached.error) setCacheWarning(true);
  }, [initialSnapshot, updateConnection]);

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch('/display/health', { cache: 'no-store' });
      if (response.status === 204) {
        const wasDisconnected = !connectedRef.current;
        updateConnection(true);
        if (wasDisconnected) router.refresh();
        return;
      }
      if (response.status === 401) {
        setSnapshot(null);
        updateConnection(false);
        try {
          window.localStorage.removeItem(CACHE_KEY);
        } catch {
          setCacheWarning(true);
        }
        router.refresh();
        return;
      }
      updateConnection(false);
    } catch {
      updateConnection(false);
    }
  }, [router, updateConnection]);

  useEffect(() => {
    void checkConnection();
    const onOffline = () => updateConnection(false);
    const onOnline = () => void checkConnection();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    const healthTimer = window.setInterval(() => void checkConnection(), HEALTH_INTERVAL_MS);
    const pollTimer = window.setInterval(() => {
      if (connectedRef.current && document.visibilityState === 'visible') router.refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.clearInterval(healthTimer);
      window.clearInterval(pollTimer);
    };
  }, [checkConnection, router, updateConnection]);

  useEffect(() => {
    const stream = new EventSource('/display/stream');
    const onChange = () => {
      if (connectedRef.current) router.refresh();
    };
    stream.addEventListener('change', onChange);
    stream.onopen = () => setRealtimeConnected(true);
    stream.onerror = () => setRealtimeConnected(false);
    return () => {
      stream.removeEventListener('change', onChange);
      stream.close();
    };
  }, [router]);

  if (!snapshot) {
    return (
      <main className="shell">
        <h1>Reconnecting…</h1>
        <p className="status" role="status">
          Can't reach Clover right now. The display will update by itself when the connection is back.
        </p>
        {cacheWarning && (
          <p role="alert">The saved display view is unavailable in this browser.</p>
        )}
      </main>
    );
  }

  return (
    <main className="shell">
      <h1>{snapshot.household}</h1>
      <p className="status" role="status" aria-live="polite">
        {connected ? 'Connected' : 'Offline — showing saved data'}
        {' · '}Last synced: <time dateTime={snapshot.syncedAt}>{snapshot.syncedAt}</time>
      </p>
      {!connected && (
        <p className="status">Task actions are unavailable until Clover reconnects.</p>
      )}
      {!realtimeConnected && connected && (
        <p className="status">Live updates reconnecting; checking for changes periodically.</p>
      )}
      {actionError && <p role="alert">That didn't work. Try again.</p>}
      {cacheWarning && (
        <p role="alert">This browser could not save an offline copy of the display.</p>
      )}
      {snapshot.tasks.length > 0 ? (
        <ul className="tasks">
          {snapshot.tasks.map((task) => (
            <li key={task.id} data-status={task.status}>
              <span className="task-title">{task.title}</span>
              <span className="task-status">{STATUS_LABEL[task.status] ?? task.status}</span>
              {task.status === 'incomplete' && (
                <form
                  method="post"
                  action="/display/tasks/done"
                  onSubmit={(event) => {
                    if (!connected) event.preventDefault();
                  }}
                >
                  <input type="hidden" name="task_id" value={task.id} />
                  <button type="submit" disabled={!connected}>
                    I did it
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="status">Display "{snapshot.deviceName}" is paired. No routine yet.</p>
      )}
    </main>
  );
}
