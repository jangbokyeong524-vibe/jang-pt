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

console.log("Auth contract check passed.");
