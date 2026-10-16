import { createServerSupabase } from '@/lib/supabase/server';
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  if (!isSupabaseConfigured()) return redirectTo(request, '/login?error=unavailable');

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return redirectTo(request, '/login?error=invalid');

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // One generic message so the form does not reveal whether an email has an account.
  if (error) return redirectTo(request, '/login?error=invalid');

  return redirectTo(request, '/');
}
