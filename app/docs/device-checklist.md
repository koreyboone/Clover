# On-device checklist for task 1.5

The household reported the results below on 2026-10-16. These results complete the task 1.5 physical-device gate. Checkmarks reflect reported outcomes; unreported checks remain unchecked.

## Reported physical-device results

| Device | Reported outcomes |
| --- | --- |
| Galaxy S26 Ultra | Sign-in; create routine and rename a task; create a display pairing code; Approve, Not done, and I helped |
| iPhone 14 | Sign-in; routine and task rename synchronize; changes reach the paired iPad |
| iPad Mini 5 | Pair; reload and close/reopen Safari; lock and wake; child task action; Wi-Fi off/on recovery; revocation returns to pairing |

## Setup (on the Windows PC, same Wi-Fi as the devices)

1. Start Docker Desktop, then in `app/`:
   ```powershell
   npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,storage-api,postgres-meta
   npm run build
   npx next start -H 0.0.0.0 -p 3100
   ```
   `.env.local` must hold the local Supabase values (see `README.md`). Supabase stays on the PC; devices only talk to the Next server.
2. Allow the port on your private network (run PowerShell as administrator; remove it afterwards):
   ```powershell
   New-NetFirewallRule -DisplayName "Clover dev 3100" -Direction Inbound -Protocol TCP -LocalPort 3100 -Profile Private -Action Allow
   # later: Remove-NetFirewallRule -DisplayName "Clover dev 3100"
   ```
3. Find the PC's address: `Get-NetIPAddress -AddressFamily IPv4 | Where-Object IPAddress -like '192.168.*'`. Below, `URL` means `http://<that address>:3100`.
4. Create one parent account (public sign-up is off). Use the local secret key from `.env.local`:
   ```powershell
   $k = "<SUPABASE_SERVICE_ROLE_KEY>"
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:55321/auth/v1/admin/users -Headers @{apikey=$k;Authorization="Bearer $k"} -ContentType 'application/json' -Body '{"email":"you@example.test","password":"choose-a-long-password","email_confirm":true}'
   ```

This is plain HTTP on your home network, used only to check the devices before a Vercel deployment. Do not expose it to the internet.

## 1. Galaxy S26 Ultra (parent)

- [x] Open `URL`; you land on the sign-in page. Sign in. Wrong password shows an error.
- [x] Create a household, then **Create sample routine**. Three tasks appear and nothing is cut off or sideways-scrolling.
- [x] Rename "Make your bed" to something else and **Save**.
- [x] **Create pairing code** for a display. Note the 8 characters.
- [x] Later: **Approve**, **Not done**, and **I helped** each work (see the shared flow below).
- [x] Close the browser fully and reopen `URL`: you are still signed in.

## 2. iPhone 14 (second parent client)

- [x] Open `URL` in Safari and sign in with the same parent account (a second parent account is not built yet).
- [x] The sample routine and your rename synchronize.
- [ ] Layout fits with no sideways scrolling.
- [x] Rename a task here, then confirm the display shows it.
- [ ] Sign out, then confirm opening `URL` returns to the sign-in page.

## 3. iPad Mini 5 (shared display)

- [x] Open `URL/display` in Safari. You see the pairing screen. Enter a wrong code: you get a clear "not valid" message.
- [x] Enter the real code. The household name and the three tasks appear.
- [x] Try the code again on another device or after pairing: it is refused (single use).
- [x] **Refresh:** pull to reload. It stays paired.
- [x] **Restart:** close Safari fully, lock and wake the iPad, reopen `URL/display`. It stays paired and shows current data.
- [x] Tap **I did it** on a task. It changes to "Waiting for a parent".
- [x] Open `URL` on the iPad display: it should send you back to `/display` (no parent page).
- [x] Layout is readable and buttons are easy to tap, in portrait and landscape.

## Shared flow (parent phone + iPad together)

- [x] On the iPad, tap **I did it**. On a phone, **Not done**: the iPad shows "To do" again within about 10 seconds.
- [x] Tap **I did it** again. On a phone, **Approve**: the iPad shows "Done".
- [x] On a phone, **I helped** on a third task without any child tap: the iPad shows "Done with help".
- [x] A task marked Done cannot be re-opened from the iPad.

## Revocation

- [x] On a phone, **Revoke** the iPad's display.
- [x] On the iPad, wait about 10 seconds or reload: it shows the pairing screen with a message that access was removed. Old tasks are gone from the screen after reload.
- [x] Pairing the iPad again needs a new code.

## Reconnect

Two different failures; record what you see for each.

- **Server loses its database (simulated):** on the PC run `docker stop supabase_kong_clover`. The iPad should show **Reconnecting…** (not the pairing screen). Then `docker start supabase_kong_clover`; the iPad should return to the task list by itself within a few seconds. (Verified on the PC with HTTP requests and in a desktop browser session.)
  - [ ] Reconnecting message shown, no pairing screen
  - [ ] Recovered by itself
- **Device loses Wi-Fi:** with the iPad on the task list, turn Wi-Fi off for 30 seconds, then on.
  - [ ] While off, the screen stays as it was, and no pairing screen appears.
  - [x] After Wi-Fi returns, the display recovers without re-pairing.
  - [ ] A tap on **I did it** while offline does not change anything on the server. (A clear offline state is task 1.7.)

## Task 1.7 display offline behavior (iPad Mini 5)

Run this against the updated app while the iPad is paired. These checks are required on-device before task 1.7 can be marked complete.

- [x] With the task list loaded, note the displayed **Last synced** time.
- [x] Turn Wi-Fi off. The last task list remains visible, the status changes to **Offline — showing saved data**, and the last-synced time remains unchanged.
- [x] While offline, **I did it** is disabled and tapping it does not submit a task action.
- [x] Turn Wi-Fi on. The display reconnects, refreshes its data, updates the synchronization time, and enables task actions without re-pairing.
- [x] From a parent phone, rename a task. The display receives the change live; if realtime is unavailable, it appears through the polling fallback.

## Notes to record

Task 1.5 results were reported by the household on 2026-10-16. Task 1.7 checks were reported passing on the iPad Mini 5 on 2026-10-17. The first offline attempt reached Safari's `ERR_INTERNET_DISCONNECTED` page; after the polling refresh was gated on a successful connection check, the household retried and reported all Task 1.7 checks passing. Device OS versions, exact timings, and visual details were not provided.

## What was already checked on the PC (not on devices)

Database and HTTP tests on a real local Supabase stack; a desktop Edge browser at 390, 412, and 768 pixel widths (no horizontal overflow); live display updates without reload; server and database restarts with sessions and data intact; a simulated database outage and recovery; the app reachable by LAN address. None of this replaces the checks above.
