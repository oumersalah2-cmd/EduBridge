const https = require('https');
const http = require('http');

/**
 * Educational vocabulary dictionary for offline/standalone fallback translation
 */
const OFFLINE_DICTIONARY = {
  'welcome to today\'s lesson': 'እንኳን ወደ ዛሬው ትምህርት በደህና መጡ',
  'welcome to this accessible lesson': 'እንኳን ወደዚህ ተደራሽ ትምህርት በደህና መጡ',
  'welcome to this lesson': 'እንኳን ወደዚህ ትምህርት በደህና መጡ',
  'today we will study software engineering': 'ዛሬ የሶፍትዌር ምህንድስናን እናጠናለን',
  'today we will explore': 'ዛሬ እንመረምራለን',
  'renewable energy': 'ታዳሽ ኃይል',
  'solar energy': 'የፀሐይ ኃይል',
  'clean electricity': 'ንጹህ ኤሌክትሪክ',
  'photovoltaic cells': 'የፎቶቮልታይክ ሴሎች',
  'software engineering': 'የሶፍትዌር ምህንድስና',
  'computer science': 'የኮምፒውተር ሳይንስ',
  'mathematics': 'ሒሳብ',
  'lesson': 'ትምህርት',
  'thank you': 'እናመሰግናለን',
  'goodbye': 'ደህና ሁኑ',
  'hello': 'ሰላም',
  'education': 'ትምህርት',
  'learning': 'መማር',
  'student': 'ተማሪ',
  'teacher': 'አስተማሪ',
  'school': 'ትምህርት ቤት',
  'university': 'ዩኒቨርሲቲ',
  'summary': 'ማጠቃለያ'
};

/**
 * Translates text from English to Amharic.
 * Uses online Google Translate GTX API with fast 3-second timeout,
 * and falls back gracefully to dictionary/transcription if offline.
 */
function translateText(text, targetLang = 'am', sourceLang = 'en') {
  if (!text || typeof text !== 'string') return Promise.resolve('');
  const clean = text.trim();
  if (!clean) return Promise.resolve('');

  return new Promise((resolve) => {
    // Check if offline dictionary has an exact phrase match
    const lower = clean.toLowerCase();
    for (const [enKey, amVal] of Object.entries(OFFLINE_DICTIONARY)) {
      if (lower === enKey) {
        return resolve(amVal);
      }
    }

    const encoded = encodeURIComponent(clean);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encoded}`;

    const req = https.get(url, { timeout: 4000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(fallbackTranslate(clean));
      }

      let rawData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
            const translated = parsed[0].map((item) => (item && item[0]) || '').join('').trim();
            if (translated) {
              return resolve(translated);
            }
          }
          resolve(fallbackTranslate(clean));
        } catch (e) {
          resolve(fallbackTranslate(clean));
        }
      });
    });

    req.on('error', () => resolve(fallbackTranslate(clean)));
    req.on('timeout', () => {
      req.destroy();
      resolve(fallbackTranslate(clean));
    });
  });
}

/**
 * Fallback translation when offline
 */
function fallbackTranslate(text) {
  let result = text;
  for (const [enKey, amVal] of Object.entries(OFFLINE_DICTIONARY)) {
    const regex = new RegExp(`\\b${enKey}\\b`, 'gi');
    if (regex.test(result)) {
      result = result.replace(regex, amVal);
    }
  }
  return result;
}

/**
 * Translates segments while strictly preserving start and end timestamps.
 */
async function translateSegments(segments, targetLang = 'am', sourceLang = 'en') {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const translatedSegments = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    try {
      const translatedText = await translateText(seg.text || '', targetLang, sourceLang);
      translatedSegments.push({
        start: seg.start,
        end: seg.end,
        text: translatedText || seg.text || ''
      });
    } catch (e) {
      translatedSegments.push({
        start: seg.start,
        end: seg.end,
        text: seg.text || ''
      });
    }
  }

  return translatedSegments;
}

module.exports = {
  translateText,
  translateSegments,
  OFFLINE_DICTIONARY
};

