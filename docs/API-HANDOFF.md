# EduBridge API Handoff Guide
*For Member 2 (Studio) and Member 3 (Player and Job Card)*

---

## 1. Single Source of Truth & Team Rule
> [!IMPORTANT]
> **Contract Rule:** Only **Member 1** edits [docs/openapi.yaml](file:///home/ab/EduBridge/docs/openapi.yaml).
> If you need any change, new parameter, or response field adjustment, please request it by message so the OpenAPI contract remains consistent across all components.

Interactive Documentation (Swagger UI):
- [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

---

## 2. Base URLs & LAN Hotspot Mode
- **Local:** `http://localhost:4000`
- **LAN / Hotspot Mode:** The API automatically binds to `0.0.0.0` and prints your local IP at startup (e.g. `http://192.168.1.50:4000`). Students on a phone hotspot connect directly without internet.
- **CORS:** Enabled for all ports (Studio on `5173`, Player on `3000`/`8080`, partner HTML pages).

---

## 3. Quick Start (Mock Mode Active)

Mock mode is enabled by default in `.env.example` so Member 2 and Member 3 can build immediately with zero dependencies (no MongoDB, FFmpeg, or GPU required).

### Run with Docker Compose:
```bash
git clone <repo-url> EduBridge
cd EduBridge
cp .env.example .env
docker compose up --build
```

### Run Standalone (Node.js):
```bash
cd api
npm install
npm start
```

### Switching Mock Mode:
- **Mock Mode ON (Default for Teammates):** Keep `MOCK_API=true` in `.env` (returns realistic shapes, mock live stream, and video progress simulation).
  > [!IMPORTANT]
  > **Teammates:** Keep `MOCK_API=true` until Member 1 announces that the real pipeline is ready.
- **Mock Mode OFF:** Set `MOCK_API=false` in `.env` (activates real MongoDB storage and media pipeline).
- **PUBLIC_BASE_URL:** Set in `.env` (default `http://localhost:4000`). All URLs (captions, audio, sign video, braille, offline pack, embed snippets, live joinUrl) are built as absolute URLs starting with this base. In classroom LAN hotspot mode, set this to your laptop's LAN IP (e.g. `http://192.168.1.50:4000`).

---

## 4. Lifecycle States & Values

### Video `status` Values:
- `uploaded` — Video received, waiting in queue.
- `processing` — Audio extraction / Whisper transcription in progress.
- `review` — Ready for educator review & caption edits.
- `published` — Finalized with 3G offline pack and embed code generated.
- `live` — Active live classroom origin.
- `failed` — Accessible failure state with plain-language error message.

### Video `step` Values (Designed for `<div aria-live="polite">`):
- `"Video uploaded. Queued for audio extraction."`
- `"Extracting 16 kHz audio for transcription"`
- `"Writing English captions with Whisper"`
- `"Transcription complete. Human review ready."`
- `"Lesson published and ready for accessible distribution."`

### Caption `reviewStatus` Values:
- `"machine-generated"` — Default auto-generated transcript (or reset upon human edits).
- `"human-reviewed"` — Verified and approved by an educator.

---

## 5. Live Stream Client Example (`EventSource`)

In `/player` or `/studio`, connect using standard zero-dependency Web API:

```javascript
const sessionPin = "620942";
const eventSource = new EventSource(`http://localhost:4000/api/live/sessions/${sessionPin}/stream`);

// Live Speech Captions
eventSource.addEventListener("caption", (event) => {
  const data = JSON.parse(event.data);
  // data: { text: string, isFinal: boolean, ts: number }
  const liveRegion = document.getElementById("live-captions");
  liveRegion.textContent = data.text;
  if (data.isFinal) {
    liveRegion.classList.remove("italic");
  }
});

// Real-Time Board / Slide Notes
eventSource.addEventListener("board", (event) => {
  const note = JSON.parse(event.data);
  // note: { id: string, text: string, ts: number }
  document.getElementById("board-notes").textContent = note.text;
});

// Question Status Updates (new questions or teacher dismissals)
eventSource.addEventListener("question-status", (event) => {
  const update = JSON.parse(event.data);
  // update: { action: "new" | "dismissed", question: { id, text } }
  console.log("Question update:", update);
});

// Session Concluded
eventSource.addEventListener("session-ended", (event) => {
  const data = JSON.parse(event.data);
  alert(`Class concluded. Recorded lesson ID: ${data.videoId}`);
  eventSource.close();
});

// Reconnect handling (automatic with Last-Event-ID)
eventSource.onerror = (err) => {
  console.warn("3G network reconnecting live stream...", err);
};
```

---

## 6. Curl Reference for Every Endpoint

*Note: Default key in `.env.example` is `change-me-to-a-long-random-string`.*

### Health & Docs
```bash
# Health Check
curl -s http://localhost:4000/api/health

# OpenAPI Swagger UI
curl -s http://localhost:4000/api/docs/

# OpenAPI JSON Specification
curl -s http://localhost:4000/api/openapi.json
```

### Video Studio & Processing Routes
```bash
# 1. Upload Video (Requires X-Studio-Key, multipart)
curl -s -X POST http://localhost:4000/api/videos \
  -H "X-Studio-Key: change-me-to-a-long-random-string" \
  -F "video=@sample.mp4"

# 2. Poll Processing Progress (For aria-live progress updates)
curl -s http://localhost:4000/api/videos/mock-video-demo-01

# 2b. Studio Lesson Preview with Raw Captions (Requires X-Studio-Key, all statuses except failed)
curl -s http://localhost:4000/api/videos/mock-video-demo-01/preview \
  -H "X-Studio-Key: change-me-to-a-long-random-string"

# 3. Save Human-Edited WebVTT (Resets review status to machine-generated)
curl -s -X PUT http://localhost:4000/api/videos/mock-video-demo-01/captions/en \
  -H "X-Studio-Key: change-me-to-a-long-random-string" \
  -H "Content-Type: text/vtt" \
  -d $'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nTeacher: Welcome to class.'

# 4. Approve Caption Track (Marks reviewStatus: human-reviewed)
curl -s -X POST http://localhost:4000/api/videos/mock-video-demo-01/approve/en \
  -H "X-Studio-Key: change-me-to-a-long-random-string"

# 5. Publish Lesson (Builds offline pack & returns embed snippets)
curl -s -X POST http://localhost:4000/api/videos/mock-video-demo-01/publish \
  -H "X-Studio-Key: change-me-to-a-long-random-string"
```

### Public Lesson & Offline Pack Routes
```bash
# 6. Get Public Lesson Metadata (Captions, transcript, video link, audio link - published only)
curl -s http://localhost:4000/api/public/videos/mock-video-demo-01

# 7. Download 3G Offline ZIP Bundle (audio.mp3, transcript.txt, lesson.html, lesson.brf)
curl -s -O http://localhost:4000/api/public/videos/mock-video-demo-01/offlinepack
```

### Live Classroom Companion Routes
```bash
# 8. Create Live Classroom Session (Generates 6-digit PIN)
curl -s -X POST http://localhost:4000/api/live/sessions \
  -H "X-Studio-Key: change-me-to-a-long-random-string"

# 9. Connect to Live SSE Stream (Public)
curl -N -s http://localhost:4000/api/live/sessions/620942/stream

# 10. Broadcast Teacher Speech Captions
curl -s -X POST http://localhost:4000/api/live/sessions/620942/captions \
  -H "X-Studio-Key: change-me-to-a-long-random-string" \
  -H "Content-Type: application/json" \
  -d '{"text": "Now let us examine the solar cell diagram.", "isFinal": true, "ts": 1700000000000}'

# 11. Broadcast Teacher Board Notes
curl -s -X POST http://localhost:4000/api/live/sessions/620942/board \
  -H "X-Studio-Key: change-me-to-a-long-random-string" \
  -H "Content-Type: application/json" \
  -d '{"text": "Key Concept: Photovoltaic effect converts photons into electrons."}'

# 12. Submit Student Question (Public, Rate-Limited, max 500 chars)
curl -s -X POST http://localhost:4000/api/live/sessions/620942/questions \
  -H "Content-Type: application/json" \
  -d '{"text": "What type of semiconductor material is used?"}'

# 13. Teacher Question Queue View
curl -s http://localhost:4000/api/live/sessions/620942/questions \
  -H "X-Studio-Key: change-me-to-a-long-random-string"

# 14. Dismiss Question (Spam control / answered)
curl -s -X DELETE http://localhost:4000/api/live/sessions/620942/questions/q-mock-1 \
  -H "X-Studio-Key: change-me-to-a-long-random-string"

# 15. End Live Session (Archives into permanent recorded lesson)
curl -s -X POST http://localhost:4000/api/live/sessions/620942/end \
  -H "X-Studio-Key: change-me-to-a-long-random-string"
```

### Accessible Job Opportunities Routes
```bash
# 16. List Accessible Ethiopian Job Cards (with schema.org JSON-LD)
curl -s http://localhost:4000/api/jobs

# 17. Get Specific Job Card
curl -s http://localhost:4000/api/jobs/job-eth-01
```

---

## 8. Developer CLI Scripts

### Pipeline Verification Runner (`checkpoint2-runner.js`)
A dev-only script to test and verify the video processing queue and audio pipeline end-to-end without requiring the Studio UI:
```bash
node api/scripts/checkpoint2-runner.js <path-to-video.mp4>
```
Takes a target video path as a CLI argument, validates the container with `ffprobe`, extracts 16 kHz WAV and 64 kbps mono MP3 with `ffmpeg`, transcribes speech with `faster-whisper`, formats non-overlapping WebVTT cues, and prints status steps and file sizes. If any tool is unavailable, it fails with a plain-language error message.

---

## 9. Changes Log

### 2026-11-14 (Update 3 - ALX Track 2 Conformance)
- **Root Single Contract**: Authoritative specification moved to root `openapi.yaml`. Loaded via `OPENAPI_PATH` environment variable. Swagger UI served at both `/docs` and `/api/docs`; raw JSON served at `/openapi.json` and `/api/openapi.json`. Mounted read-only into Docker.
- **Additive `/api/v1` Service Layer**:
  - `GET /api/v1/lessons/:id`: Published-only endpoint returning rich `tracks` array (`captions`, `sign`, `audio`, `audio-description`) and `offlinePackSizeBytes`.
  - `GET /api/v1/lessons/:id/transcript?lang=en|am`: Direct `text/plain` transcript for accessibility.
  - `GET /api/v1/lessons/:id/offline-pack`: Direct alias to 3G ZIP bundle download.
  - `POST /api/v1/lessons/:id/captions`: JSON body `{ lang, vtt }` with `X-Studio-Key`, saving WebVTT and resetting approval status to `machine-generated`.
  - `DELETE /api/v1/lessons/:id`: `X-Studio-Key` endpoint deleting MongoDB record AND unlinking all source video, audio, captions, and ZIP files from server disk (returns 204).
  - Outbound Webhooks (`POST/GET/DELETE /api/v1/webhooks`): Dispatches `lesson.published` and `captions.approved` events (`{ event, lessonId, at }`) with 5s timeout, 1 retry, SSRF private IP validation (bypassable with `WEBHOOK_ALLOW_PRIVATE=true`), and optional HMAC-SHA256 signature (`X-EduBridge-Signature`).
  - Ed25519 Signed Certificates (`POST /api/v1/certificates`, `GET /api/v1/certificates/:id/verify`): Issues and verifies tamper-evident Open Badges-compliant credentials; linked directly to job cards.
- **Live Classroom Archive Rebuild**:
  - Rebuilt `POST /api/live/sessions/:pin/end` (and `/api/v1` alias): WebVTT built from final captions with timestamps relative to session start, no overlaps, and sensible cue durations; plain-text transcript; chronologically unified `chatLog` (questions and board notes); immediate offline ZIP build; lesson record with `status: "review"`, `videoUrl: null`, `machine-generated` English captions; dispatches SSE `session-ended` event with `{ pin, videoId }` and closes all connections.
- **Amharic Human-First Pipeline**:
  - Completely removed external translation-model dependencies.
  - Controlled by `AMHARIC_MODE=off` (default; human-first without auto-generated Amharic) or `direct` (Whisper ASR draft tagged `machine-generated`).
  - Added CLI evaluation utility `api/scripts/measure-wer.py` supporting `jiwer` and fallback word-level Levenshtein DP.
- **Audio Description Support**:
  - Optional `audioDescription` multipart file on `POST /api/videos` (MP3). Stored in `uploads/audio/`, exposed as `audioDescriptionUrl`, and listed under `tracks`.
- **Stable Error Codes**:
  - Added structured `code` string (e.g. `KEY_REQUIRED`, `LESSON_NOT_FOUND`, `SESSION_NOT_FOUND`, `NO_FINAL_CAPTIONS`, `INVALID_VTT`, `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`) alongside human-readable `error` on every error response.
- **Tunnel & Trust Proxy Support**:
  - Enabled `app.set('trust proxy', true)`. Dynamic base URL resolution inspects `X-Forwarded-Proto` and `X-Forwarded-Host` when `PUBLIC_BASE_URL` is empty.
- **Docker & Web Gateway**:
  - Added `web` gateway service (`nginx:alpine` on port 8080) with SSE buffer bypass (`proxy_buffering off;`) and static mounts for `./savanna`, `./module`, and `./demo`.
  - Added base faster-whisper model bake in `api/Dockerfile`.
  - Auto-seeding of stable demo lesson (`"demo"`) and Ethiopian job postings on startup when database is empty.

### 2026-11-14 (Update 2)
- **Direct Source Video URL**: Added `videoUrl` (absolute via `PUBLIC_BASE_URL`) to `GET /api/public/videos/:id`, `GET /api/videos/:id/preview`, mock mode, and `openapi.yaml`. In real mode it points to the uploaded video file with HTTP range support (returns `null` for live-origin or audio-only sessions).
- **Studio Preview & Raw Captions Endpoint**: Added authenticated `GET /api/videos/:id/preview` (`X-Studio-Key`) returning the full public shape plus `rawCaptions: { en: "<vtt text>", am: "<vtt text or null>" }` for direct editing in the teacher Studio for any status except `failed` (which returns 409).
- **Strict Public Published Guard**: Changed `GET /api/public/videos/:id` to return a plain-language 409 Conflict for any lesson that is not yet `published` (unpublished / review lessons must use the authenticated `/preview` route).
- **OpenAPI JSON Documented**: Documented `GET /api/openapi.json` in `docs/openapi.yaml` and curl reference.
- **Database Job Cards**: Database `/api/jobs` and `/api/jobs/:id` report directly from MongoDB; mock fallback is strictly restricted to `MOCK_API=true`.
- **Honest Real-Mode Offline Pack**: Removed mock fallback bypass in `GET /api/public/videos/:id/offlinepack` when `MOCK_API=false`, ensuring real lessons strictly use database transcripts in generated packs.

### 2026-11-14
- **Demo Assets Relocation**: Tracked demo assets moved from `/uploads/` to `api/assets/demo/` and served at `/assets/demo/` with git tracking exceptions; runtime user uploads remain completely gitignored in `uploads/`.
- **Contract Parity Verified**: Automated recursive shape tests verified 100% key-and-type parity between mock mode and real mode across all video lifecycle endpoints (`POST /api/videos`, `GET /api/videos/:id`, `PUT /api/videos/:id/captions/:lang`, `POST /api/videos/:id/approve/:lang`, `POST /api/videos/:id/publish`, and `GET /api/public/videos/:id`).
- **Real 3G Offline Pack**: Full semantic, zero-dependency `lesson.html` (with Ethiopic font fallback and accessible audio player), `audio.mp3`, `transcript.txt`, and optional `lesson.brf` streamed via `GET /api/public/videos/:id/offlinepack`.
- **409 Conflict Guards**: Real publishing (`POST /api/videos/:id/publish`) enforced only from `review` status; `GET /api/public/videos/:id` guards unpublished lessons.
- **Production Startup Security**: Server enforces that `STUDIO_KEY` cannot remain the default `"change-me-to-a-long-random-string"` or empty when `NODE_ENV=production`.



