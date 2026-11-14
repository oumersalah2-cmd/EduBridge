const { getPublicBaseUrl } = require('../services/urlHelper');

function getMockJobs(req) {
  const base = getPublicBaseUrl(req);
  return [
    {
      id: 'job-eth-01',
      title: 'Junior Accessibility QA Tester',
      employer: 'Ethio Telecom Digital Innovation Hub',
      location: 'Addis Ababa, Ethiopia (Hybrid)',
      requirements: [
        'Basic understanding of screen readers (NVDA, TalkBack, Orca)',
        'Testing Web Content Accessibility Guidelines (WCAG 2.2 AA)',
        'Fluency in Amharic and working English'
      ],
      deadline: '2026-12-15T00:00:00.000Z',
      applyUrl: 'https://careers.ethiotelecom.et/accessibility-qa',
      applyLink: 'https://careers.ethiotelecom.et/accessibility-qa',
      certificateUrl: `${base}/api/v1/certificates/cert-eth-01/verify`,
      audioSummaryUrl: `${base}/uploads/jobs/job-eth-01-summary.mp3`,
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
      applyUrl: 'https://digitalbridge.et/jobs/web-dev',
      applyLink: 'https://digitalbridge.et/jobs/web-dev',
      certificateUrl: `${base}/api/v1/certificates/cert-eth-02/verify`,
      audioSummaryUrl: `${base}/uploads/jobs/job-eth-02-summary.mp3`,
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
      applyUrl: 'https://aau.edu.et/careers/caption-reviewer',
      applyLink: 'https://aau.edu.et/careers/caption-reviewer',
      certificateUrl: `${base}/api/v1/certificates/cert-eth-03/verify`,
      audioSummaryUrl: `${base}/uploads/jobs/job-eth-03-summary.mp3`,
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
}

function getMockPublicVideo(id = 'mock-video-demo-01', req) {
  const base = getPublicBaseUrl(req);
  return {
    id,
    title: 'Introduction to Renewable Solar Cells (Demo)',
    status: 'published',
    videoUrl: `${base}/assets/demo/demo_lesson_sign.mp4`,
    audioUrl: `${base}/assets/demo/demo_lesson_64k.mp3`,
    signVideoUrl: `${base}/assets/demo/demo_lesson_sign.mp4`,
    audioDescriptionUrl: null,
    captions: {
      en: {
        url: `${base}/assets/demo/demo_lesson_en.vtt`,
        reviewStatus: 'human-reviewed'
      },
      am: {
        url: `${base}/assets/demo/demo_lesson_am.vtt`,
        reviewStatus: 'machine-generated'
      }
    },
    transcript: 'Welcome to this accessible lesson on renewable energy. Today we will explore solar photovoltaic cells and how they generate clean electricity. Notice how sunlight frees electrons in the semiconductor material.',
    chatLog: [],
    offlinePackUrl: `${base}/api/public/videos/${id}/offlinepack`,
    brailleUrl: `${base}/assets/demo/demo_lesson.brf`
  };
}

// Map to track progress of mock videos created in this runtime
const mockVideoProgressTracker = new Map();

function getMockVideoProgress(id) {
  if (id === 'mock-video-demo-01') {
    return {
      id,
      status: 'review',
      progress: 100,
      step: 'Transcription complete. Human review ready.',
      error: null
    };
  }

  let record = mockVideoProgressTracker.get(id);
  if (!record) {
    record = { createdAt: Date.now() };
    mockVideoProgressTracker.set(id, record);
  }

  const elapsedSec = (Date.now() - record.createdAt) / 1000;

  if (elapsedSec < 3) {
    return {
      id,
      status: 'uploaded',
      progress: 10,
      step: 'Video uploaded. Queued for audio extraction.',
      error: null
    };
  } else if (elapsedSec < 7) {
    return {
      id,
      status: 'processing',
      progress: 40,
      step: 'Extracting 16 kHz audio for transcription',
      error: null
    };
  } else if (elapsedSec < 12) {
    return {
      id,
      status: 'processing',
      progress: 75,
      step: 'Writing English captions with Whisper',
      error: null
    };
  } else {
    return {
      id,
      status: 'review',
      progress: 100,
      step: 'Transcription complete. Human review ready.',
      error: null
    };
  }
}

function registerMockVideo(id) {
  mockVideoProgressTracker.set(id, { createdAt: Date.now() });
}

module.exports = {
  getMockJobs,
  getMockPublicVideo,
  getMockVideoProgress,
  registerMockVideo
};
