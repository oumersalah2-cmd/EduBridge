/**
 * EduBridge Accessible Media Player (<db-player>)
 * Track 2: Accessible Learning Media — Digital Bridge Hackathon 2026
 *
 * Requirements Met in this Version (Steps 1, 2, 3, 4 & 5):
 * - One tag: <db-player src="..." captions="..." sign="..." describe="..." lang="am" api="..."></db-player>
 * - Custom WebVTT parser & high-contrast cue renderer (never relies on un-stylable native browser captions).
 * - Full bilingual support (English & Amharic Ethiopic typography with 1.7 line-height).
 * - Caption customization: font sizes (100%, 125%, 150%, 200%) and 3 high-contrast color themes.
 * - Human-reviewed vs Machine-generated verification badge.
 * - Full keyboard operation without traps (WCAG 2.1.1, 2.1.2, 2.1.4): Space/K, Left/Right arrows, M, C, S, F, ?.
 * - Native <dialog> element for Keyboard Help with focus retention (Escape closes, focus returns).
 * - Synchronized Ethiopian Sign Language (EthSL) Picture-in-Picture window with WCAG 2.5.7 button presets.
 * - Audio-First Mode (SpeechSynthesis read-aloud transcript player with play/pause/repeat/prev/next).
 * - Interactive clickable transcript cues (each line is a button seeking to that timestamp).
 * - One-click Plain-Text (.txt) download & 3G Offline Pack (.zip) link with displayed file size.
 * - Battery-saving low-bandwidth Audio-Only (3G) mode toggle.
 * - Semantic controls, 44x44px touch targets, 3px solid focus indicators, screen reader live region.
 * - Emits db-player:progress, db-player:complete, and db-player:prefs.
 */

