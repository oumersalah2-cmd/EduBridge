# WCAG 2.2 Level AA Conformance Report

**Module Name:** EduBridge Accessible Learning Media (`<db-player>`) & Career Gateway (`<db-jobcard>`)  
**Track:** Track 2 — Accessible Learning Media  
**Hackathon:** Digital Bridge Accessibility Hackathon 2026 (ALX Savanna)  
**Date:** 14 November 2026  
**Auditor / Lead:** Member 3 (Learner Player, Job Card & Accessibility Gate Lead)  
**Target Environments:** Android TalkBack (Chrome), Windows NVDA (Chrome/Edge), macOS VoiceOver (Safari), Keyboard-Only, 200% Zoom, Sound-Off.

---

## 1. Conformance Status
The EduBridge client modules (`<db-player>` and `<db-jobcard>`) **Support** the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA.

---

## 2. Evaluation Matrix by Criterion

| WCAG 2.2 AA Criterion | Status | Implementation Details & Proof |
| :--- | :--- | :--- |
| **1.1.1 Non-text Content** | Supports | All player controls, icons (`▶`, `⏸`, `↺`, `↻`, `🔊`, `CC`, `🤟`, `📜`, `📻`, `?`), and PIP header actions carry programmatic accessible names via `aria-label` or visible text. |
| **1.2.1 Audio-only / Video-only** | Supports | Interactive plain-text transcript panel and one-click `.txt` transcript download provided for every video and audio track. |
| **1.2.2 Captions (Prerecorded)** | Supports | Synchronized WebVTT parser with high-contrast customizable cues in English and Amharic Ethiopic typography (1.75 line-height). Carries visible "Human reviewed" status badge. |
| **1.2.3 Audio Description** | Supports | Integrated Audio-First read-aloud mode synthesizes spoken descriptions and transcript content. |
| **1.2.4 Captions (Live)** | Supports | In-Person Live Classroom Companion receives real-time speech captions via Server-Sent Events (SSE) and displays them in a dedicated live feed. |
| **1.3.1 Info and Relationships** | Supports | Built with semantic HTML5 elements (`<article>`, `<header>`, `<nav>`, `<dialog>`, `<button>`). Real `<label for="...">` associated with all inputs. |
| **1.3.2 Meaningful Sequence** | Supports | Logical DOM tab sequence matching visual layout; focus trapping inside `<dialog>` when open. |
| **1.3.3 Sensory Characteristics** | Supports | Instructions and state changes do not rely solely on shape or color; all statuses announced in words. |
| **1.4.1 Use of Color** | Supports | Verification badges, play states, and error alerts pair distinct color contrast with text and glyph icons. |
| **1.4.3 Contrast (Minimum)** | Supports | Default text contrast exceeds 7:1 (e.g. #ffffff on #0b0f19). Includes user-selectable Yellow-on-Black and Black-on-Yellow high-contrast themes. |
| **1.4.10 Reflow** | Supports | All player views and job cards reflow without horizontal scrolling at **200% zoom and 320px viewport width**. |
| **1.4.11 Non-text Contrast** | Supports | Focus indicators (3px solid #f5a300) and control borders exceed 3:1 contrast against adjacent backgrounds. |
| **1.4.12 Text Spacing** | Supports | Amharic text styled with elevated 1.75 line-height; no content clipping occurs when user overrides line or word spacing. |
| **2.1.1 Keyboard** | Supports | Full keyboard operability: Space/K (play/pause), Left/Right (seek 10s), M (mute), C (captions), S (sign window), T (transcript), F (fullscreen), ? (help modal). |
| **2.1.2 No Keyboard Trap** | Supports | Tab and Shift+Tab enter and exit smoothly. Escape closes dialogs and flyouts, returning focus to triggering elements. |
| **2.1.4 Character Key Shortcuts** | Supports | Single-key shortcuts are ignored when focus is within text inputs/areas to prevent accidental execution. |
| **2.4.3 Focus Order** | Supports | Tab order follows intuitive reading hierarchy from skip link to controls, drawer, and download options. |
| **2.4.7 Focus Visible** | Supports | High-contrast 3px orange focus ring (`outline: 3px solid #f5a300; outline-offset: 2px;`) visible across all interactive components. |
| **2.5.3 Label in Name** | Supports | Accessible names contain visual text strings across all buttons. |
| **2.5.7 Dragging Movements** | Supports | Ethiopian Sign Language PIP window supports **free mouse dragging/resizing** AND **100% accessible button alternatives** (`Top-Left`, `Top-Right`, `Bottom-Left`, `Bottom-Right`, `Larger`, `Smaller`). |
| **2.5.8 Target Size (Minimum)** | Supports | Primary controls meet or exceed 44×44px touch targets; secondary controls exceed 28×28px. |
| **3.1.2 Language of Parts** | Supports | Amharic content carries explicit `lang="am"` attribute so screen readers switch to Amharic speech synthesizers. |
| **3.2.1 On Focus** | Supports | Focusing controls never initiates auto-play or context switches. |
| **3.3.1 Error Identification** | Supports | PIN and question inputs provide descriptive, plain-language error and status announcements. |
| **4.1.2 Name, Role, Value** | Supports | Custom elements (`<db-player>`, `<db-jobcard>`) use shadow DOM, semantic ARIA attributes (`aria-pressed`, `aria-expanded`, `aria-checked`), and custom event dispatching (`db-player:progress`, `db-player:prefs`, `db-player:complete`). |
| **4.1.3 Status Messages** | Supports | Live region (`role="status" aria-live="polite"`) announces playback states, seeking, caption changes, and live classroom messages without stealing focus. |

---

## 3. Co-Designer & Device Testing Findings

1. **Android TalkBack on Low-Cost Mobile:**
   - *Observation:* Dragging PIP window with one finger failed with TalkBack enabled.
   - *Fix:* Added corner preset buttons (`↖`, `↗`, `↙`, `↘`) and size button (`⇲`) inside the PIP header.
2. **Screen Reader Reading Order:**
   - *Observation:* Live captions and board notes need to be heard without interrupting keyboard navigation.
   - *Fix:* Configured `role="log"` with `aria-live="polite"` and `aria-atomic="false"` for live stream updates.
3. **Slow 3G Connection Simulation:**
   - *Observation:* Large video decoding drains battery and buffers on 3G.
   - *Fix:* Added Audio-Only mode toggle (`📻`) and bundled 3G Offline Pack (.zip) showing size (1.8 MB).
