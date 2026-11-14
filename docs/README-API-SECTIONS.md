# EduBridge API Reference & Technical Sections

This document provides in-depth technical documentation of the EduBridge Accessible API architecture, protocols, data contracts, and integration interfaces.

---

## 1. System Architecture Overview

EduBridge is built to deliver accessible learning media and live classroom collaboration under extreme bandwidth constraints (down to 2G/3G networks) and offline school environments in Ethiopia.

```
+-----------------------------------------------------------------------------------+
|                                  EduBridge Platform                               |
|                                                                                   |
|  +-----------------------+   +------------------------+   +--------------------+  |
|  |     Teacher Studio    |   |    Accessible Player   |   |  Job Opportunities |  |
|  |       (Member 2)      |   |       (Member 3)       |   |       Landing      |  |
|  +-----------+-----------+   +-----------+------------+   +---------+----------+  |
|              |                           |                          |             |
|              | (HTTP / REST)             | (HTTP / SSE / 3G ZIP)    |             |
|              v                           v                          v             |
|  +-----------------------------------------------------------------------------+  |
|  |                   NGINX Edge Gateway (:8080)                                |  |
|  |   - Serves /savanna/, /module/, /demo/                                      |  |
|  |   - Disables buffering for SSE (/api/live/sessions/:pin/stream)             |  |
|  |   - Proxies /api/*, /docs, /openapi.json, /uploads/ to API service          |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                     EduBridge Express API (:4000)                           |  |
|  |   - Single Contract: Root openapi.yaml                                      |  |
|  |   - Core Routers: /api/videos, /api/public/videos, /api/live, /api/jobs     |  |
|  |   - v1 Additive Layer: /api/v1/lessons, /api/v1/webhooks, /api/v1/certs     |  |
|  |   - In-Memory SSE Hub (<1.5s latency, Last-Event-ID replay)                 |  |
|  +---------------------+-------------------------------+-----------------------+  |
|                        |                               |                          |
|                        v                               v                          |
|         +-----------------------------+  +---------------------------+            |
|         |    MongoDB 7 Storage        |  |  Audio & ASR Pipeline     |            |
|         |  - Lessons, Jobs, Webhooks  |  |  - FFmpeg (16k WAV, 64k)  |            |
|         |  - Sessions (TTL index)     |  |  - faster-whisper (base)  |            |
|         +-----------------------------+  +---------------------------+            |
+-----------------------------------------------------------------------------------+
```

---

## 2. Single Authoritative Contract

