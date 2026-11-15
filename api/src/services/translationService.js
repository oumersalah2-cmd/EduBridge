const https = require('https');
const http = require('http');

/**
 * Supported target languages for automated translation pipeline
 */
const TARGET_LANGS = ['am', 'om', 'ti'];

/**
 * Educational vocabulary dictionary for offline/standalone fallback translation
 */
const OFFLINE_DICTIONARY_AM = {
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

const OFFLINE_DICTIONARY_OM = {
  'welcome to today\'s lesson': 'Baga gara barnoota har\'aatti nagaan dhuftan',
  'welcome to this accessible lesson': 'Baga gara barnoota qaqqabamaa kanaatti nagaan dhuftan',
  'welcome to this lesson': 'Baga gara barnoota kanaatti nagaan dhuftan',
  'today we will study software engineering': 'Har\'a injinarummaa sooftiweerii ni baranna',
  'today we will explore': 'Har\'a ni qoranna',
  'renewable energy': 'Anniisaa haaromfamuu',
  'solar energy': 'Anniisaa biiftuu (soolaarii)',
  'clean electricity': 'Elektiriikii qulqulluu',
  'photovoltaic cells': 'Seelota footoovooltaayikii',
  'software engineering': 'Injinarummaa sooftiweerii',
  'computer science': 'Saayinsii kompiitaraa',
  'mathematics': 'Herrega',
  'lesson': 'Barnoota',
  'thank you': 'Galatoomaa',
  'goodbye': 'Nagaatti',
  'hello': 'Akkam',
  'education': 'Barnoota',
  'learning': 'Baruu',
  'student': 'Barataa',
  'teacher': 'Barsiisaa',
  'school': 'Mana barumsaa',
  'university': 'Yuunivarsiitii',
  'summary': 'Cuunfaa'
};

const OFFLINE_DICTIONARY_TI = {
  'welcome to today\'s lesson': 'እንቋዕ ናብ ናይ ሎሚ ትምህርቲ ብደሓን መጻእኩም',
  'welcome to this accessible lesson': 'እንቋዕ ናብዚ ተበጻሒ ትምህርቲ ብደሓን መጻእኩም',
  'welcome to this lesson': 'እንቋዕ ናብዚ ትምህርቲ ብደሓን መጻእኩም',
  'today we will study software engineering': 'ሎሚ ናይ ሶፍትዌር ምህንድስና ከነጽንዕ ኢና',
  'today we will explore': 'ሎሚ ክንምርምር ኢና',
  'renewable energy': 'ዝሕደስ ሓይሊ',
  'solar energy': 'ናይ ፀሓይ ሓይሊ',
  'clean electricity': 'ጽሩይ ኤሌክትሪክ',
  'photovoltaic cells': 'ፎቶቮልታይክ ሴላት',
  'software engineering': 'ሶፍትዌር ምህንድስና',
  'computer science': 'ኮምፒውተር ሳይንስ',
  'mathematics': 'ሒሳብ',
  'lesson': 'ትምህርቲ',
  'thank you': 'የቐንየለይ',
  'goodbye': 'ደሓን ኩኑ',
  'hello': 'ሰላም',
  'education': 'ትምህርቲ',
  'learning': 'ምምሃር',
  'student': 'ተመሃራይ',
  'teacher': 'መምህር',
  'school': 'ቤት ትምህርቲ',
  'university': 'ዩኒቨርሲቲ',
  'summary': 'ጽማቚ'
};

const OFFLINE_DICTIONARY = OFFLINE_DICTIONARY_AM;

function getDictionaryForLang(lang) {
  if (lang === 'om') return OFFLINE_DICTIONARY_OM;
  if (lang === 'ti') return OFFLINE_DICTIONARY_TI;
  return OFFLINE_DICTIONARY_AM;
}

/**
 * Translates text from English to target language (Amharic 'am', Afaan Oromoo 'om', Tigrinya 'ti').
 * Uses online Google Translate GTX API with fast 4-second timeout,
 * and falls back gracefully to dictionary/transcription if offline.
 */
function translateText(text, targetLang = 'am', sourceLang = 'en') {
  if (!text || typeof text !== 'string') return Promise.resolve('');
  const clean = text.trim();
  if (!clean) return Promise.resolve('');

  return new Promise((resolve) => {
    const dict = getDictionaryForLang(targetLang);
    const lower = clean.toLowerCase();
    for (const [enKey, targetVal] of Object.entries(dict)) {
      if (lower === enKey) {
        return resolve(targetVal);
      }
    }

    const encoded = encodeURIComponent(clean);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encoded}`;

    const req = https.get(url, { timeout: 4000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(fallbackTranslate(clean, targetLang));
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
          resolve(fallbackTranslate(clean, targetLang));
        } catch (e) {
          resolve(fallbackTranslate(clean, targetLang));
        }
      });
    });

    req.on('error', () => resolve(fallbackTranslate(clean, targetLang)));
    req.on('timeout', () => {
      req.destroy();
      resolve(fallbackTranslate(clean, targetLang));
    });
  });
}

/**
 * Fallback translation when offline
 */
function fallbackTranslate(text, targetLang = 'am') {
  const dict = getDictionaryForLang(targetLang);
  let result = text;
  for (const [enKey, targetVal] of Object.entries(dict)) {
    const regex = new RegExp(`\\b${enKey}\\b`, 'gi');
    if (regex.test(result)) {
      result = result.replace(regex, targetVal);
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
  TARGET_LANGS,
  translateText,
  translateSegments,
  OFFLINE_DICTIONARY,
  OFFLINE_DICTIONARY_AM,
  OFFLINE_DICTIONARY_OM,
  OFFLINE_DICTIONARY_TI
};
