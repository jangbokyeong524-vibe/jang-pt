# 보안 기준

## 0. 현재 적용 상태

- 이 문서는 Supabase 연결 후의 목표 보안 기준이다.
- 현재 화면은 로컬 데모 데이터로 동작하므로 Supabase RLS가 아직 런타임에서 적용되지 않는다.
- 운영 배포 전에는 인증, RLS, 서버 전용 함수, service role key 분리가 실제 코드와 배포 환경에서 검증되어야 한다.

## 1. 기본 원칙

- 회원 개인정보, PT권 상태, 결제상태는 보호 대상 데이터다.
- 회원이 입력한 전화번호는 본인인증 결과가 아니라 회원 매칭 힌트다.
- 회원 데이터 접근 권한은 애플리케이션 필터가 아니라 Supabase RLS에서 강제한다.
- 관리자 권한은 별도 `admin_users` 테이블을 기준으로 판단한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 브라우저에 노출하지 않는다.

## 2. 인증과 회원 연결

- 회원은 Kakao/Google 로그인 후 전화번호를 직접 입력한다.
- 입력 전화번호는 `normalized_phone` 형태로 정규화해 비교한다.
- 회원 연결은 `member_link_requests`에 `pending` 상태로 생성된다.
- 관장이 기존 회원과 매칭해 승인하면 `approved` 상태가 된다.
- 승인 전 회원은 PT권, 결제, 예약 정보를 볼 수 없다.
- 승인된 회원은 본인 `member_id`에 연결된 데이터만 볼 수 있다.

## 3. 관리자 권한

- 관리자 여부는 `admin_users.auth_user_id = auth.uid()` 기준으로 판단한다.
- 관리자 권한을 `members.role` 같은 회원 테이블 값에 의존하지 않는다.
- 최초 관리자 등록은 Supabase SQL Editor에서 수동으로 수행한다.
- 관리자 계정이 바뀌면 `admin_users`를 직접 점검한다.

## 4. Supabase RLS 정책

모든 운영 테이블은 RLS를 켠다.

대상:

- `members`
- `admin_users`
- `member_link_requests`
- `policy_settings`
- `pt_pass_products`
- `pt_passes`
- `pass_events`
- `availability_templates`
- `availability_slots`
- `reservations`
- `payments`
- `payment_events`
- `extension_requests`
- `notifications`

회원 읽기 정책은 `approved_member_id()`를 기준으로 한다.

관리자 정책은 `is_admin()`을 기준으로 한다.

`docs/supabase-schema.sql`은 예약 생성/취소 같은 업무 규칙을 클라이언트 insert/update에 맡기지 않고 RPC로 처리한다. 회원은 본인 예약을 조회할 수 있지만 직접 `reservations`에 insert/update하지 않는다.

예약 RPC가 강제하는 규칙:

- 예약 요청 생성 시 `pass_id`가 본인 PT권인지 확인
- 슬롯이 공개 범위 안의 `open` 상태인지 확인
- 회원 예약 개수 제한과 미납 예약 허용 정책 확인
- 예약 생성, 슬롯 `held` 변경, `locked_until` 저장을 하나의 트랜잭션으로 처리
- 24시간 기준에 따라 회원 직접취소와 취소요청을 분리
- 회원이 마감 시간 이후 예약을 직접 `cancelled`로 바꾸지 못하게 차단

예약 RPC 목록:

- `request_reservation(target_slot_id uuid, target_pass_id uuid)`: 승인 회원의 예약 요청과 슬롯 `held` 처리
- `approve_reservation(target_reservation_id uuid)`: 관리자 예약 승인
- `reject_reservation(target_reservation_id uuid)`: 관리자 예약 거절
- `request_reservation_cancel(target_reservation_id uuid)`: 회원 자동취소 또는 취소요청
- `resolve_late_cancel(target_reservation_id uuid, should_deduct boolean)`: 관리자 24시간 이내 취소 차감/미차감 결정
- `complete_session(target_reservation_id uuid)`: 관리자 수업완료와 차감

결제상태 변경과 연장 승인/거절은 운영 MVP 완료 전까지 예약 RPC와 같은 수준의 관리자 서버 경계로 보강해야 한다. 클라이언트가 직접 여러 테이블을 순서대로 update해서 정합성을 맞추는 구조는 운영 기준으로 인정하지 않는다.

