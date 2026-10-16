import { NextResponse } from 'next/server.js';

// Form posts to route handlers have no built-in CSRF check, so require a same-origin Origin header.
// The browser-visible host comes from the forwarded or Host header: request.url can report the
// server's bind address (for example localhost) instead of the address the device used.
export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.split(',')[0].trim();
  } catch {
    return false;
  }
}

export function forbidden() {
  return new NextResponse('Forbidden', { status: 403 });
}

// 303 turns the POST into a GET on the target page. The target uses the address the device
// used, not the server's bind address.
export function redirectTo(request: Request, path: string) {
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').split(',')[0].trim();
  const proto = (request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '')).split(',')[0].trim();
  const base = host ? `${proto}://${host}` : request.url;
  return NextResponse.redirect(new URL(path, base), 303);
}
