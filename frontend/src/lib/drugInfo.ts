// frontend/src/lib/drugInfo.ts

import { API_BASE } from "./apiBase";

export interface DrugInfoResponse {
  medication_name: string;
  source_url: string;
  general_markdown: string;
  usage_markdown: string;
  side_effects_markdown: string;
}

/**
 * Fetch drug information from the backend.
 *
 * Sends:
 *   { medication_name: "Aspirin" }
 *
 * Receives:
 *   {
 *     medication_name,
 *     general_markdown,
 *     usage_markdown,
 *     side_effects_markdown,
 *     source_url
 *   }
 */
export async function fetchDrugInfo(
  medicationName: string
): Promise<DrugInfoResponse> {
  const res = await fetch(`${API_BASE}/api/drug-info`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      medication_name: medicationName,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error (${res.status}): ${text}`);
  }

  return (await res.json()) as DrugInfoResponse;
}
