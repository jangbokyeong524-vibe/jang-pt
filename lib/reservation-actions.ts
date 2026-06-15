import type { SupabaseClient } from "@supabase/supabase-js";

type RpcClient = Pick<SupabaseClient, "rpc"> | null;
type Fallback<T> = () => T | Promise<T>;

type RpcActionOptions<T> = {
  supabase: RpcClient;
  rpcName: string;
  args: Record<string, unknown>;
  fallback: Fallback<T>;
};

export const reservationRpcNames = {
  requestReservation: "request_reservation",
  approveReservation: "approve_reservation",
  rejectReservation: "reject_reservation",
  requestReservationCancel: "request_reservation_cancel",
  resolveLateCancel: "resolve_late_cancel",
  completeSession: "complete_session"
} as const;

async function runReservationRpc<T>({
  supabase,
  rpcName,
  args,
  fallback
}: RpcActionOptions<T>): Promise<T> {
  if (!supabase) {
    return fallback();
  }

  const { data, error } = await supabase.rpc(rpcName, args);

  if (error) {
    throw error;
  }

  return data as T;
}

export function requestReservationAction({
  supabase,
  targetSlotId,
  targetPassId,
  fallback
}: {
  supabase: RpcClient;
  targetSlotId: string;
  targetPassId: string;
  fallback: Fallback<string>;
}) {
  return runReservationRpc<string>({
    supabase,
    rpcName: reservationRpcNames.requestReservation,
    args: {
      target_slot_id: targetSlotId,
      target_pass_id: targetPassId
    },
    fallback
  });
}

export function approveReservationAction({
  supabase,
  targetReservationId,
  fallback
}: {
  supabase: RpcClient;
  targetReservationId: string;
  fallback: Fallback<void>;
}) {
  return runReservationRpc<void>({
    supabase,
    rpcName: reservationRpcNames.approveReservation,
    args: {
      target_reservation_id: targetReservationId
    },
    fallback
  });
}

export function rejectReservationAction({
  supabase,
  targetReservationId,
  fallback
}: {
  supabase: RpcClient;
  targetReservationId: string;
  fallback: Fallback<void>;
}) {
  return runReservationRpc<void>({
    supabase,
    rpcName: reservationRpcNames.rejectReservation,
    args: {
      target_reservation_id: targetReservationId
    },
    fallback
  });
}

export function requestReservationCancelAction({
  supabase,
  targetReservationId,
  fallback
}: {
  supabase: RpcClient;
  targetReservationId: string;
  fallback: Fallback<"auto_cancelled" | "cancel_requested">;
}) {
  return runReservationRpc<"auto_cancelled" | "cancel_requested">({
    supabase,
    rpcName: reservationRpcNames.requestReservationCancel,
    args: {
      target_reservation_id: targetReservationId
    },
    fallback
  });
}

export function resolveLateCancelAction({
  supabase,
  targetReservationId,
  shouldDeduct,
  fallback
}: {
  supabase: RpcClient;
  targetReservationId: string;
  shouldDeduct: boolean;
  fallback: Fallback<void>;
}) {
  return runReservationRpc<void>({
    supabase,
    rpcName: reservationRpcNames.resolveLateCancel,
    args: {
      target_reservation_id: targetReservationId,
      should_deduct: shouldDeduct
    },
    fallback
  });
}

export function completeSessionAction({
  supabase,
  targetReservationId,
  fallback
}: {
  supabase: RpcClient;
  targetReservationId: string;
  fallback: Fallback<void>;
}) {
  return runReservationRpc<void>({
    supabase,
    rpcName: reservationRpcNames.completeSession,
    args: {
      target_reservation_id: targetReservationId
    },
    fallback
  });
}
