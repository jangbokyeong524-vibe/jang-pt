import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member, MemberLinkRequest } from "@/lib/types";

type DataClient = Pick<SupabaseClient, "from"> | null;
type Fallback<T> = () => T | Promise<T>;

type MemberRow = {
  id: string;
  name: string;
  phone: string;
  normalized_phone: string;
  status: Member["status"];
  memo: string;
};

type MemberLinkRequestRow = {
  id: string;
  auth_user_id?: string;
  member_id: string | null;
  auth_provider: MemberLinkRequest["authProvider"];
  display_name: string;
  input_phone: string;
  normalized_phone: string;
  status: MemberLinkRequest["status"];
  requested_at: string;
  approved_at: string | null;
  rejected_at?: string | null;
};

type MemberLinkRequestIdentityRow = {
  id: string;
  auth_user_id?: string;
  status: MemberLinkRequest["status"];
};

export type MemberLinkReviewData = {
  members: Member[];
  memberLinkRequests: MemberLinkRequest[];
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

function mapMemberLinkRequest(row: MemberLinkRequestRow): MemberLinkRequest {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    memberId: row.member_id,
    authProvider: row.auth_provider,
    displayName: row.display_name,
    inputPhone: row.input_phone,
    normalizedPhone: row.normalized_phone,
    status: row.status,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at ?? undefined,
    rejectedAt: row.rejected_at ?? undefined
  };
}

function normalizeMemberLinkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("member_link_requests_one_open_request_per_auth_user_idx")) {
    return new Error("이미 승인 대기 또는 승인된 요청이 있습니다.");
  }

  if (message.includes("duplicate key") || message.includes("23505") || message.includes("members_normalized_phone_idx")) {
    return new Error("이미 등록된 전화번호입니다. 기존 회원 연결로 승인하세요.");
  }

  return error instanceof Error ? error : new Error(message);
}

export async function fetchOwnMemberLinkRequestsAction({
  supabase,
  authUserId,
  fallback
}: {
  supabase: DataClient;
  authUserId: string;
  fallback: Fallback<MemberLinkRequest[]>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { data, error } = await supabase
    .from("member_link_requests")
    .select("id, auth_user_id, member_id, auth_provider, display_name, input_phone, normalized_phone, status, requested_at, approved_at, rejected_at")
    .eq("auth_user_id", authUserId)
    .order("requested_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapMemberLinkRequest(row as MemberLinkRequestRow));
}

export async function fetchMemberLinkReviewDataAction({
  supabase,
  fallback
}: {
  supabase: DataClient;
  fallback: Fallback<MemberLinkReviewData>;
}) {
  if (!supabase) {
    return fallback();
  }

  const [membersResult, requestsResult] = await Promise.all([
    supabase.from("members").select("id, name, phone, normalized_phone, status, memo").order("name", { ascending: true }),
    supabase
      .from("member_link_requests")
      .select("id, auth_user_id, member_id, auth_provider, display_name, input_phone, normalized_phone, status, requested_at, approved_at, rejected_at")
      .order("requested_at", { ascending: false })
  ]);

  if (membersResult.error) {
    throw membersResult.error;
  }

  if (requestsResult.error) {
    throw requestsResult.error;
  }

  return {
    members: (membersResult.data ?? []).map((row) => mapMember(row as MemberRow)),
    memberLinkRequests: (requestsResult.data ?? []).map((row) => mapMemberLinkRequest(row as MemberLinkRequestRow))
  };
}

export async function submitMemberLinkRequestAction({
  supabase,
  authUserId,
  displayName,
  inputPhone,
  normalizedPhone,
  fallback
}: {
  supabase: DataClient;
  authUserId: string;
  displayName: string;
  inputPhone: string;
  normalizedPhone: string;
  fallback: Fallback<MemberLinkRequest>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { data: existing, error: existingError } = await supabase
    .from("member_link_requests")
    .select("id, auth_user_id, member_id, auth_provider, display_name, input_phone, normalized_phone, status, requested_at, approved_at, rejected_at")
    .eq("auth_user_id", authUserId)
    .in("status", ["pending", "approved"])
    .order("requested_at", { ascending: false })
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  if (existing?.[0]) {
    return mapMemberLinkRequest(existing[0] as MemberLinkRequestRow);
  }

  const { data, error } = await supabase
    .from("member_link_requests")
    .insert({
      auth_user_id: authUserId,
      auth_provider: "google",
      display_name: displayName,
      input_phone: inputPhone,
      normalized_phone: normalizedPhone,
      status: "pending"
    })
    .select("id, auth_user_id, member_id, auth_provider, display_name, input_phone, normalized_phone, status, requested_at, approved_at, rejected_at")
    .single();

  if (error) {
    throw normalizeMemberLinkError(error);
  }

  return mapMemberLinkRequest(data as MemberLinkRequestRow);
}

async function rejectDuplicatePendingMemberLinkRequests({
  supabase,
  approvedRequestId,
  authUserId
}: {
  supabase: DataClient;
  approvedRequestId: string;
  authUserId?: string;
}) {
  if (!supabase || !authUserId) {
    return;
  }

  const { error } = await supabase
    .from("member_link_requests")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString()
    })
    .eq("auth_user_id", authUserId)
    .eq("status", "pending")
    .neq("id", approvedRequestId);

  if (error) {
    throw error;
  }
}

async function findExistingApprovedMemberLinkRequest({
  supabase,
  authUserId,
  requestId
}: {
  supabase: DataClient;
  authUserId?: string;
  requestId: string;
}) {
  if (!supabase || !authUserId) {
    return null;
  }

  const { data, error } = await supabase
    .from("member_link_requests")
    .select("id, auth_user_id, status")
    .eq("auth_user_id", authUserId)
    .eq("status", "approved")
    .neq("id", requestId)
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0] as MemberLinkRequestIdentityRow | undefined) ?? null;
}

