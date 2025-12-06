// frontend/src/lib/aiClient.ts

/**
 * Very small helper around the FastAPI backend.
 *
 * The backend is responsible for calling OpenAI, and this helper
 * tightly constrains what we ask for: only rewriting user-provided
 * instructions and drafting questions — never inventing doses or advice.
 */

import { API_BASE } from "./apiBase";

export type AiTask = "simplify" | "questions";

interface ChatResponse {
  reply: string;
}

export async function requestMedicationHelp(params: {
  task: AiTask;
  medicationName: string;
  dose: string;
  scheduleNote: string;
  doctorInstructions: string;
}): Promise<string> {
  const { task, medicationName, dose, scheduleNote, doctorInstructions } =
    params;

  const baseContent = `
You are helping a patient and/or caregiver understand medication instructions that their doctor already provided.

IMPORTANT SAFETY RULES (do not break these):
- Do NOT create or change doses, pill counts, timings, or schedules.
- Do NOT add any new medical advice or recommendations.
- Only restate and organize what the user already wrote, in clearer language.
- If something is missing or unclear, say that the user should ask their doctor or pharmacist to clarify.

Medication name: ${medicationName || "(not provided)"}
Dose (as written by the user): ${dose || "(not provided)"}
When to take (as written by the user): ${scheduleNote || "(not provided)"}
Doctor instructions (copied by the user): ${doctorInstructions || "(not provided)"}
`.trim();

  const taskInstruction =
    task === "simplify"
      ? `
Task:
- Rewrite the above instructions using calm, simple, step-by-step language.
- Keep all numbers, doses, and timings exactly as they are written.
- Use short paragraphs or a short bulleted list.
`.trim()
      : `
Task:
- Draft 3–6 short questions the user could ask their doctor or pharmacist about this medication.
- Focus on safety, side effects, what to do if they miss a dose, and anything unclear in the text.
- Do NOT guess the answers. Only write questions.
`.trim();

  const message = `${baseContent}\n\n${taskInstruction}`;

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error("The AI helper is unavailable right now.");
  }

  const data = (await response.json()) as ChatResponse;
  return data.reply;
}
