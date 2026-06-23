# 데이터 모델

## 1. 개요

이 문서는 `docs/supabase-schema.sql`을 읽기 쉽게 설명한다.

현재 SQL은 예약 요청, 승인, 거절, 취소 요청, 수업완료, 취소 차감처럼 상태가 여러 테이블에 걸쳐 바뀌는 작업을 RPC 중심으로 처리한다. 결제상태 변경과 연장 승인 RPC 또는 동등한 관리자 서버 트랜잭션은 운영 MVP 필수 보강 범위다.

핵심 원칙:

- 새 앱은 PT 운영 기준 장부다.
- 잔여횟수와 결제상태는 현재값뿐 아니라 이벤트 이력으로 관리한다.
- 회원 데이터 접근은 Supabase RLS로 제한한다.
- 정책 변경은 신규 PT권/신규 예약부터 적용하고 기존 데이터는 스냅샷을 유지한다.

## 2. 주요 관계

```text
auth.users
  ├─ admin_users
  └─ member_link_requests ── members

members
  ├─ pt_passes ── pt_pass_products
  │    ├─ pass_events
  │    └─ payments ── payment_events
  ├─ reservations ── availability_slots
  ├─ extension_requests
  └─ notifications

policy_settings
availability_templates
```

## 3. 인증/권한 테이블

### `admin_users`

관리자 권한 기준 테이블.

주요 컬럼:

- `auth_user_id`: Supabase Auth 사용자 ID
- `display_name`: 관리자 표시명
- `created_at`: 생성 시간

관리자 판정은 `is_admin()` 함수에서 이 테이블을 기준으로 한다.

### `member_link_requests`

로그인한 사용자를 기존 회원과 연결하는 요청 테이블.

주요 컬럼:

- `auth_user_id`: 로그인 사용자 ID
- `member_id`: 연결될 기존 회원 ID
- `auth_provider`: `kakao` 또는 `google`
- `display_name`: 회원이 입력한 이름
- `input_phone`: 회원이 입력한 전화번호
- `normalized_phone`: 숫자만 남긴 전화번호
- `status`: `pending`, `approved`, `rejected`
- `approved_by`, `approved_at`: 승인 관리자와 승인 시간

전화번호는 본인인증 결과가 아니라 매칭 힌트다.

관리자는 앱의 회원 메뉴에서 `pending` 요청을 처리한다.

- `normalized_phone`이 기존 `members.normalized_phone`과 같으면 기존 회원에 연결하고 `member_id`, `status = approved`, `approved_at`을 기록한다.
- 매칭 후보가 없으면 `members`에 `display_name`, `input_phone`, `normalized_phone`, `status = active`, `memo = ""`로 신규 회원을 만든 뒤 그 회원 ID로 승인한다.
- 신규 회원 생성 승인 시 PT권은 만들지 않는다. PT권은 회원 상세 화면에서 별도 등록한다.
- 반려는 `status = rejected`, `rejected_at`을 기록한다.
- 같은 Google 계정에는 `pending` 또는 `approved` 요청을 합쳐 하나만 허용한다.
- 이미 승인된 계정에 남아 있는 다른 `pending` 요청은 관리자 승인 목록에서 제외하고, 승인 처리 시 중복 pending은 `rejected`로 닫는다.
- `member_link_requests_one_open_request_per_auth_user_idx`는 DB 레벨에서 계정당 open 요청 1개 규칙을 강제한다.

## 4. 회원 테이블

### `members`

PT 회원 기본 정보.

주요 컬럼:

- `name`: 회원명
- `phone`: 표시용 전화번호
- `normalized_phone`: 비교용 전화번호
- `status`: `active`, `paused`, `archived`
- `memo`: 운영 메모

`normalized_phone`은 중복 방지를 위해 unique index를 가진다.

## 5. 정책 테이블

### `policy_settings`

운영 정책 JSON 저장 테이블.

저장 대상:

- 예약 공개 주차
- 요청 만료 시간
- 미납 예약 허용 여부
- 자동취소 기준
- 취소 예외 사유
- 연장 사유
- 재등록 기준
- 문구 템플릿

