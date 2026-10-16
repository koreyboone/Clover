import { test, before } from 'node:test';
import assert from 'node:assert/strict';
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
  assert.equal((await parentA.rpc('poc_seed_sample', { hid: householdA })).error, null);
  assert.equal((await parentB.rpc('poc_seed_sample', { hid: householdB })).error, null);
});

test('seeding is limited to the household parent and is idempotent', opts, async () => {
  assert.ok((await parentB.rpc('poc_seed_sample', { hid: householdA })).error);
  assert.equal((await parentA.rpc('poc_seed_sample', { hid: householdA })).error, null);
  assert.equal((await tasksOf(parentA)).length, 3);
});

test('a parent edits a task and the display sees the change', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const [first] = await tasksOf(parentA);
  const renamed = await parentA.rpc('poc_rename_task', { task_id: first.id, new_title: 'Make the bed' });
  assert.equal(renamed.error, null);
  assert.equal((await tasksOf(display))[0].title, 'Make the bed');
  for (const bad of ['', '   ', 'x'.repeat(101)]) {
    assert.ok((await parentA.rpc('poc_rename_task', { task_id: first.id, new_title: bad })).error);
  }
});

test('a parent cannot edit or review another household', opts, async () => {
  const [bTask] = await tasksOf(parentB);
  assert.ok((await parentA.rpc('poc_rename_task', { task_id: bTask.id, new_title: 'Hijack' })).error);
  assert.ok((await parentA.rpc('poc_review_task', { task_id: bTask.id, decision: 'assist' })).error);
  assert.equal((await tasksOf(parentB))[0].title, bTask.title);
  assert.equal((await tasksOf(parentA)).some((t) => t.id === bTask.id), false);
});

test('the child action waits for a parent; rejection returns it to incomplete', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const task = (await tasksOf(display))[1];

  const done = await display.rpc('poc_mark_task_done', { task_id: task.id });
  assert.equal(done.data, 'awaiting_verification');
  // A second tap while waiting is harmless.
  assert.equal((await display.rpc('poc_mark_task_done', { task_id: task.id })).data, 'awaiting_verification');

  const rejected = await parentA.rpc('poc_review_task', { task_id: task.id, decision: 'reject' });
  assert.equal(rejected.data, 'incomplete');
  assert.equal((await tasksOf(display))[1].status, 'incomplete');
});

test('a parent approves a task that is awaiting verification', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const task = (await tasksOf(display))[1];
  await display.rpc('poc_mark_task_done', { task_id: task.id });
  assert.equal((await parentA.rpc('poc_review_task', { task_id: task.id, decision: 'approve' })).data, 'complete');
  assert.equal((await tasksOf(display))[1].status, 'complete');
  // Neither another tap nor a second approval changes a resolved task.
  assert.equal((await display.rpc('poc_mark_task_done', { task_id: task.id })).data, 'complete');
  assert.ok((await parentA.rpc('poc_review_task', { task_id: task.id, decision: 'approve' })).error);
});

test('a parent records assistance without a child action', opts, async () => {
  const task = (await tasksOf(parentA))[2];
  assert.equal((await parentA.rpc('poc_review_task', { task_id: task.id, decision: 'assist' })).data, 'assisted');
  assert.ok((await parentA.rpc('poc_review_task', { task_id: task.id, decision: 'reject' })).error);
  assert.ok((await parentA.rpc('poc_review_task', { task_id: task.id, decision: 'bogus' })).error);
});

test('approve and reject need a task awaiting verification', opts, async () => {
  const { display } = await pairedDisplay(householdB, parentB);
  const [task] = await tasksOf(display);
  assert.equal(task.status, 'incomplete');
  assert.ok((await parentB.rpc('poc_review_task', { task_id: task.id, decision: 'approve' })).error);
  assert.ok((await parentB.rpc('poc_review_task', { task_id: task.id, decision: 'reject' })).error);
  assert.equal((await tasksOf(parentB))[0].status, 'incomplete');
});

test('a display cannot act outside its role or household', opts, async () => {
  const { display } = await pairedDisplay(householdA, parentA);
  const [aTask] = await tasksOf(display);
  const [bTask] = await tasksOf(parentB);

  assert.ok((await display.rpc('poc_mark_task_done', { task_id: bTask.id })).error, 'other household');
  assert.ok((await display.rpc('poc_rename_task', { task_id: aTask.id, new_title: 'Nope' })).error);
  assert.ok((await display.rpc('poc_review_task', { task_id: aTask.id, decision: 'assist' })).error);
  assert.ok((await display.rpc('poc_seed_sample', { hid: householdA })).error);

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
  assert.ok((await anon.rpc('poc_mark_task_done', { task_id: task.id })).error);
  assert.ok((await anon.rpc('poc_review_task', { task_id: task.id, decision: 'assist' })).error);
  assert.ok((await anon.from('sample_tasks').select('id')).error);
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
  assert.ok((await sameToken.rpc('poc_mark_task_done', { task_id: task.id })).error);
  assert.ok((await display.rpc('poc_mark_task_done', { task_id: task.id })).error);
});

test('task state persists across a new session (restart)', opts, async () => {
  const before = await tasksOf(parentA);
  const again = await signedIn(`poc-a-${run}@example.test`);
  assert.deepEqual(await tasksOf(again), before);
});
