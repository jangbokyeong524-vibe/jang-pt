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
  MoreVertical,
  Settings,
  UserCheck,
  Users,
  X
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Script from "next/script";
import {
  approveExistingMemberLinkAction,
  approveNewMemberLinkAction,
  fetchMemberLinkReviewDataAction,
  fetchOwnMemberLinkRequestsAction,
  rejectMemberLinkAction,
  submitMemberLinkRequestAction
} from "@/lib/member-link-actions";
import {
  approveReservationAction,
  completeSessionAction,
  rejectReservationAction,
  requestReservationAction,
  requestReservationCancelAction,
  resolveLateCancelAction
} from "@/lib/reservation-actions";
import { initialState } from "@/lib/seed-data";
import { fetchOperationalDataAction } from "@/lib/supabase-data";
import { createBrowserSupabaseClient, getGoogleClientId, signInWithGoogle } from "@/lib/supabase";
import type {
  AppState,
  AvailabilitySlot,
  Member,
  MemberLinkRequest,
  PassEvent,
  Payment,
  PaymentStatus,
  PtPass,
  Reservation,
  ExtensionRequest
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

type AdminTab = "home" | "week" | "members" | "settings";
type MemberTab = "home" | "booking" | "history";
type AuthStatus = "checking" | "signedOut" | "admin" | "member" | "memberPending" | "demo" | "error";
type ScheduleViewMode = "month" | "week";
type ScheduleTypeFilter = "all" | "pt" | "morning" | "elementary" | "general";
type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: "outline"; size: "large"; text: "signin_with"; logo_alignment: "left" }) => void;
        };
      };
    };
  }
}
type SettingsSection = "root" | "products" | "policies" | "templates" | "csv";
type PolicySection = "booking" | "cancellation" | "extension" | "renewal" | null;
type CsvDatasetKey =
  | "members"
  | "memberLinkRequests"
  | "passes"
  | "passEvents"
  | "slots"
  | "reservations"
  | "payments"
  | "paymentEvents"
  | "extensionRequests"
  | "passProducts"
  | "policies";

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
  refunded: "환불",
  pending: "승인대기",
  approved: "승인",
  rejected: "반려"
};

const paymentOrder: PaymentStatus[] = [
  "unpaid",
  "boxpos_requested",
  "paid",
  "refunded"
];

const scheduleViewOptions: Array<{ value: ScheduleViewMode; label: string }> = [
  { value: "month", label: "월" },
  { value: "week", label: "주" }
];

const scheduleTypeFilters: Array<{ value: ScheduleTypeFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "pt", label: "PT" },
  { value: "morning", label: "오전반" },
  { value: "elementary", label: "초등부" },
  { value: "general", label: "일반부" }
];

const ptVisibleScheduleTypes: ScheduleTypeFilter[] = ["all", "pt"];

const csvDatasetOptions: Array<{ key: CsvDatasetKey; label: string }> = [
  { key: "members", label: "회원" },
  { key: "memberLinkRequests", label: "회원 연결 요청" },
  { key: "passes", label: "PT권" },
  { key: "passEvents", label: "차감/연장 이력" },
  { key: "slots", label: "예약 슬롯" },
  { key: "reservations", label: "예약" },
  { key: "payments", label: "결제" },
  { key: "paymentEvents", label: "결제 변경 이력" },
  { key: "extensionRequests", label: "연장 요청" },
  { key: "passProducts", label: "PT 상품" },
  { key: "policies", label: "운영 정책" }
];

