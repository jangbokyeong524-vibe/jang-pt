# PT Operations MVP Slices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the PT booking MVP from a local-demo operational UI to a Supabase-backed system that can be used for real PT booking, pass, payment, and extension workflows.

**Architecture:** Keep the existing local-demo fallback pattern, but route every operational mutation that matters for money, pass balance, or member privacy through Supabase RPC/server boundaries. Each slice must add a contract check first, then the schema/RPC, then a thin TypeScript action adapter, then UI wiring, then live-data refetch and docs.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Auth/DB/RLS/RPC, existing static contract scripts under `scripts/`.

---

## Scope And Slice Order

The MVP is not production-usable until Slices 1-5 are complete and verified against a real Supabase project.

1. Slice 1: PT pass creation RPC and UI wiring.
2. Slice 2: Payment status change RPC and audit events.
3. Slice 3: Extension request creation plus approve/reject RPC.
4. Slice 4: Reservation RPC live DB verification and any missing refetch gaps.
5. Slice 5: Member-link and RLS real-account verification.
6. Slice 6: Operational rehearsal with the gym workflow.

Commit after each slice. Do not bundle slices into one commit.

## File Map

- `docs/supabase-schema.sql`: Source of truth for Supabase tables, RLS, RPCs, grants, and idempotent schema changes.
- `lib/pass-actions.ts`: New thin client-side adapter for creating PT passes through Supabase RPC with local fallback.
- `lib/payment-actions.ts`: New thin client-side adapter for payment state RPC calls with local fallback.
- `lib/extension-actions.ts`: New thin client-side adapter for extension request and decision RPC calls with local fallback.
- `lib/reservation-actions.ts`: Existing reservation RPC adapter. Use this as the model for new action adapters.
- `lib/supabase-data.ts`: Existing read/refetch mapping from Supabase rows to app state.
- `components/pt-management-app.tsx`: Existing UI state owner. Replace local-only mutations slice-by-slice with action adapters plus `refreshOperationalData()`.
- `scripts/check-supabase-rpc.mjs`: Existing reservation RPC contract. Extend or split when adding pass/payment/extension RPC contracts.
- `docs/TEST_PLAN.md`: Operational acceptance criteria. Update when a slice changes actual MVP readiness.
- `docs/SECURITY.md`: Security/RLS boundary documentation. Update when a slice adds server-side authority.
- `STATUS.md`: Short pointer to current state and next action.

---

## Slice 1: PT Pass Creation RPC

**Goal:** When an admin registers a PT pass, the pass, payment row, and initial pass event are written in one Supabase transaction and the UI refetches live data.

**Files:**
- Modify: `docs/supabase-schema.sql`
- Create: `lib/pass-actions.ts`
- Modify: `components/pt-management-app.tsx`
- Modify: `scripts/check-supabase-rpc.mjs`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/SECURITY.md`
- Modify: `STATUS.md`

### Task 1.1: Add Failing Contract For PT Pass Creation RPC

- [ ] **Step 1: Extend the RPC contract script**

Modify `scripts/check-supabase-rpc.mjs` by adding a `create_pt_pass` contract after the existing reservation RPC checks.

```js
const passRpcNames = ["create_pt_pass"];

for (const rpcName of passRpcNames) {
  const functionPattern = new RegExp(`create or replace function public\\.${rpcName}\\s*\\(`, "i");
  assert(functionPattern.test(schema), `${rpcName} RPC should be defined in Supabase schema`);
}

for (const adminRpcName of passRpcNames) {
  const bodyMatch = schema.match(
    new RegExp(`create or replace function public\\.${adminRpcName}[\\s\\S]*?\\n\\$\\$;`, "i")
  );

  assert(bodyMatch?.[0].includes("security definer"), `${adminRpcName} should be security definer`);
  assert(bodyMatch?.[0].includes("public.is_admin()"), `${adminRpcName} should guard admin access`);
  assert(bodyMatch?.[0].includes("public.pt_passes"), `${adminRpcName} should insert a PT pass`);
  assert(bodyMatch?.[0].includes("public.payments"), `${adminRpcName} should create the initial payment row`);
  assert(bodyMatch?.[0].includes("public.pass_events"), `${adminRpcName} should create the initial pass event`);
}

