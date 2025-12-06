// frontend/src/lib/reminderVoice.ts
'use client';

import type { Medication } from './medicationTypes';
import { calculateAdherenceStats, getActiveProfile } from './storage';
import { API_BASE } from './apiBase';

export interface PersonalizedReminderResponse {
  message: string;
}

/**
 * Generate a personalized reminder message using the backend AI.
 * - Uses local dose logs → adherence stats
 * - Sends them to FastAPI → /api/personalized-reminder
 * - Returns a short, gentle message string
 */
export async function generatePersonalizedReminder(
  medication: Medication
): Promise<string> {
  const profile = getActiveProfile();
  if (!profile) {
    // Fallback if somehow there's no active user
    return `Time to take your ${medication.name}.`;
  }

  try {
    // 1) Calculate adherence stats from localStorage
    const adherence = calculateAdherenceStats(profile.id);

    // 2) Call FastAPI backend
    const response = await fetch(`${API_BASE}/api/personalized-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_name: profile.name,
        medication_name: medication.name,
        purpose: medication.purpose || undefined,
        adherence: {
          // match FastAPI Pydantic model (snake_case)
          current_streak: adherence.currentStreak,
          missed_in_last_week: adherence.missedInLastWeek,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = (await response.json()) as PersonalizedReminderResponse;
    return data.message;
  } catch (error) {
    console.error('Failed to generate personalized reminder:', error);
    // Safe fallback
    return `Time to take your ${medication.name}.`;
  }
}
