# Design

## Context

The proof-of-concept implementation uses Next.js, React, TypeScript, and a single global stylesheet. Its small set of color tokens and shared styles serve both the parent interface and child display; the current presentation is sparse and form-driven, without a distinct child-centered visual system. Target devices are an iPad Mini 5 (shared display, not always plugged in), an iPhone 14, and a Galaxy S26 Ultra. iOS suspends background processes, so the iPad cannot reliably host a service; it is a client. See `proposal.md` and the `household-routines`, `family-rewards`, `household-data`, and `pilot-measurement` specs for behavior contracts.

The initial visual investigation found the local web app was not running, so no browser-rendered screenshots, viewport checks, or console observations were available. Task 1.9 must start the local app with isolated test data and capture an indexed before-baseline before making visual changes. It must report unreachable screens and states instead of fabricating them or bypassing authorization. Browser-emulated viewports are not physical-device verification.

## Goals / Non-Goals

**Goals:**
- One authoritative household state for runs, approvals, points, and rewards, reachable from all three devices.
- Database-enforced authorization and household isolation.
- Atomic, idempotent point accounting.

**Non-Goals:**
- Offline writes or offline-first operation.
- Multiple households per parent account, child accounts, or language-model features.
- Formal penetration testing in Phase 1.

## Visual Design Foundation

The child-facing shared display and parent interface are distinct interaction contexts that should share a coherent design system. The display should be playful, child-centered, and motivating for ages 5, 9, and 10; parent controls should remain practical and polished. Neither context may introduce shaming indicators or undermine the existing authorization, offline, or routine behavior.

Task 1.9 establishes and implements the visual foundation before broader interface work:

- Start the app locally using an isolated test household, audit the current implementation, and capture indexed before screenshots of safely reachable screens and states before changing their visual presentation. Keep screenshots outside the repository and record route, state, viewport, DPR, reachability, and console errors.
- Define and document the visual direction, design tokens, typography, colors, spacing, iconography, reusable components, and component states; implement the reusable visual foundations in the app.
- Implement one polished representative child-display screen using existing functionality, without pulling later routine, reward, or other feature work into this task.
- Document responsive rules for iPad Mini 5 portrait (768 × 1024) and landscape (1024 × 768), iPhone 14 portrait (390 × 844), and an explicitly approximate Galaxy S26 Ultra viewport (412 × 915).
- Validate the representative screen at the target browser viewports: no unintended horizontal overflow or clipped content; normal text contrast of at least 4.5:1, large text contrast of at least 3:1, and applicable non-text contrast; keyboard-operable controls with visible focus, logical focus order, and accessible names.
- Define and document a repeatable visual-review checklist that applies to later UI work.
- Record which screens are not implemented or could not be reached. Browser-emulated viewports are not physical-device verification.

The implemented tokens and reusable components are used by subsequent parent and child UI implementation tasks. UI tasks must check visual consistency and preserve functional behavior. Task 2.2 may proceed without waiting for the representative display to be complete, but must use the documented design tokens and reusable components once established. Task 2.3 depends on Task 1.9. Physical-device validation remains part of the later pilot readiness work.

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
