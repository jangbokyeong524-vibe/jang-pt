# 관리자 Minimal Header Design

## 배경

관리자 홈은 운영 화면이다. 모바일에서 첫 번째로 보여야 하는 것은 계정 정보가 아니라 오늘 처리할 일, 회원 연결 승인 대기, 주간 요약이다. 이전 관리자 상단은 큰 `PT 운영 관리` 제목, 로그인 이메일, 로그아웃 버튼, 로그인 성공 메시지를 모두 첫 카드 위에 노출해 계정 chrome이 운영 정보보다 높은 위계를 가져갔다.

## 결정

관리자 상단은 최소 header로 정리한다.

- 항상 보이는 header는 1줄이다.
- 모바일 기준 header 목표 높이는 44-52px다.
- 왼쪽에는 `강동무에타이장` 텍스트와 작은 `관리자` pill만 둔다.
- `PT 운영 관리` 대형 제목은 제거한다.
- 오른쪽에는 `회원 전환` 액션과 `계정 메뉴` 액션만 둔다.
- 로그인 이메일은 항상 보이는 header에 노출하지 않는다.
- 로그인 이메일은 계정 메뉴가 열렸을 때만 작은 pill로 보여준다.
- 로그아웃은 계정 메뉴 안에 둔다.
- 초기 로그인 성공 메시지는 관리자 홈에서 렌더하지 않는다.
- 예약 승인, 예약 거절, 취소 처리, 회원 연결 승인처럼 실제 운영 액션이 끝났을 때만 조건부 notice를 보여준다.
- 조건부 notice는 첫 카드를 지속적으로 밀어내는 고정 status-line이 아니라 header 아래 낮은 inline notice로 둔다.

## 범위

이번 slice는 관리자 topbar와 root status-line 동작만 바꾼다. 관리자 홈 카드, 일정 row, 회원 compact header, 회원 예약, 하단 탭, 인증 규칙은 바꾸지 않는다.

## 레이아웃 계약

- 관리자 topbar는 negative horizontal margin을 쓰지 않는다.
- 관리자 topbar는 `env(safe-area-inset-top)` padding을 쓰지 않는다.
- 관리자 topbar는 항상 보이는 영역에서 raw `authEmail`을 렌더하지 않는다.
- 관리자 topbar는 `PT 운영 관리` 대형 제목을 렌더하지 않는다.
- 관리자 account menu가 열리면 현재 이메일을 pill로 보여준다.
- 관리자 로그아웃 버튼은 account menu 안에서만 렌더한다.
- 초기 로그인 성공 메시지는 persistent status-line으로 렌더하지 않는다.
- 운영 액션 결과 notice가 렌더되더라도 낮은 inline 형태여야 하며 카드형 box-shadow surface로 돌아가면 안 된다.
- 회원 mode는 독립적으로 유지하며 admin topbar/status-line을 다시 가져오면 안 된다.

## 검증

- Static layout contract는 header 이메일 숨김, account-menu 이메일 pill, 대형 제목 제거, compact header, 초기 로그인 성공 status-line suppression을 검사한다.
- `npm run check:layout`가 통과해야 한다.
- `npm run build`가 통과해야 한다.
- `git diff --check`가 통과해야 한다.
- 모바일 수동 확인에서 첫 관리자 카드가 header 직후 8-12px 이내에 시작해야 한다.
- 모바일 수동 확인에서 관리자 화면임은 `강동무에타이장`과 `관리자` pill로 충분히 식별되어야 한다.
