import { randomUUID } from 'node:crypto';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'cache-control': 'no-store' };

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) return new Response('Unavailable', { status: 503, headers: noStore });
  if (!auth.user) return new Response('Unauthorized', { status: 401, headers: noStore });

  const { data: device, error: deviceError } = await supabase
    .from('display_devices')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (deviceError) return new Response('Unavailable', { status: 503, headers: noStore });
  if (!device) return new Response('Unauthorized', { status: 401, headers: noStore });

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return new Response('Unauthorized', { status: 401, headers: noStore });
  supabase.realtime.setAuth(session.session.access_token);

  let closed = false;
  let controllerRef: ReadableStreamDefaultController<string> | undefined;
  const send = (chunk: string) => {
    if (!closed) controllerRef?.enqueue(chunk);
  };
  const channel = supabase
    .channel(`display-${device.id}-${randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sample_tasks' },
      () => send('event: change\ndata: {}\n\n'),
    );
  let heartbeat: ReturnType<typeof setInterval>;

  const body = new ReadableStream<string>({
    start(controller) {
      controllerRef = controller;
      heartbeat = setInterval(() => send(': keep-alive\n\n'), 15_000);
      channel.subscribe((status) => {
        if (closed) return;
        if (status === 'SUBSCRIBED') {
          send(': connected\n\n');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          send('event: unavailable\ndata: {}\n\n');
          closed = true;
          clearInterval(heartbeat);
          controller.close();
          void channel.unsubscribe();
        }
      });
    },
    cancel() {
      closed = true;
      clearInterval(heartbeat);
      void channel.unsubscribe();
    },
  });

  return new Response(body, {
    headers: {
      ...noStore,
      'content-type': 'text/event-stream; charset=utf-8',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
