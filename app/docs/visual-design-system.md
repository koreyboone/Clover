# Clover visual design system

Task 1.9 establishes the visual foundation for the existing parent controls and the representative shared display. The display uses a garden-path metaphor to make the next routine step obvious without adding a mascot, streak, countdown, or decorative motion. Parent controls stay information-dense and practical while sharing the same color, type, status, and notice language.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#173C32` | Primary text and display titles |
| `--muted` | `#52685E` | Supporting text and sync time |
| `--canvas` | `#F2F7F4` | Cool green-tinted page background |
| `--surface` | `#FFFFFF` | Inputs, parent task rows, and controls |
| `--leaf` | `#246846` | Primary actions and completed markers |
| `--leaf-wash` | `#E1F2E8` | Completed status and quiet supporting surfaces |
| `--sky-wash` | `#E8F3FD` | Offline and empty-state surfaces |
| `--sun` | `#F6C94C` | Current-task marker |
| `--sun-wash` | `#FFF4CE` | Current-task emphasis |
| `--line` | `#C8D9CF` | Dividers and task-path connector |
| `--focus` | `#1769AA` | Keyboard focus outline |
| `--error-ink` / `--error-wash` | `#742F2A` / `#FDE9E7` | Clear validation and action errors |

Spacing tokens run from `--space-1` (`0.5rem`) through `--space-5` (`2rem`). Shared corners use `--radius-small` (`0.75rem`) for controls and `--radius-large` (`1.25rem`) for larger surfaces; action buttons use a pill shape. The legacy `--bg`, `--fg`, and `--accent` aliases remain available while existing screens adopt the shared tokens.

## Typography and alignment

