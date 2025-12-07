"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { upsertProfile, getActiveProfile } from "@/lib/storage";
import type { UserProfile } from "@/lib/medicationTypes";

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "name">("intro");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Optional: if a profile already exists, skip welcome and go to dashboard
  useEffect(() => {
    const active = getActiveProfile();
    if (active && typeof active === "object" && (active as UserProfile).id) {
      // You can change this to '/add-medication' if you prefer
      router.push("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    if (step === "name") {
      inputRef.current?.focus();
    }
  }, [step]);

  const handleGetStarted = () => setStep("name");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Please enter a clear name (at least 2 characters).");
      return;
    }

    const profile: UserProfile = {
      id: createId(),
      name: trimmed,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    // Save profile for the whole app
    upsertProfile(profile);

    // ✅ Immediately take user to Add Medication page
    router.push("/add-medication");
  };

  // Background style with the dark overlay
  const backgroundStyle: React.CSSProperties = {
    backgroundImage:
      "linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), url('/med-reminder.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
  };

  const whiteTextStyle: React.CSSProperties = { color: "#FFFFFF" };

  const isIntro = step === "intro";
  const isName = step === "name";

  return (
    <main
      style={backgroundStyle}
      className="min-h-screen flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl lg:max-w-3xl space-y-8 text-center backdrop-blur-sm bg-white/5 rounded-2xl shadow-2xl p-6 sm:p-10 md:p-14 border border-white/20">
        {/* HEADER */}
        <header className="mb-8">
          <h1
            className="text-7xl sm:text-8xl font-black tracking-tighter drop-shadow-xl leading-none"
            style={{ color: "#FDE047" }} // Yellow-300
          >
            Medicine Companion
          </h1>
        </header>

        {/* STEP 1: INTRO/WELCOME */}
        {isIntro && (
          <section className="space-y-10">
            <div className="space-y-6">
              <p
                className="text-xl sm:text-2xl font-medium max-w-xl mx-auto leading-relaxed"
                style={whiteTextStyle}
              >
                Receive personalised medication reminders and stay on top of your health!
              </p>
            </div>

            {/* CALL TO ACTION */}
            <div className="space-y-4 max-w-md mx-auto">
              <button
                type="button"
                onClick={handleGetStarted}
                className="w-full rounded-full bg-yellow-400 text-gray-900 font-extrabold text-3xl py-5 px-16 shadow-2xl hover:bg-yellow-500 transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-yellow-500/50 flex items-center justify-center"
                style={{
                  backgroundColor: "#FACC15",
                  color: "#111827",
                }}
              >
                <span className="mr-3">Get Started Now</span>
                <ArrowRight className="h-7 w-7" />
              </button>
            </div>
          </section>
        )}

        {/* STEP 2: NAME INPUT */}
        {isName && (
          <section className="space-y-6 max-w-md mx-auto text-center">
            {/* Heading - white */}
            <h2
              className="text-4xl font-extrabold mb-4 drop-shadow-lg"
              style={{ color: "#FFFFFF" }}
            >
              What is your name?
            </h2>

            <form
              onSubmit={handleSubmit}
              className="space-y-6 max-w-md mx-auto"
            >
              <div className="max-w-md mx-auto">
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  placeholder="Tiffany"
                  className="w-full rounded-xl border-4 border-yellow-400 px-5 py-4 text-2xl font-medium placeholder:text-slate-300 bg-white focus:outline-none focus:ring-4 focus:ring-yellow-400/50 transition"
                  style={{ color: "#000000" }}
                  aria-label="Your Name"
                />

                {error && (
                  <p
                    className="mt-3 text-lg font-semibold"
                    style={{ color: "#F87171" }}
                  >
                    {error}
                  </p>
                )}
              </div>

              {/* Yellow CTA button (matching Page 1) */}
              <button
                type="submit"
                className="w-full rounded-full bg-yellow-400 text-gray-900 font-extrabold text-3xl py-5 shadow-2xl hover:bg-yellow-500 transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-yellow-500/50 flex items-center justify-center"
                style={{
                  backgroundColor: "#FACC15",
                  color: "#111827",
                }}
              >
                <span className="mr-3">Add Medications</span>
                <ArrowRight className="h-7 w-7" />
              </button>
            </form>

            {/* Smaller privacy text, white */}
            <p className="text-sm mt-2" style={{ color: "#FFFFFF" }}>
              (Your name is kept private and secure within this app.)
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
