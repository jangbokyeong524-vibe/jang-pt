import type { AppState, AvailabilitySlot, PolicySettings } from "@/lib/types";
import { addDays, addHours } from "@/lib/utils";

const now = new Date();
const todayStart = new Date(now);
todayStart.setHours(0, 0, 0, 0);

function isoAt(dayOffset: number, hour: number) {
  const value = addDays(todayStart, dayOffset);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
}

function slot(id: string, dayOffset: number, hour: number, status: AvailabilitySlot["status"] = "open") {
  const start = new Date(isoAt(dayOffset, hour));
  return {
    id,
    startAt: start.toISOString(),
    endAt: addHours(start, 1).toISOString(),
    status
  };
}

export const defaultPolicies: PolicySettings = {
  passProducts: Array.from({ length: 10 }, (_, index) => {
    const sessions = index + 1;
    return {
      id: `product_${sessions}`,
      sessions,
      name: `${sessions}회권`,
      price: sessions * 60000,
      defaultValidDays: sessions <= 5 ? 30 : 60,
      active: true
    };
  }),
  booking: {
    publishWeeks: 4,
    requestExpiryHours: 24,
    memberFutureBookingLimit: "remaining_sessions",
    fixedFutureBookingLimit: 2,
    allowUnpaidBooking: true
  },
  cancellation: {
    autoCancelHoursBeforeSession: 24,
    lateCancelDefaultDeduct: true,
    exceptionReasons: ["질병", "부상", "가족일", "업무 일정", "기타"]
  },
  extension: {
    memberRequestEnabled: true,
    defaultReasons: ["질병", "부상", "출장", "개인사정"]
  },
  renewal: {
    remainingSessionsThreshold: 2,
    daysBeforeExpiryThreshold: 7,
    showToMember: true
  },
  copyTemplates: {
    bookingApproved: "예약 확정되었습니다. {date}에 뵙겠습니다.",
    paymentRequested: "PT {sessions}회권 {amount} 결제 문자를 BOX POS로 발송드렸습니다.",
    renewalNudge: "잔여 PT가 {remaining}회 남았습니다. 다음 등록 일정을 같이 잡아볼까요?"
  }
};

