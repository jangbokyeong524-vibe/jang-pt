# STATUS

updated: 2026-06-13
mode: codex-resume-index
phase: prototype-docs-baseline

## Rules

- Keep this file short. Target 80 lines or fewer.
- Do not accumulate completed work history here.
- Overwrite stale state at the end of each meaningful work session.
- Use Git commits for completed history once Git is available.
- Treat `SPEC.md` and routed docs as the source of truth. This file is only a pointer.

## Start Here

1. Confirm `AGENTS.md` guidance is loaded. If not, read it first.
2. Read `STATUS.md`.
3. Read only the routed doc for the current task.

## Current State

- Local demo UI exists and runs from `lib/seed-data.ts`.
- Supabase schema/docs are target design only.
- Kakao/Google Auth, RLS, and DB transactions are not wired to the UI.
- Mobile-first design is part of the baseline.
- Git repository is initialized.
- Git is installed at `C:\Program Files\Git\cmd\git.exe`, but current PowerShell PATH may not include it.

## Next Actions

1. Start Supabase Auth callback design.
2. Wire Supabase client/auth state into the UI.
3. Design reservation request/cancel RPC or server actions.

## Blockers

- Supabase project is not connected.
- Git may require explicit path until PATH is refreshed.

## Last Verified

- 2026-06-13: `npm.cmd run build` passed.

## Read If Task Matches

- Product/policy: `SPEC.md`
- UI/mobile/layout: `docs/design.md`
- Setup/env/deploy: `SETUP.md`
- Auth/RLS/security/payment state: `docs/SECURITY.md`
- DB/SQL/events/status values: `docs/DATA_MODEL.md`
- QA/tests: `docs/TEST_PLAN.md`
- Operations/copy text: `docs/OPERATIONS.md`
