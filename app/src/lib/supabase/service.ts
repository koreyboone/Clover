import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicSupabaseConfig } from './config';

// Service-role client: bypasses row-level security. Use only in trusted server code,
// for example creating or revoking a display device session.
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (see .env.example).');
  return createClient(publicSupabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
