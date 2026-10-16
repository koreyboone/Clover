import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameOrigin, redirectTo } from '../src/lib/http.ts';

const req = (headers: Record<string, string>, url = 'http://localhost:3100/auth/sign-in') =>
  new Request(url, { method: 'POST', headers });

test('same-origin uses the host the device used, not the bind address', () => {
  assert.equal(isSameOrigin(req({ origin: 'http://192.168.1.89:3100', host: '192.168.1.89:3100' })), true);
  assert.equal(isSameOrigin(req({ origin: 'https://app.example', 'x-forwarded-host': 'app.example', host: 'internal:3000' })), true);
});

test('same-origin rejects missing, foreign, and mismatched origins', () => {
  assert.equal(isSameOrigin(req({ host: 'localhost:3100' })), false);
  assert.equal(isSameOrigin(req({ origin: 'http://evil.test', host: 'localhost:3100' })), false);
  assert.equal(isSameOrigin(req({ origin: 'http://192.168.1.89:3999', host: '192.168.1.89:3100' })), false);
  assert.equal(isSameOrigin(req({ origin: 'not a url', host: 'localhost:3100' })), false);
});

test('redirects stay on the host the device used', () => {
  const lan = redirectTo(req({ host: '192.168.1.89:3100' }), '/login?error=invalid');
  assert.equal(lan.status, 303);
  assert.equal(lan.headers.get('location'), 'http://192.168.1.89:3100/login?error=invalid');
  const proxied = redirectTo(req({ host: 'internal:3000', 'x-forwarded-host': 'app.example', 'x-forwarded-proto': 'https' }), '/');
  assert.equal(proxied.headers.get('location'), 'https://app.example/');
});