export const initialState: AppState = {
  members: [
    {
      id: "member_1",
      name: "김민준",
      phone: "010-1111-2222",
      normalizedPhone: "01011112222",
      status: "active",
      memo: "평일 저녁 선호"
    },
    {
      id: "member_2",
      name: "이서연",
      phone: "010-3333-4444",
      normalizedPhone: "01033334444",
      status: "active",
      memo: "부상 회복 중, 강도 조절"
    },
    {
      id: "member_3",
      name: "박도윤",
      phone: "010-5555-6666",
      normalizedPhone: "01055556666",
      status: "active",
      memo: "재등록 상담 필요"
    }
  ],
  memberLinkRequests: [
    {
      id: "link_1",
      memberId: "member_2",
      authProvider: "kakao",
      displayName: "서연",
      inputPhone: "010-3333-4444",
      normalizedPhone: "01033334444",
      status: "pending",
      requestedAt: addHours(now, -4).toISOString()
    }
  ],
  passes: [
    {
      id: "pass_1",
      memberId: "member_1",
      productId: "product_10",
      totalSessions: 10,
      remainingSessions: 7,
      price: 600000,
      paymentStatus: "paid",
      startsOn: addDays(now, -12).toISOString().slice(0, 10),
      expiresOn: addDays(now, 48).toISOString().slice(0, 10),
      active: true,
      policySnapshot: {
        productName: "10회권",
        productSessions: 10,
        productPrice: 600000,
        defaultValidDays: 60,
        createdWithSettingsSummary: "10회권 60일, 24시간 전 자동취소"
      }
    },
    {
      id: "pass_2",
      memberId: "member_2",
      productId: "product_5",
      totalSessions: 5,
      remainingSessions: 3,
      price: 300000,
      paymentStatus: "boxpos_requested",
      startsOn: addDays(now, -3).toISOString().slice(0, 10),
      expiresOn: addDays(now, 27).toISOString().slice(0, 10),
      active: true,
      policySnapshot: {
        productName: "5회권",
        productSessions: 5,
        productPrice: 300000,
        defaultValidDays: 30,
        createdWithSettingsSummary: "5회권 30일, 미납 예약 허용"
      }
    },
    {
      id: "pass_3",
      memberId: "member_3",
      productId: "product_3",
      totalSessions: 3,
      remainingSessions: 1,
      price: 180000,
      paymentStatus: "unpaid",
      startsOn: addDays(now, -20).toISOString().slice(0, 10),
      expiresOn: addDays(now, 6).toISOString().slice(0, 10),
      active: true,
      policySnapshot: {
        productName: "3회권",
        productSessions: 3,
        productPrice: 180000,
        defaultValidDays: 30,
        createdWithSettingsSummary: "3회권 30일, 재등록 2회 이하 알림"
      }
    }
  ],
  passEvents: [
    {
      id: "event_1",
      passId: "pass_1",
      memberId: "member_1",
      eventType: "pass_created",
      deltaCount: 10,
      reason: "10회권 등록",
      actor: "admin",
      createdAt: addDays(now, -12).toISOString()
    }
  ],
  slots: [
    slot("slot_1", 0, 18, "confirmed"),
    slot("slot_2", 0, 19, "open"),
    slot("slot_3", 1, 18, "held"),
    slot("slot_4", 1, 19, "open"),
    slot("slot_5", 2, 18, "open"),
    slot("slot_6", 2, 20, "blocked"),
    slot("slot_7", 3, 19, "open"),
    slot("slot_8", 4, 18, "open"),
    slot("slot_9", 6, 10, "open"),
    slot("slot_10", 7, 19, "open"),
    slot("slot_11", 8, 18, "open"),
    slot("slot_12", 9, 19, "open")
  ],
  reservations: [
    {
      id: "reservation_1",
      memberId: "member_1",
      passId: "pass_1",
      slotId: "slot_1",
      status: "confirmed",
      requestedAt: addHours(now, -24).toISOString(),
      confirmedAt: addHours(now, -23).toISOString(),
      policySnapshot: {
        requestExpiryHours: 24,
        autoCancelHoursBeforeSession: 24,
        lateCancelDefaultDeduct: true
      }
    },
    {
      id: "reservation_2",
      memberId: "member_2",
      passId: "pass_2",
      slotId: "slot_3",
      status: "requested",
      requestedAt: addHours(now, -3).toISOString(),
      lockedUntil: addHours(now, 21).toISOString(),
      policySnapshot: {
        requestExpiryHours: 24,
        autoCancelHoursBeforeSession: 24,
        lateCancelDefaultDeduct: true
      }
    }
  ],
  payments: [
    {
      id: "payment_1",
      memberId: "member_1",
      passId: "pass_1",
      amount: 600000,
      status: "paid",
      method: "card",
      memo: "현장 카드 결제 완료",
      updatedAt: addDays(now, -12).toISOString()
    },
    {
      id: "payment_2",
      memberId: "member_2",
      passId: "pass_2",
      amount: 300000,
      status: "boxpos_requested",
      method: "boxpos",
      boxposReference: "BOX POS 문자 발송",
      memo: "회원 결제 확인 대기",
      updatedAt: addHours(now, -6).toISOString()
    },
    {
      id: "payment_3",
      memberId: "member_3",
      passId: "pass_3",
      amount: 180000,
      status: "unpaid",
      method: "boxpos",
      memo: "등록 후 결제 예정",
      updatedAt: addDays(now, -20).toISOString()
    }
  ],
  paymentEvents: [],
  extensionRequests: [
    {
      id: "extension_1",
      memberId: "member_2",
      passId: "pass_2",
      reason: "부상",
      days: 7,
      status: "requested",
      requestedAt: addHours(now, -8).toISOString()
    }
  ],
  notifications: [
    {
      id: "notification_1",
      memberId: "member_3",
      title: "재등록 상담",
      body: "잔여 PT가 1회 남았습니다.",
      createdAt: addHours(now, -5).toISOString(),
      read: false
    }
  ],
  policies: defaultPolicies
};
