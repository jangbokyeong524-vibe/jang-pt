# STATUS

updated: 2026-06-15
mode: codex-resume-index
phase: pt-member-booking-mvp-docs

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

- Product scope is now documented as a PT member booking MVP, not a full gym management app.
- MVP includes member PT status, member reservation request/cancel, admin approval/rejection, session completion deduction, late-cancel deduction decisions, manual payment status, member linking, renewal prompts, and CSV export.
- MVP excludes group classes, general gym attendance, lockers, product sales, full accounting dashboards, automated Kakao sending, PG payments, BOX POS API integration, and VitaminCRM automation.
- Local demo UI exists and runs from `lib/seed-data.ts`.
- Supabase project is not connected, but reservation state changes now have a target RPC boundary in `docs/supabase-schema.sql`.
- Reservation request/approve/reject/cancel/late-cancel/complete operations are represented by `lib/reservation-actions.ts`.
- When Supabase env is missing, reservation actions keep using local demo state fallback behavior.
- When Supabase env exists, the reservation adapter calls `request_reservation`, `approve_reservation`, `reject_reservation`, `request_reservation_cancel`, `resolve_late_cancel`, and `complete_session`.
- Member direct `reservations insert/update` RLS policies are removed from the schema draft; members should use reservation RPCs.
- `npm run check:layout` now includes static Supabase reservation RPC contract checks.
- `docs/DATA_MODEL.md`, `docs/SECURITY.md`, and `docs/TEST_PLAN.md` describe the reservation RPC state transitions and verification criteria.
- Auth, role routing, DB refetch after RPC, payment status RPC, and extension approval RPC are still not wired.
- Admin/member screens use bottom tabs in the local demo UI.
- Admin tabs are `홈 / 주간 / 회원 / 설정`; the old `CRM` tab and copy summary view are removed.
- Admin bottom tabs use an even 4-column grid so icon/label alignment fits the current 4-tab IA.
- Admin `설정` now opens to a menu list: `PT 상품`, `운영 정책`, `안내 문구`, `CSV 내보내기`.
- `운영 정책` has a second menu layer for `예약`, `취소`, `연장`, `재등록`.
- CSV export still downloads one `gangdong-pt-export-YYYY-MM-DD.csv` file in `exported_at,dataset,record_id,field,value` long-row format.
- With 개인정보 off, phone and normalized phone fields are excluded from member/member-link exports.
- The top admin/member switch remains only as a development/demo review convenience until Supabase Auth role routing replaces it.

## Next Actions

1. Improve the visible member reservation MVP flow: member home status, booking selection, requested/confirmed/cancel_requested copy, and payment warnings.
2. Wire DB reads/refetch after reservation RPC calls.
3. Design payment status and extension approval RPCs.
4. Start Supabase Auth callback design and replace the demo admin/member switch with account role routing.
5. Apply `docs/supabase-schema.sql` to a real Supabase project and run manual RPC integration checks from `docs/TEST_PLAN.md` once project credentials exist.

## Blockers

- Supabase project is not connected.

## Last Verified

- 2026-06-15: PT member booking MVP docs updated and verified with `git diff --check`, `npm run check:layout`, and `npm run build`.
- 2026-06-15: Reservation RPC boundary verified with RED `npm run check:layout` failure before implementation, then `npm run check:layout`, `git diff --check`, and `npm run build`.
- 2026-06-15: Settings menu depth and 4-tab alignment verified with `npm run check:layout`, `git diff --check`, `npm run build`, and Playwright rendered checks at 320px, 390px, and 1280px against `http://127.0.0.1:3003/`.
- 2026-06-15: Browser checks verified settings root-only menu, policy submenu depth, back navigation, CSV disabled/enabled state, filename/header, and 개인정보 off/on phone behavior.
