/**
 * EduBridge Accessible Job Card Web Component (<db-jobcard>)
 * Digital Bridge Hackathon 2026 — Track 2: Accessible Learning Media & Career Gateway
 *
 * Requirements Met:
 * - One tag: <db-jobcard job-id="job-et-01" lang="am"></db-jobcard>
 * - Reflows cleanly without horizontal scrolling at 200% zoom and 320px width (WCAG 1.4.10).
 * - Keyboard-operable "Listen to Summary" audio player paired with visible text summary (WCAG 1.2.1, 2.1.1).
 * - Embeds valid schema.org/JobPosting JSON-LD structured data (Level 3 Open Standard).
 * - Verifiable graduate skill certificate link.
 * - Shadow DOM encapsulation with host style inheritance and high-contrast focus rings.
 */

class DbJobCard extends HTMLElement {
  static get observedAttributes() {
    return ['job-id', 'src', 'lang'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const rawLang = this.getAttribute('lang');
    this.currentLang = ['en', 'am', 'om', 'ti'].includes(rawLang) ? rawLang : 'en';
    this.isSpeaking = false;
    this.speechSynth = window.speechSynthesis || null;
    this.i18n = {};

    // Default sample job data (Ethiopian tech opportunities)
    this.jobsData = {
      "job-et-01": {
        id: "job-et-01",
        title: "Junior Front-End Developer (Accessibility Focus)",
        titleAm: "ጀማሪ የፊት-ለፊት ሶፍትዌር አበልጻጊ (ተደራሽነት)",
        titleOm: "Misoomsaa Fuulduraa Sadarkaa Jalqabaa (Xiyyeeffannoo Qaqqabamummaa)",
        titleTi: "ጀማሪ ናይ ቅድሚት ሶፍትዌር ኣማዕባሊ (ተበጻሕነት ዘተኮረ)",
        employer: "Gebeya Inc.",
        location: "Addis Ababa, Ethiopia (Hybrid)",
        locationAm: "አዲስ አበባ፣ ኢትዮጵያ (ድቅል)",
        locationOm: "Finfinnee, Itoophiyaa (Wal-makaa)",
        locationTi: "ኣዲስ ኣበባ፣ ኢትዮጵያ (ድቓል)",
        employmentType: "Full-Time",
        deadline: "2026-12-15",
        deadlineAm: "ታህሳስ 6፣ 2019 ዓ.ም",
        deadlineOm: "Muddee 6, 2019",
        deadlineTi: "ታሕሳስ 6፣ 2019",
        audioSummary: "Gebeya is hiring a Junior Front-End Developer with focus on web accessibility. Responsibilities include building accessible UI and keyboard navigation. Accommodations provided for disabled candidates including sign language interpreters.",
        audioSummaryAm: "ገበያ ኢንክ የድር ተደራሽነት ፍላጎት ያለው ጀማሪ የፊት-ለፊት ሶፍትዌር አበልጻጊ እየቀጠረ ነው። መስፈርቶች ኤችቲኤምኤል፣ ሲኤስኤስ፣ ጃቫስክሪፕት እና የተደራሽነት ግንዛቤን ያካትታሉ። ለአካል ጉዳተኛ አመልካቾች የምልክት ቋንቋ ተርጓሚን ጨምሮ ሙሉ ድጋፍ ይሰጣል።",
        audioSummaryOm: "Dhaabbanni Gebeya Inc misoomsaa fuulduraa xiyyeeffannoo qaqqabamummaa qabu qacaruu barbaada. Itti-gaafatamummaan UI qaqqabamaa fi naannoo kiiboordii ijaaruu dabalata. Iyyattoota qaama miidhamtootaaf deeggarsi turjumaana afaan mallattoo ni kennama.",
        audioSummaryTi: "ገበያ ኢንክ ናይ ወብ ተበጻሕነት ድሌት ዘለዎ ጀማሪ ናይ ቅድሚት ሶፍትዌር ኣማዕባሊ ይቖጽር ኣሎ። ሓላፍነት ተበጻሒ UIን ናይ ሰሌዳ ዳህሳስን ምስራሕ የጠቓልል። ንስንኩላን ሕጹያት ናይ ቋንቋ ምልክት ኣስተርጎምቲ ሓዊሱ ምሉእ ደገፍ ይወሃብ።",
        description: "Develop inclusive user interfaces complying with WCAG 2.2 AA standards for regional learners.",
        requirements: [
          "Understanding of semantic HTML5 and modern CSS",
          "Familiarity with WCAG 2.2 Level AA accessibility",
          "Experience with screen reader testing (NVDA or TalkBack)"
        ],
        requirementsAm: [
          "የኤችቲኤምኤል 5 እና የሲኤስኤስ መሰረታዊ ግንዛቤ",
          "የተደራሽነት መመሪያዎችን (WCAG 2.2 AA) ማወቅ",
          "የስክሪን አንባቢዎችን (NVDA ወይም TalkBack) የመጠቀም ልምድ"
        ],
        requirementsOm: [
          "Hubannoo bu'uuraa HTML5 fi modern CSS",
          "Qajeelfamoota qaqqabamummaa (WCAG 2.2 AA) beekuu",
          "Muuxannoo dubbiftuu iskiriinii (NVDA ykn TalkBack) fayyadamuu"
        ],
        requirementsTi: [
          "ናይ HTML5ን ዘመናዊ CSSን መሰረታዊ ርድኢት",
          "ናይ ተበጻሕነት መምርሒታት (WCAG 2.2 AA) ምፍላጥ",
          "ናይ ስክሪን ኣንበብቲ (NVDA ወይ TalkBack) ናይ ምጥቃም ተሞክሮ"
        ],
        accommodations: "Sign language interpreter for interviews; accessible workstations; flexible remote hours.",
        accommodationsAm: "ለቃለ-መጠይቅ የምልክት ቋንቋ ተርጓሚ፤ ተደራሽ የሥራ ቦታዎች፤ ተለዋዋጭ የርቀት የሥራ ሰዓት።",
        accommodationsOm: "Qorumsa afaaniif turjumaana afaan mallattoo; bakka hojii qaqqabamaa; sa'aatii hojii fageenyaa jijjiiramaa.",
        accommodationsTi: "ንቃለ-መሕትት ናይ ቋንቋ ምልክት ኣስተርጓሚ፤ ተበጻሒ ናይ ስራሕ ቦታታት፤ ምቹእ ናይ ርሑቕ ስራሕ ሰዓታት።",
        certificateUrl: "/api/v1/certificates/cert-demo-01/verify",
        applyUrl: "https://careers.gebeya.com/apply/a11y-dev",
        schema: {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Junior Front-End Developer (Accessibility Focus)",
          "description": "Develop inclusive user interfaces complying with WCAG 2.2 AA standards.",
          "datePosted": "2026-11-14",
          "validThrough": "2026-12-15",
          "employmentType": "FULL_TIME",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Gebeya Inc."
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Addis Ababa",
              "addressCountry": "ET"
            }
          },
          "jobBenefits": "Sign language interpreter for interviews, flexible hours, accessible workplace"
        }
      }
    };
  }

  connectedCallback() {
    this.loadTranslations();
    this.render();
    this.injectSchemaOrgJsonLd();
    this.loadJobData();
  }

  async loadTranslations() {
    const TRANSLATIONS = {
      en: {
        audioBtn: "Listen to Summary",
        audioStop: "Stop Audio",
        audioTitle: "Spoken Audio Summary",
        reqTitle: "Key Requirements",
        accTitle: "Accommodations Provided",
        deadlineTitle: "Deadline:",
        certBtn: "Verify EduBridge Certificate",
        applyBtn: "Apply Now"
      },
      am: {
        audioBtn: "በድምጽ አጠቃልለህ አንብብ",
        audioStop: "ማንበብ አቁም",
        audioTitle: "የሥራው አጭር ማጠቃለያ (በድምጽ)",
        reqTitle: "ዋና ዋና መስፈርቶች",
        accTitle: "የአካል ጉዳተኞች የስራ ማመቻቻ (Accommodations)",
        deadlineTitle: "የማመልከቻ ማብቂያ፦",
        certBtn: "የተረጋገጠ የኤዱብሪጅ ሰርተፍኬት አሳይ",
        applyBtn: "አሁን አመልክት"
      },
      om: {
        audioBtn: "Dhaggeeffadhu (Gabaasa)",
        audioStop: "Sagalee Dhaabi",
        audioTitle: "Gabaasa Sagalee",
        reqTitle: "Ulaagaalee Ijoo",
        accTitle: "Haalawwan Mijaawaa Qaama Miidhamtootaa",
        deadlineTitle: "Guyyaa Dhumaa:",
        certBtn: "Waraqaa Ragaa EduBridge Mirkaneessi",
        applyBtn: "Amma Iyyadhu"
      },
      ti: {
        audioBtn: "ስማዕ (ሓጺር ጸብጻብ)",
        audioStop: "ድምጺ ኣቋርጽ",
        audioTitle: "ናይ ድምጺ ሓጺር ጸብጻብ",
        reqTitle: "ቀንዲ መዐቀኒታት",
        accTitle: "ምቹእ ኩነታት ንስንኩላን",
        deadlineTitle: "ናይ መወዳእታ ዕለት:",
        certBtn: "ዝተረጋገጸ ምስክር ወረቐት ኤዱብሪጅ ርአ",
        applyBtn: "ሕጂ ኣመልክት"
      }
    };

    try {
      const candidates = [`./i18n/${this.currentLang}.json`, `/jobcard/i18n/${this.currentLang}.json`];
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

  async loadJobData() {
    const src = this.getAttribute('src');
    if (src) {
      try {
        const res = await fetch(src);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((j) => { if (j.id) this.jobsData[j.id] = j; });
          } else if (data && data.id) {
            this.jobsData[data.id] = data;
          }
          this.render();
          this.injectSchemaOrgJsonLd();
        }
      } catch (e) {}
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.shadowRoot.innerHTML) {
      if (name === 'lang') {
        this.currentLang = ['en', 'am', 'om', 'ti'].includes(newValue) ? newValue : 'en';
        this.loadTranslations();
      } else if (name === 'src') {
        this.loadJobData();
      }
      this.render();
      this.injectSchemaOrgJsonLd();
    }
  }

  injectSchemaOrgJsonLd() {
    const jobId = this.getAttribute('job-id') || 'job-et-01';
    const job = this.jobsData[jobId] || this.jobsData['job-et-01'];
    if (!job || !job.schema) return;

    // Check if script already injected in head
    const existing = document.getElementById(`jsonld-${job.id}`);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = `jsonld-${job.id}`;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(job.schema, null, 2);
    document.head.appendChild(script);
  }

  render() {
    const jobId = this.getAttribute('job-id') || 'job-et-01';
    const job = this.jobsData[jobId] || this.jobsData['job-et-01'];
    const lang = this.currentLang;
    const isEthiopic = lang === 'am' || lang === 'ti';

    const getField = (prefix) => {
      if (lang === 'am') return job[prefix + 'Am'] || job[prefix];
      if (lang === 'om') return job[prefix + 'Om'] || job[prefix];
      if (lang === 'ti') return job[prefix + 'Ti'] || job[prefix];
      return job[prefix];
    };

    const i18n = this.i18n || {};
    const t = {
      title: getField('title'),
      location: getField('location'),
      audioBtn: i18n.audioBtn || (lang === 'am' ? "በድምጽ አጠቃልለህ አንብብ" : lang === 'om' ? "Dhaggeeffadhu (Gabaasa)" : lang === 'ti' ? "ስማዕ (ሓጺር ጸብጻብ)" : "Listen to Summary"),
      audioStop: i18n.audioStop || (lang === 'am' ? "ማንበብ አቁም" : lang === 'om' ? "Sagalee Dhaabi" : lang === 'ti' ? "ድምጺ ኣቋርጽ" : "Stop Audio"),
      audioTitle: i18n.audioTitle || (lang === 'am' ? "የሥራው አጭር ማጠቃለያ (በድምጽ)" : lang === 'om' ? "Gabaasa Sagalee" : lang === 'ti' ? "ናይ ድምጺ ሓጺር ጸብጻብ" : "Spoken Audio Summary"),
      summaryText: getField('audioSummary'),
      reqTitle: i18n.reqTitle || (lang === 'am' ? "ዋና ዋና መስፈርቶች" : lang === 'om' ? "Ulaagaalee Ijoo" : lang === 'ti' ? "ቀንዲ መዐቀኒታት" : "Key Requirements"),
      reqList: getField('requirements'),
      accTitle: i18n.accTitle || (lang === 'am' ? "የአካል ጉዳተኞች የስራ ማመቻቻ (Accommodations)" : lang === 'om' ? "Haalawwan Mijaawaa Qaama Miidhamtootaa" : lang === 'ti' ? "ምቹእ ኩነታት ንስንኩላን" : "Accommodations Provided"),
      accText: getField('accommodations'),
      deadlineTitle: i18n.deadlineTitle || (lang === 'am' ? "የማመልከቻ ማብቂያ፦" : lang === 'om' ? "Guyyaa Dhumaa:" : lang === 'ti' ? "ናይ መወዳእታ ዕለት:" : "Deadline:"),
      deadline: getField('deadline'),
      certBtn: i18n.certBtn || (lang === 'am' ? "የተረጋገጠ የኤዱብሪጅ ሰርተፍኬት አሳይ" : lang === 'om' ? "Waraqaa Ragaa EduBridge Mirkaneessi" : lang === 'ti' ? "ዝተረጋገጸ ምስክር ወረቐት ኤዱብሪጅ ርአ" : "Verify EduBridge Certificate"),
      applyBtn: i18n.applyBtn || (lang === 'am' ? "አሁን አመልክት" : lang === 'om' ? "Amma Iyyadhu" : lang === 'ti' ? "ሕጂ ኣመልክት" : "Apply Now")
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          max-width: 100%;
          font-family: var(--bs-body-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          color: var(--bs-body-color, #0f172a);
          line-height: ${isEthiopic ? '1.7' : '1.5'};
        }

        .job-card {
          background: #ffffff;
          border: 2px solid #cbd5e1;
          border-radius: 10px;
          padding: 1.5rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          position: relative;
          box-sizing: border-box;
          width: 100%;
          min-width: 280px;
        }

        /* 200% Zoom & 320px screen width safety (WCAG 1.4.10 Reflow) */
        @media (max-width: 480px) {
          .job-card {
            padding: 1rem;
          }
          .card-header {
            flex-direction: column;
            align-items: flex-start !important;
          }
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .job-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 0.35rem 0;
          line-height: 1.3;
        }

        .company-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #eff6ff;
          color: #1e40af;
          padding: 0.25rem 0.65rem;
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .badge-type {
          display: inline-block;
          background: #f1f5f9;
          color: #475569;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        /* Audio Summary Box */
        .audio-summary-box {
          background: #f8fafc;
          border-left: 4px solid #005fcc;
          border-radius: 0 6px 6px 0;
          padding: 1rem;
          margin: 1.25rem 0;
        }

        .audio-summary-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .audio-summary-header h4 {
          margin: 0;
          font-size: 1rem;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-listen {
          min-height: 44px;
          padding: 0.5rem 1rem;
          background: #005fcc;
          color: #ffffff;
          border: 0;
          border-radius: 6px;
          font-family: inherit;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.15s ease;
        }

        .btn-listen:hover {
          background: #004494;
        }

        .btn-listen:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: 2px;
        }

        .btn-listen.speaking {
          background: #b91c1c;
        }

        .summary-text {
          margin: 0;
          font-size: 0.95rem;
          color: #334155;
          line-height: 1.6;
        }

        /* Requirements List */
        .requirements-section {
          margin: 1rem 0;
        }

        .requirements-section h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          color: #0f172a;
        }

        .requirements-list {
          margin: 0;
          padding-left: 1.25rem;
          color: #334155;
          font-size: 0.95rem;
        }

        .requirements-list li {
          margin-bottom: 0.35rem;
        }

        /* Accommodations Banner */
        .accommodations-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          padding: 0.75rem 1rem;
          margin: 1rem 0;
        }

        .accommodations-box strong {
          color: #166534;
          display: block;
          margin-bottom: 0.25rem;
          font-size: 0.9rem;
        }

        .accommodations-box p {
          margin: 0;
          color: #15803d;
          font-size: 0.9rem;
        }

        /* Action Buttons */
        .card-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
        }

        .deadline-text {
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 600;
        }

        .action-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .btn-action {
          min-height: 44px;
          padding: 0.6rem 1.1rem;
          border-radius: 6px;
          font-family: inherit;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-action:focus-visible {
          outline: 3px solid #f5a300;
          outline-offset: 2px;
        }

        .btn-apply {
          background: #005fcc;
          color: #ffffff;
          border: 0;
        }

        .btn-apply:hover {
          background: #004494;
        }

        .btn-cert {
          background: #ffffff;
          color: #0f172a;
          border: 2px solid #cbd5e1;
        }

        .btn-cert:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }

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
      </style>

      <article class="job-card" aria-labelledby="job-title-el" lang="${this.currentLang}">
        <div id="sr-alert" class="sr-only" role="status" aria-live="polite"></div>

        <header class="card-header">
          <div>
            <h3 class="job-title" id="job-title-el">${t.title}</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px;">
              <span class="company-pill">🏢 ${job.employer}</span>
              <span class="badge-type">📍 ${t.location}</span>
              <span class="badge-type">⏰ ${job.employmentType}</span>
            </div>
          </div>
        </header>

        <!-- Audio Summary Component -->
        <section class="audio-summary-box" aria-labelledby="audio-heading">
          <div class="audio-summary-header">
            <h4 id="audio-heading">🔊 ${t.audioTitle}</h4>
            <button type="button" class="btn-listen" id="btn-audio-listen" aria-label="${t.audioBtn}: ${t.title}">
              <span id="listen-icon">▶</span>
              <span id="listen-text">${t.audioBtn}</span>
            </button>
          </div>
          <p class="summary-text" id="summary-content">${t.summaryText}</p>
        </section>

        <!-- Key Requirements -->
        <section class="requirements-section" aria-labelledby="req-heading">
          <h4 id="req-heading">${t.reqTitle}</h4>
          <ul class="requirements-list">
            ${t.reqList.map((r) => `<li>${r}</li>`).join('')}
          </ul>
        </section>

        <!-- Accommodations Provided -->
        <section class="accommodations-box" aria-label="${t.accTitle}">
          <strong>🤝 ${t.accTitle}</strong>
          <p>${t.accText}</p>
        </section>

        <footer class="card-actions">
          <div class="deadline-text">
            <span>📅 ${t.deadlineTitle} <strong>${t.deadline}</strong></span>
          </div>
          <div class="action-buttons">
            <a href="${job.certificateUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-cert" aria-label="${t.certBtn}">
              <span>🎓</span> ${t.certBtn}
            </a>
            <a href="${job.applyUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-apply" aria-label="${t.applyBtn}: ${t.title}">
              <span>📝</span> ${t.applyBtn}
            </a>
          </div>
        </footer>
      </article>
    `;

    this.setupEventListeners(job, lang, t);
  }

  setupEventListeners(job, lang, t) {
    const listenBtn = this.shadowRoot.querySelector('#btn-audio-listen');
    const listenIcon = this.shadowRoot.querySelector('#listen-icon');
    const listenText = this.shadowRoot.querySelector('#listen-text');
    const srAlert = this.shadowRoot.querySelector('#sr-alert');

    const stopAudio = () => {
      if (this.speechSynth) this.speechSynth.cancel();
      this.isSpeaking = false;
      listenBtn.classList.remove('speaking');
      listenIcon.textContent = '▶';
      listenText.textContent = t.audioBtn;
      srAlert.textContent = lang === 'am' ? "የድምጽ ንባብ ቆሟል" : lang === 'om' ? "Sagaleen dhaabbateera." : lang === 'ti' ? "ድምጺ ኣቋሪጹ" : "Audio summary stopped.";
    };

    const startAudio = () => {
      if (!this.speechSynth) {
        srAlert.textContent = "Speech synthesis not supported on this browser.";
        return;
      }

      this.speechSynth.cancel();
      const textToSpeak = `${job.employer} - ${t.title}. ${t.summaryText}. ${t.accText}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      if (lang === 'am') utterance.lang = 'am-ET';
      else if (lang === 'ti') utterance.lang = 'ti-ET';
      else if (lang === 'om') utterance.lang = 'om-ET';
      else utterance.lang = 'en-US';
      utterance.rate = 1.0;

      utterance.onend = () => stopAudio();
      utterance.onerror = () => stopAudio();

      this.isSpeaking = true;
      listenBtn.classList.add('speaking');
      listenIcon.textContent = '⏹';
      listenText.textContent = t.audioStop;
      srAlert.textContent = lang === 'am' ? "የድምጽ ንባብ በመጫወት ላይ" : lang === 'om' ? "Gabaasni sagalee taphachaa jira." : lang === 'ti' ? "ድምጺ ይስማዕ ኣሎ" : "Playing audio summary.";
      this.speechSynth.speak(utterance);
    };

    listenBtn.addEventListener('click', () => {
      if (this.isSpeaking) {
        stopAudio();
      } else {
        startAudio();
      }
    });
  }
}

if (!customElements.get('db-jobcard')) {
  customElements.define('db-jobcard', DbJobCard);
}