정책 변경은 새 PT권/새 예약부터 적용한다.

## 6. PT권 상품과 PT권

### `pt_pass_products`

PT권 상품 설정.

주요 컬럼:

- `sessions`: 회차
- `name`: 상품명
- `price`: 가격
- `default_valid_days`: 기본 유효기간
- `active`: 판매/선택 가능 여부

기본값:

- 1~5회권: 30일
- 6~10회권: 60일
- 1회 60,000원

### `pt_passes`

회원에게 실제로 부여된 PT권.

주요 컬럼:

- `member_id`: 회원
- `product_id`: 기준 상품
- `total_sessions`: 총 회차
- `remaining_sessions`: 잔여 회차
- `price`: 등록 당시 가격
- `payment_status`: `unpaid`, `boxpos_requested`, `paid`, `refunded`
- `starts_on`, `expires_on`: 시작일, 만료일
- `active`: 활성 여부
- `policy_snapshot`: 생성 당시 정책값

상품 설정이 나중에 바뀌어도 기존 PT권은 생성 당시 값을 유지해야 한다.

## 7. 잔여횟수 이벤트

### `pass_events`

PT권 잔여횟수와 관련된 원장형 이벤트.

주요 컬럼:

- `pass_id`: PT권
- `member_id`: 회원
- `reservation_id`: 관련 예약
- `extension_request_id`: 관련 연장 요청
- `event_type`: 이벤트 종류
- `delta_count`: 회차 증감
- `reason`: 사유
- `actor_auth_user_id`: 처리자
- `actor_role`: `admin`, `member`, `system`

이벤트 종류:

- `pass_created`: PT권 생성
- `session_completed`: 수업완료 차감
- `late_cancel_deducted`: 24시간 이내 취소 차감
- `exception_restored`: 예외 복구
- `refund_adjusted`: 환불 조정
- `extension_added`: 연장

중복 반영 방지:

- 같은 예약의 `session_completed`, `late_cancel_deducted` 이벤트는 unique index로 중복 삽입을 막는다.
- 같은 연장 요청의 `extension_added` 이벤트는 `extension_request_id` 기준 unique index로 중복 삽입을 막는다.

## 8. 예약 가능 시간과 예약

### `availability_templates`

반복 가능 시간표.

주요 컬럼:

- `weekday`: 요일
- `start_time`, `end_time`: 시간
- `active`: 활성 여부

### `availability_slots`

실제 날짜/시간 슬롯.

주요 컬럼:

- `start_at`, `end_at`: 시작/종료 시간
- `status`: `open`, `held`, `confirmed`, `blocked`
- `held_until`: 요청 잠금 만료 시간

슬롯은 60분 점유를 기준으로 한다.

### `reservations`

예약 요청과 확정 수업.

주요 컬럼:

- `member_id`: 회원
- `pass_id`: 사용 PT권
- `slot_id`: 슬롯
- `status`: `requested`, `confirmed`, `completed`, `cancelled`, `cancel_requested`, `no_show`, `expired`
- `locked_until`: 요청 잠금 만료 시간
- `confirmed_at`, `completed_at`, `cancelled_at`
- `cancel_reason`
- `deduct_on_cancel`
- `policy_snapshot`: 예약 생성 당시 정책값

활성 예약 상태:

- `requested`
- `confirmed`
- `cancel_requested`

같은 슬롯에 활성 예약이 중복되지 않도록 partial unique index를 둔다.

## 9. 결제

### `payments`

PT권 결제 상태.

주요 컬럼:

- `member_id`: 회원
- `pass_id`: PT권
- `amount`: 금액
- `status`: `unpaid`, `boxpos_requested`, `paid`, `refunded`
- `method`: `cash`, `card`, `boxpos`, `refund`
- `boxpos_reference`: BOX POS 참고 정보
- `memo`: 메모

한 PT권에는 하나의 결제 row만 연결한다. 기존 DB에 같은 `pass_id` 결제가 여러 개 있으면 `payments_one_payment_per_pass_idx` 적용 전에 중복을 정리해야 한다.
앱은 실제 결제를 처리하지 않는다.

### `payment_events`

결제상태 변경 이력.

