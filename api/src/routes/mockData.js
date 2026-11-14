/**
 * Realistic mock data conforming to OpenAPI 3.0 contract.
 * Allows teammates (Member 2 Studio and Member 3 Player) to develop against exact shapes.
 */

const mockJobs = [
  {
    id: 'job-eth-01',
    title: 'Junior Accessibility QA Tester',
    employer: 'Ethio Telecom Digital Innovation Hub',
    location: 'Addis Ababa, Ethiopia (Hybrid)',
    requirements: [
      'Basic understanding of screen readers (NVDA, TalkBack, Orca)',
      'Familiarity with Web Content Accessibility Guidelines (WCAG 2.2 AA)',
      'Fluency in Amharic and working English'
    ],
    deadline: '2026-12-15T00:00:00.000Z',
    applyLink: 'https://careers.ethiotelecom.et/accessibility-qa',
    certificateUrl: '/uploads/certs/accessible-qa-spec.pdf',
    audioSummaryUrl: '/uploads/jobs/job-eth-01-summary.mp3',
    textSummary: 'Entry-level position testing telecom mobile applications for screen reader accessibility and low-bandwidth resilience.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      'title': 'Junior Accessibility QA Tester',
      'hiringOrganization': {
        '@type': 'Organization',
        'name': 'Ethio Telecom Digital Innovation Hub'
      },
      'jobLocation': {
        '@type': 'Place',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Addis Ababa',
          'addressCountry': 'ET'
        }
      },
      'description': 'Entry-level position testing telecom mobile applications for screen reader accessibility and low-bandwidth resilience.',
      'validThrough': '2026-12-15T00:00:00.000Z',
      'employmentType': 'FULL_TIME'
    }
  },
  {
    id: 'job-eth-02',
    title: 'Low-Bandwidth Web Developer (Offline-First)',
    employer: 'Digital Bridge Initiative Ethiopia',
    location: 'Hawassa, Ethiopia (On-site / Remote)',
    requirements: [
      'Proficiency in vanilla HTML5, CSS3, and JavaScript (zero runtime frameworks)',
      'Experience optimizing web media for 2G/3G low-data connections',
      'Knowledge of WebVTT and semantic landmarks'
    ],
    deadline: '2026-12-30T00:00:00.000Z',
    applyLink: 'https://digitalbridge.et/jobs/web-dev',
    certificateUrl: '/uploads/certs/offline-first-cert.pdf',
    audioSummaryUrl: '/uploads/jobs/job-eth-02-summary.mp3',
    textSummary: 'Develop zero-dependency offline web applications delivering accessible multimedia to rural schools.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      'title': 'Low-Bandwidth Web Developer (Offline-First)',
      'hiringOrganization': {
        '@type': 'Organization',
        'name': 'Digital Bridge Initiative Ethiopia'
      },
      'jobLocation': {
        '@type': 'Place',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Hawassa',
          'addressCountry': 'ET'
        }
      },
      'description': 'Develop zero-dependency offline web applications delivering accessible multimedia to rural schools.',
      'validThrough': '2026-12-30T00:00:00.000Z',
      'employmentType': 'CONTRACTOR'
    }
  },
  {
    id: 'job-eth-03',
    title: 'Bilingual Audio & Caption Proofreader (Amharic/English)',
    employer: 'Addis Ababa University eLearning Center',
    location: 'Addis Ababa, Ethiopia',
    requirements: [
      'Native or fluent proficiency in Amharic (Ethiopic script) and professional English',
      'Attention to detail in reviewing auto-generated captions for academic STEM terms',
      'Basic knowledge of Braille translation conventions is a plus'
    ],
    deadline: '2026-12-20T00:00:00.000Z',
    applyLink: 'https://aau.edu.et/careers/caption-reviewer',
    certificateUrl: '/uploads/certs/captioning-badge.pdf',
    audioSummaryUrl: '/uploads/jobs/job-eth-03-summary.mp3',
    textSummary: 'Review and approve educational video captions, audio descriptions, and transcripts for university lectures.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      'title': 'Bilingual Audio & Caption Proofreader (Amharic/English)',
      'hiringOrganization': {
        '@type': 'Organization',
        'name': 'Addis Ababa University eLearning Center'
      },
      'jobLocation': {
        '@type': 'Place',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Addis Ababa',
          'addressCountry': 'ET'
        }
      },
      'description': 'Review and approve educational video captions, audio descriptions, and transcripts for university lectures.',
      'validThrough': '2026-12-20T00:00:00.000Z',
      'employmentType': 'PART_TIME'
    }
  }
];

const mockVideo = {
  id: 'mock-video-demo-01',
  title: 'Introduction to Renewable Solar Cells (Demo)',
  status: 'review',
  progress: 100,
  step: 'Transcription complete. Human review ready.',
  audioUrl: '/uploads/audio/demo_lesson_64k.mp3',
  signVideoUrl: '/uploads/sign/demo_lesson_sign.mp4',
  captions: {
    en: {
      url: '/uploads/captions/demo_lesson_en.vtt',
      status: 'human-reviewed'
    },
    am: {
      url: '/uploads/captions/demo_lesson_am.vtt',
      status: 'machine-generated'
    }
  },
  transcriptText: 'Welcome to this introductory lesson on solar photovoltaic cells and accessible renewable technology.',
  chatLog: [
    {
      id: 'chat-01',
      type: 'board',
      text: 'Lesson Goal: Understand the basic photovoltaic effect and semiconductor bandgaps.',
      ts: 1700000000000
    },
    {
      id: 'chat-02',
      type: 'question',
      text: 'How does silicon efficiency compare on cloudy days?',
      ts: 1700000060000
    }
  ],
  offlinePackUrl: '/api/public/videos/mock-video-demo-01/offlinepack',
  brailleUrl: '/uploads/braille/demo_lesson.brf'
};

module.exports = {
  mockJobs,
  mockVideo
};
