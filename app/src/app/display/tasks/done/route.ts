import { sampleRoutineAction } from '@/lib/sample-routine';

export async function POST(request: Request) {
  return sampleRoutineAction(
    request,
    { loginPath: '/display', okPath: '/display', errorPath: '/display?error=action' },
    (supabase, form) => supabase.rpc('poc_mark_task_done', { task_id: String(form.get('task_id') ?? '') }),
  );
}
