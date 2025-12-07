'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Check, X, CalendarDays, User, Pill } from 'lucide-react';
import { API_BASE } from '@/lib/apiBase';

import {
  getActiveProfile,
  getMedicationsForUser,
  getDosesForUser,
  updateDoseStatus,
  addDoseLog,
} from '@/lib/storage';
import type { Medication, DoseInstance } from '@/lib/medicationTypes';
import { sendCaregiverAlert } from '@/lib/caregiverClient';

/* ---------- Helpers ---------- */

type TimeGroup =
  | 'Morning'
  | 'Afternoon'
  | 'Evening'
  | 'Bedtime'
  | 'As Needed'
  | 'Other';

type DrugInfo = {
  medication_name: string;
  general_markdown: string;
  usage_markdown: string;
  side_effects_markdown: string;
  source_url: string;
};

function getWeekDays(center: Date) {
  const days: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(center);
    d.setDate(center.getDate() + i);
    days.push(d);
  }
  return days;
}

function getTimeGroup(dose: DoseInstance, medication?: Medication): TimeGroup {
  if (medication?.frequency === 'as_needed') return 'As Needed';

  const h = new Date(dose.scheduledTime).getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  if (h < 24) return 'Bedtime';
  return 'Other';
}

const MED_COLOURS = [
  'bg-blue-400',
  'bg-amber-400',
  'bg-red-400',
  'bg-indigo-400',
  'bg-emerald-400',
  'bg-pink-400',
];

// matching text colours for each med colour (blue, orange, red, indigo, green, pink)
const MED_TEXT_COLOURS = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#ef4444', // red
  '#6366f1', // indigo
  '#10b981', // emerald
  '#ec4899', // pink
];

function getMedIndex(medId: string) {
  let sum = 0;
  for (const ch of medId) sum += ch.charCodeAt(0);
  return sum % MED_COLOURS.length;
}

function getMedColor(medId: string) {
  return MED_COLOURS[getMedIndex(medId)];
}

