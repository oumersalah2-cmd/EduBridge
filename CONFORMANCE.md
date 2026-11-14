# WCAG 2.2 AA Conformance Report

**Module Name:** EduBridge Accessible Learning Media (`<db-player>`) & Career Gateway (`<db-jobcard>`)  
**Track:** Track 2 — Accessible Learning Media  
**Date:** 14 November 2026  
**Target Evaluation Environment:** Android (TalkBack, Chrome), Windows (NVDA), macOS (VoiceOver), Keyboard-only, 200% browser zoom, sound-off.

---

## Evaluation Results

| WCAG 2.2 AA Criterion | Supports / Partly / Does not | Notes |
| :--- | :--- | :--- |
| **1.1.1 Non-text Content** | Supports | All player controls, icons, and status indicators have programmatic accessible names (`aria-label` or visible text labels). Job card company logos have alternative text. |
| **1.2.1 Audio-only and Video-only (Prerecorded)** | Supports | Synchronized text transcripts are provided for all video and audio lessons with one-click download. |
| **1.2.2 Captions (Prerecorded)** | Supports | Synchronized WebVTT captions provided in both English (`en`) and Amharic Ethiopic script (`am`). Includes verification badge indicating whether captions are Human-reviewed or Machine-generated. |
| **1.2.3 Audio Description or Media Alternative** | Supports | Audio-First read-aloud mode provides speech synthesis of lesson content; plain-text transcript acts as complete media alternative. |
| **1.2.4 Captions (Live)** | Supports | Live Classroom Companion Mode streams real-time speech-to-text captions via Server-Sent Events (SSE) directly to students' devices. |
| **1.2.5 Audio Description (Prerecorded)** | Supports | Integrated audio narration track support via `<db-player describe="...">` attribute. |
| **1.3.1 Info and Relationships** | Supports | Semantic HTML5 structure throughout (`<main>`, `<header>`, `<nav>`, `<dialog>`, `<button>`). Real `<label>` elements associated with form controls. |
| **1.3.2 Meaningful Sequence** | Supports | DOM reading order matches visual presentation. Dialog modal manages focus trapping properly. |
| **1.3.3 Sensory Characteristics** | Supports | Instructions and statuses do not rely solely on shape, color, or sound. Error and status messages are explicitly worded. |
| **1.3.4 Orientation** | Supports | Unrestricted orientation support for portrait and landscape modes on mobile devices. |
| **1.4.1 Use of Color** | Supports | Verification badges and error states use both color and distinctive text/icons (e.g. checkmark + "Human reviewed"). |
| **1.4.3 Contrast (Minimum)** | Supports | Text elements exceed 4.5:1 contrast against backgrounds. User-selectable high-contrast caption modes (Yellow on Black, White on Black). |
| **1.4.10 Reflow** | Supports | Layout reflows cleanly without horizontal scrolling at 200% browser zoom and 320px viewport width. |
| **1.4.11 Non-text Contrast** | Supports | Interactive controls and focus indicators maintain at least 3:1 contrast against adjacent colors. |
| **1.4.12 Text Spacing** | Supports | Amharic Ethiopic typography styled with elevated 1.7 line-height for optimal legibility. No text clipping when line height or letter spacing is overridden. |
| **2.1.1 Keyboard** | Supports | All player actions accessible via keyboard: Space/K (play/pause), Left/Right (seek), M (mute), C (captions), S (sign language window), F (fullscreen), ? (shortcut dialog). |
| **2.1.2 No Keyboard Trap** | Supports | Focus can navigate into and out of all player components and dialogs using standard Tab / Shift+Tab and Escape keys. |
| **2.1.4 Character Key Shortcuts** | Supports | Single-character shortcuts are active only when the player component has focus and can be reviewed via the accessible help dialog. |
| **2.4.3 Focus Order** | Supports | Tab sequence is logical and sequential. Opening modal dialog moves focus inside; closing returns focus to triggering element. |
| **2.4.7 Focus Visible** | Supports | Unobscured, high-contrast `:focus-visible` indicator (3px solid #f5a300 or #005fcc) on all interactive elements. |
| **2.5.3 Label in Name** | Supports | Accessible names for buttons and controls match or contain their visual text labels. |
| **2.5.7 Dragging Movements** | Supports | Ethiopian Sign Language PIP window can be repositioned and resized via button presets (`Top-Left`, `Top-Right`, `Bottom-Left`, `Bottom-Right`, `Larger`, `Smaller`), ensuring users with motor impairments do not rely on mouse dragging. |
| **2.5.8 Target Size (Minimum)** | Supports | All touch and click targets meet or exceed 24×24px, with primary player controls designed to 44×44px touch targets. |
| **3.1.2 Language of Parts** | Supports | Elements with Amharic Ethiopic content carry explicit `lang="am"` attributes to allow screen readers to invoke Amharic speech synthesizers. |
| **3.2.1 On Focus** | Supports | Focusing on controls does not initiate unexpected context changes or auto-play media. |
| **3.3.1 Error Identification** | Supports | Form and input errors are stated in clear words and associated via `aria-describedby` and `role="alert"`. |
| **4.1.2 Name, Role, Value** | Supports | Web component uses standard custom elements and shadow DOM with native elements, ARIA states (`aria-pressed`, `aria-expanded`, `aria-live="polite"`), and event dispatching. |
| **4.1.3 Status Messages** | Supports | Live caption updates, save confirmations, and connection state changes announced via `aria-live` regions without stealing user focus. |

---

## Device & Screen Reader Test Log

- **Tester & Co-Designer:** Tested with blind and low-vision co-designers.
- **Devices Used:**
  - Low-cost Android Smartphone running Chrome with **Android TalkBack**.
  - Windows 11 PC running Chrome with **NVDA**.
  - MacBook running Safari with **VoiceOver**.
- **Key Test Findings & Resolutions:**
  - *Finding:* Dragging the PIP window was impossible with TalkBack. *Resolution:* Added 4-corner position preset buttons and size increment buttons.
  - *Finding:* Built-in browser `<video>` caption rendering did not permit custom font sizes or contrast adjustments. *Resolution:* Implemented custom VTT cue renderer inside shadow DOM with 100%–200% font scaling.

