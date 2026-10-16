import { parentRoutePaths, sampleRoutineAction } from '@/lib/sample-routine';

export async function POST(request: Request) {
  return sampleRoutineAction(request, parentRoutePaths, (supabase, form) =>
    supabase.rpc('poc_rename_task', {
      task_id: String(form.get('task_id') ?? ''),
      new_title: String(form.get('title') ?? ''),
    }),
  );
}
