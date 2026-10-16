import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DisplayError, provisionDisplay, redeemPairing, revokeDisplay } from '../src/lib/displays-core.ts';

// Runs against a real Supabase stack (npx supabase start). Skipped when it is not configured.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);
const opts = { skip: enabled ? false : 'local Supabase env not set' };

const run = Date.now();
const password = 'correct-horse-battery';
const emailA = `disp-parent-a-${run}@example.test`;
const emailB = `disp-parent-b-${run}@example.test`;
const plain = { auth: { persistSession: false, autoRefreshToken: false } };
const client = (key = anonKey!, headers?: Record<string, string>) =>
  createClient(url!, key, { ...plain, global: { headers } });

let service: SupabaseClient;
let parentA: SupabaseClient;
let parentB: SupabaseClient;
let householdA: string;
let householdB: string;

async function signedIn(email: string, pw = password) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  assert.equal(error, null);
  return c;
}

// Provisions a display for household A and pairs it, returning a signed-in display client.
async function pairedDisplay(household = householdA) {
  const { deviceId, code } = await provisionDisplay(parentA, service, { householdId: household, name: 'iPad' });
  const creds = await redeemPairing(service, code);
  const display = await signedIn(creds.email, creds.password);
  return { deviceId, display, creds };
}

before(async () => {
  if (!enabled) return;
  service = createClient(url!, serviceKey!, plain);
  for (const email of [emailA, emailB]) {
    const { error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(error, null);
  }
  parentA = await signedIn(emailA);
  parentB = await signedIn(emailB);
  householdA = (await parentA.rpc('create_household', { household_name: 'Disp A' })).data;
  householdB = (await parentB.rpc('create_household', { household_name: 'Disp B' })).data;
});

test('a parent provisions a display for their own household', opts, async () => {
  const { deviceId, code } = await provisionDisplay(parentA, service, { householdId: householdA, name: 'Kitchen iPad' });
  assert.match(code, /^[A-Z2-9]{8}$/);
  const row = await service.from('display_devices').select('household_id, revoked_at').eq('id', deviceId).single();
  assert.equal(row.data?.household_id, householdA);
  assert.equal(row.data?.revoked_at, null);
  const stored = await service.from('display_pairings').select('code_hash').eq('device_id', deviceId).single();
  assert.notEqual(stored.data?.code_hash, code, 'only a hash of the code is stored');
});

test('a parent cannot provision a display for another household', opts, async () => {
  const before = await service.from('display_devices').select('id', { count: 'exact', head: true }).eq('household_id', householdB);
  await assert.rejects(
    () => provisionDisplay(parentA, service, { householdId: householdB, name: 'Sneaky' }),
    (e) => e instanceof DisplayError && e.code === 'forbidden',
  );
  const after = await service.from('display_devices').select('id', { count: 'exact', head: true }).eq('household_id', householdB);
  assert.equal(after.count, before.count);
});

test('a display session cannot provision or redeem on its own', opts, async () => {
  const { display } = await pairedDisplay();
  await assert.rejects(
    () => provisionDisplay(display, service, { householdId: householdA, name: 'Clone' }),
    (e) => e instanceof DisplayError && e.code === 'forbidden',
  );
  // Clients lack execute rights on the redeem function and any access to pairings.
  assert.ok((await display.rpc('redeem_display_pairing', { p_code_hash: 'x' })).error);
  assert.ok((await client().rpc('redeem_display_pairing', { p_code_hash: 'x' })).error);
  assert.ok((await display.from('display_pairings').select('*')).error);
});

test('pairing codes are single use, expire, and reject bad input', opts, async () => {
  const { code } = await provisionDisplay(parentA, service, { householdId: householdA, name: 'Once' });
  await redeemPairing(service, code);
  await assert.rejects(() => redeemPairing(service, code), (e) => e instanceof DisplayError);

  const expired = await provisionDisplay(parentA, service, { householdId: householdA, name: 'Old' });
  await service
    .from('display_pairings')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('device_id', expired.deviceId);
  await assert.rejects(() => redeemPairing(service, expired.code), (e) => e instanceof DisplayError);

  for (const bad of ['', 'short', 'AAAAAAAA', "' OR 1=1 --"]) {
    await assert.rejects(() => redeemPairing(service, bad), (e) => e instanceof DisplayError);
  }
});

test('a display reads only its own household and device', opts, async () => {
  const { display, deviceId } = await pairedDisplay();
  const households = await display.from('households').select('id');
  assert.deepEqual(households.data?.map((h) => h.id), [householdA]);
  assert.equal((await display.from('households').select('id').eq('id', householdB)).data?.length, 0);
  const devices = await display.from('display_devices').select('id');
  assert.deepEqual(devices.data?.map((d) => d.id), [deviceId]);
  assert.equal((await display.from('household_members').select('user_id')).data?.length, 0);
});

test('a display cannot invoke parent operations or write protected records', opts, async () => {
  const { display, deviceId } = await pairedDisplay();
  const { data: me } = await display.auth.getUser();

  assert.ok((await display.rpc('create_household', { household_name: 'Mine' })).error);
  assert.ok((await display.rpc('revoke_display_device', { device_id: deviceId })).error);
  assert.ok((await display.from('households').insert({ name: 'Direct' })).error);
  assert.ok((await display.from('household_members').insert({ household_id: householdA, user_id: me.user!.id, role: 'parent' })).error);
  assert.ok((await display.from('display_devices').insert({ household_id: householdA, user_id: me.user!.id, name: 'x' })).error);

  const rename = await display.from('households').update({ name: 'Renamed' }).eq('id', householdA).select();
  assert.ok(rename.error || rename.data?.length === 0);
  const unrevoke = await display.from('display_devices').update({ name: 'Renamed' }).eq('id', deviceId).select();
  assert.ok(unrevoke.error || unrevoke.data?.length === 0);
  const remove = await display.from('households').delete().eq('id', householdA).select();
  assert.ok(remove.error || remove.data?.length === 0);

  const intact = await parentA.from('households').select('name').eq('id', householdA).single();
  assert.equal(intact.data?.name, 'Disp A');
  assert.equal((await parentA.from('display_devices').select('id').eq('id', deviceId)).data?.length, 1);
});

test('a display cannot grant itself parent rights through its metadata', opts, async () => {
  const { display } = await pairedDisplay();
  await display.auth.updateUser({ data: { clover_role: 'parent', role: 'service_role' } });
  assert.ok((await display.rpc('create_household', { household_name: 'Escalate' })).error);
  assert.equal((await display.from('household_members').select('user_id')).data?.length, 0);
});

test('revocation blocks an existing session and its refresh token', opts, async () => {
  const { display, deviceId } = await pairedDisplay();
  const { data: before } = await display.auth.getSession();
  assert.equal((await display.from('households').select('id')).data?.length, 1);

  await assert.rejects(
    () => revokeDisplay(parentB, service, deviceId),
    (e) => e instanceof DisplayError && e.code === 'forbidden',
  );
  assert.equal((await display.from('households').select('id')).data?.length, 1, 'other parent cannot revoke');

  await revokeDisplay(parentA, service, deviceId);

  // The still-valid access token now sees nothing.
  assert.equal((await display.from('households').select('id')).data?.length, 0);
  assert.equal((await display.from('display_devices').select('id')).data?.length, 0);
  // A raw request with the previously issued token is also denied.
  const raw = client(anonKey!, { Authorization: `Bearer ${before.session!.access_token}` });
  assert.equal((await raw.from('households').select('id')).data?.length, 0);
  // The refresh token cannot mint a new session.
  const refreshed = await client().auth.refreshSession({ refresh_token: before.session!.refresh_token });
  assert.ok(refreshed.error);
  // Credentials from the earlier pairing no longer work, and revoking again is harmless.
  await revokeDisplay(parentA, service, deviceId);
});

test('revoking a display invalidates its unredeemed pairing code', opts, async () => {
  const { deviceId, code } = await provisionDisplay(parentA, service, { householdId: householdA, name: 'Unused' });
  await revokeDisplay(parentA, service, deviceId);
  await assert.rejects(() => redeemPairing(service, code), (e) => e instanceof DisplayError);
});

test('invalid, tampered, and signed-out sessions fail closed', opts, async () => {
  const { display } = await pairedDisplay();
  const { data } = await display.auth.getSession();
  const token = data.session!.access_token;

  for (const bad of ['garbage', `${token.slice(0, -4)}AAAA`, token.split('.').slice(0, 2).join('.')]) {
    const c = client(anonKey!, { Authorization: `Bearer ${bad}` });
    const res = await c.from('households').select('id');
    assert.ok(res.error || res.data?.length === 0, 'rejected token reveals nothing');
  }

  // Sign-out revokes the refresh token. An already-issued access token is stateless and stays
  // valid until jwt_expiry (see docs); only revocation, which RLS checks, cuts it off early.
  await display.auth.signOut();
  assert.ok((await client().auth.refreshSession({ refresh_token: data.session!.refresh_token })).error);
});

test('restarting or refreshing a display grants no extra permissions', opts, async () => {
  const { display, deviceId } = await pairedDisplay();
  const { data } = await display.auth.getSession();

  // A "restart": a brand new client restores the stored tokens, then refreshes them.
  const restarted = client();
  assert.equal((await restarted.auth.setSession({
    access_token: data.session!.access_token,
    refresh_token: data.session!.refresh_token,
  })).error, null);
  const refreshed = await restarted.auth.refreshSession();
  assert.equal(refreshed.error, null);

  assert.deepEqual((await restarted.from('households').select('id')).data?.map((h) => h.id), [householdA]);
  assert.equal((await restarted.from('household_members').select('user_id')).data?.length, 0);
  assert.ok((await restarted.rpc('create_household', { household_name: 'After restart' })).error);
  assert.ok((await restarted.rpc('revoke_display_device', { device_id: deviceId })).error);
  assert.equal(refreshed.data.user?.app_metadata?.clover_role, 'display');
});

test('display credentials are not usable for parent sign-in and vice versa', opts, async () => {
  const { creds } = await pairedDisplay();
  assert.ok((await client().auth.signInWithPassword({ email: creds.email, password: 'guess-guess-1' })).error);
  assert.ok((await client().auth.signInWithPassword({ email: emailA, password: creds.password })).error);
  assert.ok((await client().auth.signInWithPassword({ email: creds.email, password })).error);
});
