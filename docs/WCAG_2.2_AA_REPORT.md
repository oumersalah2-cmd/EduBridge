# WCAG 2.2 AA Accessibility Compliance Report

## Scope
This report covers all learner and educator touchpoints across the EduBridge platform:
- Teacher Studio (`/studio`)
- Accessible Player and Embeds (`/player`)
- Accessible Job Card (`/jobcard`)
- Partner Embed Showcase (`/partner`)
- Generated Offline Package HTML (`lesson.html`)

## Method
Evaluations are conducted against the W3C Web Content Accessibility Guidelines (WCAG) 2.2 Level AA using:
- Automated accessibility scanning with `@axe-core/cli` and `axe-core`.
- Keyboard-only navigation testing (focus order, skip links, visible focus indicators).
- Screen reader testing with NVDA, VoiceOver, and Orca.
- High contrast and zoom testing (up to 400% text resizing without horizontal loss).

## Results per Route

### `/studio` (Teacher Studio)
- Status: Baseline skeleton verified
- Skip Link: Implemented
- Semantic Landmarks: `<header>`, `<main>`, `<nav>`
- Contrast Ratio: Verified AA compliant

### `/player` (Embeddable Accessible Player)
- Status: Baseline skeleton verified
- Keyboard Operability: Full keyboard focusable controls
- ARIA States: `aria-live` region for real-time captions and announcements

### `/jobcard` (Accessible Job Cards)
- Status: Baseline skeleton verified
- Semantic Structure: Proper heading hierarchy, landmark structure, and Schema.org semantic annotations

### `/partner` (Partner Demonstration)
- Status: Baseline skeleton verified
- Integration Accessibility: Accessible iframe/script embedding sandbox

## Known Limits
- Initial offline voice synthesis availability depends on client operating system speech voices for Amharic (`am-ET`).
- Live speech recognition requires local browser SpeechRecognition API support when running in-browser live capture.
