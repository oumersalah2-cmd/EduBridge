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

*Note: Replace `secret-studio-key` with the value from your `.env` `STUDIO_KEY`.*

### Health & Docs
```bash
# Health Check
curl -s http://localhost:4000/api/health

# OpenAPI Swagger UI
curl -s http://localhost:4000/api/docs/
```

### Video Studio & Processing Routes
```bash
# 1. Upload Video (Requires X-Studio-Key, multipart)
curl -s -X POST http://localhost:4000/api/videos \
  -H "X-Studio-Key: secret-studio-key" \
  -F "video=@sample.mp4"

# 2. Poll Processing Progress (For aria-live progress updates)
curl -s http://localhost:4000/api/videos/mock-video-demo-01

# 3. Save Human-Edited WebVTT (Resets review status to machine-generated)
curl -s -X PUT http://localhost:4000/api/videos/mock-video-demo-01/captions/en \
  -H "X-Studio-Key: secret-studio-key" \
  -H "Content-Type: text/vtt" \
  -d $'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nTeacher: Welcome to class.'

# 4. Approve Caption Track (Marks reviewStatus: human-reviewed)
curl -s -X POST http://localhost:4000/api/videos/mock-video-demo-01/approve/en \
  -H "X-Studio-Key: secret-studio-key"

# 5. Publish Lesson (Builds offline pack & returns embed snippets)
curl -s -X POST http://localhost:4000/api/videos/mock-video-demo-01/publish \
  -H "X-Studio-Key: secret-studio-key"
```

### Public Lesson & Offline Pack Routes
```bash
# 6. Get Public Lesson Metadata (Captions, transcript, audio link)
curl -s http://localhost:4000/api/public/videos/mock-video-demo-01

# 7. Download 3G Offline ZIP Bundle (audio.mp3, transcript.txt, lesson.html, lesson.brf)
curl -s -O http://localhost:4000/api/public/videos/mock-video-demo-01/offlinepack
```

### Live Classroom Companion Routes
```bash
# 8. Create Live Classroom Session (Generates 6-digit PIN)
curl -s -X POST http://localhost:4000/api/live/sessions \
  -H "X-Studio-Key: secret-studio-key"

# 9. Connect to Live SSE Stream (Public)
curl -N -s http://localhost:4000/api/live/sessions/620942/stream

# 10. Broadcast Teacher Speech Captions
curl -s -X POST http://localhost:4000/api/live/sessions/620942/captions \
  -H "X-Studio-Key: secret-studio-key" \
  -H "Content-Type: application/json" \
  -d '{"text": "Now let us examine the solar cell diagram.", "isFinal": true, "ts": 1700000000000}'

# 11. Broadcast Teacher Board Notes
curl -s -X POST http://localhost:4000/api/live/sessions/620942/board \
  -H "X-Studio-Key: secret-studio-key" \
  -H "Content-Type: application/json" \
  -d '{"text": "Key Concept: Photovoltaic effect converts photons into electrons."}'

# 12. Submit Student Question (Public, Rate-Limited, max 500 chars)
curl -s -X POST http://localhost:4000/api/live/sessions/620942/questions \
  -H "Content-Type: application/json" \
  -d '{"text": "What type of semiconductor material is used?"}'

# 13. Teacher Question Queue View
curl -s http://localhost:4000/api/live/sessions/620942/questions \
  -H "X-Studio-Key: secret-studio-key"

# 14. Dismiss Question (Spam control / answered)
curl -s -X DELETE http://localhost:4000/api/live/sessions/620942/questions/q-mock-1 \
  -H "X-Studio-Key: secret-studio-key"

# 15. End Live Session (Archives into permanent recorded lesson)
curl -s -X POST http://localhost:4000/api/live/sessions/620942/end \
  -H "X-Studio-Key: secret-studio-key"
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


