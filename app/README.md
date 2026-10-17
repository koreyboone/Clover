# Clover app operations guide

This guide describes the repository as it exists today. The app is an early proof of concept: parent sign-in, household creation, display pairing/revocation, and one sample routine are implemented. Scheduled routine runs, rewards, pilot logs, household-level export/restore, and a supported household/account deletion workflow are **not** implemented. Do not treat this proof of concept as a finished production service.

## Requirements and clean local setup

Use a fresh checkout (or worktree), not a copy of an existing `app/.env.local`, `.next`, or `node_modules`:

1. Install a supported Node.js release (20.9 or newer) with npm, Git, and Docker Desktop. Start Docker Desktop and wait until its engine is running. The Supabase CLI used below is installed from this app's locked npm dependencies.
2. From the repository root, run:

   ```powershell
   cd app
   npm ci
   Copy-Item .env.example .env.local
   npx supabase start -x imgproxy,edge-runtime,logflare,vector,storage-api,postgres-meta,supavisor
   ```

   The first local start downloads the Supabase containers and can take several minutes. Keep this local stack isolated from any hosted project. Supabase CLI applies the versioned migrations on first startup. After the CLI reports startup complete, allow about a minute for Realtime to initialize on its first boot before starting integration tests; the realtime integration test can time out if run while that service is still warming up. To apply any later pending migrations to this local stack, use `npx supabase migration up --local`. This is deliberately not `db reset`; a reset destroys data in the target database. Never run a reset against a linked or shared development/production project.
3. Get the local API URL, anon key, and service-role key from the local CLI's `npx supabase status` output. Put them in `.env.local` under the names shown in `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` = local API URL (normally `http://127.0.0.1:55321`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = local anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = local service-role key

   The CLI prints credentials. Keep them in this ignored local file; do not paste them in issues, logs, chat, source control, or browser/client code. The service-role key bypasses row-level security and must remain server-only. Do not add a `NEXT_PUBLIC_` prefix to it. The two `NEXT_PUBLIC_` settings are the browser-safe URL and anon key; database policies are still the authorization boundary.
4. Public sign-up is disabled. For a local parent account, open Supabase Studio at `http://127.0.0.1:55323`, go to **Authentication → Users**, and add a user with a confirmed email and a password. This is a trusted local admin action, not an app sign-up flow. Keep the account credentials private.
5. From `app/`, verify and run:

   ```powershell
   npm run typecheck
   npm test
   npm run test:local
   npm run build
   npm run dev
   ```

   `npm test` runs the unit/database tests; the real-Supabase integration tests are skipped unless configured. `npm run test:local` loads `.env.local` and exercises auth, household isolation, and display flows against the running local Supabase stack. The development app is at `http://localhost:3000`; sign in using the parent account created in Studio.

Supabase's standard local ports are configured in `supabase/config.toml` (API 55321, database 55322, Studio 55323). If they are already occupied, do not stop an existing stack that may contain data. Use a separate worktree and change its `project_id` and conflicting host ports to unused values before `supabase start`; point that worktree's `.env.local` at its own CLI-reported API and keys. Do not link a local verification stack to a hosted project.

## Parent account and household

- **Account creation:** there is no public registration page or self-service invite flow. A trusted administrator creates a confirmed parent account through Supabase Auth administration (local Studio for development; the hosted Supabase Dashboard for a hosted environment). The hosted project must have public sign-up disabled while email/password sign-in remains enabled. Do not disable the email provider itself.
- **Sign in:** visit `/login` (or `/` while signed out) and enter the provisioned parent's email/password. Authentication is email/password through Supabase Auth.
- **Create a household:** after signing in, use **Household name → Create household**. The authenticated database function makes this user the household's first parent; household access is RLS-scoped. The proof of concept currently supports the household experience shown on the home page; it has no member invitation UI.
- **Sign out:** use **Sign out** at the bottom of the parent page. The route calls Supabase Auth's default global sign-out, which can sign this account out on its other browsers/devices too; sign in again where needed. Already-issued access tokens may remain valid until their normal expiry.
- To exercise the current sample flow, create the sample routine from the household page. Rename tasks and review/assist from a parent session; a paired display can mark an incomplete task as done. This is a sample only, not scheduled routines.

