# api/index.py

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from typing import Any
from datetime import datetime
import os
import requests
import random
import httpx
import urllib.parse
import re  # NEW: for simple bullet formatting

# ---------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv(
    "RESEND_FROM_EMAIL",
    "Medication Companion <no-reply@example.com>",
)

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set. Add it to your .env file or shell env.")

if not ELEVENLABS_API_KEY:
    print("⚠️ ELEVENLABS_API_KEY is not set. /api/reminder-audio will fail until you set it.")

if not RESEND_API_KEY:
    print("⚠️ RESEND_API_KEY is not set. /api/caregiver-alert will fail until you set it.")

# OpenFDA drug label endpoint
OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"

# ---------------------------------------------------------
# Clients
# ---------------------------------------------------------
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# ---------------------------------------------------------
# FastAPI app + CORS
# ---------------------------------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later: restrict to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------
class DrugInfoRequest(BaseModel):
    # Name of the medication, e.g. "Aspirin"
    medication_name: str


class DrugInfoResponse(BaseModel):
    medication_name: str
    general_markdown: str
    usage_markdown: str
    side_effects_markdown: str
    source_url: str


class ReminderAudioRequest(BaseModel):
    user_name: str
    medication_name: str
    dose: str | None = None
    instructions: str | None = None
    voice_id: str | None = None  # optional; overrides default voice
    personalized_message: str | None = None  # optional; uses this instead of generic script


class CaregiverAlertRequest(BaseModel):
    caregiver_email: str
    caregiver_name: str | None = None
    patient_name: str
    medication_name: str
    scheduled_time: str  # ISO string or human-readable
    status: str          # "missed" or "skipped"
    reason: str | None = None


class AdherenceStats(BaseModel):
    current_streak: int = 0          # e.g., 7 days in a row
    missed_in_last_week: int = 0     # how many missed in last 7 days


class PersonalizedReminderRequest(BaseModel):
    user_name: str
    medication_name: str
    purpose: str | None = None       # e.g. "heart health"
    adherence: AdherenceStats


class ChatRequest(BaseModel):
    message: str


# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "message": "Backend is running"}


# ---------------------------------------------------------------------
# OPENAI — Personalized Reminder Message
# ---------------------------------------------------------------------

ENCOURAGEMENT_SNIPPETS = [
    "You're doing the right thing for your health.",
    "This small step really helps your health.",
    "You're taking good care of yourself.",
    "Your future self will thank you for this.",
    "Every dose helps keep you on track.",
]

@app.post("/api/personalized-reminder")
def personalized_reminder(req: PersonalizedReminderRequest):
    """
    Generate a warm, personalized reminder sentence for this user/medication.

    Shape we aim for:
      1) "Hey Tiff, it's time to take your morning Aspirin for your pain relief."
      2) An encouragement line that varies, and uses streak/missed info.

    We always return 200 with a `message`, even if OpenAI fails.
    """

    name = req.user_name.strip()
    med = req.medication_name.strip()
    purpose = (req.purpose or "").strip()
    streak = req.adherence.current_streak
    missed = req.adherence.missed_in_last_week

    # --- Time of day for "morning Aspirin" style phrasing ---
    hour = datetime.now().hour
    if hour < 12:
        tod_label = "morning"
    elif hour < 18:
        tod_label = "afternoon"
    else:
        tod_label = "evening"

    # --- Pick a random encouragement phrase for variety ---
    encouragement = random.choice(ENCOURAGEMENT_SNIPPETS)

    # --- Build a clear, safe base sentence ourselves ---
    # e.g. "Hey Tiff, it's time to take your morning Aspirin for your pain relief."
    base = f"Hey {name}, it's time to take your {tod_label} {med}"
    if purpose:
        base += f" for your {purpose}"
    base += "."

    # --- Build a fallback second sentence using streak/missed ---
    if streak >= 3:
        fallback_second = (
            f"{encouragement} You've kept up with it for {streak} days in a row."
        )
    elif missed > 0:
        fallback_second = (
            f"{encouragement} Don't worry about earlier missed doses, just take this one now."
        )
    else:
        fallback_second = encouragement

    fallback_full = f"{base} {fallback_second}"

    try:
        # Ask OpenAI to write two short sentences in this shape
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You create warm, encouraging medication reminders for older adults.\n\n"
                        "Requirements:\n"
                        "- Reading level: 8–10 year old (very simple language).\n"
                        "- You MUST write exactly two short sentences.\n"
                        "- Sentence 1: clearly tell them it's time to take their medication, "
                        "using the given time-of-day label (morning/afternoon/evening) and purpose if provided.\n"
                        "- Sentence 2: start with the given encouragement phrase and then use streak/missed info.\n"
                        "- Always include the verb 'take'.\n"
                        "- Use the person's name exactly as given."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Name: {name}\n"
                        f"Medication: {med}\n"
                        f"Purpose: {purpose or 'unknown'}\n"
                        f"Time-of-day label to use in sentence 1: {tod_label}\n"
                        f"Current streak (days in a row taken): {streak}\n"
                        f"Missed doses in last week: {missed}\n"
                        f"Encouragement phrase to START sentence 2 with: \"{encouragement}\"\n"
                        "Write exactly two sentences. "
                        "Example style: 'Hey Tiff, it's time to take your morning Aspirin for your pain relief. "
                        "You're doing the right thing for your health, and you've kept up 5 days in a row.'"
                    ),
                },
            ],
            temperature=0.6,
        )

        message = (completion.choices[0].message.content or "").strip()

        # If OpenAI gives us something empty or weird, fall back to our own string.
        if not message:
            message = fallback_full

        # Safety check: make sure we actually say "take" + med name
        lower = message.lower()
        if "take" not in lower or med.lower() not in lower:
            message = fallback_full

        print("[/api/personalized-reminder] generated:", message)
        return {"message": message}

    except Exception as e:
        print("Error in /api/personalized-reminder:", e)
        # Still return a friendly, personalised message
        return {"message": fallback_full}



