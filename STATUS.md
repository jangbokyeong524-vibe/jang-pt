# STATUS

updated: 2026-06-15
mode: codex-resume-index
phase: settings-menu-depth

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
- Admin tabs are `홈 / 주간 / 회원 / 설정`; the old `CRM` tab and copy summary view are removed.
- Admin bottom tabs use an even 4-column grid so icon/label alignment fits the current 4-tab IA.
- Admin `설정` now opens to a menu list: `PT 상품`, `운영 정책`, `안내 문구`, `CSV 내보내기`.
- `운영 정책` has a second menu layer for `예약`, `취소`, `연장`, `재등록`.
- CSV export still downloads one `gangdong-pt-export-YYYY-MM-DD.csv` file in `exported_at,dataset,record_id,field,value` long-row format.
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

- 2026-06-15: Settings menu depth and 4-tab alignment verified with `npm run check:layout`, `git diff --check`, `npm run build`, and Playwright rendered checks at 320px, 390px, and 1280px against `http://127.0.0.1:3003/`.
- 2026-06-15: Browser checks verified settings root-only menu, policy submenu depth, back navigation, CSV disabled/enabled state, filename/header, and 개인정보 off/on phone behavior.
