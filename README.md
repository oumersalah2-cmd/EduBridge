# EduBridge, Track 2: Accessible Learning Media, Team Members & Co-Designers

**Digital Bridge Accessibility Hackathon 2026 (ALX Savanna, Track 2)**

### Team Members
- **Member 1 (Backend & Media Pipeline Lead):** Node.js/Express API, MongoDB data schemas, SSE live classroom stream, Whisper transcript generation, and offline ZIP pack bundling.
- **Member 2 (Studio Lead):** Accessible Teacher Studio (React + Vite + Tailwind CSS), live teaching podium, speech recognition controls, and accessible job card interface.
- **Member 3 (Learner Player, Job Card & Accessibility Gate Lead):** `<db-player>` zero-dependency Web Component, bilingual WebVTT caption engine (EN/AM), synchronized Ethiopian Sign Language (EthSL) PIP window, `<db-jobcard>` Career Gateway, Savanna & Partner embeds, and WCAG 2.2 Level AA audit.

### Co-Designers & Advisors
- **Abebe K. (Blind Screen-Reader User & Co-Designer):** Tested mobile TalkBack navigation, keyboard shortcut discoverability, and Audio-First read-aloud flow.
- **Selamawit T. (Deaf Learner & Ethiopian Sign Language Co-Designer):** Evaluated EthSL PIP synchronization, corner button positioning (WCAG 2.5.7), and dual-language caption clarity.

---

## What it does
EduBridge is an open-source, low-bandwidth learning media platform that makes educational videos and live classroom sessions accessible to Deaf, hard-of-hearing, blind, and low-vision students. It features an embeddable, zero-dependency video player (`<db-player>`) equipped with high-contrast Amharic/English captions, a draggable and button-controlled Ethiopian Sign Language PIP window, and an Audio-First read-aloud mode. EduBridge also delivers an accessible Career Gateway (`<db-jobcard>`) with synthesized audio summaries and machine-readable `schema.org/JobPosting` metadata.

---

## The main task we tested
A blind or Deaf student using a low-cost mobile phone on a Slow 3G connection can independently open a lesson inside ALX Savanna or any partner site, read or listen to the bilingual transcript, reposition the Ethiopian Sign Language video without a mouse, and submit questions to a live classroom companion without encountering accessibility barriers.

---

## Run it

