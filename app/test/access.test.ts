import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(
  new URL('../supabase/migrations/20261016120000_households_and_access.sql', import.meta.url),
  'utf8',
);

const parentA = '00000000-0000-0000-0000-00000000000a';
const parentB = '00000000-0000-0000-0000-00000000000b';
const displayA = '00000000-0000-0000-0000-0000000000d1';

const db = new PGlite();

// Run a statement as a Supabase-style user (or as no one) under row-level security.
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

async function denied(uid: string | null, sql: string, params: unknown[] = []) {
  await assert.rejects(() => as(uid, sql, params));
}

let householdA: string;
let householdB: string;
let displayDeviceId: string;

before(async () => {
  // Stand-ins for objects Supabase provides.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    grant usage on schema public to authenticated, anon;
    insert into auth.users (id) values ('${parentA}'), ('${parentB}'), ('${displayA}');
  `);
  await db.exec(migration);

  householdA = (await as<{ id: string }>(parentA, `select public.create_household('Family A') as id`))[0].id;
  householdB = (await as<{ id: string }>(parentB, `select public.create_household('Family B') as id`))[0].id;
  // The server (service role) registers the display, so no client policy allows inserting devices.
  displayDeviceId = (
    await db.query<{ id: string }>(
      `insert into public.display_devices (household_id, user_id, name) values ($1, $2, 'iPad') returning id`,
      [householdA, displayA],
    )
  ).rows[0].id;
});

test('a parent sees only their own household', async () => {
  const rows = await as<{ id: string }>(parentA, 'select id from public.households');
  assert.deepEqual(rows.map((r) => r.id), [householdA]);
});

test('a parent cannot read or change another household', async () => {
  assert.equal((await as(parentA, 'select * from public.households where id = $1', [householdB])).length, 0);
  assert.equal((await as(parentA, 'select * from public.household_members where household_id = $1', [householdB])).length, 0);
  await as(parentA, `update public.households set name = 'Hijacked' where id = $1`, [householdB]);
  const name = (await db.query<{ name: string }>('select name from public.households where id = $1', [householdB])).rows[0].name;
  assert.equal(name, 'Family B');
});

test('clients cannot insert households or members directly', async () => {
  await denied(parentA, `insert into public.households (name) values ('Direct')`);
  await denied(parentA, `insert into public.household_members (household_id, user_id) values ($1, $2)`, [householdA, parentB]);
});

test('anonymous and identity-less sessions have no access', async () => {
  await db.exec('set role anon');
  try {
    await assert.rejects(() => db.query('select * from public.households'));
    await assert.rejects(() => db.query(`select public.create_household('Nope')`));
  } finally {
    await db.exec('reset role');
  }
  assert.equal((await as(null, 'select * from public.households')).length, 0);
  await denied(null, `select public.create_household('Nope')`);
});

test('a display can read its household but is not a parent', async () => {
  const rows = await as<{ id: string }>(displayA, 'select id from public.households');
  assert.deepEqual(rows.map((r) => r.id), [householdA]);
  assert.equal((await as(displayA, 'select * from public.household_members')).length, 0);
  assert.equal((await as(displayA, 'select public.is_household_parent($1) as p', [householdA]))[0].p, false);
});

test('a display cannot change or delete household data', async () => {
  await as(displayA, `update public.households set name = 'Changed' where id = $1`, [householdA]);
  await as(displayA, 'delete from public.households where id = $1', [householdA]);
  const rows = (await db.query<{ name: string }>('select name from public.households where id = $1', [householdA])).rows;
  assert.equal(rows[0].name, 'Family A');
});

test('a display cannot create households, revoke devices, or add devices', async () => {
  await denied(displayA, `select public.create_household('Display home')`);
  await denied(displayA, 'select public.revoke_display_device($1)', [displayDeviceId]);
  await denied(displayA, `insert into public.display_devices (household_id, user_id, name) values ($1, $2, 'x')`, [householdA, parentA]);
});

test('another household cannot see or revoke this display', async () => {
  assert.equal((await as(parentB, 'select * from public.display_devices')).length, 0);
  await denied(parentB, 'select public.revoke_display_device($1)', [displayDeviceId]);
});

test('a parent can list and revoke their display, which then loses access', async () => {
  assert.equal((await as(parentA, 'select * from public.display_devices')).length, 1);
  await as(parentA, 'select public.revoke_display_device($1)', [displayDeviceId]);
  assert.equal((await as(displayA, 'select * from public.households')).length, 0);
  assert.equal((await as(displayA, 'select * from public.display_devices')).length, 0);
});
