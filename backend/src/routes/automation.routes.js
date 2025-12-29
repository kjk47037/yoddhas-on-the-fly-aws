const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');
const contentService = require('../services/content.service');

// Initialize Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const router = express.Router();

// Helpers
function computeNextRunAt(schedule) {
  try {
    const { recurrenceType, hour, minute, timezone, daysOfWeek = [], cronExpression } = schedule;
    const now = new Date();
    // For simplicity, we compute in local server time and store ISO; timezone can be applied later if needed
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (recurrenceType === 'daily') {
      next.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }

    if (recurrenceType === 'weekly') {
      // daysOfWeek like ['Mon','Tue',...] map to indices 1..7 (Mon..Sun)
      const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const targetDays = daysOfWeek.map(d => map[d]).filter(v => v !== undefined);
      if (targetDays.length === 0) {
        // fallback daily
        next.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        return next.toISOString();
      }
      const currentDay = now.getDay();
      next.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
      let addDays = 0;
      while (true) {
        const candidate = new Date(next);
        candidate.setDate(now.getDate() + addDays);
        if (targetDays.includes(candidate.getDay()) && candidate > now) {
          return candidate.toISOString();
        }
        addDays += 1;
        if (addDays > 14) {
          // safety
          const fallback = new Date(now);
          fallback.setDate(now.getDate() + 1);
          fallback.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
          return fallback.toISOString();
        }
      }
    }

    if (recurrenceType === 'custom' && cronExpression) {
      // Minimal fallback: run next day at hour/minute
      const fallback = new Date(now);
      fallback.setDate(now.getDate() + 1);
      fallback.setHours(Number(hour) || 9, Number(minute) || 0, 0, 0);
      return fallback.toISOString();
    }

    // default daily 9:00
    next.setHours(9, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  } catch (e) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
}

function normalizeForHash(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function hashText(text) {
  return crypto.createHash('sha256').update(normalizeForHash(text)).digest('hex');
}

async function generateTweetTextFromSchedule(schedule) {
  const topic = schedule.topic || '';
  const tone = schedule?.style?.tone || 'mixed';
  const instructions = (schedule.instructions || '').trim();
  const maxHashtags = typeof schedule?.style?.maxHashtags === 'number' ? schedule.style.maxHashtags : 1;
  const noLinks = !!schedule?.style?.noLinks;

  const constraints = [
    'Keep <= 240 chars target (hard cap 280).',
    `Use at most ${maxHashtags} relevant hashtag(s).`,
    noLinks ? 'Do not include any links.' : 'Avoid links unless essential.',
    'Avoid clichés; no threads; no quotes.'
  ].join(' ');

  const baseStyle = tone === 'humor' ? 'Make it witty and light.' : tone === 'insight' ? 'Make it concise and insightful.' : 'Balance wit and insight.';
  const extra = instructions ? `Follow these additional instructions: ${instructions}` : '';
  const prompt = `Write a short social post about: ${topic}. ${baseStyle} ${constraints} ${extra}`;

  // Call existing content service
  const result = await contentService.generateContent(prompt, 'social', undefined, null);
  // Try to extract text from result
  if (typeof result === 'string') return result;
  if (result && typeof result.content === 'string') return result.content;
  if (result && typeof result.text === 'string') return result.text;
  if (Array.isArray(result) && result[0]) {
    if (typeof result[0] === 'string') return result[0];
    if (typeof result[0].content === 'string') return result[0].content;
  }
  // Fallback: stringify
  return String(result || '').slice(0, 280);
}

async function postTextViaFlask(text) {
  const url = 'http://localhost:5004/api/tweet-text';
  const resp = await axios.post(url, { text });
  return resp.data;
}

async function runScheduleOnce(scheduleId, scheduleDoc) {
  const schedule = scheduleDoc || (await db.collection('auto_tweet_schedules').doc(scheduleId).get()).data();
  if (!schedule) throw new Error('Schedule not found');

  // Generate text
  let text = await generateTweetTextFromSchedule(schedule);
  if (!text || typeof text !== 'string') throw new Error('No text generated');
  // Enforce length
  if (text.length > 280) text = text.slice(0, 277) + '...';

  // Dedupe
  const existingHashes = Array.isArray(schedule.dedupeHashes) ? schedule.dedupeHashes : [];
  const textHash = hashText(text);
  if (existingHashes.includes(textHash)) {
    // Try regenerate once
    const retry = await generateTweetTextFromSchedule(schedule);
    const retryHash = hashText(retry);
    if (existingHashes.includes(retryHash)) {
      throw new Error('Duplicate content detected');
    }
    text = retry;
  }

  // Post via Flask
  const postResult = await postTextViaFlask(text);
  const tweetId = postResult?.tweet_id;
  if (!tweetId) throw new Error(postResult?.message || 'Tweet failed');

  const nowIso = new Date().toISOString();
  const nextRunAt = computeNextRunAt(schedule);

  // Save run record
  const runData = {
    scheduleId,
    userId: schedule.userId || null,
    campaignId: schedule.campaignId || null,
    timestamp: nowIso,
    text,
    tweetId,
    success: true,
    error: null
  };
  await db.collection('auto_tweet_runs').add(runData);

  // Update schedule
  const updatedHashes = [textHash, ...existingHashes].slice(0, 50);
  await db.collection('auto_tweet_schedules').doc(scheduleId).update({
    lastRunAt: nowIso,
    nextRunAt,
    dedupeHashes: updatedHashes,
    updatedAt: nowIso
  });

  return { tweetId, text, nextRunAt };
}

// Convert draft to live schedule linked to campaign
router.post('/convert-draft', async (req, res) => {
  try {
    const { userId, builderSessionId, campaignId } = req.body || {};
    if (!userId || !builderSessionId || !campaignId) {
      return res.status(400).json({ error: 'userId, builderSessionId, and campaignId are required' });
    }
    const draftId = `${userId}_${builderSessionId}`;
    const draftRef = db.collection('draft_schedules').doc(draftId);
    const draftSnap = await draftRef.get();
    if (!draftSnap.exists) {
      return res.json({ message: 'No draft found; skipping', created: false });
    }
    const draft = draftSnap.data();

    const nowIso = new Date().toISOString();
    const schedule = {
      userId,
      campaignId,
      topic: draft.topic || '',
      instructions: draft.instructions || '',
      recurrenceType: draft.recurrenceType || 'daily',
      hour: draft.hour ?? 9,
      minute: draft.minute ?? 0,
      timezone: draft.timezone || 'UTC',
      daysOfWeek: Array.isArray(draft.daysOfWeek) ? draft.daysOfWeek : [],
      cronExpression: draft.cronExpression || null,
      style: draft.style || { tone: 'mixed', maxHashtags: 1, noLinks: true },
      isEnabled: !!draft.isEnabled,
      lastRunAt: null,
      nextRunAt: computeNextRunAt(draft),
      dedupeHashes: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const docRef = await db.collection('auto_tweet_schedules').add(schedule);
    // Optionally archive or delete draft
    await draftRef.delete();

    return res.json({ created: true, scheduleId: docRef.id, nextRunAt: schedule.nextRunAt });
  } catch (e) {
    console.error('convert-draft error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Run once now for a schedule
router.post('/run-now/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const result = await runScheduleOnce(scheduleId);
    return res.json({ status: 'ok', ...result });
  } catch (e) {
    console.error('run-now error', e);
    return res.status(400).json({ status: 'error', error: e.message || 'Run failed' });
  }
});

// Status of a schedule (next/last)
router.get('/status/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const snap = await db.collection('auto_tweet_schedules').doc(scheduleId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const schedule = snap.data();

    const runsSnap = await db.collection('auto_tweet_runs')
      .where('scheduleId', '==', scheduleId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    let last = null;
    runsSnap.forEach(doc => last = doc.data());

    return res.json({
      schedule: {
        isEnabled: !!schedule.isEnabled,
        nextRunAt: schedule.nextRunAt || null,
        lastRunAt: schedule.lastRunAt || null,
        topic: schedule.topic || '',
        recurrenceType: schedule.recurrenceType || 'daily',
        timezone: schedule.timezone || 'UTC'
      },
      last
    });
  } catch (e) {
    console.error('status error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// History
router.get('/history/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
    const snap = await db.collection('auto_tweet_runs')
      .where('scheduleId', '==', scheduleId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const items = [];
    snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    return res.json({ items });
  } catch (e) {
    console.error('history error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Get schedule by campaignId (for Dashboard view)
router.get('/by-campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    if (!campaignId) return res.status(400).json({ error: 'campaignId required' });
    const snap = await db.collection('auto_tweet_schedules')
      .where('campaignId', '==', campaignId)
      .limit(1)
      .get();
    if (snap.empty) return res.json({ found: false });
    const docRef = snap.docs[0];
    return res.json({ found: true, scheduleId: docRef.id, schedule: docRef.data() });
  } catch (e) {
    console.error('by-campaign error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Cron runner (secured)
router.post('/run-due', async (req, res) => {
  try {
    const token = req.headers['x-runner-token'];
    if (!token || token !== process.env.RUNNER_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

    const results = [];
    for (const item of due) {
      try {
        const result = await runScheduleOnce(item.id, item.data);
        results.push({ scheduleId: item.id, ok: true, tweetId: result.tweetId });
      } catch (err) {
        console.error('run-due item error', item.id, err.message);
        results.push({ scheduleId: item.id, ok: false, error: err.message });
      }
    }

    return res.json({ count: due.length, results });
  } catch (e) {
    console.error('run-due error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

module.exports = router; 