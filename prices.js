'use strict';
// قیمت فعلی نمادها از TSETMC (نسخه‌ی قدیمی سایت).
// ⚠️ این منبع رسمی و تضمین‌شده نیست و قالب پاسخ‌ها ممکن است تغییر کند.
// فرمت پاسخ‌ها از روی حافظه نوشته شده و از محیط ساخت تست نشده؛ برای همین هر قیمت با قیمت گزارش مقایسه
// و در صورت ناهماهنگی بیش از حد (کمتر از ۳۰٪ یا بیشتر از ۳ برابر) نادیده گرفته می‌شود.
// خاموش‌کردن: PRICE_SOURCE=off
const BASE = process.env.TSETMC_BASE || 'http://old.tsetmc.com';
const norm = (s) => String(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, '').trim();

async function get(url, timeout) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bourse-watchlist/1.0)' }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

// ردیف‌های جست‌وجو: «نماد,نام,کد‌بورسی,…» جداشده با ؛
function pickInsCode(text, symbol) {
  for (const row of text.split(';')) {
    const f = row.split(',');
    if (f.length > 2 && norm(f[0]) === norm(symbol) && /^\d{8,}$/.test(f[2].trim())) return f[2].trim();
  }
  return null;
}
// پاسخ قیمت: «ساعت,وضعیت,آخرین‌معامله,پایانی,…؛…»
function parsePrice(text) {
  const f = text.split(';')[0].split(',');
  for (const i of [3, 2]) { const n = Number(String(f[i] || '').trim()); if (n > 0) return n; }
  return null;
}

async function fetchOne(symbol, timeout) {
  const code = pickInsCode(await get(`${BASE}/tsev2/data/search.aspx?skey=${encodeURIComponent(symbol)}`, timeout), symbol);
  if (!code) return null;
  return parsePrice(await get(`${BASE}/tsev2/data/instinfodata.aspx?i=${code}&c=57+`, timeout));
}

// روی رکوردها priceNow / priceSource را می‌گذارد. هر خطایی فقط همان نماد را بی‌قیمت می‌کند.
async function applyPrices(records, { concurrency = 4, timeout = 8000 } = {}) {
  if (process.env.PRICE_SOURCE === 'off') return { ok: 0, failed: records.length, skipped: true };
  let ok = 0, failed = 0, i = 0;
  async function worker() {
    while (i < records.length) {
      const r = records[i++];
      try {
        const p = await fetchOne(r.symbol, timeout);
        if (p && p > r.price * 0.3 && p < r.price * 3) { r.priceNow = p; r.priceSource = 'tsetmc'; ok++; } else failed++;
      } catch { failed++; }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { ok, failed, skipped: false };
}

module.exports = { applyPrices, pickInsCode, parsePrice };
