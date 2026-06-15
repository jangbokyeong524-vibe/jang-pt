# STATUS

updated: 2026-06-15
mode: codex-resume-index
phase: mobile-horizontal-overflow-fixed

## Rules

- Keep this file short. Target 80 lines or fewer.
- Do not accumulate completed work history here.
- Overwrite stale state at the end of each meaningful work session.
- Use Git commits for completed history.
- Commit completed and verified implementation/doc work unless a blocker or user hold exists.
- Treat `SPEC.md` and routed docs as the source of truth. This file is only a pointer.

## Start Here

1. Confirm `AGENTS.md` guidance is loaded. If not, read it first.
2. Read `STATUS.md`.
3. Read only the routed doc for the current task.

## Current State

- Local demo UI exists and runs from `lib/seed-data.ts`.
- `./Start.sh` starts the local Next.js dev server and installs dependencies with `npm ci` when needed.
- Supabase schema/docs are target design only.
- Kakao/Google Auth, RLS, and DB transactions are not wired to the UI.
- Mobile-first design is part of the baseline.
- Apple iOS operations UI has been applied to the local demo screen.
- Admin/member screens now use bottom tabs in the local demo UI.
- Admin home prioritizes processing tasks in a compact queue, with an aligned seven-day weekly summary below.
- Admin and member schedule views use a seven-day column layout so one week is visible at once.
- The app shell suppresses page-level horizontal overflow; bottom tabs are the only intentional horizontal drag surface on narrow mobile widths.
- Admin home weekly summary fits seven days into the first mobile viewport without its own horizontal scroll.
- The top admin/member switch remains only as a development/demo review convenience until Supabase Auth role routing replaces it.
- UI direction and implementation plan live in `DESIGN.md`, `docs/superpowers/specs/2026-06-15-apple-ios-operations-ui-design.md`, and `docs/superpowers/plans/2026-06-15-apple-ios-operations-ui.md`.
- Git repository is initialized.
- Git is installed at `C:\Program Files\Git\cmd\git.exe`, but current PowerShell PATH may not include it.

## Next Actions

1. Start Supabase Auth callback design.
2. Replace the demo admin/member switch with account role routing.
3. Wire Supabase client/auth state into the UI.
4. Design reservation request/cancel RPC or server actions.

## Blockers

- Supabase project is not connected.
- Git may require explicit path until PATH is refreshed.

## Last Verified

- 2026-06-15: Week bottom tabs implementation verified with `npm run build` and production `next start -p 3002` HTTP checks.
- 2026-06-15: Mobile horizontal overflow fix verified with `git diff --check`, `npm run build`, dev HTTP check, and Playwright screenshots at 320px, 390px, and 1280px.
- 2026-06-15: Admin home compact queue and aligned weekly summary fix verified with `npm run build` and production `next start -p 3002` HTTP checks.
- 2026-06-15: `npm run build` passed.
- 2026-06-15: Apple UI pass verified with production `next start -p 3002` Playwright mobile/desktop screenshots and admin-to-member interaction check.
- 2026-06-15: `timeout 8s ./Start.sh` reached Next.js `Ready` before timeout.

## Read If Task Matches

- Product/policy: `SPEC.md`
- UI/mobile/layout: `docs/design.md`
- Setup/env/deploy: `SETUP.md`
- Auth/RLS/security/payment state: `docs/SECURITY.md`
- DB/SQL/events/status values: `docs/DATA_MODEL.md`
- QA/tests: `docs/TEST_PLAN.md`
- Operations/copy text: `docs/OPERATIONS.md`