export async function approveExistingMemberLinkAction({
  supabase,
  requestId,
  memberId,
  fallback
}: {
  supabase: DataClient;
  requestId: string;
  memberId: string;
  fallback: Fallback<void>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { data: targetRequest, error: targetError } = await supabase
    .from("member_link_requests")
    .select("id, auth_user_id, status")
    .eq("id", requestId)
    .single();

  if (targetError) {
    throw targetError;
  }

  const targetAuthUserId = String(targetRequest.auth_user_id ?? "");
  const existingApprovedRequest = await findExistingApprovedMemberLinkRequest({
    supabase,
    authUserId: targetAuthUserId,
    requestId
  });

  if (existingApprovedRequest) {
    await rejectDuplicatePendingMemberLinkRequests({
      supabase,
      approvedRequestId: existingApprovedRequest.id,
      authUserId: targetAuthUserId
    });
    throw new Error("이미 승인 대기 또는 승인된 요청이 있습니다.");
  }

  const { error } = await supabase
    .from("member_link_requests")
    .update({
      member_id: memberId,
      status: "approved",
      approved_at: new Date().toISOString()
    })
    .eq("id", requestId);

  if (error) {
    throw error;
  }

  await rejectDuplicatePendingMemberLinkRequests({
    supabase,
    approvedRequestId: requestId,
    authUserId: targetAuthUserId
  });
}

export async function approveNewMemberLinkAction({
  supabase,
  request,
  fallback
}: {
  supabase: DataClient;
  request: MemberLinkRequest;
  fallback: Fallback<void>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { data: existingMembers, error: existingError } = await supabase
    .from("members")
    .select("id, name, phone, normalized_phone, status, memo")
    .eq("normalized_phone", request.normalizedPhone)
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  if (existingMembers?.[0]) {
    await approveExistingMemberLinkAction({
      supabase,
      requestId: request.id,
      memberId: String(existingMembers[0].id),
      fallback: async () => undefined
    });
    return;
  }

  const { data: member, error: insertError } = await supabase
    .from("members")
    .insert({
      name: request.displayName,
      phone: request.inputPhone,
      normalized_phone: request.normalizedPhone,
      status: "active",
      memo: ""
    })
    .select("id")
    .single();

  if (insertError) {
    throw normalizeMemberLinkError(insertError);
  }

  await approveExistingMemberLinkAction({
    supabase,
    requestId: request.id,
    memberId: String(member.id),
    fallback: async () => undefined
  });
}

export async function rejectMemberLinkAction({
  supabase,
  requestId,
  fallback
}: {
  supabase: DataClient;
  requestId: string;
  fallback: Fallback<void>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { error } = await supabase
    .from("member_link_requests")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString()
    })
    .eq("id", requestId);

  if (error) {
    throw error;
  }
}
