// frontend/src/lib/audioClient.ts
'use client';

import type { Medication } from './medicationTypes';
import { API_BASE } from './apiBase';
import { generatePersonalizedReminder } from './reminderVoice';

/**
 * Call the backend to generate and play a reminder audio clip
 * via ElevenLabs.
 *
 * - If `personalizedMessage` is provided:
 *     uses that as the script (no extra OpenAI call)
 * - Otherwise:
 *     calls generatePersonalizedReminder() to get AI text
 * - On any failure, falls back to browser text-to-speech (TTS)
 */
export async function playReminderAudio(
  userName: string,
  medication: Medication,
  personalizedMessage?: string
): Promise<void> {
  // 1) Ensure we have a message (from caller, or via OpenAI)
  const message =
    personalizedMessage || (await generatePersonalizedReminder(medication));

  const fallbackScript =
    message ||
    `Hey ${userName}, it's time to take your ${medication.name}. Please take ${medication.dose}. ${
      medication.instructions || ''
    }`;

  try {
    const res = await fetch(`${API_BASE}/api/reminder-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: userName,
        medication_name: medication.name,
        dose: medication.dose,
        instructions: medication.instructions ?? null,
        voice_id: null, // backend will use DEFAULT_VOICE_ID
        // 🔴 KEY: send AI-generated text to ElevenLabs via backend
        personalized_message: message ?? null,
      }),
    });

    if (!res.ok) {
      // Backend or ElevenLabs failed → fallback to browser TTS
      const utterance = new SpeechSynthesisUtterance(fallbackScript);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
      return;
    }

    // Success: stream audio from backend and play it
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await audio.play();
  } catch (error) {
    console.error('Failed to play reminder audio, using TTS fallback:', error);
    // Network or unexpected error → fallback to browser TTS
    const utterance = new SpeechSynthesisUtterance(fallbackScript);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}
