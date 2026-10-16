import { createServerSupabase } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { redeemPairing } from '@/lib/displays';
import { forbidden, isSameOrigin, redirectTo } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  if (!isSupabaseConfigured()) return redirectTo(request, '/display?error=unavailable');

  const form = await request.formData();
  try {
    const { email, password } = await redeemPairing(createServiceClient(), String(form.get('code') ?? ''));
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return redirectTo(request, '/display?error=invalid');
  } catch {
    // Same message for wrong, used, and expired codes.
    return redirectTo(request, '/display?error=invalid');
  }
  return redirectTo(request, '/display');
}
