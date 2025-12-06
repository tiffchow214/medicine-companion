// frontend/src/lib/apiBase.ts

// For local dev: http://127.0.0.1:8000
// In production (Vercel), set NEXT_PUBLIC_API_BASE_URL to your deployed backend URL.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
