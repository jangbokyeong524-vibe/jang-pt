# STATUS

updated: 2026-06-22
mode: codex-resume-index
phase: admin-minimal-header

## Rules

- Keep this file short. Target 80 lines or fewer.
- Overwrite stale state at the end of each meaningful work session.
- Treat `SPEC.md` and routed docs as the source of truth. This file is only a pointer.
- Commit completed and verified implementation/doc work unless a blocker or user hold exists.

## Start Here

1. Confirm `AGENTS.md` guidance is loaded.
2. Read `STATUS.md`.
3. Read only the routed doc for the current task.

## Current State

- Product scope remains a PT member booking MVP, not a full gym management app.
- Local demo UI still uses `lib/seed-data.ts` for most operational data.
- Supabase Auth/RLS and reservation/member-link RPC boundaries are partially wired, with local fallback behavior when Supabase env is missing.
- Admin/member screens use bottom tabs.
- Admin tabs are `홈 / 일정 / 회원 / 설정`.
- Admin topbar is a one-line minimal header with `강동무에타이장`, an `관리자` pill, member switching, and an account menu.
- Admin topbar hides the login email until the account menu is opened; demo mode shows `데모 관리자` in that menu.
- Admin status-line is conditional and suppresses initial login/account status messages.
- Admin `일정` is a unified compact schedule screen with `월 / 주` view selection and `전체 / PT / 오전반 / 초등부 / 일반부` schedule type.
- `전체` and `PT` currently show the existing PT slot/reservation flow. `오전반`, `초등부`, and `일반부` currently show only the empty class-schedule state.
- Admin schedule rows emphasize `time range / status / action`, with the week strip directly above the selected-day time list in week mode.
- Member tabs are `홈 / 예약 / 내역`.
- Member mode owns its own compact header: member name, visible approval state, and a member menu.
- Member mode no longer renders the root admin topbar/status-line or the old full-width member selector toolbar.
- Approved member mode does not show the login email or global login/status message inside the member surface.
- Member compact header is tuned as a low utility bar with no negative horizontal bleed, no member-mode top shell padding, no header safe-area top padding, and enough line-height for name/email descenders.
- Member-facing titles use a sanitized display name: approved link display name first, otherwise a non-email member name, otherwise `회원`.
- Member `예약` keeps the PT reservation action flow, starts with the calendar section, and keeps the booking summary as a compact three-column row.
- Static layout contracts cover the admin minimal topbar/account menu/status-line, member compact header, member-mode top whitespace, admin-only root header, two-select admin schedule toolbar, compact schedule rows, month/week boundary, and PT-only data boundary.

## Next Actions

1. Manually verify the live Supabase member-link flow with a non-admin Google account and an admin account.
2. Manually inspect mobile member `예약` to confirm the compact header/menu and calendar position feel right on device.
3. Design and wire MVP-required payment status RPC, including `pt_passes`, `payments`, and `payment_events` history.
4. Design and wire MVP-required extension approval/rejection RPC, including `extension_requests`, PT권 만료일, and `pass_events.extension_request_id` history.
5. Connect Kakao login UI if Kakao member login remains required for MVP.

## Blockers / Notes

- Rendered browser/device verification is still manual for this slice; static contracts and build cover structure, not visual feel.

## Last Verified

- 2026-06-23: Admin minimal header/account-menu implementation verified RED/GREEN with `npm run check:layout`; final verification ran `npm run check:layout`, `npm run build`, and `git diff --check`.
- 2026-06-22: Admin compact topbar/status-line verified RED/GREEN with `npm run check:layout`; final verification ran `npm run check:layout`, `npm run build`, and `git diff --check`.
- 2026-06-22: Member compact header breathing-room and email descender fix verified RED/GREEN with `npm run check:layout`; final verification ran `npm run check:layout`, `npm run build`, and `git diff --check`.
- 2026-06-22: Single-line member header height verified RED with `npm run check:layout`; GREEN verified with `npm run check:layout`, `npm run build`, and `git diff --check`.
- 2026-06-22: Approved member email/message cleanup verified RED with `npm run check:layout`; GREEN verified with `npm run check:layout`, `npm run build`, and `git diff --check`.
- 2026-06-22: Member header name-only cleanup verified RED with `npm run check:layout`; GREEN verified with `npm run check:layout`, `npm run build`, and `git diff --check`.
- 2026-06-22: Member compact header slice verified RED with `npm run check:layout`; GREEN verified with `npm run check:layout`, `npm run build`, and `git diff --check`.
