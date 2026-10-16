import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// Display provisioning logic. Clients are injected so it can run in routes and in tests.
// `parent` is a client holding the parent's own session (RLS applies); `service` is the
// service-role client and must only ever be created in server code.

export class DisplayError extends Error {
  code: 'forbidden' | 'invalid' | 'failed';
  constructor(code: 'forbidden' | 'invalid' | 'failed') {
    super(code);
    this.code = code;
  }
}

export const PAIRING_TTL_MINUTES = 10;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export const displayEmail = (deviceId: string) => `display-${deviceId}@display.invalid`;

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

export function normalizeCode(input: string) {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(code) ? code : null;
}

function newCode() {
  return Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

export async function provisionDisplay(
  parent: SupabaseClient,
  service: SupabaseClient,
  input: { householdId: string; name: string },
) {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 100) throw new DisplayError('invalid');

  // Authorization comes from the database using the caller's own JWT.
  const { data: isParent, error } = await parent.rpc('is_household_parent', { hid: input.householdId });
  if (error || isParent !== true) throw new DisplayError('forbidden');

  const deviceId = randomUUID();
  const created = await service.auth.admin.createUser({
    email: displayEmail(deviceId),
    password: randomBytes(32).toString('base64url'),
    email_confirm: true,
    app_metadata: { clover_role: 'display' },
  });
  if (created.error || !created.data.user) throw new DisplayError('failed');
  const userId = created.data.user.id;

  const code = newCode();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MINUTES * 60_000).toISOString();
  const device = await service.from('display_devices').insert({
    id: deviceId,
    household_id: input.householdId,
    user_id: userId,
    name,
  });
  const pairing = device.error
    ? null
    : await service.from('display_pairings').insert({ device_id: deviceId, code_hash: hashCode(code), expires_at: expiresAt });
  if (device.error || pairing?.error) {
    await service.auth.admin.deleteUser(userId); // cascades to the device row
    throw new DisplayError('failed');
  }
  return { deviceId, code, expiresAt };
}

// Exchanges a valid code for credentials. The password is random and never stored, so the
// only holder of a working credential is the caller that redeemed the code.
export async function redeemPairing(service: SupabaseClient, rawCode: string) {
  const code = normalizeCode(rawCode);
  if (!code) throw new DisplayError('invalid');

  const { data, error } = await service.rpc('redeem_display_pairing', { p_code_hash: hashCode(code) });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) throw new DisplayError('invalid');

  const password = randomBytes(32).toString('base64url');
  const updated = await service.auth.admin.updateUserById(row.user_id, { password });
  if (updated.error) throw new DisplayError('failed');
  return { deviceId: row.device_id as string, email: displayEmail(row.device_id), password };
}

export async function revokeDisplay(parent: SupabaseClient, service: SupabaseClient, deviceId: string) {
  // The database function decides whether this parent may revoke; the row-level check applies.
  const { error } = await parent.rpc('revoke_display_device', { device_id: deviceId });
  if (error) throw new DisplayError('forbidden');

  // Row-level security already blocks the display. Banning also stops token refresh.
  const { data } = await service.from('display_devices').select('user_id').eq('id', deviceId).single();
  if (data?.user_id) {
    const banned = await service.auth.admin.updateUserById(data.user_id, { ban_duration: '876000h' });
    if (banned.error) throw new DisplayError('failed');
  }
}
