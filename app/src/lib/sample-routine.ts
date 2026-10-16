import { createServerSupabase } from '@/lib/supabase/server';
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/config';

// Shared shape for sample-routine form posts. Authorization is decided by the database
// function each route calls, using the caller's own session; this only checks origin and login.
export async function sampleRoutineAction(
  request: Request,
  opts: { loginPath: string; okPath: string; errorPath: string },
  run: (supabase: Awaited<ReturnType<typeof createServerSupabase>>, form: FormData) => PromiseLike<{ error: unknown }>,
) {
  if (!isSameOrigin(request)) return forbidden();
  if (!isSupabaseConfigured()) return redirectTo(request, opts.okPath);

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return redirectTo(request, opts.loginPath);

  const { error } = await run(supabase, await request.formData());
  return redirectTo(request, error ? opts.errorPath : opts.okPath);
}

export const parentRoutePaths = { loginPath: '/login', okPath: '/', errorPath: '/?error=routine' };
