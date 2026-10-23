'use strict';
const { parsePage, extractRecord } = require('./parser');

const RE = /^(?:https?:\/\/)?(?:(?:www\.)?(?:t|telegram)\.me\/(?:s\/)?|@)?([A-Za-z][A-Za-z0-9_]{3,31})(?:\/\d+)?\/?(?:\?.*)?$/;
function parseChannel(input) {
  const m = String(input || '').trim().match(RE);
  return m ? m[1] : null;
}
// چند کانال با ویرگول، فاصله یا خط جدید جدا می‌شوند (حداکثر ۵ کانال)
function parseChannels(input) {
  const parts = String(input || '').split(/[\s,،;]+/).filter(Boolean);
  const names = [], bad = [];
  for (const p of parts) { const n = parseChannel(p); if (n) { if (!names.includes(n)) names.push(n); } else bad.push(p); }
  return { names: names.slice(0, 5), bad };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = new Map(); // key -> {at, data}
const TTL = 5 * 60 * 1000;

async function fetchPage(name, before) {
  const url = `https://t.me/s/${name}` + (before ? `?before=${before}` : '');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bourse-watchlist/1.0)', 'Accept-Language': 'fa,en' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`تلگرام پاسخ ${res.status} داد`);
  return res.text();
}

const MAX_DATE_PAGES = 30; // سقف پیش‌فرض صفحه وقتی بازه‌ی تاریخ مشخص است (~۶۰۰ پست)

function parseDay(str, endOfDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str || '')) return null;
  const t = Date.parse(str + (endOfDay ? 'T23:59:59Z' : 'T00:00:00Z'));
  return Number.isNaN(t) ? null : t;
}

// آیا زمان پست داخل بازه است؟ پست بدون تاریخ همیشه داخل بازه حساب می‌شود.
function inRange(ts, from, to) {
  if (ts == null) return true;
  if (to != null && ts > to) return false;
  if (from != null && ts < from) return false;
  return true;
}

// همه‌ی گزارش‌های مالی (نه فقط جدیدترین هر نماد) و همه‌ی ذکرهای هشتگی داخل بازه را برمی‌گرداند.
async function fetchChannel(name, opts = {}) {
  const from = parseDay(opts.from, false);
  const to = parseDay(opts.to, true);
  const cap = Math.max(1, Math.min(200, Math.floor(opts.maxPages) || MAX_DATE_PAGES));
  const limit = from != null ? cap : Math.max(1, Math.min(15, Math.floor(opts.pages) || 3));
  const key = `${name}|${limit}|${opts.from || ''}|${opts.to || ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { ...hit.data, cached: true };

  const reports = [], mentions = [];
  let before = null, scanned = 0, usedPages = 0, reachedStart = false, endOfChannel = false;
  for (let i = 0; i < limit; i++) {
    const html = await fetchPage(name, before);
    const { posts, minId } = parsePage(html);
    if (!posts.length && !minId) {
      if (i === 0) throw new Error('پستی پیدا نشد. کانال باید عمومی باشد و پیش‌نمایش وب (t.me/s/…) داشته باشد.');
      endOfChannel = true;
      break;
    }
    usedPages++;
    let oldest = Infinity;
    for (const p of posts) {
      const ts = p.date ? Date.parse(p.date) : null;
      if (ts != null) oldest = Math.min(oldest, ts);
      if (!inRange(ts, from, to)) continue;
      scanned++;
      for (const t of p.tags || []) mentions.push([t, p.date]);
      const r = extractRecord(p);
      if (r) reports.push({ ...r, channel: name });
    }
    if (from != null && oldest < from) { reachedStart = true; break; }
    if (!minId || minId === before) { endOfChannel = true; break; }
    before = minId;
    if (i < limit - 1) await sleep(400);
  }
  const data = {
    channel: name, scanned, pages: usedPages, updatedAt: new Date().toISOString(),
    from: opts.from || null, to: opts.to || null,
    truncated: from != null && !reachedStart && !endOfChannel,
    reports, mentions,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

// چند کانال را پشت‌سرهم می‌خواند؛ خطای یک کانال بقیه را خراب نمی‌کند.
async function fetchChannels(names, opts = {}) {
  const out = [];
  for (const n of names) {
    try { out.push(await fetchChannel(n, opts)); }
    catch (e) { out.push({ channel: n, error: e.message || 'خطا', records: [], mentions: {} }); }
  }
  return out;
}

module.exports = { parseChannel, parseChannels, fetchChannel, fetchChannels, parseDay, inRange };
