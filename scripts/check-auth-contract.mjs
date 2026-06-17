import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  assert(existsSync(path), `Missing required file: ${path}`);
  return readFileSync(path, "utf8");
}

const authConfig = read("lib/auth-config.ts");
const supabase = read("lib/supabase.ts");
const supabaseServer = read("lib/supabase-server.ts");
const memberLinkActions = read("lib/member-link-actions.ts");
const schema = read("docs/supabase-schema.sql");
const app = read("components/pt-management-app.tsx");
const callbackPage = read("app/auth/callback/page.tsx");
const bootstrapRoute = read("app/api/auth/bootstrap-admin/route.ts");

for (const email of [
  "ydhcjswo.vibe@gmail.com",
  "jbk524@naver.com",
  "jangbokyeong524@gmail.com"
]) {
  assert(authConfig.includes(email), `Missing admin allowlist email: ${email}`);
}

assert(authConfig.includes("isAllowedAdminEmail"), "Missing isAllowedAdminEmail helper");
assert(supabaseServer.includes("server-only"), "Service client helper must be server-only");
assert(supabaseServer.includes("createServiceSupabaseClient"), "Missing server-only service client helper");
assert(supabase.includes("signInWithIdToken"), "Google login must use signInWithIdToken");
assert(!supabase.includes("signInWithOAuth"), "Google login must not use Supabase OAuth redirect");
assert(supabase.includes("NEXT_PUBLIC_GOOGLE_CLIENT_ID"), "Missing public Google Client ID env helper");
assert(callbackPage.includes("AuthCallbackPage"), "Missing auth callback client page");
assert(supabaseServer.includes("SUPABASE_SERVICE_ROLE_KEY"), "Service client must use SUPABASE_SERVICE_ROLE_KEY");
assert(bootstrapRoute.includes("createServiceSupabaseClient"), "Bootstrap route must use the service client helper");
assert(bootstrapRoute.includes("admin_users"), "Bootstrap route must write admin_users");
assert(app.includes("authStatus"), "App must track authStatus");
assert(app.includes("signOut"), "App must provide sign out");
assert(app.includes("Google"), "App must expose Google login");
assert(app.includes("accounts.google.com/gsi/client"), "App must load Google Identity Services");
assert(app.includes("google.accounts.id.renderButton"), "App must render the Google Identity Services button");
assert(app.includes("credential"), "App must handle Google Identity credential tokens");
assert(memberLinkActions.includes("approveExistingMemberLinkAction"), "Missing existing-member link approval action");
assert(memberLinkActions.includes("approveNewMemberLinkAction"), "Missing new-member link approval action");
assert(memberLinkActions.includes("rejectMemberLinkAction"), "Missing member link rejection action");
assert(memberLinkActions.includes("duplicate key"), "Member link actions must map duplicate phone errors");
assert(app.includes("approveExistingMemberLinkAction"), "App must call existing-member link approval action");
assert(app.includes("approveNewMemberLinkAction"), "App must call new-member link approval action");
assert(app.includes("rejectMemberLinkAction"), "App must call member link rejection action");
assert(app.includes("<MemberLinkReviewList"), "Admin views must render member link review controls");
assert(app.includes("pendingMemberLinkRequests"), "Admin home must expose pending member link requests directly");
assert(schema.includes("member_link_requests_one_open_request_per_auth_user_idx"), "Schema must prevent multiple pending/approved link requests per auth user");
assert(schema.includes("where status in ('pending', 'approved')"), "Open link request uniqueness must apply only to pending/approved states");
assert(memberLinkActions.includes("rejectDuplicatePendingMemberLinkRequests"), "Approving a member link must close duplicate pending requests for the same auth user");
assert(memberLinkActions.includes("이미 승인 대기 또는 승인된 요청이 있습니다."), "Duplicate open link requests must show a user-safe message");
assert(app.includes("formatPhoneForInput"), "Member link phone input must format digits with hyphens while typing");
assert(app.includes("inputMode=\"numeric\""), "Member link phone input should use a numeric keypad");
assert(app.includes("autoComplete=\"tel-national\""), "Member link phone input should use phone autocomplete");
assert(app.includes("aria-describedby=\"member-link-phone-help\""), "Member link phone input needs concise helper copy");

console.log("Auth contract check passed.");