## Visual design and accessibility

The implemented color, typography, component, responsive, and accessibility rules are documented in [`docs/visual-design-system.md`](docs/visual-design-system.md), along with the Task 1.9 before/after screenshot index and browser-emulated validation results.

## Pair and manage the shared display

1. Sign in as a parent and, under the intended household, enter a display name and select **Create pairing code**.
2. The app displays an **8-character** code once. Give it only to the person pairing the intended display. It is single-use and expires after **10 minutes**; it is not retrievable later. A wrong, used, expired, or revoked code is refused with the same general error.
3. On the display (for example, the iPad), visit `/display`, enter the code, and select **Pair**. The display gets its own restricted Supabase Auth session in that browser's cookies. It is not a parent account; do not sign the shared display into a parent's session. Children do not have accounts.
4. The parent home page lists each display. **Revoke** immediately removes database access and prevents refresh. To replace a display session or issue a replacement after a code expires, revoke the old device and create a new display/code; pair the intended display with the new code. There is no in-place reissue action.

Pairing codes are short-lived and single-use, but code-redemption rate limiting is not implemented yet. Do not expose this proof of concept publicly until that protection and the remaining security/readiness work are addressed.

## Display restarts and connection recovery

- The display stores its last successful snapshot in that browser's local storage. It shows the last-sync time and renders the cached view read-only while unreachable; task actions are disabled and offline writes are not queued.
- Keep the display browser open through a temporary Wi-Fi, app-server, or Supabase interruption. It checks server health periodically, refreshes when connectivity returns, and uses a 15-second refresh poll if realtime updates are unavailable. A parent rename or other server-side change becomes visible after a successful refresh.
- Restarting the browser/device or app/database service does not by itself require pairing again. Re-pair only if the session is revoked, expires/becomes invalid, the browser's session is lost, or access otherwise returns to the pairing page. If it remains on **Reconnecting…** or shows an old snapshot, first restore network/DNS and the app/Supabase services, then wait for automatic recovery or reload `/display`; do not create a new pairing code just because the network was briefly down.
- If the browser's local storage is cleared, there is no cached snapshot until the paired display next loads successfully. Cached data is stale and is not a backup or an authoritative copy.

### Optional same-Wi-Fi device check (development only)

Prefer a deployed HTTPS preview for testing devices. If testing the development server over a trusted private home network, run `npm run dev -- --hostname 0.0.0.0` and use the PC's private LAN address on the device, with the Supabase API URL reachable from that device. Allow the app port only on the private network and remove the temporary firewall rule afterward. This is plain, unprotected development HTTP: **never expose it to the internet**, use router port forwarding, or open it on a public network. Do not expose the Supabase local ports. See [`docs/device-checklist.md`](docs/device-checklist.md) for reported physical-device results and steps. Its recorded initial iPad `ERR_INTERNET_DISCONNECTED` attempt and successful retry are retained there.

Studio account creation and device/browser interaction require a person; automated integration tests instead create temporary confirmed users through the local admin API. iPad/iPhone/Galaxy checks, private-Wi-Fi/firewall configuration, Vercel project setup, and hosted Supabase settings are not part of clean-checkout automation. No physical-device test or live/production deployment was performed for this documentation task; the device checklist records the separately reported earlier results and limitations.

## Hosted deployment instructions (not performed by this guide)

No production deployment or production configuration has been made or validated as part of this documentation.

### Supabase

1. Create separate hosted Supabase projects for staging and production. Keep project ownership, billing, region, data residency, access, and operational responsibility explicit. Configure the hosted Auth URL/site settings for the intended Vercel HTTPS domain.
2. In Supabase **Authentication** settings, disable public user sign-up while leaving email/password sign-in available. Manually create confirmed parent accounts using trusted Supabase Auth administration. There is no public registration or invitation mechanism in this app.
3. Apply reviewed migrations to staging first. From `app/`, authenticate/link the Supabase CLI to the intended project, then inspect migration status before applying:

   ```powershell
   npx supabase login
   npx supabase link --project-ref <STAGING_PROJECT_REF>
   npx supabase migration list --linked
   npx supabase migration up --linked
   ```

   Repeat deliberately for production only after review, backup/recovery planning, and staging validation. Check the linked project/ref every time before a remote command. These are instructions only; do not run them against an actual hosted project as part of Task 1.8. Never run `db reset` on a linked project.
