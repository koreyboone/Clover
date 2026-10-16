import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="shell">
        <h1>Clover</h1>
        <p className="status" data-configured="false">
          Supabase is not configured. Copy .env.example to .env.local and set the values.
        </p>
      </main>
    );
  }

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  // A display session has no parent home page.
  const { data: ownDevice } = await supabase.from('display_devices').select('id').eq('user_id', auth.user.id).maybeSingle();
  if (ownDevice) redirect('/display');

  // Row-level security limits these to households the user belongs to.
  const { data: households } = await supabase.from('households').select('id, name').order('name');
  const { data: devices } = await supabase
    .from('display_devices')
    .select('id, household_id, name, revoked_at')
    .order('created_at');
  const { error } = await searchParams;

  return (
    <main className="shell">
      <h1>Clover</h1>
      <p>Signed in as {auth.user.email}</p>
      {error === 'name' && <p role="alert">Enter a household name up to 100 characters.</p>}
      {error === 'create' && <p role="alert">Could not create the household.</p>}
      {error === 'display' && <p role="alert">Could not create the display. Check the name and try again.</p>}
      {error === 'revoke' && <p role="alert">Could not revoke that display.</p>}

      {households && households.length > 0 ? (
        households.map((h) => (
          <section key={h.id}>
            <h2>{h.name}</h2>
            <h3>Displays</h3>
            <ul>
              {(devices ?? [])
                .filter((d) => d.household_id === h.id)
                .map((d) => (
                  <li key={d.id}>
                    {d.name} {d.revoked_at ? '(revoked)' : '(active)'}
                    {!d.revoked_at && (
                      <form method="post" action="/displays/revoke">
                        <input type="hidden" name="device_id" value={d.id} />
                        <button type="submit">Revoke</button>
                      </form>
                    )}
                  </li>
                ))}
            </ul>
            <form method="post" action="/displays">
              <input type="hidden" name="household_id" value={h.id} />
              <label>
                New display name
                <input name="name" maxLength={100} required />
              </label>
              <button type="submit">Create pairing code</button>
            </form>
          </section>
        ))
      ) : (
        <form method="post" action="/households">
          <label>
            Household name
            <input name="name" maxLength={100} required />
          </label>
          <button type="submit">Create household</button>
        </form>
      )}

      <form method="post" action="/auth/sign-out">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}