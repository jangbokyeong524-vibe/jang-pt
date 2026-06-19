# DB Refetch After RPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After Supabase reservation RPCs succeed, reload operational tables from the database instead of trusting optimistic local state.

**Architecture:** Keep `lib/reservation-actions.ts` as the mutation RPC adapter. Add `lib/supabase-data.ts` as the read-side adapter that maps Supabase snake_case rows into the existing `AppState` shape. In `components/pt-management-app.tsx`, call one `refreshOperationalData()` helper after reservation RPC success only when Supabase is configured; local demo fallback behavior remains unchanged.

**Tech Stack:** Next.js client component, TypeScript, Supabase JS, static contract scripts, existing local seed fallback.

---

## File Structure

- Create `lib/supabase-data.ts`
  - Fetches `members`, `pt_pass_products`, `policy_settings`, `pt_passes`, `pass_events`, `availability_slots`, `reservations`, `payments`, `payment_events`, and `extension_requests`.
  - Maps database rows into `AppState` fields.
  - Derives `AvailabilitySlot.reservationId` from active reservations because the DB slot table has no `reservation_id` column.
- Modify `components/pt-management-app.tsx`
  - Imports `fetchOperationalDataAction`.
  - Adds `refreshOperationalData()` near existing member-link refresh helpers.
  - Calls `refreshOperationalData()` after `requestReservationAction`, `approveReservationAction`, `rejectReservationAction`, `requestReservationCancelAction`, `resolveLateCancelAction`, and `completeSessionAction` succeed.
- Modify `scripts/check-layout-layering.mjs`
  - Adds static checks that reservation RPC handlers call `refreshOperationalData`.
- Update `STATUS.md`
  - Overwrite current pointer after implementation and verification.

## Scope Boundaries

- Do not add payment status mutation RPCs in this slice.
- Do not add extension approval mutation RPCs in this slice.
- Do not change group-class scheduling behavior.
- Do not remove local demo fallback mutations; they are still required when Supabase env vars are absent.

### Task 1: Static Contract For Refetch Calls

**Files:**
- Modify: `scripts/check-layout-layering.mjs`

- [ ] **Step 1: Add failing static assertions**

Add this block near the other component string assertions:

```js
for (const actionName of [
  "approveReservation",
  "rejectReservation",
  "completeSession",
  "requestBooking",
  "requestCancel",
  "resolveLateCancel"
]) {
  const actionStart = component.indexOf(`async function ${actionName}`);
  const actionEnd = actionStart >= 0 ? component.indexOf("\n  ", component.indexOf("\n  }", actionStart) + 4) : -1;
  const actionBody = actionStart >= 0 && actionEnd > actionStart ? component.slice(actionStart, actionEnd) : "";

  assert(
    actionBody.includes("await refreshOperationalData();"),
    `${actionName} should refresh Supabase operational data after RPC success`
  );
}
```

- [ ] **Step 2: Run the failing check**

Run:

```bash
npm run check:layout
```

Expected: FAIL with messages that the reservation actions should refresh operational data.

### Task 2: Supabase Operational Data Reader

**Files:**
- Create: `lib/supabase-data.ts`

- [ ] **Step 1: Add the reader and mappers**

Create `lib/supabase-data.ts` with these exports:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultPolicies } from "@/lib/seed-data";
import type {
  AppState,
  AvailabilitySlot,
  ExtensionRequest,
  Member,
  PassEvent,
  Payment,
  PaymentEvent,
  PolicySettings,
  PtPass,
  PtPassProduct,
  Reservation
} from "@/lib/types";

type DataClient = Pick<SupabaseClient, "from"> | null;
type Fallback<T> = () => T | Promise<T>;

export type OperationalData = Pick<
  AppState,
  | "members"
  | "passes"
  | "passEvents"
  | "slots"
  | "reservations"
  | "payments"
  | "paymentEvents"
  | "extensionRequests"
  | "policies"
>;

