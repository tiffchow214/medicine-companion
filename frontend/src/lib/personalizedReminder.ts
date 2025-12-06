// frontend/src/lib/personalizedReminder.ts
'use client';

import type { Medication } from './medicationTypes';
import { generatePersonalizedReminder as backendGenerate } from './reminderVoice';
import { playReminderAudio } from './audioClient';

/**
 * 1) Generate a personalized reminder message
 *    (delegates to reminderVoice.ts → FastAPI → OpenAI)
 */
export async function generatePersonalizedReminder(
  medication: Medication,
): Promise<string> {
  // We now centralise all message generation in reminderVoice.ts
  return backendGenerate(medication);
}

/**
 * 2) Generate AND play the personalized reminder voice
 *
 * - Uses backendGenerate(...) to get a warm, simple reminder sentence
 * - Sends that to the backend's /api/reminder-audio via audioClient.ts
 *   which calls ElevenLabs and plays the audio in the browser
 */
export async function playReminderVoice(options: {
  userName: string;
  medication: Medication;
}) {
  const { userName, medication } = options;

  // Step 1: ask backend for a personalized text reminder
  const message = await backendGenerate(medication);

  // Step 2: ask backend to turn that text into audio + play it
  // (audioClient handles fallbacks if the backend fails)
  await playReminderAudio(userName, medication, message);
}
