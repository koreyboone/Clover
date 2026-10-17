import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { provisionDisplay, redeemPairing, revokeDisplay } from '../src/lib/displays-core.ts';

// Runs against a real Supabase stack (npx supabase start). Skipped when it is not configured.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);
const opts = { skip: enabled ? false : 'local Supabase env not set' };

const run = Date.now();
const password = 'correct-horse-battery';
const plain = { auth: { persistSession: false, autoRefreshToken: false } };
const client = () => createClient(url!, anonKey!, plain);

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

async function pairedDisplay(household: string, parent: SupabaseClient) {
  const { deviceId, code } = await provisionDisplay(parent, service, { householdId: household, name: 'iPad' });
  const creds = await redeemPairing(service, code);
  return { deviceId, display: await signedIn(creds.email, creds.password) };
}

type Task = { id: string; title: string; status: string };
const tasksOf = async (c: SupabaseClient) =>
  ((await c.from('sample_tasks').select('id, title, status').order('position')).data ?? []) as Task[];

async function freshTask(householdId: string) {
  const { data: last } = await service
    .from('sample_tasks')
    .select('position')
    .eq('household_id', householdId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await service
    .from('sample_tasks')
    .insert({ household_id: householdId, position: (last?.position ?? 0) + 1, title: 'Idempotency test' })
    .select('id, title, status')
    .single();
  assert.equal(error, null);
  return data as Task;
}

const idempotencyKey = () => randomUUID();
const seedSample = (c: SupabaseClient, householdId: string, key = idempotencyKey()) =>
  c.rpc('poc_seed_sample', { hid: householdId, idempotency_key: key });
const renameTask = (c: SupabaseClient, taskId: string, title: string, key = idempotencyKey()) =>
  c.rpc('poc_rename_task', { task_id: taskId, new_title: title, idempotency_key: key });
const markTaskDone = (c: SupabaseClient, taskId: string, key = idempotencyKey()) =>
  c.rpc('poc_mark_task_done', { task_id: taskId, idempotency_key: key });
const reviewTask = (c: SupabaseClient, taskId: string, decision: string, key = idempotencyKey()) =>
  c.rpc('poc_review_task', { task_id: taskId, decision, idempotency_key: key });

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

before(async () => {
  if (!enabled) return;
  service = createClient(url!, serviceKey!, plain);
  const emails = [`poc-a-${run}@example.test`, `poc-b-${run}@example.test`];
  for (const email of emails) {
    const { error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(error, null);
  }
  parentA = await signedIn(emails[0]);
  parentB = await signedIn(emails[1]);
  householdA = (await parentA.rpc('create_household', { household_name: 'Poc A' })).data;
  householdB = (await parentB.rpc('create_household', { household_name: 'Poc B' })).data;
  assert.equal((await seedSample(parentA, householdA)).error, null);
  assert.equal((await seedSample(parentB, householdB)).error, null);
});

test('seeding is limited to the household parent and is idempotent', opts, async () => {
  assert.ok((await seedSample(parentB, householdA)).error);
  assert.equal((await seedSample(parentA, householdA)).error, null);
  assert.equal((await tasksOf(parentA)).length, 3);
});

test('a parent edits a task and the display sees the change', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const [first] = await tasksOf(parentA);
  const renamed = await renameTask(parentA, first.id, 'Make the bed');
  assert.equal(renamed.error, null);
  assert.equal((await tasksOf(display))[0].title, 'Make the bed');
  for (const bad of ['', '   ', 'x'.repeat(101)]) {
    assert.ok((await renameTask(parentA, first.id, bad)).error);
  }
});

test('a parent cannot edit or review another household', opts, async () => {
  const [bTask] = await tasksOf(parentB);
  assert.ok((await renameTask(parentA, bTask.id, 'Hijack')).error);
  assert.ok((await reviewTask(parentA, bTask.id, 'assist')).error);
  assert.equal((await tasksOf(parentB))[0].title, bTask.title);
  assert.equal((await tasksOf(parentA)).some((t) => t.id === bTask.id), false);
});

test('the child action waits for a parent; rejection returns it to incomplete', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const task = (await tasksOf(display))[1];

  const done = await markTaskDone(display, task.id);
  assert.equal(done.data, 'awaiting_verification');
  // A second tap while waiting is harmless.
  assert.equal((await markTaskDone(display, task.id)).data, 'awaiting_verification');

  const rejected = await reviewTask(parentA, task.id, 'reject');
  assert.equal(rejected.data, 'incomplete');
  assert.equal((await tasksOf(display))[1].status, 'incomplete');
});

test('a parent approves a task that is awaiting verification', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const task = (await tasksOf(display))[1];
  await markTaskDone(display, task.id);
  assert.equal((await reviewTask(parentA, task.id, 'approve')).data, 'complete');
  assert.equal((await tasksOf(display))[1].status, 'complete');
  // Neither another tap nor a second approval changes a resolved task.
  assert.equal((await markTaskDone(display, task.id)).data, 'complete');
  assert.ok((await reviewTask(parentA, task.id, 'approve')).error);
});

test('a parent records assistance without a child action', opts, async () => {
  const task = (await tasksOf(parentA))[2];
  assert.equal((await reviewTask(parentA, task.id, 'assist')).data, 'assisted');
  assert.ok((await reviewTask(parentA, task.id, 'reject')).error);
  assert.ok((await reviewTask(parentA, task.id, 'bogus')).error);
});

