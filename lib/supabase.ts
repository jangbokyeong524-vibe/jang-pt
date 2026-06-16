import { createClient } from "@supabase/supabase-js";

function supabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  };
}

export function getGoogleClientId() {
  return supabaseEnv().googleClientId ?? "";
}

export function createBrowserSupabaseClient() {
  const { url, anonKey } = supabaseEnv();

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}

export async function signInWithGoogle(credential: string) {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return { error: new Error("Supabase 환경변수가 설정되지 않았습니다.") };
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential
  });

  return { error };
}
