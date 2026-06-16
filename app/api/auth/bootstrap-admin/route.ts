import { NextRequest, NextResponse } from "next/server";
import { adminDisplayName, isAllowedAdminEmail } from "@/lib/auth-config";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "service_role_not_configured" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return NextResponse.json({ error: "missing_access_token" }, { status: 401 });
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ error: "invalid_access_token" }, { status: 401 });
  }

  if (!isAllowedAdminEmail(user.email)) {
    return NextResponse.json({ isAdmin: false });
  }

  const { error: upsertError } = await supabase.from("admin_users").upsert({
    auth_user_id: user.id,
    display_name: adminDisplayName(user.email)
  });

  if (upsertError) {
    return NextResponse.json({ error: "admin_bootstrap_failed" }, { status: 500 });
  }

  return NextResponse.json({ isAdmin: true });
}
