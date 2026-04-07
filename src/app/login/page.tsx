"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast-provider";
import { mapAuthError } from "@/lib/errors/auth";
import { authDebug } from "@/lib/auth-debug";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reason = new URLSearchParams(window.location.search).get("reason");
    setSessionExpired(reason === "session");
  }, []);
  const { show } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data: signInData, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      authDebug("login", {
        step: "signInError",
        message: err.message,
        code: (err as { code?: string }).code,
      });
      const friendly = mapAuthError(err.message);
      setError(friendly);
      return;
    }
    authDebug("login", {
      step: "signInSuccess",
      userId: signInData.user?.id,
      sessionExpiresAt: signInData.session?.expires_at,
    });
    if (typeof document !== "undefined") {
      const names = document.cookie
        .split(";")
        .map((c) => c.split("=")[0]?.trim())
        .filter(Boolean);
      authDebug("login", { step: "browserCookieNamesAfterSignIn", names });
    }
    show({
      type: "success",
      title: "Welcome back!",
      description: "You\u2019re now signed in.",
    });
    // Full navigation so session cookies are included on the next request. Client-side
    // router.push can race middleware / AuthRefresh and look "logged out" briefly.
    setTimeout(() => {
      authDebug("login", { step: "navigatingToHome", href: "/" });
      window.location.assign("/");
    }, 150);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-center mb-6">
          Ad Monetization Dashboard
        </h1>
        {sessionExpired && (
          <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
            Your session expired or was invalid. Please sign in again.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-700">
          No account? Sign up is via Supabase Dashboard or admin.
        </p>
      </div>
    </div>
  );
}
