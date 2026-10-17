'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusMessage, TaskStatusBadge } from '@/components/ui';

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

function formatSyncTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';

  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  if (date.toDateString() === new Date().toDateString()) return `today at ${time}`;

  const day = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
  return `${day} at ${time}`;
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
      <main className="shell display-shell reconnect-view">
        <div className="brand-lockup">
          <span className="clover-mark" aria-hidden="true">
            <CloverMark />
          </span>
          <div className="display-heading">
            <p className="product-name">Clover</p>
            <h1>Finding your routine</h1>
          </div>
        </div>
        <StatusMessage tone="offline">
          Can't reach Clover right now. This display will update when the connection is back.
        </StatusMessage>
        {cacheWarning && (
          <StatusMessage role="alert" tone="error">
            The saved display view is unavailable in this browser.
          </StatusMessage>
        )}
      </main>
    );
  }

  const nextTaskId = snapshot.tasks.find((task) => task.status === 'incomplete')?.id;
  const allTasksDone =
    snapshot.tasks.length > 0 &&
    snapshot.tasks.every((task) => task.status === 'complete' || task.status === 'assisted');

  return (
    <main className="shell display-shell">
      <header className="display-header">
        <div className="brand-lockup">
          <span className="clover-mark" aria-hidden="true">
            <CloverMark />
          </span>
          <div className="display-heading">
            <p className="product-name">Clover</p>
            <h1>{snapshot.household}</h1>
          </div>
        </div>
        <p className={`connection-pill ${connected ? 'is-online' : 'is-offline'}`} role="status">
          <span className="connection-dot" aria-hidden="true" />
          {connected ? 'Up to date' : 'Offline · saved list'}
        </p>
      </header>
      <p className="sync-time">
        Last synced <time dateTime={snapshot.syncedAt}>{formatSyncTime(snapshot.syncedAt)}</time>
      </p>
      {!connected && (
        <StatusMessage tone="offline">
          This list is saved. Reconnect to mark a task done.
        </StatusMessage>
      )}
      {!realtimeConnected && connected && (
        <StatusMessage>
          Live updates are reconnecting; Clover will keep checking for changes.
        </StatusMessage>
      )}
      {actionError && (
        <StatusMessage role="alert" tone="error">
          That step could not be saved. Check the connection and try again.
        </StatusMessage>
      )}
      {cacheWarning && (
        <StatusMessage role="alert" tone="error">
          This browser could not save an offline copy of the display.
        </StatusMessage>
      )}
      {snapshot.tasks.length > 0 ? (
        <>
          <section className="routine-intro" aria-labelledby="routine-heading">
            <h2 id="routine-heading">
              {allTasksDone ? 'You finished every step.' : 'A little at a time.'}
            </h2>
            <p>
              {allTasksDone
                ? 'The whole routine is finished.'
                : 'Do the highlighted step, then show a grown-up.'}
            </p>
          </section>
          <ol className="task-path" aria-label="Routine steps">
            {snapshot.tasks.map((task, index) => {
              const isCurrent = task.id === nextTaskId;
              const isDone = task.status === 'complete' || task.status === 'assisted';
              return (
                <li
                  key={task.id}
                  data-status={task.status}
                  data-current={isCurrent ? 'true' : undefined}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="task-marker" aria-hidden="true">
                    {isDone ? <CheckMark /> : index + 1}
                  </span>
                  <div className="task-copy">
                    <span className="task-title">{task.title}</span>
                    <TaskStatusBadge status={task.status} />
                  </div>
                  {task.status === 'incomplete' && (
                    <form
                      className="task-actions"
                      method="post"
                      action="/display/tasks/done"
                      onSubmit={(event) => {
                        if (!connected) {
                          event.preventDefault();
                          return;
                        }
                        const keyField = event.currentTarget.elements.namedItem('idempotency_key');
                        if (keyField instanceof HTMLInputElement) {
                          keyField.value = window.crypto.randomUUID();
                        }
                      }}
                    >
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="idempotency_key" value="" />
                      <button
                        className="display-action"
                        type="submit"
                        disabled={!connected}
                        aria-label={`Mark ${task.title} as done`}
                      >
                        I did it
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <section className="empty-routine" aria-labelledby="empty-heading">
          <h2 id="empty-heading">No routine yet</h2>
          <p>A grown-up will add your steps here.</p>
        </section>
      )}
    </main>
  );
}

function CloverMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <g fill="currentColor">
        <circle cx="16" cy="8.5" r="5.2" />
        <circle cx="8.5" cy="16" r="5.2" />
        <circle cx="23.5" cy="16" r="5.2" />
        <circle cx="16" cy="22" r="5.2" />
      </g>
      <path d="M16 20v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="m5 12.5 4.2 4.2L19 7"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
