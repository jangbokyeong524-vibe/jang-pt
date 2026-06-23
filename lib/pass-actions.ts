import type { SupabaseClient } from "@supabase/supabase-js";

type RpcClient = Pick<SupabaseClient, "rpc"> | null;
type Fallback<T> = () => T | Promise<T>;

export const passRpcNames = {
  createPtPass: "create_pt_pass"
} as const;

export async function createPtPassAction({
  supabase,
  targetMemberId,
  targetProductId,
  fallback
}: {
  supabase: RpcClient;
  targetMemberId: string;
  targetProductId: string;
  fallback: Fallback<string>;
}) {
  if (!supabase) {
    return fallback();
  }

  const { data, error } = await supabase.rpc(passRpcNames.createPtPass, {
    target_member_id: targetMemberId,
    target_product_id: targetProductId
  });

  if (error) {
    throw error;
  }

  return String(data);
}
