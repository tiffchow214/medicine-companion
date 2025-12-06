'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Check, X, CalendarDays, User, Pill } from 'lucide-react';

// Modal for drug info
import { MedicationInfoModal } from '@/components/MedicationInfoModal';

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

const whiteText: React.CSSProperties = {
  color: '#FFFFFF',
  WebkitTextFillColor: '#FFFFFF',
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

/**
 * Colour palette for medications.
 * Same index used for background + text so each medicine has
 * a consistent colour identity.
 */
const MED_BG_CLASSES = [
  'bg-blue-400',
  'bg-amber-400',
  'bg-red-400',
  'bg-indigo-400',
  'bg-emerald-400',
  'bg-pink-400',
];

const MED_TEXT_COLORS = [
  '#60a5fa', // blue-400
  '#fbbf24', // amber-400
  '#f87171', // red-400
  '#818cf8', // indigo-400
  '#34d399', // emerald-400
  '#f472b6', // pink-400
];

function getMedColors(key: string) {
  // Weighted sum hash to reduce collisions between different names
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash += (i + 1) * key.charCodeAt(i);
  }

  const idx = Math.abs(hash) % MED_BG_CLASSES.length;

  return {
    bgClass: MED_BG_CLASSES[idx],
    textColor: MED_TEXT_COLORS[idx],
  };
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

          const circleText: React.CSSProperties = {
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
              <span className="text-xs font-semibold" style={circleText}>
                {dayName}
              </span>
              <span
                className="text-lg font-extrabold leading-tight"
                style={circleText}
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
  onLearnMore: (medication: Medication) => void;
}

function DoseCard({
  dose,
  medication,
  onMarkTaken,
  onSkip,
  onLearnMore,
}: DoseCardProps) {
  // same name → same colours
  const { bgClass: medColorClass, textColor: medTextColor } = getMedColors(
    medication.name,
  );

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
      statusClasses = 'bg-amber-400/90 text-white';
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

  // force white text on the status pill
  const statusTextStyle: React.CSSProperties = {
    color: '#FFFFFF',
    WebkitTextFillColor: '#FFFFFF',
  };

  return (
    <div className="flex w-full overflow-hidden rounded-2xl shadow-xl bg-black/70 backdrop-blur-sm border border-white/15">
      {/* Color bar */}
      <div className={`w-3 ${medColorClass} flex-shrink-0`} />

      <div className="flex-grow p-4 space-y-2">
        {/* Top row: time, med name + Learn more, status pill */}
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <p
              className="text-xs font-semibold uppercase opacity-80 flex items-center"
              style={whiteText}
            >
              <Clock className="w-3 h-3 mr-1" />
              {timeStr}
            </p>

            <div className="mt-1 flex items-center gap-3">
              <h3
                className="text-xl font-bold leading-tight"
                style={{
                  color: medTextColor,
                  WebkitTextFillColor: medTextColor,
                }}
              >
                {medication.name}
              </h3>

              {/* Learn more – yellow, black text, inline with med name */}
              <button
                type="button"
                onClick={() => onLearnMore(medication)}
                className="px-3 py-1.5 rounded-full bg-[#FACC15] text-black border border-amber-300 hover:bg-[#eab308] text-sm font-semibold transition-colors"
              >
                Learn more
              </button>
            </div>

            <p className="text-sm mt-0.5" style={whiteText}>
              {medication.dose}
            </p>
          </div>

          <div
            className={`px-3 py-1 rounded-full font-bold text-sm flex items-center ${statusClasses}`}
            style={statusTextStyle}
          >
            <Icon className="w-4 h-4 mr-1" />
            {statusText}
          </div>
        </div>

        {/* Bottom row: notes + Mark Taken / Skip */}
        <div className="pt-2 flex justify-between items-center border-t border-dashed border-white/20">
          <p className="text-sm italic" style={whiteText}>
            {medication.instructions || medication.purpose || 'No extra notes.'}
          </p>

          <div className="flex gap-2 text-sm font-semibold items-center">
            {isActionable ? (
              <>
                {/* Mark Taken – green background, black text */}
                <button
                  type="button"
                  onClick={() => onMarkTaken(dose)}
                  className="px-4 py-2 rounded-full border border-emerald-500 hover:bg-emerald-300 transition-colors"
                  style={{ backgroundColor: '#22c55e', color: '#000000' }}
                >
                  Mark Taken
                </button>

                {/* Skip – red background, black text */}
                <button
                  type="button"
                  onClick={() => onSkip(dose)}
                  className="px-4 py-2 rounded-full border border-rose-500 hover:bg-rose-300 transition-colors"
                  style={{ backgroundColor: '#f87171', color: '#000000' }}
                >
                  Skip
                </button>
              </>
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
    const { bgClass } = getMedColors(med.name);
    if (!dots[dateNum].includes(bgClass)) dots[dateNum].push(bgClass);
  });

  return (
    <div className="p-6 bg-black/70 rounded-2xl shadow-xl mt-8 border border-white/20 backdrop-blur-sm">
      <h2 className="text-2xl font-bold mb-4 flex items-center" style={whiteText}>
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

      {/* weekday labels – force white */}
      <div className="grid grid-cols-7 text-center text-sm font-semibold border-b border-white/10 pb-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="w-full" style={whiteText}>
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
                        : 'hover:bg.white/10'
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

  // state for the medication info modal
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [selectedMedicationForInfo, setSelectedMedicationForInfo] =
    useState<Medication | null>(null);

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

  const handleLearnMore = (medication: Medication) => {
    console.log('[Dashboard] Learn more clicked for', medication.name);
    setSelectedMedicationForInfo(medication);
    setInfoModalOpen(true);
  };

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
      <div className="min-h-screen flex items-start justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-5xl space-y-8">
          {/* HEADER CARD */}
          <div className="backdrop-blur-sm bg-black/60 rounded-2xl shadow-2xl px-6 py-6 sm:px-10 sm:py-8 border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <div className="text-left">
                <h1
                  className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-snug drop-shadow-lg"
                  style={whiteText}
                >
                  {getGreeting()}, {profile.name}
                </h1>
              </div>

              {/* profile icon: yellow circle, black icon */}
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="w-11 h-11 bg-[#FACC15] rounded-full flex items-center justify-center text-black border-2 border.white shadow-lg"
              >
                <User className="w-5 h-5" />
              </button>
            </div>

            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-2 text-center drop-shadow-lg"
              style={whiteText}
            >
              Your medicines for{' '}
              <span
                className="font-extrabold"
                style={{ color: '#FACC15', WebkitTextFillColor: '#FACC15' }}
              >
                today
              </span>
            </h2>

            {/* Week selector FIRST */}
            <WeekSelector
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
            />

            {/* Instruction text BELOW the selector */}
            <p
              className="text-sm sm:text-base text-center text-slate-100/90 mt-3"
              style={whiteText}
            >
              Tap a day above to see doses for that date.
            </p>
          </div>

          {/* GROUPED DOSES */}
          <div className="space-y-6">
            {groupedKeys.length > 0 ? (
              groupedKeys.map((group) => (
                <div key={group} className="space-y-4">
                  <h3
                    className="text-xl sm:text-2xl font-extrabold border-l-4 border-[#FACC15] pl-3 drop-shadow"
                    style={whiteText}
                  >
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
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center backdrop-blur-sm bg-black/60 rounded-2xl shadow-xl border border-white/20">
                <Pill className="w-10 h-10 text-[#FACC15] mx-auto mb-3" />
                <p className="text-lg sm:text-xl" style={whiteText}>
                  No medications scheduled for this day.
                </p>
              </div>
            )}
          </div>

          {/* MONTHLY CALENDAR */}
          <MonthlyCalendar doses={doses} medications={medications} />
        </div>
      </div>

      {/* MEDICATION INFO MODAL – always mounted, visibility via `open` */}
      <MedicationInfoModal
        open={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        medicationName={selectedMedicationForInfo?.name ?? ''}
      />
    </main>
  );
}
