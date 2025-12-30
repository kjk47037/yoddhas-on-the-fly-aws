/*
  Self-contained runner for GitHub Actions.
  - Reads due schedules from Firestore
  - Generates text (uses Gemini if available, else content.service, else fallback)
  - Posts via twitter-api-v2
  - Writes run record and updates nextRunAt
*/

const admin = require('firebase-admin');
const { TwitterApi } = require('twitter-api-v2');
const crypto = require('crypto');
const { GoogleGenAI } = require('@google/genai');

// Try to import content service for generation
let contentService = null;
try {
  contentService = require('../src/services/content.service');
} catch (_) {}

function normalizeForHash(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function hashText(text) {
  return crypto.createHash('sha256').update(normalizeForHash(text)).digest('hex');
}

function computeNextRunAt(schedule) {
  try {
    const { recurrenceType, hour, minute, timezone, daysOfWeek = [], cronExpression } = schedule;
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (recurrenceType === 'daily') {
      next.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }

    if (recurrenceType === 'weekly') {
      const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const targetDays = (daysOfWeek || []).map(d => map[d]).filter(v => v !== undefined);
      if (targetDays.length === 0) {
        next.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        return next.toISOString();
      }
      next.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
      for (let add = 0; add < 14; add++) {
        const candidate = new Date(next);
        candidate.setDate(now.getDate() + add);
        if (targetDays.includes(candidate.getDay()) && candidate > now) {
          return candidate.toISOString();
        }
      }
      const fallback = new Date(now);
      fallback.setDate(now.getDate() + 1);
      fallback.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
      return fallback.toISOString();
    }

    if (recurrenceType === 'custom' && cronExpression) {
      // Minimal fallback: next day same time
      const fallback = new Date(now);
      fallback.setDate(now.getDate() + 1);
      fallback.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
      return fallback.toISOString();
    }

    next.setHours(9, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  } catch (e) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
}

// --- New helpers for topic rotation and similarity ---
function parseTopics(topicString) {
  return String(topicString || '')
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

async function fetchRecentRunTexts(db, scheduleId, limit = 10) {
  try {
    const snap = await db.collection('auto_tweet_runs')
      .where('scheduleId', '==', scheduleId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    const texts = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (typeof d?.text === 'string') texts.push(d.text);
    });
    return texts;
  } catch (e) {
    console.warn('Could not fetch recent runs for similarity check:', e.message);
    return [];
  }
}

function pickTopic(topics, recentTexts) {
  if (!Array.isArray(topics) || topics.length === 0) return null;
  const counts = new Map();
  for (const t of topics) counts.set(t, 0);
  const lowerTexts = recentTexts.map(t => t.toLowerCase());
  for (const t of topics) {
    const tl = t.toLowerCase();
    for (const rt of lowerTexts) {
      if (rt.includes(tl)) counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  const minCount = Math.min(...Array.from(counts.values()));
  const candidates = topics.filter(t => counts.get(t) === minCount);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function normalizeForWords(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(a, b) {
  const setA = new Set(normalizeForWords(a));
  const setB = new Set(normalizeForWords(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}
// --- End helpers ---

async function generateWithGemini(apiKey, prompt) {
  // Using Google GenAI SDK with gemini-2.5-flash model
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash';

  try {
    console.log('Attempting Gemini generation...');
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });

    let extractedText = response.text;

    if (!extractedText) {
      console.error('Gemini returned no text');
      throw new Error('No text in Gemini response');
    }

    // Clean up: remove any quotes wrapping the entire response
    extractedText = extractedText.trim();
    if ((extractedText.startsWith('"') && extractedText.endsWith('"')) ||
        (extractedText.startsWith("'") && extractedText.endsWith("'"))) {
      extractedText = extractedText.slice(1, -1).trim();
    }

    console.log('Gemini generation successful, length:', extractedText.length);
    return extractedText;
  } catch (e) {
    console.error('Gemini API error:', {
      message: e.message,
    });
    throw e; // Re-throw to try next generator
  }
}

async function generateText(db, scheduleId, schedule) {
  const topic = schedule.topic || '';
  const tone = schedule?.style?.tone || 'mixed';
  const instructions = (schedule.instructions || '').trim();
  const maxHashtags = typeof schedule?.style?.maxHashtags === 'number' ? schedule.style.maxHashtags : 1;
  const noLinks = !!schedule?.style?.noLinks;

  const topics = parseTopics(topic);
  const recentTexts = await fetchRecentRunTexts(db, scheduleId, 10);
  const chosenTopic = pickTopic(topics, recentTexts) || (topics[0] || 'tech');

  const constraints = [
    'MANDATORY: Your response MUST be under 230 characters total. Count characters carefully. Be concise and dont sound like a robot. Tweets should sound as they are coming from a tech savvy human. I like simple tweets.',
    `Use at most ${maxHashtags} relevant hashtag(s).`,
    noLinks ? 'Do not include any links.' : 'Avoid links unless essential.',
    'Write a single complete, engaging tweet that fits in exactly one tweet (under 230 chars). No cutting off.'
  ].join(' ');
  const baseStyle = tone === 'humor' ? 'Make it witty and light.' : tone === 'insight' ? 'Make it concise and insightful.' : 'Balance wit and insight.';
  const extra = instructions ? `Follow these additional instructions: ${instructions}` : '';

  let prompt = `Write a short social post about: ${chosenTopic}. ${baseStyle} ${constraints} ${extra}`;

  // 1) Gemini if key present
  const gemKey = process.env.GEMINI_API_KEY;
  if (gemKey) {
    try {
      const text = await generateWithGemini(gemKey, prompt);
      if (text) {
        // Similarity check; retry once if too similar
        const tooSimilar = recentTexts.some(t => jaccardSimilarity(t, text) >= 0.75);
        if (!tooSimilar) return text;
        const hint = recentTexts[0] ? recentTexts[0].slice(0, 100) : '';
        const retryPrompt = `${prompt} Take a completely different angle than this: \n${hint}`;
        const retryText = await generateWithGemini(gemKey, retryPrompt);
        return retryText || text;
      }
    } catch (e) {
      console.warn('Gemini generation failed:', e.message);
    }
  } else {
    console.warn('No GEMINI_API_KEY set, skipping Gemini generation');
  }

  // 2) Try content service
  if (contentService && contentService.generateContent) {
    try {
      console.log('Attempting HuggingFace generation...');
      const result = await contentService.generateContent(prompt, 'social', undefined, null);
      let hfText = null;
      if (typeof result === 'string') hfText = result;
      else if (result && typeof result.content === 'string') hfText = result.content;
      else if (result && typeof result.text === 'string') hfText = result.text;
      else if (Array.isArray(result) && result[0]) {
        if (typeof result[0] === 'string') hfText = result[0];
        else if (typeof result[0].content === 'string') hfText = result[0].content;
      }
      if (hfText) {
        const tooSimilar = recentTexts.some(t => jaccardSimilarity(t, hfText) >= 0.75);
        if (!tooSimilar) return hfText;
        const hint = recentTexts[0] ? recentTexts[0].slice(0, 100) : '';
        const regen = await contentService.generateContent(`${prompt} Take a completely different angle than this: \n${hint}`, 'social', undefined, null);
        let regenText = null;
        if (typeof regen === 'string') regenText = regen;
        else if (regen && typeof regen.content === 'string') regenText = regen.content;
        else if (regen && typeof regen.text === 'string') regenText = regen.text;
        return regenText || hfText;
      }
      console.warn('ContentService returned unexpected format:', result);
    } catch (e) {
      console.warn('ContentService generation failed:', e.message);
    }
  } else {
    console.warn('ContentService not available');
  }

  // If we get here, both generators failed
  console.error('WARNING: All generators failed, using emergency fallback!');
  console.error('Please check your GEMINI_API_KEY or HUGGINGFACE_API_KEY1 are set correctly');

  // Emergency fallback - pick a topic not recently used if possible
  const fallbackTopic = chosenTopic;
  return `[TEST POST - Generator Failed] Quick thought about ${fallbackTopic}`;
}

async function main() {
  // Init Firestore
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.error('FIREBASE_SERVICE_ACCOUNT is not set');
    process.exit(1);
  }
  const creds = JSON.parse(svc);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(creds) });
  }
  const db = admin.firestore();

  // Init Twitter
  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;
  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    console.error('Twitter credentials missing in env');
    process.exit(1);
  }
  const twitter = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });

  const nowIso = new Date().toISOString();
  const enabledSnap = await db.collection('auto_tweet_schedules')
    .where('isEnabled', '==', true)
    .get();

  const due = [];
  enabledSnap.forEach(doc => {
    const data = doc.data();
    if (data.nextRunAt && data.nextRunAt <= nowIso) {
      due.push({ id: doc.id, data });
    }
  });

  console.log(`Found ${due.length} due schedule(s)`);
  const results = [];
  for (const item of due) {
    const { id: scheduleId, data: schedule } = item;
    try {
      let text = await generateText(db, scheduleId, schedule);
      if (!text || typeof text !== 'string') throw new Error('No text generated');
      
      // Check if text appears cut off (ends mid-word or mid-sentence without punctuation)
      const endsClean = /[.!?)\]"']$/.test(text.trim());
      if (text.length > 280 || (!endsClean && text.length > 250)) {
        // Try to find a natural break point
        let truncated = text.slice(0, 277);
        const lastPunct = Math.max(
          truncated.lastIndexOf('.'),
          truncated.lastIndexOf('!'),
          truncated.lastIndexOf('?')
        );
        if (lastPunct > 150) {
          text = truncated.slice(0, lastPunct + 1);
        } else if (text.length > 280) {
          text = truncated + '...';
        }
      }

      const existingHashes = Array.isArray(schedule.dedupeHashes) ? schedule.dedupeHashes : [];
      const textHash = hashText(text);
      if (existingHashes.includes(textHash)) {
        const retry = await generateText(db, scheduleId, schedule);
        const retryHash = hashText(retry);
        if (existingHashes.includes(retryHash)) throw new Error('Duplicate content detected');
        text = retry;
      }

      const tweetResp = await twitter.v2.tweet(text);
      const tweetId = tweetResp?.data?.id;
      if (!tweetId) throw new Error('Tweet failed');

      const nowIsoRun = new Date().toISOString();
      const nextRunAt = computeNextRunAt(schedule);

      await db.collection('auto_tweet_runs').add({
        scheduleId,
        userId: schedule.userId || null,
        campaignId: schedule.campaignId || null,
        timestamp: nowIsoRun,
        text,
        tweetId,
        success: true,
        error: null
      });

      const updatedHashes = [hashText(text), ...existingHashes].slice(0, 50);
      await db.collection('auto_tweet_schedules').doc(scheduleId).update({
        lastRunAt: nowIsoRun,
        nextRunAt,
        dedupeHashes: updatedHashes,
        updatedAt: nowIsoRun
      });

      results.push({ scheduleId, ok: true, tweetId });
      console.log(`Posted tweet for schedule ${scheduleId}: ${tweetId}`);
    } catch (e) {
      results.push({ scheduleId: item.id, ok: false, error: e.message });
      console.error(`Error for schedule ${item.id}:`, e.message);
    }
  }

  console.log(JSON.stringify({ count: due.length, results }, null, 2));
}

main().catch(err => {
  console.error('Runner error:', err);
  process.exit(1);
}); 
 