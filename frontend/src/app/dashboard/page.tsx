'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  Pill,
  Calendar,
  Plus,
  User,
  Settings,
  CheckCircle2,
  BookOpen
} from 'lucide-react';

import {
  getActiveProfile,
  getMedicationsForUser,
  getDosesForUser,
  updateDoseStatus,
  addDoseLog,
  upsertDoses
} from '@/lib/storage';
import { useReminderScheduler } from '@/hooks/useReminderScheduler';
import { ReminderModal } from '@/components/ReminderModal';
import { MedicationInfoModal } from '@/components/MedicationInfoModal';
import type { Medication, DoseInstance } from '@/lib/medicationTypes';
import { sendCaregiverAlert } from '@/lib/caregiverClient';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(getActiveProfile());
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doses, setDoses] = useState<DoseInstance[]>([]);
  const [selectedMedicationForInfo, setSelectedMedicationForInfo] =
    useState<Medication | null>(null);

  const {
    dueDose,
    currentMedication,
    clearDueDose,
    markDoseTaken,
    markDoseSkipped,
    snoozeDose
  } = useReminderScheduler();

  useEffect(() => {
    const active = getActiveProfile();
    if (!active) {
      router.push('/welcome');
      return;
    }
    setProfile(active);
    loadData(active.id);
  }, [router]);

  const loadData = (userId: string) => {
    setMedications(getMedicationsForUser(userId));
    setDoses(getDosesForUser(userId));
  };

  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(() => {
      loadData(profile.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [profile]);

  const todayDoses = useMemo(() => {
    if (!profile) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return doses.filter((dose) => {
      const scheduled = new Date(dose.scheduledTime);
      return scheduled >= today && scheduled < tomorrow;
    });
  }, [doses, profile]);

  const dosesByMedication = useMemo(() => {
    const groups: Record<string, DoseInstance[]> = {};
    for (const dose of todayDoses) {
      if (!groups[dose.medicationId]) {
        groups[dose.medicationId] = [];
      }
      groups[dose.medicationId].push(dose);
    }
    return groups;
  }, [todayDoses]);

  const progress = useMemo(() => {
    const taken = todayDoses.filter((d) => d.status === 'taken').length;
    const total = todayDoses.length;
    return { taken, total, percentage: total > 0 ? (taken / total) * 100 : 0 };
  }, [todayDoses]);

  const nextDose = useMemo(() => {
    const upcoming = todayDoses
      .filter((d) => d.status === 'upcoming' || d.status === 'due')
      .sort(
        (a, b) =>
          new Date(a.scheduledTime).getTime() -
          new Date(b.scheduledTime).getTime()
      )[0];
    return upcoming;
  }, [todayDoses]);

  const handleDoseTaken = (doseId: string) => {
    if (!profile) return;
    const takenAt = new Date().toISOString();
    const dose = doses.find((d) => d.id === doseId);

    updateDoseStatus(profile.id, doseId, 'taken', takenAt);
    addDoseLog(profile.id, {
      id: `${Date.now()}-${Math.random()}`,
      userId: profile.id,
      medicationId: dose?.medicationId || '',
      doseId,
      status: 'taken',
      createdAt: takenAt
    });

    loadData(profile.id);
  };

  const handleDoseSkipped = (doseId: string) => {
    if (!profile) return;
    const dose = doses.find((d) => d.id === doseId);
    if (!dose) return;

    updateDoseStatus(profile.id, doseId, 'skipped');
    addDoseLog(profile.id, {
      id: `${Date.now()}-${Math.random()}`,
      userId: profile.id,
      medicationId: dose.medicationId,
      doseId,
      status: 'skipped',
      createdAt: new Date().toISOString()
    });

    const medication = medications.find((m) => m.id === dose.medicationId);
    if (
      medication &&
      medication.caregiverAlertEnabled &&
      medication.caregiverEmail &&
      medication.alertOnSkipped
    ) {
      sendCaregiverAlert({
        caregiver_name: medication.caregiverName || 'Caregiver',
        caregiver_email: medication.caregiverEmail,
        patient_name: profile.name,
        medication_name: medication.name,
        scheduled_time: dose.scheduledTime,
        status: 'skipped',
        reason: 'User marked dose as skipped from dashboard.'
      }).catch((err) => {
        console.error('Failed to send caregiver alert:', err);
      });
    }

    loadData(profile.id);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: DoseInstance['status']) => {
    switch (status) {
      case 'taken':
        return 'bg-warm-green text-white';
      case 'due':
        return 'bg-[#FF8800] text-white';
      case 'missed':
        return 'bg-coral text-white';
      case 'skipped':
        return 'bg-slate-400 text-white';
      default:
        return 'bg-soft-teal text-white';
    }
  };

  const getStatusLabel = (status: DoseInstance['status']) => {
    switch (status) {
      case 'taken':
        return 'Taken';
      case 'due':
        return 'Due Now';
      case 'missed':
        return 'Missed';
      case 'skipped':
        return 'Skipped';
      default:
        return 'Upcoming';
    }
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="relative min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        {/* Header with greeting */}
        <div className="mb-10">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-soft-teal/10">
                <User className="h-7 w-7 text-soft-teal" strokeWidth={2} />
              </div>
              <div>
                <div className="text-xl font-light text-slate-900">
                  {profile.name}
                </div>
                <div className="text-base font-light text-slate-500">
                  {formatDate(new Date())}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push('/settings')}
              className="glass-card flex h-12 w-12 items-center justify-center rounded-full text-slate-600 transition hover:bg-white/80"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          <h1 className="text-[32px] md:text-[36px] font-light text-slate-900 tracking-tight">
            {getGreeting()}, {profile.name}!
          </h1>
        </div>

        {/* Today's Progress Card */}
        <div className="glass-card mb-8 rounded-3xl p-8 md:p-10 shadow-glass-lg">
          <h2 className="mb-6 text-xl font-light text-slate-900">
            Today&apos;s Progress
          </h2>
          <div className="flex items-center gap-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warm-green/10">
              <CheckCircle2 className="h-10 w-10 text-warm-green" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <div className="mb-2 text-2xl font-light text-slate-900">
                {progress.taken} of {progress.total} doses taken
              </div>
              {/* Progress bar */}
              {progress.total > 0 && (
                <div className="mb-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-soft-teal to-warm-green transition-all duration-500 rounded-full"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              )}
              {nextDose ? (
                <div className="flex items-center gap-2 text-lg font-light text-slate-600">
                  <Clock className="h-5 w-5 text-soft-teal" strokeWidth={2} />
                  <span>
                    Next:{' '}
                    {medications.find((m) => m.id === nextDose.medicationId)
                      ?.name || 'Medication'}{' '}
                    at{' '}
                    {new Date(nextDose.scheduledTime).toLocaleTimeString(
                      'en-US',
                      {
                        hour: 'numeric',
                        minute: '2-digit'
                      }
                    )}
                  </span>
                </div>
              ) : (
                <div className="text-lg font-light text-slate-500">No upcoming doses</div>
              )}
            </div>
          </div>
        </div>

        {/* Medication Cards */}
        <div className="space-y-6">
          {medications.map((medication) => {
            const medDoses = dosesByMedication[medication.id] || [];
            if (medDoses.length === 0 && medication.frequency !== 'as_needed') {
              return null;
            }

            return (
              <div
                key={medication.id}
                className="glass-card rounded-3xl p-8 md:p-10 shadow-glass-lg"
              >
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-soft-teal/10 flex-shrink-0">
                      <Pill className="h-7 w-7 text-soft-teal" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="mb-2 text-2xl font-light text-slate-900">
                        {medication.name}
                      </h3>
                      <div className="text-lg font-light text-slate-600 mb-1">
                        <span className="font-normal">Dose:</span> {medication.dose}
                      </div>
                      {medication.purpose && (
                        <div className="text-base font-light text-slate-500">
                          For: {medication.purpose}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMedicationForInfo(medication)}
                    className="glass-card flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-light text-soft-teal transition hover:bg-white/80 flex-shrink-0"
                  >
                    <BookOpen className="h-4 w-4" strokeWidth={2} />
                    Learn More
                  </button>
                </div>

                {medication.instructions && (
                  <div className="mb-6 rounded-2xl bg-soft-teal/5 border border-soft-teal/20 p-5 text-base font-light text-slate-700">
                    <span className="font-normal">Instructions:</span> {medication.instructions}
                  </div>
                )}

                {/* Dose Items */}
                <div className="space-y-4">
                  {medDoses.map((dose) => {
                    const scheduledTime = new Date(dose.scheduledTime);
                    const timeStr = scheduledTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={dose.id}
                        className="glass-card rounded-2xl p-6 border border-white/40"
                      >
                        <div className="mb-5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Clock className="h-6 w-6 text-soft-teal" strokeWidth={2} />
                            <span className="text-xl font-light text-slate-900">
                              {timeStr}
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-5 py-1.5 text-sm font-medium ${getStatusColor(
                              dose.status
                            )}`}
                          >
                            {getStatusLabel(dose.status)}
                          </span>
                        </div>
                        {dose.takenAt && (
                          <div className="mb-4 flex items-center gap-2 text-base font-light text-slate-600">
                            <CheckCircle2 className="h-5 w-5 text-warm-green" strokeWidth={2} />
                            <span>
                              Taken at{' '}
                              {new Date(dose.takenAt).toLocaleTimeString(
                                'en-US',
                                {
                                  hour: 'numeric',
                                  minute: '2-digit'
                                }
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3">
                          {dose.status !== 'taken' && (
                            <>
                              <button
                                onClick={() => handleDoseTaken(dose.id)}
                                className="btn-success flex-1 rounded-full px-6 py-4 text-lg font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-green"
                              >
                                Take Dose
                              </button>
                              <button
                                onClick={() => handleDoseSkipped(dose.id)}
                                className="rounded-full bg-coral px-6 py-4 text-lg font-medium text-white shadow-soft transition hover:bg-coral/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
                              >
                                Skip
                              </button>
                              <button
                                onClick={() => {
                                  const current =
                                    dose.scheduledTime.slice(11, 16);
                                  const newTime =
                                    window.prompt(
                                      'Choose a new time for this dose (HH:MM)',
                                      current
                                    ) ?? current;
                                  if (!/^\d{2}:\d{2}$/.test(newTime)) return;
                                  const [h, m] = newTime
                                    .split(':')
                                    .map(Number);
                                  const newDate = new Date(dose.scheduledTime);
                                  newDate.setHours(h, m, 0, 0);
                                  const updated: DoseInstance = {
                                    ...dose,
                                    scheduledTime: newDate.toISOString(),
                                    status: 'upcoming'
                                  };
                                  upsertDoses(profile.id, [updated]);
                                  loadData(profile.id);
                                }}
                                className="glass-card rounded-full px-6 py-4 text-base font-light text-slate-700 transition hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-soft-teal"
                              >
                                <Calendar className="h-5 w-5 mx-auto" strokeWidth={2} />
                              </button>
                            </>
                          )}
                          {dose.status === 'taken' && (
                            <div className="flex-1 rounded-full bg-warm-green/10 px-6 py-4 text-center text-lg font-light text-warm-green">
                              ✓ Taken
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Add Button */}
        <button
          onClick={() => router.push('/add-medication')}
          className="fixed bottom-8 right-8 flex h-20 w-20 items-center justify-center rounded-full bg-soft-teal text-white shadow-glass-lg transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-soft-teal z-40"
          aria-label="Add new medication"
        >
          <Plus className="h-8 w-8" strokeWidth={2.5} />
        </button>
      </main>

      {/* Reminder Modal */}
      {dueDose && currentMedication && (
        <ReminderModal
          open={!!dueDose}
          onClose={clearDueDose}
          dose={dueDose}
          medication={currentMedication}
          userName={profile.name}
          onTaken={markDoseTaken}
          onSkipped={markDoseSkipped}
          onSnoozed={snoozeDose}
        />
      )}

      {/* Medication Info Modal */}
      {selectedMedicationForInfo && (
        <MedicationInfoModal
          open={!!selectedMedicationForInfo}
          onClose={() => setSelectedMedicationForInfo(null)}
          medicationName={selectedMedicationForInfo.name}
        />
      )}
    </div>
  );
}
