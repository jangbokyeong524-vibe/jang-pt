export type ViewMode = "admin" | "member";

export type MemberStatus = "active" | "paused" | "archived";

export type LinkStatus = "pending" | "approved" | "rejected";

export type SlotStatus = "open" | "held" | "confirmed" | "blocked";

export type ReservationStatus =
  | "requested"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "cancel_requested"
  | "no_show"
  | "expired";

export type PaymentStatus =
  | "unpaid"
  | "boxpos_requested"
  | "paid"
  | "refunded";

export type ExtensionStatus = "requested" | "approved" | "rejected";

export type PolicySettings = {
  passProducts: PtPassProduct[];
  booking: {
    publishWeeks: number;
    requestExpiryHours: number;
    memberFutureBookingLimit: "remaining_sessions" | "fixed_count" | "unlimited";
    fixedFutureBookingLimit: number;
    allowUnpaidBooking: boolean;
  };
  cancellation: {
    autoCancelHoursBeforeSession: number;
    lateCancelDefaultDeduct: boolean;
    exceptionReasons: string[];
  };
  extension: {
    memberRequestEnabled: boolean;
    defaultReasons: string[];
  };
  renewal: {
    remainingSessionsThreshold: number;
    daysBeforeExpiryThreshold: number;
    showToMember: boolean;
  };
  copyTemplates: {
    bookingApproved: string;
    paymentRequested: string;
    renewalNudge: string;
  };
};

export type PtPassProduct = {
  id: string;
  sessions: number;
  name: string;
  price: number;
  defaultValidDays: number;
  active: boolean;
};

export type Member = {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  status: MemberStatus;
  memo: string;
};

export type MemberLinkRequest = {
  id: string;
  authUserId?: string;
  memberId: string | null;
  authProvider: "kakao" | "google";
  displayName: string;
  inputPhone: string;
  normalizedPhone: string;
  status: LinkStatus;
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
};

export type PtPass = {
  id: string;
  memberId: string;
  productId: string;
  totalSessions: number;
  remainingSessions: number;
  price: number;
  paymentStatus: PaymentStatus;
  startsOn: string;
  expiresOn: string;
  active: boolean;
  policySnapshot: {
    productName: string;
    productSessions: number;
    productPrice: number;
    defaultValidDays: number;
    createdWithSettingsSummary: string;
  };
};

export type PassEvent = {
  id: string;
  passId: string;
  memberId: string;
  reservationId?: string;
  extensionRequestId?: string;
  eventType:
    | "pass_created"
    | "session_completed"
    | "late_cancel_deducted"
    | "exception_restored"
    | "refund_adjusted"
    | "extension_added";
  deltaCount: number;
  reason: string;
  actor: "admin" | "member" | "system";
  createdAt: string;
};

export type AvailabilitySlot = {
  id: string;
  startAt: string;
  endAt: string;
  status: SlotStatus;
  heldUntil?: string;
  reservationId?: string;
};

export type Reservation = {
  id: string;
  memberId: string;
  passId: string;
  slotId: string;
  status: ReservationStatus;
  requestedAt: string;
  lockedUntil?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  deductOnCancel?: boolean;
  policySnapshot: {
    requestExpiryHours: number;
    autoCancelHoursBeforeSession: number;
    lateCancelDefaultDeduct: boolean;
  };
};

export type Payment = {
  id: string;
  memberId: string;
  passId: string;
  amount: number;
  status: PaymentStatus;
  method: "cash" | "card" | "boxpos" | "refund";
  boxposReference?: string;
  memo: string;
  updatedAt: string;
};

export type PaymentEvent = {
  id: string;
  paymentId: string;
  fromStatus: PaymentStatus;
  toStatus: PaymentStatus;
  actor: "admin" | "system";
  memo: string;
  createdAt: string;
};

export type ExtensionRequest = {
  id: string;
  memberId: string;
  passId: string;
  reason: string;
  days: number;
  status: ExtensionStatus;
  requestedAt: string;
  decidedAt?: string;
};

export type NotificationItem = {
  id: string;
  memberId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type AppState = {
  members: Member[];
  memberLinkRequests: MemberLinkRequest[];
  passes: PtPass[];
  passEvents: PassEvent[];
  slots: AvailabilitySlot[];
  reservations: Reservation[];
  payments: Payment[];
  paymentEvents: PaymentEvent[];
  extensionRequests: ExtensionRequest[];
  notifications: NotificationItem[];
  policies: PolicySettings;
};