주요 컬럼:

- `payment_id`: 결제
- `from_status`: 변경 전 상태
- `to_status`: 변경 후 상태
- `actor_auth_user_id`: 처리자
- `actor_role`: `admin`, `system`
- `memo`: 근거 메모

## 10. 연장과 알림

### `extension_requests`

회원 연장 요청.

주요 컬럼:

- `member_id`: 회원
- `pass_id`: PT권
- `reason`: 사유
- `days`: 요청 일수
- `status`: `requested`, `approved`, `rejected`
- `decided_by`, `decided_at`: 처리자와 처리 시간

회원 요청 생성은 `request_extension` RPC만 사용한다. 승인 시 `approve_extension_request` RPC가 PT권 만료일을 늘리고 `pass_events`에 `extension_added`를 기록한다. 거절 시 `reject_extension_request` RPC가 요청 상태와 처리자만 기록한다. 승인 이벤트는 `extension_request_id`로 원 요청과 연결되어야 하며 같은 요청이 두 번 승인되어 만료일이 중복 증가하면 안 된다.

### `notifications`

회원 알림.

주요 컬럼:

- `member_id`: 회원
- `title`: 제목
- `body`: 내용
- `read`: 읽음 여부
- `created_at`: 생성 시간

## 11. DB 함수

### `is_admin()`

현재 `auth.uid()`가 `admin_users`에 존재하는지 확인한다.

### `approved_member_id()`

현재 `auth.uid()`에 승인된 회원 연결이 있는 경우 `member_id`를 반환한다.

### `complete_session(target_reservation_id uuid)`

수업완료와 1회 차감을 하나의 트랜잭션으로 처리한다.

검증:

- 관리자만 실행 가능
- 예약이 존재해야 함
- 예약 상태가 `confirmed`여야 함
- 잔여횟수가 1회 이상이어야 함
- 이미 완료된 예약이면 추가 차감하지 않음
- `pass_events_one_completion_per_reservation_idx` 충돌 시 추가 차감하지 않음

### `request_reservation(target_slot_id uuid, target_pass_id uuid)`

회원 예약 요청과 슬롯 잠금을 하나의 트랜잭션으로 처리한다.

검증:

- 승인된 회원만 실행 가능
- `target_pass_id`가 본인 활성 PT권이어야 함
- 잔여횟수가 1회 이상이어야 함
- 정책상 미납 예약이 꺼져 있으면 결제상태가 `paid`여야 함
- 슬롯이 `open` 상태이고 미래 시간이며 정책의 공개 주차 안이어야 함
- 예약 제한은 `remaining_sessions`, `fixed_count`, `unlimited` 정책을 적용함

처리:

- 예약을 `requested`로 생성
- 슬롯을 `held`로 변경
- `locked_until`과 `held_until`을 정책의 요청 만료 시간 기준으로 저장
- 예약 생성 당시 취소/요청 정책 값을 `policy_snapshot`에 저장

### `approve_reservation(target_reservation_id uuid)`

관리자가 요청 예약을 확정한다.

검증:

- 관리자만 실행 가능
- 예약 상태가 `requested`여야 함

처리:

- 예약을 `confirmed`로 변경
- 슬롯을 `confirmed`로 변경
- `held_until`을 비움

### `reject_reservation(target_reservation_id uuid)`

관리자가 요청 예약을 거절한다.

검증:

- 관리자만 실행 가능
- 예약 상태가 `requested`여야 함

처리:

- 예약을 `cancelled`로 변경
- 슬롯을 `open`으로 복구
- `held_until`을 비움

### `request_reservation_cancel(target_reservation_id uuid)`

회원이 본인 예약 취소를 요청한다.

검증:

- 승인된 회원만 실행 가능
- 본인 예약만 실행 가능
- 예약 상태가 `requested` 또는 `confirmed`여야 함

처리:

- 수업 시작이 자동취소 기준 이상 남았으면 예약을 `cancelled`, 슬롯을 `open`으로 처리하고 `auto_cancelled` 반환
- 자동취소 기준 이내면 예약을 `cancel_requested`로 변경하고 정책의 기본 차감값을 `deduct_on_cancel`에 저장한 뒤 `cancel_requested` 반환

