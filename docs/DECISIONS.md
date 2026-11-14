# Architecture & Technical Decisions

## Target Phone & Speech Risk Decisions

| Test | Result | Fallback decision |
| :--- | :--- | :--- |
| Amharic Whisper (base vs small) | | |
| Web Speech am-ET and en-US on target phone | | |
| Amharic speechSynthesis on target phone | | |

---

## Technical Constraints & Policy
- **Open Standards**: All video and audio deliverables must use open codecs and formats (MP4, MP3, WebVTT, BRF, plain text, semantic HTML).
- **Zero Runtime Dependencies**: The client embed player, job cards, and partner landing page must not require any external runtime libraries or frameworks.
- **Privacy First**: No personal identifiable information (PII) or student disability status is collected or persisted.
- **Offline First**: All lessons can be bundled into a lightweight 3G offline package playable without an active internet connection.
