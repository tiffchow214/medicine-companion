'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronLeft,
  Clock,
  User,
  AlertCircle,
  X,
  Plus,
} from 'lucide-react';
import {
  getActiveProfile,
  getMedicationsForUser,
  getDosesForUser,
  saveMedicationsForUser,
  saveDosesForUser,
} from '@/lib/storage';
import type {
  Medication,
  DoseInstance,
  MedicationFrequency,
} from '@/lib/medicationTypes';

type FrequencyOption =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'every_6_hours'
  | 'every_12_hours'
  | 'as_needed';

interface FormState {
  name: string;
  dose: string;
  purpose: string;
  instructions: string;
  frequency: FrequencyOption;
  times: string[];
  endDate: string;
  caregiverAlertEnabled: boolean;
  caregiverName: string;
  caregiverEmail: string;
  alertOnSkipped: boolean;
  alertOnMissed: boolean;
}

const DEFAULT_FORM: FormState = {
  name: '',
  dose: '',
  purpose: '',
  instructions: '',
  frequency: 'once_daily',
  times: ['08:00'],
  endDate: '',
  caregiverAlertEnabled: false,
  caregiverName: '',
  caregiverEmail: '',
  alertOnSkipped: true,
  alertOnMissed: true,
};

export default function AddMedicationPage() {
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>('');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const active = getActiveProfile();
    if (!active) {
      router.push('/welcome');
      return;
    }
    setProfileId(active.id);
    setProfileName(active.name);
  }, [router]);

  function updateTimesForFrequency(freq: FrequencyOption) {
    switch (freq) {
      case 'once_daily':
        return ['08:00'];
      case 'twice_daily':
        return ['08:00', '20:00'];
      case 'three_times_daily':
        return ['08:00', '14:00', '20:00'];
      case 'four_times_daily':
        return ['08:00', '12:00', '16:00', '20:00'];
      case 'every_6_hours':
        return ['08:00', '14:00', '20:00', '02:00'];
      case 'every_12_hours':
        return ['08:00', '20:00'];
      case 'as_needed':
        return [];
      default:
        return ['08:00'];
    }
  }

  function handleFrequencyChange(freq: FrequencyOption) {
    setForm((prev) => ({
      ...prev,
      frequency: freq,
      times: updateTimesForFrequency(freq),
    }));
  }

  function handleTimeChange(index: number, value: string) {
    setForm((prev) => {
      const newTimes = [...prev.times];
      newTimes[index] = value;
      return { ...prev, times: newTimes };
    });
  }

  function handleAddTime() {
    setForm((prev) => ({
      ...prev,
      times: [...prev.times, '08:00'],
    }));
  }

  function handleRemoveTime(index: number) {
    setForm((prev) => {
      const newTimes = prev.times.filter((_, i) => i !== index);
      return { ...prev, times: newTimes };
    });
  }

  function makeDrugsDotComUrl(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) return '';
    return `https://www.drugs.com/${slug}.html`;
  }

  function mapFrequencyToType(freq: FrequencyOption): MedicationFrequency {
    const mapping: Record<FrequencyOption, MedicationFrequency> = {
      once_daily: 'once',
      twice_daily: 'twice',
      three_times_daily: 'three',
      four_times_daily: 'four',
      every_6_hours: 'every6h',
      every_12_hours: 'every12h',
      as_needed: 'as_needed',
    };
    return mapping[freq];
  }

  async function saveMedication(options?: { addAnother?: boolean }) {
    setError(null);

    if (!profileId) {
      setError('No active profile found.');
      return;
    }

    if (!form.name.trim() || !form.dose.trim()) {
      setError('Please complete all required fields marked with *.');
      return;
    }

    if (
      form.frequency !== 'as_needed' &&
      (form.times.length === 0 ||
        form.times.some((t) => !/^\d{2}:\d{2}$/.test(t)))
    ) {
      setError('Please enter at least one valid time (HH:MM).');
      return;
    }

    setSaving(true);

    try {
      const meds = getMedicationsForUser(profileId);
      const doses = getDosesForUser(profileId);

      const newMedicationId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const drugsUrl = makeDrugsDotComUrl(form.name);

      const newMedication: Medication = {
        id: newMedicationId,
        userId: profileId,
        name: form.name.trim(),
        dose: form.dose.trim(),
        purpose: form.purpose.trim() || undefined,
        instructions: form.instructions.trim() || undefined,
        frequency: mapFrequencyToType(form.frequency),
        times: form.frequency === 'as_needed' ? [] : form.times,
        endDate: form.endDate || undefined,
        caregiverAlertEnabled: form.caregiverAlertEnabled,
        caregiverName: form.caregiverName || undefined,
        caregiverEmail: form.caregiverEmail || undefined,
        alertOnSkipped: form.caregiverAlertEnabled
          ? form.alertOnSkipped
          : false,
        alertOnMissed: form.caregiverAlertEnabled
          ? form.alertOnMissed
          : false,
        drugsUrl: drugsUrl || undefined,
      };

      const newDoses: DoseInstance[] = [];

      if (form.frequency !== 'as_needed') {
        const today = new Date();
        today.setSeconds(0, 0);

        for (const timeStr of form.times) {
          const [hStr, mStr] = timeStr.split(':');
          const h = Number(hStr);
          const m = Number(mStr);

          const scheduled = new Date(today);
          scheduled.setHours(h, m, 0, 0);

          const doseId = `${newMedicationId}-${timeStr}`;
          newDoses.push({
            id: doseId,
            medicationId: newMedicationId,
            scheduledTime: scheduled.toISOString(),
            status: 'upcoming',
            userId: profileId,
          } as DoseInstance);
        }
      }

      saveMedicationsForUser(profileId, [...meds, newMedication]);
      saveDosesForUser(profileId, [...doses, ...newDoses]);

      if (options?.addAnother) {
        setForm(DEFAULT_FORM);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while saving the medication.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveMedication();
  }

  if (!profileId) {
    return null;
  }

  return (
    <main
      className="min-h-screen"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), url('/med-reminder.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="relative min-h-screen px-4 py-8 md:py-12">
        <main className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="glass-card flex items-center gap-2 rounded-full px-4 py-2.5 text-base font-light text-slate-700 transition hover:bg-white/80"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              Back
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <User className="h-5 w-5 text-[#FACC15]" strokeWidth={2} />
              </div>
              <div className="text-base font-light text-white">
                {profileName}
              </div>
            </div>
          </div>

          {/* Centered title */}
          <div className="mb-10 text-center">
            <h1
              className="mb-3 text-[32px] font-light tracking-tight"
              style={{
                color: '#FACC15',
                WebkitTextFillColor: '#FACC15',
              }}
            >
              Add Your Medications
            </h1>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-coral/10 border border-coral/20 px-5 py-4 text-base text-coral">
              <AlertCircle className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* TWO-COLUMN: Medication Details (left) + Schedule (right) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                alignItems: 'stretch',
              }}
            >
              {/* Medication Details Card */}
              <div className="glass-card rounded-3xl p-8 md:p-10 space-y-8 h-full flex flex-col min-h-[460px]">
                <div>
                  <h2 className="mb-6 text-2xl font-light text-slate-900">
                    Medication Details
                  </h2>
                </div>

                <div className="space-y-6 flex-1">
                  <div className="space-y-2">
                    <label className="block text-lg font-light text-slate-900">
                      Medication name <span className="text-coral">*</span>
                    </label>
                    <input
                      type="text"
                      className="glass-input w-full rounded-2xl px-6 py-4 text-lg text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none"
                      placeholder="e.g. Aspirin, Clopidogrel"
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-lg font-light text-slate-900">
                      Dose (exactly as written){' '}
                      <span className="text-coral">*</span>
                    </label>
                    <input
                      type="text"
                      className="glass-input w-full rounded-2xl px-6 py-4 text-lg text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none"
                      placeholder="e.g. 500 mg, 1 tablet"
                      value={form.dose}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, dose: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-lg font-light text-slate-900">
                      What is this medication for?{' '}
                      <span className="text-slate-400 font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      className="glass-input w-full rounded-2xl px-6 py-4 text-lg text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none"
                      placeholder='"heart health", "blood thinner", "pain relief"'
                      value={form.purpose}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          purpose: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-lg font-light text-slate-900">
                      Doctor&apos;s instructions{' '}
                      <span className="text-slate-400 font-normal">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      className="glass-input w-full rounded-2xl px-6 py-4 text-lg text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none resize-none"
                      rows={3}
                      placeholder="Paste any extra notes from your doctor (e.g. Take with food, do not crush, etc.)"
                      value={form.instructions}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          instructions: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Schedule Card */}
              <div className="glass-card rounded-3xl p-8 md:p-10 space-y-8 h-full flex flex-col min-h-[460px]">
                <div>
                  <h2 className="mb-6 text-2xl font-light text-slate-900 flex items-center gap-4">
                    <Clock className="h-6 w-6 text-soft-teal" strokeWidth={2} />
                    Schedule
                  </h2>
                </div>

                <div className="space-y-6 flex-1">
                  <div className="space-y-3">
                    <label className="block text-lg font-light text-slate-900">
                      How often do you take this?
                    </label>
                    <select
                      className="glass-input w-full rounded-2xl px-5 py-3 text-base text-slate-900 transition-all focus:outline-none"
                      value={form.frequency}
                      onChange={(e) =>
                        handleFrequencyChange(e.target.value as FrequencyOption)
                      }
                    >
                      <option value="once_daily">Once daily</option>
                      <option value="twice_daily">Twice daily</option>
                      <option value="three_times_daily">3× daily</option>
                      <option value="four_times_daily">4× daily</option>
                      <option value="every_6_hours">Every 6 hours</option>
                      <option value="every_12_hours">Every 12 hours</option>
                      <option value="as_needed">As needed</option>
                    </select>
                  </div>

                  {form.frequency !== 'as_needed' && (
                    <div className="space-y-4">
                      <label className="block text-lg font-light text-slate-900">
                        What time(s) do you usually take this?
                      </label>
                      <div className="space-y-3">
                        {form.times.map((time, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <input
                              type="time"
                              className="glass-input flex-1 rounded-2xl px-5 py-3 text-lg text-slate-900 transition-all focus:outline-none"
                              value={time}
                              onChange={(e) =>
                                handleTimeChange(idx, e.target.value)
                              }
                            />
                            {form.times.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTime(idx)}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-coral/10 text-coral transition hover:bg-coral/20"
                              >
                                <X className="h-5 w-5" strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTime}
                        className="flex items-center gap-2 text-sm font-medium text-soft-teal hover:text-soft-teal/80 transition"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2} />
                        Add another time
                      </button>

                      <div className="h-4" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-lg font-light text-slate-900 flex items-center gap-2">
                      <Calendar
                        className="h-5 w-5 text-soft-teal"
                        strokeWidth={2}
                      />
                      End date{' '}
                      <span className="text-slate-400 font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="date"
                      className="glass-input w-full rounded-2xl px-6 py-4 text-lg text-slate-900 transition-all focus:outline-none"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          endDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Save & Add another – now under Schedule (right side) */}
                <div className="pt-4">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveMedication({ addAnother: true })}
                    className="w-full rounded-full px-6 py-3 text-base font-medium shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-400"
                    style={{
                      backgroundColor: '#e5e7eb', // grey
                      color: '#111827', // black-ish
                    }}
                  >
                    {saving ? 'Saving…' : 'Save & Add another medication'}
                  </button>
                </div>
              </div>
            </div>

            {/* Caregiver Alerts Card */}
            <div className="glass-card rounded-3xl p-8 md:p-10 space-y-6">
              <div className="text-center">
                <h2 className="mb-2 text-xl font-light text-slate-900 flex items-center justify-center gap-4">
                  <AlertCircle
                    className="h-6 w-6 text-soft-teal"
                    strokeWidth={2}
                  />
                  Caregiver Alerts (optional)
                </h2>
              </div>

              <label className="flex items-center justify-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.caregiverAlertEnabled}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      caregiverAlertEnabled: e.target.checked,
                    }))
                  }
                  className="h-5 w-5 rounded border-slate-300 text-soft-teal focus:ring-soft-teal"
                />
                <span className="text-base font-light text-slate-700 text-center">
                  Email someone if doses are missed or skipped
                </span>
              </label>

              {form.caregiverAlertEnabled && (
                <div className="space-y-5 pt-4 border-t border-white/40">
                  <div className="space-y-2">
                    <label className="block text-base font-light text-slate-900">
                      Caregiver&apos;s name
                    </label>
                    <input
                      type="text"
                      className="glass-input w-full rounded-2xl px-5 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none"
                      value={form.caregiverName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          caregiverName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-base font-light text-slate-900">
                      Caregiver&apos;s email
                    </label>
                    <input
                      type="email"
                      className="glass-input w-full rounded-2xl px-5 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none"
                      value={form.caregiverEmail}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          caregiverEmail: e.target.value,
                        }))
                      }
                      placeholder="name@example.com"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="text-base font-light text-slate-900">
                      When should we email them?
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.alertOnSkipped}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            alertOnSkipped: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 rounded border-slate-300 text-soft-teal focus:ring-soft-teal"
                      />
                      <span className="text-sm font-light text-slate-600">
                        When a dose is marked as skipped
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.alertOnMissed}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            alertOnMissed: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 rounded border-slate-300 text-soft-teal focus:ring-soft-teal"
                      />
                      <span className="text-sm font-light text-slate-600">
                        When a dose is missed (no response after reminder)
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-end pt-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="glass-card rounded-full px-8 py-4 text-base font-light text-slate-700 transition hover:bg-white/80"
              >
                Cancel
              </button>

              {/* ALWAYS goes to dashboard, no validation/saving required */}
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="rounded-full px-8 py-4 text-base font-medium shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-400"
                style={{
                  backgroundColor: '#FACC15',
                  color: '#111827',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </form>
        </main>
      </div>
    </main>
  );
}
