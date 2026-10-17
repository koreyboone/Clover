import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } });
  if (!auth.user) return new Response(null, { status: 401, headers: { 'cache-control': 'no-store' } });

  const { data: device, error } = await supabase
    .from('display_devices')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } });
  if (!device) return new Response(null, { status: 401, headers: { 'cache-control': 'no-store' } });
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