export function PtManagementApp() {
  const [state, setState] = useState<AppState>(initialState);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [authEmail, setAuthEmail] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [authError, setAuthError] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkPhone, setLinkPhone] = useState("");
  const googleClientId = useMemo(() => getGoogleClientId(), []);
  const [mode, setMode] = useState<"admin" | "member">("admin");
  const [adminTab, setAdminTab] = useState<AdminTab>("home");
  const [memberTab, setMemberTab] = useState<MemberTab>("home");
  const [selectedMemberId, setSelectedMemberId] = useState("member_1");
  const [memberSessionId, setMemberSessionId] = useState("member_3");
  const [message, setMessage] = useState("데모 데이터가 로드되었습니다.");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const selectedMember = state.members.find((member) => member.id === selectedMemberId) ?? state.members[0];
  const loggedInMember = state.members.find((member) => member.id === memberSessionId) ?? state.members[0];

  const tasks = useMemo(() => buildTasks(state), [state]);
  const weekDays = useMemo(() => buildSevenDayWeek(state.slots), [state.slots]);
  const currentMemberLinkRequest = useMemo(
    () =>
      state.memberLinkRequests.find(
        (request) => request.authUserId === authUserId && (request.status === "pending" || request.status === "approved")
      ) ??
      state.memberLinkRequests.find((request) => request.authUserId === authUserId && request.status === "rejected"),
    [authUserId, state.memberLinkRequests]
  );

  async function refreshMemberLinkReviewData() {
    const reviewData = await fetchMemberLinkReviewDataAction({
      supabase,
      fallback: () => ({
        members: state.members,
        memberLinkRequests: state.memberLinkRequests
      })
    });

    setState((current) => ({
      ...current,
      members: reviewData.members.length > 0 ? reviewData.members : current.members,
      memberLinkRequests: reviewData.memberLinkRequests
    }));

    setSelectedMemberId((currentId) =>
      reviewData.members.some((member) => member.id === currentId) ? currentId : reviewData.members[0]?.id ?? currentId
    );
  }

  async function refreshOwnMemberLinkRequests(userId: string) {
    const requests = await fetchOwnMemberLinkRequestsAction({
      supabase,
      authUserId: userId,
      fallback: () => state.memberLinkRequests.filter((request) => request.authUserId === userId)
    });

    setState((current) => ({
      ...current,
      memberLinkRequests: mergeMemberLinkRequests(current.memberLinkRequests, requests, userId)
    }));
  }

  async function refreshOperationalData({ preferredMemberId }: { preferredMemberId?: string } = {}) {
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
      operationalData.members.some((member) => member.id === currentId) ? currentId : operationalData.members[0]?.id ?? currentId
    );
    setMemberSessionId((currentId) => {
      if (preferredMemberId && operationalData.members.some((member) => member.id === preferredMemberId)) {
        return preferredMemberId;
      }

      return operationalData.members.some((member) => member.id === currentId) ? currentId : operationalData.members[0]?.id ?? currentId;
    });
  }

  useEffect(() => {
    if (!supabase) {
      setAuthStatus("demo");
      setMessage("Supabase 환경변수가 없어 로컬 데모 모드로 실행 중입니다.");
      return;
    }

    const authClient = supabase;
    let active = true;

    async function resolveSession(session: Session | null) {
      if (!active) {
        return;
      }

      if (!session) {
        setAuthStatus("signedOut");
        setAuthEmail("");
        setAuthUserId("");
        setMessage("Google 로그인 후 관리자/회원 화면을 확인할 수 있습니다.");
        return;
      }

      const email = session.user.email ?? "";
      setAuthEmail(email);
      setAuthUserId(session.user.id);

      try {
        const bootstrapResponse = await fetch("/api/auth/bootstrap-admin", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (!bootstrapResponse.ok) {
          throw new Error("관리자 권한 초기화에 실패했습니다.");
        }

        const { data: isAdmin, error: adminError } = await authClient.rpc("is_admin");

        if (adminError) {
          throw adminError;
        }

        if (isAdmin) {
          await refreshOperationalData();
          await refreshMemberLinkReviewData();
          setAuthStatus("admin");
          setMode("admin");
          setMessage(`${email} 관리자 계정으로 로그인했습니다.`);
          return;
        }

        const { data: approvedMemberId, error: memberError } = await authClient.rpc("approved_member_id");

        if (memberError) {
          throw memberError;
        }

        if (approvedMemberId) {
          await refreshOperationalData({ preferredMemberId: String(approvedMemberId) });
          await refreshOwnMemberLinkRequests(session.user.id);
          setAuthStatus("member");
          setMode("member");
          setMemberSessionId(String(approvedMemberId));
          setMessage(`${email} 승인 회원으로 로그인했습니다.`);
          return;
        }

        setAuthStatus("memberPending");
        setMode("member");
        await refreshOwnMemberLinkRequests(session.user.id);
        setMessage("회원 연결 승인 전입니다. 전화번호로 연결 요청을 남겨주세요.");
      } catch (error) {
        setAuthStatus("error");
        setAuthError(error instanceof Error ? error.message : "로그인 상태 확인에 실패했습니다.");
      }
    }

    authClient.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthStatus("error");
        setAuthError(error.message);
        return;
      }

      void resolveSession(data.session);
    });

    const {
      data: { subscription }
    } = authClient.auth.onAuthStateChange((_event, session) => {
      void resolveSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!adminMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAdminMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [adminMenuOpen]);

  function activePassFor(memberId: string) {
    return state.passes.find((pass) => pass.memberId === memberId && pass.active);
  }

  function reservationsFor(memberId: string) {
    return state.reservations.filter((reservation) => reservation.memberId === memberId);
  }

  function memberName(memberId: string) {
    return state.members.find((member) => member.id === memberId)?.name ?? "알 수 없음";
  }

  async function handleGoogleCredential(credential: string) {
    setAuthError("");
    setMessage("Google 계정으로 로그인 중입니다.");

    const { error } = await signInWithGoogle(credential);

    if (error) {
      setAuthStatus("error");
      setAuthError(error.message);
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setAuthStatus("signedOut");
    setAuthEmail("");
    setAuthUserId("");
    setMessage("로그아웃했습니다.");
  }

  function handleAdminMemberModeSelect() {
    setMode("member");
    setAdminMenuOpen(false);
  }

  async function handleAdminSignOut() {
    setAdminMenuOpen(false);
    await handleSignOut();
  }

  async function submitMemberLinkRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !authUserId) {
      setAuthError("로그인 세션을 확인할 수 없습니다.");
      return;
    }

    const displayName = linkName.trim();
    const normalizedPhone = normalizePhone(linkPhone);

    if (displayName.length < 2) {
      setAuthError("이름을 입력해 주세요.");
      return;
    }

    if (normalizedPhone.length < 8) {
      setAuthError("전화번호를 다시 확인해 주세요.");
      return;
    }

    const blockingRequest = state.memberLinkRequests.find(
      (request) => request.authUserId === authUserId && (request.status === "pending" || request.status === "approved")
    );

    if (blockingRequest) {
      setAuthError("");
      setMessage(blockingRequest.status === "approved" ? "이미 승인된 회원 연결 요청이 있습니다." : "이미 승인 대기 중인 요청이 있습니다.");
      return;
    }

    try {
      const request = await submitMemberLinkRequestAction({
        supabase,
        authUserId,
        displayName,
        inputPhone: linkPhone,
        normalizedPhone,
        fallback: () => ({
          id: makeId("link"),
          authUserId,
          memberId: null,
          authProvider: "google",
          displayName,
          inputPhone: linkPhone,
          normalizedPhone,
          status: "pending",
          requestedAt: new Date().toISOString()
        })
      });

      setState((current) => ({
        ...current,
        memberLinkRequests: mergeMemberLinkRequests(current.memberLinkRequests, [request], authUserId)
      }));
      setAuthError("");
      setLinkName("");
      setLinkPhone("");
      setMessage("회원 연결 요청을 보냈습니다. 관리자가 승인하면 회원 화면을 사용할 수 있습니다.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "회원 연결 요청에 실패했습니다.");
    }
  }

  function slotFor(slotId: string) {
    return state.slots.find((slot) => slot.id === slotId);
  }

  async function approveExistingMemberLink(requestId: string, memberId: string) {
    try {
      await approveExistingMemberLinkAction({
        supabase,
        requestId,
        memberId,
        fallback: () => {
          setState((current) => ({
            ...current,
            memberLinkRequests: approveMemberLinkAndRejectDuplicatePendingRequests(
              current.memberLinkRequests,
              requestId,
              memberId
            )
          }));
        }
      });

      if (supabase) {
        await refreshMemberLinkReviewData();
      }

      setMessage("기존 회원에 연결 승인했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "회원 연결 승인에 실패했습니다.");
    }
  }

  async function approveNewMemberLink(requestId: string) {
    const request = state.memberLinkRequests.find((item) => item.id === requestId);

    if (!request) {
      setMessage("회원 연결 요청을 찾을 수 없습니다.");
      return;
    }

    try {
      await approveNewMemberLinkAction({
        supabase,
        request,
        fallback: () => {
          const existingMember = state.members.find((member) => member.normalizedPhone === request.normalizedPhone);
          const memberId = existingMember?.id ?? makeId("member");

          setState((current) => ({
            ...current,
            members: existingMember
              ? current.members
              : [
                  {
                    id: memberId,
                    name: request.displayName,
                    phone: request.inputPhone,
                    normalizedPhone: request.normalizedPhone,
                    status: "active",
                    memo: ""
                  },
                  ...current.members
                ],
            memberLinkRequests: approveMemberLinkAndRejectDuplicatePendingRequests(
              current.memberLinkRequests.map((item) =>
                item.id === requestId ? { ...item, authUserId: item.authUserId ?? request.authUserId } : item
              ),
              requestId,
              memberId
            )
          }));
        }
      });

      if (supabase) {
        await refreshMemberLinkReviewData();
      }

      setMessage("신규 회원을 생성하고 연결 승인했습니다. PT권은 회원 상세에서 별도로 등록하세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "신규 회원 생성 승인에 실패했습니다.");
    }
  }

  async function rejectMemberLink(requestId: string) {
    try {
      await rejectMemberLinkAction({
        supabase,
        requestId,
        fallback: () => {
          setState((current) => ({
            ...current,
            memberLinkRequests: current.memberLinkRequests.map((request) =>
              request.id === requestId ? { ...request, status: "rejected", rejectedAt: new Date().toISOString() } : request
            )
          }));
        }
      });

      if (supabase) {
        await refreshMemberLinkReviewData();
      }

      setMessage("회원 연결 요청을 반려했습니다.");
    } catch {
      setMessage("회원 연결 요청 반려에 실패했습니다.");
    }
  }

  async function approveReservation(reservationId: string) {
    try {
      await approveReservationAction({
        supabase,
        targetReservationId: reservationId,
        fallback: () => {
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
        }
      });
      await refreshOperationalData();
      setMessage("예약을 확정했습니다.");
    } catch {
      setMessage("예약 확정 처리에 실패했습니다.");
    }
  }

  async function rejectReservation(reservationId: string) {
    try {
      await rejectReservationAction({
        supabase,
        targetReservationId: reservationId,
        fallback: () => {
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
        }
      });
      await refreshOperationalData();
      setMessage("예약 요청을 거절하고 슬롯을 다시 열었습니다.");
    } catch {
      setMessage("예약 거절 처리에 실패했습니다.");
    }
  }

  async function completeSession(reservationId: string) {
    try {
      await completeSessionAction({
        supabase,
        targetReservationId: reservationId,
        fallback: () => {
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
        }
      });
      await refreshOperationalData();
      setMessage("수업완료 처리와 1회 차감을 기록했습니다.");
    } catch {
      setMessage("수업완료 처리에 실패했습니다.");
    }
  }

  async function requestBooking(slotId: string) {
    const pass = activePassFor(memberSessionId);
    if (!pass) {
      setMessage("활성 PT권이 없습니다.");
      return;
    }

    try {
      await requestReservationAction({
        supabase,
        targetSlotId: slotId,
        targetPassId: pass.id,
        fallback: () => {
          const futureReservations = reservationsFor(memberSessionId).filter((reservation) =>
            ["requested", "confirmed", "cancel_requested"].includes(reservation.status)
          );

          const bookingLimit =
            state.policies.booking.memberFutureBookingLimit === "remaining_sessions"
              ? pass.remainingSessions
              : state.policies.booking.memberFutureBookingLimit === "fixed_count"
                ? state.policies.booking.fixedFutureBookingLimit
                : Number.POSITIVE_INFINITY;

          if (futureReservations.length >= bookingLimit) {
            throw new Error("future booking limit exceeded");
          }

          if (!state.policies.booking.allowUnpaidBooking && pass.paymentStatus !== "paid") {
            throw new Error("payment required before booking");
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

          return reservationId;
        }
      });
      await refreshOperationalData();
      setMessage("예약 요청을 보냈습니다. 관장 승인 전까지 슬롯이 잠깁니다.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      setMessage(
        errorMessage === "payment required before booking"
          ? "현재 정책에서는 결제완료 전 예약 요청이 제한됩니다."
          : errorMessage === "future booking limit exceeded"
            ? "잔여횟수보다 많은 예약은 요청할 수 없습니다."
            : "예약 요청 처리에 실패했습니다."
      );
    }
  }

  async function requestCancel(reservationId: string) {
    try {
      await requestReservationCancelAction({
        supabase,
        targetReservationId: reservationId,
        fallback: () => {
          let result: "auto_cancelled" | "cancel_requested" = "cancel_requested";

          setState((current) => {
            const reservation = current.reservations.find((item) => item.id === reservationId);
            const slot = reservation ? current.slots.find((item) => item.id === reservation.slotId) : undefined;

            if (!reservation || !slot) {
              return current;
            }

            const canAutoCancel =
              hoursUntil(slot.startAt) >= current.policies.cancellation.autoCancelHoursBeforeSession;

            if (canAutoCancel) {
              result = "auto_cancelled";

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
                  item.id === slot.id ? { ...item, status: "open", heldUntil: undefined, reservationId: undefined } : item
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

          return result;
        }
      });
      await refreshOperationalData();
      setMessage("취소 요청을 처리했습니다.");
    } catch {
      setMessage("취소 요청 처리에 실패했습니다.");
    }
  }

  async function resolveLateCancel(reservationId: string, deduct: boolean) {
    try {
      await resolveLateCancelAction({
        supabase,
        targetReservationId: reservationId,
        shouldDeduct: deduct,
        fallback: () => {
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
                slot.id === reservation.slotId
                  ? { ...slot, status: "open", heldUntil: undefined, reservationId: undefined }
                  : slot
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
        }
      });
      await refreshOperationalData();
      setMessage(deduct ? "취소 차감을 기록했습니다." : "미차감 예외로 처리했습니다.");
    } catch {
      setMessage("취소 차감 처리에 실패했습니다.");
    }
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

  if (authStatus === "checking") {
    return <AuthStatePanel title="로그인 상태 확인 중" body="Supabase 세션과 권한을 확인하고 있습니다." />;
  }

  if (authStatus === "signedOut" || authStatus === "error") {
    return (
      <LoginPanel
        error={authStatus === "error" ? authError : ""}
        googleClientId={googleClientId}
        onGoogleCredential={handleGoogleCredential}
      />
    );
  }

  if (authStatus === "memberPending") {
    return (
      <MemberLinkPanel
        currentRequest={currentMemberLinkRequest}
        email={authEmail}
        error={authError}
        linkName={linkName}
        linkPhone={linkPhone}
        onNameChange={setLinkName}
        onPhoneChange={setLinkPhone}
        onSubmit={submitMemberLinkRequest}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <main className={`app-shell ${mode === "member" ? "member-shell" : ""}`.trim()}>
      {mode === "admin" ? (
        <>
          <header className="topbar">
            <div className="admin-header-identity">
              <strong className="admin-header-brand">강동무에타이장</strong>
              <span className="admin-role-pill">관리자</span>
            </div>

            <div className="admin-header-actions">
              <button className="segmented" onClick={handleAdminMemberModeSelect} type="button">
                <LogIn size={16} />
                회원
              </button>
              <div className="admin-account-menu-wrap" ref={adminMenuRef}>
                <button
                  className="icon-button admin-account-menu-trigger"
                  type="button"
                  aria-label={adminMenuOpen ? "관리자 계정 메뉴 닫기" : "관리자 계정 메뉴 열기"}
                  aria-expanded={adminMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setAdminMenuOpen((open) => !open)}
                >
                  <MoreVertical size={18} />
                </button>
                {adminMenuOpen && (
                  <div className="admin-account-menu" role="menu" aria-label="관리자 계정 메뉴">
                    <span className="admin-account-email-pill">{authStatus === "demo" ? "데모 관리자" : authEmail}</span>
                    {authStatus !== "demo" && (
                      <button className="ghost-button" onClick={handleAdminSignOut} type="button" role="menuitem">
                        로그아웃
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          {shouldShowAdminNotice(message, authEmail) && (
            <section className="status-line" aria-live="polite">
              <Bell size={16} />
              <span>{message}</span>
            </section>
          )}

          <section className="app-surface-flat with-bottom-nav">
            {adminTab === "home" && (
              <AdminHomeView
                tasks={tasks}
                weekDays={weekDays}
                state={state}
                memberName={memberName}
                approveExistingMemberLink={approveExistingMemberLink}
                approveNewMemberLink={approveNewMemberLink}
                rejectMemberLink={rejectMemberLink}
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
                approveExistingMemberLink={approveExistingMemberLink}
                approveNewMemberLink={approveNewMemberLink}
                rejectMemberLink={rejectMemberLink}
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

            <nav className="bottom-tabs admin-bottom-tabs" aria-label="관리자 메뉴">
              <TabButton active={adminTab === "home"} onClick={() => setAdminTab("home")} icon={<Home size={18} />} label="홈" />
              <TabButton active={adminTab === "week"} onClick={() => setAdminTab("week")} icon={<CalendarDays size={18} />} label="일정" />
              <TabButton active={adminTab === "members"} onClick={() => setAdminTab("members")} icon={<Users size={18} />} label="회원" />
              <TabButton active={adminTab === "settings"} onClick={() => setAdminTab("settings")} icon={<Settings size={18} />} label="설정" />
            </nav>
          </section>
        </>
      ) : (
        <MemberView
          authStatus={authStatus}
          handleSignOut={handleSignOut}
          state={state}
          member={loggedInMember}
          memberTab={memberTab}
          setMemberTab={setMemberTab}
          setMode={setMode}
          memberSessionId={memberSessionId}
          setMemberSessionId={setMemberSessionId}
          activePass={activePassFor(loggedInMember.id)}
          reservations={reservationsFor(loggedInMember.id)}
          passEvents={state.passEvents.filter((event) => event.memberId === loggedInMember.id)}
          payments={state.payments.filter((payment) => payment.memberId === loggedInMember.id)}
          extensionRequests={state.extensionRequests.filter((request) => request.memberId === loggedInMember.id)}
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
  memberName,
  approveExistingMemberLink,
  approveNewMemberLink,
  rejectMemberLink
}: {
  tasks: Array<{ id: string; title: string; body: string; badge: string; tone: string }>;
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  state: AppState;
  memberName: (memberId: string) => string;
  approveExistingMemberLink: (requestId: string, memberId: string) => void;
  approveNewMemberLink: (requestId: string) => void;
  rejectMemberLink: (requestId: string) => void;
}) {
  const priorityTasks = tasks.slice(0, 3);
  const hiddenTaskCount = Math.max(0, tasks.length - priorityTasks.length);
  const pendingMemberLinkRequests = reviewablePendingMemberLinkRequests(state.memberLinkRequests);

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
            <p className="eyebrow">회원 연결</p>
            <h2>승인 대기 {pendingMemberLinkRequests.length}</h2>
          </div>
          <UserCheck size={20} />
        </div>
        <MemberLinkReviewList
          members={state.members}
          requests={pendingMemberLinkRequests}
          approveExistingMemberLink={approveExistingMemberLink}
          approveNewMemberLink={approveNewMemberLink}
          rejectMemberLink={rejectMemberLink}
        />
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
  const [scheduleViewMode, setScheduleViewMode] = useState<ScheduleViewMode>("week");
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<ScheduleTypeFilter>("all");
  const showPtSchedule = ptVisibleScheduleTypes.includes(scheduleTypeFilter);

  return (
    <section className="week-screen">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">통합 일정</p>
          <h2>날짜별 운영 현황</h2>
        </div>
        <CalendarDays size={20} />
      </div>
      <div className="schedule-compact-toolbar" aria-label="일정 보기 설정">
        <div className="schedule-select-field">
          <select
            aria-label="일정 보기"
            value={scheduleViewMode}
            onChange={(event) => setScheduleViewMode(event.target.value as ScheduleViewMode)}
          >
            {scheduleViewOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="schedule-select-field">
          <select
            aria-label="일정 타입"
            value={scheduleTypeFilter}
            onChange={(event) => setScheduleTypeFilter(event.target.value as ScheduleTypeFilter)}
          >
            {scheduleTypeFilters.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {showPtSchedule ? (
        <WeekSchedule
          weekDays={weekDays}
          state={state}
          memberName={memberName}
          approveReservation={approveReservation}
          rejectReservation={rejectReservation}
          completeSession={completeSession}
          resolveLateCancel={resolveLateCancel}
          scheduleViewMode={scheduleViewMode}
        />
      ) : (
        <div className="empty-state schedule-class-empty">
          <strong>아직 등록된 수업 일정이 없습니다.</strong>
          <span>설정에서 프로그램 운영 시간을 추가하면 여기에 표시됩니다.</span>
        </div>
      )}
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
  summary = false,
  scheduleViewMode = "month"
}: {
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  state: AppState;
  memberName: (memberId: string) => string;
  approveReservation?: (reservationId: string) => void;
  rejectReservation?: (reservationId: string) => void;
  completeSession?: (reservationId: string) => void;
  resolveLateCancel?: (reservationId: string, deduct: boolean) => void;
  summary?: boolean;
  scheduleViewMode?: ScheduleViewMode;
}) {
  if (summary) {
    return <WeekSummary weekDays={weekDays} state={state} memberName={memberName} />;
  }

  return (
    <MonthlySchedulePicker
      slots={state.slots}
      reservations={state.reservations}
      variant="admin"
      ariaLabel="예약 일정 달력"
      emptyLabel="해당 날짜에 등록된 시간이 없습니다."
      displayMode={scheduleViewMode}
      showWeekStrip={true}
      renderSlot={(slot, reservation) => {
        const status = reservation?.status ?? slot.status;

        return (
          <ScheduleSlotCard
            key={slot.id}
            slot={slot}
            status={status}
          >
            {reservation?.status === "requested" && approveReservation && rejectReservation && (
              <div className="row-actions">
                <IconButton label="승인" onClick={() => approveReservation(reservation.id)} icon={<Check size={16} />} />
                <IconButton label="거절" onClick={() => rejectReservation(reservation.id)} icon={<X size={16} />} />
              </div>
            )}
            {reservation?.status === "confirmed" && completeSession && (
              <div className="row-actions">
                <IconButton label="완료" onClick={() => completeSession(reservation.id)} icon={<Check size={16} />} />
              </div>
            )}
            {reservation?.status === "cancel_requested" && resolveLateCancel && (
              <div className="row-actions">
                <button className="small-button danger" onClick={() => resolveLateCancel(reservation.id, true)}>
                  차감
                </button>
                <button className="small-button" onClick={() => resolveLateCancel(reservation.id, false)}>
                  미차감
                </button>
              </div>
            )}
          </ScheduleSlotCard>
        );
      }}
    />
  );
}

function MonthlySchedulePicker({
  slots,
  reservations,
  variant,
  ariaLabel,
  emptyLabel,
  displayMode = "month",
  showWeekStrip = false,
  renderSlot
}: {
  slots: AvailabilitySlot[];
  reservations: Reservation[];
  variant: "admin" | "member";
  ariaLabel: string;
  emptyLabel: string;
  displayMode?: ScheduleViewMode;
  showWeekStrip?: boolean;
  renderSlot: (slot: AvailabilitySlot, reservation?: Reservation) => ReactNode;
}) {
  const sortedSlots = useMemo(() => [...slots].sort((a, b) => a.startAt.localeCompare(b.startAt)), [slots]);
  const initialDay = scheduleInitialDay(sortedSlots);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [visibleMonth, setVisibleMonth] = useState(monthKey(initialDay));

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, AvailabilitySlot[]>();

    for (const slot of sortedSlots) {
      const day = slotDay(slot);
      groups.set(day, [...(groups.get(day) ?? []), slot]);
    }

    return groups;
  }, [sortedSlots]);
  const reservationsBySlotId = useMemo(
    () => new Map(reservations.map((reservation) => [reservation.slotId, reservation])),
    [reservations]
  );

  useEffect(() => {
    if (sortedSlots.length === 0) {
      const today = todayKey();
      setSelectedDay(today);
      setVisibleMonth(monthKey(today));
      return;
    }

    setSelectedDay((current) => (sortedSlots.some((slot) => slotDay(slot) === current) ? current : scheduleInitialDay(sortedSlots)));
  }, [sortedSlots]);

  const calendarDays = useMemo(() => buildMonthlyCalendarDays(visibleMonth), [visibleMonth]);
  const selectedSlots = slotsByDay.get(selectedDay) ?? [];
  const scheduleDaySummary = getScheduleDaySummary(selectedSlots, reservationsBySlotId, variant);
  const selectedWeekDays = useMemo(() => buildWeekStripDays(selectedDay), [selectedDay]);

  function moveMonth(delta: number) {
    const currentMonth = dayDate(`${visibleMonth}-01`);
    currentMonth.setUTCMonth(currentMonth.getUTCMonth() + delta);
    const nextMonth = monthKey(currentMonth.toISOString().slice(0, 10));
    setVisibleMonth(nextMonth);

    const firstSlotInMonth = sortedSlots.find((slot) => slotDay(slot).startsWith(nextMonth));
    setSelectedDay(firstSlotInMonth ? slotDay(firstSlotInMonth) : `${nextMonth}-01`);
  }

  return (
    <div className={`schedule-picker schedule-view-${displayMode} ${displayMode === "month" ? "schedule-month-first" : "schedule-agenda-first"}`}>
      {showWeekStrip && (
        <section className="schedule-week-strip" aria-label="주간 날짜 선택">
          {selectedWeekDays.map((day) => {
            const daySlots = slotsByDay.get(day) ?? [];
            const daySummary = getScheduleDaySummary(daySlots, reservationsBySlotId, variant);

            return (
              <button
                className={`schedule-strip-day ${daySummary.status} ${selectedDay === day ? "selected" : ""}`}
                type="button"
                key={day}
                onClick={() => {
                  setSelectedDay(day);
                  setVisibleMonth(monthKey(day));
                }}
                aria-pressed={selectedDay === day}
              >
                <span>{weekdayLabel(day)}</span>
                <strong>{dayDate(day).getUTCDate()}</strong>
                {daySummary.label && <i>{daySummary.label}</i>}
              </button>
            );
          })}
        </section>
      )}

      <section className="schedule-calendar" aria-label={ariaLabel}>
        <div className="schedule-calendar-header">
          <button className="icon-button" type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">
            <span aria-hidden="true">‹</span>
          </button>
          <strong>{monthLabel(visibleMonth)}</strong>
          <button className="icon-button" type="button" onClick={() => moveMonth(1)} aria-label="다음 달">
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <div className="schedule-weekdays" aria-hidden="true">
          {["월", "화", "수", "목", "금", "토", "일"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="schedule-date-grid">
          {calendarDays.map((day) => {
            const daySlots = slotsByDay.get(day) ?? [];
            const disabled = daySlots.length === 0;
            const daySummary = getScheduleDaySummary(daySlots, reservationsBySlotId, variant);

            return (
              <button
                className={`schedule-date-button ${daySummary.status} ${selectedDay === day ? "selected" : ""} ${monthKey(day) === visibleMonth ? "" : "outside"}`}
                type="button"
                key={day}
                onClick={() => setSelectedDay(day)}
                disabled={disabled}
                aria-pressed={selectedDay === day}
              >
                <span>{dayDate(day).getUTCDate()}</span>
                {daySummary.label && <i className="schedule-day-label">{daySummary.label}</i>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="schedule-time-list" aria-label={`${formatDateForSchedule(selectedDay)} 시간 목록`}>
        <div className="schedule-time-heading">
          <div>
            <p className="eyebrow">선택 날짜</p>
            <h3>{formatDateForSchedule(selectedDay)}</h3>
          </div>
          <StatusPill value={scheduleDaySummary.status} label={scheduleDaySummary.headingLabel} />
        </div>
        {selectedSlots.length > 0 ? (
          selectedSlots.map((slot) => renderSlot(slot, reservationsBySlotId.get(slot.id)))
        ) : (
          <div className="empty-state">{emptyLabel}</div>
        )}
      </section>
    </div>
  );
}

function ScheduleSlotCard({
  slot,
  status,
  children
}: {
  slot: AvailabilitySlot;
  status: string;
  children?: ReactNode;
}) {
  return (
    <article className={`schedule-slot-card ${status}`}>
      <p className="schedule-slot-time">{timeRangeLabel(slot)}</p>
      <div className="schedule-slot-status">
        <StatusPill value={status} />
      </div>
      <div className="schedule-slot-meta">
        {children}
      </div>
    </article>
  );
}

function MemberScheduleSlotRow({
  slot,
  reservation,
  canRequestBooking,
  requestBooking,
  requestCancel
}: {
  slot: AvailabilitySlot;
  reservation?: Reservation;
  canRequestBooking: boolean;
  requestBooking: (slotId: string) => void;
  requestCancel: (reservationId: string) => void;
}) {
  const rowStatus = reservation?.status ?? slot.status;

  return (
    <article className={`member-slot-row ${rowStatus}`}>
      <p className="schedule-slot-time">{timeRangeLabel(slot)}</p>
      <div className="schedule-slot-status">
        <StatusPill value={rowStatus} label={memberSlotStatusLabel(slot, reservation)} />
      </div>
      <div className="schedule-slot-meta">
        {!reservation && (
          <button className="primary-button" onClick={() => requestBooking(slot.id)} disabled={!canRequestBooking}>
            예약 요청
          </button>
        )}
        {reservation?.status === "confirmed" && (
          <button className="small-button" onClick={() => requestCancel(reservation.id)}>
            취소
          </button>
        )}
      </div>
    </article>
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
  approveExistingMemberLink,
  approveNewMemberLink,
  rejectMemberLink,
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
  approveExistingMemberLink: (requestId: string, memberId: string) => void;
  approveNewMemberLink: (requestId: string) => void;
  rejectMemberLink: (requestId: string) => void;
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
          <MemberLinkReviewList
            members={state.members}
            requests={reviewablePendingMemberLinkRequests(state.memberLinkRequests)}
            approveExistingMemberLink={approveExistingMemberLink}
            approveNewMemberLink={approveNewMemberLink}
            rejectMemberLink={rejectMemberLink}
          />
          <div className="table-list">
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

function MemberLinkReviewList({
  members,
  requests,
  approveExistingMemberLink,
  approveNewMemberLink,
  rejectMemberLink
}: {
  members: Member[];
  requests: MemberLinkRequest[];
  approveExistingMemberLink: (requestId: string, memberId: string) => void;
  approveNewMemberLink: (requestId: string) => void;
  rejectMemberLink: (requestId: string) => void;
}) {
  return (
    <div className="table-list">
      {requests.map((request) => {
        const matchedMember = members.find((member) => member.normalizedPhone === request.normalizedPhone);

        return (
          <div className="table-row member-link-review-row" key={request.id}>
            <span>
              <strong>{request.displayName}</strong> / {request.inputPhone}
              <small>{matchedMember ? `자동 매칭: ${matchedMember.name}` : "자동 매칭 후보 없음"}</small>
            </span>
            <div className="row-actions">
              {matchedMember ? (
                <button className="small-button" onClick={() => approveExistingMemberLink(request.id, matchedMember.id)}>
                  기존 회원 연결
                </button>
              ) : (
                <button className="small-button" onClick={() => approveNewMemberLink(request.id)}>
                  신규 회원 생성 후 승인
                </button>
              )}
              <button className="small-button ghost" onClick={() => rejectMemberLink(request.id)}>
                반려
              </button>
            </div>
          </div>
        );
      })}
      {requests.length === 0 && <div className="empty-state">승인 대기 중인 회원 연결 요청이 없습니다.</div>}
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
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("root");
  const [policySection, setPolicySection] = useState<PolicySection>(null);
  const [selectedDatasets, setSelectedDatasets] = useState<CsvDatasetKey[]>([]);
  const [includePersonalData, setIncludePersonalData] = useState(false);
  const hasSelectedDatasets = selectedDatasets.length > 0;

  function toggleDataset(dataset: CsvDatasetKey, checked: boolean) {
    setSelectedDatasets((current) =>
      checked ? [...current, dataset] : current.filter((item) => item !== dataset)
    );
  }

  function handleDownloadCsv() {
    downloadCsvExport(state, selectedDatasets, includePersonalData);
  }

  function openSection(section: SettingsSection) {
    setSettingsSection(section);
    setPolicySection(null);
  }

  function goToSettingsRoot() {
    setSettingsSection("root");
    setPolicySection(null);
  }

  function goToPoliciesRoot() {
    setSettingsSection("policies");
    setPolicySection(null);
  }

  if (settingsSection === "root") {
    return (
      <section className="section-band settings-menu">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">설정</p>
            <h2>관리 메뉴</h2>
          </div>
          <Settings size={20} />
        </div>
        <div className="settings-menu-grid">
          <SettingsMenuButton
            title="PT 상품"
            body="회차, 가격, 유효일, 활성 여부"
            onClick={() => openSection("products")}
          />
          <SettingsMenuButton
            title="운영 정책"
            body="예약, 취소, 연장, 재등록 기준"
            onClick={() => openSection("policies")}
          />
          <SettingsMenuButton
            title="안내 문구"
            body="예약, 결제, 재등록 복사용 문구"
            onClick={() => openSection("templates")}
          />
          <SettingsMenuButton
            title="CSV 내보내기"
            body="회원, 예약, 결제, 정책 데이터 저장"
            onClick={() => openSection("csv")}
          />
        </div>
      </section>
    );
  }

  if (settingsSection === "products") {
    return (
      <div className="settings-layout">
        <SettingsDetailHeader eyebrow="설정" title="PT 상품" onBack={goToSettingsRoot} />
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
      </div>
    );
  }

  if (settingsSection === "policies" && policySection === null) {
    return (
      <div className="settings-layout">
        <SettingsDetailHeader eyebrow="설정" title="운영 정책" onBack={goToSettingsRoot} />
        <section className="section-band settings-menu">
          <div className="settings-menu-grid">
            <SettingsMenuButton
              title="예약"
              body="공개 범위, 요청 만료, 예약 제한"
              marker="settings-policy-예약"
              onClick={() => setPolicySection("booking")}
            />
            <SettingsMenuButton
              title="취소"
              body="자동취소 기준, 당일취소 차감"
              marker="settings-policy-취소"
              onClick={() => setPolicySection("cancellation")}
            />
            <SettingsMenuButton
              title="연장"
              body="회원 요청 허용, 기본 사유"
              marker="settings-policy-연장"
              onClick={() => setPolicySection("extension")}
            />
            <SettingsMenuButton
              title="재등록"
              body="잔여횟수, 만료일, 회원 노출"
              marker="settings-policy-재등록"
              onClick={() => setPolicySection("renewal")}
            />
          </div>
        </section>
      </div>
    );
  }

  if (settingsSection === "policies" && policySection === "booking") {
    return (
      <div className="settings-layout">
        <SettingsDetailHeader eyebrow="운영 정책" title="예약" onBack={goToPoliciesRoot} />
        <section className="policy-grid">
          <PolicyInput label="공개 주차" value={state.policies.booking.publishWeeks} onChange={(value) => updatePolicy("booking.publishWeeks", value)} />
          <PolicyInput label="요청 만료 시간" value={state.policies.booking.requestExpiryHours} onChange={(value) => updatePolicy("booking.requestExpiryHours", value)} />
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
        </section>
      </div>
    );
  }

  if (settingsSection === "policies" && policySection === "cancellation") {
    return (
      <div className="settings-layout">
        <SettingsDetailHeader eyebrow="운영 정책" title="취소" onBack={goToPoliciesRoot} />
        <section className="policy-grid">
          <PolicyInput label="자동취소 기준" value={state.policies.cancellation.autoCancelHoursBeforeSession} onChange={(value) => updatePolicy("cancellation.autoCancelHoursBeforeSession", value)} />
          <label className="setting-card">
            <span>24시간 이내 기본 차감</span>
            <input
              type="checkbox"
              checked={state.policies.cancellation.lateCancelDefaultDeduct}
              onChange={(event) => updatePolicy("cancellation.lateCancelDefaultDeduct", event.target.checked)}
            />
          </label>
          <label className="setting-card">
            <span>취소 예외 사유</span>
            <input
              value={state.policies.cancellation.exceptionReasons.join(", ")}
              onChange={(event) => updatePolicy("cancellation.exceptionReasons", event.target.value)}
            />
          </label>
        </section>
      </div>
    );
  }

  if (settingsSection === "policies" && policySection === "extension") {
    return (
      <div className="settings-layout">
        <SettingsDetailHeader eyebrow="운영 정책" title="연장" onBack={goToPoliciesRoot} />
        <section className="policy-grid">
          <label className="setting-card">
            <span>회원 연장요청 허용</span>
            <input
              type="checkbox"
              checked={state.policies.extension.memberRequestEnabled}
              onChange={(event) => updatePolicy("extension.memberRequestEnabled", event.target.checked)}
            />
          </label>
          <label className="setting-card">
            <span>연장 사유</span>
            <input
              value={state.policies.extension.defaultReasons.join(", ")}
              onChange={(event) => updatePolicy("extension.defaultReasons", event.target.value)}
            />
          </label>
        </section>
      </div>
    );
  }

  if (settingsSection === "policies" && policySection === "renewal") {
    return (
      <div className="settings-layout">
        <SettingsDetailHeader eyebrow="운영 정책" title="재등록" onBack={goToPoliciesRoot} />
        <section className="policy-grid">
          <PolicyInput label="재등록 잔여횟수" value={state.policies.renewal.remainingSessionsThreshold} onChange={(value) => updatePolicy("renewal.remainingSessionsThreshold", value)} />
          <PolicyInput label="재등록 만료일 기준" value={state.policies.renewal.daysBeforeExpiryThreshold} onChange={(value) => updatePolicy("renewal.daysBeforeExpiryThreshold", value)} />
          <label className="setting-card">
            <span>회원 재등록 안내</span>
            <input
              type="checkbox"
              checked={state.policies.renewal.showToMember}
              onChange={(event) => updatePolicy("renewal.showToMember", event.target.checked)}
            />
          </label>
        </section>
      </div>
    );
  }

  if (settingsSection === "templates") {
    return (
      <div className="settings-layout">
        <SettingsDetailHeader eyebrow="설정" title="안내 문구" onBack={goToSettingsRoot} />
        <section className="section-band">
          <div className="template-grid">
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

  return (
    <div className="settings-layout">
      <SettingsDetailHeader eyebrow="설정" title="CSV 내보내기" onBack={goToSettingsRoot} />
      <section className="section-band">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">데이터 보존</p>
            <h2>CSV 내보내기</h2>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={!hasSelectedDatasets}
            onClick={handleDownloadCsv}
          >
            <ClipboardList size={16} />
            다운로드
          </button>
        </div>
        <div className="csv-export-panel">
          <div className="csv-option-grid" aria-label="CSV 내보내기 데이터 선택">
            {csvDatasetOptions.map((option) => (
              <label className="csv-option" key={option.key}>
                <input
                  type="checkbox"
                  checked={selectedDatasets.includes(option.key)}
                  onChange={(event) => toggleDataset(option.key, event.target.checked)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <label className="csv-privacy-option">
            <input
              type="checkbox"
              checked={includePersonalData}
              onChange={(event) => setIncludePersonalData(event.target.checked)}
            />
            <span>개인정보 포함</span>
          </label>
          <p className="settings-note">
            선택한 항목은 한 파일로 저장됩니다. 개인정보 포함을 켜지 않으면 전화번호 필드는 제외됩니다.
          </p>
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

function SettingsDetailHeader({
  eyebrow,
  title,
  onBack
}: {
  eyebrow: string;
  title: string;
  onBack: () => void;
}) {
  return (
    <section className="settings-detail-header">
      <button className="small-button" type="button" onClick={onBack}>
        뒤로
      </button>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </section>
  );
}

function SettingsMenuButton({
  title,
  body,
  marker,
  onClick
}: {
  title: string;
  body: string;
  marker?: string;
  onClick: () => void;
}) {
  return (
    <button className="settings-menu-button" type="button" data-marker={marker} onClick={onClick}>
      <span>
        <strong>{title}</strong>
        <small>{body}</small>
      </span>
      <b aria-hidden="true">›</b>
    </button>
  );
}

function MemberView({
  authStatus,
  handleSignOut,
  state,
  member,
  memberTab,
  setMemberTab,
  setMode,
  memberSessionId,
  setMemberSessionId,
  activePass,
  reservations,
  passEvents,
  payments,
  extensionRequests,
  weekDays,
  requestBooking,
  requestCancel,
  slotFor
}: {
  authStatus: AuthStatus;
  handleSignOut: () => void | Promise<void>;
  state: AppState;
  member: Member;
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  setMode: (mode: "admin" | "member") => void;
  memberSessionId: string;
  setMemberSessionId: (id: string) => void;
  activePass?: PtPass;
  reservations: Reservation[];
  passEvents: PassEvent[];
  payments: Payment[];
  extensionRequests: ExtensionRequest[];
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  requestBooking: (slotId: string) => void;
  requestCancel: (reservationId: string) => void;
  slotFor: (slotId: string) => AvailabilitySlot | undefined;
}) {
  const linkRequest = state.memberLinkRequests.find((request) => request.memberId === memberSessionId);
  const approvedLink = !linkRequest || linkRequest.status === "approved";
  const [memberMenuOpen, setMemberMenuOpen] = useState(false);
  const memberMenuRef = useRef<HTMLDivElement>(null);
  const memberName = member.name.trim();
  const memberDisplayName =
    linkRequest?.status === "approved" && linkRequest.displayName.trim()
      ? linkRequest.displayName.trim()
      : memberName && !memberName.includes("@")
        ? memberName
        : "회원";

  useEffect(() => {
    if (!memberMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (memberMenuRef.current && !memberMenuRef.current.contains(event.target as Node)) {
        setMemberMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMemberMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [memberMenuOpen]);

  function handleMemberSessionChange(nextMemberId: string) {
    setMemberSessionId(nextMemberId);
    setMemberMenuOpen(false);
  }

  function handleAdminModeSelect() {
    setMode("admin");
    setMemberMenuOpen(false);
  }

  async function handleMemberSignOut() {
    setMemberMenuOpen(false);
    await handleSignOut();
  }

  return (
    <section className="member-app app-surface-flat with-bottom-nav">
      <header className="member-compact-header">
        <div className="member-header-title">
          <strong>{memberDisplayName}</strong>
        </div>
        <StatusPill
          value={approvedLink ? "approved" : linkRequest?.status ?? "pending"}
          label={approvedLink ? "승인됨" : "승인대기"}
        />
        <div className="member-header-menu-wrap" ref={memberMenuRef}>
          <button
            className="icon-button member-header-menu-trigger"
            type="button"
            aria-label={memberMenuOpen ? "회원 메뉴 닫기" : "회원 메뉴 열기"}
            aria-expanded={memberMenuOpen}
            aria-haspopup="menu"
            onClick={() => setMemberMenuOpen((open) => !open)}
          >
            <MoreVertical size={18} />
          </button>
          {memberMenuOpen && (
            <div className="member-header-menu" role="menu" aria-label="회원 메뉴">
              {authStatus === "demo" ? (
                <>
                  <label>
                    <span>회원 선택</span>
                    <select
                      value={memberSessionId}
                      onChange={(event) => handleMemberSessionChange(event.target.value)}
                      aria-label="회원 데모 계정"
                    >
                      {state.members.map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="ghost-button" onClick={handleAdminModeSelect} type="button" role="menuitem">
                    관리자 화면
                  </button>
                </>
              ) : authStatus === "admin" ? (
                <>
                  <button className="ghost-button" onClick={handleAdminModeSelect} type="button" role="menuitem">
                    관리자 화면
                  </button>
                  <button className="ghost-button" onClick={handleMemberSignOut} type="button" role="menuitem">
                    로그아웃
                  </button>
                </>
              ) : (
                <button className="ghost-button" onClick={handleMemberSignOut} type="button" role="menuitem">
                  로그아웃
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {memberTab === "home" && (
        <MemberHomeView
          state={state}
          member={member}
          memberDisplayName={memberDisplayName}
          activePass={activePass}
          reservations={reservations}
          payments={payments}
          extensionRequests={extensionRequests}
          requestCancel={requestCancel}
          slotFor={slotFor}
        />
      )}

      {memberTab === "booking" && (
        <MemberBookingView
          state={state}
          member={member}
          activePass={activePass}
          reservations={reservations}
          weekDays={weekDays}
          requestBooking={requestBooking}
          requestCancel={requestCancel}
        />
      )}

      {memberTab === "history" && (
        <MemberHistoryView
          state={state}
          member={member}
          activePass={activePass}
          reservations={reservations}
          passEvents={passEvents}
          payments={payments}
          extensionRequests={extensionRequests}
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
  memberDisplayName,
  activePass,
  reservations,
  payments,
  extensionRequests,
  requestCancel,
  slotFor
}: {
  state: AppState;
  member: Member;
  memberDisplayName: string;
  activePass?: PtPass;
  reservations: Reservation[];
  payments: Payment[];
  extensionRequests: ExtensionRequest[];
  requestCancel: (reservationId: string) => void;
  slotFor: (slotId: string) => AvailabilitySlot | undefined;
}) {
  const upcomingReservations = reservations
    .filter((reservation) => ["requested", "confirmed", "cancel_requested"].includes(reservation.status))
    .map((reservation) => ({ reservation, slot: slotFor(reservation.slotId) }))
    .filter((item): item is { reservation: Reservation; slot: AvailabilitySlot } => Boolean(item.slot))
    .sort((a, b) => a.slot.startAt.localeCompare(b.slot.startAt));
  const nextReservation = upcomingReservations[0];
  const recentPayment = [...payments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const latestExtensionRequest = [...extensionRequests].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
  const renewalNeeded = activePass ? shouldRenew(activePass, state) : false;
  const homeAlerts = [
    activePass ? buildPaymentAlert(activePass.paymentStatus, recentPayment) : null,
    renewalNeeded && activePass
      ? {
          tone: "warn" as const,
          title: "재등록 상담이 필요한 시점이에요.",
          body: `${renewalGuidance(activePass, state)} 지금 일정과 결제 여부를 같이 확인해 주세요.`
        }
      : null,
    latestExtensionRequest
      ? {
          tone: latestExtensionRequest.status === "approved" ? ("good" as const) : latestExtensionRequest.status === "rejected" ? ("danger" as const) : ("info" as const),
          title: `연장 요청 ${extensionStatusLabel(latestExtensionRequest.status)}`,
          body:
            latestExtensionRequest.status === "requested"
              ? `${latestExtensionRequest.days}일 연장 요청이 접수됐어요. 관장 확인 후 만료일에 반영됩니다.`
              : `${latestExtensionRequest.days}일 연장 요청 ${extensionStatusLabel(latestExtensionRequest.status)} 상태입니다.`
        }
      : null
  ].filter((alert): alert is MemberAlert => Boolean(alert));

  return (
    <div className="member-dashboard">
      <section className="section-band">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">내 PT</p>
            <h2>{memberDisplayName}</h2>
          </div>
          <UserCheck size={20} />
        </div>
        {activePass ? (
          <>
            <div className="metric-grid">
              <Metric label="잔여" value={`${activePass.remainingSessions}회`} tone={activePass.remainingSessions <= 2 ? "warn" : undefined} />
              <Metric label="만료" value={toInputDate(activePass.expiresOn)} tone={renewalNeeded ? "warn" : undefined} />
              <Metric
                label="결제"
                value={statusLabels[activePass.paymentStatus]}
                tone={activePass.paymentStatus === "paid" ? "good" : "warn"}
              />
              <Metric label="재등록" value={renewalNeeded ? "상담 필요" : "정상"} tone={renewalNeeded ? "warn" : "good"} />
            </div>
            <div className="member-summary-stack">
              {homeAlerts.map((alert) => (
                <div className={`member-alert ${alert.tone}`} key={`${alert.title}-${alert.body}`}>
                  <strong>{alert.title}</strong>
                  <p>{alert.body}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">활성 PT권 없음</div>
        )}
      </section>

      <section className="section-band">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">예약 상태</p>
            <h3>내 예약</h3>
          </div>
          {nextReservation && <StatusPill value={nextReservation.reservation.status} />}
        </div>
        {nextReservation ? (
          <div className="member-reservation-list">
            {upcomingReservations.slice(0, 3).map(({ reservation, slot }) => (
              <div className="member-reservation-card" key={reservation.id}>
                <div>
                  <strong>{formatDateTime(slot.startAt)}</strong>
                  <p>{memberReservationSummary(reservation)}</p>
                </div>
                <div className="member-reservation-actions">
                  <StatusPill value={reservation.status} />
                  {reservation.status === "confirmed" && (
                    <button className="small-button" onClick={() => requestCancel(reservation.id)}>
                      취소
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">예정된 예약이 없습니다.</div>
        )}
      </section>

      <section className="section-band wide">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">다음 할 일</p>
            <h3>회원 안내</h3>
          </div>
        </div>
        <div className="member-guidance-list">
          {buildMemberGuidanceItems({
            state,
            activePass,
            nextReservation,
            recentPayment,
            latestExtensionRequest
          }).map((item) => (
            <div className="member-guidance-item" key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MemberBookingView({
  state,
  member,
  activePass,
  reservations,
  weekDays,
  requestBooking,
  requestCancel
}: {
  state: AppState;
  member: Member;
  activePass?: PtPass;
  reservations: Reservation[];
  weekDays: Array<{ day: string; slots: AvailabilitySlot[] }>;
  requestBooking: (slotId: string) => void;
  requestCancel: (reservationId: string) => void;
}) {
  const visibleUntil = addDays(new Date(), state.policies.booking.publishWeeks * 7).getTime();
  const visibleWeekDays = weekDays.map((group) => ({
    ...group,
    slots: group.slots.filter((slot) => new Date(slot.startAt).getTime() <= visibleUntil)
  }));
  const pendingReservationCount = reservations.filter((reservation) => ["requested", "confirmed", "cancel_requested"].includes(reservation.status)).length;
  const memberReservationForSlot = new Map(reservations.map((reservation) => [reservation.slotId, reservation]));
  const activeMemberReservationSlotIds = new Set(
    reservations
      .filter((reservation) => ["requested", "confirmed", "cancel_requested"].includes(reservation.status))
      .map((reservation) => reservation.slotId)
  );
  const visibleMemberSlots = visibleWeekDays
    .flatMap((group) => group.slots)
    .filter((slot) => slot.status === "open" || activeMemberReservationSlotIds.has(slot.id));

  return (
    <section className="week-screen">
      <div className="panel-heading">
        <div>
          <h2>날짜별 가능 시간</h2>
        </div>
        <CalendarDays size={20} />
      </div>

      <section className="member-booking-summary" aria-label="예약 안내 요약">
        <div className="member-inline-stat">
          <span>예약 가능 주차</span>
          <strong>{state.policies.booking.publishWeeks}주</strong>
        </div>
        <div className="member-inline-stat">
          <span>진행 중 예약</span>
          <strong>{pendingReservationCount}건</strong>
        </div>
        <div className="member-inline-stat">
          <span>현재 결제</span>
          <strong>{activePass ? statusLabels[activePass.paymentStatus] : "PT권 없음"}</strong>
        </div>
      </section>

      {activePass && activePass.paymentStatus !== "paid" && (
        <div className="member-alert warn">
          <strong>{member.name}님 결제 상태 확인 필요</strong>
          <p>
            현재 상태는 {statusLabels[activePass.paymentStatus]}입니다.
            {state.policies.booking.allowUnpaidBooking
              ? " 데모 기준으로는 예약 요청이 가능하지만, 운영에서는 결제 확인이 먼저 필요할 수 있습니다."
              : " 현재 정책에서는 결제 확인 전 예약 요청이 제한됩니다."}
          </p>
        </div>
      )}

      <MonthlySchedulePicker
        slots={visibleMemberSlots}
        reservations={reservations}
        variant="member"
        ariaLabel="예약 가능 날짜 달력"
        emptyLabel="해당 날짜에 예약 가능한 시간이 없습니다."
        renderSlot={(slot, reservation = memberReservationForSlot.get(slot.id)) => {
          const canRequestBooking = Boolean(activePass && slot.status === "open" && !reservation);

          return (
            <MemberScheduleSlotRow
              key={slot.id}
              slot={slot}
              reservation={reservation}
              canRequestBooking={canRequestBooking}
              requestBooking={requestBooking}
              requestCancel={requestCancel}
            />
          );
        }}
      />
    </section>
  );
}

function MemberHistoryView({
  state,
  member,
  activePass,
  reservations,
  passEvents,
  payments,
  extensionRequests,
  slotFor
}: {
  state: AppState;
  member: Member;
  activePass?: PtPass;
  reservations: Reservation[];
  passEvents: PassEvent[];
  payments: Payment[];
  extensionRequests: ExtensionRequest[];
  slotFor: (slotId: string) => AvailabilitySlot | undefined;
}) {
  const renewalNeeded = activePass ? shouldRenew(activePass, state) : false;

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
          <>
            <div className="metric-grid">
              <Metric label="상품" value={activePass.policySnapshot.productName} />
              <Metric label="기간" value={`${activePass.startsOn} ~ ${activePass.expiresOn}`} tone={renewalNeeded ? "warn" : undefined} />
              <Metric label="잔여" value={`${activePass.remainingSessions}/${activePass.totalSessions}회`} tone={activePass.remainingSessions <= 2 ? "warn" : undefined} />
              <Metric label="금액" value={formatWon(activePass.price)} />
            </div>
            <div className="member-summary-stack">
              <div className={`member-alert ${renewalNeeded ? "warn" : "info"}`}>
                <strong>{renewalNeeded ? "재등록 안내 대상입니다." : `${member.name}님 회원권 요약`}</strong>
                <p>
                  {renewalNeeded
                    ? renewalGuidance(activePass, state)
                    : `현재 회원권은 ${statusLabels[activePass.paymentStatus]} 상태이며 ${activePass.policySnapshot.createdWithSettingsSummary} 기준으로 등록되었습니다.`}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">활성 PT권 없음</div>
        )}
      </section>

      <section className="section-band">
        <h3>결제 내역</h3>
        <div className="member-history-list">
          {payments.map((payment) => (
            <div className="member-history-card" key={payment.id}>
              <div>
                <strong>{formatWon(payment.amount)}</strong>
                <p>{formatDateTime(payment.updatedAt)}</p>
              </div>
              <div className="member-history-meta">
                <StatusPill value={payment.status} />
                <span>{payment.memo}</span>
              </div>
            </div>
          ))}
          {payments.length === 0 && <div className="empty-state">결제 내역이 없습니다.</div>}
        </div>
      </section>

      <section className="section-band">
        <h3>연장 요청 상태</h3>
        <div className="member-history-list">
          {extensionRequests.map((request) => (
            <div className="member-history-card" key={request.id}>
              <div>
                <strong>{request.days}일 연장 요청</strong>
                <p>{request.reason}</p>
              </div>
              <div className="member-history-meta">
                <StatusPill value={request.status} label={extensionStatusLabel(request.status)} />
                <span>{formatDateTime(request.decidedAt ?? request.requestedAt)}</span>
              </div>
            </div>
          ))}
          {extensionRequests.length === 0 && <div className="empty-state">연장 요청 이력이 없습니다.</div>}
        </div>
      </section>

      <section className="section-band">
        <h3>차감/연장/환불 이력</h3>
        <div className="member-history-list">
          {passEvents.map((event) => (
            <div className="member-history-card" key={event.id}>
              <div>
                <strong>{event.reason}</strong>
                <p>{formatDateTime(event.createdAt)}</p>
              </div>
              <div className="member-history-meta">
                <span>{event.actor === "admin" ? "관장 처리" : event.actor === "system" ? "자동 반영" : "회원 처리"}</span>
                <strong>{event.deltaCount > 0 ? `+${event.deltaCount}` : event.deltaCount}회</strong>
              </div>
            </div>
          ))}
          {passEvents.length === 0 && <div className="empty-state">회원권 이력이 없습니다.</div>}
        </div>
      </section>

      <section className="section-band wide">
        <h3>예약 이력</h3>
        <div className="member-history-list">
          {reservations.map((reservation) => {
            const slot = slotFor(reservation.slotId);
            return (
              <div className="member-history-card" key={reservation.id}>
                <div>
                  <strong>{slot ? formatDateTime(slot.startAt) : "슬롯 없음"}</strong>
                  <p>{memberReservationSummary(reservation)}</p>
                </div>
                <div className="member-history-meta">
                  <StatusPill value={reservation.status} />
                  <span>{slot ? `${timeLabel(slot.startAt)} 시작` : "시간 정보 없음"}</span>
                </div>
              </div>
            );
          })}
          {reservations.length === 0 && <div className="empty-state">예약 이력이 없습니다.</div>}
        </div>
      </section>
    </div>
  );
}

type MemberAlert = {
  tone: "good" | "warn" | "danger" | "info";
  title: string;
  body: string;
};

function buildPaymentAlert(paymentStatus: PaymentStatus, recentPayment?: Payment): MemberAlert | null {
  if (paymentStatus === "paid") {
    return recentPayment
      ? {
          tone: "good",
          title: "결제 확인이 완료되었습니다.",
          body: `${formatDateTime(recentPayment.updatedAt)} 기준 ${recentPayment.memo}`
        }
      : null;
  }

  if (paymentStatus === "boxpos_requested") {
    return {
      tone: "warn",
      title: "결제 요청이 발송된 상태입니다.",
      body: recentPayment?.memo ?? "BOX POS 요청 후 입금 또는 결제 완료 확인이 필요합니다."
    };
  }

  if (paymentStatus === "unpaid") {
    return {
      tone: "danger",
      title: "미납 상태입니다.",
      body: recentPayment?.memo ?? "예약 진행 전 결제 여부를 먼저 확인해 주세요."
    };
  }

  if (paymentStatus === "refunded") {
    return {
      tone: "info",
      title: "환불 처리된 회원권입니다.",
      body: recentPayment?.memo ?? "환불 후 남은 일정과 재등록 여부를 다시 확인해 주세요."
    };
  }

  return null;
}

function renewalGuidance(pass: PtPass, state: AppState) {
  const expiresInDays = Math.ceil((new Date(`${pass.expiresOn}T23:59:59`).getTime() - Date.now()) / 86400000);

  if (pass.remainingSessions <= state.policies.renewal.remainingSessionsThreshold && expiresInDays <= state.policies.renewal.daysBeforeExpiryThreshold) {
    return `잔여 ${pass.remainingSessions}회이며 만료까지 ${Math.max(expiresInDays, 0)}일 남았습니다.`;
  }

  if (pass.remainingSessions <= state.policies.renewal.remainingSessionsThreshold) {
    return `잔여 횟수가 ${pass.remainingSessions}회라 재등록 안내 기준에 들어왔습니다.`;
  }

  return `만료일까지 ${Math.max(expiresInDays, 0)}일 남아 재등록 안내 기준에 들어왔습니다.`;
}

function memberReservationSummary(reservation: Reservation) {
  if (reservation.status === "requested") {
    return "관장 승인 대기 중입니다.";
  }
  if (reservation.status === "confirmed") {
    return "확정된 수업입니다. 24시간 전까지 직접 취소할 수 있습니다.";
  }
  if (reservation.status === "cancel_requested") {
    return "취소 요청이 접수되어 차감 여부를 확인 중입니다.";
  }
  if (reservation.status === "completed") {
    return "수업 완료로 1회가 차감되었습니다.";
  }
  if (reservation.status === "cancelled") {
    return "예약이 취소되었습니다.";
  }
  if (reservation.status === "expired") {
    return "요청 만료로 슬롯이 다시 열렸습니다.";
  }
  if (reservation.status === "no_show") {
    return "노쇼로 처리된 예약입니다.";
  }
  return statusLabels[reservation.status] ?? reservation.status;
}

function memberSlotStatusLabel(slot: AvailabilitySlot, reservation?: Reservation) {
  if (reservation?.status === "confirmed") {
    return "확정";
  }
  if (reservation?.status === "requested") {
    return "대기";
  }
  if (reservation?.status === "cancel_requested") {
    return "취소중";
  }
  if (slot.status === "open") {
    return "가능";
  }
  return statusLabels[slot.status] ?? slot.status;
}

function extensionStatusLabel(status: ExtensionRequest["status"]) {
  if (status === "requested") {
    return "승인대기";
  }
  if (status === "approved") {
    return "승인됨";
  }
  return "반려";
}

function selectedSlotDetailCopy(status: AvailabilitySlot["status"], state: AppState) {
  if (status === "open") {
    return `${state.policies.booking.requestExpiryHours}시간 안에 승인되지 않으면 요청이 자동 만료됩니다.`;
  }
  if (status === "held") {
    return "다른 회원의 요청이 잡혀 있어 지금은 요청할 수 없습니다.";
  }
  if (status === "confirmed") {
    return "이미 확정된 수업 시간입니다.";
  }
  return "운영 정책에 따라 차단된 시간입니다.";
}

function buildMemberGuidanceItems({
  state,
  activePass,
  nextReservation,
  recentPayment,
  latestExtensionRequest
}: {
  state: AppState;
  activePass?: PtPass;
  nextReservation?: { reservation: Reservation; slot: AvailabilitySlot };
  recentPayment?: Payment;
  latestExtensionRequest?: ExtensionRequest;
}) {
  const items = [] as Array<{ title: string; body: string }>;

  if (!activePass) {
    items.push({
      title: "활성 PT권이 없습니다.",
      body: "회원 연결과 PT권 등록이 완료되어야 예약 요청과 이력 확인이 가능합니다."
    });
    return items;
  }

  items.push({
    title: "예약은 주간 표에서 한 칸씩 요청합니다.",
    body: `${state.policies.booking.publishWeeks}주 범위의 공개 슬롯만 보이며 요청은 ${state.policies.booking.requestExpiryHours}시간 동안 잠깁니다.`
  });

  if (nextReservation) {
    items.push({
      title: `가장 가까운 일정: ${formatDateTime(nextReservation.slot.startAt)}`,
      body: memberReservationSummary(nextReservation.reservation)
    });
  }

  if (activePass.paymentStatus !== "paid") {
    items.push({
      title: `결제 상태: ${statusLabels[activePass.paymentStatus]}`,
      body: recentPayment?.memo ?? "미납/결제요청 상태는 회원 화면에 숨기지 않고 계속 표시됩니다."
    });
  }

  if (latestExtensionRequest) {
    items.push({
      title: `연장 요청 ${extensionStatusLabel(latestExtensionRequest.status)}`,
      body: `${latestExtensionRequest.reason} 사유로 ${latestExtensionRequest.days}일 요청되었습니다.`
    });
  }

  if (shouldRenew(activePass, state)) {
    items.push({
      title: "재등록 안내 시점입니다.",
      body: renewalGuidance(activePass, state)
    });
  }

  return items;
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

function scheduleInitialDay(slots: AvailabilitySlot[]) {
  const today = todayKey();
  const firstFutureSlot = slots.find((slot) => slotDay(slot) >= today);
  return firstFutureSlot ? slotDay(firstFutureSlot) : slots[0] ? slotDay(slots[0]) : today;
}

function buildMonthlyCalendarDays(month: string) {
  const firstOfMonth = dayDate(`${month}-01`);
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
  const start = addDays(firstOfMonth, -firstWeekday);

  return Array.from({ length: 42 }, (_, index) => addDays(start, index).toISOString().slice(0, 10));
}

function buildWeekStripDays(day: string) {
  const selected = dayDate(day);
  const mondayOffset = (selected.getUTCDay() + 6) % 7;
  const monday = new Date(selected);
  monday.setUTCDate(selected.getUTCDate() - mondayOffset);

  return Array.from({ length: 7 }, (_item, index) => {
    const current = new Date(monday);
    current.setUTCDate(monday.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

function getScheduleDaySummary(
  daySlots: AvailabilitySlot[],
  reservationsBySlotId: Map<string, Reservation>,
  variant: "admin" | "member"
) {
  if (daySlots.length === 0) {
    return { status: "empty", label: "", headingLabel: "0개" };
  }

  const statuses = daySlots.map((slot) => reservationsBySlotId.get(slot.id)?.status ?? slot.status);

  if (variant === "member") {
    if (statuses.some((status) => status === "confirmed")) {
      return { status: "member-confirmed", label: "내예약", headingLabel: "내 예약" };
    }
    if (statuses.some((status) => status === "requested")) {
      return { status: "member-requested", label: "대기", headingLabel: "요청 대기" };
    }
    if (statuses.some((status) => status === "cancel_requested")) {
      return { status: "member-cancel", label: "취소중", headingLabel: "취소 확인중" };
    }

    const openCount = statuses.filter((status) => status === "open").length;
    if (openCount > 0) {
      return { status: "member-open", label: `가능 ${openCount}`, headingLabel: `예약 가능 ${openCount}개` };
    }

    return { status: "blocked", label: "", headingLabel: "예약 가능 0개" };
  }

  if (statuses.some((status) => status === "requested" || status === "cancel_requested" || status === "held")) {
    return { status: "requested", label: `${daySlots.length}`, headingLabel: `${daySlots.length}개` };
  }
  if (statuses.some((status) => status === "confirmed" || status === "completed")) {
    return { status: "confirmed", label: `${daySlots.length}`, headingLabel: `${daySlots.length}개` };
  }
  if (statuses.some((status) => status === "open")) {
    return { status: "open", label: `${daySlots.length}`, headingLabel: `${daySlots.length}개` };
  }
  return { status: "blocked", label: `${daySlots.length}`, headingLabel: `${daySlots.length}개` };
}

function slotDay(slot: AvailabilitySlot) {
  return slot.startAt.slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(day: string) {
  return day.slice(0, 7);
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

function monthLabel(month: string) {
  return dayDate(`${month}-01`).toLocaleDateString("ko-KR", { year: "numeric", month: "long", timeZone: "UTC" });
}

function formatDateForSchedule(day: string) {
  return dayDate(day).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long", timeZone: "UTC" });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function timeRangeLabel(slot: AvailabilitySlot) {
  return `${timeLabel(slot.startAt)}-${timeLabel(slot.endAt)}`;
}

function dayDate(day: string) {
  return new Date(`${day}T12:00:00Z`);
}

function buildCsvExport(state: AppState, datasets: CsvDatasetKey[], includePersonalData: boolean) {
  const exportedAt = new Date().toISOString();
  const rows = [["exported_at", "dataset", "record_id", "field", "value"]];

  for (const dataset of datasets) {
    for (const record of recordsForCsvDataset(state, dataset)) {
      for (const [field, value] of Object.entries(record.value)) {
        if (!includePersonalData && isPersonalCsvField(dataset, field)) {
          continue;
        }
        rows.push([exportedAt, record.dataset, record.id, field, stringifyCsvValue(value)]);
      }
    }
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function downloadCsvExport(state: AppState, datasets: CsvDatasetKey[], includePersonalData: boolean) {
  if (datasets.length === 0 || typeof document === "undefined") {
    return;
  }

  const csv = buildCsvExport(state, datasets, includePersonalData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gangdong-pt-export-${localDateStamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function recordsForCsvDataset(state: AppState, dataset: CsvDatasetKey) {
  if (dataset === "passProducts") {
    return state.policies.passProducts.map((product) => ({
      dataset: "pt_pass_products",
      id: product.id,
      value: product as Record<string, unknown>
    }));
  }

  if (dataset === "policies") {
    const { passProducts, ...policies } = state.policies;
    return [
      {
        dataset: "policy_settings",
        id: "current",
        value: policies as Record<string, unknown>
      }
    ];
  }

  const values: Record<Exclude<CsvDatasetKey, "passProducts" | "policies">, Array<Record<string, unknown>>> = {
    members: state.members,
    memberLinkRequests: state.memberLinkRequests,
    passes: state.passes,
    passEvents: state.passEvents,
    slots: state.slots,
    reservations: state.reservations,
    payments: state.payments,
    paymentEvents: state.paymentEvents,
    extensionRequests: state.extensionRequests
  };

  return values[dataset].map((item) => ({
    dataset: csvDatasetName(dataset),
    id: String(item.id ?? "unknown"),
    value: item
  }));
}

function csvDatasetName(dataset: CsvDatasetKey) {
  const names: Record<CsvDatasetKey, string> = {
    members: "members",
    memberLinkRequests: "member_link_requests",
    passes: "pt_passes",
    passEvents: "pass_events",
    slots: "availability_slots",
    reservations: "reservations",
    payments: "payments",
    paymentEvents: "payment_events",
    extensionRequests: "extension_requests",
    passProducts: "pt_pass_products",
    policies: "policy_settings"
  };

  return names[dataset];
}

function isPersonalCsvField(dataset: CsvDatasetKey, field: string) {
  return (
    (dataset === "members" && (field === "phone" || field === "normalizedPhone")) ||
    (dataset === "memberLinkRequests" && (field === "inputPhone" || field === "normalizedPhone"))
  );
}

function stringifyCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCsvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

function localDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shouldRenew(pass: PtPass, state: AppState) {
  const expiresInDays = Math.ceil((new Date(`${pass.expiresOn}T23:59:59`).getTime() - Date.now()) / 86400000);
  return (
    pass.remainingSessions <= state.policies.renewal.remainingSessionsThreshold ||
    expiresInDays <= state.policies.renewal.daysBeforeExpiryThreshold
  );
}

function shouldShowAdminNotice(message: string, authEmail: string) {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return false;
  }

  if (authEmail && trimmedMessage.startsWith(`${authEmail} `)) {
    return false;
  }

  return ![
    "데모 데이터가 로드되었습니다.",
    "Supabase 환경변수가 없어 로컬 데모 모드로 실행 중입니다.",
    "Google 로그인 후 관리자/회원 화면을 확인할 수 있습니다.",
    "Google 계정으로 로그인 중입니다.",
    "로그아웃했습니다.",
    "회원 연결 승인 전입니다. 전화번호로 연결 요청을 남겨주세요."
  ].includes(trimmedMessage);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function formatPhoneForInput(phone: string) {
  const digits = normalizePhone(phone).slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.startsWith("02")) {
    if (digits.length <= 5) {
      return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }

    if (digits.length <= 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    }

    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function mergeMemberLinkRequests(
  currentRequests: MemberLinkRequest[],
  nextRequests: MemberLinkRequest[],
  authUserId: string
) {
  const nextIds = new Set(nextRequests.map((request) => request.id));
  const unrelatedRequests = currentRequests.filter(
    (request) => request.authUserId !== authUserId && !nextIds.has(request.id)
  );

  return [...nextRequests, ...unrelatedRequests];
}

function reviewablePendingMemberLinkRequests(requests: MemberLinkRequest[]) {
  const approvedAuthUserIds = new Set(
    requests
      .filter((request) => request.authUserId && request.status === "approved")
      .map((request) => request.authUserId)
  );

  return requests.filter(
    (request) =>
      request.status === "pending" &&
      (!request.authUserId || !approvedAuthUserIds.has(request.authUserId))
  );
}

function approveMemberLinkAndRejectDuplicatePendingRequests(
  requests: MemberLinkRequest[],
  requestId: string,
  memberId: string
) {
  const approvedRequest = requests.find((request) => request.id === requestId);
  const approvedAt = new Date().toISOString();
  const rejectedAt = new Date().toISOString();

  return requests.map((request) => {
    if (request.id === requestId) {
      return { ...request, memberId, status: "approved" as const, approvedAt };
    }

    if (approvedRequest?.authUserId && request.authUserId === approvedRequest.authUserId && request.status === "pending") {
      return { ...request, status: "rejected" as const, rejectedAt };
    }

    return request;
  });
}

function AuthStatePanel({ title, body }: { title: string; body: string }) {
  return (
    <main className="app-shell auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">강동무에타이장</p>
        <h1>{title}</h1>
        <p>{body}</p>
      </section>
    </main>
  );
}

function LoginPanel({
  error,
  googleClientId,
  onGoogleCredential
}: {
  error: string;
  googleClientId: string;
  onGoogleCredential: (credential: string) => void;
}) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const googleError = googleClientId ? error : "NEXT_PUBLIC_GOOGLE_CLIENT_ID가 설정되지 않았습니다.";

  useEffect(() => {
    if (!googleClientId || !googleScriptReady || !googleButtonRef.current || !window.google) {
      return;
    }

    googleButtonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (response.credential) {
          onGoogleCredential(response.credential);
        }
      }
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      logo_alignment: "left"
    });
  }, [googleClientId, googleScriptReady, onGoogleCredential]);

  return (
    <main className="app-shell auth-shell">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleScriptReady(true)} />
      <section className="auth-panel">
        <p className="eyebrow">강동무에타이장</p>
        <h1>PT 운영 관리 로그인</h1>
        <p>관리자는 Google 계정으로 로그인해 운영 화면을 열 수 있습니다.</p>
        {googleError ? <div className="auth-error">{googleError}</div> : null}
        <div className="google-signin-slot" ref={googleButtonRef} />
      </section>
    </main>
  );
}

function MemberLinkPanel({
  currentRequest,
  email,
  error,
  linkName,
  linkPhone,
  onNameChange,
  onPhoneChange,
  onSubmit,
  onSignOut
}: {
  currentRequest?: MemberLinkRequest;
  email: string;
  error: string;
  linkName: string;
  linkPhone: string;
  onNameChange: (name: string) => void;
  onPhoneChange: (phone: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
}) {
  const requestBlocksForm = currentRequest?.status === "pending" || currentRequest?.status === "approved";

  return (
    <main className="app-shell auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">회원 연결 요청</p>
        <h1>승인 대기</h1>
        <p>{email} 계정은 아직 등록된 회원과 연결되지 않았습니다.</p>
        {currentRequest ? (
          <div className="link-request-status">
            <StatusPill value={currentRequest.status} />
            <strong>{currentRequest.displayName}</strong>
            <span>{currentRequest.inputPhone}</span>
            {currentRequest.status === "pending" && <small>관장 승인 후 회원 화면으로 진입할 수 있습니다.</small>}
            {currentRequest.status === "approved" && <small>승인이 완료되었습니다. 새로고침 후 회원 화면이 열립니다.</small>}
            {currentRequest.status === "rejected" && <small>요청이 반려되었습니다. 이름과 전화번호를 확인해 다시 요청할 수 있습니다.</small>}
          </div>
        ) : null}
        {!requestBlocksForm && (
          <form className="auth-form" onSubmit={onSubmit}>
            <label>
              이름
              <input
                autoComplete="name"
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="홍길동"
                value={linkName}
              />
            </label>
            <label>
              전화번호
              <span className="phone-input-frame">
                <input
                  aria-describedby="member-link-phone-help"
                  autoComplete="tel-national"
                  inputMode="numeric"
                  maxLength={13}
                  onChange={(event) => onPhoneChange(formatPhoneForInput(event.target.value))}
                  placeholder="___-____-____"
                  value={linkPhone}
                />
              </span>
              <small id="member-link-phone-help">칸을 누르고 숫자만 입력하세요. 하이픈은 자동으로 들어갑니다.</small>
            </label>
            {error ? <div className="auth-error">{error}</div> : null}
            <button className="primary-button" type="submit">
              연결 요청
            </button>
          </form>
        )}
        {requestBlocksForm && error ? <div className="auth-error">{error}</div> : null}
        <button className="ghost-button" onClick={onSignOut} type="button">
          다른 계정으로 로그인
        </button>
      </section>
    </main>
  );
}

function memberById(state: AppState, memberId: string) {
  return state.members.find((member) => member.id === memberId)?.name ?? "알 수 없음";
}
