export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export type DoseStatus = 'upcoming' | 'due' | 'taken' | 'missed' | 'skipped';

export type MedicationFrequency =
  | 'once'
  | 'twice'
  | 'three'
  | 'four'
  | 'every6h'
  | 'every12h'
  | 'as_needed';

  export interface Medication {
    id: string;
    userId: string;
    name: string;
    dose: string;
    /** What this medication is for, e.g. "heart", "blood thinner", "pain relief" */
    purpose?: string;
    instructions?: string;
    frequency: MedicationFrequency;
    times: string[]; // e.g. ["08:00", "18:00"]
    endDate?: string; // ISO
    caregiverAlertEnabled?: boolean;
    caregiverName?: string;
    caregiverEmail?: string;
    alertOnSkipped?: boolean;
    alertOnMissed?: boolean;
    drugsUrl?: string; // URL to drugs.com page
    // Legacy fields for backward compatibility
    scheduleNote?: string;
    timeOfDay?: TimeOfDay;
    doctorInstructions?: string;
  }  

export interface DoseInstance {
  id: string;
  medicationId: string;
  scheduledTime: string; // ISO string
  status: DoseStatus;
  takenAt?: string; // ISO string
  snoozedUntil?: string; // optional rescheduled time
  // Legacy fields
  timeOfDay?: TimeOfDay;
  taken?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
}

export interface DoseLog {
  id: string;
  userId: string;
  medicationId: string;
  doseId: string;
  status: DoseStatus;
  createdAt: string;
}

export interface MedicationInfoCacheEntry {
  url: string;
  markdown: string;
  fetchedAt: string;
}

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

export const FREQUENCY_LABELS: Record<MedicationFrequency, string> = {
  once: 'Once daily',
  twice: 'Twice daily',
  three: '3× daily',
  four: '4× daily',
  every6h: 'Every 6 hours',
  every12h: 'Every 12 hours',
  as_needed: 'As needed (no reminders)',
};

export interface Medication {
  id: string;
  name: string;
  dose: string;
  // NEW:
  purpose?: string; // e.g. "heart", "blood thinner", "pain relief"
  // ...rest of your fields...
  drugsUrl?: string; // keep this so Learn More keeps working
};
