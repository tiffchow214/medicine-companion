# Medicine Companion 💊🩺

Medicine Companion is a web app designed to help elderly users (and their families) manage medication effortlessly.  
Set reminders, track doses, and reduce the risk of missed medication.

---

## 🧠 What’s in this project?

This repo contains:

- A **FastAPI backend** powers the medicine reminder using OpenAI plus Firecrawl, ElevenLabs, and Resend.
- A **frontend** (Next.js / React) that provides the medicine reminder UI

The backend originally started as a “supportive mental coach” template and has been adapted for this medicine reminder use case.

---

## 🚀 Backend – OpenAI Chat API (FastAPI)

### Prerequisites

- [`uv`](https://github.com/astral-sh/uv) package manager  
  Install via pip:
  ```bash
  pip install uv
