import type { SupabaseClient } from "@supabase/supabase-js";

type RpcClient = Pick<SupabaseClient, "rpc"> | null;
type Fallback<T> = () => T | Promise<T>;

export const extensionRpcNames = {
  requestExtension: "request_extension",
  approveExtensionRequest: "approve_extension_request",
  rejectExtensionRequest: "reject_extension_request"
} as const;

export async function requestExtensionAction({
  supabase,
  targetPassId,
  reason,
  days,
  fallback
}: {
  supabase: RpcClient;
  targetPassId: string;
  reason: string;
  days: number;
  fallback: Fallback<string>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { data, error } = await supabase.rpc(extensionRpcNames.requestExtension, {
    target_pass_id: targetPassId,
    request_reason: reason,
    request_days: days
  });

  if (error) {
    throw error;
  }

  return String(data);
}

export async function approveExtensionRequestAction({
  supabase,
  targetRequestId,
  fallback
}: {
  supabase: RpcClient;
  targetRequestId: string;
  fallback: Fallback<string>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { data, error } = await supabase.rpc(extensionRpcNames.approveExtensionRequest, {
    target_request_id: targetRequestId
  });

  if (error) {
    throw error;
  }

  return String(data);
}

export async function rejectExtensionRequestAction({
  supabase,
  targetRequestId,
  fallback
}: {
  supabase: RpcClient;
  targetRequestId: string;
  fallback: Fallback<string>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { data, error } = await supabase.rpc(extensionRpcNames.rejectExtensionRequest, {
    target_request_id: targetRequestId
  });

  if (error) {
    throw error;
  }

  return String(data);
}