4. Verify the hosted Auth sign-up policy, expected RLS/function grants, and a least-privilege parent account before using real household data. Pairing-code throttling and the later pilot features remain outstanding.

### Vercel

1. Import the repository into Vercel and set the **Root Directory** to `app`; use the Next.js framework preset and its normal install/build settings (`npm ci` / `npm run build`).
2. Add these project environment variables separately for each appropriate Vercel environment (at minimum Preview and Production):
   - `NEXT_PUBLIC_SUPABASE_URL` — that environment's Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — that project's browser/anon key.
   - `SUPABASE_SERVICE_ROLE_KEY` — that project's service-role key, stored as a server-only Vercel secret.

   Use only the anon key for client-side Supabase access. Never put the service-role key in a `NEXT_PUBLIC_*` variable, source, logs, build arguments, or a browser bundle; it bypasses RLS. Use distinct staging/production project credentials and do not copy local keys to hosted settings.
3. Set the Supabase Auth site URL and allowed URLs to the deployed HTTPS domain(s). Deploy a preview first; then verify sign-in, household creation, display pairing/revocation, and both phones/display against staging. Confirm sign-up remains disabled and inspect build output/configuration for accidental secret exposure.
4. Only an authorized operator should promote a reviewed deployment to Production after migrations, backup/recovery decisions, and validation are approved. Deployment, live migrations, and production validation have **not** been performed or claimed here.

## Data, backups, restore, and deletion

### What the current proof of concept stores

The app stores data in Supabase Postgres/Auth: parent Auth identities and sessions; household names and creation metadata; parent-to-household membership; display device names, household/user associations, and revocation timestamps; hashed display pairing codes with expiry/redemption state; the three sample task titles/statuses/timestamps; and idempotency records containing actor, household, action, request payload/result, and time. Display browsers also cache the last successful sample-display snapshot in local storage. This proof of concept has no file-upload feature; do not store sensitive information in sample task text. Later routine, child, reward, and pilot data are not implemented yet.

### Provider backups are not household export/restore

Supabase-managed database backups, where available, are provider-level recovery points, not a household-readable export or a per-household restore. Availability, frequency, retention, restore options, and cost depend on the Supabase plan and current provider terms. A database backup should not be assumed to include Storage file contents, project secrets, or a separately usable household export. There are currently no app file uploads.

Task 4.1's versioned household export, validated transactional restore, and confirmed deletion are **not implemented**. There is no app-level export/restore flow or supported household-deletion UI/workflow. Although the current schema has database cascades for some household-owned rows, do not treat direct SQL/admin deletion as a complete deletion process: it does not define how to remove associated Auth identities, verify all future data, or handle provider-held copies.

Before storing real household data, the owner must decide and document: the selected Supabase plan and its actual backup coverage/retention/cost; recovery-point and recovery-time objectives; who can access/restore backups; an independent export or backup strategy; restore-drill frequency and responsibility; treatment of Auth data and any future Storage objects; and the deletion process, verification, and provider retention/backup caveats. None of these production backup or deletion decisions/configurations has been made. Do not promise immediate purge from Supabase-managed backups after deletion; provider copies may persist until their applicable retention expires or under provider policy. Confirm current provider terms rather than inventing a retention period.

## Commands at a glance

Run in `app/` after configuring `.env.local` and starting the local Supabase stack:

| Purpose | Command |
| --- | --- |
| Install exactly from lockfile | `npm ci` |
| Run fast/unit tests | `npm test` |
| Run tests against local Supabase | `npm run test:local` |
| Type check | `npm run typecheck` |
| Production compile | `npm run build` |
| Start local Supabase | `npx supabase start` |
| Apply pending migrations to local Supabase | `npx supabase migration up --local` |
| Start development app | `npm run dev` |
| Start built app | `npm start` |

Never point the integration tests or migration commands at production. Keep `.env.local` out of source control; it is ignored by Git.