Use the system stack (`system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, sans-serif). There are no downloaded font dependencies, so the display remains self-contained on the home network. Body copy starts at `1rem`; supporting labels use about `0.9rem`; task names range from `1.15rem` to `1.45rem`; the child-facing prompt scales from `2rem` to `3.1rem`. Headings use a compact line height and restrained negative tracking. Keep reading order left-aligned; do not center task instructions or justify prose.

## Layout and components

The display puts household identity and connection state first, then a short routine cue and the ordered task path. Only the next incomplete task receives the sunflower surface and high-contrast outline. Completed steps use a check and explicit text; a task awaiting review keeps its status text; later tasks remain quiet. The action stays beside the task on wider screens and moves below its label on narrow screens.

```text
Household + connection state
Last synced

A little at a time.
Do the highlighted step, then show a grown-up.

  (1)  Current task                  [I did it]
  (✓)  Finished task                 Done
  (3)  Later task                    To do
```

Reusable primitives live in `src/components/ui.tsx`:

| Component | Purpose and states |
| --- | --- |
| `TaskStatusBadge` | Shared plain-language status labels and `data-status` styling for parent and display task rows |
| `StatusMessage` | Shared status/alert message roles with neutral, offline, success, and error tones |

The representative display adds a connected/reconnecting indicator, an inline four-leaf Clover mark, numbered sequence markers, and a check mark. SVGs are local and decorative; status text and button accessible names carry the meaning. The empty state tells a child a grown-up will add steps. The disconnected display keeps its cached routine read-only and explains that reconnecting is required before marking a task done.

## Responsive behavior

| Browser-emulated target | CSS viewport | DPR used | Layout rule |
| --- | ---: | ---: | --- |
| iPhone 14 portrait | 390 x 844 | 3 | Stacked task text and action; safe-area padding |
| iPad Mini 5 portrait | 768 x 1024 | 1 | Wide task row with action at the right |
| iPad Mini 5 landscape | 1024 x 768 | 1 | Same wide row with constrained content width |
| Galaxy S26 Ultra approximation | 412 x 915 | 1 | Custom browser viewport; not a device profile |

Below 700 CSS pixels, the action moves below its task label. At 700 pixels and above, the task path places the action in a third column. The content width is capped at `58rem`, and page padding includes safe-area insets. These are browser viewport checks only, not physical-device results.

## Accessibility and review checklist

- Keep normal text contrast at or above 4.5:1 and large text at or above 3:1. Check non-text indicators that communicate state or focus against adjacent colors.
- Keep every action keyboard-operable, give repeated actions a task-specific accessible name, maintain DOM order, and retain a clearly visible focus outline.
- Use an ordered list for routine steps, expose the current step with `aria-current="step"`, and keep completion and approval state in text as well as color or icon.
- Preserve readable offline, reconnecting, empty, pairing-error, revoked, and action-error states. Never enable a child action while disconnected.
- At each target viewport, check `scrollWidth` against `clientWidth`, inspect the full screen for clipping, and verify task controls remain reachable.
- Keep the interface usable without external fonts, icon services, or motion. Respect reduced-motion preferences.
- Confirm parent and display actions still use their existing authenticated server routes; visual controls do not replace authorization.
- Review a screenshot at phone, tablet portrait, and tablet landscape sizes before merging. Keep emulated viewport results separate from the physical-device checks in Task 4.8.

## Baseline screenshot index

All captures are in `%TEMP%\clover-baseline\task-1.9\before` and are not committed. The parent account is synthetic; its email is replaced with `[test parent]`. The Next.js development toolbar was hidden in captures. Routes were reached through the local app and the synthetic local Supabase household only.

| File | Route and state | CSS viewport / DPR | Reachability and notes |
| --- | --- | --- | --- |
| `login-iphone14-390x844.png` | `/login`, sign-in form | 390 x 844 / 3 | Reachable; no browser console errors |
| `parent-empty-household-iphone14-390x844.png` | `/`, parent with no household | 390 x 844 / 3 | Reachable with a separate synthetic parent |
| `parent-routine-iphone14-390x844.png` | `/`, sample routine and display management | 390 x 844 / 3 | Reachable; parent email redacted |
| `display-pairing-ipad-820x1180.png` | `/display`, unpaired display | 820 x 1180 / 2 | Reachable with the iPad browser preset |
| `display-invalid-pairing-iphone14.png` | `/display?error=invalid`, rejected pairing code | 390 x 844 / 3 | Reachable; expected validation message |
| `display-no-routine-ipad-820x1180.png` | `/display`, paired display without tasks | 820 x 1180 / 2 | Reachable using a second synthetic household |
| `display-routine-ipad-820x1180.png` | `/display`, sample routine | 820 x 1180 / 2 | Reachable; pre-redesign paired state |
| `display-awaiting-parent-412x915.png` | `/display`, first child completion attempt | 412 x 915 / 1 | Reachable; first attempt showed the generic action error because the form lacked its required idempotency key |
| `display-awaiting-parent-fixed-pre-redesign.png` | `/display`, task waiting for parent review | 412 x 915 / 1 | Reachable after adding a fresh idempotency key; successful retry verified |
| `display-routine-offline-412x915.png` | `/display`, saved routine while offline | 412 x 915 / 1 | Reachable; actions disabled |
| `display-routine-reconnected-412x915.png` | `/display`, routine after reconnect | 412 x 915 / 1 | Reachable; server state refreshed |
| `display-revoked-iphone-412x915.png` | `/display`, session after parent revokes display | 412 x 915 / 1 | Reachable; display returned to pairing form |

No scheduled routine editor, child profiles, rewards, point history, or pilot log screen exists yet; these are later OpenSpec tasks and were not fabricated for the baseline.

## After screenshots and verification record

After captures are in `%TEMP%\clover-baseline\task-1.9\after`; they remain outside the repository.

| File | State | CSS viewport / DPR |
| --- | --- | --- |
| `display-routine-iphone14-390x844.png` | Routine with three incomplete steps | 390 x 844 / 3 |
| `display-routine-ipad-820x1180.png` | Routine with three incomplete steps, additional iPad preset | 820 x 1180 / 2 |
| `display-routine-ipad-portrait-768x1024.png` | Routine with three incomplete steps | 768 x 1024 / 1 |
| `display-routine-ipad-landscape-1024x768.png` | Routine with three incomplete steps | 1024 x 768 / 1 |
| `display-routine-galaxy-approx-412x915.png` | Routine with three incomplete steps | 412 x 915 / 1 |
| `display-awaiting-parent-iphone14-390x844.png` | Child action accepted and awaiting review | 390 x 844 / 3 |
| `display-routine-complete-iphone14-390x844.png` | Parent-approved routine completion | 390 x 844 / 3 |
| `display-offline-approx-412x915.png` | Saved read-only routine; all three actions disabled | 412 x 915 / 1 |
| `display-reconnected-approx-412x915.png` | Reconnected routine; actions enabled | 412 x 915 / 1 |
| `display-no-routine-ipad-768x1024.png` | Empty routine state, online | 768 x 1024 / 1 |
| `display-action-error-iphone14-390x844.png` | Failed task action with an announced error | 390 x 844 / 3 |
| `display-invalid-pairing-iphone14-390x844.png` | Invalid pairing-code error | 390 x 844 / 3 |
| `display-revoked-galaxy-approx-412x915.png` | Revoked display returned to pairing form | 412 x 915 / 1 |
| `parent-pending-review-iphone14-390x844.png` | Parent sees approval controls | 390 x 844 / 3 |

Browser-emulated checks found no horizontal overflow at the four supported CSS viewports. The display remained within the viewport height for the captured representative routine state. Nineteen visible text elements passed the computed contrast checks at each target viewport. The current-task border measured 4.97:1 against the page canvas and 4.89:1 against its sunflower surface; the focus outline measured 5.33:1 against the canvas and 5.25:1 against the sunflower surface; the white focus halo against the leaf action measured 6.68:1.

Tab focused the child actions in task order with task-specific accessible names ("Mark Make your bed as done", "Mark Brush your teeth as done", and "Mark Pack your bag as done"). The first action had a visible 3px focus outline; pressing Enter submitted it, the parent approved it, and the display updated to the finished state. Offline emulation retained the saved routine and disabled all three actions; returning online restored the actions and showed the current server state. The error-state capture exposed one `role="alert"` message. During stylesheet replacement, the development server briefly logged a missing-file compile error while `globals.css` was being re-added; it recovered and subsequently rendered the stable pages. A clean production build remains part of the completion gate. This does not claim screen-reader or physical-device validation.
