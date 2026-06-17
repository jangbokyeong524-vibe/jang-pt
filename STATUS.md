# STATUS

updated: 2026-06-17
mode: codex-resume-index
phase: member-link-approval-flow

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
- Local demo UI still uses `lib/seed-data.ts` for most operational data.
- Supabase project is connected, Google/Kakao providers are enabled, and reservation RPCs are visible through PostgREST.
- Google Identity Services login, admin email allowlist bootstrap, and pending member link request creation are wired.
- Member link approval is wired through `lib/member-link-actions.ts`.
- Members now request linking with name and phone; pending/approved requests hide duplicate request entry and rejected requests can be retried.
- Admin member screen reads Supabase members/link requests, shows pending requests, and can approve to an existing phone match, create a new active member then approve, or reject.
- New member approval creates only the `members` row; PT passes remain manually registered from member detail.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is required for the Google button; local `.env.local` is configured.
- Admin allowlist lives in `lib/auth-config.ts`; bootstrap writes `admin_users` through server-only `lib/supabase-server.ts`.
- Reservation request/approve/reject/cancel/late-cancel/complete operations are represented by `lib/reservation-actions.ts`.
- When Supabase env is missing, reservation actions keep using local demo state fallback behavior.
- When Supabase env exists, the reservation adapter calls `request_reservation`, `approve_reservation`, `reject_reservation`, `request_reservation_cancel`, `resolve_late_cancel`, and `complete_session`.
- Member direct `reservations insert/update` RLS policies are removed from the schema draft; members should use reservation RPCs.
- `npm run check:layout` now includes static Supabase reservation RPC contract checks.
- `docs/DATA_MODEL.md`, `docs/SECURITY.md`, and `docs/TEST_PLAN.md` describe the reservation RPC state transitions and verification criteria.
- Full operational DB reads/refetch after reservation RPC, payment status RPC, extension approval RPC, and Kakao login UI are still not wired.
- Local demo review and operating MVP completion are now treated as separate gates in `docs/TEST_PLAN.md`.
- Member extension requests and admin extension approval are MVP-required scope, not post-MVP expansion.
- README, SECURITY, DATA_MODEL, TEST_PLAN, OPERATIONS, and schema draft now align on payment/extension server-boundary requirements.
- `docs/supabase-schema.sql` now includes `pass_events.extension_request_id` and a unique `extension_added`-per-request index for the target extension approval design.
- Admin/member screens use bottom tabs in the local demo UI.
- Admin tabs are `홈 / 주간 / 회원 / 설정`; the old `CRM` tab and copy summary view are removed.
- Admin `주간` and member `예약` detail screens now use a monthly date calendar followed by selected-day time cards.
- Admin bottom tabs use an even 4-column grid so icon/label alignment fits the current 4-tab IA.
- Admin `설정` now opens to a menu list: `PT 상품`, `운영 정책`, `안내 문구`, `CSV 내보내기`.
- `운영 정책` has a second menu layer for `예약`, `취소`, `연장`, `재등록`.
- CSV export still downloads one `gangdong-pt-export-YYYY-MM-DD.csv` file in `exported_at,dataset,record_id,field,value` long-row format.
- With 개인정보 off, phone and normalized phone fields are excluded from member/member-link exports.
- The top admin/member switch remains only in no-env demo mode; authenticated users are routed by Supabase role state.

## Next Actions

1. Manually verify the live Supabase member-link flow with a non-admin Google account and an admin account.
2. Wire DB reads/refetch after reservation/payment/extension RPC calls.
3. Design and wire MVP-required payment status and extension approval RPCs, including payment/extension/pass event history.
4. Connect Kakao login UI if Kakao member login remains required for MVP.
5. Improve member reservation MVP flow once live member/pass/slot reads replace demo state.

## Blockers

- None for Auth routing. Live browser OAuth still requires a real Google login session.

## Last Verified

- 2026-06-17: Member link approval static contract verified RED with `npm run check:layout` failing on missing `lib/member-link-actions.ts`; GREEN verified with `npm run check:layout`, `npm run build`, and `git diff --check`.
- 2026-06-17: Monthly calendar to selected-day time-card schedule UX verified with `npm run check:layout`, `npm run build`, and `git diff --check`.
- 2026-06-16: Google Identity Services + Supabase `signInWithIdToken` contract verified with `npm run check:layout` and `npm run build`.
- 2026-06-16: Supabase Auth role routing verified with `npm run check:layout`, `npm run build`, and HTTP smoke checks for `/`, `/auth/callback`, and `/api/auth/bootstrap-admin`.
- 2026-06-16: `codex/week-layer-cleanup` merged into `main` and verified with `npm run build` before push to `origin/main`.
- 2026-06-15: Payment/extension MVP criteria alignment verified with consistency search, `git diff --check`, `npm run check:layout`, and `npm run build`.
- 2026-06-15: PT MVP docs review fix verified with consistency search, `git diff --check`, `npm run check:layout`, and `npm run build`.
- 2026-06-15: PT member booking MVP docs updated and verified with `git diff --check`, `npm run check:layout`, and `npm run build`.
- 2026-06-15: Reservation RPC boundary verified with RED `npm run check:layout` failure before implementation, then `npm run check:layout`, `git diff --check`, and `npm run build`.
- 2026-06-15: Settings menu depth and 4-tab alignment verified with `npm run check:layout`, `git diff --check`, `npm run build`, and Playwright rendered checks at 320px, 390px, and 1280px against `http://127.0.0.1:3003/`.
- 2026-06-15: Browser checks verified settings root-only menu, policy submenu depth, back navigation, CSV disabled/enabled state, filename/header, and 개인정보 off/on phone behavior.