### `resolve_late_cancel(target_reservation_id uuid, should_deduct boolean)`

관리자가 24시간 이내 취소요청의 차감 여부를 결정한다.

검증:

- 관리자만 실행 가능
- 예약 상태가 `cancel_requested`여야 함
- 차감 처리 시 잔여횟수가 1회 이상이어야 함

처리:

- `should_deduct=true`이면 `late_cancel_deducted` 이벤트를 기록하고, 이벤트가 새로 삽입된 경우에만 PT권 잔여횟수를 1회 차감
- 예약을 `cancelled`로 변경
- 슬롯을 `open`으로 복구

### `expire_requested_reservations()`

`locked_until`이 지난 예약 요청을 만료 처리한다.

처리:

- `requested` 예약을 `expired`로 변경
- 만료된 `held` 슬롯을 `open`으로 복구

### 결제상태 변경 RPC 또는 관리자 서버 트랜잭션

운영 MVP 완료 전 필수 보강 범위다.

검증:

- 관리자만 실행 가능
- 대상 `payments`와 `pt_passes`가 같은 PT권을 가리켜야 함
- 변경 가능한 상태값은 `unpaid`, `boxpos_requested`, `paid`, `refunded`로 제한함

처리:

- `payments.status`와 `pt_passes.payment_status`를 같은 최종 상태로 변경
- `payment_events`에 변경 전 상태, 변경 후 상태, 변경자, 근거 메모를 기록
- 이미 같은 상태면 기존 결제 id를 반환하고 `payment_events`를 추가하지 않음
- 재시도 시 불일치 상태로 일부 테이블만 변경되면 안 됨

### 연장 요청/승인 RPC

운영 MVP 완료 전 필수 보강 범위다.

검증:

- `request_extension`은 `approved_member_id()`로 승인 회원만 실행 가능
- `request_extension`은 본인의 활성 PT권, 양수 일수, 빈 값이 아닌 사유만 허용
- `approve_extension_request`, `reject_extension_request`는 `is_admin()`으로 관리자만 실행 가능
- 승인/거절 대상 요청 상태가 `requested`여야 함

처리:

- `request_extension`은 `extension_requests.status = requested` row를 생성
- 승인 시 `extension_requests.status`를 `approved`로 변경하고 `decided_by`, `decided_at`을 기록
- 승인 시 `pt_passes.expires_on`을 요청 일수만큼 연장
- 승인 시 `pass_events`에 `extension_added` 이벤트를 `extension_request_id`와 함께 기록
- 같은 `extension_request_id`의 `extension_added` 이벤트가 이미 있으면 만료일을 다시 늘리지 않음
- 거절 시 `reject_extension_request`가 만료일과 `pass_events`는 바꾸지 않고 요청 상태와 처리자만 기록

## 12. RLS 요약

관리자:

- 모든 운영 데이터 관리 가능
- 기준 함수: `is_admin()`

회원:

- 승인된 본인 `member_id` 데이터만 조회 가능
- 예약 생성과 취소 변경은 직접 `insert/update`가 아니라 `request_reservation`, `request_reservation_cancel` RPC만 사용
- 연장 요청 생성은 직접 `insert`가 아니라 `request_extension` RPC만 사용하고 본인 요청만 조회 가능
- 기준 함수: `approved_member_id()`

주의:

- 회원의 직접 `reservations insert/update` 정책은 두지 않는다.
- 회원의 직접 `extension_requests insert/update` 정책은 두지 않는다.
- 결제상태 변경과 연장 승인/거절은 `change_payment_status`, `approve_extension_request`, `reject_extension_request`처럼 권한이 확인되는 서버 경계에서만 처리한다.
- PT권 소유 여부, 슬롯 상태, 예약 개수 제한, 미납 예약 허용 여부, 24시간 취소 기준은 예약 RPC에서 트랜잭션으로 강제한다.

회원이 볼 수 없는 것:

- 다른 회원 정보
- 다른 회원 PT권
- 다른 회원 결제상태
- 다른 회원 예약
- 관리자 설정 수정 권한
