### Medication Companion – Frontend

This is a small Next.js app that gives elderly users and caregivers a **clear, calm view of daily medications**, plus an optional AI helper that can **rephrase doctor instructions** and **suggest questions to ask the doctor**.

It does **not** invent medicines, doses, or schedules. It only works with what the user types in.

---

### What you can do here

- **Enter medications manually**
  - Name (e.g. “Metformin”)
  - Dose (exactly as written on the label)
  - When to take it (exactly as written)
  - Optional: any extra instructions from the doctor
- **See a clear “today” view**
  - Medications grouped into **Morning / Afternoon / Evening / Night**
  - Big, high-contrast buttons to **mark each dose as taken**
- **Ask the AI for help (safely)**
  - **Simplify instructions** into plainer, calmer language
  - **Generate questions** to ask a doctor or pharmacist
  - The AI is explicitly instructed **not to change doses or give medical advice**

---

### Prerequisites

You’ll want:

- **Node.js** 18+ (20+ recommended)
- **npm** (comes with Node)
- A running **backend** for the AI helper:
  - From the project root, you can start the FastAPI backend already in this repo:
    - `uvicorn api.index:app --reload`
  - Make sure `OPENAI_API_KEY` is set in your environment.

By default, the frontend will call the backend at `http://localhost:8000/api/chat`.  
You can change this with the `NEXT_PUBLIC_API_BASE_URL` environment variable.

---

### How to run the frontend

From the **project root**:

```bash
cd frontend
npm install        # first time only
npm run dev        # start the Next.js dev server
```

Then open `http://localhost:3000` in your browser.

You should see:

- A dark, high-contrast layout
- A **“Medication Companion”** header and safety notice
- A left panel for entering medications
- A right panel showing **Today’s doses** with toggle-able “Take dose” buttons

---

### Production build (for Vercel or similar)

```bash
cd frontend
npm install
npm run build
npm start
```

On Vercel, you can deploy this `frontend` folder as a Next.js app.  
Set `NEXT_PUBLIC_API_BASE_URL` to point at your deployed FastAPI backend URL.

---

### Safety notes

- The app:
  - **Does not** choose medicines.
  - **Does not** change doses or timings.
  - **Does not** give treatment advice.
- The AI helper:
  - Only **rephrases** user-provided instructions.
  - Only **suggests questions** to ask a clinician.
  - Repeatedly reminds users to follow their doctor’s guidance.

Always double-check everything against the original label or doctor’s instructions. When in doubt, **ask a clinician, not the app**. 💊
