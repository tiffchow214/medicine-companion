'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Check, X, CalendarDays, User, Pill } from 'lucide-react';

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

function getMedColor(medId: string) {
  let sum = 0;
  for (const ch of medId) sum += ch.charCodeAt(0);
  return MED_COLOURS[sum % MED_COLOURS.length];
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
    <div className="flex justify-center mt-6">
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

          // Explicit black text for weekly circles
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
              <span
                className="text-xs font-semibold"
                style={textStyle}
              >
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
    </div>
  );
}

/* ---------- Dose card ---------- */

interface DoseCardProps {
  dose: DoseInstance;
  medication: Medication;
  onMarkTaken: (dose: DoseInstance) => void;
  onSkip: (dose: DoseInstance) => void;
}

function DoseCard({ dose, medication, onMarkTaken, onSkip }: DoseCardProps) {
  const medColorClass = getMedColor(medication.id);

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
      {/* Color bar */}
      <div className={`w-3 ${medColorClass} flex-shrink-0`} />

      <div className="flex-grow p-4 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold uppercase opacity-80 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {timeStr}
            </p>
            <h3 className="text-xl font-bold leading-tight mt-1">
              {medication.name}
            </h3>
            <p className="text-sm mt-0.5">{medication.dose}</p>
          </div>
          <div
            className={`px-3 py-1 rounded-full font-bold text-sm flex items-center ${statusClasses}`}
          >
            <Icon className="w-4 h-4 mr-1" />
            {statusText}
          </div>
        </div>

        <div className="pt-2 flex justify-between items-center border-t border-dashed border-white/20">
          <p className="text-sm italic">
            {medication.instructions || medication.purpose || 'No extra notes.'}
          </p>

          {isActionable ? (
            <div className="flex gap-2 text-sm font-semibold">
              <button
                type="button"
                onClick={() => onMarkTaken(dose)}
                className="px-4 py-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
              >
                Mark Taken
              </button>
              <button
                type="button"
                onClick={() => onSkip(dose)}
                className="px-4 py-2 rounded-full text-rose-200 border border-rose-300/70 hover:bg-rose-500/10 transition-colors bg-black/40"
              >
                Skip
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled
              className="text-sm font-semibold text-emerald-200 flex items-center opacity-80"
            >
              <Check className="w-4 h-4 mr-1" />
              Logged
            </button>
          )}
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
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun

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

          // style for the number in the circle
          const dayStyle: React.CSSProperties = isToday
            ? { color: '#000000', WebkitTextFillColor: '#000000' } // today = black
            : { color: '#FFFFFF', WebkitTextFillColor: '#FFFFFF' }; // others = white

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
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${c}`} />
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

  // Doses for selected day
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

  // Group doses
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

  // Page-level white text (default), overridable with inline styles
  const pageTextStyle: React.CSSProperties = {
    color: '#FFFFFF',
    WebkitTextFillColor: '#FFFFFF',
  };

  return (
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

              {/* profile icon: yellow circle, black icon */}
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="w-11 h-11 bg-[#FACC15] rounded-full flex items-center justify-center text-black border-2 border-white shadow-lg"
              >
                <User className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-2 text-center drop-shadow-lg">
               Your medicines for{' '}
               <span
                 className="font-extrabold"
                 style={{ color: '#FACC15', WebkitTextFillColor: '#FACC15' }}
               >
                 today
               </span>
            </h2>

            <p className="text-sm sm:text-base text-center text-slate-100/90 mb-2">
              Tap a day above to see doses for that date.
            </p>

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
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center backdrop-blur-sm bg-black/60 rounded-2xl shadow-xl border border-white/20">
                <Pill className="w-10 h-10 text-[#FACC15] mx-auto mb-3" />
                <p className="text-lg sm:text-xl">No medications scheduled for this day.</p>
              </div>
            )}
          </div>

          {/* MONTHLY CALENDAR */}
          <MonthlyCalendar doses={doses} medications={medications} />
        </div>
      </div>
    </main>
  );
}
