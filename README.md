# 강동무에타이장 PT 관리 앱

PT 회원권, 회원 예약, 결제상태, 취소/연장 예외, 재등록 대상을 관리하는 모바일 우선 웹/PWA 초안입니다.

모바일 접속을 1순위로 두고 설계했습니다. 기본 레이아웃은 휴대폰 화면 기준이며, 태블릿/PC에서는 같은 화면이 넓게 확장됩니다.

## MVP 목표

먼저 완성할 MVP는 체육관 전체 관리앱이 아니라 **PT 회원 예약 운영판**입니다.

- 회원은 본인 PT권, 결제상태, 예약 가능 시간, 예약/차감/연장 이력을 확인한다.
- 회원은 직접 예약을 요청하고, 정책 기준에 따라 예약 취소 또는 취소요청과 연장 요청을 한다.
- 관장은 회원 연결, PT권 등록, 결제상태 수기 변경, 예약 승인/거절, 수업완료 차감, 당일취소 차감/미차감 판단, 연장 승인/거절을 처리한다.
- CSV 내보내기로 비타민CRM 또는 외부 장부에 필요한 데이터를 옮길 수 있다.

그룹수업, 일반 체육관 출석부, 락커, 물품 판매, 전체 정산 대시보드는 MVP 범위가 아닙니다.

## 현재 구현 상태

- 현재 화면의 운영 데이터는 아직 로컬 데모 데이터(`lib/seed-data.ts`)가 중심입니다.
- Supabase 프로젝트, Google/Kakao provider, 예약 RPC 스키마는 연결되어 있습니다.
- Google Identity Services 로그인, 관리자 이메일 allowlist bootstrap, 회원 연결 요청 생성은 앱에 연결되어 있습니다.
- 예약 요청/승인/거절/취소/차감 RPC 경계는 문서와 어댑터에 존재하지만, 전체 DB read/refetch는 아직 화면에 연결되지 않았습니다.
- Supabase 연결 전 테스트는 화면과 로컬 상태 흐름 기준으로 보고, 연결 후에는 `docs/TEST_PLAN.md`의 백엔드 테스트까지 수행합니다.

## 현재 화면 구현 범위

- 관리자 화면
  - 주간 시간표
  - 처리 필요 패널
  - 예약 승인/거절
  - 수업완료 및 1회 차감
  - 취소요청 차감/미차감 판단
  - 회원 연결 승인
  - 연장 승인
  - PT권 등록
  - BOX POS 결제상태 수기 관리
  - 운영 정책 설정
- 회원 화면
  - 내 PT권, 잔여횟수, 만료일, 결제상태
  - 내 예약
  - 4주치 예약 가능 슬롯 요청
  - 정책 기준 자동취소/취소요청
  - 연장 요청과 연장 요청/승인 상태 확인
- Supabase 설계
  - `docs/supabase-schema.sql`에 테이블, RLS, 인덱스, 예약 RPC, 중복차감/중복연장 방지 기준 포함
- 제품/기술 설계
  - `SPEC.md`에 PT 회원 예약 MVP 기준, 정책, 데이터/보안 설계 명시
- UI/UX 디자인
  - `docs/design.md`에 모바일 우선 화면 구조와 디자인 기준 명시

## 문서

- `SPEC.md`: 제품/기술/운영 설계 기준
- `SETUP.md`: 로컬 실행, Supabase 연결, Vercel 배포 준비
- `docs/design.md`: UI/UX, 모바일 우선 디자인 기준
- `docs/SECURITY.md`: RLS, 권한, 개인정보, service role key 취급 기준
- `docs/TEST_PLAN.md`: 모바일/데스크톱, 예약, 차감, 결제상태, 권한 테스트
- `docs/OPERATIONS.md`: 관장 일일 운영 매뉴얼
- `docs/DATA_MODEL.md`: 테이블 관계와 주요 상태 설명
- `docs/supabase-schema.sql`: Supabase 적용 SQL

## 실행 방법

이 PC의 현재 PowerShell에서는 `npm.ps1` 실행이 막힐 수 있으므로 `npm.cmd`를 기준으로 실행합니다. 자세한 설치/문제 해결은 `SETUP.md`를 기준으로 합니다.

```powershell
npm.cmd install
npm.cmd run dev
```

Supabase 연결 없이도 데모 데이터로 화면과 주요 흐름은 동작합니다.

Supabase를 연결하려면 `.env.example`을 참고해 `.env.local`을 만들고 값을 채웁니다.

```powershell
Copy-Item .env.example .env.local
```

## Supabase 적용 순서

1. Supabase 프로젝트 생성
2. Authentication에서 Kakao, Google provider 설정
3. SQL Editor에서 `docs/supabase-schema.sql` 실행
4. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 입력
5. 서버 환경변수에 `SUPABASE_SERVICE_ROLE_KEY` 입력
6. 관리자 이메일 allowlist를 확인하고 Google 로그인으로 `admin_users` bootstrap
7. RPC 성공 후 회원/예약/PT권/이력 데이터를 다시 읽도록 화면 상태를 연결

`SUPABASE_SERVICE_ROLE_KEY`는 브라우저에 노출되면 안 됩니다.

## 운영 MVP 필수 연결 작업

- Supabase 프로젝트 생성 또는 연결
- Kakao Auth 버튼 연결
- Supabase RLS와 예약 RPC 실제 DB 검증
- RPC 성공 후 화면 refetch 연결
- 결제상태 변경 RPC와 `payment_events` 이력 검증
- 연장 승인 RPC 또는 DB 트랜잭션과 `extension_requests`/만료일/`pass_events.extension_request_id` 이력 검증
- 회원 예약 화면의 승인대기/취소요청 상태 표시 개선

## MVP에서 의도적으로 제외한 것

- 그룹수업, 일반 체육관 출석부, 락커, 물품 판매, 전체 정산 대시보드
- SMS 본인인증
- 카카오톡 자동발송 API
- PG 결제 연동
- 비타민CRM 자동 연동
- 실제 BOX POS API 연동

BOX POS는 외부 결제 수단으로 유지하고, 앱에서는 결제요청/결제완료/환불 상태와 이력을 관리합니다.
