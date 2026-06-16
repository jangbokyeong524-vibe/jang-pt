"use client";

import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      window.location.replace("/?auth_error=missing_supabase_env");
      return;
    }

    const code = new URLSearchParams(window.location.search).get("code");
    const sessionPromise = code
      ? supabase.auth.exchangeCodeForSession(code)
      : supabase.auth.getSession();

    sessionPromise.then(({ data, error }) => {
      if (error || !data.session) {
        window.location.replace("/?auth_error=session_missing");
        return;
      }

      window.location.replace("/");
    });
  }, []);

  return (
    <main className="app-shell auth-callback">
      <section className="auth-panel">
        <p className="eyebrow">강동무에타이장</p>
        <h1>로그인 확인 중</h1>
        <p>Google 로그인 결과를 확인하고 있습니다.</p>
      </section>
    </main>
  );
}
