# TripGenie AI — 3D AI-Powered Travel Planning Chatbot

A full-stack Next.js + Three.js + SQLite AI travel planning assistant built for personalized itineraries, interactive 3D globe visualizations, live weather, street maps, budget analytics, and multi-language travel assistance.

## Key Features
- **Interactive 3D WebGL Globe (`Three.js`)**: Procedural illuminated continents, Fresnel atmosphere halo, starfield, glowing destination beacons, animated curved 3D flight arcs, and camera fly-to animations.
- **3D Holographic AI Genie Orb**: Real-time Three.js animated AI avatar reacting to thinking/idle states.
- **Personalized Day-by-Day Itineraries**: Tailored by budget tier, duration, travelers, and interests with one-click plan adjustments (*Cut Cost 20%*, *Rainy Day Backup*, *More Relaxed*, *+1 Extra Day*).
- **Live Zero-Key APIs**:
  - **Open-Meteo Geocoding & Weather Forecast** (live conditions + 7-day forecast + AI packing list).
  - **Leaflet + OpenStreetMap** interactive route & day-colored pin map.
  - **REST Countries & Frankfurter Exchange Rates** for country intel and live multi-currency conversion (`USD`, `EUR`, `INR`, `GBP`, `JPY`, `AED`).
- **Dual AI Engine**: Works immediately out-of-the-box in **Smart Demo Mode**, or connect a **Google Gemini API Key (`gemini-4-hydrogen` via `@google/genai`)** in Settings or `.env.local`.
- **SQLite Persistence**: Saves favorite trips and chat history locally in `./data/tripgenie.db` using Node.js built-in `node:sqlite`.
- **Multi-Language Support**: English, Hindi, Spanish, French, Japanese, German, and Arabic (with RTL layout).

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Optional: Enable Live Gemini 4 Hydrogen Mode
Create a `.env.local` file (or paste your key inside the **AI & Settings** modal in the UI):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```
