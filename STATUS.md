# STATUS

updated: 2026-06-19
mode: codex-resume-index
phase: integrated-schedule-shell

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
- Admin tabs are now `홈 / 일정 / 회원 / 설정`.
- Admin `일정` is a unified schedule shell with `월 / 주 / 일` view controls and `전체 / PT / 오전반 / 초등부 / 일반부` type filters.
- `전체` and `PT` currently show the existing PT slot/reservation flow and keep approval/rejection/completion/late-cancel actions.
- `오전반`, `초등부`, and `일반부` currently show only the empty class-schedule state. Group-class reservation, capacity, attendance, waitlist, and recurring timetable generation remain out of scope.
- Member `예약` keeps the current PT reservation UX. Docs note a later `PT / 수업` direction for member scheduling.
- Static layout contracts cover the schedule shell labels, filters, and PT-only data boundary for the current shell.

## Next Actions

1. Manually verify the live Supabase member-link flow with a non-admin Google account and an admin account.
2. Wire DB reads/refetch after reservation/payment/extension RPC calls.
3. Design and wire MVP-required payment status and extension approval RPCs, including payment/extension/pass event history.
4. Connect Kakao login UI if Kakao member login remains required for MVP.
5. Design the real class-program data model before adding 오전반/초등부/일반부 capacity, attendance, or member reservation actions.

## Blockers / Notes

- Rendered schedule-tab browser checks were not completed in this session because the active dev server loads Supabase auth from `.env.local`, so it does not expose the demo admin schedule without changing the server environment.

## Last Verified

- 2026-06-19: Integrated schedule shell contract verified RED with `npm run check:layout`; GREEN verified with `npm run check:layout`, `npm run build`, and `git diff --check`.
