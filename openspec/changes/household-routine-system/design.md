# Design

## Context

The repository has no application implementation. Target devices are an iPad Mini 5 (shared display, not always plugged in), an iPhone 14, and a Galaxy S26 Ultra. iOS suspends background processes, so the iPad cannot reliably host a service; it is a client. See `proposal.md` and the `household-routines`, `family-rewards`, `household-data`, and `pilot-measurement` specs for behavior contracts.

## Goals / Non-Goals

**Goals:**
- One authoritative household state for runs, approvals, points, and rewards, reachable from all three devices.
- Database-enforced authorization and household isolation.
- Atomic, idempotent point accounting.

**Non-Goals:**
- Offline writes or offline-first operation.
- Multiple households per parent account, child accounts, or language-model features.
- Formal penetration testing in Phase 1.

## Decisions

### Web app on Vercel with managed Postgres and auth on Supabase

Build one responsive web app used on all three devices, deployed to Vercel, with Supabase for PostgreSQL and parent authentication. This removes the need to host a service on the iPad and works from any network. Netlify and a different database are viable alternatives; the specs stay provider-neutral so either can be swapped. Native apps were rejected because one web codebase serves both phone platforms.

### Enforce authorization in the database and server

Use row-level security keyed to household membership, and server-side checks for parent functions. Service-role credentials stay on the server and are never sent to browsers. The UI hides parent controls, but hiding is never the control.

### The display is a restricted device session, not a parent session

Children have no accounts. A parent signs the iPad in once to create a display session limited to child-facing actions: viewing the routine, marking tasks complete, requesting help, reporting contributions, and requesting rewards. Parent functions need a parent account session on a phone. The display session can be revoked by a parent.

### Read-only cached display when disconnected

The display keeps its last loaded data in memory or local storage, shows the last synchronization time, and disables mutations while offline. On reconnection it refetches from the database. Cached data is never treated as authoritative, and no offline writes are queued, which avoids conflicts.

### Realtime refresh with polling fallback

Parent changes reach the display through database realtime updates, with periodic polling as a fallback so a missed event cannot leave the display stale.

### Separate routine definitions from active runs

Store parent-authored routines separately from dated runs. At run creation, snapshot the required tasks and bonus rules so edits during a run cannot change it. Store completion, help requests, verification, and skip status against the run.

### Record point changes as explicit ledger entries

Represent bonuses, contribution awards, reservations, finalizations, releases, and redemptions as immutable ledger entries for each child. A needs-approval request writes a reservation entry that reduces the available balance; approval finalizes it and decline releases it with no deduction. Each transition runs in one database transaction with a unique idempotency key tied to its run, contribution, or request, so retries and concurrent requests cannot award, charge, or release points twice. Implement these as database functions so the rules live next to the data.

### Validate bonus thresholds at save and run creation

A routine's partial-bonus limit L must satisfy 0 <= L < N for N required tasks, checked when saved and again when a run is created. The bonus is full when none are incomplete, partial when the incomplete count is at most L, otherwise none; a zero-task routine awards nothing. Tasks awaiting verification count as incomplete.

### Export, validated restore, and deletion

Export household data in a documented, versioned format. Restore validates the whole file and version before replacing data inside one transaction, so a failure leaves the prior data in place. Deletion requires parent confirmation and the product states how provider-held backups are handled.

## Risks / Trade-offs

- [Children's data is stored with third-party providers] -> Collect only what is needed, enforce row-level security, keep secrets server-side, offer export and deletion, and use no analytics or language models.
- [The service is unavailable without internet] -> The display shows a stale read-only view; no write support offline is a deliberate Phase 1 trade-off.
- [Realtime events can be missed] -> Poll as a fallback and refetch on reconnect.
- [A rules bug could double-award points] -> Keep accounting in transactional database functions with idempotency keys and tests for retries and concurrency.
- [A parent session left on the iPad could expose parent functions] -> Use a separate restricted display session and require parent sign-in on phones.
- [Provider pricing or terms change] -> Keep specs provider-neutral and export available.

## Migration Plan

Greenfield, so no data migration. Manage the schema with versioned migrations applied to a staging project before production, and keep the export format versioned. If a deployment fails, roll back the Vercel deployment; roll forward schema fixes with a new migration rather than editing applied ones.
