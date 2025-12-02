'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { upsertProfile, getActiveProfile } from '@/lib/storage';
import type { UserProfile } from '@/lib/medicationTypes';

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Redirect if a profile already exists
  useEffect(() => {
    const existing = getActiveProfile();
    if (existing && typeof existing === 'object' && existing.id) {
      router.push('/dashboard');
      return;
    }
    inputRef.current?.focus();
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Please enter at least 2 characters.');
      return;
    }

    const profile: UserProfile = {
      id: createId(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    upsertProfile(profile);
    router.push('/add-medication');
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 md:py-16">
      {/* Hero Image - Full width with rounded corners */}
      <div className="w-full max-w-2xl mb-12 md:mb-16">
        <img
          src="/medicine-reminder-hero.png"
          alt="Medicine reminder hero"
          className="w-full rounded-3xl shadow-glass-lg"
        />
      </div>

      {/* Main Card - Glassmorphism */}
      <div className="w-full max-w-2xl">
        <section className="glass-card rounded-3xl p-8 md:p-12 shadow-glass-lg">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 className="mb-4 text-[32px] md:text-[36px] font-light text-slate-900 tracking-tight">
              Medication Companion
            </h1>
            <p className="text-lg md:text-xl text-slate-600 leading-relaxed font-light max-w-xl mx-auto">
              A gentle helper to keep you on track with your medications.
              This app sends reminders, but never replaces medical advice from your doctor.
            </p>
          </div>

          {/* Step Indicator */}
          <div className="mb-10 text-center">
            <span className="inline-block rounded-full bg-soft-teal/10 px-6 py-2 text-sm font-medium text-soft-teal">
              Step 1 of 2
            </span>
          </div>

          {/* Name Input Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label
                htmlFor="name"
                className="mb-4 block text-xl font-light text-slate-900"
              >
                What&apos;s your name?
              </label>

              <input
                ref={inputRef}
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Enter your name"
                className="glass-input w-full rounded-2xl px-6 py-5 text-lg text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none"
                required
                minLength={2}
              />

              {error && (
                <p className="mt-3 text-base text-coral font-medium" role="alert">
                  {error}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary w-full rounded-full px-8 py-5 text-lg font-medium text-white flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-soft-teal"
            >
              Next
              <ArrowRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
