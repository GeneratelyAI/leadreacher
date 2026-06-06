"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus("error");
      setErrorMessage("Please enter your email address.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("waitlist").insert({ email: trimmedEmail });

    if (error) {
      setStatus("error");
      setErrorMessage(
        error.code === "23505"
          ? "This email is already on the waitlist."
          : "Something went wrong. Please try again.",
      );
      return;
    }

    setStatus("success");
    setEmail("");
  }

  return (
    <section id="waitlist" className="bg-brand-bg px-6 py-24">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Join the waitlist
        </h2>
        <p className="mt-4 text-white/60">
          Be the first to know when LeadReacher launches.
        </p>

        {status === "success" ? (
          <p className="mt-8 rounded-2xl border border-brand-purple-light/30 bg-brand-purple-dark/20 px-6 py-4 text-brand-purple-light">
            You&apos;re on the list! We&apos;ll be in touch soon.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={status === "loading"}
              className={cn(
                "flex-1 rounded-full border border-white/10 bg-white/5 px-6 py-4 text-white placeholder:text-white/40 outline-none transition-colors focus:border-brand-purple-light",
                status === "loading" && "opacity-60",
              )}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className={cn(
                "rounded-full bg-brand-purple px-8 py-4 font-semibold text-white transition-colors hover:bg-brand-purple-light",
                status === "loading" && "cursor-not-allowed opacity-60",
              )}
            >
              {status === "loading" ? "Joining..." : "Join the Waitlist"}
            </button>
          </form>
        )}

        {status === "error" && errorMessage && (
          <p className="mt-4 text-sm text-red-400">{errorMessage}</p>
        )}
      </div>
    </section>
  );
}
