# 회원 Compact Header Design

## 목표

회원 화면 상단 영역을 compact app bar 1줄 수준으로 줄여 모바일에서 예약 달력이 더 빨리 보이게 한다.

현재 회원 예약 화면은 전역 헤더, 로그인 완료 메시지, 회원 선택, 승인 배지에서 계정 상태를 반복한다. 새 설계는 필요한 상태만 남기고 쌓인 상단 블록을 제거한다.

## 범위

- 회원 앱 surface와 회원 mode의 root render 경계에 적용한다.
- 1차 대상은 회원 `예약` 탭이다.
- 같은 compact header shell은 회원 `홈`, `내역`에서도 동작해야 한다.
- 관리자 일정 toolbar와 관리자 하단 탭은 범위 밖이다.
- 예약 동작, 승인 동작, Supabase auth 동작은 범위 밖이다.

## Root Render 규칙

현재 큰 `강동무에타이장 / PT 운영 관리` topbar와 `status-line`은 app root에서 관리자/회원 공통으로 렌더된다. 구현 시 `mode === "member"`에서는 이 공통 `topbar`와 `status-line`을 렌더하지 않는다.

- 관리자 mode에서는 기존 root `topbar`와 `status-line`을 유지한다.
- 회원 mode에서는 `MemberView` 안의 compact header가 identity, approval state, member switching, logout entry를 담당한다.
- login, signed-out, member-pending 화면은 이 변경 범위가 아니며 기존 인증 화면 구조를 유지한다.
- 회원 mode에서 최근 처리 메시지를 반드시 표시해야 하는 경우에는 별도 status card를 되살리지 말고 compact header 아래의 작은 inline feedback 영역으로 제한한다.

## Header 구조

회원 앱은 compact top bar 하나를 사용한다.

- 왼쪽 primary text: 현재 회원 탭 제목.
  - `홈`
  - `PT 예약`
  - `내역`
- 왼쪽 secondary text: 로그인 identity.
  - live auth mode에서는 auth email 또는 회원 표시명을 보여준다.
  - 긴 값은 한 줄 ellipsis로 줄인다.
- 오른쪽 status pill:
  - 승인된 회원 연결 상태는 `승인됨`.
  - 대기 중인 회원 연결 상태는 `승인대기`.
- 오른쪽 overflow action:
  - compact `more` icon button.
  - live auth mode에서는 `로그아웃`을 제공한다.
  - local demo mode에서는 전체 폭 toolbar 대신 여기에서 회원 계정 선택을 제공한다.

## Component Boundary

compact header는 `MemberView`가 소유한다. root는 회원 mode에서 `MemberView`가 header를 그릴 수 있도록 필요한 값과 action만 넘긴다.

- `authStatus`처럼 live auth mode와 local demo mode를 구분할 수 있는 값.
- `authEmail`.
- `handleSignOut`.
- `memberSessionId`와 `setMemberSessionId`.
- 회원 선택 option을 만들 수 있는 `state.members`.
- 현재 선택된 `memberTab`.

`MemberBookingView`, `MemberHomeView`, `MemberHistoryView`는 header ownership을 갖지 않는다. 각 탭 view는 본문 content만 담당한다.

## 회원 Main Surface에서 제거

- 큰 `강동무에타이장 / PT 운영 관리` header block.
- 큰 header 옆 inline auth identity row.
- header 아래 로그인 성공 status card.
- 회원 surface 안의 전체 폭 demo 회원 선택 row.

이 요소들은 login, pending-link, admin surface처럼 의미가 있는 곳에는 남길 수 있다.

## 예약 Summary

회원 `예약` 탭에서 달력 위 summary는 compact row 하나로 바꾼다.

- `가능 주차: 4주`
- `예약: 0건`
- `결제: 없음`

이 row는 현재의 세로 stacked card 3개를 대체한다. 예약 판단에 필요한 값은 계속 보이되, 달력을 아래로 밀면 안 된다.

## Overflow Menu 규칙

- overflow button은 `aria-label="회원 메뉴"`를 가진다.
- 메뉴가 열리면 live auth mode에서는 `로그아웃` action을 보여준다.
- 메뉴가 열리면 local demo mode에서는 회원 선택 control을 보여준다.
- 메뉴 외부 클릭, `Escape`, 메뉴 action 실행 시 menu를 닫는다.
- 승인 상태 pill은 menu 안으로 숨기지 않는다.
- demo 회원 선택은 검수 장치이므로 접근 가능해야 하지만, 화면 위쪽에 별도 toolbar row를 만들면 실패다.

## Interaction 규칙

- 하단 탭은 `홈 / 예약 / 내역` 그대로 둔다.
- 현재 선택된 탭이 compact header title을 결정한다.
- header는 하나의 compact app-bar band로 보여야 한다. title과 secondary identity가 시각적으로 한 묶음이어도 전체 header 높이는 모바일에서 약 52-60px 안팎을 목표로 한다.
- status pill이나 action button이 눌리기 전에 secondary identity text가 먼저 줄어든다.

## 시각 Acceptance Criteria

- 모바일 폭 화면에서 회원 상단 영역이 app-bar 1줄 band처럼 읽힌다.
- 예약 달력이 기존보다 눈에 띄게 위에서 시작한다.
- 승인 회원 로그인 성공 후 중복 login success card가 보이지 않는다.
- 승인 상태는 menu를 열지 않아도 보인다.
- demo 회원 전환은 별도 toolbar row 없이 접근 가능하다.
- 텍스트가 승인 pill, overflow button, bottom tabs와 겹치지 않는다.
- 회원 mode에서 root `topbar`와 `status-line`이 compact header 위에 중복 표시되지 않는다.

## 구현 Notes

- 예상 component seam은 `components/pt-management-app.tsx`의 root `mode === "member"` branch와 `MemberView`다.
- 예상 style seam은 `app/globals.css`의 member header, member toolbar, member booking summary style이다.
- 기존 회원 예약 calendar와 slot-list 동작은 유지한다.
- 구현 후 `docs/design.md`의 회원 정보 구조 문구를 갱신한다.
- layout check가 전체 폭 회원 선택 toolbar를 가정하고 있으면 함께 갱신한다.
