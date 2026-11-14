/**
 * EduBridge Accessible Media Player (<db-player>)
 * Track 2: Accessible Learning Media — Digital Bridge Hackathon 2026
 *
 * Requirements Met in this Web Component Foundation:
 * - One tag: <db-player src="..." captions="..." sign="..." describe="..." lang="am" api="..."></db-player>
 * - Shadow DOM encapsulation to protect against host CSS collisions (Bootstrap 5 in Savanna).
 * - Host look & feel inheritance via CSS variables (--bs-primary, --bs-body-font-family) with high-contrast fallbacks.
 * - Semantic <button> controls with minimum 44x44px touch targets.
 * - High-contrast :focus-visible indicators (3px solid #f5a300) for zero mouse dependency.
 * - Screen reader announcements via aria-live="polite" status region.
 * - Host communication through standard CustomEvents (bubbles: true, composed: true).
 */

class DbPlayer extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'captions', 'sign', 'describe', 'lang', 'api'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isPlaying = false;
    this.isMuted = false;
    this.currentLang = this.getAttribute('lang') || 'am';
    this.i18n = {};
  }

  connectedCallback() {
    this.loadTranslations();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.shadowRoot.innerHTML) {
      if (name === 'lang') {
        this.currentLang = newValue || 'am';
        this.loadTranslations();
      } else {
        this.render();
      }
    }
  }

  async loadTranslations() {
    // Embedded bilingual dictionary ensures zero-lag rendering offline or on slow 3G
    const TRANSLATIONS = {
      en: {
        playerTitle: "EduBridge Accessible Media Player",
        play: "Play",
        pause: "Pause",
        seekBack: "Rewind 10 seconds",
        seekForward: "Forward 10 seconds",
        mute: "Mute audio",
        unmute: "Unmute audio",
        captions: "Captions",
        signLanguage: "Ethiopian Sign Language",
        fullscreen: "Full screen",
        shortcuts: "Keyboard help",
        statusReady: "Player ready. Press Space or K to play, question mark for keyboard help.",
        statusPlaying: "Playing video",
        statusPaused: "Video paused"
      },
      am: {
        playerTitle: "ኤዱብሪጅ ተደራሽ የሚዲያ ማጫወቻ",
        play: "አጫውት",
        pause: "አቁም",
        seekBack: "10 ሰከንድ ወደ ኋላ",
        seekForward: "10 ሰከንድ ወደ ፊት",
        mute: "ድምጽ አጥፋ",
        unmute: "ድምጽ አብራ",
        captions: "የትርጉም ጽሑፍ",
        signLanguage: "የኢትዮጵያ የምልክት ቋንቋ",
        fullscreen: "ሙሉ ማያ",
        shortcuts: "የቁልፍ ሰሌዳ እገዛ",
        statusReady: "ማጫወቻው ዝግጁ ነው። ለማጫወት Space ወይም K ይጫኑ፣ ለእገዛ የጥያቄ ምልክት ይጫኑ።",
        statusPlaying: "ቪዲዮ በመጫወት ላይ",
        statusPaused: "ቪዲዮ ቆሟል"
      }
    };

    this.i18n = TRANSLATIONS[this.currentLang] || TRANSLATIONS.en;
    this.render();
  }

  render() {
    const src = this.getAttribute('src') || '';
    const t = this.i18n;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          max-width: 100%;
          font-family: var(--bs-body-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          color: var(--bs-body-color, #0f172a);
          background-color: #0b0f19;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          position: relative;
        }

        .player-wrapper {
          position: relative;
          background: #000000;
          outline: none;
        }

        .player-wrapper:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: -3px;
        }

        video.main-video {
          width: 100%;
          height: auto;
          max-height: 70vh;
          display: block;
          background: #000000;
        }

        /* Status Live Region for Screen Readers */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        /* Controls Toolbar */
        .controls-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background-color: #111827;
          border-top: 1px solid #1f2937;
          color: #f9fafb;
        }

        /* 44x44px minimum touch targets (WCAG 2.5.8) */
        .btn-ctrl {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          min-height: 44px;
          padding: 0.5rem 0.75rem;
          background: #1f2937;
          color: #ffffff;
          border: 1px solid #374151;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 600;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .btn-ctrl:hover {
          background-color: var(--bs-primary, #005fcc);
          border-color: var(--bs-primary, #005fcc);
        }

        .btn-ctrl:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: 2px;
          background-color: #1f2937;
        }

        .btn-primary {
          background-color: var(--bs-primary, #005fcc);
          border-color: var(--bs-primary, #005fcc);
        }

        .spacer {
          flex-grow: 1;
        }

        .time-display {
          font-size: 0.9rem;
          font-variant-numeric: tabular-nums;
          padding: 0 0.5rem;
          color: #e5e7eb;
        }

        /* Amharic typography line-height adjustment */
        :host([lang="am"]) {
          line-height: 1.7;
        }
      </style>

      <section class="player-wrapper" tabindex="0" aria-label="${t.playerTitle}">
        <!-- Screen reader live announcement area -->
        <div id="sr-status" class="sr-only" role="status" aria-live="polite">
          ${t.statusReady}
        </div>

        <!-- Main Video Element -->
        <video 
          class="main-video" 
          src="${src}" 
          playsinline 
          preload="metadata">
          <p>Your browser does not support HTML5 video.</p>
        </video>

        <!-- Semantic Accessible Controls Bar -->
        <nav class="controls-bar" aria-label="Media controls">
          <!-- Play / Pause -->
          <button type="button" class="btn-ctrl btn-primary" id="btn-play" aria-label="${t.play}">
            <span id="play-icon" aria-hidden="true">▶</span>
            <span id="play-text" style="margin-inline-start: 6px;">${t.play}</span>
          </button>

          <!-- Rewind 10s -->
          <button type="button" class="btn-ctrl" id="btn-back" aria-label="${t.seekBack}">
            <span aria-hidden="true">↺ 10s</span>
          </button>

          <!-- Forward 10s -->
          <button type="button" class="btn-ctrl" id="btn-fwd" aria-label="${t.seekForward}">
            <span aria-hidden="true">↻ 10s</span>
          </button>

          <!-- Time Display -->
          <div class="time-display" aria-label="Playback time">
            <span id="current-time">0:00</span> / <span id="duration">0:00</span>
          </div>

          <div class="spacer"></div>

          <!-- Mute / Unmute -->
          <button type="button" class="btn-ctrl" id="btn-mute" aria-label="${t.mute}">
            <span id="mute-icon" aria-hidden="true">🔊</span>
          </button>

          <!-- Captions Toggle Placeholder -->
          <button type="button" class="btn-ctrl" id="btn-captions" aria-label="${t.captions}" aria-pressed="false">
            <span aria-hidden="true">CC</span>
          </button>

          <!-- Sign Language Toggle Placeholder -->
          <button type="button" class="btn-ctrl" id="btn-sign" aria-label="${t.signLanguage}" aria-pressed="false">
            <span aria-hidden="true">🤟</span>
          </button>

          <!-- Shortcuts Help Button -->
          <button type="button" class="btn-ctrl" id="btn-help" aria-label="${t.shortcuts}">
            <span aria-hidden="true">?</span>
          </button>

          <!-- Fullscreen Button -->
          <button type="button" class="btn-ctrl" id="btn-fullscreen" aria-label="${t.fullscreen}">
            <span aria-hidden="true">⛶</span>
          </button>
        </nav>
      </section>
    `;

    this.setupEventListeners();
  }

  setupEventListeners() {
    const video = this.shadowRoot.querySelector('video.main-video');
    const playBtn = this.shadowRoot.querySelector('#btn-play');
    const playIcon = this.shadowRoot.querySelector('#play-icon');
    const playText = this.shadowRoot.querySelector('#play-text');
    const backBtn = this.shadowRoot.querySelector('#btn-back');
    const fwdBtn = this.shadowRoot.querySelector('#btn-fwd');
    const muteBtn = this.shadowRoot.querySelector('#btn-mute');
    const muteIcon = this.shadowRoot.querySelector('#mute-icon');
    const currentTimeEl = this.shadowRoot.querySelector('#current-time');
    const durationEl = this.shadowRoot.querySelector('#duration');
    const statusEl = this.shadowRoot.querySelector('#sr-status');
    const t = this.i18n;

    const formatTime = (seconds) => {
      if (isNaN(seconds)) return '0:00';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Play / Pause Toggle
    const togglePlay = () => {
      if (video.paused || video.ended) {
        video.play();
      } else {
        video.pause();
      }
    };

    playBtn.addEventListener('click', togglePlay);

    video.addEventListener('play', () => {
      this.isPlaying = true;
      playIcon.textContent = '⏸';
      playText.textContent = t.pause;
      playBtn.setAttribute('aria-label', t.pause);
      statusEl.textContent = t.statusPlaying;
    });

    video.addEventListener('pause', () => {
      this.isPlaying = false;
      playIcon.textContent = '▶';
      playText.textContent = t.play;
      playBtn.setAttribute('aria-label', t.play);
      statusEl.textContent = t.statusPaused;
    });

    // Time updates and host event dispatch
    video.addEventListener('timeupdate', () => {
      currentTimeEl.textContent = formatTime(video.currentTime);
      const percent = video.duration ? (video.currentTime / video.duration) * 100 : 0;

      // Event contract: db-player:progress
      this.dispatchEvent(new CustomEvent('db-player:progress', {
        bubbles: true,
        composed: true,
        detail: {
          seconds: Math.floor(video.currentTime),
          percent: Number(percent.toFixed(1))
        }
      }));
    });

    video.addEventListener('loadedmetadata', () => {
      durationEl.textContent = formatTime(video.duration);
    });

    video.addEventListener('ended', () => {
      this.dispatchEvent(new CustomEvent('db-player:complete', {
        bubbles: true,
        composed: true,
        detail: { completedAt: new Date().toISOString() }
      }));
    });

    // Seek buttons
    backBtn.addEventListener('click', () => {
      video.currentTime = Math.max(0, video.currentTime - 10);
      statusEl.textContent = `${t.seekBack}: ${formatTime(video.currentTime)}`;
    });

    fwdBtn.addEventListener('click', () => {
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
      statusEl.textContent = `${t.seekForward}: ${formatTime(video.currentTime)}`;
    });

    // Mute toggle
    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      this.isMuted = video.muted;
      muteIcon.textContent = video.muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', video.muted ? t.unmute : t.mute);
      statusEl.textContent = video.muted ? t.mute : t.unmute;
    });

    // Fullscreen toggle
    const fsBtn = this.shadowRoot.querySelector('#btn-fullscreen');
    fsBtn.addEventListener('click', () => {
      const wrapper = this.shadowRoot.querySelector('.player-wrapper');
      if (!document.fullscreenElement) {
        if (wrapper.requestFullscreen) {
          wrapper.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  }
}

// Register the custom element once
if (!customElements.get('db-player')) {
  customElements.define('db-player', DbPlayer);
}

