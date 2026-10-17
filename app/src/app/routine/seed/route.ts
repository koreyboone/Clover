import { parentRoutePaths, sampleRoutineAction } from '@/lib/sample-routine';

export async function POST(request: Request) {
  return sampleRoutineAction(request, parentRoutePaths, (supabase, form) =>
    supabase.rpc('poc_seed_sample', {
      hid: String(form.get('household_id') ?? ''),
      idempotency_key: String(form.get('idempotency_key') ?? ''),
    }),
  );
}
