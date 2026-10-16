# Proposal

## Why

Children currently depend on repeated parental reminders to start and finish household routines. Clover's Phase 1 pilot makes the next task visible, gives children age-appropriate ownership of completion, and uses predictable rules to test whether direct reminders can fall without increasing conflict.

## What Changes

- Add a scheduled, shared-display routine for the children participating in Phase 1, with text-first and picture-led task presentation, child-reported completion, configurable parent verification, and a need-help action.
- Let parents configure routine tasks and schedules, per-child support, skip days, and task verification from a phone. Changes to required tasks during an active routine take effect at its next scheduled run.
- Award mechanical full, partial, or no routine bonuses from a fixed decision sequence with a validated incomplete-task limit; unverified tasks do not count, assistance counts once recorded, skip days do not penalize, and points are never deducted except for reward redemption.
- Provide per-child point balances, parent-confirmed optional contributions, and a reward catalog with instant and needs-approval rewards, point reservation for approvals, and idempotent transitions.
- Store household data in a cloud-hosted web application and managed database shared by the display and parent devices, with parent-only accounts, no child accounts, database-enforced household isolation, parent-controlled export, restore, and deletion, and a read-only cached display when disconnected.
- Provide a pilot operating guide and a simple daily log for a consistent week-0 reminder baseline, weeks 1-2 of routine use, and weeks 3-4 of follow-up completion and reminder checks.
- Exclude the three-year-old, homework points, adaptive routines, streaks, leaderboards, sibling comparisons, and animated characters from Phase 1.

## Capabilities

### New Capabilities
- `household-routines`: Scheduled routines, child task views and completion, parent verification and assistance, skip days, and per-child support.
- `family-rewards`: Routine bonuses, optional contributions, balances, reward catalogs, and redemption.
- `household-data`: A single authoritative cloud store, parent-only accounts and a restricted display session, enforced household isolation, stale read-only display when disconnected, idempotent actions, no language-model or analytics use, and export, restore, and deletion.
- `pilot-measurement`: A daily tally of direct reminders, board cues, completion, conflicts, and administration time, using consistent definitions.

### Modified Capabilities

None.

## Impact

This is a greenfield product change; the repository currently has no application implementation or existing capability specs. It will require a responsive web application used on an iPad Mini 5 (shared display), an iPhone 14, and a Galaxy S26 Ultra, plus a managed cloud database with authentication. Children's data will be stored with the chosen hosting and database providers. No child accounts, language models, or third-party analytics are in scope.
