# Project Overview

**Crimson Sanctum** is an immersive, single-page web application (SPA) acting as an AI-powered "spiritual therapist." It differs from standard chat bots by implementing a specific "Gen Z Spiritual Bestie" persona, mood detection, and real-time voice interaction.

### Core Technologies

* **Frontend Framework:** React (TypeScript)
* **Styling:** Tailwind CSS (Custom dark/red aesthetic, animations)
* **AI Engine:** Google Gemini API (`@google/genai` SDK)
* **Audio Engine:** Native Web Audio API (AudioContext) for PCM streaming.

## Run Locally

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
