import { parentRoutePaths, sampleRoutineAction } from '@/lib/sample-routine';

export async function POST(request: Request) {
  return sampleRoutineAction(request, parentRoutePaths, (supabase, form) =>
    supabase.rpc('poc_review_task', {
      task_id: String(form.get('task_id') ?? ''),
      decision: String(form.get('decision') ?? ''),
    }),
  );
}