export async function fetchOperationalDataAction({
  supabase,
  fallback
}: {
  supabase: DataClient;
  fallback: Fallback<OperationalData>;
}): Promise<OperationalData> {
  if (!supabase) {
    return fallback();
  }

  const [
    membersResult,
    productsResult,
    policiesResult,
    passesResult,
    passEventsResult,
    slotsResult,
    reservationsResult,
    paymentsResult,
    paymentEventsResult,
    extensionRequestsResult
  ] = await Promise.all([
    supabase.from("members").select("id, name, phone, normalized_phone, status, memo").order("name", { ascending: true }),
    supabase.from("pt_pass_products").select("id, sessions, name, price, default_valid_days, active").order("sessions", { ascending: true }),
    supabase.from("policy_settings").select("settings").eq("active", true).order("created_at", { ascending: false }).limit(1),
    supabase.from("pt_passes").select("id, member_id, product_id, total_sessions, remaining_sessions, price, payment_status, starts_on, expires_on, active, policy_snapshot").order("created_at", { ascending: false }),
    supabase.from("pass_events").select("id, pass_id, member_id, reservation_id, event_type, delta_count, reason, actor_role, created_at").order("created_at", { ascending: false }),
    supabase.from("availability_slots").select("id, start_at, end_at, status, held_until").order("start_at", { ascending: true }),
    supabase.from("reservations").select("id, member_id, pass_id, slot_id, status, requested_at, locked_until, confirmed_at, completed_at, cancelled_at, cancel_reason, deduct_on_cancel, policy_snapshot").order("requested_at", { ascending: false }),
    supabase.from("payments").select("id, member_id, pass_id, amount, status, method, boxpos_reference, memo, updated_at").order("updated_at", { ascending: false }),
    supabase.from("payment_events").select("id, payment_id, from_status, to_status, actor_role, memo, created_at").order("created_at", { ascending: false }),
    supabase.from("extension_requests").select("id, member_id, pass_id, reason, days, status, requested_at, decided_at").order("requested_at", { ascending: false })
  ]);

  for (const result of [
    membersResult,
    productsResult,
    policiesResult,
    passesResult,
    passEventsResult,
    slotsResult,
    reservationsResult,
    paymentsResult,
    paymentEventsResult,
    extensionRequestsResult
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  const reservations = (reservationsResult.data ?? []).map((row) => mapReservation(row as ReservationRow));

  return {
    members: (membersResult.data ?? []).map((row) => mapMember(row as MemberRow)),
    passes: (passesResult.data ?? []).map((row) => mapPass(row as PassRow)),
    passEvents: (passEventsResult.data ?? []).map((row) => mapPassEvent(row as PassEventRow)),
    slots: mapSlotsWithReservations((slotsResult.data ?? []) as SlotRow[], reservations),
    reservations,
    payments: (paymentsResult.data ?? []).map((row) => mapPayment(row as PaymentRow)),
    paymentEvents: (paymentEventsResult.data ?? []).map((row) => mapPaymentEvent(row as PaymentEventRow)),
    extensionRequests: (extensionRequestsResult.data ?? []).map((row) => mapExtensionRequest(row as ExtensionRequestRow)),
    policies: {
      ...(mapPolicySettings((policiesResult.data?.[0] as PolicyRow | undefined)?.settings)),
      passProducts: (productsResult.data ?? []).map((row) => mapProduct(row as ProductRow))
    }
  };
}
```

- [ ] **Step 2: Fill row types and mapper functions**

Use explicit row types and mapping functions in the same file. Each mapper converts snake_case to the existing camelCase app type, and `mapPolicySettings` returns `defaultPolicies` when the active policy row is missing or malformed.

- [ ] **Step 3: Run TypeScript build**

Run:

```bash
npm run build
```

Expected: PASS. If it fails on row type narrowing, fix the mapper types without weakening app types to `any`.

### Task 3: Component Refetch Integration

**Files:**
- Modify: `components/pt-management-app.tsx`

- [ ] **Step 1: Import the data reader**

Add:

```ts
import { fetchOperationalDataAction } from "@/lib/supabase-data";
```

- [ ] **Step 2: Add refresh helper**

Add this helper near `refreshMemberLinkReviewData()`:

```ts
async function refreshOperationalData() {
  if (!supabase) {
    return;
  }

  const operationalData = await fetchOperationalDataAction({
    supabase,
    fallback: () => ({
      members: state.members,
      passes: state.passes,
      passEvents: state.passEvents,
      slots: state.slots,
      reservations: state.reservations,
      payments: state.payments,
      paymentEvents: state.paymentEvents,
      extensionRequests: state.extensionRequests,
      policies: state.policies
    })
  });

  setState((current) => ({
    ...current,
    ...operationalData
  }));

  setSelectedMemberId((currentId) =>
    operationalData.members.some((member) => member.id === currentId)
      ? currentId
      : operationalData.members[0]?.id ?? currentId
  );

  setMemberSessionId((currentId) =>
    operationalData.members.some((member) => member.id === currentId)
      ? currentId
      : operationalData.members[0]?.id ?? currentId
  );
}
```

- [ ] **Step 3: Call helper after reservation RPC success**

After each successful reservation action, before setting the success message, add:

```ts
await refreshOperationalData();
```

Apply it to:

- `approveReservation`
- `rejectReservation`
- `completeSession`
- `requestBooking`
- `requestCancel`
- `resolveLateCancel`

- [ ] **Step 4: Run static check**

Run:

```bash
npm run check:layout
```

Expected: PASS.

### Task 4: Status, Verification, And Commit

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Update status pointer**

Set:

- `phase: db-refetch-after-reservation-rpc`
- Current State includes that reservation RPC success refetches operational DB tables when Supabase is configured.
- Next Actions keeps payment status RPC and extension approval RPC as the next two implementation slices.
- Last Verified lists the commands run for this slice.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run check:layout
npm run build
git diff --check
```

Expected: all PASS.

- [ ] **Step 3: Commit the slice**

Run:

```bash
git add STATUS.md components/pt-management-app.tsx lib/supabase-data.ts scripts/check-layout-layering.mjs docs/superpowers/plans/2026-06-19-db-refetch-after-rpc.md
git commit -m "Wire DB refetch after reservation RPCs"
```

Expected: commit succeeds. Leave unrelated `.AGENTS.md.swp` untracked.

## Self-Review

- Spec coverage: This plan covers the operating MVP requirement from `docs/TEST_PLAN.md` that RPC success reloads member, reservation, PT pass, payment, and history data from DB.
- Placeholder scan: No placeholders remain.
- Type consistency: All mapped output types match `lib/types.ts`; snake_case row types stay local to `lib/supabase-data.ts`.