class DbPlayer extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'captions', 'sign', 'describe', 'lang', 'api', 'lesson', 'lesson-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.isPlaying = false;
    this.isMuted = false;
    const rawLang = this.getAttribute('lang');
    this.currentLang = ['en', 'am', 'om', 'ti'].includes(rawLang) ? rawLang : 'en';
    this.i18n = {};

    // Captions state
    this.captionsVisible = true;
    this.captionLang = this.currentLang; // 'en', 'am', 'om', 'ti'
    this.captionSize = localStorage.getItem('edubridge_caption_size') || '125'; // 100, 125, 150, 200%
    this.captionTheme = localStorage.getItem('edubridge_caption_theme') || 'yellow-black'; // 'white-black', 'yellow-black', 'black-yellow'
    this.isAmharicReviewed = true; // Toggle for Human-reviewed vs Machine-generated badge
    this.captionTracks = {
      en: [],
      am: [],
      om: [],
      ti: []
    };

    // Ethiopian Sign Language (EthSL) state
    this.signVisible = false;
    this.signPosition = localStorage.getItem('edubridge_sign_position') || 'bottom-right';
    this.signSize = localStorage.getItem('edubridge_sign_size') || 'medium';

    // Audio-First & Offline state
    this.transcriptOpen = false;
    this.audioOnlyMode = false;
    this.isReadingAloud = false;
    this.speechRate = 1.0;
    this.activeCueIndex = -1;

    // Pre-seed fallback bilingual cues so player works instantly without network
    this.seedDefaultCaptions();
  }

  connectedCallback() {
    this.loadTranslations();
    this.loadLessonFromApi().finally(() => {
      this.loadExternalCaptions();
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'lang') {
        this.currentLang = ['en', 'am', 'om', 'ti'].includes(newValue) ? newValue : 'en';
        this.captionLang = this.currentLang;
        this.loadTranslations();
      } else if (name === 'captions') {
        this.loadExternalCaptions();
      } else if (name === 'lesson' || name === 'lesson-id') {
        this.loadLessonFromApi();
      } else if (this.shadowRoot && this.shadowRoot.innerHTML) {
        this.render();
      }
    }
  }

  async loadLessonFromApi() {
    const lessonId = this.getAttribute('lesson') || this.getAttribute('lesson-id');
    if (!lessonId) return;

    const apiBase = (this.getAttribute('api') || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
    try {
      const endpoint = apiBase.includes('/v1') 
        ? `${apiBase}/lessons/${lessonId}` 
        : `${apiBase}/public/videos/${lessonId}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (data.videoUrl) {
          this.setAttribute('src', data.videoUrl);
        }
        if (data.signVideoUrl) {
          this.setAttribute('sign', data.signVideoUrl);
        }
        if (data.audioDescriptionUrl) {
          this.setAttribute('describe', data.audioDescriptionUrl);
        }
        if (data.offlinePackUrl) {
          this.offlinePackUrl = data.offlinePackUrl;
        }
        if (data.captionUrls && data.captionUrls.length > 0) {
          this.setAttribute('captions', data.captionUrls.join(','));
        } else if (data.captions) {
          const urls = [
            data.captions.en?.url,
            data.captions.am?.url,
            data.captions.om?.url,
            data.captions.ti?.url
          ].filter(Boolean);
          if (urls.length > 0) {
            this.setAttribute('captions', urls.join(','));
          }
        }
        if (data.approved) {
          this.isAmharicReviewed = Boolean(data.approved.am);
        }
        this.render();
      }
    } catch (err) {
      // Keep pre-seeded captions if API is unreachable
    }
  }

  getOfflinePackUrl() {
    if (this.offlinePackUrl) return this.offlinePackUrl;
    const lessonId = this.getAttribute('lesson') || this.getAttribute('lesson-id');
    const api = (this.getAttribute('api') || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
    if (lessonId) {
      return `${api}/lessons/${lessonId}/offline-pack`;
    }
    return 'http://localhost:4000/api/public/videos/mock-video-demo-01/offlinepack';
  }

  seedDefaultCaptions() {
    this.captionTracks.en = [
      { start: 0.0, end: 4.0, text: "Welcome to EduBridge: One Lesson, Online and In-Person, Every Ability." },
      { start: 4.5, end: 9.0, text: "In this lesson, we explore accessible software engineering and inclusive design for Ethiopia." },
      { start: 9.5, end: 15.0, text: "Accessibility means ensuring every student, whether deaf, hard of hearing, blind, or low-vision, can learn without barriers." },
      { start: 15.5, end: 21.0, text: "We provide synchronized captions in English and Amharic, alongside Ethiopian Sign Language interpreters." },
      { start: 21.5, end: 27.0, text: "For students on 2G and 3G connections, tiny offline packages allow offline study anywhere in the country." },
      { start: 27.5, end: 32.0, text: "[music ends] Let us begin our journey towards truly inclusive education." }
    ];

    this.captionTracks.am = [
      { start: 0.0, end: 4.0, text: "እንኳን ወደ ኤዱብሪጅ በደህና መጡ፡ አንድ ትምህርት፣ በመስመር ላይ እና በአካል፣ ለሁሉም ችሎታ።" },
      { start: 4.5, end: 9.0, text: "በዚህ ትምህርት ውስጥ፣ ለኢትዮጵያ ተደራሽ የሆነ የሶፍትዌር ምህንድስና እና ሁሉን አቀፍ ዲዛይን እንመረምራለን።" },
      { start: 9.5, end: 15.0, text: "ተደራሽነት ማለት መስማት የተሳናቸው፣ ማየት የተሳናቸው ወይም ዝቅተኛ የማየት ችሎታ ያላቸው ተማሪዎች ያለ እንቅፋት መማር መቻላቸውን ማረጋገጥ ነው።" },
      { start: 15.5, end: 21.0, text: "የኢትዮጵያ የምልክት ቋንቋ ተርጓሚዎችን ጨምሮ በእንግሊዝኛ እና በአማርኛ የተመሳሰሉ የትርጉም ጽሑፎችን እናቀርባለን።" },
      { start: 21.5, end: 27.0, text: "በ 2G እና 3G ግንኙነቶች ላይ ላሉ ተማሪዎች፣ አነስተኛ ከመስመር ውጭ ጥቅሎች በአገሪቱ ውስጥ በየትኛውም ቦታ ከመስመር ውጭ እንዲያጠኑ ያስችላቸዋል።" },
      { start: 27.5, end: 32.0, text: "[ሙዚቃ ያበቃል] ወደ ተደራሽ እና ፍትሃዊ ትምህርት ጉዟችንን እንጀምር።" }
    ];

    this.captionTracks.om = [
      { start: 0.0, end: 4.0, text: "Baga gara EduBridge nagaan dhuftan: Barnoota Tokko, Toora-irra fi Qaamaan, Dandeettii Hundaaf." },
      { start: 4.5, end: 9.0, text: "Barnoota kana keessatti, injinarummaa sooftiweerii qaqqabamaa fi dizaayinii hunda-hammattoo Itoophiyaa ni qoranna." },
      { start: 9.5, end: 15.0, text: "Qaqqabamummaa jechuun barattoonni gurri duudaa, qaro-dhabeeyyii ykn argaan isaanii daangeffame gufuu tokko malee baruu danda'uu isaaniiti." },
      { start: 15.5, end: 21.0, text: "Barreeffama Ingiliffaa fi Afaan Oromootiin walsimsiifame, akkasumas turjumaanota Afaan Mallattoo Itoophiyaa waliin ni dhiheessina." },
      { start: 21.5, end: 27.0, text: "Barattoota qunnamtii 2G fi 3G qabaniif, paakeejonni toora-ala xiqqoon bakka kamittiyyuu akka barataniif gargaaru." },
      { start: 27.5, end: 32.0, text: "[muuziqqaan dhume] Gara barnoota hunda-hammattootti imala keenya haa eegallu." }
    ];

    this.captionTracks.ti = [
      { start: 0.0, end: 4.0, text: "እንቋዕ ናብ ኤዱብሪጅ ብደሓን መጻእኩም፡ ሓደ ትምህርቲ፣ ብኢንተርነትን ብኣካልን፣ ንኹሉ ዓቕሚ።" },
      { start: 4.5, end: 9.0, text: "ኣብዚ ትምህርቲ፣ ተበጻሒ ናይ ሶፍትዌር ምህንድስናን ኩሉ-ሓቆፍ ዲዛይንን ንኢትዮጵያ ንምርምር።" },
      { start: 9.5, end: 15.0, text: "ተበጻሕነት ማለት ጸማማት፣ ዓይነ-ስውራን ወይ ድሩት ናይ ምርኣይ ዓቕሚ ዘለዎም ተመሃሮ ብዘይ ዕንቅፋት ክምሃሩ ምኽኣሎም ምርግጋጽ እዩ።" },
      { start: 15.5, end: 21.0, text: "ብእንግሊዝኛን ብትግርኛን ዝተሰማምዑ ጽሑፋት፣ ምስ ናይ ኢትዮጵያ ቋንቋ ምልክት ኣስተርጎምቲ ነቕርብ።" },
      { start: 21.5, end: 27.0, text: "ናይ 2Gን 3Gን ርክብ ንዘለዎም ተመሃሮ፣ ንኣሽቱ ናይ ደገ-መስመር ፓኬጃት ኣብ ዝኾነ ቦታ ከጽንዑ የኽእሎም።" },
      { start: 27.5, end: 32.0, text: "[ሙዚቃ ይውዳእ] ናብ ኩሉ-ሓቆፍ ትምህርቲ ጉዕዞና ንጀምር።" }
    ];
  }

  parseWebVTT(text) {
    const cues = [];
    const lines = text.replace(/\r/g, '').split('\n');
    let i = 0;

    const parseTime = (timeStr) => {
      const parts = timeStr.trim().split(':');
      let h = 0, m = 0, s = 0;
      if (parts.length === 3) {
        h = parseFloat(parts[0]);
        m = parseFloat(parts[1]);
        s = parseFloat(parts[2]);
      } else if (parts.length === 2) {
        m = parseFloat(parts[0]);
        s = parseFloat(parts[1]);
      }
      return h * 3600 + m * 60 + s;
    };

    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.includes('-->')) {
        const [startStr, endStr] = line.split('-->');
        const start = parseTime(startStr);
        const end = parseTime(endStr.split(' ')[0]);
        i++;
        let cueText = '';
        while (i < lines.length && lines[i].trim() !== '') {
          cueText += (cueText ? '\n' : '') + lines[i].trim();
          i++;
        }
        if (cueText) {
          cues.push({ start, end, text: cueText });
        }
      }
      i++;
    }
    return cues;
  }

  async loadExternalCaptions() {
    const captionsAttr = this.getAttribute('captions');
    if (!captionsAttr) return;

    const urls = captionsAttr.split(',').map((u) => u.trim());
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          const cues = this.parseWebVTT(text);
          if (cues.length > 0) {
            if (url.includes('.am.') || url.includes('/am') || url.includes('lang=am')) {
              this.captionTracks.am = cues;
            } else if (url.includes('.om.') || url.includes('/om') || url.includes('lang=om')) {
              this.captionTracks.om = cues;
            } else if (url.includes('.ti.') || url.includes('/ti') || url.includes('lang=ti')) {
              this.captionTracks.ti = cues;
            } else {
              this.captionTracks.en = cues;
            }
          }
        }
      } catch (err) {
        // Fallback pre-seeded cues remain intact
      }
    }
  }

  async loadTranslations() {
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
        captionsMenu: "Caption Settings",
        captionsOn: "Captions visible",
        captionsOff: "Captions hidden",
        signLanguage: "Ethiopian Sign Language",
        signLanguageTitle: "Ethiopian Sign Language (EthSL)",
        signOpened: "Sign language window opened",
        signClosed: "Sign language window closed",
        signMoveTL: "Move Sign to Top-Left",
        signMoveTR: "Move Sign to Top-Right",
        signMoveBL: "Move Sign to Bottom-Left",
        signMoveBR: "Move Sign to Bottom-Right",
        signLarger: "Enlarge Sign Window",
        signSmaller: "Reduce Sign Window",
        audioFirstTitle: "Audio-First Mode (Read Aloud)",
        audioFirstBtn: "Read Aloud",
        audioFirstStop: "Stop Reading",
        audioFirstRepeat: "Repeat Sentence",
        audioFirstPrev: "Previous Sentence",
        audioFirstNext: "Next Sentence",
        transcriptTitle: "Interactive Transcript",
        transcriptOpen: "Open Transcript Panel",
        transcriptClose: "Close Transcript Panel",
        audioOnlyBtn: "Audio-Only Mode (3G)",
        audioOnlyActive: "Audio-Only Mode Active (Video Picture Hidden)",
        downloadText: "Download Plain Text Transcript (.txt)",
        downloadZip: "Download 3G Offline Pack (.zip)",
        offlineSize: "1.8 MB (Audio + Text + HTML)",
        fullscreen: "Full screen",
        shortcuts: "Keyboard help",
        statusReady: "Player ready. Space to play, T for transcript, ? for help.",
        statusPlaying: "Playing video",
        statusPaused: "Video paused",
        langEn: "English Captions",
        langAm: "Amharic Captions (አማርኛ)",
        sizeTitle: "Caption Size",
        themeTitle: "Contrast Theme",
        themeWhiteBlack: "White on Black",
        themeYellowBlack: "Yellow on Black",
        themeBlackYellow: "Black on Yellow",
        badgeReviewed: "Human Reviewed",
        badgeMachine: "Machine Generated",
        closeSettings: "Close Settings",
        shortcutsHeading: "Keyboard Shortcuts Guide",
        shortcutsIntro: "You can control all player features with keyboard shortcuts without using a mouse:",
        kSpace: "Play or pause the lesson",
        kArrows: "Rewind or forward 10 seconds",
        kM: "Mute or unmute audio",
        kC: "Toggle captions on or off",
        kS: "Toggle Ethiopian Sign Language PIP window",
        kT: "Toggle Interactive Transcript & Audio-First panel",
        kF: "Toggle full-screen viewing",
        kQuestion: "Open or close this keyboard shortcuts dialog",
        kEscape: "Close any dialog and return to player",
        closeDialog: "Close"
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
        captionsMenu: "የትርጉም ጽሑፍ ቅንብሮች",
        captionsOn: "የትርጉም ጽሑፍ በርቷል",
        captionsOff: "የትርጉም ጽሑፍ ጠፍቷል",
        signLanguage: "የኢትዮጵያ የምልክት ቋንቋ",
        signLanguageTitle: "የኢትዮጵያ የምልክት ቋንቋ (EthSL)",
        signOpened: "የምልክት ቋንቋ መስኮት ተከፍቷል",
        signClosed: "የምልክት ቋንቋ መስኮት ተዘግቷል",
        signMoveTL: "የምልክት መስኮት ወደ ላይ-ግራ ውሰድ",
        signMoveTR: "የምልክት መስኮት ወደ ላይ-ቀኝ ውሰድ",
        signMoveBL: "የምልክት መስኮት ወደ ታች-ግራ ውሰድ",
        signMoveBR: "የምልክት መስኮት ወደ ታች-ቀኝ ውሰድ",
        signLarger: "የምልክት መስኮት አተልቅ",
        signSmaller: "የምልክት መስኮት አሳንስ",
        audioFirstTitle: "የድምጽ-ቅድሚያ ሁነታ (በድምጽ አንብብ)",
        audioFirstBtn: "በድምጽ አንብብ",
        audioFirstStop: "ማንበብ አቁም",
        audioFirstRepeat: "አረፍተ ነገሩን ድገም",
        audioFirstPrev: "ያለፈው አረፍተ ነገር",
        audioFirstNext: "ቀጣዩ አረፍተ ነገር",
        transcriptTitle: "የተመሳሰለ የጽሑፍ ግልባጭ",
        transcriptOpen: "የጽሑፍ ግልባጭ ክፈት",
        transcriptClose: "የጽሑፍ ግልባጭ ዝጋ",
        audioOnlyBtn: "ድምጽ ብቻ ሁነታ (3G)",
        audioOnlyActive: "የድምጽ ብቻ ሁነታ በርቷል (የቪዲዮ ምስል ተደብቋል)",
        downloadText: "ግልጽ ጽሑፍ አውርድ (.txt)",
        downloadZip: "የ 3G ከመስመር ውጭ ጥቅል አውርድ (.zip)",
        offlineSize: "1.8 ሜጋባይት (ድምጽ + ጽሑፍ + ኤችቲኤምኤል)",
        fullscreen: "ሙሉ ማያ",
        shortcuts: "የቁልፍ ሰሌዳ እገዛ",
        statusReady: "ማጫወቻው ዝግጁ ነው። ለማጫወት Space፣ ለጽሑፍ T፣ ለእገዛ ? ይጫኑ።",
        statusPlaying: "ቪዲዮ በመጫወት ላይ",
        statusPaused: "ቪዲዮ ቆሟል",
        langEn: "እንግሊዝኛ የትርጉም ጽሑፍ",
        langAm: "አማርኛ የትርጉም ጽሑፍ",
        sizeTitle: "የትርጉም ጽሑፍ መጠን",
        themeTitle: "የንፅፅር ገጽታ",
        themeWhiteBlack: "ነጭ በጥቁር ላይ",
        themeYellowBlack: "ቢጫ በጥቁር ላይ",
        themeBlackYellow: "ጥቁር በቢጫ ላይ",
        badgeReviewed: "በሰው የተገመገመ",
        badgeMachine: "በማሽን የተፈጠረ",
        closeSettings: "ቅንብሮችን ዝጋ",
        shortcutsHeading: "የቁልፍ ሰሌዳ አቋራጮች መመሪያ",
        shortcutsIntro: "ያለ ማውዝ በቁልፍ ሰሌዳ ብቻ ማጫወቻውን ሙሉ በሙሉ መጠቀም ይችላሉ፦",
        kSpace: "ቪዲዮውን ለማጫወት ወይም ለማቆም",
        kArrows: "10 ሰከንድ ወደ ኋላ ወይም ወደ ፊት ለመሄድ",
        kM: "ድምጽ ለማጥፋት ወይም ለማብራት",
        kC: "የትርጉም ጽሑፍ ለማብራት ወይም ለማጥፋት",
        kS: "የምልክት ቋንቋ መስኮት ለማብራት ወይም ለማጥፋት",
        kT: "የተመሳሰለ የጽሑፍ ግልባጭ እና የድምጽ ማንበቢያ ለመክፈት",
        kF: "ቪዲዮውን በሙሉ ማያ ለማየት",
        kQuestion: "ይህን የቁልፍ ሰሌዳ አቋራጭ መስኮት ለመክፈት",
        kEscape: "መስኮቶችን ዘግቶ ወደ ማጫወቻው ለመመለስ",
        closeDialog: "ዝጋ"
      },
      om: {
        playerTitle: "Miidiyaa Taphachiisaa Qaqqabamaa EduBridge",
        play: "Tapha",
        pause: "Dhaabi",
        seekBack: "Sekondii 10 duubatti",
        seekForward: "Sekondii 10 fuulduratti",
        mute: "Sagalee cufi",
        unmute: "Sagalee bani",
        captions: "Barreeffama",
        captionsMenu: "Qindaa'ina Barreeffamaa",
        captionsOn: "Barreeffamni mul'ata",
        captionsOff: "Barreeffamni cufameera",
        signLanguage: "Afaan Mallattoo",
        signLanguageTitle: "Afaan Mallattoo Itoophiyaa (EthSL)",
        signOpened: "Foddaan afaan mallattoo baname",
        signClosed: "Foddaan afaan mallattoo cufame",
        signMoveTL: "Mallattoo gara Oli-Bitaatti",
        signMoveTR: "Mallattoo gara Oli-Mirgaatti",
        signMoveBL: "Mallattoo gara Gadi-Bitaatti",
        signMoveBR: "Mallattoo gara Gadi-Mirgaatti",
        signLarger: "Foddaa Mallattoo Guddisi",
        signSmaller: "Foddaa Mallattoo Xiqqeessi",
        audioFirstTitle: "Haala Sagalee-Dursi (Osoo hin dubbisin dhaggeeffadhu)",
        audioFirstBtn: "Dhaggeeffadhu",
        audioFirstStop: "Dhaabi",
        audioFirstRepeat: "Himicha irra-deebi'i",
        audioFirstPrev: "Hima duraa",
        audioFirstNext: "Hima itti-aanu",
        transcriptTitle: "Barreeffama Qulqulluu Walsimsiifame",
        transcriptOpen: "Foddaa Barreeffamaa Bani",
        transcriptClose: "Foddaa Barreeffamaa Cufi",
        audioOnlyBtn: "Haala Sagalee Qofa (3G)",
        audioOnlyActive: "Haalli Sagalee Qofa Hojjechaa Jira",
        downloadText: "Barreeffama qulqulluu buufadhu (.txt)",
        downloadZip: "Paakeejii Toora-ala 3G buufadhu (.zip)",
        downloadOffline: "Toora-alaaf buufadhu",
        offlineSize: "Guddina: 1.8 MB (Sagalee + Barreeffama + HTML)",
        fullscreen: "Iskiriinii Guutuu",
        shortcuts: "Gargaarsa Qabduu Kiiboordii",
        statusReady: "Taphachiisaan qophaa'eera.",
        statusPlaying: "Viidiyoon taphachaa jira",
        statusPaused: "Viidiyoon dhaabbateera",
        langEn: "Barreeffama Ingiliffaa",
        langAm: "Barreeffama Amaariffaa",
        langOm: "Barreeffama Afaan Oromoo",
        langTi: "Barreeffama Tigrinya",
        sizeTitle: "Guddina Barreeffamaa",
        themeTitle: "Bifa Dha'annoo Barreeffamaa",
        themeWhiteBlack: "Adii Gurracha irratti",
        themeYellowBlack: "Keelloo Gurracha irratti",
        themeBlackYellow: "Gurracha Keelloo irratti",
        badgeReviewed: "Namaan Mirkanaa'e",
        badgeMachine: "Maashiniin Uumame",
        closeSettings: "Qindaa'ina Cufi",
        shortcutsHeading: "Qajeelfama Gabaabduu Kiiboordii",
        shortcutsIntro: "Fayyadamtoonni maawusii malee kiiboordiidhaan fayyadamuu danda'u:",
        kSpace: "Taphachiisi ykn dhaabi",
        kArrows: "Sekondii 10 duubatti ykn fuulduratti",
        kM: "Sagalee cufi ykn bani",
        kC: "Barreeffama bani ykn cufi",
        kS: "Foddaa afaan mallattoo bani ykn cufi",
        kT: "Foddaa barreeffamaa bani ykn cufi",
        kF: "Iskiriinii guutuu",
        kQuestion: "Gargaarsa kiiboordii bani",
        kEscape: "Foddaalee cufi",
        closeDialog: "Cufi",
        listen: "Dhaggeeffadhu"
      },
      ti: {
        playerTitle: "ኤዱብሪጅ ተበጻሒ መወልዒ ሚድያ",
        play: "ጻወት",
        pause: "ኣቋርጽ",
        seekBack: "10 ካልኢት ንድሕሪት",
        seekForward: "10 ካልኢት ንቕድሚት",
        mute: "ድምጺ ኣጥፍእ",
        unmute: "ድምጺ ወልዕ",
        captions: "ጽሑፍ",
        captionsMenu: "ናይ ጽሑፍ ቅጥዕታት",
        captionsOn: "ጽሑፍ ተኸፊቱ",
        captionsOff: "ጽሑፍ ተዓጽዩ",
        signLanguage: "ቋንቋ ምልክት",
        signLanguageTitle: "ናይ ኢትዮጵያ ቋንቋ ምልክት (EthSL)",
        signOpened: "መስኮት ቋንቋ ምልክት ተኸፊቱ",
        signClosed: "መስኮት ቋንቋ ምልክት ተዓጽዩ",
        signMoveTL: "መስኮት ምልክት ናብ ላዕሊ-ጸጋም",
        signMoveTR: "መስኮት ምልክት ናብ ላዕሊ-የማን",
        signMoveBL: "መስኮት ምልክት ናብ ታሕቲ-ጸጋም",
        signMoveBR: "መስኮት ምልክት ናብ ታሕቲ-የማን",
        signLarger: "መስኮት ምልክት ኣዕቢ",
        signSmaller: "መስኮት ምልክት ኣንእስ",
        audioFirstTitle: "ድምጺ-ቀዳማይ ኩነት (ብድምጺ ኣንብብ)",
        audioFirstBtn: "ስማዕ",
        audioFirstStop: "ኣቋርጽ",
        audioFirstRepeat: "ሓሳብ ድገም",
        audioFirstPrev: "ዝሓለፈ ሓሳብ",
        audioFirstNext: "ዝቕጽል ሓሳብ",
        transcriptTitle: "ዝተመሳሰለ ጽሑፍ",
        transcriptOpen: "መስኮት ጽሑፍ ክፈት",
        transcriptClose: "መስኮት ጽሑፍ ዕጾ",
        audioOnlyBtn: "ድምጺ ጥራይ (3G)",
        audioOnlyActive: "ድምጺ ጥራይ ኩነት ይዓዪ ኣሎ",
        downloadText: "ጽሩይ ጽሑፍ ኣውርድ (.txt)",
        downloadZip: "ናይ 3G ደገ-መስመር ፓኬጅ ኣውርድ (.zip)",
        downloadOffline: "ብዘይ ኢንተርነት ንምጥቃም ኣውርድ",
        offlineSize: "ዓቐን: 1.8 ሜጋባይት (ድምጺ + ጽሑፍ + ኤችቲኤምኤል)",
        fullscreen: "ምሉእ ስክሪን",
        shortcuts: "ሓገዝ ቁልፍታት ሰሌዳ",
        statusReady: "መወልዒ ድሉው ኣሎ።",
        statusPlaying: "ቪድዮ ይጻወት ኣሎ",
        statusPaused: "ቪድዮ ደው ኢሉ ኣሎ",
        langEn: "ናይ እንግሊዝኛ ጽሑፍ",
        langAm: "ናይ ኣምሓርኛ ጽሑፍ",
        langOm: "ናይ ኦሮምኛ ጽሑፍ",
        langTi: "ናይ ትግርኛ ጽሑፍ",
        sizeTitle: "ዓቐን ጽሑፍ",
        themeTitle: "ናይ ጽሑፍ ሕብሪ",
        themeWhiteBlack: "ጻዕዳ ኣብ ጸሊም",
        themeYellowBlack: "ቢጫ ኣብ ጸሊም",
        themeBlackYellow: "ጸሊም ኣብ ቢጫ",
        badgeReviewed: "ብሰብ ዝተረጋገጸ",
        badgeMachine: "ብማሽን ዝተሰርሐ",
        closeSettings: "ቅጥዕታት ዕጾ",
        shortcutsHeading: "መምርሒ ቁልፍታት ሰሌዳ",
        shortcutsIntro: "ተጠቀምቲ ብዘይ ማውስ ብሰሌዳ ጥራይ ክጥቀሙ ይኽእሉ:",
        kSpace: "ጻወት ወይ ኣቋርጽ",
        kArrows: "10 ካልኢት ንድሕሪት ወይ ንቕድሚት",
        kM: "ድምጺ ኣጥፍእ ወይ ወልዕ",
        kC: "ጽሑፍ ወልዕ ወይ ኣጥፍእ",
        kS: "መስኮት ቋንቋ ምልክት ወልዕ ወይ ኣጥፍእ",
        kT: "መስኮት ጽሑፍ ክፈት ወይ ዕጾ",
        kF: "ምሉእ ስክሪን",
        kQuestion: "ሓገዝ ሰሌዳ ክፈት",
        kEscape: "መስኮታት ዕጾ",
        closeDialog: "ዕጾ",
        listen: "ስማዕ"
      }
    };

    try {
      const candidates = [`./i18n/${this.currentLang}.json`, `/player/i18n/${this.currentLang}.json`];
      for (const p of candidates) {
        try {
          const res = await fetch(p);
          if (res.ok) {
            const data = await res.json();
            this.i18n = Object.assign({}, TRANSLATIONS[this.currentLang] || TRANSLATIONS.en, data);
            this.render();
            return;
          }
        } catch (e) {}
      }
    } catch (e) {}

    this.i18n = TRANSLATIONS[this.currentLang] || TRANSLATIONS.en;
    this.render();
  }

  render() {
    const src = this.getAttribute('src') || '';
    const signSrc = this.getAttribute('sign') || './data/lesson.ethsl.mp4';
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
          min-height: 380px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .player-wrapper:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: -3px;
        }

        video.main-video {
          width: 100%;
          height: auto;
          min-height: 360px;
          aspect-ratio: 16 / 9;
          object-fit: contain;
          max-height: 70vh;
          display: block;
          background: #000000;
        }

        video.main-video.audio-only {
          display: none;
        }

        /* Audio-Only 3G Placeholder */
        .audio-only-banner {
          display: none;
          height: 240px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          background: linear-gradient(135deg, #0f172a, #1e293b);
          color: #93c5fd;
          text-align: center;
          padding: 1.5rem;
        }

        .audio-only-banner.active {
          display: flex;
        }

        .audio-wave-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
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

        /* -------------------------------------------------------------
           CUSTOM WEBVTT CAPTIONS CONTAINER
           ------------------------------------------------------------- */
        .caption-container {
          position: absolute;
          bottom: 70px;
          left: 5%;
          right: 5%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 10;
          text-align: center;
          transition: opacity 0.2s ease;
        }

        .caption-container.hidden {
          opacity: 0;
          visibility: hidden;
        }

        .caption-badge-wrapper {
          margin-bottom: 6px;
        }

        .badge-verified {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
          background-color: #064e3b;
          color: #a7f3d0;
          border: 1px solid #059669;
        }

        .badge-machine {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
          background-color: #78350f;
          color: #fef08a;
          border: 1px solid #d97706;
        }

        .caption-box {
          display: inline-block;
          max-width: 90%;
          padding: 0.4rem 0.9rem;
          border-radius: 6px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
          word-wrap: break-word;
          line-height: 1.5;
        }

        .caption-box[lang="am"],
        .caption-box[lang="ti"] {
          line-height: 1.75;
          font-family: var(--bs-body-font-family, system-ui, "Noto Sans Ethiopic", sans-serif);
        }

        .caption-box[lang="om"] {
          line-height: 1.5;
        }

        .size-100 { font-size: 1.1rem; }
        .size-125 { font-size: 1.35rem; }
        .size-150 { font-size: 1.65rem; }
        .size-200 { font-size: 2.1rem; }

        .theme-white-black {
          background-color: rgba(0, 0, 0, 0.9);
          color: #ffffff;
          border: 2px solid #000000;
        }

        .theme-yellow-black {
          background-color: rgba(0, 0, 0, 0.92);
          color: #ffeb3b;
          border: 2px solid #000000;
        }

        .theme-black-yellow {
          background-color: #ffeb3b;
          color: #000000;
          border: 2px solid #000000;
        }

        /* -------------------------------------------------------------
           ETHIOPIAN SIGN LANGUAGE (EthSL) PIP WINDOW (WCAG 2.5.7)
           ------------------------------------------------------------- */
        .sign-pip-container {
          position: absolute;
          z-index: 20;
          background: #111827;
          border: 2px solid #3b82f6;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
          transition: width 0.2s ease, top 0.2s ease, left 0.2s ease, right 0.2s ease, bottom 0.2s ease;
          display: flex;
          flex-direction: column;
        }

        .sign-pip-container.hidden {
          display: none;
        }

        .sign-size-small { width: 190px; }
        .sign-size-medium { width: 260px; }
        .sign-size-large { width: 340px; }

        .sign-pos-bottom-right { bottom: 74px; right: 16px; top: auto; left: auto; }
        .sign-pos-bottom-left { bottom: 74px; left: 16px; top: auto; right: auto; }
        .sign-pos-top-right { top: 16px; right: 16px; bottom: auto; left: auto; }
        .sign-pos-top-left { top: 16px; left: 16px; bottom: auto; right: auto; }

        .sign-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #1f2937;
          padding: 0.35rem 0.5rem;
          border-bottom: 1px solid #374151;
          cursor: grab;
          user-select: none;
          touch-action: none;
        }

        .sign-header:active {
          cursor: grabbing;
        }

        .sign-resize-handle {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 24px;
          height: 24px;
          background: rgba(17, 24, 39, 0.9);
          color: #93c5fd;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: nwse-resize;
          user-select: none;
          font-size: 14px;
          border-top-left-radius: 6px;
          border-left: 1px solid #3b82f6;
          border-top: 1px solid #3b82f6;
          z-index: 5;
          touch-action: none;
        }

        .sign-resize-handle:hover {
          background: #2563eb;
          color: #ffffff;
        }

        .sign-title {
          font-size: 0.75rem;
          font-weight: 700;
          color: #93c5fd;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sign-actions {
          display: flex;
          gap: 2px;
        }

        .btn-pip-ctrl {
          background: #374151;
          color: #ffffff;
          border: 1px solid #4b5563;
          border-radius: 3px;
          padding: 2px 5px;
          font-size: 0.75rem;
          cursor: pointer;
          min-height: 28px;
          min-width: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .btn-pip-ctrl:hover {
          background: #2563eb;
        }

        .btn-pip-ctrl:focus-visible {
          outline: 2px solid #f5a300;
          outline-offset: 1px;
        }

        video.sign-video {
          width: 100%;
          height: auto;
          display: block;
          background: #000000;
        }

        /* -------------------------------------------------------------
           INTERACTIVE TRANSCRIPT & AUDIO-FIRST DRAWER
           ------------------------------------------------------------- */
        .transcript-drawer {
          display: none;
          background: #0f172a;
          color: #f8fafc;
          border-top: 1px solid #334155;
          padding: 1rem;
        }

        .transcript-drawer.active {
          display: block;
        }

        .drawer-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #1e293b;
        }

        .drawer-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #f1f5f9;
        }

        .audio-first-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.4rem;
        }

        .btn-af-ctrl {
          padding: 0.4rem 0.75rem;
          min-height: 38px;
          background: #1e293b;
          color: #ffffff;
          border: 1px solid #475569;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.85rem;
        }

        .btn-af-ctrl:hover {
          background: var(--bs-primary, #005fcc);
        }

        .btn-af-ctrl:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: 2px;
        }

        .btn-af-primary {
          background: #059669;
          border-color: #10b981;
        }

        .transcript-scroll-area {
          max-height: 220px;
          overflow-y: auto;
          border: 1px solid #1e293b;
          border-radius: 6px;
          background: #0b0f19;
          padding: 0.5rem;
        }

        .cue-btn {
          display: flex;
          width: 100%;
          text-align: left;
          background: transparent;
          border: 0;
          color: #cbd5e1;
          padding: 0.5rem;
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.95rem;
          line-height: 1.6;
          transition: background-color 0.15s ease;
        }

        .cue-btn:hover {
          background: #1e293b;
          color: #ffffff;
        }

        .cue-btn:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: 1px;
          background: #1e293b;
        }

        .cue-btn.active-cue {
          background: #1e3a8a;
          color: #93c5fd;
          font-weight: 700;
          border-inline-start: 4px solid #3b82f6;
        }

        .cue-time {
          min-width: 50px;
          color: #94a3b8;
          font-family: monospace;
          font-size: 0.85rem;
        }

        .cue-text {
          flex: 1;
        }

        .download-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.75rem;
          padding-top: 0.5rem;
          border-top: 1px solid #1e293b;
        }

        .btn-download {
          padding: 0.5rem 1rem;
          min-height: 44px;
          background: #1e293b;
          color: #ffffff;
          border: 1px solid #475569;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
        }

        .btn-download:hover {
          background: var(--bs-primary, #005fcc);
          border-color: #93c5fd;
        }

        .btn-download:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: 2px;
        }

        .offline-badge {
          font-size: 0.8rem;
          color: #a7f3d0;
          margin-inline-start: 4px;
        }

        /* -------------------------------------------------------------
           CAPTION SETTINGS POPUP MODAL
           ------------------------------------------------------------- */
        .caption-settings-panel {
          position: absolute;
          bottom: 74px;
          right: 16px;
          width: 320px;
          max-width: calc(100% - 32px);
          background: #111827;
          border: 2px solid #374151;
          border-radius: 8px;
          padding: 1rem;
          z-index: 25;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          color: #ffffff;
        }

        .caption-settings-panel.hidden {
          display: none;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #374151;
        }

        .settings-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
        }

        .settings-group {
          margin-bottom: 0.85rem;
          border: 0;
          padding: 0;
          margin-inline-start: 0;
          margin-inline-end: 0;
        }

        .settings-group legend {
          font-size: 0.85rem;
          font-weight: 600;
          color: #9ca3af;
          margin-bottom: 0.4rem;
        }

        .btn-group {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }

        .btn-option {
          padding: 0.4rem 0.6rem;
          background: #1f2937;
          color: #ffffff;
          border: 1px solid #4b5563;
          border-radius: 4px;
          font-size: 0.85rem;
          cursor: pointer;
          min-height: 36px;
        }

        .btn-option[aria-checked="true"], .btn-option.active {
          background: var(--bs-primary, #005fcc);
          border-color: #93c5fd;
          font-weight: 700;
        }

        .btn-option:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: 2px;
        }

        /* -------------------------------------------------------------
           KEYBOARD SHORTCUTS ACCESSIBLE MODAL (<dialog>)
           ------------------------------------------------------------- */
        dialog.shortcuts-modal {
          border: 2px solid #374151;
          border-radius: 10px;
          background: #111827;
          color: #ffffff;
          padding: 1.5rem;
          max-width: 520px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
          z-index: 100;
        }

        dialog.shortcuts-modal::backdrop {
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(2px);
        }

        .dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #374151;
        }

        .dialog-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #f3f4f6;
        }

        .shortcuts-list {
          list-style: none;
          padding: 0;
          margin: 0 0 1.5rem 0;
        }

        .shortcuts-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0;
          border-bottom: 1px solid #1f2937;
          font-size: 0.95rem;
        }

        .kbd-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          font-size: 0.85rem;
          font-family: monospace;
          background-color: #1f2937;
          border: 1px solid #4b5563;
          border-radius: 4px;
          color: #93c5fd;
          font-weight: 700;
        }

        .btn-dialog-close {
          width: 100%;
          min-height: 44px;
          background: var(--bs-primary, #005fcc);
          color: #ffffff;
          border: 0;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-dialog-close:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: 3px;
        }

        /* -------------------------------------------------------------
           CONTROLS BAR
           ------------------------------------------------------------- */
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

        .btn-ctrl[aria-pressed="true"] {
          background-color: var(--bs-primary, #005fcc);
          border-color: #93c5fd;
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

        <!-- Audio-Only 3G Mode Banner -->
        <div class="audio-only-banner" id="audio-only-banner" aria-hidden="true">
          <div class="audio-wave-icon">📻</div>
          <p style="margin: 0; font-weight: 700; font-size: 1.1rem;">${t.audioOnlyActive}</p>
          <span style="font-size: 0.85rem; color: #cbd5e1; margin-top: 4px;">Low-Bandwidth 3G Safe (Zero Video Streaming)</span>
        </div>

        <!-- Dynamic High-Contrast Captions Display -->
        <div 
          id="caption-container" 
          class="caption-container size-${this.captionSize} theme-${this.captionTheme} ${this.captionsVisible ? '' : 'hidden'}"
          aria-live="polite"
          aria-atomic="true">
          
          <div class="caption-badge-wrapper">
            <span id="caption-badge" class="${this.isAmharicReviewed ? 'badge-verified' : 'badge-machine'}">
              ${this.isAmharicReviewed ? '✓ ' + t.badgeReviewed : '⚡ ' + t.badgeMachine}
            </span>
          </div>

          <div id="caption-box" class="caption-box theme-${this.captionTheme}" lang="${this.captionLang}">
            ${this.captionTracks[this.captionLang][0]?.text || ''}
          </div>
        </div>

        <!-- Ethiopian Sign Language Picture-in-Picture Window (WCAG 2.5.7) -->
        <div 
          id="sign-pip-container" 
          class="sign-pip-container sign-size-${this.signSize} sign-pos-${this.signPosition} ${this.signVisible ? '' : 'hidden'}"
          aria-label="${t.signLanguageTitle}"
          role="region">
          
          <div class="sign-header" id="sign-drag-header" title="Drag to move sign window">
            <span class="sign-title">⋮⋮ 🤟 EthSL</span>
            <div class="sign-actions" role="toolbar" aria-label="Sign window controls">
              <button type="button" class="btn-pip-ctrl" id="btn-pos-tl" aria-label="${t.signMoveTL}">↖</button>
              <button type="button" class="btn-pip-ctrl" id="btn-pos-tr" aria-label="${t.signMoveTR}">↗</button>
              <button type="button" class="btn-pip-ctrl" id="btn-pos-bl" aria-label="${t.signMoveBL}">↙</button>
              <button type="button" class="btn-pip-ctrl" id="btn-pos-br" aria-label="${t.signMoveBR}">↘</button>
              <button type="button" class="btn-pip-ctrl" id="btn-size-toggle" aria-label="${t.signLarger}">⇲</button>
              <button type="button" class="btn-pip-ctrl" id="btn-close-sign" aria-label="${t.signClosed}">✕</button>
            </div>
          </div>

          <video 
            class="sign-video" 
            src="${signSrc}" 
            playsinline 
            muted 
            preload="metadata">
          </video>

          <!-- Free Pointer Resize Handle -->
          <div class="sign-resize-handle" id="sign-resize-handle" title="Drag to resize window" aria-label="Resize sign language window">
            ⇲
          </div>
        </div>

        <!-- Caption Settings Flyout Panel -->
        <div 
          id="caption-settings-panel" 
          class="caption-settings-panel hidden" 
          role="region" 
          aria-labelledby="settings-heading">
          
          <div class="settings-header">
            <h3 id="settings-heading">${t.captionsMenu}</h3>
            <button type="button" class="btn-option" id="btn-close-settings" aria-label="${t.closeSettings}">✕</button>
          </div>

          <!-- Language Selector -->
          <fieldset class="settings-group">
            <legend>${t.captions}</legend>
            <div class="btn-group" role="radiogroup" aria-label="${t.captions}">
              <button type="button" class="btn-option ${this.captionLang === 'am' ? 'active' : ''}" id="btn-lang-am" role="radio" aria-checked="${this.captionLang === 'am'}">አማርኛ (AM)</button>
              <button type="button" class="btn-option ${this.captionLang === 'en' ? 'active' : ''}" id="btn-lang-en" role="radio" aria-checked="${this.captionLang === 'en'}">English (EN)</button>
              <button type="button" class="btn-option ${this.captionLang === 'om' ? 'active' : ''}" id="btn-lang-om" role="radio" aria-checked="${this.captionLang === 'om'}">Oromoo (OM)</button>
              <button type="button" class="btn-option ${this.captionLang === 'ti' ? 'active' : ''}" id="btn-lang-ti" role="radio" aria-checked="${this.captionLang === 'ti'}">ትግርኛ (TI)</button>
              <button type="button" class="btn-option" id="btn-lang-off" role="radio" aria-checked="${!this.captionsVisible}">Off</button>
            </div>
          </fieldset>

          <!-- Size Selector -->
          <fieldset class="settings-group">
            <legend>${t.sizeTitle}</legend>
            <div class="btn-group" role="radiogroup" aria-label="${t.sizeTitle}">
              <button type="button" class="btn-option ${this.captionSize === '100' ? 'active' : ''}" data-size="100" role="radio" aria-checked="${this.captionSize === '100'}">100%</button>
              <button type="button" class="btn-option ${this.captionSize === '125' ? 'active' : ''}" data-size="125" role="radio" aria-checked="${this.captionSize === '125'}">125%</button>
              <button type="button" class="btn-option ${this.captionSize === '150' ? 'active' : ''}" data-size="150" role="radio" aria-checked="${this.captionSize === '150'}">150%</button>
              <button type="button" class="btn-option ${this.captionSize === '200' ? 'active' : ''}" data-size="200" role="radio" aria-checked="${this.captionSize === '200'}">200%</button>
            </div>
          </fieldset>

          <!-- Theme Selector -->
          <fieldset class="settings-group">
            <legend>${t.themeTitle}</legend>
            <div class="btn-group" role="radiogroup" aria-label="${t.themeTitle}">
              <button type="button" class="btn-option ${this.captionTheme === 'yellow-black' ? 'active' : ''}" data-theme="yellow-black" role="radio" aria-checked="${this.captionTheme === 'yellow-black'}">${t.themeYellowBlack}</button>
              <button type="button" class="btn-option ${this.captionTheme === 'white-black' ? 'active' : ''}" data-theme="white-black" role="radio" aria-checked="${this.captionTheme === 'white-black'}">${t.themeWhiteBlack}</button>
              <button type="button" class="btn-option ${this.captionTheme === 'black-yellow' ? 'active' : ''}" data-theme="black-yellow" role="radio" aria-checked="${this.captionTheme === 'black-yellow'}">${t.themeBlackYellow}</button>
            </div>
          </fieldset>
        </div>

        <!-- Accessible Keyboard Shortcuts Dialog (<dialog>) -->
        <dialog id="shortcuts-dialog" class="shortcuts-modal" aria-labelledby="dialog-title">
          <div class="dialog-header">
            <h2 id="dialog-title">${t.shortcutsHeading}</h2>
            <button type="button" class="btn-option" id="btn-dialog-x" aria-label="${t.closeDialog}">✕</button>
          </div>
          <p style="color: #d1d5db; margin-top: 0; font-size: 0.95rem;">${t.shortcutsIntro}</p>
          <ul class="shortcuts-list">
            <li><span>${t.kSpace}</span><kbd class="kbd-badge">Space / K</kbd></li>
            <li><span>${t.kArrows}</span><kbd class="kbd-badge">← / →</kbd></li>
            <li><span>${t.kM}</span><kbd class="kbd-badge">M</kbd></li>
            <li><span>${t.kC}</span><kbd class="kbd-badge">C</kbd></li>
            <li><span>${t.kS}</span><kbd class="kbd-badge">S</kbd></li>
            <li><span>${t.kT}</span><kbd class="kbd-badge">T</kbd></li>
            <li><span>${t.kF}</span><kbd class="kbd-badge">F</kbd></li>
            <li><span>${t.kQuestion}</span><kbd class="kbd-badge">?</kbd></li>
            <li><span>${t.kEscape}</span><kbd class="kbd-badge">Esc</kbd></li>
          </ul>
          <button type="button" class="btn-dialog-close" id="btn-dialog-close">${t.closeDialog}</button>
        </dialog>

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

          <!-- Captions Toggle & Menu Button -->
          <button 
            type="button" 
            class="btn-ctrl" 
            id="btn-captions" 
            aria-label="${t.captionsMenu}" 
            aria-pressed="${this.captionsVisible}"
            aria-expanded="false">
            <span aria-hidden="true">CC</span>
          </button>

          <!-- Sign Language Toggle Button -->
          <button 
            type="button" 
            class="btn-ctrl" 
            id="btn-sign" 
            aria-label="${t.signLanguage}" 
            aria-pressed="${this.signVisible}">
            <span aria-hidden="true">🤟</span>
          </button>

          <!-- Transcript & Audio-First Toggle Button -->
          <button 
            type="button" 
            class="btn-ctrl" 
            id="btn-transcript-toggle" 
            aria-label="${t.transcriptTitle}" 
            aria-pressed="${this.transcriptOpen}">
            <span aria-hidden="true">📜</span>
          </button>

          <!-- Low Bandwidth Audio-Only Mode Toggle -->
          <button 
            type="button" 
            class="btn-ctrl" 
            id="btn-audio-only" 
            aria-label="${t.audioOnlyBtn}" 
            aria-pressed="${this.audioOnlyMode}">
            <span aria-hidden="true">📻</span>
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

        <!-- Interactive Transcript & Audio-First Drawer -->
        <section 
          id="transcript-drawer" 
          class="transcript-drawer ${this.transcriptOpen ? 'active' : ''}" 
          aria-label="${t.transcriptTitle}">
          
          <div class="drawer-header">
            <h3>📜 ${t.transcriptTitle}</h3>
            
            <!-- Audio-First Read-Aloud Toolbar -->
            <div class="audio-first-toolbar" role="toolbar" aria-label="${t.audioFirstTitle}">
              <button type="button" class="btn-af-ctrl btn-af-primary" id="btn-read-aloud">
                <span id="read-icon">🔊</span> <span id="read-text">${t.audioFirstBtn}</span>
              </button>
              <button type="button" class="btn-af-ctrl" id="btn-read-prev" aria-label="${t.audioFirstPrev}">⏮</button>
              <button type="button" class="btn-af-ctrl" id="btn-read-repeat" aria-label="${t.audioFirstRepeat}">🔁</button>
              <button type="button" class="btn-af-ctrl" id="btn-read-next" aria-label="${t.audioFirstNext}">⏭</button>
              <button type="button" class="btn-af-ctrl" id="btn-speech-rate" aria-label="Speech Speed">1.0x</button>
            </div>
          </div>

          <!-- Interactive Clickable Cue List -->
          <div class="transcript-scroll-area" id="transcript-cue-list" role="feed" aria-label="Synchronized sentences">
            ${this.renderTranscriptCues()}
          </div>

          <!-- Download Bar -->
          <div class="download-bar">
            <button type="button" class="btn-download" id="btn-download-txt">
              <span>⬇️</span> ${t.downloadText}
            </button>
            <a href="${this.getOfflinePackUrl()}" download class="btn-download" id="btn-download-zip">
              <span>📦</span> ${t.downloadZip} <span class="offline-badge">(${t.offlineSize})</span>
            </a>
          </div>
        </section>
      </section>
    `;

    this.setupEventListeners();
  }

  renderTranscriptCues() {
    const track = this.captionTracks[this.captionLang] || [];
    const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return track.map((cue, idx) => `
      <button 
        type="button" 
        class="cue-btn ${idx === this.activeCueIndex ? 'active-cue' : ''}" 
        data-start="${cue.start}" 
        data-idx="${idx}"
        aria-label="Seek to ${formatTime(cue.start)}: ${cue.text}">
        <span class="cue-time">${formatTime(cue.start)}</span>
        <span class="cue-text" lang="${this.captionLang}">${cue.text}</span>
      </button>
    `).join('');
  }

  setupEventListeners() {
    const wrapper = this.shadowRoot.querySelector('.player-wrapper');
    const video = this.shadowRoot.querySelector('video.main-video');
    const signVideo = this.shadowRoot.querySelector('video.sign-video');
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
    const captionContainer = this.shadowRoot.querySelector('#caption-container');
    const captionBox = this.shadowRoot.querySelector('#caption-box');
    const captionBadge = this.shadowRoot.querySelector('#caption-badge');
    const captionsBtn = this.shadowRoot.querySelector('#btn-captions');
    const signBtn = this.shadowRoot.querySelector('#btn-sign');
    const signPipContainer = this.shadowRoot.querySelector('#sign-pip-container');
    const settingsPanel = this.shadowRoot.querySelector('#caption-settings-panel');
    const closeSettingsBtn = this.shadowRoot.querySelector('#btn-close-settings');
    const helpBtn = this.shadowRoot.querySelector('#btn-help');
    const shortcutsDialog = this.shadowRoot.querySelector('#shortcuts-dialog');
    const dialogCloseBtn = this.shadowRoot.querySelector('#btn-dialog-close');
    const dialogXBtn = this.shadowRoot.querySelector('#btn-dialog-x');
    const transcriptDrawer = this.shadowRoot.querySelector('#transcript-drawer');
    const transcriptToggleBtn = this.shadowRoot.querySelector('#btn-transcript-toggle');
    const audioOnlyBtn = this.shadowRoot.querySelector('#btn-audio-only');
    const audioOnlyBanner = this.shadowRoot.querySelector('#audio-only-banner');
    const t = this.i18n;

    const formatTime = (seconds) => {
      if (isNaN(seconds)) return '0:00';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Play / Pause Synchronization
    const togglePlay = () => {
      if (video.paused || video.ended) {
        video.play();
        if (this.signVisible && signVideo) signVideo.play().catch(() => {});
      } else {
        video.pause();
        if (signVideo) signVideo.pause();
      }
    };

    playBtn.addEventListener('click', togglePlay);

    video.addEventListener('play', () => {
      this.isPlaying = true;
      playIcon.textContent = '⏸';
      playText.textContent = t.pause;
      playBtn.setAttribute('aria-label', t.pause);
      statusEl.textContent = t.statusPlaying;
      if (this.signVisible && signVideo && signVideo.paused) {
        signVideo.play().catch(() => {});
      }
    });

    video.addEventListener('pause', () => {
      this.isPlaying = false;
      playIcon.textContent = '▶';
      playText.textContent = t.play;
      playBtn.setAttribute('aria-label', t.play);
      statusEl.textContent = t.statusPaused;
      if (signVideo && !signVideo.paused) {
        signVideo.pause();
      }
    });

    video.addEventListener('ratechange', () => {
      if (signVideo) signVideo.playbackRate = video.playbackRate;
    });

    video.addEventListener('seeking', () => {
      if (signVideo) signVideo.currentTime = video.currentTime;
    });
    video.addEventListener('seeked', () => {
      if (signVideo) signVideo.currentTime = video.currentTime;
    });

    // -------------------------------------------------------------
    // REAL-TIME CUE & SIGN DRIFT CORRECTION
    // -------------------------------------------------------------
    video.addEventListener('timeupdate', () => {
      const currentTime = video.currentTime;
      currentTimeEl.textContent = formatTime(currentTime);

      const percent = video.duration ? (currentTime / video.duration) * 100 : 0;
      this.dispatchEvent(new CustomEvent('db-player:progress', {
        bubbles: true,
        composed: true,
        detail: {
          seconds: Math.floor(currentTime),
          percent: Number(percent.toFixed(1))
        }
      }));

      // Captions cue update
      const activeTrack = this.captionTracks[this.captionLang] || [];
      const cueIdx = activeTrack.findIndex((c) => currentTime >= c.start && currentTime <= c.end);

      if (this.captionsVisible) {
        if (cueIdx !== -1) {
          captionBox.textContent = activeTrack[cueIdx].text;
          captionBox.setAttribute('lang', this.captionLang);
          captionContainer.classList.remove('hidden');
        } else {
          captionContainer.classList.add('hidden');
        }
      }

      // Highlight active cue in transcript scroll area
      if (cueIdx !== -1 && cueIdx !== this.activeCueIndex) {
        this.activeCueIndex = cueIdx;
        this.shadowRoot.querySelectorAll('.cue-btn').forEach((btn, idx) => {
          btn.classList.toggle('active-cue', idx === cueIdx);
        });
      }

      // EthSL Drift correction (every second if drift > 0.3s)
      if (this.signVisible && signVideo && !signVideo.paused) {
        if (Math.abs(signVideo.currentTime - currentTime) > 0.3) {
          signVideo.currentTime = currentTime;
        }
      }
    });

    video.addEventListener('loadedmetadata', () => {
      durationEl.textContent = formatTime(video.duration);
    });
    video.addEventListener('durationchange', () => {
      if (video.duration && !isNaN(video.duration)) {
        durationEl.textContent = formatTime(video.duration);
      }
    });
    if (video.duration && !isNaN(video.duration)) {
      durationEl.textContent = formatTime(video.duration);
    }

    video.addEventListener('ended', () => {
      if (signVideo) signVideo.pause();
      this.dispatchEvent(new CustomEvent('db-player:complete', {
        bubbles: true,
        composed: true,
        detail: { completedAt: new Date().toISOString() }
      }));
    });

    // Seek actions
    const seekRelative = (delta) => {
      video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
      if (signVideo) signVideo.currentTime = video.currentTime;
      statusEl.textContent = `${delta < 0 ? t.seekBack : t.seekForward}: ${formatTime(video.currentTime)}`;
    };

    backBtn.addEventListener('click', () => seekRelative(-10));
    fwdBtn.addEventListener('click', () => seekRelative(10));

    // Mute toggle action
    const toggleMute = () => {
      video.muted = !video.muted;
      this.isMuted = video.muted;
      muteIcon.textContent = video.muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', video.muted ? t.unmute : t.mute);
      statusEl.textContent = video.muted ? t.mute : t.unmute;
    };
    muteBtn.addEventListener('click', toggleMute);

    // Fullscreen toggle action
    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        if (wrapper.requestFullscreen) {
          wrapper.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    };
    const fsBtn = this.shadowRoot.querySelector('#btn-fullscreen');
    fsBtn.addEventListener('click', toggleFullscreen);

    // -------------------------------------------------------------
    // ETHIOPIAN SIGN LANGUAGE (EthSL) TOGGLE & DRAGGABLE / RESIZABLE
    // -------------------------------------------------------------
    const toggleSignLanguage = () => {
      this.signVisible = !this.signVisible;
      signPipContainer.classList.toggle('hidden', !this.signVisible);
      signBtn.setAttribute('aria-pressed', this.signVisible ? 'true' : 'false');

      if (this.signVisible) {
        signVideo.currentTime = video.currentTime;
        if (!video.paused) {
          signVideo.play().catch(() => {});
        }
        statusEl.textContent = t.signOpened;
      } else {
        signVideo.pause();
        statusEl.textContent = t.signClosed;
      }
      this.dispatchPrefs();
    };

    signBtn.addEventListener('click', toggleSignLanguage);

    const closeSignBtn = this.shadowRoot.querySelector('#btn-close-sign');
    if (closeSignBtn) {
      closeSignBtn.addEventListener('click', () => {
        toggleSignLanguage();
        signBtn.focus();
      });
    }

    const setSignPosition = (pos) => {
      this.signPosition = pos;
      localStorage.setItem('edubridge_sign_position', pos);
      // Clear manual inline pixel drag positions so corner preset class takes over
      signPipContainer.style.left = '';
      signPipContainer.style.top = '';
      signPipContainer.style.bottom = '';
      signPipContainer.style.right = '';
      signPipContainer.className = `sign-pip-container sign-size-${this.signSize} sign-pos-${this.signPosition} ${this.signVisible ? '' : 'hidden'}`;
      statusEl.textContent = `Sign window: ${pos}`;
      this.dispatchPrefs();
    };

    this.shadowRoot.querySelector('#btn-pos-tl')?.addEventListener('click', () => setSignPosition('top-left'));
    this.shadowRoot.querySelector('#btn-pos-tr')?.addEventListener('click', () => setSignPosition('top-right'));
    this.shadowRoot.querySelector('#btn-pos-bl')?.addEventListener('click', () => setSignPosition('bottom-left'));
    this.shadowRoot.querySelector('#btn-pos-br')?.addEventListener('click', () => setSignPosition('bottom-right'));

    const sizeToggleBtn = this.shadowRoot.querySelector('#btn-size-toggle');
    if (sizeToggleBtn) {
      sizeToggleBtn.addEventListener('click', () => {
        // Clear manual custom inline width so preset cycles
        signPipContainer.style.width = '';
        const sizes = ['small', 'medium', 'large'];
        const nextIdx = (sizes.indexOf(this.signSize) + 1) % sizes.length;
        this.signSize = sizes[nextIdx];
        localStorage.setItem('edubridge_sign_size', this.signSize);
        signPipContainer.className = `sign-pip-container sign-size-${this.signSize} sign-pos-${this.signPosition} ${this.signVisible ? '' : 'hidden'}`;
        statusEl.textContent = `Sign size: ${this.signSize}`;
        this.dispatchPrefs();
      });
    }

    // Free Pointer Dragging (Move anywhere across the video)
    const dragHeader = this.shadowRoot.querySelector('#sign-drag-header');
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let containerStartLeft = 0;
    let containerStartTop = 0;

    dragHeader?.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return; // Allow buttons in header to be clicked

      isDragging = true;
      dragHeader.setPointerCapture(e.pointerId);

      const wrapperRect = wrapper.getBoundingClientRect();
      const containerRect = signPipContainer.getBoundingClientRect();

      containerStartLeft = containerRect.left - wrapperRect.left;
      containerStartTop = containerRect.top - wrapperRect.top;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      signPipContainer.style.transition = 'none';
      signPipContainer.style.left = `${containerStartLeft}px`;
      signPipContainer.style.top = `${containerStartTop}px`;
      signPipContainer.style.bottom = 'auto';
      signPipContainer.style.right = 'auto';
    });

    dragHeader?.addEventListener('pointermove', (e) => {
      if (!isDragging) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;

      let newLeft = containerStartLeft + deltaX;
      let newTop = containerStartTop + deltaY;

      const maxLeft = wrapperRect.width - signPipContainer.offsetWidth;
      const maxTop = wrapperRect.height - signPipContainer.offsetHeight;

      newLeft = Math.max(0, Math.min(maxLeft, newLeft));
      newTop = Math.max(0, Math.min(maxTop, newTop));

      signPipContainer.style.left = `${newLeft}px`;
      signPipContainer.style.top = `${newTop}px`;
    });

    const stopDragging = (e) => {
      if (isDragging) {
        isDragging = false;
        try { dragHeader.releasePointerCapture(e.pointerId); } catch (_) {}
        signPipContainer.style.transition = '';
      }
    };
    dragHeader?.addEventListener('pointerup', stopDragging);
    dragHeader?.addEventListener('pointercancel', stopDragging);

    // Free Pointer Resizing (Handle in bottom-right corner)
    const resizeHandle = this.shadowRoot.querySelector('#sign-resize-handle');
    let isResizing = false;
    let resizeStartX = 0;
    let containerStartWidth = 0;

    resizeHandle?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      resizeHandle.setPointerCapture(e.pointerId);

      resizeStartX = e.clientX;
      containerStartWidth = signPipContainer.offsetWidth;
      signPipContainer.style.transition = 'none';
    });

    resizeHandle?.addEventListener('pointermove', (e) => {
      if (!isResizing) return;
      const wrapperRect = wrapper.getBoundingClientRect();
      const deltaX = e.clientX - resizeStartX;
      let newWidth = containerStartWidth + deltaX;

      const minWidth = 140;
      const maxWidth = Math.max(300, wrapperRect.width * 0.85);

      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      signPipContainer.style.width = `${newWidth}px`;
    });

    const stopResizing = (e) => {
      if (isResizing) {
        isResizing = false;
        try { resizeHandle.releasePointerCapture(e.pointerId); } catch (_) {}
        signPipContainer.style.transition = '';
      }
    };
    resizeHandle?.addEventListener('pointerup', stopResizing);
    resizeHandle?.addEventListener('pointercancel', stopResizing);

    // -------------------------------------------------------------
    // TRANSCRIPT & AUDIO-FIRST READ ALOUD ENGINE
    // -------------------------------------------------------------
    const toggleTranscript = () => {
      this.transcriptOpen = !this.transcriptOpen;
      transcriptDrawer.classList.toggle('active', this.transcriptOpen);
      transcriptToggleBtn.setAttribute('aria-pressed', this.transcriptOpen ? 'true' : 'false');
      statusEl.textContent = this.transcriptOpen ? t.transcriptOpen : t.transcriptClose;
    };
    transcriptToggleBtn.addEventListener('click', toggleTranscript);

    // Clickable transcript cues seeking video
    const attachCueClickListeners = () => {
      this.shadowRoot.querySelectorAll('.cue-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const startTime = parseFloat(btn.getAttribute('data-start'));
          video.currentTime = startTime;
          if (signVideo) signVideo.currentTime = startTime;
          if (video.paused) video.play();
          statusEl.textContent = `Seeked to ${formatTime(startTime)}`;
        });
      });
    };
    attachCueClickListeners();

    // Audio-First Read Aloud with window.speechSynthesis
    const readBtn = this.shadowRoot.querySelector('#btn-read-aloud');
    const readIcon = this.shadowRoot.querySelector('#read-icon');
    const readText = this.shadowRoot.querySelector('#read-text');
    let speechSynth = window.speechSynthesis;
    let currentSpeechIdx = 0;

    const stopReading = () => {
      if (speechSynth) speechSynth.cancel();
      this.isReadingAloud = false;
      readIcon.textContent = '🔊';
      readText.textContent = t.audioFirstBtn;
      statusEl.textContent = t.audioFirstStop;
    };

    const speakCue = (idx) => {
      const track = this.captionTracks[this.captionLang] || [];
      if (!speechSynth || idx < 0 || idx >= track.length) {
        stopReading();
        return;
      }

      speechSynth.cancel();
      currentSpeechIdx = idx;
      this.activeCueIndex = idx;

      // Scroll transcript cue into view
      const cueBtns = this.shadowRoot.querySelectorAll('.cue-btn');
      cueBtns.forEach((b, i) => b.classList.toggle('active-cue', i === idx));
      if (cueBtns[idx]) cueBtns[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      const utterance = new SpeechSynthesisUtterance(track[idx].text);
      if (this.captionLang === 'am') utterance.lang = 'am-ET';
      else if (this.captionLang === 'ti') utterance.lang = 'ti-ET';
      else if (this.captionLang === 'om') utterance.lang = 'om-ET';
      else utterance.lang = 'en-US';
      utterance.rate = this.speechRate;

      utterance.onend = () => {
        if (this.isReadingAloud && currentSpeechIdx + 1 < track.length) {
          speakCue(currentSpeechIdx + 1);
        } else {
          stopReading();
        }
      };

      utterance.onerror = () => {
        stopReading();
      };

      this.isReadingAloud = true;
      readIcon.textContent = '⏹';
      readText.textContent = t.audioFirstStop;
      speechSynth.speak(utterance);
      statusEl.textContent = `Reading: ${track[idx].text}`;
    };

    readBtn.addEventListener('click', () => {
      if (this.isReadingAloud) {
        stopReading();
      } else {
        video.pause(); // Pause video when reading aloud to avoid sound clash
        speakCue(this.activeCueIndex >= 0 ? this.activeCueIndex : 0);
      }
    });

    this.shadowRoot.querySelector('#btn-read-repeat')?.addEventListener('click', () => {
      speakCue(currentSpeechIdx);
    });

    this.shadowRoot.querySelector('#btn-read-prev')?.addEventListener('click', () => {
      if (currentSpeechIdx > 0) speakCue(currentSpeechIdx - 1);
    });

    this.shadowRoot.querySelector('#btn-read-next')?.addEventListener('click', () => {
      const track = this.captionTracks[this.captionLang] || [];
      if (currentSpeechIdx + 1 < track.length) speakCue(currentSpeechIdx + 1);
    });

    const rateBtn = this.shadowRoot.querySelector('#btn-speech-rate');
    if (rateBtn) {
      rateBtn.addEventListener('click', () => {
        const rates = [0.8, 1.0, 1.2];
        const nextRateIdx = (rates.indexOf(this.speechRate) + 1) % rates.length;
        this.speechRate = rates[nextRateIdx];
        rateBtn.textContent = `${this.speechRate.toFixed(1)}x`;
        statusEl.textContent = `Speech speed: ${this.speechRate}x`;
        if (this.isReadingAloud) speakCue(currentSpeechIdx);
      });
    }

    // -------------------------------------------------------------
    // PLAIN TEXT TRANSCRIPT (.txt) DOWNLOAD
    // -------------------------------------------------------------
    const downloadTxtBtn = this.shadowRoot.querySelector('#btn-download-txt');
    downloadTxtBtn?.addEventListener('click', () => {
      const track = this.captionTracks[this.captionLang] || [];
      let content = `EduBridge Lesson Transcript (${this.captionLang === 'am' ? 'Amharic' : 'English'})\n`;
      content += `Generated on: ${new Date().toLocaleDateString()}\n`;
      content += `=========================================================\n\n`;

      track.forEach((cue) => {
        content += `[${formatTime(cue.start)} - ${formatTime(cue.end)}] ${cue.text}\n\n`;
      });

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edubridge-lesson-${this.captionLang}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      statusEl.textContent = "Transcript text file downloaded.";
    });

    // -------------------------------------------------------------
    // BATTERY & BANDWIDTH SAVING AUDIO-ONLY 3G MODE
    // -------------------------------------------------------------
    audioOnlyBtn.addEventListener('click', () => {
      this.audioOnlyMode = !this.audioOnlyMode;
      audioOnlyBtn.setAttribute('aria-pressed', this.audioOnlyMode ? 'true' : 'false');
      video.classList.toggle('audio-only', this.audioOnlyMode);
      audioOnlyBanner.classList.toggle('active', this.audioOnlyMode);
      statusEl.textContent = this.audioOnlyMode ? t.audioOnlyActive : "Video picture restored";
    });

    // -------------------------------------------------------------
    // ACCESSIBLE KEYBOARD SHORTCUTS ENGINE (WCAG 2.1.1, 2.1.4)
    // -------------------------------------------------------------
    const openHelpDialog = () => {
      if (shortcutsDialog && typeof shortcutsDialog.showModal === 'function') {
        shortcutsDialog.showModal();
        dialogCloseBtn.focus();
        statusEl.textContent = t.shortcutsHeading;
      }
    };

    const closeHelpDialog = () => {
      if (shortcutsDialog && shortcutsDialog.open) {
        shortcutsDialog.close();
        helpBtn.focus();
        statusEl.textContent = t.closeDialog;
      }
    };

    helpBtn.addEventListener('click', openHelpDialog);
    dialogCloseBtn.addEventListener('click', closeHelpDialog);
    dialogXBtn.addEventListener('click', closeHelpDialog);

    // Scoped keyboard listener
    this.addEventListener('keydown', (e) => {
      const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable) {
        return;
      }

      if (shortcutsDialog && shortcutsDialog.open) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeHelpDialog();
        }
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-10);
          break;

        case 'ArrowRight':
          e.preventDefault();
          seekRelative(10);
          break;

        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;

        case 'c':
        case 'C':
          e.preventDefault();
          this.captionsVisible = !this.captionsVisible;
          captionContainer.classList.toggle('hidden', !this.captionsVisible);
          captionsBtn.setAttribute('aria-pressed', this.captionsVisible ? 'true' : 'false');
          statusEl.textContent = this.captionsVisible ? t.captionsOn : t.captionsOff;
          this.dispatchPrefs();
          break;

        case 's':
        case 'S':
          e.preventDefault();
          toggleSignLanguage();
          break;

        case 't':
        case 'T':
          e.preventDefault();
          toggleTranscript();
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;

        case '?':
          e.preventDefault();
          openHelpDialog();
          break;

        case 'Escape':
          if (!settingsPanel.classList.contains('hidden')) {
            e.preventDefault();
            settingsPanel.classList.add('hidden');
            captionsBtn.setAttribute('aria-expanded', 'false');
            captionsBtn.focus();
          }
          break;
      }
    });

    // -------------------------------------------------------------
    // CAPTION TOGGLE & SETTINGS CONTROLS
    // -------------------------------------------------------------
    captionsBtn.addEventListener('click', () => {
      const isExpanded = captionsBtn.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        settingsPanel.classList.add('hidden');
        captionsBtn.setAttribute('aria-expanded', 'false');
      } else {
        settingsPanel.classList.remove('hidden');
        captionsBtn.setAttribute('aria-expanded', 'true');
        closeSettingsBtn.focus();
      }
    });

    closeSettingsBtn.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
      captionsBtn.setAttribute('aria-expanded', 'false');
      captionsBtn.focus();
    });

    // Language radio buttons
    const btnLangAm = this.shadowRoot.querySelector('#btn-lang-am');
    const btnLangEn = this.shadowRoot.querySelector('#btn-lang-en');
    const btnLangOm = this.shadowRoot.querySelector('#btn-lang-om');
    const btnLangTi = this.shadowRoot.querySelector('#btn-lang-ti');
    const btnLangOff = this.shadowRoot.querySelector('#btn-lang-off');

    const updateLangSelection = (lang, visible) => {
      this.captionLang = lang;
      this.captionsVisible = visible;
      if (this.captionLang === 'am') {
        captionBadge.textContent = this.isAmharicReviewed ? '✓ ' + (t.badgeReviewed || 'Human Reviewed') : '⚡ ' + (t.badgeMachine || 'Machine Generated');
      } else if (this.captionLang === 'om') {
        captionBadge.textContent = '✓ Afaan Oromoo';
      } else if (this.captionLang === 'ti') {
        captionBadge.textContent = '✓ Tigrinya';
      } else {
        captionBadge.textContent = '✓ English';
      }

      captionsBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      captionContainer.className = `caption-container size-${this.captionSize} theme-${this.captionTheme} ${visible ? '' : 'hidden'}`;

      btnLangAm?.classList.toggle('active', visible && lang === 'am');
      btnLangAm?.setAttribute('aria-checked', visible && lang === 'am' ? 'true' : 'false');
      btnLangEn?.classList.toggle('active', visible && lang === 'en');
      btnLangEn?.setAttribute('aria-checked', visible && lang === 'en' ? 'true' : 'false');
      btnLangOm?.classList.toggle('active', visible && lang === 'om');
      btnLangOm?.setAttribute('aria-checked', visible && lang === 'om' ? 'true' : 'false');
      btnLangTi?.classList.toggle('active', visible && lang === 'ti');
      btnLangTi?.setAttribute('aria-checked', visible && lang === 'ti' ? 'true' : 'false');
      btnLangOff?.classList.toggle('active', !visible);
      btnLangOff?.setAttribute('aria-checked', !visible ? 'true' : 'false');

      // Re-render transcript cues in selected language
      const cueList = this.shadowRoot.querySelector('#transcript-cue-list');
      if (cueList) {
        cueList.innerHTML = this.renderTranscriptCues();
        attachCueClickListeners();
      }

      const langMap = { am: t.langAm || 'Amharic', en: t.langEn || 'English', om: t.langOm || 'Afaan Oromoo', ti: t.langTi || 'Tigrinya' };
      statusEl.textContent = visible ? (langMap[lang] || lang) : t.captionsOff;
      this.dispatchPrefs();
    };

    btnLangAm?.addEventListener('click', () => updateLangSelection('am', true));
    btnLangEn?.addEventListener('click', () => updateLangSelection('en', true));
    btnLangOm?.addEventListener('click', () => updateLangSelection('om', true));
    btnLangTi?.addEventListener('click', () => updateLangSelection('ti', true));
    btnLangOff?.addEventListener('click', () => updateLangSelection(this.captionLang, false));

    // Size selection
    this.shadowRoot.querySelectorAll('[data-size]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const size = btn.getAttribute('data-size');
        this.captionSize = size;
        localStorage.setItem('edubridge_caption_size', size);

        captionContainer.className = `caption-container size-${this.captionSize} theme-${this.captionTheme} ${this.captionsVisible ? '' : 'hidden'}`;

        this.shadowRoot.querySelectorAll('[data-size]').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-checked', active ? 'true' : 'false');
        });

        statusEl.textContent = `${t.sizeTitle}: ${size}%`;
        this.dispatchPrefs();
      });
    });

    // Theme selection
    this.shadowRoot.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        this.captionTheme = theme;
        localStorage.setItem('edubridge_caption_theme', theme);

        captionContainer.className = `caption-container size-${this.captionSize} theme-${this.captionTheme} ${this.captionsVisible ? '' : 'hidden'}`;
        captionBox.className = `caption-box theme-${this.captionTheme}`;

        this.shadowRoot.querySelectorAll('[data-theme]').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-checked', active ? 'true' : 'false');
        });

        statusEl.textContent = `${t.themeTitle} changed`;
        this.dispatchPrefs();
      });
    });

    if (video && video.src && !video.src.endsWith('/')) {
      try { video.load(); } catch (e) {}
    }
    if (signVideo && signVideo.src && !signVideo.src.endsWith('/')) {
      try { signVideo.load(); } catch (e) {}
    }
  }

  dispatchPrefs() {
    this.dispatchEvent(new CustomEvent('db-player:prefs', {
      bubbles: true,
      composed: true,
      detail: {
        captionSize: Number(this.captionSize),
        captionTheme: this.captionTheme,
        captionLang: this.captionLang,
        captionsVisible: this.captionsVisible,
        signVisible: this.signVisible,
        signPosition: this.signPosition,
        signSize: this.signSize
      }
    }));
  }
}

// Register the custom element once
if (!customElements.get('db-player')) {
  customElements.define('db-player', DbPlayer);
}