The root file [`openapi.yaml`](file:///home/ab/EduBridge/openapi.yaml) is the single source of truth for the entire team.
- **Environment Variable:** `OPENAPI_PATH` controls specification loading; defaults to `./openapi.yaml`.
- **Mounted in Docker:** Mounted read-only (`./openapi.yaml:/app/openapi.yaml:ro`) into the API container.
- **Interactive Swagger UI:** Accessible at both `/docs` and `/api/docs`.
- **Raw JSON Specification:** Exported at `/openapi.json` and `/api/openapi.json`.

---

## 3. The `/api/v1` Service Layer

The `/api/v1` layer provides additive, backward-compatible enhancements without altering legacy `/api/*` shapes.

### 3.1. `GET /api/v1/lessons/:id`
- **Access:** Public (published lessons only; returns `409 Conflict` with code `LESSON_NOT_PUBLISHED` if unpublished).
- **Additive Fields:**
  - `tracks`: Explicit array of available accessibility streams:
    ```json
    "tracks": [
      {
        "kind": "captions",
        "lang": "en",
        "url": "http://localhost:4000/uploads/captions/vid123_en.vtt",
        "reviewStatus": "human-reviewed"
      },
      {
        "kind": "sign",
        "url": "http://localhost:4000/uploads/videos/vid123_sign.mp4"
      },
      {
        "kind": "audio",
        "url": "http://localhost:4000/uploads/audio/vid123_64k.mp3"
      },
      {
        "kind": "audio-description",
        "url": "http://localhost:4000/uploads/audio/vid123_ad.mp3"
      }
    ]
    ```
  - `offlinePackSizeBytes`: Exact file size of the generated 3G offline ZIP bundle in bytes.

### 3.2. `GET /api/v1/lessons/:id/transcript?lang=en|am`
- **Response Format:** `text/plain; charset=utf-8`.
- Returns raw transcript text suitable for Braille displays, text-to-speech engines, and zero-JS accessibility tools.

### 3.3. `POST /api/v1/lessons/:id/captions`
- **Security:** Requires `X-Studio-Key`.
- **Body:** `{ "lang": "en" | "am" | "om", "vtt": "WEBVTT..." }`.
- **Behavior:** Writes WebVTT to disk, updates database, and **resets** `reviewStatus` to `"machine-generated"` (`approved: false`).

### 3.4. `DELETE /api/v1/lessons/:id`
- **Security:** Requires `X-Studio-Key`.
- **Behavior:** Safely unlinks all uploaded/generated video, audio, captions, and ZIP files from server storage, removes MongoDB document, and returns `204 No Content`.

---

## 4. Live Classroom SSE Protocol & Archiving

### 4.1. Real-Time Streaming (`GET /api/live/sessions/:pin/stream`)
- **Protocol:** Server-Sent Events (`text/event-stream`).
- **Resilience:** Supports `Last-Event-ID` header and query param to automatically replay missed events upon 3G reconnection.
- **Heartbeat:** Emits `: heartbeat\n\n` comments every 15 seconds to keep cellular carrier connections alive.
- **Events Emitted:**
  - `connected`: Initial handshake with session PIN and timestamp.
  - `caption`: Speech caption `{ text, isFinal, ts }`.
  - `board`: Teacher board/slide note `{ id, text, ts }`.
  - `question-status`: `{ action: "new" | "dismissed", question }`.
  - `session-ended`: Final event `{ pin, videoId }` before closing connection.

### 4.2. Live Archive (`POST /api/live/sessions/:pin/end`)
When an educator ends a session:
1. Filters final captions (`isFinal: true`). Returns `400` with code `NO_FINAL_CAPTIONS` if no speech was captured.
2. Builds WebVTT with relative cue timestamps (`ts - sessionStartTime`), prevents overlaps, and enforces sensible durations (2-6s).
3. Produces a unified plain-text transcript.
4. Merges questions and board notes chronologically into `chatLog` (`{ id, type, text, ts }`).
5. Generates the 3G offline pack immediately.
6. Creates a permanent lesson with `status: "review"`, `videoUrl: null`, and `reviewStatus: "machine-generated"`.
7. Broadcasts `session-ended` to all SSE clients and gracefully terminates sockets.

---

## 5. Amharic Human-First Architecture

EduBridge implements a strict **Human-First** policy for Ethiopic languages:
- **No Translation Model Bloat:** Eliminated machine translation dependencies (NLLB/M2M100) to maintain low footprint and prevent inaccurate STEM translations.
- **Configurable Mode (`AMHARIC_MODE`):**
  - `off` (Default): The pipeline creates no Amharic caption track. Amharic captions must be authored or uploaded by a human educator.
  - `direct`: Runs Whisper with `--language am` as an acoustic draft, strictly labeled `reviewStatus: "machine-generated"`.
- **WER Benchmark Utility (`api/scripts/measure-wer.py`):**
  - Standalone evaluation script using `jiwer` (or built-in dynamic programming Levenshtein algorithm).
  - Evaluates Word Error Rate against human reference transcriptions.

---

## 6. Audio Description

- **Upload Support:** `POST /api/videos` accepts an optional `audioDescription` file (`.mp3`).
- **Storage:** Persisted in `uploads/audio/` and served with `Content-Type: audio/mpeg`.
- **Exposure:** Exposed as `audioDescriptionUrl` in video representations and added to `tracks` (`kind: "audio-description"`).

---

## 7. Outbound Webhooks

Allows external school systems, LMS portals, and ministry dashboards to subscribe to platform lifecycle events.
- **Endpoints:**
  - `POST /api/v1/webhooks`: Register webhook URL and event filters (`["lesson.published", "captions.approved"]`).
  - `GET /api/v1/webhooks`: List active webhooks.
  - `DELETE /api/v1/webhooks/:id`: Remove webhook.
- **Security & Reliability:**
  - **SSRF Protection:** Rejects private IP ranges (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.0.0/16`) unless `WEBHOOK_ALLOW_PRIVATE=true`.
  - **HMAC Signatures:** When `WEBHOOK_SECRET` is configured, outgoing payloads carry `X-EduBridge-Signature: sha256=<hex_digest>`.
  - **Non-Blocking Delivery:** Dispatched asynchronously with 5-second timeout and 1 automatic retry.

---

## 8. Cryptographically Signed Learner Certificates

EduBridge generates tamper-evident Open Badges-compliant credentials verified via standard public-key cryptography (Ed25519).
- **Issue Credential:** `POST /api/v1/certificates` (`X-Studio-Key`). Returns signed JSON assertion with Base64 signature and verification link.
- **Verify Credential:** `GET /api/v1/certificates/:id/verify`. Public endpoint that validates signature against the issuer public key and returns `{ "valid": true, "credential": {...} }`.
- **Job Card Integration:** Ethiopian job postings link directly to verification URLs.

---

## 9. Stable Machine-Readable Error Codes

Every error response adheres to the contract:
```json
{
  "error": "Human-readable explanation for accessible screen readers.",
  "code": "STABLE_ERROR_CODE"
}
```

| Error Code | HTTP Status | Meaning |
| :--- | :---: | :--- |
| `KEY_REQUIRED` | 401 | Missing `X-Studio-Key` header |
| `KEY_INVALID` | 401 | Incorrect `X-Studio-Key` secret |
| `LESSON_NOT_FOUND` | 404 | Lesson ID does not exist |
| `LESSON_NOT_PUBLISHED` | 409 | Lesson accessed publicly before publication |
| `LESSON_CANNOT_PUBLISH` | 409 | Publish attempted on lesson not in `review` |
| `SESSION_NOT_FOUND` | 404 | Live session PIN does not exist or has ended |
| `NO_FINAL_CAPTIONS` | 400 | Live archive attempted without any final speech |
| `FILE_MISSING` | 400 | Required file parameter missing in multipart upload |
| `FILE_TYPE_NOT_ALLOWED`| 400 | File extension or MIME type not supported |
| `FILE_TOO_LARGE` | 413 | Upload exceeds `MAX_UPLOAD_MB` |
| `INVALID_VTT` | 400 | WebVTT does not start with `WEBVTT` header |
| `INVALID_LANGUAGE` | 400 | Requested or submitted language not supported |
| `RATE_LIMIT_EXCEEDED` | 429 | IP has exceeded request rate limit |
| `NOT_FOUND` | 404 | Route or endpoint not recognized |

