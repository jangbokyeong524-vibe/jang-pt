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
  PaymentStatus,
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

type MemberRow = {
  id: string;
  name: string;
  phone: string;
  normalized_phone: string;
  status: Member["status"];
  memo: string;
};

type ProductRow = {
  id: string;
  sessions: number;
  name: string;
  price: number;
  default_valid_days: number;
  active: boolean;
};

type PolicyRow = {
  settings: unknown;
};

type PassRow = {
  id: string;
  member_id: string;
  product_id: string | null;
  total_sessions: number;
  remaining_sessions: number;
  price: number;
  payment_status: PaymentStatus;
  starts_on: string;
  expires_on: string;
  active: boolean;
  policy_snapshot: unknown;
};

type PassEventRow = {
  id: string;
  pass_id: string;
  member_id: string;
  reservation_id: string | null;
  event_type: PassEvent["eventType"];
  delta_count: number;
  reason: string;
  actor_role: PassEvent["actor"];
  created_at: string;
};

type SlotRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: AvailabilitySlot["status"];
  held_until: string | null;
};

type ReservationRow = {
  id: string;
  member_id: string;
  pass_id: string;
  slot_id: string;
  status: Reservation["status"];
  requested_at: string;
  locked_until: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  deduct_on_cancel: boolean | null;
  policy_snapshot: unknown;
};

type PaymentRow = {
  id: string;
  member_id: string;
  pass_id: string;
  amount: number;
  status: PaymentStatus;
  method: Payment["method"];
  boxpos_reference: string | null;
  memo: string;
  updated_at: string;
};

type PaymentEventRow = {
  id: string;
  payment_id: string;
  from_status: PaymentStatus;
  to_status: PaymentStatus;
  actor_role: PaymentEvent["actor"];
  memo: string;
  created_at: string;
};

type ExtensionRequestRow = {
  id: string;
  member_id: string;
  pass_id: string;
  reason: string;
  days: number;
  status: ExtensionRequest["status"];
  requested_at: string;
  decided_at: string | null;
};

function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    normalizedPhone: row.normalized_phone,
    status: row.status,
    memo: row.memo
  };
}