# ---------------------------------------------------------
# Helper functions for OpenFDA drug info
# ---------------------------------------------------------
def _first_text(value: Any) -> str:
    """
    OpenFDA often returns fields as lists of strings.
    This helper safely returns the first string, or "".
    """
    if isinstance(value, list) and value:
        return str(value[0])
    if isinstance(value, str):
        return value
    return ""


def _shorten(text: str, max_chars: int = 1200) -> str:
    """
    Keep sections reasonably short for the modal.
    """
    if len(text) <= max_chars:
        return text
    trimmed = text[:max_chars]
    if "." in trimmed:
        trimmed = trimmed.rsplit(".", 1)[0] + "."
    return trimmed


def _to_bullets(text: str, max_items: int = 6) -> str:
    """
    Convert a long paragraph into simple bullet points for easier reading.
    Very naive: split on sentence boundaries and prefix with "- ".
    """
    if not text:
        return "Not available."

    # Basic sentence split
    sentences = re.split(r"(?<=[.?!])\s+", text)
    bullets = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        bullets.append(f"- {s}")
        if len(bullets) >= max_items:
            break

    if not bullets:
        return "Not available."
    return "\n".join(bullets)


# ---------------------------------------------------------
# OpenFDA: drug information
# ---------------------------------------------------------
@app.post("/api/drug-info", response_model=DrugInfoResponse)
async def get_drug_info(body: DrugInfoRequest) -> DrugInfoResponse:
    """
    Given a medication name, fetch label info from OpenFDA and
    return markdown for three sections:

      - general_markdown (what it is for + warnings)
      - usage_markdown   (how to use / dosage)
      - side_effects_markdown (possible side effects)
    """
    name = body.medication_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Medication name is required.")

    # Search by brand OR generic name
    search_query = f'openfda.brand_name:"{name}"+openfda.generic_name:"{name}"'
    params = {"search": search_query, "limit": 1}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(OPENFDA_LABEL_URL, params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error contacting OpenFDA: {exc}",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail="OpenFDA request failed.",
        )

    data = resp.json()
    results = data.get("results") or []
    if not results:
        raise HTTPException(
            status_code=404,
            detail="No information found for this medication.",
        )

    label = results[0]

    # Map OpenFDA fields → four raw sections
    uses_raw = _first_text(label.get("indications_and_usage")) or "Not available."
    side_effects_raw = (
        _first_text(label.get("adverse_reactions"))
        or _first_text(label.get("side_effects"))
        or "Not available."
    )
    warnings_raw = (
        _first_text(label.get("warnings"))
        or _first_text(label.get("warnings_and_cautions"))
        or _first_text(label.get("boxed_warning"))
        or "Not available."
    )
    dosage_raw = (
        _first_text(label.get("dosage_and_administration")) or "Not available."
    )

    # Shorten and convert to bullets
    uses = _to_bullets(_shorten(uses_raw))
    side_effects = _to_bullets(_shorten(side_effects_raw))
    warnings = _to_bullets(_shorten(warnings_raw))
    dosage = _to_bullets(_shorten(dosage_raw))

    # Build markdown per tab
    general_markdown = (
        "### What this medicine is for\n\n"
        f"{uses}\n\n"
        "### Important warnings\n\n"
        f"{warnings}\n\n"
        "_Source: U.S. FDA drug label (OpenFDA). This is **not** medical advice. "
        "Always talk to your doctor or pharmacist about your medicines._"
    )

    usage_markdown = (
        "### How to use this medicine\n\n"
        f"{dosage}\n\n"
        "_This is a simplified summary. Follow the instructions from your "
        "doctor, pharmacist, or the label on your medicine._"
    )

    side_effects_markdown = (
        "### Possible side effects\n\n"
        f"{side_effects}\n\n"
        "_If you feel unwell, have trouble breathing, chest pain, or any symptoms that "
        "worry you, seek medical help immediately. This list is not complete._"
    )

    encoded_name = urllib.parse.quote(name)
    source_url = (
        "https://api.fda.gov/drug/label.json"
        f"?search=openfda.brand_name:{encoded_name}"
        f"+openfda.generic_name:{encoded_name}&limit=1"
    )

    return DrugInfoResponse(
        medication_name=name,
        general_markdown=general_markdown,
        usage_markdown=usage_markdown,
        side_effects_markdown=side_effects_markdown,
        source_url=source_url,
    )


