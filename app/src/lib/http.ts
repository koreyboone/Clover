import { NextResponse } from 'next/server';

// Form posts to route handlers have no built-in CSRF check, so require a same-origin Origin header.
export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function forbidden() {
  return new NextResponse('Forbidden', { status: 403 });
}

// 303 turns the POST into a GET on the target page.
export function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}
