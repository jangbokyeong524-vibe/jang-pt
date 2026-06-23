# 테스트 계획

## 1. 테스트 목표

- PT 회원 예약 MVP가 실제 사용 흐름에 맞는지 확인한다.
- 예약, 취소, 차감, 결제상태, 연장, 재등록 상태가 SPEC과 일치하는지 확인한다.
- 회원 승인 전/후 접근 권한이 안전한지 확인한다.
- 수업완료 중복 차감 같은 운영 사고를 막는지 확인한다.

## 1.1 테스트 단계 구분

- 현재 로컬 데모 단계에서는 화면 렌더링, 모바일 레이아웃, 데모 상태 변경 흐름을 검증한다.
- Supabase 연결 전에는 Kakao/Google 로그인, RLS, DB 트랜잭션, 배치 만료 테스트를 완료로 간주하지 않는다.
- Supabase 연결 후에는 5장 이후의 회원 연결, 예약, 차감, 결제상태, 연장, 재등록 테스트를 실제 DB 기준으로 다시 수행한다.

## 1.2 MVP 검수 단계

### 로컬 데모 검수 기준

로컬 데모 검수는 Supabase 연결 전 화면과 상태 흐름이 MVP 방향과 맞는지 확인하는 단계다. 운영 MVP 완료를 의미하지 않는다.

- 회원 홈에서 PT권 잔여횟수, 만료일, 결제상태, 재등록 상태가 보인다.
- 회원 예약 탭에서 공개된 예약 가능 시간을 선택하고 예약 요청할 수 있다.
- 회원은 확정 예약을 취소하거나 24시간 이내 취소요청으로 전환할 수 있다.
- 관장은 예약 요청을 승인/거절하고, 확정 수업을 완료 처리하며, 취소요청을 차감/미차감 처리할 수 있다.
- 관장은 PT권을 등록하고 결제상태를 `미납`, `결제요청`, `결제완료`, `환불`로 바꿀 수 있다.
- 회원은 연장 요청을 만들 수 있고, 관장은 연장 요청을 승인/거절하는 화면 흐름을 검수할 수 있다.

### 운영 MVP 완료 기준

운영 MVP 완료는 Supabase Auth/DB/RLS/RPC 연결 후 실제 DB 기준으로 검증한다.

- Google Identity Services 버튼과 `signInWithIdToken` 기반 관리자/회원 role routing이 연결된다.
- allowlist 관리자 로그인은 `admin_users` bootstrap 후 `is_admin()`을 통과한다.
- 비관리자 로그인은 승인 전 회원 연결 요청 화면으로 이동한다.
- 회원 승인 전/후 RLS가 적용되어 회원은 본인 데이터만 볼 수 있다.
- 회원 연결, 예약, 취소, 수업완료, 당일취소 차감은 DB 트랜잭션과 RPC로 처리된다.
- PT권 등록은 관리자 RPC 또는 동등한 서버 경계로 처리되고 `pt_passes`, `payments`, `pass_events`가 함께 생성된다.
- RPC 성공 후 화면은 회원, 예약, PT권, 결제, 이력 데이터를 DB에서 다시 읽는다.
- 같은 예약의 수업완료 또는 당일취소 차감은 중복 실행해도 1회만 차감된다.
- 결제상태 변경은 관리자 RPC 또는 동등한 서버 경계로 처리되고 `payment_events` 이력이 남는다.
- 연장 승인/거절은 관리자 RPC 또는 동등한 DB 트랜잭션으로 처리되고 `extension_requests`, PT권 만료일, `pass_events` 이력이 함께 정합성을 유지한다.
- 결제상태 변경과 연장 승인은 클라이언트 직접 update가 아니라 관리자 권한이 확인되는 서버 경계에서만 수행된다.

### MVP 밖

- 그룹수업, 일반 체육관 출석부, 락커, 물품 판매, 전체 정산 대시보드 테스트는 이번 MVP 완료 조건이 아니다.

## 2. 로컬 실행 테스트

명령:

```powershell
Set-Location "C:\Users\Jang Bo Kyeong\Documents\강동무에타이장 PT 관리"
$env:Path = "C:\Program Files\nodejs;$env:Path"
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

확인:

- `npm.cmd run build`가 성공한다.
- `http://localhost:3000` 또는 `http://127.0.0.1:3000` 접속이 된다.
- 콘솔에 치명적인 런타임 에러가 없다.

## 3. 모바일 UI 테스트

기준 폭:

- 390px x 844px
- 430px x 932px

확인 항목:

- 페이지 전체 가로 스크롤이 없다.
- 관리자/회원 전환 버튼 높이가 최소 44px이다.
- 관리자 탭 버튼 높이가 최소 44px이다.
- 관리자 하단 탭 4개가 화면 폭을 균등하게 나눠 아이콘과 라벨이 중앙 정렬된다.
- 처리 필요 패널이 모바일 첫 화면 상단에 보인다.
- 주간 시간표가 날짜별 세로 목록으로 보인다.
- 슬롯 카드의 시간, 상태, 회원명이 겹치지 않는다.
- 액션 버튼이 손가락으로 누르기 충분한 크기다.
- 회원 화면에서 PT 요약, 내 예약, 예약 가능 시간이 세로로 자연스럽게 이어진다.
- 회원 예약 요청 후 승인대기 상태가 숨겨지지 않는다.
- 미납 또는 결제요청 상태가 회원 화면에서 명확히 보인다.

## 4. 데스크톱 UI 테스트

기준 폭:

- 1280px x 800px

확인 항목:

- 페이지 전체 가로 스크롤이 없다.
- 처리 필요 패널이 좌측에 sticky로 유지된다.
- 주간 시간표가 4열로 확장된다.
- 회원/PT권 상세 화면이 회원 목록과 상세 패널로 나뉜다.
- 운영 설정 상품표가 다열로 보인다.

## 5. 회원 연결 테스트

이 장부터는 Supabase Auth/DB 연결 후 수행하는 통합 테스트다.

시나리오:

1. 관리자 allowlist가 아닌 Google 계정으로 로그인한다.
2. 이름과 전화번호를 입력해 연결 요청을 보낸다. 전화번호 입력칸은 빈 상태에서도 `___-____-____` 마스크처럼 보이고, 숫자만 입력해도 `010-0000-0000` 형태로 자동 표시되어야 한다.
3. `member_link_requests`에 `display_name`, `input_phone`, `normalized_phone`, `status = pending`, `member_id = null` 요청이 생성된다.
4. 같은 계정에 `pending` 또는 `approved` 요청이 있으면 앱이 추가 입력 폼 대신 현재 상태를 보여준다.
5. 관리자 계정으로 로그인해 회원 메뉴의 `승인 대기` 목록에서 요청을 확인한다.
6. 전화번호가 기존 `members.normalized_phone`과 일치하면 `기존 회원 연결`로 승인한다.
7. 매칭 후보가 없으면 `신규 회원 생성 후 승인`으로 `members` row를 만든 뒤 승인한다.
8. 부정확한 요청은 `반려`로 처리한다.
9. 같은 Google 계정에 기존 중복 `pending` 요청이 2개 있으면 하나를 승인한 뒤 나머지는 관리자 승인 목록에서 사라지는지 확인한다.

기대 결과:

- 승인 전 회원은 승인대기 상태만 본다.
- 승인 전 PT권/결제/예약 정보는 보이지 않는다.
- 전화번호 입력값은 하이픈 포함 표시값으로 보이지만 DB 매칭용 `normalized_phone`은 숫자만 저장된다.
- 기존 회원 승인 시 요청의 `member_id`, `status = approved`, `approved_at`이 실제 Supabase DB에 반영된다.
- 신규 회원 생성 승인 시 `members`에는 이름, 전화번호, 정규화 전화번호, `active` 상태, 빈 메모만 생성되고 PT권은 자동 생성되지 않는다.
- 같은 계정의 `pending`/`approved` open 요청은 DB에 하나만 남는다.
- 승인 후 같은 계정의 다른 `pending` 요청은 `rejected`로 닫히고 추가 승인할 수 없다.
- 반려 시 요청은 `status = rejected`, `rejected_at` 상태가 되고 회원 화면에서 반려 상태와 재요청 가능성이 보인다.
- 승인 후 본인 데이터만 보인다.
- 다른 회원 데이터는 보이지 않는다.

자동 확인:

- `npm run check:layout`는 `lib/member-link-actions.ts`, 기존 회원 승인, 신규 회원 생성 승인, 반려 액션, 계정당 open 요청 unique index, 승인 시 중복 pending 정리 액션, 회원 전화번호 자동 하이픈 입력 계약이 없으면 실패해야 한다.

## 6. 예약 요청 테스트

RPC:

- `request_reservation(target_slot_id uuid, target_pass_id uuid)`
- `approve_reservation(target_reservation_id uuid)`
- `reject_reservation(target_reservation_id uuid)`

