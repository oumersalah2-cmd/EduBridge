# EduBridge

Open-source accessible learning media and live classroom platform built for the Digital Bridge Accessibility Hackathon 2026 (Track 2, 48-hour sprint).

EduBridge delivers accessible educational content designed for low-bandwidth (3G/offline) settings and diverse accessibility requirements (screen readers, captions, sign language video, Braille Ready Format).

---

## Target Structure

```
EduBridge/
├── /api          # Express backend + MongoDB + FFmpeg/Whisper pipeline
├── /studio       # React + Vite + Tailwind CSS teacher Studio
├── /player       # Accessible embed.js + vanilla JS player (zero runtime dependencies)
├── /jobcard      # Accessible embeddable job card (vanilla JS, zero runtime dependencies)
├── /partner      # Standalone sample partner HTML page with embed slot
├── /docs         # OpenAPI specification, technical decisions, WCAG 2.2 AA report, risk tests
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 5-Step Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repo-url> EduBridge
   cd EduBridge
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Set STUDIO_KEY to your secret string if needed
   ```

3. **Start services with Docker Compose:**
   ```bash
   docker compose up -d
   ```

4. **Verify running services:**
   - Health check: [http://localhost:4000/api/health](http://localhost:4000/api/health)
   - OpenAPI documentation (Swagger UI): [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

5. **Run test suite:**
   ```bash
   cd api && npm test
   ```

---

## Team Roles

- **Member 1 (Backend & AI Pipeline Lead):** Node.js API, MongoDB schemas, FFmpeg/Whisper offline media pipeline, Server-Sent Events live classroom streaming, Braille (.brf) generation, and 3G offline packs.
- **Member 2 (Studio Lead):** Accessible Teacher Studio (React + Vite + Tailwind CSS), live teaching podium, speech recognition controls, and accessible job card interface.
- **Member 3 (Player & Accessibility Gate):** Zero-dependency accessible player, embed snippet script (`embed.js`), accessible partner integration, and WCAG 2.2 AA validation suite.
