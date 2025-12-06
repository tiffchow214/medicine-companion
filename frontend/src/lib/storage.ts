import type {
  UserProfile,
  Medication,
  DoseInstance,
  DoseLog,
  MedicationInfoCacheEntry,
} from "./medicationTypes";

// Extra type used by LLM feature
export interface AdherenceStats {
  currentStreak: number;
  missedInLastWeek: number;
}

interface AppState {
  profiles: UserProfile[];
  medications: Medication[];
  doses: DoseInstance[];
  doseLogs: DoseLog[];
  medicationInfoCache: Record<string, MedicationInfoCacheEntry>;
}

const STORAGE_KEY = "medcomp_state";

// ---------- low-level helpers ----------

function getDefaultState(): AppState {
  return {
    profiles: [],
    medications: [],
    doses: [],
    doseLogs: [],
    medicationInfoCache: {},
  };
}

function loadState(): AppState {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      profiles: parsed.profiles ?? [],
      medications: parsed.medications ?? [],
      doses: parsed.doses ?? [],
      doseLogs: parsed.doseLogs ?? [],
      medicationInfoCache: parsed.medicationInfoCache ?? {},
    };
  } catch {
    return getDefaultState();
  }
}

function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- profiles ----------

export function getProfiles(): UserProfile[] {
  const state = loadState();
  return state.profiles;
}

export function getActiveProfile(): UserProfile | null {
  const state = loadState();
  return state.profiles.find((p) => p.isActive) ?? null;
}

export function upsertProfile(profile: UserProfile) {
  const state = loadState();
  const idx = state.profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    state.profiles[idx] = profile;
  } else {
    // make this one active and deactivate others
    state.profiles = state.profiles.map((p) => ({ ...p, isActive: false }));
    state.profiles.push(profile);
  }
  saveState(state);
}

export function setActiveProfile(profileId: string) {
  const state = loadState();
  state.profiles = state.profiles.map((p) => ({
    ...p,
    isActive: p.id === profileId
  }));
  saveState(state);
}

export function deleteProfile(profileId: string) {
  const state = loadState();
  // Remove the profile
  state.profiles = state.profiles.filter((p) => p.id !== profileId);
  // Remove all medications for this user
  state.medications = state.medications.filter((m) => m.userId !== profileId);
  // Remove all doses for this user
  state.doses = state.doses.filter((d) => d.userId !== profileId); // Cleaned: Removed 'as any'
  // Remove all dose logs for this user
  state.doseLogs = state.doseLogs.filter((log) => log.userId !== profileId);
  saveState(state);
}

// ---------- medications ----------

export function getMedicationsForUser(userId: string): Medication[] {
  const state = loadState();
  return state.medications.filter((m) => m.userId === userId);
}

/**
 * Old helper name used by some files – keep it for compatibility.
 */
export function saveMedicationsForUser(userId: string, meds: Medication[]) {
  const state = loadState();
  // ensure userId is set on all meds
  const normalized = meds.map((m) => ({ ...m, userId }));
  state.medications = state.medications.filter((m) => m.userId !== userId);
  state.medications.push(...normalized);
  saveState(state);
}

// Upsert one or more medications
export function upsertMedications(userId: string, meds: Medication[]) {
  const state = loadState();
  for (const med of meds) {
    const withUser = { ...med, userId };
    const idx = state.medications.findIndex((m) => m.id === med.id);
    if (idx >= 0) state.medications[idx] = withUser;
    else state.medications.push(withUser);
  }
  saveState(state);
}

// ---------- doses & logs ----------

export function getDosesForUser(userId: string): DoseInstance[] {
  const state = loadState();
  return state.doses.filter((d) => d.userId === userId); // Cleaned: Removed 'as any'
}

/**
 * Old helper name – keep for compatibility with add-medication page.
 */
export function saveDosesForUser(userId: string, doses: DoseInstance[]) {
  const state = loadState();
  const normalized = doses.map((d) => ({ ...d, userId }));
  state.doses = state.doses.filter((d) => d.userId !== userId); // Cleaned: Removed 'as any'
  state.doses.push(...normalized);
  saveState(state);
}

export function upsertDoses(userId: string, doses: DoseInstance[]) {
  const state = loadState();
  for (const dose of doses) {
    const withUser = { ...dose, userId };
    const idx = state.doses.findIndex((d) => d.id === dose.id && d.userId === userId); // Cleaned: Removed 'as any'
    if (idx >= 0) state.doses[idx] = withUser;
    else state.doses.push(withUser);
  }
  saveState(state);
}

export function updateDoseStatus(
  userId: string,
  doseId: string,
  status: DoseInstance["status"],
  takenAt?: string
) {
  const state = loadState();
  const idx = state.doses.findIndex(
    (d) => d.id === doseId && d.userId === userId // Cleaned: Removed 'as any'
  );
  if (idx >= 0) {
    state.doses[idx] = {
      ...state.doses[idx],
      status,
      takenAt: takenAt ?? state.doses[idx].takenAt,
    };
    saveState(state);
  }
}

export function addDoseLog(userId: string, log: DoseLog) {
  const state = loadState();
  state.doseLogs.push({ ...log, userId });
  saveState(state);
}

// ---------- drug-info cache (used by MedicationInfoModal) ----------

export function getMedicationInfoCache(
  url: string
): MedicationInfoCacheEntry | null {
  const state = loadState();
  return state.medicationInfoCache[url] || null;
}

export function setMedicationInfoCache(
  url: string,
  item: MedicationInfoCacheEntry
) {
  const state = loadState();
  state.medicationInfoCache[url] = item;
  saveState(state);
}

// ---------- adherence stats ----------

/**
 * Calculate adherence statistics for a user from their dose logs.
 */
export function calculateAdherenceStats(userId: string): AdherenceStats {
  const state = loadState();
  const logs = state.doseLogs.filter((log) => log.userId === userId);

  // Calculate current streak (consecutive days with at least one taken dose)
  let currentStreak = 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0, 0);

  // Group logs by date
  const logsByDate = new Map<string, { taken: number; missed: number; skipped: number }>();
  
  for (const log of logs) {
    const logDate = new Date(log.createdAt);
    logDate.setHours(0, 0, 0, 0, 0);
    const dateKey = logDate.toISOString().split('T')[0];
    
    if (!logsByDate.has(dateKey)) {
      logsByDate.set(dateKey, { taken: 0, missed: 0, skipped: 0 });
    }
    
    const dayStats = logsByDate.get(dateKey)!;
    if (log.status === 'taken') dayStats.taken++;
    if (log.status === 'missed') dayStats.missed++;
    if (log.status === 'skipped') dayStats.skipped++;
  }

  // Calculate streak backwards from today
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i);
    const dateKey = checkDate.toISOString().split('T')[0];
    const dayStats = logsByDate.get(dateKey);
    
    if (dayStats && dayStats.taken > 0) {
      currentStreak++;
    } else if (i === 0) {
      // Today hasn't been taken yet, that's ok - check yesterday
      continue;
    } else {
      // Found a day without a taken dose, streak is broken
      break;
    }
  }

  // Calculate missed in last week
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  let missedInLastWeek = 0;
  for (const log of logs) {
    const logDate = new Date(log.createdAt);
    if (logDate >= weekAgo && log.status === 'missed') {
      missedInLastWeek++;
    }
  }

  return {
    currentStreak,
    missedInLastWeek
  };
}