# ---------------------------------------------------------
# ElevenLabs: streaming reminder audio
# ---------------------------------------------------------
DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"  # replace with a voice from your ElevenLabs dashboard


@app.post("/api/reminder-audio")
def reminder_audio(body: ReminderAudioRequest):
    """
    Generate a short reminder audio clip.
    """
    if not ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_API_KEY is not set on the server.",
        )

    # Build the spoken script
    if body.personalized_message:
        script = body.personalized_message
        if body.dose:
            script += f" Please take {body.dose}."
    else:
        script = f"Hey {body.user_name}, it's time to take your {body.medication_name}."
        if body.dose:
            script += f" Please take {body.dose}."
        if body.instructions:
            script += f" {body.instructions}"

    voice_id = body.voice_id or DEFAULT_VOICE_ID
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }

    payload = {
        "text": script,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.8,
        },
    }

    try:
        eleven_response = requests.post(
            url,
            headers=headers,
            json=payload,
            stream=True,
            timeout=30,
        )

        if not eleven_response.ok:
            snippet = eleven_response.text[:200]
            raise HTTPException(
                status_code=500,
                detail=f"ElevenLabs error {eleven_response.status_code}: {snippet}",
            )

        return StreamingResponse(
            eleven_response.iter_content(chunk_size=1024),
            media_type="audio/mpeg",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ElevenLabs error: {str(e)}")


# ---------------------------------------------------------
# Resend: caregiver email alerts
# ---------------------------------------------------------
@app.post("/api/caregiver-alert")
def caregiver_alert(body: CaregiverAlertRequest, background_tasks: BackgroundTasks):
    """
    Send an email to a caregiver when a dose is missed or skipped.
    """
    if not RESEND_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="RESEND_API_KEY is not configured on the server.",
        )

    def _send_email():
        subject = (
            f"[Medication Companion] Dose {body.status}: "
            f"{body.medication_name} for {body.patient_name}"
        )

        caregiver_display = body.caregiver_name or "caregiver"

        html = f"""
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont,
                    'Segoe UI', sans-serif; line-height:1.5;">
          <h2>Medication alert for {body.patient_name}</h2>
          <p>Dear {caregiver_display},</p>
          <p>
            This is an automated notification from the
            <strong>Medication Companion</strong> app.
          </p>
          <ul>
            <li><strong>Patient:</strong> {body.patient_name}</li>
            <li><strong>Medication:</strong> {body.medication_name}</li>
            <li><strong>Scheduled time:</strong> {body.scheduled_time}</li>
            <li><strong>Status:</strong> {body.status}</li>
          </ul>
        """

        if body.reason:
            html += f"<p><strong>Reason:</strong> {body.reason}</p>"

        html += """
          <p style="margin-top:1rem; font-size: 14px; color:#555;">
            This message is for awareness only. It does not replace professional
            medical advice. Please check in with the patient directly if you are
            concerned.
          </p>
        </div>
        """

        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        }

        payload = {
            "from": RESEND_FROM_EMAIL,
            "to": [body.caregiver_email],
            "subject": subject,
            "html": html,
        }

        try:
            resp = requests.post(
                "https://api.resend.com/emails",
                headers=headers,
                json=payload,
                timeout=10,
            )
            resp.raise_for_status()
        except Exception as e:
            print(f"Error sending Resend email: {e}")

    background_tasks.add_task(_send_email)

    return {"status": "queued"}


# ---------------------------------------------------------
# Simple Chat endpoint for simplifying instructions / questions
# ---------------------------------------------------------
@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    """
    Very small, constrained chat endpoint used by the frontend.
    """
    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "user",
                    "content": req.message,
                }
            ],
            temperature=0.2,
        )

        reply = completion.choices[0].message.content or ""
        return {"reply": reply.strip()}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error in /api/chat: {str(e)}",
        )
