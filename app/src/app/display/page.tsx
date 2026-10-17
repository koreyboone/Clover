import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';
import { ClearDisplayCache, DisplayClient, type DisplaySnapshot } from './display-client';
import { StatusMessage } from '@/components/ui';

export const dynamic = 'force-dynamic';

function PairForm({ message }: { message?: string }) {
  return (
    <main className="shell pairing-shell">
      <ClearDisplayCache />
      <h1>Pair this display</h1>
      {message && (
        <StatusMessage role="alert" tone="error">
          {message}
        </StatusMessage>
      )}
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

// The display has its own session. Anything that is not an active display gets the pairing screen.
export default async function Display({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!isSupabaseConfigured()) {
    return <DisplayClient initialSnapshot={null} />;
  }

  const supabase = await createServerSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && isAuthRetryableFetchError(authError)) {
    return <DisplayClient initialSnapshot={null} />;
  }

  const notice = error === 'invalid' ? 'That code is not valid. Ask a parent for a new one.' : undefined;
  if (!auth.user) return <PairForm message={notice} />;

  // Row-level security only returns the row while the device is active (not revoked).
  const { data: device, error: deviceError } = await supabase
    .from('display_devices')
    .select('name, households(name)')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (deviceError) return <DisplayClient initialSnapshot={null} />;

  if (!device) {
    return (
      <PairForm message="This display is not paired or its access was removed. Ask a parent for a new code." />
    );
  }

  const { data: tasks, error: tasksError } = await supabase
    .from('sample_tasks')
    .select('id, title, status')
    .order('position');
  if (tasksError) return <DisplayClient initialSnapshot={null} />;

  const household = Array.isArray(device.households) ? device.households[0] : device.households;
  const snapshot: DisplaySnapshot = {
    household: household?.name ?? 'Household',
    deviceName: device.name,
    tasks: tasks ?? [],
    syncedAt: new Date().toISOString(),
  };
  return (
    <DisplayClient
      initialSnapshot={snapshot}
      actionError={error === 'action'}
    />
  );
}