# api/index.py

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
import os
import requests
import httpx

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
    medication_name: str  # e.g. "Aspirin"


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


# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "message": "Backend is running"}


# ---------------------------------------------------------------------
# OPENAI — Personalized Reminder Message
# ---------------------------------------------------------------------
@app.post("/api/personalized-reminder")
def personalized_reminder(req: PersonalizedReminderRequest):
    """
    Generate a warm, personalized reminder sentence for this user/medication.

    Example request:
    {
      "user_name": "Tiffany",
      "medication_name": "Aspirin",
      "purpose": "pain relief",
      "adherence": {
        "current_streak": 7,
        "missed_in_last_week": 0
      }
    }

    Returns:
    { "message": "Good morning Tiffany! ..." }
    """
    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You create warm, encouraging medication reminders for "
                        "elderly users.\n\n"
                        "Guidelines:\n"
                        "- Use their name\n"
                        "- Reference why they take the medicine if you know it\n"
                        "- Acknowledge their progress (streak)\n"
                        "- If they missed doses, be gentle and supportive\n"
                        "- Keep it very simple and clear\n"
                        "- Maximum 2 short sentences."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"User name: {req.user_name}\n"
                        f"Medication: {req.medication_name}\n"
                        f"Purpose: {req.purpose or 'unknown'}\n"
                        f"Current streak (days in a row taken): {req.adherence.current_streak}\n"
                        f"Missed doses in last week: {req.adherence.missed_in_last_week}"
                    ),
                },
            ],
        )

        message = completion.choices[0].message.content.strip()
        return {"message": message}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating personalized reminder: {str(e)}",
        )


# ---------------------------------------------------------
# OpenFDA + GPT: Drug information
# ---------------------------------------------------------
@app.post("/api/drug-info")
async def get_drug_info(body: DrugInfoRequest):
    """
    Fetch drug information from OpenFDA API and use GPT to create a simplified summary.
    
    Example request:
    {
        "medication_name": "Aspirin"
    }
    
    Returns:
    {
        "medication_name": "Aspirin",
        "general_markdown": "...",
        "usage_markdown": "...",
        "side_effects_markdown": "...",
        "source_url": "https://api.fda.gov/..."
    }
    """
    try:
        med_name = body.medication_name.strip()
        
        # 1. Query OpenFDA for drug label
        openfda_url = "https://api.fda.gov/drug/label.json"
        params = {
            "search": f'openfda.brand_name:"{med_name}" OR openfda.generic_name:"{med_name}"',
            "limit": 1
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            fda_response = await client.get(openfda_url, params=params)
        
        if fda_response.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"OpenFDA API error: {fda_response.status_code}"
            )
        
        fda_data = fda_response.json()
        
        if not fda_data.get("results"):
            raise HTTPException(
                status_code=404,
                detail=f"No FDA data found for medication: {med_name}"
            )
        
        result = fda_data["results"][0]
        
        # Extract relevant sections from FDA label
        purpose = " ".join(result.get("purpose", []))
        warnings = " ".join(result.get("warnings", []))
        indications = " ".join(result.get("indications_and_usage", []))
        dosage = " ".join(result.get("dosage_and_administration", []))
        adverse_reactions = " ".join(result.get("adverse_reactions", []))
        
        # 2. Use GPT to simplify the FDA data into elderly-friendly language
        system_prompt = """You are a helpful assistant that explains medication information in simple, clear language for elderly users.

Your task:
1. Read the FDA drug label information provided
2. Create three SHORT summaries (max 3-4 sentences each):
   - General info (what it's for, key warnings)
   - How to use it (dosage, when to take)
   - Possible side effects (most common ones)

Guidelines:
- Use simple words (avoid medical jargon)
- Be clear and direct
- Focus on what matters most to patients
- Keep each section SHORT (3-4 sentences max)
- If info is missing or unclear, say "Consult your doctor or pharmacist"
"""

        user_prompt = f"""Medication: {med_name}

FDA Label Information:

Purpose: {purpose[:500] if purpose else "Not specified"}

Indications: {indications[:500] if indications else "Not specified"}

Warnings: {warnings[:500] if warnings else "Not specified"}

Dosage: {dosage[:500] if dosage else "Not specified"}

Adverse Reactions: {adverse_reactions[:500] if adverse_reactions else "Not specified"}

Please create three SHORT summaries in plain language for an elderly patient."""

        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
        )
        
        ai_summary = completion.choices[0].message.content.strip()
        
        # Simple parsing - split by sections
        # GPT usually structures the response well
        sections = ai_summary.split("\n\n")
        
        general_markdown = sections[0] if len(sections) > 0 else ai_summary
        usage_markdown = sections[1] if len(sections) > 1 else "Consult your doctor or pharmacist for dosage information."
        side_effects_markdown = sections[2] if len(sections) > 2 else "Consult your doctor or pharmacist about possible side effects."
        
        # Build source URL
        source_url = f"https://api.fda.gov/drug/label.json?search=openfda.brand_name:\"{med_name}\""
        
        return {
            "medication_name": med_name,
            "general_markdown": general_markdown,
            "usage_markdown": usage_markdown,
            "side_effects_markdown": side_effects_markdown,
            "source_url": source_url,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching drug info: {str(e)}"
        )


# ---------------------------------------------------------
# ElevenLabs: streaming reminder audio
# ---------------------------------------------------------
DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"  # replace with a voice from your ElevenLabs dashboard


@app.post("/api/reminder-audio")
def reminder_audio(body: ReminderAudioRequest):
    """
    Generate a short reminder audio clip like:

    "Hey Tiffany, it's time to take your Aspirin. Please take 500mg, 1 tablet."

    The frontend should call this *at the time of the reminder* and play the returned audio.
    """
    if not ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_API_KEY is not set on the server.",
        )

    # Build the spoken script
    if body.personalized_message:
        # Use personalized message if provided
        script = body.personalized_message
        if body.dose:
            script += f" Please take {body.dose}."
    else:
        # Use generic template
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

    The FRONTEND decides:
    - when a dose is 'missed' or 'skipped'
    - what info to send
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

    # send in the background so we don't block the response
    background_tasks.add_task(_send_email)

    return {"status": "queued"}