function mapProduct(row: ProductRow): PtPassProduct {
  return {
    id: row.id,
    sessions: row.sessions,
    name: row.name,
    price: row.price,
    defaultValidDays: row.default_valid_days,
    active: row.active
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberFromRecord(record: Record<string, unknown>, key: string, fallback: number) {
  return typeof record[key] === "number" ? record[key] : fallback;
}

function stringFromRecord(record: Record<string, unknown>, key: string, fallback: string) {
  return typeof record[key] === "string" ? record[key] : fallback;
}

function booleanFromRecord(record: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof record[key] === "boolean" ? record[key] : fallback;
}

function stringArrayFromRecord(record: Record<string, unknown>, key: string, fallback: string[]) {
  return Array.isArray(record[key]) && record[key].every((item) => typeof item === "string")
    ? record[key]
    : fallback;
}

function bookingLimitFromRecord(
  record: Record<string, unknown>,
  key: string,
  fallback: PolicySettings["booking"]["memberFutureBookingLimit"]
) {
  return record[key] === "remaining_sessions" || record[key] === "fixed_count" || record[key] === "unlimited"
    ? record[key]
    : fallback;
}

function mapPassPolicySnapshot(value: unknown): PtPass["policySnapshot"] {
  const snapshot = asRecord(value);
  const defaultProduct = defaultPolicies.passProducts[0];

  return {
    productName: stringFromRecord(snapshot, "productName", defaultProduct.name),
    productSessions: numberFromRecord(snapshot, "productSessions", defaultProduct.sessions),
    productPrice: numberFromRecord(snapshot, "productPrice", defaultProduct.price),
    defaultValidDays: numberFromRecord(snapshot, "defaultValidDays", defaultProduct.defaultValidDays),
    createdWithSettingsSummary: stringFromRecord(snapshot, "createdWithSettingsSummary", "")
  };
}

function mapReservationPolicySnapshot(value: unknown): Reservation["policySnapshot"] {
  const snapshot = asRecord(value);

  return {
    requestExpiryHours: numberFromRecord(snapshot, "requestExpiryHours", defaultPolicies.booking.requestExpiryHours),
    autoCancelHoursBeforeSession: numberFromRecord(
      snapshot,
      "autoCancelHoursBeforeSession",
      defaultPolicies.cancellation.autoCancelHoursBeforeSession
    ),
    lateCancelDefaultDeduct:
      typeof snapshot.lateCancelDefaultDeduct === "boolean"
        ? snapshot.lateCancelDefaultDeduct
        : defaultPolicies.cancellation.lateCancelDefaultDeduct
  };
}

function mapPolicySettings(value: unknown): PolicySettings {
  const settings = asRecord(value);
  const booking = asRecord(settings.booking);
  const cancellation = asRecord(settings.cancellation);
  const extension = asRecord(settings.extension);
  const renewal = asRecord(settings.renewal);
  const copyTemplates = asRecord(settings.copyTemplates);

  return {
    ...defaultPolicies,
    booking: {
      publishWeeks: numberFromRecord(booking, "publishWeeks", defaultPolicies.booking.publishWeeks),
      requestExpiryHours: numberFromRecord(booking, "requestExpiryHours", defaultPolicies.booking.requestExpiryHours),
      memberFutureBookingLimit: bookingLimitFromRecord(
        booking,
        "memberFutureBookingLimit",
        defaultPolicies.booking.memberFutureBookingLimit
      ),
      fixedFutureBookingLimit: numberFromRecord(
        booking,
        "fixedFutureBookingLimit",
        defaultPolicies.booking.fixedFutureBookingLimit
      ),
      allowUnpaidBooking: booleanFromRecord(booking, "allowUnpaidBooking", defaultPolicies.booking.allowUnpaidBooking)
    },
    cancellation: {
      autoCancelHoursBeforeSession: numberFromRecord(
        cancellation,
        "autoCancelHoursBeforeSession",
        defaultPolicies.cancellation.autoCancelHoursBeforeSession
      ),
      lateCancelDefaultDeduct: booleanFromRecord(
        cancellation,
        "lateCancelDefaultDeduct",
        defaultPolicies.cancellation.lateCancelDefaultDeduct
      ),
      exceptionReasons: stringArrayFromRecord(
        cancellation,
        "exceptionReasons",
        defaultPolicies.cancellation.exceptionReasons
      )
    },
    extension: {
      memberRequestEnabled: booleanFromRecord(
        extension,
        "memberRequestEnabled",
        defaultPolicies.extension.memberRequestEnabled
      ),
      defaultReasons: stringArrayFromRecord(extension, "defaultReasons", defaultPolicies.extension.defaultReasons)
    },
    renewal: {
      remainingSessionsThreshold: numberFromRecord(
        renewal,
        "remainingSessionsThreshold",
        defaultPolicies.renewal.remainingSessionsThreshold
      ),
      daysBeforeExpiryThreshold: numberFromRecord(
        renewal,
        "daysBeforeExpiryThreshold",
        defaultPolicies.renewal.daysBeforeExpiryThreshold
      ),
      showToMember: booleanFromRecord(renewal, "showToMember", defaultPolicies.renewal.showToMember)
    },
    copyTemplates: {
      bookingApproved: stringFromRecord(copyTemplates, "bookingApproved", defaultPolicies.copyTemplates.bookingApproved),
      paymentRequested: stringFromRecord(copyTemplates, "paymentRequested", defaultPolicies.copyTemplates.paymentRequested),
      renewalNudge: stringFromRecord(copyTemplates, "renewalNudge", defaultPolicies.copyTemplates.renewalNudge)
    }
  };
}

function mapPass(row: PassRow): PtPass {
  return {
    id: row.id,
    memberId: row.member_id,
    productId: row.product_id ?? "",
    totalSessions: row.total_sessions,
    remainingSessions: row.remaining_sessions,
    price: row.price,
    paymentStatus: row.payment_status,
    startsOn: row.starts_on,
    expiresOn: row.expires_on,
    active: row.active,
    policySnapshot: mapPassPolicySnapshot(row.policy_snapshot)
  };
}

function mapPassEvent(row: PassEventRow): PassEvent {
  return {
    id: row.id,
    passId: row.pass_id,
    memberId: row.member_id,
    reservationId: row.reservation_id ?? undefined,
    eventType: row.event_type,
    deltaCount: row.delta_count,
    reason: row.reason,
    actor: row.actor_role,
    createdAt: row.created_at
  };
}

function mapReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    memberId: row.member_id,
    passId: row.pass_id,
    slotId: row.slot_id,
    status: row.status,
    requestedAt: row.requested_at,
    lockedUntil: row.locked_until ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
    deductOnCancel: row.deduct_on_cancel ?? undefined,
    policySnapshot: mapReservationPolicySnapshot(row.policy_snapshot)
  };
}

function mapSlotsWithReservations(rows: SlotRow[], reservations: Reservation[]): AvailabilitySlot[] {
  const activeReservationsBySlotId = new Map(
    reservations
      .filter((reservation) => ["requested", "confirmed", "cancel_requested"].includes(reservation.status))
      .map((reservation) => [reservation.slotId, reservation])
  );

  return rows.map((row) => {
    const reservation = activeReservationsBySlotId.get(row.id);

    return {
      id: row.id,
      startAt: row.start_at,
      endAt: row.end_at,
      status: row.status,
      heldUntil: row.held_until ?? undefined,
      reservationId: reservation?.id
    };
  });
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    memberId: row.member_id,
    passId: row.pass_id,
    amount: row.amount,
    status: row.status,
    method: row.method,
    boxposReference: row.boxpos_reference ?? undefined,
    memo: row.memo,
    updatedAt: row.updated_at
  };
}

function mapPaymentEvent(row: PaymentEventRow): PaymentEvent {
  return {
    id: row.id,
    paymentId: row.payment_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actor: row.actor_role,
    memo: row.memo,
    createdAt: row.created_at
  };
}

function mapExtensionRequest(row: ExtensionRequestRow): ExtensionRequest {
  return {
    id: row.id,
    memberId: row.member_id,
    passId: row.pass_id,
    reason: row.reason,
    days: row.days,
    status: row.status,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at ?? undefined
  };
}

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
  const activePolicy = mapPolicySettings((policiesResult.data?.[0] as PolicyRow | undefined)?.settings);
  const passProducts = (productsResult.data ?? []).map((row) => mapProduct(row as ProductRow));

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
      ...activePolicy,
      passProducts: passProducts.length > 0 ? passProducts : defaultPolicies.passProducts
    }
  };
}
