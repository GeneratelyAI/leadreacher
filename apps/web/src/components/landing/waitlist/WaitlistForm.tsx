"use client";

import { FormEvent, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isDuplicateEmailError(code: string | undefined, message: string) {
  return code === "23505" || message.toLowerCase().includes("duplicate");
}

function isPermissionDeniedError(code: string | undefined, message: string) {
  return (
    code === "42501" ||
    message.toLowerCase().includes("permission denied")
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden
      className="h-3 w-3 shrink-0 opacity-60"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  const supabase = useMemo<SupabaseClient | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("[WaitlistForm] NEXT_PUBLIC_SUPABASE_URL:", url);
    console.log("[WaitlistForm] NEXT_PUBLIC_SUPABASE_ANON_KEY:", key);

    if (!url || !key) {
      console.error(
        "[WaitlistForm] Missing Supabase env vars. Redeploy after setting NEXT_PUBLIC_* in Vercel.",
      );
      return null;
    }

    return createClient();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!supabase) {
      setStatus("error");
      setErrorMessage("Waitlist is temporarily unavailable. Please try again later.");
      return;
    }

    const { error } = await supabase
      .from("Waitlist")
      .insert([{ email: trimmedEmail }]);

    if (error) {
      console.error("[WaitlistForm] Supabase insert failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      if (isPermissionDeniedError(error.code, error.message)) {
        console.error(
          "[WaitlistForm] Table-level GRANT missing for anon. Run in Supabase SQL editor:",
          "GRANT USAGE ON SCHEMA public TO anon;",
          "GRANT INSERT ON public.waitlist TO anon;",
        );
      }

      setStatus("error");
      setErrorMessage(
        isDuplicateEmailError(error.code, error.message)
          ? "You're already on the list."
          : "Something went wrong. Please try again.",
      );
      return;
    }

    setEmail("");
    setStatus("success");
  }

  return (
    <section
      id="waitlist"
      className="relative z-10 w-full px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16"
    >
      <div className="mx-auto w-full max-w-3xl text-center">
        <h2 className="text-3xl font-bold leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.1] lg:text-5xl">
          Be the first to know
          <br />
          when we launch.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-relaxed text-white/55 sm:mt-6 sm:text-base sm:leading-relaxed">
          Join the waitlist and get early access,
          <br />
          product updates, and launch announcements.
        </p>

        {status === "success" && (
          <p className="mt-6 text-sm text-brand-purple-light/90">
            You&apos;re on the list! We&apos;ll be in touch.
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="liquid-glass-pill mx-auto mt-5 flex w-full max-w-2xl items-stretch p-1.5 sm:mt-6 sm:max-w-3xl sm:p-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={status === "loading"}
            className={cn(
              "min-w-0 flex-1 rounded-full bg-transparent px-5 py-3 text-left text-sm text-white placeholder:text-white/38 outline-none sm:px-6 sm:py-3.5 sm:text-base",
              status === "loading" && "opacity-60",
            )}
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className={cn(
              "liquid-glass-button liquid-glass-button--accent shrink-0 rounded-full px-6 py-3 text-sm font-semibold whitespace-nowrap sm:px-10 sm:py-3.5 sm:text-base",
              status === "loading" && "cursor-not-allowed opacity-60",
            )}
          >
            {status === "loading" ? "Joining..." : "Join the Waitlist"}
          </button>
        </form>

        {status === "error" && errorMessage && (
          <p className="mt-4 text-xs text-red-400 sm:text-sm">{errorMessage}</p>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[0.6875rem] text-white/40 sm:mt-7 sm:text-xs">
          <LockIcon />
          We respect your privacy. No spam, ever.
        </p>
      </div>
    </section>
  );
}
