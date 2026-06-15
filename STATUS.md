# STATUS

updated: 2026-06-15
mode: codex-resume-index
phase: apple-ios-ui-design-ready

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
- Apple iOS operations UI direction is documented in `DESIGN.md` and `docs/superpowers/specs/2026-06-15-apple-ios-operations-ui-design.md`.
- Git repository is initialized.
- Git is installed at `C:\Program Files\Git\cmd\git.exe`, but current PowerShell PATH may not include it.

## Next Actions

1. Create implementation plan for the Apple iOS operations UI pass.
2. Apply the CSS-first UI redesign to the local demo screen.
3. Verify mobile and desktop visual behavior, then continue Supabase/Auth work.

## Blockers

- Supabase project is not connected.
- Git may require explicit path until PATH is refreshed.

## Last Verified

- 2026-06-15: `npm run build` passed.
- 2026-06-15: `timeout 8s ./Start.sh` reached Next.js `Ready` before timeout.

## Read If Task Matches

- Product/policy: `SPEC.md`
- UI/mobile/layout: `docs/design.md`
- Setup/env/deploy: `SETUP.md`
- Auth/RLS/security/payment state: `docs/SECURITY.md`
- DB/SQL/events/status values: `docs/DATA_MODEL.md`
- QA/tests: `docs/TEST_PLAN.md`
- Operations/copy text: `docs/OPERATIONS.md`
