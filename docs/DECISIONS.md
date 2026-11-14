# Architecture & Technical Decisions

## Target Phone & Speech Risk Decisions

| Test | Result | Fallback decision |
| :--- | :--- | :--- |
| Amharic Whisper (base vs small) | | |
| Web Speech am-ET and en-US on target phone | | |
| Amharic speechSynthesis on target phone | | |

---

## Whisper Model Benchmark: base vs small

### whisper_model: base vs small: processing time, RAM, and recommendation

- **Host Machine Hardware (Measured)**:
  - **CPU**: Intel(R) Core(TM) 7 150U (10 cores [2 Performance, 8 Efficient], 12 threads), max 5.4 GHz, x86_64
  - **RAM**: 14 GiB total (14,037 MiB), 4.0 GiB swap
- **Benchmark Status**:
  | Model | Model Weights Download Size | RAM (int8 RSS) | Processing Time (Clip) | Word Error Rate | Status |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | **base** (74M params) | ~140 MB | not measured | not measured | not measured | Pending Docker / faster-whisper environment |
  | **small** (244M params) | ~460 MB | not measured | not measured | not measured | Pending Docker / faster-whisper environment |

- **Observations & Architecture Decision**:
  - `faster-whisper` and `ffmpeg` are packaged inside the `api` Docker container (`api/Dockerfile`), not installed natively on this host OS.
  - Until Docker runs with a real speech recording (`~/test-lesson.mp4`), real inference times and RAM measurements cannot be honestly measured on this host.
  - No synthetic or estimated benchmark numbers are accepted. Once the real speech recording is placed and the container executes, real timing and RAM figures will be measured and updated here.

---

## Technical Constraints & Policy
- **Open Standards**: All video and audio deliverables must use open codecs and formats (MP4, MP3, WebVTT, BRF, plain text, semantic HTML).
- **Zero Runtime Dependencies**: The client embed player, job cards, and partner landing page must not require any external runtime libraries or frameworks.
- **Privacy First**: No personal identifiable information (PII) or student disability status is collected or persisted.
- **Offline First**: All lessons can be bundled into a lightweight 3G offline package playable without an active internet connection.