### Option A: Docker Compose (All Services)
```bash
docker compose up -d
```
- **Backend API & Swagger UI:** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- **Teacher Studio:** [http://localhost:5173](http://localhost:5173)
- **Learner Player & Savanna Showcase:** [http://localhost:8000](http://localhost:8000)

### Option B: Local Development / Static Server
1. **Start the API Server:**
   ```bash
   cd api
   npm install
   npm run dev
   # Runs on http://localhost:4000
   ```
2. **Start the Learner Frontend Server:**
   ```bash
   # From project root:
   python3 -m http.server 8000
   ```
3. **Open Proofs:**
   - **Standalone Demo Proof:** [http://localhost:8000/demo/blank.html](http://localhost:8000/demo/blank.html)
   - **ALX Savanna Integration Proof:** [http://localhost:8000/savanna/pages/concept-with-navigation.html](http://localhost:8000/savanna/pages/concept-with-navigation.html)
   - **Player & Live Classroom Hub:** [http://localhost:8000/player/index.html](http://localhost:8000/player/index.html)
   - **Partner Embed Showcase:** [http://localhost:8000/partner/index.html](http://localhost:8000/partner/index.html)
   - **Career Gateway (`<db-jobcard>`):** [http://localhost:8000/jobcard/index.html](http://localhost:8000/jobcard/index.html)

---

## Install, Level 1

Embed the accessible player anywhere with two lines of HTML. No frameworks, build steps, or external dependencies required:

```html
<!-- 1. Include the embed script (or import as module) -->
<script type="module" src="http://localhost:8000/player/embed.js"></script>

<!-- 2. Drop the custom element into your page -->
<db-player
  src="/demo/data/lesson.mp4"
  ethsl="/demo/data/lesson.ethsl.mp4"
  vtt-en="/demo/data/lesson.en.vtt"
  vtt-am="/demo/data/lesson.am.vtt"
  offline-zip="/demo/data/lesson-offline.zip"
  title="Introduction to Accessible Web Development">
</db-player>
```

### Supported Attributes
| Attribute | Description | Default |
| :--- | :--- | :--- |
| `src` | URL of the primary MP4/WebM video stream | Required |
| `ethsl` | URL of the synchronized Ethiopian Sign Language video | Optional |
| `vtt-en` | URL of the English WebVTT captions | Optional |
| `vtt-am` | URL of the Amharic Ethiopic WebVTT captions | Optional |
| `offline-zip`| URL of the downloadable 3G offline lesson bundle | Optional |
| `describe` | URL of an alternate audio-described audio track | Optional |
| `title` | Accessible title for screen readers and header display | `"Lesson Player"` |

### Custom Events
`<db-player>` dispatches standard CustomEvents:
```javascript
const player = document.querySelector('db-player');

// Fired on playback timeupdate: { detail: { currentTime, duration, progressPercent } }
player.addEventListener('db-player:progress', (e) => console.log(e.detail));

// Fired when accessibility preferences change (caption size, theme, audio mode)
player.addEventListener('db-player:prefs', (e) => console.log('New preferences:', e.detail));

// Fired when media playback completes
player.addEventListener('db-player:complete', () => console.log('Lesson completed'));

// Fired when media or network fails
player.addEventListener('db-player:error', (e) => console.error(e.detail.message));
```

---

## Install, Level 2

EduBridge provides a RESTful API and Server-Sent Events (SSE) live stream specification.

- **OpenAPI 3.0 Specification:** [openapi.yaml](openapi.yaml) (or [docs/openapi.yaml](docs/openapi.yaml))
- **Interactive Swagger UI:** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- **JSON Specification Endpoint:** [http://localhost:4000/api/openapi.json](http://localhost:4000/api/openapi.json)

### Sample cURL Commands

1. **Health Check:**
   ```bash
   curl -s http://localhost:4000/api/health
   # Returns: {"status":"healthy","uptime":...}
   ```

2. **Fetch Lessons List:**
   ```bash
   curl -s http://localhost:4000/api/lessons
   ```

3. **Listen to Real-Time Classroom Live Stream (SSE):**
   ```bash
   curl -N -H "Accept: text/event-stream" http://localhost:4000/api/live/sessions/482910/stream
   ```

4. **Submit a Student Live Question:**
   ```bash
   curl -X POST http://localhost:4000/api/live/sessions/482910/questions \
     -H "Content-Type: application/json" \
     -d '{"author":"Selam","text":"Can you explain line-height for Ethiopic typography?"}'
   ```

---

## Install, Level 3

EduBridge provides `<db-jobcard>`, an accessible custom web component that bridges learning with employment. It embeds rich job opportunities directly beside course content.

```html
<script type="module" src="/jobcard/db-jobcard.js"></script>

<db-jobcard
  title="Junior Accessibility QA Engineer"
  company="Ethio Telecom"
  location="Addis Ababa, Ethiopia (Hybrid)"
  type="Full-time"
  salary="25,000 - 35,000 ETB / month"
  deadline="December 1, 2026"
  apply-url="https://example.com/apply/qa-101"
  description="Audit educational and enterprise applications against WCAG 2.2 Level AA. Test with NVDA and TalkBack.">
</db-jobcard>
```

### Automatic Semantic JSON-LD Injection
`<db-jobcard>` automatically generates and injects a `<script type="application/ld+json">` tag adhering to the **schema.org/JobPosting** standard into the document `<head>`, ensuring assistive search engines, job aggregators, and screen readers can parse structured job details accurately.

---

## Languages
EduBridge supports full bilingual presentation:
- **English (`en`):** Default international captions, UI labels, and transcript text.
- **Amharic (`am`):** Ethiopic script typography (`ግዕዝ`) with dedicated line-height scaling (`1.75`) to prevent diacritic clipping, and explicit `lang="am"` attributes for screen-reader speech engine switching (`am-ET`).

### Adding a New Language
To add a new language (e.g., Afaan Oromoo, Tigrinya, French):
1. Place the WebVTT file in `demo/data/lesson.<lang_code>.vtt`.
2. Reference it on `<db-player>`:
   ```html
   <db-player vtt-om="/demo/data/lesson.om.vtt" ...></db-player>
   ```
3. Add locale strings to the caption selector dictionary inside `player/db-player.js`.

---

## Offline and slow connection
Tested extensively under simulated **Slow 3G** (400 Kbps down, 100 Kbps up, 400ms RTT) and sound-off / no-GPU mobile hardware:
- **3G Offline Pack (.zip):** Includes single-file `lesson.html`, compressed audio, and bilingual plain-text transcripts in a package under **1.8 MB**.
- **Instant Audio-Only Toggle (`📻`):** Disables video stream decoding on low-end processors, saving >90% bandwidth while streaming clear audio and live transcript cues.
- **Zero-Dependency Core:** The player JavaScript bundle is lightweight, self-contained, and requires 0 KB of external runtime CDN dependencies.

---

## Data and privacy
- **Zero Personal Identifiable Information (PII):** Learner accounts are not tracked or required to view lessons or participate in live sessions.
- **Anonymous Session PINs:** Students join live companion streams using a randomized 6-digit PIN.
- **Local Preference Storage Only:** Caption size, contrast theme, and volume preferences are stored strictly in the browser's `localStorage` and never transmitted to external servers.

---

## Cost to run
- **Infrastructure Cost:** **$0.00 / free tier**.
- Can be self-hosted locally or deployed on any free/low-cost container instance (Docker, Railway, Fly.io, or on-premise school servers).
- Zero paid API dependencies for core playback, caption display, sign language PIP, and live SSE streaming.

---

## Finished and not finished

### Finished & Verified (100% Complete)
- [x] `<db-player>` zero-dependency Web Component isolated inside Shadow DOM.
- [x] WebVTT parser supporting English and Amharic with human-verified badges (`✓ በሰው የተገመገመ`).
- [x] 4 text sizes (100%–200%) and 3 high-contrast themes (Yellow/Black, White/Black, Black/Yellow).
- [x] Complete keyboard operability (Space, K, Left, Right, M, C, S, T, F, ?) and `<dialog>` modal.
- [x] Dual-video Ethiopian Sign Language PIP with sub-second sync drift correction.
- [x] **WCAG 2.5.7 compliant PIP controls:** Free mouse dragging/resizing PLUS single-click button controls (`↖`, `↗`, `↙`, `↘`, `⇲`).
- [x] Audio-First screen-reader read-aloud mode with sentence-by-sentence navigation and clickable cues.
- [x] Downloadable `.txt` transcript and 3G offline pack bundle.
- [x] `<db-jobcard>` component with `schema.org/JobPosting` JSON-LD injection and audio summary.
- [x] Integration inside ALX Savanna (`savanna/pages/concept-with-navigation.html`) and standalone (`demo/blank.html`, `partner/index.html`).
- [x] Student Live Classroom Companion view with SSE real-time captions and question submission.
- [x] Comprehensive WCAG 2.2 Level AA Conformance Report (`CONFORMANCE.md`, `docs/WCAG_2.2_AA_REPORT.md`).

### Future Scope / Not Finished
- [ ] Automated real-time Ethiopian Sign Language 3D Avatar synthesis (currently uses synchronized recorded sign language videos).
- [ ] Offline PWA Service Worker caching for seamless background synchronization.

---

## Libraries and their licences
All dependencies are 100% open-source under permissive licenses:
- **Express.js:** MIT License
- **MongoDB Node Driver:** Apache 2.0 License
- **Swagger UI Express / swagger-jsdoc:** Apache 2.0 / MIT License
- **CORS:** MIT License
- **dotenv:** BSD-2-Clause License
- **Player & Job Card Frontend:** 100% Vanilla JavaScript (Custom Web Components), **Zero external libraries**, MIT License.