test('approve and reject need a task awaiting verification', opts, async () => {
  const { display } = await pairedDisplay(householdB, parentB);
  const [task] = await tasksOf(display);
  assert.equal(task.status, 'incomplete');
  assert.ok((await reviewTask(parentB, task.id, 'approve')).error);
  assert.ok((await reviewTask(parentB, task.id, 'reject')).error);
  assert.equal((await tasksOf(parentB))[0].status, 'incomplete');
});

test('a display cannot act outside its role or household', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const [aTask] = await tasksOf(display);
  const [bTask] = await tasksOf(parentB);

  assert.ok((await markTaskDone(display, bTask.id)).error, 'other household');
  assert.ok((await renameTask(display, aTask.id, 'Nope')).error);
  assert.ok((await reviewTask(display, aTask.id, 'assist')).error);
  assert.ok((await seedSample(display, householdA)).error);

  assert.ok((await display.from('sample_tasks').insert({ household_id: householdA, position: 9, title: 'x' })).error);
  const update = await display.from('sample_tasks').update({ status: 'complete' }).eq('id', aTask.id).select();
  assert.ok(update.error || update.data?.length === 0);
  const remove = await display.from('sample_tasks').delete().eq('id', aTask.id).select();
  assert.ok(remove.error || remove.data?.length === 0);
  assert.equal((await tasksOf(display)).every((t) => t.id !== bTask.id), true);

  const status = (await tasksOf(parentA)).find((t) => t.id === aTask.id)?.status;
  assert.equal(status, aTask.status, 'direct writes changed nothing');
});

test('anonymous callers and clients cannot touch tasks', opts, async () => {
  const anon = client();
  const [task] = await tasksOf(parentA);
  assert.ok((await markTaskDone(anon, task.id)).error);
  assert.ok((await reviewTask(anon, task.id, 'assist')).error);
  assert.ok((await anon.from('sample_tasks').select('id')).error);
  assert.ok((await parentA.from('action_idempotency').select('idempotency_key')).error);
  assert.ok((await parentA.rpc('poc_claim_action', {
    p_household_id: householdA,
    p_idempotency_key: idempotencyKey(),
    p_action: 'forbidden',
    p_payload: {},
  })).error);
  assert.ok((await parentA.from('sample_tasks').update({ title: 'direct' }).eq('id', task.id)).error);
  assert.ok((await parentA.from('sample_tasks').insert({ household_id: householdA, position: 9, title: 'x' })).error);
});

test('a revoked display cannot read or act, even with an unexpired token', opts, async () => {
  const { display, deviceId } = await pairedDisplay(householdA, parentA);
  const task = (await tasksOf(parentA)).find((t) => t.status === 'incomplete') ?? (await tasksOf(parentA))[0];
  const { data } = await display.auth.getSession();
  await revokeDisplay(parentA, service, deviceId);

  const sameToken = createClient(url!, anonKey!, { ...plain, global: { headers: { Authorization: `Bearer ${data.session!.access_token}` } } });
  assert.equal((await tasksOf(sameToken)).length, 0);
  assert.ok((await markTaskDone(sameToken, task.id)).error);
  assert.ok((await markTaskDone(display, task.id)).error);
});

test('concurrent retries with one key return the original child action result once', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const task = (await tasksOf(display)).find((t) => t.status === 'incomplete')!;
  const key = idempotencyKey();

  const [first, retry] = await Promise.all([
    markTaskDone(display, task.id, key),
    markTaskDone(display, task.id, key),
  ]);
  assert.equal(first.error, null);
  assert.equal(retry.error, null);
  assert.equal(first.data, 'awaiting_verification');
  assert.equal(retry.data, first.data);

  const { data: actor } = await display.auth.getUser();
  const { data: records, error } = await service
    .from('action_idempotency')
    .select('idempotency_key')
    .eq('actor_id', actor.user!.id)
    .eq('idempotency_key', key);
  assert.equal(error, null);
  assert.equal(records?.length, 1);
});

test('a key cannot be reused for a different action payload', opts, async () => {
  const task = await freshTask(householdA);
  const key = idempotencyKey();
  assert.equal((await renameTask(parentA, task.id, 'First title', key)).error, null);
  assert.ok((await renameTask(parentA, task.id, 'Different title', key)).error);
  assert.equal((await tasksOf(parentA)).find((t) => t.id === task.id)?.title, 'First title');

  assert.equal((await renameTask(parentA, task.id, 'Later title')).error, null);
  assert.equal((await renameTask(parentA, task.id, 'First title', key)).error, null);
  assert.equal((await tasksOf(parentA)).find((t) => t.id === task.id)?.title, 'Later title');
});

test('concurrent parent retries replay the review result without a second transition', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const task = await freshTask(householdA);
  assert.equal((await markTaskDone(display, task.id)).error, null);

  const key = idempotencyKey();
  const [first, retry] = await Promise.all([
    reviewTask(parentA, task.id, 'approve', key),
    reviewTask(parentA, task.id, 'approve', key),
  ]);
  assert.equal(first.error, null);
  assert.equal(retry.error, null);
  assert.equal(first.data, 'complete');
  assert.equal(retry.data, first.data);
  assert.equal((await tasksOf(parentA)).find((t) => t.id === task.id)?.status, 'complete');
});

test('task state persists across a new session (restart)', opts, async () => {
  const before = await tasksOf(parentA);
  const again = await signedIn(`poc-a-${run}@example.test`);
  assert.deepEqual(await tasksOf(again), before);
});
