# 회원 Compact Header Design

## 목표

회원 화면 상단 영역을 compact app bar 1줄 수준으로 줄여 모바일에서 예약 달력이 더 빨리 보이게 한다.

현재 회원 예약 화면은 전역 헤더, 로그인 완료 메시지, 회원 선택, 승인 배지에서 계정 상태를 반복한다. 새 설계는 필요한 상태만 남기고 쌓인 상단 블록을 제거한다.

## 범위

- 회원 앱 surface에 적용한다.
- 1차 대상은 회원 `예약` 탭이다.
- 같은 compact header shell은 회원 `홈`, `내역`에서도 동작해야 한다.
- 관리자 일정 toolbar와 관리자 하단 탭은 범위 밖이다.
- 예약 동작, 승인 동작, Supabase auth 동작은 범위 밖이다.

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

## Interaction 규칙

- 하단 탭은 `홈 / 예약 / 내역` 그대로 둔다.
- 현재 선택된 탭이 compact header title을 결정한다.
- overflow menu는 keyboard accessible이어야 하고 `aria-label`을 가진다.
- demo-only 회원 전환은 계속 가능해야 하지만 별도 row를 차지하면 안 된다.
- header는 모바일에서 두 줄처럼 보이면 안 된다. status pill이나 action button이 눌리기 전에 secondary identity text가 먼저 줄어든다.

## 시각 Acceptance Criteria

- 모바일 폭 화면에서 회원 상단 영역이 app-bar 1줄처럼 읽힌다.
- 예약 달력이 기존보다 눈에 띄게 위에서 시작한다.
- 승인 회원 로그인 성공 후 중복 login success card가 보이지 않는다.
- 승인 상태는 menu를 열지 않아도 보인다.
- demo 회원 전환은 별도 toolbar row 없이 접근 가능하다.
- 텍스트가 승인 pill, overflow button, bottom tabs와 겹치지 않는다.

## 구현 Notes

- 예상 component seam은 `components/pt-management-app.tsx`의 `MemberView`다.
- 예상 style seam은 `app/globals.css`의 member header, member toolbar, member booking summary style이다.
- 기존 회원 예약 calendar와 slot-list 동작은 유지한다.
- 구현 후 `docs/design.md`의 회원 정보 구조 문구를 갱신한다.
- layout check가 전체 폭 회원 선택 toolbar를 가정하고 있으면 함께 갱신한다.