function getMedTextColor(medId: string) {
  return MED_TEXT_COLOURS[getMedIndex(medId)];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* ---------- Week selector ---------- */

interface WeekSelectorProps {
  selectedDay: Date;
  setSelectedDay: (d: Date) => void;
}

function WeekSelector({ selectedDay, setSelectedDay }: WeekSelectorProps) {
  const weekDays = getWeekDays(selectedDay);
  const todayStr = new Date().toDateString();

  return (
    <div className="flex flex-col items-center mt-6">
      <div className="flex overflow-x-auto gap-3 py-2 px-2 scrollbar-hide">
        {weekDays.map((date) => {
          const dayName = date.toLocaleDateString('en-US', {
            weekday: 'short',
          });
          const dayNum = date.getDate();
          const isSelected = date.toDateString() === selectedDay.toDateString();
          const isToday = date.toDateString() === todayStr;

          const base =
            'flex flex-col items-center justify-center w-14 h-14 rounded-full cursor-pointer transition-colors duration-200 flex-shrink-0 border border-white/40 bg-white';
          const active =
            'bg-[#FACC15] shadow-lg ring-4 ring-[#FEF08A] border-none';
          const inactive = 'hover:bg-slate-200/90';
          const todayOnly =
            isToday && !isSelected ? 'border-2 border-[#FACC15] font-bold' : '';

          const textStyle: React.CSSProperties = {
            color: '#000000',
            WebkitTextFillColor: '#000000',
          };

          return (
            <button
              type="button"
              key={date.toISOString()}
              onClick={() => setSelectedDay(date)}
              className={`${base} ${isSelected ? active : inactive} ${todayOnly}`}
            >
              <span className="text-xs font-semibold" style={textStyle}>
                {dayName}
              </span>
              <span
                className="text-lg font-extrabold leading-tight"
                style={textStyle}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-sm sm:text-base text-center text-slate-100/90">
        Tap a day above to see doses for that date.
      </p>
    </div>
  );
}

/* ---------- Dose card ---------- */

interface DoseCardProps {
  dose: DoseInstance;
  medication: Medication;
  onMarkTaken: (dose: DoseInstance) => void;
  onSkip: (dose: DoseInstance) => void;
  onLearnMore: (med: Medication) => void;
  learnMoreLoading?: boolean;
}

function DoseCard({
  dose,
  medication,
  onMarkTaken,
  onSkip,
  onLearnMore,
  learnMoreLoading,
}: DoseCardProps) {
  const medColorClass = getMedColor(medication.id);
  const medTextColor = getMedTextColor(medication.id);

  let statusText: string;
  let statusClasses: string;
  let Icon = Clock;

  switch (dose.status) {
    case 'taken':
      statusText = 'Taken';
      statusClasses = 'bg-emerald-500/80 text-white';
      Icon = Check;
      break;
    case 'skipped':
      statusText = 'Skipped';
      statusClasses = 'bg-rose-500/80 text-white';
      Icon = X;
      break;
    case 'missed':
      statusText = 'Missed';
      statusClasses = 'bg-rose-500/80 text-white';
      Icon = X;
      break;
    case 'due':
      statusText = 'Due Now';
      statusClasses = 'bg-amber-400/90 text-slate-900';
      Icon = Clock;
      break;
    default:
      statusText = 'Upcoming';
      statusClasses = 'bg-slate-500/80 text-white';
      Icon = Clock;
      break;
  }

  const timeStr = new Date(dose.scheduledTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const isActionable = dose.status !== 'taken';

  return (
    <div className="flex w-full overflow-hidden rounded-2xl shadow-xl bg-black/70 backdrop-blur-sm border border-white/15">
      {/* colour bar at left */}
      <div className={`w-3 ${medColorClass} flex-shrink-0`} />

      <div className="flex-grow p-4 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold uppercase opacity-80 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {timeStr}
            </p>

            {/* med name (coloured text) + learn more */}
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <h3
                className="text-xl font-bold leading-tight inline-flex px-0 py-0"
                style={{
                  color: medTextColor, // coloured text (not black/white)
                  WebkitTextFillColor: medTextColor,
                }}
              >
                {medication.name}
              </h3>

              <button
                type="button"
                onClick={() => onLearnMore(medication)}
                disabled={learnMoreLoading}
                className="px-3 py-1 rounded-full bg-[#FACC15] text-sm font-semibold hover:bg-yellow-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  color: '#111827',
                  WebkitTextFillColor: '#111827',
                }}
              >
                {learnMoreLoading ? 'Loading…' : 'Learn more'}
              </button>
            </div>

            <p className="text-sm mt-0.5">{medication.dose}</p>
          </div>

          <div
            className={`px-3 py-1 rounded-full font-bold text-sm flex items-center ${statusClasses}`}
          >
            <Icon className="w-4 h-4 mr-1" />
            {statusText}
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-3 border-t border-dashed border-white/20">
          <p className="text-sm italic">
            {medication.instructions || medication.purpose || 'No extra notes.'}
          </p>

          <div className="flex flex-wrap gap-2 text-sm font-semibold justify-end">
            {isActionable ? (
              <>
                {/* Mark Taken */}
                <button
                  type="button"
                  onClick={() => onMarkTaken(dose)}
                  className="px-4 py-2 rounded-full hover:brightness-105 transition-colors"
                  style={{
                    backgroundColor: '#22c55e', // green
                    color: '#111827', // black-ish text
                    WebkitTextFillColor: '#111827',
                  }}
                >
                  Mark Taken
                </button>
                {/* Skip */}
                <button
                  type="button"
                  onClick={() => onSkip(dose)}
                  className="px-4 py-2 rounded-full hover:brightness-105 transition-colors"
                  style={{
                    backgroundColor: '#ef4444', // red
                    color: '#111827',
                    WebkitTextFillColor: '#111827',
                  }}
                >
                  Skip
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-emerald-200">
                <Check className="w-4 h-4" />
                <span className="text-sm font-semibold">Taken</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Monthly calendar ---------- */

interface MonthlyCalendarProps {
  doses: DoseInstance[];
  medications: Medication[];
}

function MonthlyCalendar({ doses, medications }: MonthlyCalendarProps) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayDate = now.getDate();

  const getDaysInMonth = (month: number, year: number) =>
    new Date(year, month + 1, 0).getDate();

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const dots: Record<number, string[]> = {};

  doses.forEach((dose) => {
    const d = new Date(dose.scheduledTime);
    if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return;

    const med = medications.find((m) => m.id === dose.medicationId);
    if (!med) return;

    const dateNum = d.getDate();
    if (!dots[dateNum]) dots[dateNum] = [];
    const color = getMedColor(med.id);
    if (!dots[dateNum].includes(color)) dots[dateNum].push(color);
  });

  return (
    <div className="p-6 bg-black/70 rounded-2xl shadow-xl mt-8 border border-white/20 backdrop-blur-sm">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <CalendarDays className="w-6 h-6 mr-2 text-[#FACC15]" />
        <span
          style={{
            color: '#FACC15',
            WebkitTextFillColor: '#FACC15',
          }}
        >
          {new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </h2>

      <div className="grid grid-cols-7 text-center text-sm font-semibold border-b border-white/10 pb-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="w-full">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const isToday = day === todayDate;
          const dotColours = day ? dots[day] || [] : [];
          const base =
            'flex flex-col items-center justify-center p-1 h-10 transition-colors duration-150 rounded-lg';

          const dayStyle: React.CSSProperties = isToday
            ? { color: '#000000', WebkitTextFillColor: '#000000' }
            : { color: '#FFFFFF', WebkitTextFillColor: '#FFFFFF' };

          return (
            <div key={idx} className={base}>
              {day ? (
                <>
                  <div
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm cursor-pointer ${
                      isToday
                        ? 'bg-[#FACC15] font-bold shadow-md'
                        : 'hover:bg-white/10'
                    }`}
                    style={dayStyle}
                  >
                    {day}
                  </div>
                  {dotColours.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dotColours.slice(0, 3).map((c, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${c}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-8 h-8" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Main Dashboard Page ---------- */

export default function DashboardPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [profile, setProfile] = useState(getActiveProfile());
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doses, setDoses] = useState<DoseInstance[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [selectedDrugInfo, setSelectedDrugInfo] = useState<DrugInfo | null>(
    null,
  );
  const [infoLoadingMedId, setInfoLoadingMedId] = useState<string | null>(null);

  // DEBUG logging
  useEffect(() => {
    console.log('🔍 DEBUG: API_BASE =', API_BASE);
    console.log('🔍 DEBUG: Medications loaded =', medications.length);
  }, [medications]);

  useEffect(() => {
    setIsMounted(true);
    const active = getActiveProfile();
    if (!active) {
      router.push('/welcome');
      return;
    }
    setProfile(active);
    setMedications(getMedicationsForUser(active.id));
    setDoses(getDosesForUser(active.id));
    setSelectedDay(new Date());
  }, [router]);

  if (!isMounted || !profile || !selectedDay) {
    return null;
  }

  // ✅ DEBUG: check if modal should render
  if (selectedDrugInfo) {
    console.log('🟢 Modal should now be on screen:', selectedDrugInfo);
  }

  const dayDoses: DoseInstance[] = (() => {
    const start = new Date(selectedDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    return doses.filter((d) => {
      const t = new Date(d.scheduledTime);
      return t >= start && t < end;
    });
  })();

  const grouped: Record<TimeGroup, DoseInstance[]> = {
    Morning: [],
    Afternoon: [],
    Evening: [],
    Bedtime: [],
    'As Needed': [],
    Other: [],
  };

  dayDoses.forEach((dose) => {
    const med = medications.find((m) => m.id === dose.medicationId);
    const group = getTimeGroup(dose, med);
    grouped[group].push(dose);
  });

  const groupedKeys = (Object.keys(grouped) as TimeGroup[]).filter(
    (k) => grouped[k].length > 0,
  );

  const handleDoseTaken = (dose: DoseInstance) => {
    const takenAt = new Date().toISOString();
    updateDoseStatus(profile.id, dose.id, 'taken', takenAt);
    addDoseLog(profile.id, {
      id: `${Date.now()}-${Math.random()}`,
      userId: profile.id,
      medicationId: dose.medicationId,
      doseId: dose.id,
      status: 'taken',
      createdAt: takenAt,
    });
    setDoses(getDosesForUser(profile.id));
  };

  const handleDoseSkipped = (dose: DoseInstance) => {
    updateDoseStatus(profile.id, dose.id, 'skipped');
    addDoseLog(profile.id, {
      id: `${Date.now()}-${Math.random()}`,
      userId: profile.id,
      medicationId: dose.medicationId,
      doseId: dose.id,
      status: 'skipped',
      createdAt: new Date().toISOString(),
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
        reason: 'User marked dose as skipped from dashboard.',
      }).catch((err) => console.error('Failed to send caregiver alert:', err));
    }

    setDoses(getDosesForUser(profile.id));
  };

  const handleLearnMore = async (med: Medication) => {
    console.log('🎯 CLICKED Learn More for:', med.name);
    console.log('🔍 API_BASE value:', API_BASE);
    console.log('🔍 Full URL:', `${API_BASE}/api/drug-info`);

    if (!API_BASE) {
      console.error('❌ API_BASE is undefined!');
      alert('Backend URL is not configured.');
      return;
    }

    try {
      setInfoLoadingMedId(med.id);

      console.log('📡 Fetching drug info...');
      const res = await fetch(`${API_BASE}/api/drug-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medication_name: med.name,
        }),
      });

      console.log('📡 Response status:', res.status);
      console.log('📡 Response ok:', res.ok);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('❌ Drug info error:', res.status, text);
        throw new Error('Failed to fetch medication information.');
      }

      const data: DrugInfo = await res.json();
      console.log('✅ Got data:', data);
      setSelectedDrugInfo(data);
    } catch (err) {
      console.error('❌ Error in handleLearnMore:', err);
      alert(
        err instanceof Error
          ? err.message
          : 'Could not load medication information right now.',
      );
    } finally {
      setInfoLoadingMedId(null);
    }
  };

  const pageTextStyle: React.CSSProperties = {
    color: '#FFFFFF',
    WebkitTextFillColor: '#FFFFFF',
  };

  return (
    <>
      {/* MAIN PAGE */}
      <main
        className="min-h-screen"
        style={{
          ...pageTextStyle,
          backgroundImage:
            "linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), url('/med-reminder.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="min-h-screen flex items-start justify-center p-4 sm:p-6 md:p-8">
          <div className="w-full max-w-5xl space-y-8">
            {/* HEADER CARD */}
            <div className="backdrop-blur-sm bg-black/60 rounded-2xl shadow-2xl px-6 py-6 sm:px-10 sm:py-8 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <div className="text-left">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-snug drop-shadow-lg">
                    {getGreeting()}, {profile.name}
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={() => router.push('/settings')}
                  className="w-11 h-11 bg-[#FACC15] rounded-full flex items-center justify-center text-black border-2 border-white shadow-lg"
                >
                  <User className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-center drop-shadow-lg">
                Your medicines for{' '}
                <span
                  className="font-extrabold"
                  style={{ color: '#FACC15', WebkitTextFillColor: '#FACC15' }}
                >
                  today
                </span>
              </h2>

              <WeekSelector
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
              />
            </div>

            {/* GROUPED DOSES */}
            <div className="space-y-6">
              {groupedKeys.length > 0 ? (
                groupedKeys.map((group) => (
                  <div key={group} className="space-y-4">
                    <h3 className="text-xl sm:text-2xl font-extrabold border-l-4 border-[#FACC15] pl-3 drop-shadow">
                      {group} Doses
                    </h3>
                    <div className="space-y-3">
                      {grouped[group].map((dose) => {
                        const med = medications.find(
                          (m) => m.id === dose.medicationId,
                        );
                        if (!med) return null;
                        return (
                          <DoseCard
                            key={dose.id}
                            dose={dose}
                            medication={med}
                            onMarkTaken={handleDoseTaken}
                            onSkip={handleDoseSkipped}
                            onLearnMore={handleLearnMore}
                            learnMoreLoading={infoLoadingMedId === med.id}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center backdrop-blur-sm bg-black/60 rounded-2xl shadow-xl border border-white/20">
                  <Pill className="w-10 h-10 text-[#FACC15] mx-auto mb-3" />
                  <p className="text-lg sm:text-xl">
                    No medications scheduled for this day.
                  </p>
                </div>
              )}
            </div>

            <MonthlyCalendar doses={doses} medications={medications} />
          </div>
        </div>
      </main>

      {/* MODAL OUTSIDE <main> WITH VERY HIGH Z-INDEX */}
      {selectedDrugInfo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4">
          <div className="max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-2xl bg-slate-900 text-white border border-white/20 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold mb-1">
                  {selectedDrugInfo.medication_name}
                </h3>
                <p className="text-xs text-slate-300">
                  Information from FDA drug label (simplified).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDrugInfo(null)}
                className="rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 text-sm leading-relaxed">
              <section>
                <h4 className="font-semibold mb-1">
                  What this medicine is for & warnings
                </h4>
                <pre className="whitespace-pre-wrap text-xs bg-black/20 rounded-lg p-3">
                  {selectedDrugInfo.general_markdown}
                </pre>
              </section>

              <section>
                <h4 className="font-semibold mb-1">How to use</h4>
                <pre className="whitespace-pre-wrap text-xs bg-black/20 rounded-lg p-3">
                  {selectedDrugInfo.usage_markdown}
                </pre>
              </section>

              <section>
                <h4 className="font-semibold mb-1">Possible side effects</h4>
                <pre className="whitespace-pre-wrap text-xs bg-black/20 rounded-lg p-3">
                  {selectedDrugInfo.side_effects_markdown}
                </pre>
              </section>

              <p className="text-[11px] text-slate-400">
                This is a simplified summary and not medical advice. Always talk
                to your doctor or pharmacist about your medicines.
              </p>

              <a
                href={selectedDrugInfo.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs underline text-[#FACC15]"
              >
                View full FDA label (OpenFDA)
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
