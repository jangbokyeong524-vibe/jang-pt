# 강동무에타이장 PT 관리 앱 SETUP

## 1. 전제

- OS: Windows
- 앱: Next.js 웹/PWA
- DB/Auth: Supabase
- 배포: Vercel 기준
- 현재 로컬 프로젝트 경로:

```powershell
C:\Users\Jang Bo Kyeong\Documents\강동무에타이장 PT 관리
```

현재 저장소는 로컬 데모 UI와 Supabase 목표 설계를 함께 둔 초안 단계다. Supabase 연결 전에는 데모 데이터로 화면을 확인하고, Supabase 연결 후에는 인증/RLS/DB 트랜잭션 테스트를 별도로 수행한다.

## 2. Node.js 설치

이 프로젝트는 Node.js와 npm이 필요하다.

Windows에서 `winget`이 있으면 다음 명령으로 Node.js LTS를 설치한다.

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

설치 후 PowerShell을 완전히 닫았다가 다시 연다.

버전 확인:

```powershell
node -v
npm.cmd -v
```

PowerShell 보안 정책 때문에 `npm -v`가 막힐 수 있다. 이 경우 `npm.cmd`를 사용한다.

## 3. 로컬 실행

PowerShell에서 프로젝트 폴더로 이동한다.

```powershell
Set-Location "C:\Users\Jang Bo Kyeong\Documents\강동무에타이장 PT 관리"
```

Node.js 경로가 바로 잡히지 않으면 현재 터미널에서만 PATH를 보정한다.

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
```

의존성 설치:

```powershell
npm.cmd install
```

개발 서버 실행:

```powershell
npm.cmd run dev
```

브라우저 접속:

```text
http://localhost:3000
```

또는:

```text
http://127.0.0.1:3000
```

## 4. 빌드 확인

배포 전에는 빌드를 확인한다.

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
npm.cmd run build
```

성공 기준:

- `Compiled successfully`
- `Finished TypeScript`
- `/` route 생성 성공

## 5. 환경변수

Supabase 연결 전에는 데모 데이터로 화면을 확인할 수 있다.

Supabase 연결 시 `.env.example`을 복사해 `.env.local`을 만든다.

```powershell
Copy-Item .env.example .env.local
```

`.env.local` 값:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

주의:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 브라우저에 노출될 수 있다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이다.
- `SUPABASE_SERVICE_ROLE_KEY` 이름 앞에 `NEXT_PUBLIC_`를 붙이면 안 된다.

## 6. Supabase 설정

1. Supabase 프로젝트 생성
2. Authentication에서 Kakao provider 설정
3. Authentication에서 Google provider 설정
4. SQL Editor에서 `docs/supabase-schema.sql` 실행
5. `SUPABASE_SERVICE_ROLE_KEY`를 서버 환경변수로 설정
6. 관리자 이메일 allowlist 계정으로 Google 로그인

### 6.1 OAuth callback 설정

Google 로그인은 앱의 `/auth/callback` 화면에서 세션을 확인한다.
Kakao provider는 켜져 있지만 1차 앱 UI는 Google 로그인만 노출한다.

Supabase provider 설정에서 확인할 항목:

- Supabase Kakao provider의 callback URL을 Kakao Developers의 Redirect URI에 등록한다.
- Google OAuth에는 로컬/배포 redirect URL을 등록한다.
- Next.js 앱에는 `app/auth/callback/page.tsx` callback 화면이 있다.
- Supabase Authentication URL 설정의 redirect allow list에 로컬과 배포 callback URL을 등록한다.

로컬 예시:

```text
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
```

배포 예시:

```text
https://배포도메인/auth/callback
```

관리자 등록은 allowlist 이메일로 Google 로그인하면 `/api/auth/bootstrap-admin`에서 `admin_users`에 자동 반영한다.
현재 allowlist는 `lib/auth-config.ts`를 기준으로 한다.

## 7. Vercel 배포

Vercel 프로젝트 생성 후 환경변수를 동일하게 등록한다.

필수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

서버 전용 작업을 배포 환경에서 사용할 경우:

- `SUPABASE_SERVICE_ROLE_KEY`

배포 전 확인:

```powershell
npm.cmd run build
```

## 8. 로컬 문제 해결

`npm : 이 시스템에서 스크립트를 실행할 수 없으므로 ... npm.ps1 파일을 로드할 수 없습니다.`

해결:

```powershell
npm.cmd -v
npm.cmd install
npm.cmd run dev
```

영구 해결이 필요하면 현재 사용자 범위에서 PowerShell 정책을 바꿀 수 있다.

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

`"node" is not recognized`

해결:

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
```

## 9. 문서 위치

- 제품/기술 설계: `SPEC.md`
- UI/UX 디자인: `docs/design.md`
- 데이터 모델: `docs/DATA_MODEL.md`
- 보안 기준: `docs/SECURITY.md`
- 테스트 계획: `docs/TEST_PLAN.md`
- 운영 매뉴얼: `docs/OPERATIONS.md`
- Supabase SQL: `docs/supabase-schema.sql`
