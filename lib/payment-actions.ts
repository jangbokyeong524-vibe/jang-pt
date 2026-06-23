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
