# 강동무에타이장 PT 관리 앱

PT권, 예약, 결제상태, 취소/연장 예외, 재등록 대상을 한 화면에서 관리하는 모바일 우선 웹/PWA 초안입니다.

모바일 접속을 1순위로 두고 설계했습니다. 기본 레이아웃은 휴대폰 화면 기준이며, 태블릿/PC에서는 같은 화면이 넓게 확장됩니다.

## 현재 구현 상태

- 현재 화면은 Supabase 연결 전 로컬 데모 데이터(`lib/seed-data.ts`)로 동작합니다.
- `lib/supabase.ts`, `docs/supabase-schema.sql`, 보안/테스트 문서는 Supabase Auth/DB 연결을 위한 목표 설계입니다.
- Kakao/Google 로그인, 회원 승인 RLS, 예약 요청 DB 트랜잭션은 아직 화면에 연결되지 않았습니다.
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
  - 비타민CRM 복사용 요약
- 회원 화면
  - 내 PT권, 잔여횟수, 만료일, 결제상태
  - 내 예약
  - 4주치 예약 가능 슬롯 요청
  - 정책 기준 자동취소/취소요청
- Supabase 설계
  - `docs/supabase-schema.sql`에 테이블, RLS, 인덱스, 중복차감 방지 함수 포함
- 제품/기술 설계
  - `SPEC.md`에 v1 운영 기준, 정책, 데이터/보안 설계 명시
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
2. Authentication에서 Kakao, Google provider와 OAuth callback/redirect URL 설정
3. SQL Editor에서 `docs/supabase-schema.sql` 실행
4. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 입력
5. 인증 callback route와 Supabase 클라이언트를 화면에 연결
6. 서버 전용 작업이 필요할 때만 `SUPABASE_SERVICE_ROLE_KEY`를 서버 환경변수로 설정

`SUPABASE_SERVICE_ROLE_KEY`는 브라우저에 노출되면 안 됩니다.

## v1에서 의도적으로 제외한 것

- SMS 본인인증
- 카카오톡 자동발송 API
- PG 결제 연동
- 비타민CRM 자동 연동
- 실제 BOX POS API 연동

BOX POS는 외부 결제 수단으로 유지하고, 앱에서는 결제요청/결제완료/환불 상태와 이력을 관리합니다.
