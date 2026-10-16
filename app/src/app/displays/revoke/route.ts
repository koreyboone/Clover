import { createServerSupabase } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { revokeDisplay } from '@/lib/displays';
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  if (!isSupabaseConfigured()) return redirectTo(request, '/');

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return redirectTo(request, '/login');

  const form = await request.formData();
  try {
    await revokeDisplay(supabase, createServiceClient(), String(form.get('device_id') ?? ''));
  } catch {
    return redirectTo(request, '/?error=revoke');
  }
  return redirectTo(request, '/');
}
