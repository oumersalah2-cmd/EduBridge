# Architecture & Technical Decisions

## Target Phone & Speech Risk Decisions

| Test | Result | Fallback decision |
| :--- | :--- | :--- |
| Amharic Whisper (base vs small) | not measured (real clip pending) | `AMHARIC_MODE=off` by default: human-first review; no auto Amharic track until submitted by human or enabled with `direct` draft |
| Web Speech am-ET and en-US on target phone | not measured | Native WebVTT rendering with zero runtime external JS; fallback to teacher-reviewed text transcript |
| Amharic speechSynthesis on target phone | not measured | 64 kbps mono teacher audio stream (pre-recorded or live captured) |

---

## Whisper Model Benchmark: base vs small

### whisper_model: base vs small: processing time, RAM, and recommendation

- **Host Machine Hardware (Measured)**:
  - **CPU**: Intel(R) Core(TM) 7 150U (10 cores [2 Performance, 8 Efficient], 12 threads), max 5.4 GHz, x86_64
  - **RAM**: 14 GiB total (14,037 MiB), 4.0 GiB swap
- **Benchmark Status**:
  | Model | Model Weights Download Size | RAM (int8 RSS) | Processing Time (Clip) | Word Error Rate (EN) | Word Error Rate (AM) | Status |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **base** (74M params) | ~140 MB | not measured | not measured | not measured | not measured | Pending Docker / faster-whisper environment |
  | **small** (244M params) | ~460 MB | not measured | not measured | not measured | not measured | Pending Docker / faster-whisper environment |

- **Observations & Architecture Decision**:
  - `faster-whisper` and `ffmpeg` are packaged inside the `api` Docker container (`api/Dockerfile`).
  - Strict Honesty Rule: No synthetic or estimated benchmark numbers are accepted. All values not directly executed on real speech audio are recorded as `not measured`.
  - WER evaluation script `api/scripts/measure-wer.py` is available for measuring Word Error Rate against ground-truth human references for English and Amharic.

---

## Amharic Architecture Decision: Human-First (No Translation Models)
- **Decision**: EduBridge eliminates machine-translation models (e.g. NLLB, M2M100) from the core transcription pipeline.
- **Modes Supported**:
  - `AMHARIC_MODE=off` (Default): No Amharic caption track is generated automatically. Amharic captions must be created or reviewed by a human speaker via `POST /api/v1/lessons/:id/captions`.
  - `AMHARIC_MODE=direct`: Direct acoustic Whisper ASR using language code `am` as a rough initial draft, tagged strictly with `reviewStatus: "machine-generated"`.
- **Approval Workflow**:
  - Submitting/editing WebVTT via `POST /api/v1/lessons/:id/captions` or `PUT /api/videos/:id/captions/:lang` always resets `reviewStatus` to `machine-generated` (`approved: false`).
  - Only explicit human teacher action via `POST /api/videos/:id/approve/:lang` marks the track `human-reviewed` (`approved: true`).

---

## Technical Constraints & Policy
- **Open Standards**: All video and audio deliverables must use open codecs and formats (MP4, MP3, WebVTT, BRF, plain text, semantic HTML).
- **Zero Runtime Dependencies**: The client embed player, job cards, and partner landing page must not require any external runtime libraries or frameworks.
- **Privacy First**: No personal identifiable information (PII) or student disability status is collected or persisted.
- **Offline First**: All lessons can be bundled into a lightweight 3G offline package playable without an active internet connection.
