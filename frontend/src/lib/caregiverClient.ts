// frontend/src/lib/caregiverClient.ts
'use client';

import { API_BASE } from './apiBase';

export interface CaregiverAlertPayload {
  caregiver_name: string;
  caregiver_email: string; // plain string; basic client-side validation only
  patient_name: string;    // backend expects patient_name, not user_name
  medication_name: string;
  scheduled_time: string;
  status: 'missed' | 'skipped';
  reason?: string;         // backend expects reason, not notes
}

/**
 * Small helper around the caregiver alert endpoint.
 *
 * Contract:
 * POST  /api/caregiver-alert
 * body: CaregiverAlertPayload
 * response (from FastAPI backend):
 *   { "status": "queued" }
 */
export async function sendCaregiverAlert(
  payload: CaregiverAlertPayload
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/caregiver-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Caregiver alert failed: ${text}`);
  }

  // If you ever want to inspect it:
  // const data = await res.json(); // { status: "queued" }
}
