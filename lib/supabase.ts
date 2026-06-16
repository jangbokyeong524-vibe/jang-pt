import { createClient } from "@supabase/supabase-js";

function supabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
}

export function createBrowserSupabaseClient() {
  const { url, anonKey } = supabaseEnv();

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}

export async function signInWithGoogle(redirectTo: string) {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return { error: new Error("Supabase 환경변수가 설정되지 않았습니다.") };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo
    }
  });

  return { error };
}
