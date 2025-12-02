'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Trash2, Check } from 'lucide-react';
import {
  getActiveProfile,
  getProfiles,
  setActiveProfile,
  deleteProfile
} from '@/lib/storage';

export default function SettingsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState(getProfiles());
  const [activeProfile, setActiveProfileState] = useState(getActiveProfile());

  useEffect(() => {
    // Redirect if no active profile
    if (!activeProfile) {
      router.push('/welcome');
    }
  }, [activeProfile, router]);

  const handleSwitchProfile = (profileId: string) => {
    setActiveProfile(profileId);
    setActiveProfileState(getActiveProfile());
    setProfiles(getProfiles());
    // Refresh page to reload data
    router.refresh();
  };

  const handleDeleteProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;

    if (
      confirm(
        `Are you sure you want to delete the profile "${profile.name}"? This will permanently delete all medications, doses, and logs associated with this profile.`
      )
    ) {
      deleteProfile(profileId);
      const updatedProfiles = getProfiles();
      setProfiles(updatedProfiles);

      // If we deleted the active profile, redirect to welcome
      if (profileId === activeProfile?.id) {
        const newActive = getActiveProfile();
        if (newActive) {
          setActiveProfileState(newActive);
          router.refresh();
        } else {
          router.push('/welcome');
        }
      } else {
        setActiveProfileState(getActiveProfile());
      }
    }
  };

  if (!activeProfile) {
    return null;
  }

  return (
    <div className="relative min-h-screen px-4 py-8 md:py-12">
      <main className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="glass-card flex items-center gap-2 rounded-full px-4 py-2.5 text-base font-light text-slate-700 transition hover:bg-white/80"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Back
          </button>
        </div>

        <div className="mb-8">
          <h1 className="mb-3 text-[32px] font-light text-slate-900 tracking-tight">
            Settings
          </h1>
          <p className="text-lg font-light text-slate-600 leading-relaxed">
            Manage your profiles and preferences.
          </p>
        </div>

        {/* Profiles Section */}
        <div className="glass-card rounded-3xl p-8 md:p-10 space-y-6">
          <div>
            <h2 className="mb-6 text-xl font-light text-slate-900 flex items-center gap-3">
              <User className="h-6 w-6 text-soft-teal" strokeWidth={2} />
              Profiles
            </h2>
          </div>

          {profiles.length === 0 ? (
            <p className="text-base font-light text-slate-500">
              No profiles found. Create one from the welcome page.
            </p>
          ) : (
            <div className="space-y-4">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="glass-card rounded-2xl p-5 border border-white/40 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-soft-teal/10">
                      <User className="h-6 w-6 text-soft-teal" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="text-lg font-light text-slate-900">
                        {profile.name}
                        {profile.id === activeProfile?.id && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-soft-teal/10 px-2 py-0.5 text-xs font-medium text-soft-teal">
                            <Check className="h-3 w-3" strokeWidth={2} />
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-light text-slate-500">
                        Created {new Date(profile.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {profile.id !== activeProfile?.id && (
                      <button
                        onClick={() => handleSwitchProfile(profile.id)}
                        className="glass-card rounded-full px-4 py-2 text-sm font-light text-soft-teal transition hover:bg-white/80"
                      >
                        Switch
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="glass-card rounded-full p-2 text-coral transition hover:bg-coral/10"
                      aria-label={`Delete profile ${profile.name}`}
                    >
                      <Trash2 className="h-5 w-5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

