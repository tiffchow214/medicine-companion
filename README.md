# 💊 Medicine Companion

A web application designed to help elderly users and their caretakers manage medication schedules, get reminders, and access reliable medication information.

Vercel link:
https://medicine-companion.vercel.app/welcome 


## 🌟 Features

- **Smart Medication Reminders** - Get timely notifications when it's time to take your medication
- **Voice Alerts** - Friendly voice reminders using AI-generated speech
- **Medication Information** - Access FDA-approved drug information from OpenFDA
- **Caretaker Notifications** - Alert designated caretakers when doses are missed or skipped
- **Visual Calendar** - Color-coded medication schedule overview
- **Adherence Tracking** - Monitor medication-taking patterns and streaks
- **Multiple Profiles** - Support for multiple users (useful for caretakers managing multiple patients)
- **Personalized Messages** - AI-generated encouraging reminders tailored to each user

## 🚀 Live Demo

**Frontend:** [https://medicine-companion-xxx.vercel.app](your-vercel-url)  
**Backend API:** [https://medicine-companion-38967297054.europe-west1.run.app](https://medicine-companion-38967297054.europe-west1.run.app)

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (React)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **UI Components:** Lucide Icons, ReactMarkdown

### Backend
- **Framework:** FastAPI (Python)
- **AI/ML:** OpenAI GPT-4o-mini
- **Voice Generation:** ElevenLabs API
- **Email Notifications:** Resend API
- **Drug Information:** OpenFDA API
- **Deployment:** Google Cloud Run
- **Container:** Docker

## 📋 Prerequisites

Before running this project locally, make sure you have:

- Node.js 18+ and npm
- Python 3.11+
- Git
- API Keys for:
  - OpenAI (for AI-generated reminders)
  - ElevenLabs (for voice reminders)
  - Resend (for caretaker email notifications)

## 🔧 Installation & Setup

### Backend Setup

1. **Clone the repository**
```bash
   git clone https://github.com/tiffchow214/medicine-companion.git
   cd medicine-companion
```

2. **Create Python virtual environment**
```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install Python dependencies**
```bash
   pip install -r requirements.txt
```

4. **Create `.env` file in the project root**
```bash
   OPENAI_API_KEY=sk-proj-your-key-here
   ELEVENLABS_API_KEY=your-key-here
   RESEND_API_KEY=re_your-key-here
   RESEND_FROM_EMAIL=Medication Companion <no-reply@yourdomain.com>
```

5. **Run the backend**
```bash
   PORT=8080 uvicorn api.index:app --host 0.0.0.0 --port 8080 --reload
```

   Backend will be available at `http://localhost:8080`

### Frontend Setup

1. **Navigate to frontend directory**
```bash
   cd frontend
```

2. **Install dependencies**
```bash
   npm install
```

3. **Create `.env.local` file in the frontend directory**
```bash
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

4. **Run the development server**
```bash
   npm run dev
```

   Frontend will be available at `http://localhost:3000`

## 🌐 Deployment

### Backend Deployment (Google Cloud Run)

1. **Build and push Docker image**
```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/medicine-companion
```

2. **Deploy to Cloud Run**
```bash
   gcloud run deploy medicine-companion \
     --image gcr.io/YOUR_PROJECT_ID/medicine-companion \
     --platform managed \
     --region europe-west1 \
     --allow-unauthenticated \
     --set-env-vars OPENAI_API_KEY=xxx,ELEVENLABS_API_KEY=xxx,RESEND_API_KEY=xxx
```

### Frontend Deployment (Vercel)

1. **Connect your GitHub repository to Vercel**

2. **Add environment variables in Vercel dashboard:**
   - `NEXT_PUBLIC_API_BASE_URL` = Your Cloud Run backend URL

3. **Deploy** - Vercel will automatically deploy on push to main branch

## 📖 API Documentation

Once the backend is running, visit:
- Interactive API docs: `http://localhost:8080/docs`
- Alternative docs: `http://localhost:8080/redoc`

### Main Endpoints

- `GET /` - Health check
- `POST /api/drug-info` - Get FDA drug information
- `POST /api/personalized-reminder` - Generate AI reminder message
- `POST /api/reminder-audio` - Generate voice reminder audio
- `POST /api/caregiver-alert` - Send email to caretaker
- `POST /api/chat` - Simple chat endpoint

## 🎨 Features Walkthrough

### 1. **Welcome Page**
Users enter their name to get started with a personalized experience.

### 2. **Add Medication**
- Enter medication name, purpose, dosage
- Set frequency (every 4/6/8/12 hours, once/twice daily)
- Choose start time - app calculates all dose times automatically

### 3. **Caretaker Setup**
Optionally add a caretaker who will be notified if doses are missed.

### 4. **Dashboard**
- Monthly calendar view with color-coded medications
- Medication overview cards showing adherence stats
- Quick access to "Learn More" about each medication

### 5. **Medication Reminders**
When it's time for medication:
- Visual popup reminder
- Voice reminder with personalized, encouraging message
- Options: "I took it" or "Skip this dose"

### 6. **Settings**
- Edit profile information
- Delete profile
- Add/switch between multiple profiles
- Toggle notification preferences

## 🔐 Privacy & Security

- All health data is stored locally in the browser (localStorage)
- No user data is stored on servers (privacy-first design)
- API calls are made over HTTPS
- Caretaker emails are only sent with explicit user consent

## 🚧 Known Limitations

- Currently uses browser localStorage (no database persistence)
- Reminders only work when browser is open
- Limited to web browsers (no native mobile app yet)
- Voice reminders require browser audio permissions

## 🛣️ Desirable Features

- [ ] Database integration for persistent storage 
- [ ] Push notifications (work even when browser closed)
- [ ] Multiple languages support
- [ ] Integration with pharmacy APIs
- [ ] Refill reminders
- [ ] Medication interaction checker
- [ ] Doctors appointment booking

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Tiffany Chow** - [@tiffchow214](https://github.com/tiffchow214)

## 🙏 Acknowledgments

- OpenFDA for providing free drug information API
- OpenAI for GPT-4 API
- ElevenLabs for text-to-speech API
- Resend for email notifications
- AI Makerspace for the starter template


## ⚠️ Disclaimer

This application is for educational and informational purposes only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.

---

Made with ❤️ for elderly users and their caretakers