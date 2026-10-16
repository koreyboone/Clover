import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';
import { AutoRefresh } from './auto-refresh';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  incomplete: 'To do',
  awaiting_verification: 'Waiting for a parent',
  complete: 'Done',
  assisted: 'Done with help',
};

function PairForm({ message }: { message?: string }) {
  return (
    <main className="shell">
      <h1>Pair this display</h1>
      {message && <p role="alert">{message}</p>}
      <p>
        Enter a pairing code from the Clover parent page. If this display was paired before, its access may have
        expired or been removed.
      </p>
      <form method="post" action="/display/pair">
        <label>
          Pairing code
          <input name="code" autoComplete="off" autoCapitalize="characters" maxLength={12} required />
        </label>
        <button type="submit">Pair</button>
      </form>
    </main>
  );
}

// Shown when Clover cannot be reached. The session is kept, so the display recovers by itself.
function Reconnecting() {
  return (
    <main className="shell">
      <AutoRefresh seconds={3} />
      <h1>Reconnecting…</h1>
      <p className="status" role="status">
        Can't reach Clover right now. This will update by itself when the connection is back.
      </p>
    </main>
  );
}

// The display has its own session. Anything that is not an active display gets the pairing screen.
export default async function Display({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!isSupabaseConfigured()) return <PairForm message="This display is not available right now." />;

  const supabase = await createServerSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && isAuthRetryableFetchError(authError)) return <Reconnecting />;

  const notice = error === 'invalid' ? 'That code is not valid. Ask a parent for a new one.' : undefined;
  if (!auth.user) return <PairForm message={notice} />;

  // Row-level security only returns the row while the device is active (not revoked).
  const { data: device, error: deviceError } = await supabase
    .from('display_devices')
    .select('name, households(name)')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (deviceError) return <Reconnecting />;

  if (!device) {
    return (
      <PairForm message="This display is not paired or its access was removed. Ask a parent for a new code." />
    );
  }

  const { data: tasks, error: tasksError } = await supabase
    .from('sample_tasks')
    .select('id, title, status')
    .order('position');
  if (tasksError) return <Reconnecting />;

  const household = Array.isArray(device.households) ? device.households[0] : device.households;
  return (
    <main className="shell">
      <AutoRefresh seconds={5} />
      <h1>{household?.name ?? 'Household'}</h1>
      {error === 'action' && <p role="alert">That didn't work. Try again.</p>}
      {tasks && tasks.length > 0 ? (
        <ul className="tasks">
          {tasks.map((t) => (
            <li key={t.id} data-status={t.status}>
              <span className="task-title">{t.title}</span>
              <span className="task-status">{STATUS_LABEL[t.status] ?? t.status}</span>
              {t.status === 'incomplete' && (
                <form method="post" action="/display/tasks/done">
                  <input type="hidden" name="task_id" value={t.id} />
                  <button type="submit">I did it</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="status">Display "{device.name}" is paired. No routine yet.</p>
      )}
    </main>
  );
}