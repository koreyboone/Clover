import { createServerSupabase } from '@/lib/supabase/server';
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  return redirectTo(request, '/login');
}
