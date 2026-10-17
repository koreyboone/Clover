import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';
import { StatusMessage, TaskStatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

function ReviewButton({
  taskId,
  decision,
  label,
  secondary,
  idempotencyKey,
}: {
  taskId: string;
  decision: string;
  label: string;
  secondary?: boolean;
  idempotencyKey: string;
}) {
  return (
    <form method="post" action="/routine/review">
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <button type="submit" className={secondary ? 'secondary' : undefined}>
        {label}
      </button>
    </form>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="shell">
        <h1>Clover</h1>
        <StatusMessage>
          Supabase is not configured. Copy .env.example to .env.local and set the values.
        </StatusMessage>
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
  const { data: tasks } = await supabase
    .from('sample_tasks')
    .select('id, household_id, title, status')
    .order('position');
  const { error } = await searchParams;

  return (
    <main className="shell">
      <h1>Clover</h1>
      <p className="account-line">Signed in as {auth.user.email}</p>
      {error === 'name' && (
        <StatusMessage role="alert" tone="error">
          Enter a household name up to 100 characters.
        </StatusMessage>
      )}
      {error === 'create' && (
        <StatusMessage role="alert" tone="error">Could not create the household.</StatusMessage>
      )}
      {error === 'display' && (
        <StatusMessage role="alert" tone="error">
          Could not create the display. Check the name and try again.
        </StatusMessage>
      )}
      {error === 'revoke' && (
        <StatusMessage role="alert" tone="error">Could not revoke that display.</StatusMessage>
      )}
      {error === 'routine' && (
        <StatusMessage role="alert" tone="error">
          That change could not be applied. Refresh and try again.
        </StatusMessage>
      )}

      {households && households.length > 0 ? (
        households.map((h) => (
          <section key={h.id}>
            <h2>{h.name}</h2>
            <h3>Sample routine</h3>
            {(tasks ?? []).filter((t) => t.household_id === h.id).length === 0 ? (
              <form method="post" action="/routine/seed">
                <input type="hidden" name="household_id" value={h.id} />
                <input type="hidden" name="idempotency_key" value={randomUUID()} />
                <button type="submit">Create sample routine</button>
              </form>
            ) : (
              <ul className="tasks">
                {(tasks ?? [])
                  .filter((t) => t.household_id === h.id)
                  .map((t) => (
                    <li key={t.id} data-status={t.status}>
                      <form method="post" action="/routine/rename" className="inline-edit">
                        <input type="hidden" name="task_id" value={t.id} />
                        <input type="hidden" name="idempotency_key" value={randomUUID()} />
                        <input name="title" defaultValue={t.title} maxLength={100} required aria-label="Task title" />
                        <button type="submit" className="secondary">Save</button>
                      </form>
                      <TaskStatusBadge status={t.status} />
                      <div className="actions">
                        {t.status === 'awaiting_verification' && (
                          <>
                            <ReviewButton taskId={t.id} decision="approve" label="Approve" idempotencyKey={randomUUID()} />
                            <ReviewButton taskId={t.id} decision="reject" label="Not done" secondary idempotencyKey={randomUUID()} />
                          </>
                        )}
                        {(t.status === 'incomplete' || t.status === 'awaiting_verification') && (
                          <ReviewButton taskId={t.id} decision="assist" label="I helped" secondary idempotencyKey={randomUUID()} />
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
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