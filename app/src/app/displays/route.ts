import { createServerSupabase } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { PAIRING_TTL_MINUTES, provisionDisplay } from '@/lib/displays';
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const page = (code: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Pair display</title>
</head><body><main style="font-family:system-ui;max-width:32rem;margin:2rem auto;padding:1rem">
<h1>Pairing code</h1><p style="font-size:2.5rem;letter-spacing:.2em;font-weight:700">${code}</p>
<p>Enter this on the display at <strong>/display</strong>. It works once and expires in ${PAIRING_TTL_MINUTES} minutes. It will not be shown again.</p>
<p><a href="/">Back</a></p></main></body></html>`;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  if (!isSupabaseConfigured()) return redirectTo(request, '/');

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return redirectTo(request, '/login');

  const form = await request.formData();
  try {
    const { code } = await provisionDisplay(supabase, createServiceClient(), {
      householdId: String(form.get('household_id') ?? ''),
      name: String(form.get('name') ?? ''),
    });
    return new Response(page(code), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch {
    return redirectTo(request, '/?error=display');
  }
}
