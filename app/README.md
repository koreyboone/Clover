# Clover app

Responsive web app for household routines, designed for an iPad Mini 5 (shared display), an iPhone 14, and a Galaxy S26 Ultra. Built with Next.js, deployed to Vercel, with Supabase for Postgres and parent authentication.

Status: foundation, parent sign-in and household creation, and restricted display sessions (tasks 1.1-1.4). Display flow: a parent creates a pairing code on the home page, then enters it at `/display` on the shared device. See `docs/authorization.md` for the access design.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in values; never commit .env.local
npm run dev                  # http://localhost:3000
npm test                     # access-control tests (no Supabase account needed)
npm run typecheck
npm run build
```

Without Supabase values the home page shows an "not configured" message and still runs.

## Set up Supabase (needs your account)

1. Create a project at https://supabase.com.
2. In Project Settings > API, copy the project URL, the anon key, and the service role key into `.env.local`.
3. Apply the SQL in `supabase/migrations/` in order: paste each file into the SQL editor, or link the project and run `supabase db push`.
4. In Authentication, enable email sign-in and disable public sign-ups if only invited parents should join.

## Local Supabase stack (no account needed)

Requires Docker. The CLI is a dev dependency. Ports are 55321-55329 to avoid common conflicts.

```bash
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,storage-api,postgres-meta
# copy API_URL, the publishable key, and the secret key from the output into .env.local:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
#   SUPABASE_SERVICE_ROLE_KEY=<secret key>
npm run test:local          # PGlite tests + real-stack integration tests
npx supabase db reset       # reapply migrations to a clean database
npx supabase stop
```

Public sign-up is disabled, so create a parent with the admin API or the dashboard, e.g. `POST /auth/v1/admin/users` with the secret key.

## Deploy to Vercel (needs your account)

1. Import the repository at https://vercel.com/new.
2. Set Root Directory to `app`.
3. Add the three environment variables from `.env.example`. Mark `SUPABASE_SERVICE_ROLE_KEY` as server-only; never prefix it with `NEXT_PUBLIC_`.
4. Deploy. Use a separate Supabase project for staging and production.

## Layout

- `src/app/` - pages and global responsive styles
- `src/lib/supabase/` - browser, server, and service-role clients
- `supabase/migrations/` - versioned database migrations
- `test/` - access-control tests
