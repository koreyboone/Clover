# Tasks

## 1. Cloud Platform and Proof of Concept

- [x] 1.1 Document the device constraints (iPad Mini 5 as an always-client display, iPhone 14, Galaxy S26 Ultra) and confirm the web app approach in the design; verify the design records the host decision.
- [x] 1.2 Scaffold the web app, versioned database migrations, and local development setup; verify the app builds and runs locally and a migration applies to a fresh database.
- [x] 1.3 Implement parent sign-in, household creation, and row-level access limited to household members; verify tests show a user cannot read or change another household's data and that service credentials never reach the browser bundle.
- [x] 1.4 Implement the restricted display session that a parent can create and revoke; verify tests show the display session can perform child actions but is denied parent functions, including requests sent directly.
- [ ] 1.5 Build the proof of concept: edit one sample routine from a phone and see it on the iPad; record a child task action and let a parent approve, reject, or record assistance; verify the flow on the iPad, iPhone, and Galaxy, including restart persistence and recovery after a temporary network disconnection.
- [ ] 1.6 Implement idempotency keys for actions; verify tests show a repeated or concurrent submission is applied once.
- [ ] 1.7 Implement the stale read-only display state with last-synchronized time, disabled actions while disconnected, and refresh on reconnect, with realtime updates and a polling fallback; verify on the iPad by toggling connectivity.
- [ ] 1.8 Document setup, deployment, signing in devices, and the display session; verify the documented steps from a clean checkout.

## 2. Household Routine Experience

- [ ] 2.1 Implement scheduled routine runs with fixed task and bonus-rule snapshots, completion state, help requests, rejected verification, and skip-day handling; verify tests cover schedule creation, that mid-run edits affect only the next run, and that rejected tasks return to incomplete.
- [ ] 2.2 Implement parent phone controls for tasks, schedules, per-task verification, per-child hide/shorten settings, and exceptions; verify tests confirm one child's settings do not alter another's.
- [ ] 2.3 Implement the shared-display child routine view with text for ages 9 and 10 and icons, optional audio, and at most one parent-assisted task for age 5; verify the views expose the next task and the older children can complete a routine without parent operation.
- [ ] 2.4 Implement child task completion, immediate feedback, one-tap parent verification, and need-help completion; verify tests show awaiting-verification tasks do not count as complete and assistance counts only once recorded.
- [ ] 2.5 Implement the scheduled routine cue without overdue labels, countdowns, red warning indicators, streaks, or sibling comparisons; verify UI tests confirm the cue and forbidden indicators are absent.
- [ ] 2.6 Document parent routine setup and exception handling; verify a representative parent can administer a normal routine day in two minutes or less, excluding genuine exceptions.

## 3. Family Rewards

- [ ] 3.1 Implement the point ledger as transactional database functions with immutable entries and idempotency keys; verify tests cover atomic commits, retries, and concurrent requests that cannot award, charge, or release points twice.
- [ ] 3.2 Implement configurable bonuses with the fixed full/partial/none decision sequence and integer limit validation at save and run creation; verify tests cover 0 <= L < N, invalid limits, zero-task routines, full, partial, none, assisted and unverified tasks, skipped runs, no deductions, and duplicate-run protection.
- [ ] 3.3 Implement optional contributions with fixed parent-set values, per-child availability, parent confirmation, and duplicate-award protection; verify tests confirm only confirmed contributions award points once.
- [ ] 3.4 Implement balances, reward catalog and progress, and instant redemption; verify tests cover immediate visible deductions, insufficient balances, and repeated attempts.
- [ ] 3.5 Implement needs-approval redemption with point reservation, approve, and decline, showing the child why points are temporarily unavailable; verify tests cover reservation blocking double spending, approval finalizing the deduction, decline releasing without deduction, idempotent retries, and pending requests persisting across restart.
- [ ] 3.6 Implement parent phone management of reward entries, types, costs, contributions, and point values; verify tests confirm saved changes apply to the intended child without altering other balances, and document reward administration.

## 4. Data Ownership, Pilot Measurement, and Readiness

- [ ] 4.1 Implement versioned household export, validated restore in one transaction that keeps prior data on failure, and confirmed deletion with a statement about provider-held copies; verify tests cover valid, damaged, unsupported, and mid-restore failures, and that the display and child functions cannot delete data.
- [ ] 4.2 Confirm no language-model calls or third-party analytics are included; verify by reviewing dependencies and configuration.
- [ ] 4.3 Implement the daily pilot log with separate one-tap direct reminder and board cue counts, completion, conflict, and administration time, included in export and deletion; verify tests cover recording, separation of the two prompt types, and export inclusion.
- [ ] 4.4 Implement the weekly pilot review by child without rankings or automatic routine adjustments; verify it shows all measures by week.
- [ ] 4.5 Prepare the Phase 1 household configuration for ages 10, 9, and 5, with the pilot routine selected from the week-0 reminder tally; verify the configuration excludes the three-year-old and uses per-task verification appropriate to the participants.
- [ ] 4.6 Write the pilot operating guide with the same direct reminder and board cue definitions across week 0, weeks 1-2, and weeks 3-4, plus the completion check, arguments, administration time, success criteria, and a numeric target deferred until baseline data exists; verify each element is covered.
- [ ] 4.7 Run end-to-end tests across the display and both phones; verify routine completion, parent verification, bonus awards, reward redemption and approval, and recovery after a temporary disconnection.
- [ ] 4.8 Verify the complete pilot flow on the iPad, iPhone, and Galaxy, including export and restore; document remaining platform limitations.
- [ ] 4.9 Add rate limiting to pairing-code redemption before any public exposure; verify repeated failed attempts are throttled and valid codes still work once, expire, and cannot be reused.
- [ ] 4.10 Review every child-action database function added in groups 2 and 3; verify each enforces display identity, household scope, and current revocation status (`is_household_display`), with tests showing a revoked display's unexpired token is denied.
