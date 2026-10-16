import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Runs against a real Supabase stack (npx supabase start). Skipped when it is not configured.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);
const opts = { skip: enabled ? false : 'local Supabase env not set' };

const run = Date.now();
const password = 'correct-horse-battery';
const emailA = `parent-a-${run}@example.test`;
const emailB = `parent-b-${run}@example.test`;

const client = () => createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
let admin: SupabaseClient;

before(async () => {
  if (!enabled) return;
  admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const email of [emailA, emailB]) {
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(error, null);
  }
});

async function signedIn(email: string) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  assert.equal(error, null);
  return c;
}

test('public sign-up is disabled', opts, async () => {
  const { data, error } = await client().auth.signUp({ email: `open-${run}@example.test`, password });
  assert.ok(error, 'sign-up must be rejected');
  assert.equal(data.user, null);
});

test('sign-in succeeds with valid credentials', opts, async () => {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email: emailA, password });
  assert.equal(error, null);
  assert.equal(data.user?.email, emailA);
});

test('sign-in fails with invalid credentials', opts, async () => {
  const { data, error } = await client().auth.signInWithPassword({ email: emailA, password: 'wrong-password-1' });
  assert.ok(error);
  assert.equal(data.session, null);
});

test('anonymous callers cannot create or read households', opts, async () => {
  const c = client();
  const rpc = await c.rpc('create_household', { household_name: 'Nope' });
  assert.ok(rpc.error);
  const read = await c.from('households').select('id');
  assert.ok(read.error || read.data?.length === 0);
});

test('a parent creates a household and becomes its parent member', opts, async () => {
  const a = await signedIn(emailA);
  const created = await a.rpc('create_household', { household_name: 'Alpha' });
  assert.equal(created.error, null);
  const { data, error } = await a.from('households').select('id, name');
  assert.equal(error, null);
  assert.deepEqual(data?.map((h) => h.name), ['Alpha']);
  const members = await a.from('household_members').select('role');
  assert.deepEqual(members.data?.map((m) => m.role), ['parent']);
});

test('a parent cannot see or change another household', opts, async () => {
  const a = await signedIn(emailA);
  const b = await signedIn(emailB);
  const created = await b.rpc('create_household', { household_name: 'Beta' });
  assert.equal(created.error, null);

  const aHouseholds = await a.from('households').select('id, name');
  assert.deepEqual(aHouseholds.data?.map((h) => h.name), ['Alpha']);

  const betaId = (await b.from('households').select('id').single()).data!.id;
  const direct = await a.from('households').select('id').eq('id', betaId);
  assert.equal(direct.data?.length, 0);

  const update = await a.from('households').update({ name: 'Hijacked' }).eq('id', betaId).select();
  assert.equal(update.data?.length ?? 0, 0);
  const del = await a.from('households').delete().eq('id', betaId).select();
  assert.equal(del.data?.length ?? 0, 0);

  const members = await a.from('household_members').select('household_id').eq('household_id', betaId);
  assert.equal(members.data?.length, 0);

  const intact = await b.from('households').select('name').eq('id', betaId).single();
  assert.equal(intact.data?.name, 'Beta');
});

test('clients cannot insert membership or household rows directly', opts, async () => {
  const a = await signedIn(emailA);
  const b = await signedIn(emailB);
  const betaId = (await b.from('households').select('id').single()).data!.id;
  const { data: me } = await a.auth.getUser();
  const join = await a.from('household_members').insert({ household_id: betaId, user_id: me.user!.id, role: 'parent' });
  assert.ok(join.error);
  const direct = await a.from('households').insert({ name: 'Direct' });
  assert.ok(direct.error);
});

test('sign-out ends access', opts, async () => {
  const a = await signedIn(emailA);
  assert.equal((await a.from('households').select('id')).data?.length, 1);
  const out = await a.auth.signOut();
  assert.equal(out.error, null);
  const after = await a.from('households').select('id');
  assert.ok(after.error || after.data?.length === 0);
  assert.ok((await a.rpc('create_household', { household_name: 'After' })).error);
});
