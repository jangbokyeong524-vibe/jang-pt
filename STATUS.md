# STATUS

updated: 2026-06-15
mode: codex-resume-index
phase: settings-csv-export

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

- Local demo UI exists and runs from `lib/seed-data.ts`.
- Supabase schema/docs are target design only; Auth, RLS, and DB transactions are not wired to the UI yet.
- Admin/member screens use bottom tabs in the local demo UI.
- Admin tabs are now `홈 / 주간 / 회원 / 설정`; the old `CRM` tab and copy summary view are removed.
- Admin `설정` includes CSV 내보내기 with dataset checkboxes and an opt-in `개인정보 포함` checkbox.
- CSV export downloads one `gangdong-pt-export-YYYY-MM-DD.csv` file in `exported_at,dataset,record_id,field,value` long-row format.
- With 개인정보 off, phone and normalized phone fields are excluded from member/member-link exports.
- The top admin/member switch remains only as a development/demo review convenience until Supabase Auth role routing replaces it.

## Next Actions

1. Start Supabase Auth callback design.
2. Replace the demo admin/member switch with account role routing.
3. Wire Supabase client/auth state into the UI.
4. Design reservation request/cancel RPC or server actions.

## Blockers

- Supabase project is not connected.

## Last Verified

- 2026-06-15: CSV export and 4-tab admin navigation verified with `npm run check:layout`, `git diff --check`, `npm run build`, and Playwright rendered checks at 320px, 390px, and 1280px against `http://127.0.0.1:3003/`.
- 2026-06-15: Browser CSV checks verified disabled/enabled download state, filename format, header, and 개인정보 off/on phone inclusion behavior.
