# Authorization design

Authorization is enforced in the database with row-level security (RLS). Hiding controls in the UI is never the control.

## Principals

| Principal | How it signs in | Household access |
| --- | --- | --- |
| Parent | Supabase Auth account | A row in `household_members` grants parent access to that household |
| Display (iPad) | A dedicated Supabase Auth user created by trusted server code | A row in `display_devices` grants a restricted, revocable session |
| Child | None. Children have no accounts | Act only through the display session |
| Anonymous | No session | None. The `anon` role has no grants |

A display is never a household member, so it can never hold parent permissions, even though it runs on the shared device. A parent signing in on the iPad would create a parent session, so the iPad is signed in only as a display user.

## Rules in the initial migration

- `households`: parents and active displays read; only parents update or delete. Inserts happen only through `create_household`, which makes the caller the first parent and refuses display users.
- `household_members`: parents read their household's members. No client writes; membership changes will use dedicated functions.
- `display_devices`: parents read their household's devices; a display reads only its own active row. Rows are created by server code with the service role and revoked by parents through `revoke_display_device`.
- Revoking a display immediately removes its access.
- Helper functions (`is_household_parent`, `is_household_display`) run as the table owner so policies do not recurse.
- Default grants are removed from `anon` and `authenticated`, then only the needed privileges are granted.

## Secrets

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public; RLS limits what they can do.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is read only in `src/lib/supabase/service.ts`, which imports `server-only` so the build fails if client code imports it. The built client bundle contains no reference to it.

## Display sessions

A display is its own Supabase auth user (`display-<id>@display.invalid`, `app_metadata.clover_role = 'display'`), registered in `display_devices` for exactly one household. It is never a household member, so it holds no parent rights. Children have no accounts.

- **Provisioning (server only).** A parent posts to `/displays`. The server asks the database, with the parent's own JWT, whether they are a parent of that household (`is_household_parent`); only then does it use the service role to create the display user, the device row, and a single-use pairing code. Only the SHA-256 of the code is stored, in `display_pairings`, which clients cannot read. Codes are 8 characters and expire after 10 minutes.
- **Pairing.** The display posts the code to `/display/pair`. `redeem_display_pairing` (service role only) consumes it atomically, the server sets a fresh random password that is never stored, and signs the display in so the session lives in the display's cookies. Wrong, used, expired, and revoked codes all give the same message.
- **Access.** RLS lets an active display read its own household and its own device row, and nothing else. It has no insert, update, or delete rights anywhere and no execute right on parent functions.
- **Revocation.** `revoke_display_device` (parent of that household only) sets `revoked_at`; every RLS check calls `is_household_display`, which requires `revoked_at is null`, so even an unexpired access token sees nothing immediately. The server also bans the auth user so the refresh token cannot mint a new session, and unredeemed codes are deleted.
- **Recovery.** `src/proxy.ts` refreshes the cookie. On `/display`, a missing, expired, invalid, banned, or revoked session shows the pairing screen. Re-pairing needs a new code from a parent.

### Session-lifecycle concerns

- Access tokens are stateless JWTs. Sign-out and ban stop refresh, but a token already issued stays cryptographically valid until `jwt_expiry` (1 hour). Revocation does not depend on this, because RLS checks the device row on every query. Anything added later must also check `is_household_display`, or it would honor a revoked token for up to an hour.
- Pairing-code redemption has no rate limit yet. The code space is about 8.5e11 with a 10 minute single-use window; add throttling before any public exposure.
- There is no parent UI to rename displays or reissue a code for an existing display. Revoke and create a new one.
- Display sessions use the default refresh-token lifetime. A display left offline for a long time may need re-pairing.

## Tests

`test/access.test.ts` applies the first migration to a fresh PostgreSQL (PGlite) with a stand-in for Supabase's `auth` schema and checks household isolation, display restrictions, direct-write denial, anonymous denial, and revocation.

`test/auth.integration.test.ts` and `test/display.integration.test.ts` run against a real local Supabase stack and cover parent sign-in and isolation plus the display lifecycle: provisioning authorization, cross-household denial, parent-operation denial, metadata escalation, revocation of live sessions and refresh tokens, expired/invalid/tampered tokens, restart and refresh. Run all of it with `npm run test:local`.

## Sign-in and sign-up

- Public sign-up is disabled (`[auth] enable_signup = false` in `supabase/config.toml`; mirror it in the hosted project under Authentication). Do not set `[auth.email] enable_signup = false`: that disables email sign-in entirely.
- Parent accounts are created by trusted code or the Supabase dashboard. Until an invite flow exists, there is no self-service account creation.
- Sign-in, sign-out, and household creation are server route handlers (`/auth/sign-in`, `/auth/sign-out`, `/households`). They require a same-origin `Origin` header, use the user's session so RLS applies, and return one generic message for bad credentials. `src/proxy.ts` refreshes the session cookie.

## Open decisions

- Adding a second parent: needs a server-validated invite flow, since disabling sign-up alone is not an invitation system. Deferred.
- Child-facing writes (completing tasks, requesting rewards): added later as database functions that check `is_household_display` or `is_household_parent`.