시나리오:

1. 회원이 열린 슬롯 1개를 예약 요청한다.
2. 슬롯 상태가 `held`가 된다.
3. 예약 상태가 `requested`가 된다.
4. `locked_until`이 정책의 요청 만료 시간 기준으로 저장된다.

기대 결과:

- 다른 회원에게 해당 슬롯은 예약 가능으로 보이면 안 된다.
- 관장 화면 처리 필요 패널에 예약요청이 표시된다.
- 관장이 승인하면 예약은 `confirmed`, 슬롯은 `confirmed`가 된다.
- 관장이 거절하면 예약은 `cancelled`, 슬롯은 `open`이 된다.
- 슬롯이 이미 `held` 또는 `confirmed`이면 `request_reservation`은 실패한다.
- 잔여횟수 부족, 예약 제한 초과, 미납 예약 금지 정책 위반 시 예약과 슬롯 상태가 모두 바뀌지 않는다.

## 7. 요청 만료 테스트

시나리오:

1. 예약 요청 상태가 `requested`다.
2. `locked_until`이 현재 시간보다 과거다.
3. 만료 처리 함수 또는 배치가 실행된다.

기대 결과:

- 예약 상태가 `expired`가 된다.
- 슬롯 상태가 `open`으로 돌아온다.
- 만료된 예약은 관장이 승인할 수 없어야 한다.

## 8. 예약 제한 테스트

시나리오:

1. 회원의 잔여횟수가 1회다.
2. 이미 미래 확정예약이 1개 있다.
3. 회원이 추가 예약을 요청한다.

기대 결과:

- 기본 정책에서는 추가 예약이 막힌다.
- 정책을 `고정 개수` 또는 `제한 없음`으로 바꾸면 새 정책에 따라 동작한다.

## 9. 수업완료와 차감 테스트

RPC:

- `complete_session(target_reservation_id uuid)`

시나리오:

1. 예약 상태가 `confirmed`다.
2. 관장이 `수업완료`를 누른다.

기대 결과:

- 예약 상태가 `completed`가 된다.
- PT권 잔여횟수가 1회 줄어든다.
- `pass_events`에 `session_completed`, `delta_count = -1` 이벤트가 생긴다.
- 같은 예약에 대해 버튼을 여러 번 눌러도 1회만 차감된다.
- 같은 예약의 수업완료 이벤트가 이미 있으면 추가 차감되지 않는다.

## 10. 취소 테스트

RPC:

- `request_reservation_cancel(target_reservation_id uuid)`
- `resolve_late_cancel(target_reservation_id uuid, should_deduct boolean)`

24시간 전 자동취소:

1. 회원이 수업 시작 24시간 전 예약을 취소한다.
2. 예약 상태가 `cancelled`가 된다.
3. 슬롯은 `open`이 된다.
4. 잔여횟수는 줄지 않는다.

24시간 이내 취소요청:

1. 회원이 수업 시작 24시간 이내 예약 취소를 요청한다.
2. 예약 상태가 `cancel_requested`가 된다.
3. 관장이 차감 또는 미차감을 선택한다.

기대 결과:

- 차감 선택 시 잔여횟수 1회 감소 및 이벤트 기록.
- 미차감 선택 시 잔여횟수 유지.
- 처리 결과가 예약 이력에 남는다.
- `request_reservation_cancel`은 `auto_cancelled` 또는 `cancel_requested`를 반환한다.
- `resolve_late_cancel`은 `cancel_requested` 예약에만 동작한다.
- 같은 예약에 대해 `late_cancel_deducted` 이벤트가 이미 있으면 추가 차감되지 않는다.

DB 트랜잭션 확인:

- 회원이 직접 `reservations insert/update`로 예약 요청이나 취소요청을 만들 수 없어야 한다.
- `request_reservation`, `approve_reservation`, `reject_reservation`, `request_reservation_cancel`, `resolve_late_cancel`은 모두 `security definer` 함수여야 한다.
- 관리자 RPC는 `is_admin()` 가드를 통과해야 한다.
- 회원 RPC는 `approved_member_id()` 가드를 통과해야 한다.

## 11. 결제상태 테스트

이 장은 MVP 필수 통합 테스트다. 운영 MVP 완료 전에는 결제상태 변경 RPC 또는 동등한 관리자 서버 경계를 실제 DB 기준으로 검증해야 한다.

시나리오:

1. PT권을 신규 등록한다.
2. 결제 상태는 `unpaid`로 시작한다.
3. 관장이 BOX POS 문자를 보낸 뒤 `boxpos_requested`로 변경한다.
4. 결제 확인 후 `paid`로 변경한다.
5. 환불 시 `refunded`로 변경한다.

기대 결과:

- 관리자/회원 화면에 결제상태가 명확히 표시된다.
- 관리자 권한이 없으면 결제상태를 바꿀 수 없다.
- 클라이언트가 `pt_passes.payment_status`, `payments.status`, `payment_events`를 직접 불일치 상태로 update/insert할 수 없어야 한다.
- 상태 변경 성공 시 `pt_passes.payment_status`와 `payments.status`가 같은 최종 상태를 가진다.
- `payment_events`에 상태 변경 이력이 남는다.
- `payment_events.from_status`, `payment_events.to_status`, 변경자, 메모, 시간이 남는다.
- 같은 요청을 재시도해도 같은 상태 변경 이력이 중복으로 쌓이지 않거나, 재시도가 별도 감사 이벤트로 남는 기준이 명확해야 한다.
- 미납 상태에서도 정책상 허용이면 예약 요청 가능하다.
- 정책상 미납 예약이 금지되면 미납/결제요청 PT권으로 예약 요청할 수 없다.

## 12. 연장 테스트

이 장은 MVP 필수 통합 테스트다. 로컬 데모에서는 화면 흐름만 확인하고, 운영 MVP 완료 전에는 연장 승인 RPC 또는 동등한 DB 트랜잭션을 실제 DB 기준으로 검증해야 한다.

시나리오:

1. 회원이 질병/부상 등 사유로 연장을 요청한다.
2. 관장이 연장 요청을 승인한다.

기대 결과:

- `extension_requests.status`가 `approved`가 된다.
- PT권 만료일이 요청 일수만큼 늘어난다.
- `pass_events`에 `extension_added` 이력이 남고 해당 이벤트가 `extension_requests.id`와 연결된다.
- 승인 요청을 반복 실행해도 만료일과 `pass_events`가 중복 반영되지 않는다.
- 관리자 권한이 없으면 승인/거절할 수 없다.
- 회원은 본인 연장요청을 만들고 읽을 수 있지만, 직접 `approved`나 `rejected`로 바꿀 수 없다.

## 13. 재등록 테스트

조건:

- 잔여횟수 2회 이하
- 또는 만료 7일 전

기대 결과:

- 관리자 처리 필요 패널에 재등록 대상이 표시된다.
- 정책상 회원 노출이 켜져 있으면 회원 화면에도 재등록 안내가 표시된다.
- 기준값을 변경하면 새 기준으로 표시된다.

## 14. CSV 내보내기 테스트

확인 항목:

- 관리자 하단 탭은 `홈`, `주간`, `회원`, `설정` 4개만 표시된다.
- 설정 첫 화면에는 `PT 상품`, `운영 정책`, `안내 문구`, `CSV 내보내기` 메뉴만 표시된다.
- 설정 첫 화면에는 상품 입력, 정책 입력, CSV 체크박스가 바로 노출되지 않는다.
- `운영 정책` 메뉴 안에는 `예약`, `취소`, `연장`, `재등록` 하위 메뉴가 표시된다.
- 각 설정 상세 화면의 `뒤로` 버튼이 이전 메뉴로 돌아간다.
- `CSV 내보내기` 메뉴에 진입하면 CSV 선택 섹션이 표시된다.
- 아무 항목도 선택하지 않으면 다운로드 버튼이 비활성화된다.
- `회원`, `예약`, `결제`를 선택하면 다운로드 버튼이 활성화된다.
- 개인정보 포함을 끄면 회원 전화번호와 회원 연결 요청 입력 전화번호가 CSV에 포함되지 않는다.
- 개인정보 포함을 켜면 회원 전화번호와 회원 연결 요청 입력 전화번호가 CSV에 포함된다.
- 다운로드 파일명은 `gangdong-pt-export-YYYY-MM-DD.csv` 형식을 따른다.
- CSV 헤더는 `exported_at,dataset,record_id,field,value`로 시작한다.

## 15. MVP 제외 기능 확인

MVP 완료 판단에서 제외한다:

- 그룹수업 출석부
- 일반 헬스장 회원권
- 락커 관리
- 물품 판매
- 전체 정산 대시보드
- 카카오톡 자동발송
- PG 결제 또는 BOX POS API 연동
