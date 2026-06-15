# 데이터 모델

## 1. 개요

이 문서는 `docs/supabase-schema.sql`을 읽기 쉽게 설명한다.

현재 SQL은 예약 요청, 승인, 거절, 취소 요청, 수업완료, 취소 차감처럼 상태가 여러 테이블에 걸쳐 바뀌는 작업을 RPC 중심으로 처리한다. 결제상태 변경과 연장 승인 RPC는 다음 보강 범위다.

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
- `input_phone`: 회원이 입력한 전화번호
- `normalized_phone`: 숫자만 남긴 전화번호
- `status`: `pending`, `approved`, `rejected`
- `approved_by`, `approved_at`: 승인 관리자와 승인 시간

전화번호는 본인인증 결과가 아니라 매칭 힌트다.

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

중복 차감 방지:

- 같은 예약의 `session_completed`, `late_cancel_deducted` 이벤트는 unique index로 중복 삽입을 막는다.

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

승인 시 PT권 만료일을 늘리고 `pass_events`에 `extension_added`를 기록한다.

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

## 12. RLS 요약

관리자:

- 모든 운영 데이터 관리 가능
- 기준 함수: `is_admin()`

회원:

- 승인된 본인 `member_id` 데이터만 조회 가능
- 예약 생성과 취소 변경은 직접 `insert/update`가 아니라 `request_reservation`, `request_reservation_cancel` RPC만 사용
- 본인 연장요청 생성 가능
- 기준 함수: `approved_member_id()`

주의:

- 회원의 직접 `reservations insert/update` 정책은 두지 않는다.
- PT권 소유 여부, 슬롯 상태, 예약 개수 제한, 미납 예약 허용 여부, 24시간 취소 기준은 예약 RPC에서 트랜잭션으로 강제한다.

회원이 볼 수 없는 것:

- 다른 회원 정보
- 다른 회원 PT권
- 다른 회원 결제상태
- 다른 회원 예약
- 관리자 설정 수정 권한
