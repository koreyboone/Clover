import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

// The display has its own session. Anything that is not an active display gets the pairing screen.
export default async function Display({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!isSupabaseConfigured()) return <PairForm message="This display is not available right now." />;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const notice = error ? 'That code is not valid. Ask a parent for a new one.' : undefined;
  if (!auth.user) return <PairForm message={notice} />;

  // Row-level security only returns the row while the device is active (not revoked).
  const { data: device } = await supabase
    .from('display_devices')
    .select('name, households(name)')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!device) {
    return (
      <PairForm message="This display is not paired or its access was removed. Ask a parent for a new code." />
    );
  }

  const household = Array.isArray(device.households) ? device.households[0] : device.households;
  return (
    <main className="shell">
      <h1>{household?.name ?? 'Household'}</h1>
      <p className="status">Display "{device.name}" is paired. Routines will appear here.</p>
    </main>
  );
}
