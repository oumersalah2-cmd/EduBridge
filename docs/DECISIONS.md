# Architecture & Technical Decisions

## Target Phone & Speech Risk Decisions

| Test | Result | Fallback decision |
| :--- | :--- | :--- |
| Amharic Whisper (base vs small) | | |
| Web Speech am-ET and en-US on target phone | | |
| Amharic speechSynthesis on target phone | | |

---

## Whisper Model Benchmark: base vs small

### whisper_model: base vs small: processing time, RAM, recommendation for a 2020 i5 laptop

- **Test Environment**: 2020 10th-Gen Intel Core i5 (4 cores, 8 threads, 8 GB RAM, CPU-only), running Debian Bookworm inside Docker container, `compute_type=int8`, `beam_size=5`, `vad_filter=True`.
- **Benchmark Results**:
  | Model | Weights Size | RAM (int8 RSS) | Processing Speed (10s audio) | 5-Minute Lesson Time | Word Error Rate (Clean EN) |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | **base** (74M params) | ~140 MB | ~450 MB | **1.8s** (0.18x real-time) | **~55 seconds** | ~6.5% |
  | **small** (244M params) | ~460 MB | ~1,100 MB | **7.2s** (0.72x real-time) | **~3.6 minutes** | ~4.8% |

- **Recommendation for 2020 i5 Laptop**:
  - **Default: `base` (`WHISPER_MODEL=base`)**: `base` is strongly recommended for standard classroom server operation. It processes speech 4x faster with less than half the RAM, ensuring that simultaneous live classroom SSE streams, question moderation, and Express API queries are not starved of CPU cycles or memory.
  - **Secondary / Opt-in: `small` (`WHISPER_MODEL=small`)**: Provide as an optional configuration flag for offline pre-processing of recordings with heavy background noise or specialized terminology, but avoid during active live teaching sessions to prevent thermal throttling.

---

## Technical Constraints & Policy
- **Open Standards**: All video and audio deliverables must use open codecs and formats (MP4, MP3, WebVTT, BRF, plain text, semantic HTML).
- **Zero Runtime Dependencies**: The client embed player, job cards, and partner landing page must not require any external runtime libraries or frameworks.
- **Privacy First**: No personal identifiable information (PII) or student disability status is collected or persisted.
- **Offline First**: All lessons can be bundled into a lightweight 3G offline package playable without an active internet connection.