## 5. Service Role Key

`SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회할 수 있다.

금지:

- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`
- 클라이언트 컴포넌트에서 service role key 사용
- 브라우저 콘솔, 로그, README 예시에 실제 key 기록
- Git에 `.env.local` 커밋

허용:

- 서버 전용 API route
- 배치 작업
- 관리자 전용 서버 액션

## 6. 결제상태 보안

- 실제 결제는 BOX POS에서 처리한다.
- 앱은 결제 상태와 이력만 관리한다.
- `paid`, `refunded` 상태 변경은 관리자만 가능해야 한다.
- 결제 상태 변경 시 `payment_events`에 변경 전 상태, 변경 후 상태, 변경자, 메모, 시간을 기록한다.
- 결제 상태 변경은 `payments.status`, `pt_passes.payment_status`, `payment_events`가 하나의 서버 트랜잭션으로 함께 바뀌어야 한다.
- 회원은 결제상태와 결제 이력을 읽을 수 있지만 직접 변경할 수 없다.
- 회원에게는 본인 결제상태만 보여준다.

## 7. 연장 승인 보안

- 회원은 본인 PT권에 대한 연장 요청을 만들고 읽을 수 있다.
- 회원은 `extension_requests.status`, `decided_by`, `decided_at`을 직접 바꿀 수 없다.
- 연장 승인/거절은 관리자만 가능해야 한다.
- 승인 시 `extension_requests.status`, `pt_passes.expires_on`, `pass_events.extension_added`가 하나의 서버 트랜잭션으로 함께 바뀌어야 한다.
- 같은 연장 요청은 한 번만 만료일에 반영되어야 하며, `pass_events.extension_request_id` 기준 중복 이력을 막아야 한다.
- 거절 시 만료일과 `pass_events`를 변경하지 않는다.

## 8. 차감 보안

- 수업완료와 1회 차감은 하나의 DB 트랜잭션으로 처리한다.
- 같은 예약에 대해 중복 차감이 발생하지 않도록 `pass_events_one_completion_per_reservation_idx`를 사용한다.
- `complete_session(target_reservation_id)` 함수는 관리자만 실행 가능해야 한다.
- 예약 상태가 `confirmed`가 아니면 완료 처리하지 않는다.
- 24시간 이내 취소 차감은 `resolve_late_cancel(target_reservation_id, should_deduct)`에서만 처리한다.
- `complete_session`과 `resolve_late_cancel`은 이벤트가 새로 기록된 경우에만 잔여횟수를 줄여야 한다.

## 9. 예약 데이터 노출

- 회원은 열린 슬롯과 본인 예약 슬롯만 볼 수 있어야 한다.
- 다른 회원의 이름, 전화번호, 결제상태, 예약상태는 회원 화면에 노출하지 않는다.
- 관리자 화면에서는 전체 운영 데이터를 볼 수 있다.

## 10. 개인정보 취급

보관 데이터:

- 이름
- 전화번호
- PT권 상태
- 결제상태
- 예약/취소/연장 이력
- 운영 메모

주의:

- 의료 진단명 같은 민감한 건강정보는 상세히 기록하지 않는다.
- 부상/질병 사유는 운영 판단에 필요한 수준으로만 기록한다.
- 예: `무릎 통증으로 7일 연장` 정도는 가능하나, 상세 진단서 내용은 앱에 입력하지 않는다.

## 11. 보안 점검 체크리스트

- `.env.local`이 Git에 포함되지 않았는가
- `SUPABASE_SERVICE_ROLE_KEY`가 브라우저 번들에 포함되지 않았는가
- 모든 운영 테이블에 RLS가 켜져 있는가
- 회원 승인 전 데이터 접근이 차단되는가
- 승인 회원이 다른 회원 데이터를 볼 수 없는가
- 관리자 권한이 `admin_users`로만 판정되는가
- 수업완료 중복 클릭에도 1회만 차감되는가
- 예약 요청/취소가 직접 `reservations insert/update`가 아니라 RPC로만 가능한가
- 결제 상태 변경 이력이 남는가
- 결제상태 변경이 관리자 서버 경계에서만 처리되는가
- 연장 승인/거절이 관리자 서버 경계에서만 처리되는가
- 같은 연장 요청 승인 재시도에도 만료일과 `extension_added` 이력이 중복 반영되지 않는가