assert(
  schema.includes("grant execute on function public.create_pt_pass"),
  "create_pt_pass should be executable through explicit grants"
);
```

- [ ] **Step 2: Run the failing contract**

Run:

```bash
npm run check:layout
```

Expected: FAIL with `create_pt_pass RPC should be defined in Supabase schema`.

### Task 1.2: Add `create_pt_pass` To Supabase Schema

- [ ] **Step 1: Add the RPC to `docs/supabase-schema.sql`**

Place this after the existing helper functions and before RLS policy definitions.

```sql
create or replace function public.create_pt_pass(target_member_id uuid, target_product_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_product public.pt_pass_products%rowtype;
  new_pass_id uuid;
  new_payment_id uuid;
  today date := current_date;
  policy_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select *
  into selected_product
  from public.pt_pass_products
  where id = target_product_id
    and active = true;

  if not found then
    raise exception 'active product not found';
  end if;

  if not exists (select 1 from public.members where id = target_member_id) then
    raise exception 'member not found';
  end if;

  policy_snapshot := jsonb_build_object(
    'productName', selected_product.name,
    'productSessions', selected_product.sessions,
    'productPrice', selected_product.price,
    'defaultValidDays', selected_product.default_valid_days,
    'createdWithSettingsSummary', selected_product.name || ' ' || selected_product.default_valid_days || '일'
  );

  insert into public.pt_passes (
    member_id,
    product_id,
    total_sessions,
    remaining_sessions,
    price,
    payment_status,
    starts_on,
    expires_on,
    active,
    policy_snapshot
  )
  values (
    target_member_id,
    target_product_id,
    selected_product.sessions,
    selected_product.sessions,
    selected_product.price,
    'unpaid',
    today,
    today + selected_product.default_valid_days,
    true,
    policy_snapshot
  )
  returning id into new_pass_id;

  insert into public.payments (
    member_id,
    pass_id,
    amount,
    status,
    method,
    memo
  )
  values (
    target_member_id,
    new_pass_id,
    selected_product.price,
    'unpaid',
    'boxpos',
    '신규 PT권 미납'
  )
  returning id into new_payment_id;

  insert into public.pass_events (
    pass_id,
    member_id,
    event_type,
    delta_count,
    reason,
    actor_auth_user_id,
    actor_role
  )
  values (
    new_pass_id,
    target_member_id,
    'pass_created',
    selected_product.sessions,
    'PT권 등록',
    auth.uid(),
    'admin'
  );

  return new_pass_id;
end;
$$;

grant execute on function public.create_pt_pass(uuid, uuid) to authenticated;
```

- [ ] **Step 2: Run contract**

Run:

```bash
npm run check:layout
```

Expected: PASS for the new `create_pt_pass` schema checks. If it fails on a regex, fix the schema or contract without weakening the admin/security checks.

### Task 1.3: Add The Pass Action Adapter

- [ ] **Step 1: Create `lib/pass-actions.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

type RpcClient = Pick<SupabaseClient, "rpc"> | null;
type Fallback<T> = () => T | Promise<T>;

export const passRpcNames = {
  createPtPass: "create_pt_pass"
} as const;

export async function createPtPassAction({
  supabase,
  targetMemberId,
  targetProductId,
  fallback
}: {
  supabase: RpcClient;
  targetMemberId: string;
  targetProductId: string;
  fallback: Fallback<string>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { data, error } = await supabase.rpc(passRpcNames.createPtPass, {
    target_member_id: targetMemberId,
    target_product_id: targetProductId
  });

  if (error) {
    throw error;
  }

  return String(data);
}
```

- [ ] **Step 2: Extend contract**

Modify `scripts/check-supabase-rpc.mjs` to read the new adapter and assert the RPC name is represented.

```js
const passAdapter = readFileSync("lib/pass-actions.ts", "utf8");

for (const rpcName of passRpcNames) {
  assert(passAdapter.includes(`"${rpcName}"`), `${rpcName} RPC should be represented in the pass action adapter`);
}
```

- [ ] **Step 3: Run check**

Run:

```bash
npm run check:layout
```

Expected: PASS.

### Task 1.4: Wire The Admin PT Pass UI To The Adapter

- [ ] **Step 1: Import the adapter**

Modify `components/pt-management-app.tsx`.

```ts
import { createPtPassAction } from "@/lib/pass-actions";
```

- [ ] **Step 2: Replace local-only `addPass` with async adapter call**

Replace the current `function addPass(memberId: string, productId: string)` with this shape. Preserve the existing local fallback body inside `fallback`.

```ts
async function addPass(memberId: string, productId: string) {
  const product = state.policies.passProducts.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  try {
    await createPtPassAction({
      supabase,
      targetMemberId: memberId,
      targetProductId: productId,
      fallback: () => {
        const passId = makeId("pass");
        const paymentId = makeId("payment");
        const startsOn = new Date().toISOString().slice(0, 10);
        const expiresOn = addDays(new Date(), product.defaultValidDays).toISOString().slice(0, 10);

        setState((current) => ({
          ...current,
          passes: [
            {
              id: passId,
              memberId,
              productId: product.id,
              totalSessions: product.sessions,
              remainingSessions: product.sessions,
              price: product.price,
              paymentStatus: "unpaid",
              startsOn,
              expiresOn,
              active: true,
              policySnapshot: {
                productName: product.name,
                productSessions: product.sessions,
                productPrice: product.price,
                defaultValidDays: product.defaultValidDays,
                createdWithSettingsSummary: `${product.name} ${product.defaultValidDays}일, 요청만료 ${current.policies.booking.requestExpiryHours}시간`
              }
            },
            ...current.passes
          ],
          payments: [
            {
              id: paymentId,
              memberId,
              passId,
              amount: product.price,
              status: "unpaid",
              method: "boxpos",
              memo: "신규 PT권 미납",
              updatedAt: new Date().toISOString()
            },
            ...current.payments
          ],
          passEvents: [
            {
              id: makeId("event"),
              passId,
              memberId,
              eventType: "pass_created",
              deltaCount: product.sessions,
              reason: "PT권 등록",
              actor: "admin",
              createdAt: new Date().toISOString()
            },
            ...current.passEvents
          ]
        }));

        return passId;
      }
    });

    await refreshOperationalData();
    setMessage("PT권을 등록했습니다.");
  } catch {
    setMessage("PT권 등록에 실패했습니다.");
  }
}
```

- [ ] **Step 3: Update any call sites if TypeScript requires `void addPass(...)`**

Search:

```bash
rg -n "addPass\\(" components/pt-management-app.tsx
```

If a React event handler calls `addPass(...)` directly, use:

```tsx
onClick={() => void addPass(member.id, selectedProductId)}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

### Task 1.5: Update Docs And Status For Slice 1

- [ ] **Step 1: Update `docs/TEST_PLAN.md`**

In the operational MVP criteria, add this bullet after the member-link/RLS criteria:

```md
- PT권 등록은 관리자 RPC 또는 동등한 서버 경계로 처리되고 `pt_passes`, `payments`, `pass_events`가 함께 생성된다.
```

- [ ] **Step 2: Update `docs/SECURITY.md`**

Add a short section before payment security:

```md
## PT권 등록 보안

- PT권 등록은 관리자만 가능하다.
- 등록 시 `pt_passes`, 초기 `payments`, `pass_events.pass_created`가 하나의 서버 트랜잭션으로 생성되어야 한다.
- 회원은 본인 PT권을 읽을 수 있지만 직접 생성하거나 다른 회원 PT권을 볼 수 없다.
```

- [ ] **Step 3: Update `STATUS.md`**

Add current state:

```md
- PT권 등록 is planned as the next operational DB boundary: `create_pt_pass` should create `pt_passes`, `payments`, and `pass_events` together.
```

After implementation, replace it with:

```md
- PT권 등록 uses `create_pt_pass` when Supabase is configured and keeps the existing local fallback when Supabase env is missing.
```

### Task 1.6: Verify And Commit Slice 1

- [ ] **Step 1: Run final checks**

Run:

```bash
npm run check:layout
npm run build
git diff --check
```

Expected:

- `Layout layering check passed.`
- `Supabase reservation RPC check passed.`
- `Auth contract check passed.`
- Next build exits 0.
- `git diff --check` exits 0.

- [ ] **Step 2: Commit**

Run:

```bash
git status --short --branch
git add docs/supabase-schema.sql lib/pass-actions.ts components/pt-management-app.tsx scripts/check-supabase-rpc.mjs docs/TEST_PLAN.md docs/SECURITY.md STATUS.md
git commit -m "Add Supabase PT pass creation boundary"
```

Expected: one commit containing only Slice 1 files.

---

## Slice 2: Payment Status Change RPC

**Goal:** Replace local-only payment state changes with a Supabase transaction that updates `payments`, `pt_passes`, and `payment_events`.

**Files:**
- Modify: `docs/supabase-schema.sql`
- Create: `lib/payment-actions.ts`
- Modify: `components/pt-management-app.tsx`
- Modify: `scripts/check-supabase-rpc.mjs`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/SECURITY.md`
- Modify: `STATUS.md`

### Task 2.1: Add Failing Contract

- [ ] **Step 1: Add `change_payment_status` checks to `scripts/check-supabase-rpc.mjs`**

```js
const paymentRpcNames = ["change_payment_status"];

for (const rpcName of paymentRpcNames) {
  const functionPattern = new RegExp(`create or replace function public\\.${rpcName}\\s*\\(`, "i");
  assert(functionPattern.test(schema), `${rpcName} RPC should be defined in Supabase schema`);
  const bodyMatch = schema.match(
    new RegExp(`create or replace function public\\.${rpcName}[\\s\\S]*?\\n\\$\\$;`, "i")
  );
  assert(bodyMatch?.[0].includes("security definer"), `${rpcName} should be security definer`);
  assert(bodyMatch?.[0].includes("public.is_admin()"), `${rpcName} should guard admin access`);
  assert(bodyMatch?.[0].includes("public.payments"), `${rpcName} should update payments`);
  assert(bodyMatch?.[0].includes("public.pt_passes"), `${rpcName} should update pt_passes`);
  assert(bodyMatch?.[0].includes("public.payment_events"), `${rpcName} should insert payment_events`);
}
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm run check:layout
```

Expected: FAIL for missing `change_payment_status`.

### Task 2.2: Implement Payment RPC And Adapter

- [ ] **Step 1: Add `change_payment_status` to `docs/supabase-schema.sql`**

Use this behavior:

```sql
-- Signature:
-- public.change_payment_status(target_pass_id uuid, next_status text, change_memo text default '')
```

The RPC must:

- Check `public.is_admin()`.
- Lock the payment row for `target_pass_id`.
- Check `next_status in ('unpaid', 'boxpos_requested', 'paid', 'refunded')`.
- Update `public.payments.status`, `public.payments.updated_at`, and `public.pt_passes.payment_status`.
- Insert `public.payment_events` with `from_status`, `to_status`, `auth.uid()`, `admin`, and memo.
- Return the payment id.

- [ ] **Step 2: Create `lib/payment-actions.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentStatus } from "@/lib/types";

type RpcClient = Pick<SupabaseClient, "rpc"> | null;
type Fallback<T> = () => T | Promise<T>;

export const paymentRpcNames = {
  changePaymentStatus: "change_payment_status"
} as const;

export async function changePaymentStatusAction({
  supabase,
  targetPassId,
  nextStatus,
  memo,
  fallback
}: {
  supabase: RpcClient;
  targetPassId: string;
  nextStatus: PaymentStatus;
  memo: string;
  fallback: Fallback<void>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { error } = await supabase.rpc(paymentRpcNames.changePaymentStatus, {
    target_pass_id: targetPassId,
    next_status: nextStatus,
    change_memo: memo
  });

  if (error) {
    throw error;
  }
}
```

- [ ] **Step 3: Wire UI**

Convert `changePaymentStatus` in `components/pt-management-app.tsx` to `async`, call `changePaymentStatusAction`, keep existing `setState` body in fallback, then `await refreshOperationalData()`.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm run check:layout
npm run build
git diff --check
git add docs/supabase-schema.sql lib/payment-actions.ts components/pt-management-app.tsx scripts/check-supabase-rpc.mjs docs/TEST_PLAN.md docs/SECURITY.md STATUS.md
git commit -m "Add Supabase payment status boundary"
```

---

## Slice 3: Extension Request And Decision RPCs

**Goal:** Make member extension requests and admin approval/rejection durable and idempotent.

**Files:**
- Modify: `docs/supabase-schema.sql`
- Create: `lib/extension-actions.ts`
- Modify: `components/pt-management-app.tsx`
- Modify: `scripts/check-supabase-rpc.mjs`
- Modify: `docs/DATA_MODEL.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/SECURITY.md`
- Modify: `STATUS.md`

### Task 3.1: Add Failing Contracts

- [ ] **Step 1: Add RPC checks**

Add checks for:

```js
const extensionRpcNames = [
  "request_extension",
  "approve_extension_request",
  "reject_extension_request"
];
```

Expected requirements:

- `request_extension` uses `public.approved_member_id()`.
- `approve_extension_request` and `reject_extension_request` use `public.is_admin()`.
- approval touches `extension_requests`, `pt_passes`, and `pass_events`.
- approval references `extension_request_id`.

- [ ] **Step 2: Run RED**

Run:

```bash
npm run check:layout
```

Expected: FAIL for missing extension RPCs.

### Task 3.2: Implement Extension RPCs And Adapter

- [ ] **Step 1: Add SQL functions**

Implement:

```sql
public.request_extension(target_pass_id uuid, request_reason text, request_days integer)
public.approve_extension_request(target_request_id uuid)
public.reject_extension_request(target_request_id uuid)
```

Behavior:

- Member request verifies `target_pass_id` belongs to `public.approved_member_id()`.
- Approval locks the request, checks status is `requested`, updates status to `approved`, extends `pt_passes.expires_on`, and inserts `pass_events.extension_added` with `extension_request_id`.
- Approval must not extend twice when `pass_events_one_extension_per_request_idx` already has an event.
- Rejection updates only request decision fields.

- [ ] **Step 2: Create `lib/extension-actions.ts`**

Expose:

```ts
requestExtensionAction(...)
approveExtensionRequestAction(...)
rejectExtensionRequestAction(...)
```

Use the same `supabase ? rpc : fallback` shape as `lib/reservation-actions.ts`.

- [ ] **Step 3: Wire UI**

Replace local-only `approveExtension` in `components/pt-management-app.tsx` with `approveExtensionRequestAction`, retain local fallback, then `await refreshOperationalData()`.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm run check:layout
npm run build
git diff --check
git add docs/supabase-schema.sql lib/extension-actions.ts components/pt-management-app.tsx scripts/check-supabase-rpc.mjs docs/DATA_MODEL.md docs/TEST_PLAN.md docs/SECURITY.md STATUS.md
git commit -m "Add Supabase extension decision boundary"
```

---

## Slice 4: Reservation Live DB Verification

**Goal:** Prove existing reservation RPC flows work end-to-end against a real Supabase project and fix any refetch or RLS gaps.

**Files:**
- Modify as needed: `lib/reservation-actions.ts`
- Modify as needed: `lib/supabase-data.ts`
- Modify as needed: `components/pt-management-app.tsx`
- Modify as needed: `docs/supabase-schema.sql`
- Modify: `docs/TEST_PLAN.md`
- Modify: `STATUS.md`

### Task 4.1: Run The Real Reservation Scenario

- [ ] **Step 1: Prepare two accounts**

Use:

- Admin Google account in allowlist.
- Non-admin Google account for a member.

- [ ] **Step 2: Apply latest schema to Supabase**

Run the full `docs/supabase-schema.sql` in Supabase SQL Editor.

Expected:

- No missing-policy errors.
- No duplicate-policy errors.
- Existing tables/functions remain valid.

- [ ] **Step 3: Test scenario**

Execute:

1. Member requests a slot.
2. Admin approves it.
3. Member requests cancellation.
4. Admin resolves late cancel with deduction.
5. Admin completes a separate confirmed session.

Expected:

- UI refetches after every RPC.
- Slot status and reservation status match DB.
- `pass_events_one_completion_per_reservation_idx` prevents duplicate deductions.

- [ ] **Step 4: Commit fixes only if code changes**

Run:

```bash
npm run check:layout
npm run build
git diff --check
git add lib/reservation-actions.ts lib/supabase-data.ts components/pt-management-app.tsx docs/supabase-schema.sql docs/TEST_PLAN.md STATUS.md
git commit -m "Verify Supabase reservation operations"
```

---

## Slice 5: Member-Link And RLS Verification

**Goal:** Confirm approved members can only see their own PT/pass/payment/reservation data and pending members see no operational data.

**Files:**
- Modify as needed: `lib/member-link-actions.ts`
- Modify as needed: `lib/supabase-data.ts`
- Modify as needed: `docs/supabase-schema.sql`
- Modify: `docs/SECURITY.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `STATUS.md`

### Task 5.1: Run Real-Account RLS Tests

- [ ] **Step 1: Pending member test**

Log in as non-admin account before approval.

Expected:

- The user reaches member-link request UI.
- No PT pass, payment, reservation, or other member data is visible.

- [ ] **Step 2: Approval test**

Approve that account as an existing member.

Expected:

- `member_link_requests.status = approved`.
- `approved_member_id()` returns the expected member id.
- UI shows only that member's data.

- [ ] **Step 3: Cross-member access test**

Use browser devtools or Supabase client calls to try reading another member's rows.

Expected:

- RLS blocks rows for other members.

- [ ] **Step 4: Commit fixes only if code changes**

Run:

```bash
npm run check:layout
npm run build
git diff --check
git add lib/member-link-actions.ts lib/supabase-data.ts docs/supabase-schema.sql docs/SECURITY.md docs/TEST_PLAN.md STATUS.md
git commit -m "Verify member link RLS boundaries"
```

---

## Slice 6: Operational Rehearsal

**Goal:** Run one complete gym workflow while keeping the previous operational record as backup.

**Files:**
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify as needed: UI copy files in `components/pt-management-app.tsx`
- Modify: `STATUS.md`

### Task 6.1: Rehearsal Checklist

- [ ] **Step 1: Run the workflow**

Use a real or staged member:

1. Register PT pass.
2. Set payment to `boxpos_requested`.
3. Set payment to `paid`.
4. Member requests reservation.
5. Admin approves reservation.
6. Admin completes session and verifies remaining count.
7. Member requests extension.
8. Admin approves extension.
9. Log out and log back in as both users.

Expected:

- Every state survives refresh.
- Member sees only own data.
- Admin sees processing queue.
- Existing non-app operational record can be reconciled with app state.

- [ ] **Step 2: Update operating docs**

In `docs/OPERATIONS.md`, record exact operator sequence for:

- PT pass creation.
- BOX POS payment status.
- Reservation approval.
- Session completion.
- Extension approval.

- [ ] **Step 3: Commit**

Run:

```bash
npm run check:layout
npm run build
git diff --check
git add docs/OPERATIONS.md docs/TEST_PLAN.md components/pt-management-app.tsx STATUS.md
git commit -m "Document PT operations rehearsal"
```

---

## Final MVP Gate

After Slices 1-6:

Run:

```bash
git status --short --branch
npm run check:layout
npm run build
git diff --check
```

Manual gate:

- Admin account can operate PT pass, payment, reservation, cancellation, session completion, and extension workflows.
- Member account can request reservations and extensions.
- Pending member sees no operational data.
- Approved member sees only own operational data.
- Refresh and re-login preserve all operational state.
- Existing gym record can be reconciled with app record after one rehearsal day.

Only after this gate should the app be treated as usable for real PT booking operations.
