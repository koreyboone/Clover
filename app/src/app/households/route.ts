import { createServerSupabase } from '@/lib/supabase/server';
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  if (!isSupabaseConfigured()) return redirectTo(request, '/');

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return redirectTo(request, '/login');

  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  if (name.length < 1 || name.length > 100) return redirectTo(request, '/?error=name');

  // The database function enforces who may create a household; displays are refused there.
  const { error } = await supabase.rpc('create_household', { household_name: name });
  if (error) return redirectTo(request, '/?error=create');

  return redirectTo(request, '/');
}
