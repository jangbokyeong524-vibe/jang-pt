"use client";

import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ClipboardList,
  History,
  Home,
  LogIn,
  Settings,
  UserCheck,
  Users,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { initialState } from "@/lib/seed-data";
import type {
  AppState,
  AvailabilitySlot,
  Member,
  PassEvent,
  Payment,
  PaymentStatus,
  PtPass,
  Reservation
} from "@/lib/types";
import {
  addDays,
  addHours,
  formatDateTime,
  formatWon,
  hoursUntil,
  makeId,
  toInputDate
} from "@/lib/utils";

type AdminTab = "home" | "week" | "members" | "settings" | "summary";
type MemberTab = "home" | "booking" | "history";

const statusLabels: Record<string, string> = {
  open: "가능",
  held: "요청중",
  confirmed: "확정",
  blocked: "차단",
  requested: "요청중",
  completed: "완료",
  cancelled: "취소",
  cancel_requested: "취소요청",
  no_show: "노쇼",
  expired: "만료",
  unpaid: "미납",
  boxpos_requested: "결제요청",
  paid: "결제완료",
  refunded: "환불"
};

const paymentOrder: PaymentStatus[] = [
  "unpaid",
  "boxpos_requested",
  "paid",
  "refunded"
];

export function PtManagementApp() {
  const [state, setState] = useState<AppState>(initialState);
  const [mode, setMode] = useState<"admin" | "member">("admin");
  const [adminTab, setAdminTab] = useState<AdminTab>("home");
  const [memberTab, setMemberTab] = useState<MemberTab>("home");
  const [selectedMemberId, setSelectedMemberId] = useState("member_1");
  const [memberSessionId, setMemberSessionId] = useState("member_3");
  const [message, setMessage] = useState("데모 데이터가 로드되었습니다.");

  const selectedMember = state.members.find((member) => member.id === selectedMemberId) ?? state.members[0];
  const loggedInMember = state.members.find((member) => member.id === memberSessionId) ?? state.members[0];

  const tasks = useMemo(() => buildTasks(state), [state]);
  const weekDays = useMemo(() => buildSevenDayWeek(state.slots), [state.slots]);
  const crmSummary = useMemo(() => buildCrmSummary(state), [state]);

  function activePassFor(memberId: string) {
    return state.passes.find((pass) => pass.memberId === memberId && pass.active);
  }

  function reservationsFor(memberId: string) {
    return state.reservations.filter((reservation) => reservation.memberId === memberId);
  }

  function memberName(memberId: string) {
    return state.members.find((member) => member.id === memberId)?.name ?? "알 수 없음";
  }

  function slotFor(slotId: string) {
    return state.slots.find((slot) => slot.id === slotId);
  }

  function approveLinkRequest(requestId: string) {
    setState((current) => ({
      ...current,
      memberLinkRequests: current.memberLinkRequests.map((request) =>
        request.id === requestId
          ? { ...request, status: "approved", approvedAt: new Date().toISOString() }
          : request
      )
    }));
    setMessage("회원 연결을 승인했습니다.");
  }

  function approveReservation(reservationId: string) {
    setState((current) => ({
      ...current,
      reservations: current.reservations.map((reservation) =>
        reservation.id === reservationId
          ? { ...reservation, status: "confirmed", confirmedAt: new Date().toISOString() }
          : reservation
      ),
      slots: current.slots.map((slot) =>
        current.reservations.find((reservation) => reservation.id === reservationId)?.slotId === slot.id
          ? { ...slot, status: "confirmed", heldUntil: undefined, reservationId }
          : slot
      )
    }));
    setMessage("예약을 확정했습니다.");
  }

  function rejectReservation(reservationId: string) {
    setState((current) => {
      const reservation = current.reservations.find((item) => item.id === reservationId);

      return {
        ...current,
        reservations: current.reservations.map((item) =>
          item.id === reservationId ? { ...item, status: "cancelled", cancelledAt: new Date().toISOString() } : item
        ),
        slots: current.slots.map((slot) =>
          reservation?.slotId === slot.id
            ? { ...slot, status: "open", heldUntil: undefined, reservationId: undefined }
            : slot
        )
      };
    });
    setMessage("예약 요청을 거절하고 슬롯을 다시 열었습니다.");
  }

  function completeSession(reservationId: string) {
    setState((current) => {
      const reservation = current.reservations.find((item) => item.id === reservationId);
      if (!reservation || reservation.status !== "confirmed") {
        return current;
      }

      const pass = current.passes.find((item) => item.id === reservation.passId);
      if (!pass || pass.remainingSessions < 1) {
        return current;
      }

      return {
        ...current,
        reservations: current.reservations.map((item) =>
          item.id === reservationId
            ? { ...item, status: "completed", completedAt: new Date().toISOString() }
            : item
        ),
        passes: current.passes.map((item) =>
          item.id === pass.id ? { ...item, remainingSessions: item.remainingSessions - 1 } : item
        ),
        passEvents: [
          {
            id: makeId("event"),
            passId: pass.id,
            memberId: pass.memberId,
            reservationId,
            eventType: "session_completed",
            deltaCount: -1,
            reason: "수업완료",
            actor: "admin",
            createdAt: new Date().toISOString()
          },
          ...current.passEvents
        ]
      };
    });
    setMessage("수업완료 처리와 1회 차감을 기록했습니다.");
  }

  function requestBooking(slotId: string) {
    const pass = activePassFor(memberSessionId);
    if (!pass) {
      setMessage("활성 PT권이 없습니다.");
      return;
    }

    const futureReservations = reservationsFor(memberSessionId).filter((reservation) =>
      ["requested", "confirmed"].includes(reservation.status)
    );

    const bookingLimit =
      state.policies.booking.memberFutureBookingLimit === "remaining_sessions"
        ? pass.remainingSessions
        : state.policies.booking.memberFutureBookingLimit === "fixed_count"
          ? state.policies.booking.fixedFutureBookingLimit
          : Number.POSITIVE_INFINITY;

    if (futureReservations.length >= bookingLimit) {
      setMessage("잔여횟수보다 많은 예약은 요청할 수 없습니다.");
      return;
    }

    if (!state.policies.booking.allowUnpaidBooking && pass.paymentStatus !== "paid") {
      setMessage("현재 정책에서는 결제완료 전 예약 요청이 제한됩니다.");
      return;
    }

    const reservationId = makeId("reservation");
    const lockedUntil = addHours(new Date(), state.policies.booking.requestExpiryHours).toISOString();

    setState((current) => ({
      ...current,
      slots: current.slots.map((slot) =>
        slot.id === slotId ? { ...slot, status: "held", heldUntil: lockedUntil, reservationId } : slot
      ),
      reservations: [
        {
          id: reservationId,
          memberId: memberSessionId,
          passId: pass.id,
          slotId,
          status: "requested",
          requestedAt: new Date().toISOString(),
          lockedUntil,
          policySnapshot: {
            requestExpiryHours: current.policies.booking.requestExpiryHours,
            autoCancelHoursBeforeSession: current.policies.cancellation.autoCancelHoursBeforeSession,
            lateCancelDefaultDeduct: current.policies.cancellation.lateCancelDefaultDeduct
          }
        },
        ...current.reservations
      ]
    }));
    setMessage("예약 요청을 보냈습니다. 관장 승인 전까지 슬롯이 잠깁니다.");
  }

  function requestCancel(reservationId: string) {
    setState((current) => {
      const reservation = current.reservations.find((item) => item.id === reservationId);
      const slot = reservation ? current.slots.find((item) => item.id === reservation.slotId) : undefined;

      if (!reservation || !slot) {
        return current;
      }

      const canAutoCancel =
        hoursUntil(slot.startAt) >= current.policies.cancellation.autoCancelHoursBeforeSession;

      if (canAutoCancel) {
        return {
          ...current,
          reservations: current.reservations.map((item) =>
            item.id === reservationId
              ? {
                  ...item,
                  status: "cancelled",
                  cancelledAt: new Date().toISOString(),
                  cancelReason: "회원 자동취소",
                  deductOnCancel: false
                }
              : item
          ),
          slots: current.slots.map((item) =>
            item.id === slot.id ? { ...item, status: "open", reservationId: undefined } : item
          )
        };
      }

      return {
        ...current,
        reservations: current.reservations.map((item) =>
          item.id === reservationId
            ? {
                ...item,
                status: "cancel_requested",
                cancelReason: "회원 취소요청",
                deductOnCancel: current.policies.cancellation.lateCancelDefaultDeduct
              }
            : item
        )
      };
    });
    setMessage("취소 요청을 처리했습니다.");
  }

  function resolveLateCancel(reservationId: string, deduct: boolean) {
    setState((current) => {
      const reservation = current.reservations.find((item) => item.id === reservationId);
      const pass = reservation ? current.passes.find((item) => item.id === reservation.passId) : undefined;

      if (!reservation || !pass) {
        return current;
      }

      return {
        ...current,
        reservations: current.reservations.map((item) =>
          item.id === reservationId
            ? {
                ...item,
                status: "cancelled",
                cancelledAt: new Date().toISOString(),
                deductOnCancel: deduct
              }
            : item
        ),
        slots: current.slots.map((slot) =>
          slot.id === reservation.slotId ? { ...slot, status: "open", reservationId: undefined } : slot
        ),
        passes: deduct
          ? current.passes.map((item) =>
              item.id === pass.id
                ? { ...item, remainingSessions: Math.max(0, item.remainingSessions - 1) }
                : item
            )
          : current.passes,
        passEvents: deduct
          ? [
              {
                id: makeId("event"),
                passId: pass.id,
                memberId: pass.memberId,
                reservationId,
                eventType: "late_cancel_deducted",
                deltaCount: -1,
                reason: "24시간 이내 취소 차감",
                actor: "admin",
                createdAt: new Date().toISOString()
              },
              ...current.passEvents
            ]
          : current.passEvents
      };
    });
    setMessage(deduct ? "취소 차감을 기록했습니다." : "미차감 예외로 처리했습니다.");
  }

  function changePaymentStatus(passId: string, nextStatus: PaymentStatus) {
    setState((current) => {
      const payment = current.payments.find((item) => item.passId === passId);
      const pass = current.passes.find((item) => item.id === passId);

      return {
        ...current,
        passes: current.passes.map((item) =>
          item.id === passId ? { ...item, paymentStatus: nextStatus } : item
        ),
        payments: current.payments.map((item) =>
          item.passId === passId ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item
        ),
        paymentEvents:
          payment && pass
            ? [
                {
                  id: makeId("payment_event"),
                  paymentId: payment.id,
                  fromStatus: payment.status,
                  toStatus: nextStatus,
                  actor: "admin",
                  memo: `${statusLabels[payment.status]} -> ${statusLabels[nextStatus]}`,
                  createdAt: new Date().toISOString()
                },
                ...current.paymentEvents
              ]
            : current.paymentEvents
      };
    });
    setMessage("결제 상태를 변경했습니다.");
  }

  function approveExtension(requestId: string) {
    setState((current) => {
      const request = current.extensionRequests.find((item) => item.id === requestId);
      const pass = request ? current.passes.find((item) => item.id === request.passId) : undefined;

      if (!request || !pass) {
        return current;
      }

      const nextExpiry = addDays(new Date(`${pass.expiresOn}T00:00:00`), request.days)
        .toISOString()
        .slice(0, 10);

      return {
        ...current,
        extensionRequests: current.extensionRequests.map((item) =>
          item.id === requestId
            ? { ...item, status: "approved", decidedAt: new Date().toISOString() }
            : item
        ),
        passes: current.passes.map((item) =>
          item.id === pass.id ? { ...item, expiresOn: nextExpiry } : item
        ),
        passEvents: [
          {
            id: makeId("event"),
            passId: pass.id,
            memberId: pass.memberId,
            eventType: "extension_added",
            deltaCount: 0,
            reason: `${request.reason} ${request.days}일 연장`,
            actor: "admin",
            createdAt: new Date().toISOString()
          },
          ...current.passEvents
        ]
      };
    });
    setMessage("연장 요청을 승인했습니다.");
  }

  function addPass(memberId: string, productId: string) {
    const product = state.policies.passProducts.find((item) => item.id === productId);
    if (!product) {
      return;
    }

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
          reason: `${product.name} 등록`,
          actor: "admin",
          createdAt: new Date().toISOString()
        },
        ...current.passEvents
      ]
    }));
    setMessage("신규 PT권을 등록했습니다.");
  }

  function updatePolicy(path: string, value: number | boolean | string) {
    setState((current) => {
      const policies = structuredClone(current.policies);

      if (path === "booking.publishWeeks" && typeof value === "number") {
        policies.booking.publishWeeks = value;
      }
      if (path === "booking.requestExpiryHours" && typeof value === "number") {
        policies.booking.requestExpiryHours = value;
      }
      if (path === "booking.allowUnpaidBooking" && typeof value === "boolean") {
        policies.booking.allowUnpaidBooking = value;
      }
      if (path === "booking.memberFutureBookingLimit" && typeof value === "string") {
        policies.booking.memberFutureBookingLimit = value as AppState["policies"]["booking"]["memberFutureBookingLimit"];
      }
      if (path === "booking.fixedFutureBookingLimit" && typeof value === "number") {
        policies.booking.fixedFutureBookingLimit = value;
      }
      if (path === "cancellation.autoCancelHoursBeforeSession" && typeof value === "number") {
        policies.cancellation.autoCancelHoursBeforeSession = value;
      }
      if (path === "cancellation.lateCancelDefaultDeduct" && typeof value === "boolean") {
        policies.cancellation.lateCancelDefaultDeduct = value;
      }
      if (path === "cancellation.exceptionReasons" && typeof value === "string") {
        policies.cancellation.exceptionReasons = value.split(",").map((item) => item.trim()).filter(Boolean);
      }
      if (path === "extension.memberRequestEnabled" && typeof value === "boolean") {
        policies.extension.memberRequestEnabled = value;
      }
      if (path === "extension.defaultReasons" && typeof value === "string") {
        policies.extension.defaultReasons = value.split(",").map((item) => item.trim()).filter(Boolean);
      }
      if (path === "renewal.remainingSessionsThreshold" && typeof value === "number") {
        policies.renewal.remainingSessionsThreshold = value;
      }
      if (path === "renewal.daysBeforeExpiryThreshold" && typeof value === "number") {
        policies.renewal.daysBeforeExpiryThreshold = value;
      }
      if (path === "renewal.showToMember" && typeof value === "boolean") {
        policies.renewal.showToMember = value;
      }
      if (path === "copyTemplates.bookingApproved" && typeof value === "string") {
        policies.copyTemplates.bookingApproved = value;
      }
      if (path === "copyTemplates.paymentRequested" && typeof value === "string") {
        policies.copyTemplates.paymentRequested = value;
      }
      if (path === "copyTemplates.renewalNudge" && typeof value === "string") {
        policies.copyTemplates.renewalNudge = value;
      }

      return { ...current, policies };
    });
  }

  function updateProduct(productId: string, field: "price" | "defaultValidDays" | "active", value: number | boolean) {
    setState((current) => ({
      ...current,
      policies: {
        ...current.policies,
        passProducts: current.policies.passProducts.map((product) =>
          product.id === productId ? { ...product, [field]: value } : product
        )
      }
    }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">강동무에타이장</p>
          <h1>PT 운영 관리</h1>
        </div>
        <div className="topbar-actions" role="tablist" aria-label="화면 전환">
          <button className={mode === "admin" ? "segmented active" : "segmented"} onClick={() => setMode("admin")}>
            <ClipboardList size={16} />
            관리자
          </button>
          <button className={mode === "member" ? "segmented active" : "segmented"} onClick={() => setMode("member")}>
            <LogIn size={16} />
            회원
          </button>
        </div>
      </header>

      <section className="status-line" aria-live="polite">
        <Bell size={16} />
        <span>{message}</span>
      </section>

      {mode === "admin" ? (
        <section className="app-surface-flat with-bottom-nav">
            {adminTab === "home" && (
              <AdminHomeView
                tasks={tasks}
                weekDays={weekDays}
                state={state}
                memberName={memberName}
              />
            )}

            {adminTab === "week" && (
              <ScheduleView
                weekDays={weekDays}
                state={state}
                memberName={memberName}
                approveReservation={approveReservation}
                rejectReservation={rejectReservation}
                completeSession={completeSession}
                resolveLateCancel={resolveLateCancel}
              />
            )}

            {adminTab === "members" && (
              <MembersView
                state={state}
                selectedMember={selectedMember}
                selectedMemberId={selectedMemberId}
                setSelectedMemberId={setSelectedMemberId}
                activePass={activePassFor(selectedMember.id)}
                reservations={reservationsFor(selectedMember.id)}
                slotFor={slotFor}
                addPass={addPass}
                changePaymentStatus={changePaymentStatus}
                approveLinkRequest={approveLinkRequest}
                approveExtension={approveExtension}
              />
            )}

            {adminTab === "settings" && (
              <SettingsView
                state={state}
                updatePolicy={updatePolicy}
                updateProduct={updateProduct}
              />
            )}

            {adminTab === "summary" && <SummaryView summary={crmSummary} />}

            <nav className="bottom-tabs admin-bottom-tabs" aria-label="관리자 메뉴">
              <TabButton active={adminTab === "home"} onClick={() => setAdminTab("home")} icon={<Home size={18} />} label="홈" />
              <TabButton active={adminTab === "week"} onClick={() => setAdminTab("week")} icon={<CalendarDays size={18} />} label="주간" />
              <TabButton active={adminTab === "members"} onClick={() => setAdminTab("members")} icon={<Users size={18} />} label="회원" />
              <TabButton active={adminTab === "settings"} onClick={() => setAdminTab("settings")} icon={<Settings size={18} />} label="설정" />
              <TabButton active={adminTab === "summary"} onClick={() => setAdminTab("summary")} icon={<ClipboardList size={18} />} label="CRM" />
            </nav>
        </section>
      ) : (
        <MemberView
          state={state}
          member={loggedInMember}
          memberTab={memberTab}
          setMemberTab={setMemberTab}
          memberSessionId={memberSessionId}
          setMemberSessionId={setMemberSessionId}
          activePass={activePassFor(loggedInMember.id)}
          reservations={reservationsFor(loggedInMember.id)}
          passEvents={state.passEvents.filter((event) => event.memberId === loggedInMember.id)}
          payments={state.payments.filter((payment) => payment.memberId === loggedInMember.id)}
          weekDays={weekDays}
          requestBooking={requestBooking}
          requestCancel={requestCancel}
          slotFor={slotFor}
        />
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button className={active ? "tab active" : "tab"} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AdminHomeView({
  tasks,
  weekDays,
  state,
  memberName
}: {
  tasks: Array<{ id: string; title: string; body: string; badge: string; tone: string }>;
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  state: AppState;
  memberName: (memberId: string) => string;
}) {
  const priorityTasks = tasks.slice(0, 3);
  const hiddenTaskCount = Math.max(0, tasks.length - priorityTasks.length);

  return (
    <div className="admin-home">
      <section className="task-panel task-panel-compact" aria-label="처리 필요">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">오늘 처리</p>
            <h2>처리 필요 {tasks.length}</h2>
          </div>
          <AlertTriangle size={20} />
        </div>
        <div className="task-list compact">
          {priorityTasks.map((task) => (
            <div className={`task-item compact ${task.tone}`} key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <p>{task.body}</p>
              </div>
              <span>{task.badge}</span>
            </div>
          ))}
          {hiddenTaskCount > 0 && (
            <div className="task-overflow">
              나머지 {hiddenTaskCount}건은 하단 탭에서 처리
            </div>
          )}
          {tasks.length === 0 && <div className="empty-state">오늘 처리할 항목이 없습니다.</div>}
        </div>
      </section>

      <section className="section-band">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">이번 주</p>
            <h2>주간 요약</h2>
          </div>
          <CalendarDays size={20} />
        </div>
        <WeekSchedule
          weekDays={weekDays}
          state={state}
          memberName={memberName}
          summary
        />
      </section>
    </div>
  );
}

function ScheduleView({
  weekDays,
  state,
  memberName,
  approveReservation,
  rejectReservation,
  completeSession,
  resolveLateCancel
}: {
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  state: AppState;
  memberName: (memberId: string) => string;
  approveReservation: (reservationId: string) => void;
  rejectReservation: (reservationId: string) => void;
  completeSession: (reservationId: string) => void;
  resolveLateCancel: (reservationId: string, deduct: boolean) => void;
}) {
  return (
    <section className="week-screen">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">주간 시간표</p>
          <h2>7일 예약 현황</h2>
        </div>
        <CalendarDays size={20} />
      </div>
      <WeekSchedule
        weekDays={weekDays}
        state={state}
        memberName={memberName}
        approveReservation={approveReservation}
        rejectReservation={rejectReservation}
        completeSession={completeSession}
        resolveLateCancel={resolveLateCancel}
      />
    </section>
  );
}

function WeekSchedule({
  weekDays,
  state,
  memberName,
  approveReservation,
  rejectReservation,
  completeSession,
  resolveLateCancel,
  summary = false
}: {
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  state: AppState;
  memberName: (memberId: string) => string;
  approveReservation?: (reservationId: string) => void;
  rejectReservation?: (reservationId: string) => void;
  completeSession?: (reservationId: string) => void;
  resolveLateCancel?: (reservationId: string, deduct: boolean) => void;
  summary?: boolean;
}) {
  const rows = buildWeekTimeRows(weekDays);
  const firstSlotId = firstChronologicalSlot(weekDays)?.id;
  const [selectedSlotId, setSelectedSlotId] = useState(firstSlotId);
  const selectedSlot = state.slots.find((slot) => slot.id === selectedSlotId) ?? state.slots.find((slot) => slot.id === firstSlotId);
  const selectedReservation = selectedSlot
    ? state.reservations.find((reservation) => reservation.slotId === selectedSlot.id)
    : undefined;

  if (summary) {
    return <WeekSummary weekDays={weekDays} state={state} memberName={memberName} />;
  }

  return (
    <>
      <div className="week-matrix" role="grid" aria-label="7일 예약 현황">
        <div className="week-matrix-header" role="row">
          <span className="week-time-label">시간</span>
          {weekDays.map((group) => (
            <div className="week-day-heading" role="columnheader" key={group.day}>
              <strong>{weekdayLabel(group.day)}</strong>
              <span>{monthDayLabel(group.day)}</span>
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div className="week-time-row" role="row" key={row.time}>
            <span className="week-time-label">{row.time}</span>
            {row.slots.map((slot, index) => {
              const reservation = slot ? state.reservations.find((item) => item.slotId === slot.id) : undefined;
              const status = reservation?.status ?? slot?.status ?? "empty";
              const label = reservation ? memberName(reservation.memberId) : slot?.status === "blocked" ? "차단" : slot ? "가능" : "없음";

              return (
                <button
                  className={`week-cell ${status} ${selectedSlot?.id === slot?.id ? "selected" : ""}`}
                  type="button"
                  role="gridcell"
                  key={`${row.time}-${weekDays[index]?.day ?? index}`}
                  onClick={() => slot && setSelectedSlotId(slot.id)}
                  disabled={!slot}
                  aria-label={`${weekDays[index] ? weekdayLabel(weekDays[index].day) : ""} ${row.time} ${label}`}
                >
                  <span className="week-cell-status">{shortStatusLabel(status)}</span>
                  <span className="week-cell-detail">{label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <section className="week-selection-panel" aria-label="선택 슬롯 상세">
        {selectedSlot ? (
          <>
            <div>
              <p className="eyebrow">선택 슬롯</p>
              <h3>{formatDateTime(selectedSlot.startAt)}</h3>
              <p>{selectedReservation ? memberName(selectedReservation.memberId) : selectedSlot.status === "blocked" ? "운영 차단" : "예약 가능"}</p>
            </div>
            <StatusPill value={selectedReservation?.status ?? selectedSlot.status} />
            {selectedReservation?.status === "requested" && approveReservation && rejectReservation && (
              <div className="row-actions">
                <IconButton label="승인" onClick={() => approveReservation(selectedReservation.id)} icon={<Check size={16} />} />
                <IconButton label="거절" onClick={() => rejectReservation(selectedReservation.id)} icon={<X size={16} />} />
              </div>
            )}
            {selectedReservation?.status === "confirmed" && completeSession && (
              <div className="row-actions">
                <IconButton label="완료" onClick={() => completeSession(selectedReservation.id)} icon={<Check size={16} />} />
              </div>
            )}
            {selectedReservation?.status === "cancel_requested" && resolveLateCancel && (
              <div className="row-actions">
                <button className="small-button danger" onClick={() => resolveLateCancel(selectedReservation.id, true)}>
                  차감
                </button>
                <button className="small-button" onClick={() => resolveLateCancel(selectedReservation.id, false)}>
                  미차감
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">선택할 슬롯이 없습니다.</div>
        )}
      </section>
    </>
  );
}

function WeekSummary({
  weekDays,
  state,
  memberName
}: {
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  state: AppState;
  memberName: (memberId: string) => string;
}) {
  return (
    <div className="week-summary-grid">
      {weekDays.map((group) => {
        const reservations = group.slots
          .map((slot) => state.reservations.find((reservation) => reservation.slotId === slot.id))
          .filter((reservation): reservation is Reservation => Boolean(reservation));
        const openCount = group.slots.filter((slot) => slot.status === "open").length;
        const primaryReservation = reservations[0];

        return (
          <section className="week-summary-cell" key={group.day}>
            <div className="week-summary-date">
              <strong>{weekdayLabel(group.day)}</strong>
              <span>{monthDayLabel(group.day)}</span>
            </div>
            <div className="week-summary-body">
              <strong>{group.slots.length}개</strong>
              <span>{primaryReservation ? memberName(primaryReservation.memberId) : openCount > 0 ? `가능 ${openCount}` : "비어있음"}</span>
              <div className="summary-dots" aria-label="슬롯 상태 요약">
                {group.slots.slice(0, 4).map((slot) => {
                  const reservation = state.reservations.find((item) => item.slotId === slot.id);
                  return <i className={reservation?.status ?? slot.status} key={slot.id} />;
                })}
                {group.slots.length === 0 && <i className="empty" />}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MembersView({
  state,
  selectedMember,
  selectedMemberId,
  setSelectedMemberId,
  activePass,
  reservations,
  slotFor,
  addPass,
  changePaymentStatus,
  approveLinkRequest,
  approveExtension
}: {
  state: AppState;
  selectedMember: Member;
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  activePass?: PtPass;
  reservations: Reservation[];
  slotFor: (slotId: string) => AvailabilitySlot | undefined;
  addPass: (memberId: string, productId: string) => void;
  changePaymentStatus: (passId: string, nextStatus: PaymentStatus) => void;
  approveLinkRequest: (requestId: string) => void;
  approveExtension: (requestId: string) => void;
}) {
  return (
    <div className="split-layout">
      <aside className="member-list" aria-label="회원 목록">
        {state.members.map((member) => (
          <button
            className={member.id === selectedMemberId ? "member-row active" : "member-row"}
            key={member.id}
            onClick={() => setSelectedMemberId(member.id)}
          >
            <strong>{member.name}</strong>
            <span>{member.phone}</span>
          </button>
        ))}
      </aside>

      <section className="detail-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">회원 상세</p>
            <h2>{selectedMember.name}</h2>
          </div>
          <UserCheck size={20} />
        </div>

        {activePass ? (
          <div className="metric-grid">
            <Metric label="잔여" value={`${activePass.remainingSessions}/${activePass.totalSessions}회`} />
            <Metric label="만료" value={activePass.expiresOn} />
            <Metric label="결제" value={statusLabels[activePass.paymentStatus]} tone={activePass.paymentStatus === "paid" ? "good" : "warn"} />
            <Metric label="금액" value={formatWon(activePass.price)} />
          </div>
        ) : (
          <div className="empty-state">활성 PT권 없음</div>
        )}

        <div className="toolbar compact">
          <select
            aria-label="신규 PT권"
            onChange={(event) => {
              if (event.target.value) {
                addPass(selectedMember.id, event.target.value);
                event.target.value = "";
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              PT권 등록
            </option>
            {state.policies.passProducts
              .filter((product) => product.active)
              .map((product) => (
                <option value={product.id} key={product.id}>
                  {product.name} / {formatWon(product.price)}
                </option>
              ))}
          </select>
          {activePass && (
            <select
              aria-label="결제 상태"
              value={activePass.paymentStatus}
              onChange={(event) => changePaymentStatus(activePass.id, event.target.value as PaymentStatus)}
            >
              {paymentOrder.map((status) => (
                <option value={status} key={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          )}
        </div>

        <section className="section-band">
          <h3>예약 이력</h3>
          <div className="table-list">
            {reservations.map((reservation) => {
              const slot = slotFor(reservation.slotId);
              return (
                <div className="table-row" key={reservation.id}>
                  <span>{slot ? formatDateTime(slot.startAt) : "슬롯 없음"}</span>
                  <StatusPill value={reservation.status} />
                </div>
              );
            })}
          </div>
        </section>

        <section className="section-band">
          <h3>승인 대기</h3>
          <div className="table-list">
            {state.memberLinkRequests
              .filter((request) => request.status === "pending")
              .map((request) => (
                <div className="table-row" key={request.id}>
                  <span>{request.displayName} / {request.inputPhone}</span>
                  <button className="small-button" onClick={() => approveLinkRequest(request.id)}>
                    연결 승인
                  </button>
                </div>
              ))}
            {state.extensionRequests
              .filter((request) => request.status === "requested")
              .map((request) => (
                <div className="table-row" key={request.id}>
                  <span>
                    {request.reason} / {request.days}일 연장
                  </span>
                  <button className="small-button" onClick={() => approveExtension(request.id)}>
                    연장 승인
                  </button>
                </div>
              ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function SettingsView({
  state,
  updatePolicy,
  updateProduct
}: {
  state: AppState;
  updatePolicy: (path: string, value: number | boolean | string) => void;
  updateProduct: (productId: string, field: "price" | "defaultValidDays" | "active", value: number | boolean) => void;
}) {
  return (
    <div className="settings-layout">
      <section className="section-band">
        <h3>PT 상품</h3>
        <div className="product-table">
          {state.policies.passProducts.map((product) => (
            <div className="product-row" key={product.id}>
              <strong>{product.name}</strong>
              <label>
                가격
                <input
                  type="number"
                  value={product.price}
                  onChange={(event) => updateProduct(product.id, "price", Number(event.target.value))}
                />
              </label>
              <label>
                유효일
                <input
                  type="number"
                  value={product.defaultValidDays}
                  onChange={(event) => updateProduct(product.id, "defaultValidDays", Number(event.target.value))}
                />
              </label>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={product.active}
                  onChange={(event) => updateProduct(product.id, "active", event.target.checked)}
                />
                활성
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="policy-grid">
        <PolicyInput label="공개 주차" value={state.policies.booking.publishWeeks} onChange={(value) => updatePolicy("booking.publishWeeks", value)} />
        <PolicyInput label="요청 만료 시간" value={state.policies.booking.requestExpiryHours} onChange={(value) => updatePolicy("booking.requestExpiryHours", value)} />
        <PolicyInput label="자동취소 기준" value={state.policies.cancellation.autoCancelHoursBeforeSession} onChange={(value) => updatePolicy("cancellation.autoCancelHoursBeforeSession", value)} />
        <PolicyInput label="재등록 잔여횟수" value={state.policies.renewal.remainingSessionsThreshold} onChange={(value) => updatePolicy("renewal.remainingSessionsThreshold", value)} />
        <PolicyInput label="재등록 만료일 기준" value={state.policies.renewal.daysBeforeExpiryThreshold} onChange={(value) => updatePolicy("renewal.daysBeforeExpiryThreshold", value)} />
        <PolicyInput label="고정 예약 개수" value={state.policies.booking.fixedFutureBookingLimit} onChange={(value) => updatePolicy("booking.fixedFutureBookingLimit", value)} />
        <label className="setting-card">
          <span>예약 제한 방식</span>
          <select
            value={state.policies.booking.memberFutureBookingLimit}
            onChange={(event) => updatePolicy("booking.memberFutureBookingLimit", event.target.value)}
          >
            <option value="remaining_sessions">잔여횟수 기준</option>
            <option value="fixed_count">고정 개수</option>
            <option value="unlimited">제한 없음</option>
          </select>
        </label>
        <label className="setting-card">
          <span>미납 예약 허용</span>
          <input
            type="checkbox"
            checked={state.policies.booking.allowUnpaidBooking}
            onChange={(event) => updatePolicy("booking.allowUnpaidBooking", event.target.checked)}
          />
        </label>
        <label className="setting-card">
          <span>24시간 이내 기본 차감</span>
          <input
            type="checkbox"
            checked={state.policies.cancellation.lateCancelDefaultDeduct}
            onChange={(event) => updatePolicy("cancellation.lateCancelDefaultDeduct", event.target.checked)}
          />
        </label>
        <label className="setting-card">
          <span>회원 연장요청 허용</span>
          <input
            type="checkbox"
            checked={state.policies.extension.memberRequestEnabled}
            onChange={(event) => updatePolicy("extension.memberRequestEnabled", event.target.checked)}
          />
        </label>
        <label className="setting-card">
          <span>회원 재등록 안내</span>
          <input
            type="checkbox"
            checked={state.policies.renewal.showToMember}
            onChange={(event) => updatePolicy("renewal.showToMember", event.target.checked)}
          />
        </label>
      </section>

      <section className="section-band">
        <h3>예외 사유와 안내 문구</h3>
        <div className="template-grid">
          <label>
            취소 예외 사유
            <input
              value={state.policies.cancellation.exceptionReasons.join(", ")}
              onChange={(event) => updatePolicy("cancellation.exceptionReasons", event.target.value)}
            />
          </label>
          <label>
            연장 사유
            <input
              value={state.policies.extension.defaultReasons.join(", ")}
              onChange={(event) => updatePolicy("extension.defaultReasons", event.target.value)}
            />
          </label>
          <label>
            예약 확정 문구
            <textarea
              value={state.policies.copyTemplates.bookingApproved}
              onChange={(event) => updatePolicy("copyTemplates.bookingApproved", event.target.value)}
            />
          </label>
          <label>
            결제 요청 문구
            <textarea
              value={state.policies.copyTemplates.paymentRequested}
              onChange={(event) => updatePolicy("copyTemplates.paymentRequested", event.target.value)}
            />
          </label>
          <label>
            재등록 문구
            <textarea
              value={state.policies.copyTemplates.renewalNudge}
              onChange={(event) => updatePolicy("copyTemplates.renewalNudge", event.target.value)}
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function PolicyInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="setting-card">
      <span>{label}</span>
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SummaryView({ summary }: { summary: string }) {
  return (
    <section className="section-band">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">비타민CRM</p>
          <h2>복사용 요약</h2>
        </div>
        <button
          className="primary-button"
          onClick={() => navigator.clipboard?.writeText(summary)}
        >
          <ClipboardList size={16} />
          복사
        </button>
      </div>
      <textarea className="summary-box" readOnly value={summary} />
    </section>
  );
}

function MemberView({
  state,
  member,
  memberTab,
  setMemberTab,
  memberSessionId,
  setMemberSessionId,
  activePass,
  reservations,
  passEvents,
  payments,
  weekDays,
  requestBooking,
  requestCancel,
  slotFor
}: {
  state: AppState;
  member: Member;
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  memberSessionId: string;
  setMemberSessionId: (id: string) => void;
  activePass?: PtPass;
  reservations: Reservation[];
  passEvents: PassEvent[];
  payments: Payment[];
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  requestBooking: (slotId: string) => void;
  requestCancel: (reservationId: string) => void;
  slotFor: (slotId: string) => AvailabilitySlot | undefined;
}) {
  const approvedLink = true;

  return (
    <section className="member-app app-surface-flat with-bottom-nav">
      <div className="toolbar">
        <select value={memberSessionId} onChange={(event) => setMemberSessionId(event.target.value)} aria-label="회원 데모 계정">
          {state.members.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <StatusPill value={approvedLink ? "approved" : "pending"} label={approvedLink ? "승인됨" : "승인대기"} />
      </div>

      {memberTab === "home" && (
        <MemberHomeView
          state={state}
          member={member}
          activePass={activePass}
          reservations={reservations}
          requestCancel={requestCancel}
          slotFor={slotFor}
        />
      )}

      {memberTab === "booking" && (
        <MemberBookingView
          state={state}
          weekDays={weekDays}
          requestBooking={requestBooking}
        />
      )}

      {memberTab === "history" && (
        <MemberHistoryView
          activePass={activePass}
          reservations={reservations}
          passEvents={passEvents}
          payments={payments}
          slotFor={slotFor}
        />
      )}

      <nav className="bottom-tabs member-bottom-tabs" aria-label="회원 메뉴">
        <TabButton active={memberTab === "home"} onClick={() => setMemberTab("home")} icon={<Home size={18} />} label="홈" />
        <TabButton active={memberTab === "booking"} onClick={() => setMemberTab("booking")} icon={<CalendarDays size={18} />} label="예약" />
        <TabButton active={memberTab === "history"} onClick={() => setMemberTab("history")} icon={<History size={18} />} label="내역" />
      </nav>
    </section>
  );
}

function MemberHomeView({
  state,
  member,
  activePass,
  reservations,
  requestCancel,
  slotFor
}: {
  state: AppState;
  member: Member;
  activePass?: PtPass;
  reservations: Reservation[];
  requestCancel: (reservationId: string) => void;
  slotFor: (slotId: string) => AvailabilitySlot | undefined;
}) {
  const upcomingReservations = reservations.filter((reservation) =>
    ["requested", "confirmed", "cancel_requested"].includes(reservation.status)
  );
  const nextReservation = upcomingReservations
    .map((reservation) => ({ reservation, slot: slotFor(reservation.slotId) }))
    .filter((item): item is { reservation: Reservation; slot: AvailabilitySlot } => Boolean(item.slot))
    .sort((a, b) => a.slot.startAt.localeCompare(b.slot.startAt))[0];

  return (
    <div className="member-dashboard">
      <section className="section-band">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">내 PT</p>
            <h2>{member.name}</h2>
          </div>
          <UserCheck size={20} />
        </div>
        {activePass ? (
          <div className="metric-grid">
            <Metric label="잔여" value={`${activePass.remainingSessions}회`} />
            <Metric label="만료" value={toInputDate(activePass.expiresOn)} />
            <Metric label="결제" value={statusLabels[activePass.paymentStatus]} tone={activePass.paymentStatus === "paid" ? "good" : "warn"} />
            <Metric label="재등록" value={shouldRenew(activePass, state) ? "상담 필요" : "정상"} tone={shouldRenew(activePass, state) ? "warn" : "good"} />
          </div>
        ) : (
          <div className="empty-state">활성 PT권 없음</div>
        )}
      </section>

      <section className="section-band">
        <h3>다음 예약</h3>
        {nextReservation ? (
          <div className="table-row single">
            <span>{formatDateTime(nextReservation.slot.startAt)}</span>
            <StatusPill value={nextReservation.reservation.status} />
            {nextReservation.reservation.status === "confirmed" && (
              <button className="small-button" onClick={() => requestCancel(nextReservation.reservation.id)}>
                취소
              </button>
            )}
          </div>
        ) : (
          <div className="empty-state">예정된 예약이 없습니다.</div>
        )}
      </section>
    </div>
  );
}

function MemberBookingView({
  state,
  weekDays,
  requestBooking
}: {
  state: AppState;
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  requestBooking: (slotId: string) => void;
}) {
  const visibleUntil = addDays(new Date(), state.policies.booking.publishWeeks * 7).getTime();
  const visibleWeekDays = weekDays.map((group) => ({
    ...group,
    slots: group.slots.filter((slot) => new Date(slot.startAt).getTime() <= visibleUntil)
  }));
  const rows = buildWeekTimeRows(visibleWeekDays);
  const firstSlotId = firstChronologicalSlot(visibleWeekDays)?.id;
  const [selectedSlotId, setSelectedSlotId] = useState(firstSlotId);
  const selectedSlot = visibleWeekDays
    .flatMap((group) => group.slots)
    .find((slot) => slot.id === selectedSlotId) ?? visibleWeekDays.flatMap((group) => group.slots).find((slot) => slot.id === firstSlotId);

  return (
    <section className="week-screen">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">예약</p>
          <h2>이번 주 가능 시간</h2>
        </div>
        <CalendarDays size={20} />
      </div>

      <div className="week-matrix member-week-matrix" role="grid" aria-label="이번 주 가능 시간">
        <div className="week-matrix-header" role="row">
          <span className="week-time-label">시간</span>
          {visibleWeekDays.map((group) => (
            <div className="week-day-heading" role="columnheader" key={group.day}>
              <strong>{weekdayLabel(group.day)}</strong>
              <span>{monthDayLabel(group.day)}</span>
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div className="week-time-row" role="row" key={row.time}>
            <span className="week-time-label">{row.time}</span>
            {row.slots.map((slot, index) => {
              const status = slot?.status ?? "empty";
              const label = slot?.status === "blocked" ? "차단" : slot ? statusLabels[slot.status] : "없음";

              return (
                <button
                  className={`week-cell ${status} ${selectedSlot?.id === slot?.id ? "selected" : ""}`}
                  type="button"
                  role="gridcell"
                  key={`${row.time}-${visibleWeekDays[index]?.day ?? index}`}
                  onClick={() => slot && setSelectedSlotId(slot.id)}
                  disabled={!slot}
                  aria-label={`${visibleWeekDays[index] ? weekdayLabel(visibleWeekDays[index].day) : ""} ${row.time} ${label}`}
                >
                  <span className="week-cell-status">{shortStatusLabel(status)}</span>
                  <span className="week-cell-detail">{label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <section className="week-selection-panel" aria-label="선택 예약 상세">
        {selectedSlot ? (
          <>
            <div>
              <p className="eyebrow">선택 시간</p>
              <h3>{formatDateTime(selectedSlot.startAt)}</h3>
              <p>{selectedSlot.status === "open" ? "예약 요청 가능" : statusLabels[selectedSlot.status]}</p>
            </div>
            <StatusPill value={selectedSlot.status} />
            <div className="row-actions">
              <button
                className="primary-button"
                onClick={() => requestBooking(selectedSlot.id)}
                disabled={selectedSlot.status !== "open"}
              >
                예약 요청
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">예약 가능한 시간이 없습니다.</div>
        )}
      </section>
    </section>
  );
}

function MemberHistoryView({
  activePass,
  reservations,
  passEvents,
  payments,
  slotFor
}: {
  activePass?: PtPass;
  reservations: Reservation[];
  passEvents: PassEvent[];
  payments: Payment[];
  slotFor: (slotId: string) => AvailabilitySlot | undefined;
}) {
  return (
    <div className="member-dashboard">
      <section className="section-band">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">회원권</p>
            <h2>상세 정보</h2>
          </div>
          <History size={20} />
        </div>
        {activePass ? (
          <div className="metric-grid">
            <Metric label="상품" value={activePass.policySnapshot.productName} />
            <Metric label="기간" value={`${activePass.startsOn} ~ ${activePass.expiresOn}`} />
            <Metric label="잔여" value={`${activePass.remainingSessions}/${activePass.totalSessions}회`} />
            <Metric label="금액" value={formatWon(activePass.price)} />
          </div>
        ) : (
          <div className="empty-state">활성 PT권 없음</div>
        )}
      </section>

      <section className="section-band">
        <h3>결제 내역</h3>
        <div className="table-list">
          {payments.map((payment) => (
            <div className="table-row" key={payment.id}>
              <span>{formatDateTime(payment.updatedAt)}</span>
              <StatusPill value={payment.status} />
              <span>{formatWon(payment.amount)}</span>
            </div>
          ))}
          {payments.length === 0 && <div className="empty-state">결제 내역이 없습니다.</div>}
        </div>
      </section>

      <section className="section-band">
        <h3>차감/연장/환불 이력</h3>
        <div className="table-list">
          {passEvents.map((event) => (
            <div className="table-row" key={event.id}>
              <span>{formatDateTime(event.createdAt)}</span>
              <span>{event.reason}</span>
              <strong>{event.deltaCount > 0 ? `+${event.deltaCount}` : event.deltaCount}</strong>
            </div>
          ))}
          {passEvents.length === 0 && <div className="empty-state">회원권 이력이 없습니다.</div>}
        </div>
      </section>

      <section className="section-band wide">
        <h3>예약 이력</h3>
        <div className="table-list">
          {reservations.map((reservation) => {
            const slot = slotFor(reservation.slotId);
            return (
              <div className="table-row" key={reservation.id}>
                <span>{slot ? formatDateTime(slot.startAt) : "슬롯 없음"}</span>
                <StatusPill value={reservation.status} />
              </div>
            );
          })}
          {reservations.length === 0 && <div className="empty-state">예약 이력이 없습니다.</div>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ value, label }: { value: string; label?: string }) {
  return <span className={`status-pill ${value}`}>{label ?? statusLabels[value] ?? value}</span>;
}

function IconButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button className="icon-button" onClick={onClick} aria-label={label} title={label}>
      {icon}
    </button>
  );
}

function buildTasks(state: AppState) {
  const pendingReservations = state.reservations.filter((item) => item.status === "requested");
  const cancelRequests = state.reservations.filter((item) => item.status === "cancel_requested");
  const unpaid = state.passes.filter((pass) => pass.paymentStatus !== "paid" && pass.paymentStatus !== "refunded");
  const pendingLinks = state.memberLinkRequests.filter((request) => request.status === "pending");
  const extensions = state.extensionRequests.filter((request) => request.status === "requested");
  const renewals = state.passes.filter((pass) => shouldRenew(pass, state));
  const uncompleted = state.reservations.filter((reservation) => {
    const slot = state.slots.find((item) => item.id === reservation.slotId);
    return reservation.status === "confirmed" && slot && new Date(slot.endAt).getTime() < Date.now();
  });

  return [
    ...pendingReservations.map((item) => ({
      id: `reservation_${item.id}`,
      title: "예약 승인",
      body: `${memberById(state, item.memberId)} 예약 요청`,
      badge: "예약",
      tone: "info"
    })),
    ...cancelRequests.map((item) => ({
      id: `cancel_${item.id}`,
      title: "취소 판단",
      body: `${memberById(state, item.memberId)} 차감 여부 결정`,
      badge: "취소",
      tone: "danger"
    })),
    ...unpaid.map((item) => ({
      id: `payment_${item.id}`,
      title: "결제 확인",
      body: `${memberById(state, item.memberId)} ${formatWon(item.price)}`,
      badge: statusLabels[item.paymentStatus],
      tone: "warn"
    })),
    ...pendingLinks.map((item) => ({
      id: `link_${item.id}`,
      title: "회원 연결",
      body: `${item.displayName} / ${item.inputPhone}`,
      badge: "승인",
      tone: "info"
    })),
    ...extensions.map((item) => ({
      id: `extension_${item.id}`,
      title: "연장 요청",
      body: `${memberById(state, item.memberId)} ${item.days}일`,
      badge: item.reason,
      tone: "info"
    })),
    ...renewals.map((item) => ({
      id: `renewal_${item.id}`,
      title: "재등록 대상",
      body: `${memberById(state, item.memberId)} 잔여 ${item.remainingSessions}회`,
      badge: "재등록",
      tone: "warn"
    })),
    ...uncompleted.map((item) => ({
      id: `uncompleted_${item.id}`,
      title: "완료 미처리",
      body: `${memberById(state, item.memberId)} 수업완료 확인`,
      badge: "완료",
      tone: "danger"
    }))
  ];
}

function buildSevenDayWeek(slots: AvailabilitySlot[]) {
  const sorted = [...slots].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const firstDay = sorted[0]?.startAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const start = dayDate(firstDay);
  const groups = new Map<string, AvailabilitySlot[]>(
    Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index).toISOString().slice(0, 10);
      return [day, []];
    })
  );

  sorted.forEach((slot) => {
    const day = slot.startAt.slice(0, 10);
    if (groups.has(day)) {
      groups.set(day, [...(groups.get(day) ?? []), slot]);
    }
  });

  return Array.from(groups.entries()).map(([day, daySlots]) => ({ day, slots: daySlots }));
}

function buildWeekTimeRows(weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>) {
  const times = Array.from(
    new Set(weekDays.flatMap((group) => group.slots.map((slot) => timeLabel(slot.startAt))))
  ).sort();

  return times.map((time) => ({
    time,
    slots: weekDays.map((group) => group.slots.find((slot) => timeLabel(slot.startAt) === time) ?? null)
  }));
}

function firstChronologicalSlot(weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>) {
  return [...weekDays.flatMap((group) => group.slots)].sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
}

function shortStatusLabel(value: string) {
  if (value === "open") {
    return "가";
  }
  if (value === "requested" || value === "held") {
    return "요";
  }
  if (value === "confirmed" || value === "completed") {
    return "확";
  }
  if (value === "blocked") {
    return "차";
  }
  if (value === "cancel_requested") {
    return "취";
  }
  return "-";
}

function weekdayLabel(day: string) {
  return dayDate(day).toLocaleDateString("ko-KR", { weekday: "short", timeZone: "UTC" });
}

function monthDayLabel(day: string) {
  return dayDate(day).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", timeZone: "UTC" });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function dayDate(day: string) {
  return new Date(`${day}T12:00:00Z`);
}

function buildCrmSummary(state: AppState) {
  const completed = state.reservations.filter((reservation) => reservation.status === "completed");
  const cancelled = state.reservations.filter((reservation) => reservation.status === "cancelled");
  const payments = state.payments.filter((payment) => payment.status === "paid" || payment.status === "refunded");

  const lines = [
    `[강동무에타이장 PT 요약] ${new Date().toLocaleDateString("ko-KR")}`,
    "",
    "수업완료",
    ...completed.map((reservation) => `- ${memberById(state, reservation.memberId)} / 1회 차감`),
    completed.length === 0 ? "- 없음" : "",
    "",
    "취소/예외",
    ...cancelled.map((reservation) => {
      const label = reservation.deductOnCancel ? "차감" : "미차감";
      return `- ${memberById(state, reservation.memberId)} / ${label} / ${reservation.cancelReason ?? "사유 없음"}`;
    }),
    cancelled.length === 0 ? "- 없음" : "",
    "",
    "결제/환불",
    ...payments.map((payment) => `- ${memberById(state, payment.memberId)} / ${statusLabels[payment.status]} / ${formatWon(payment.amount)}`),
    payments.length === 0 ? "- 없음" : ""
  ];

  return lines.filter((line, index, array) => !(line === "" && array[index - 1] === "")).join("\n");
}

function shouldRenew(pass: PtPass, state: AppState) {
  const expiresInDays = Math.ceil((new Date(`${pass.expiresOn}T23:59:59`).getTime() - Date.now()) / 86400000);
  return (
    pass.remainingSessions <= state.policies.renewal.remainingSessionsThreshold ||
    expiresInDays <= state.policies.renewal.daysBeforeExpiryThreshold
  );
}

function memberById(state: AppState, memberId: string) {
  return state.members.find((member) => member.id === memberId)?.name ?? "알 수 없음";
}
