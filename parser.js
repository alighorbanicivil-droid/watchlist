'use strict';
const { industryOf } = require('./industries');

const PD = '۰۱۲۳۴۵۶۷۸۹', AD = '٠١٢٣٤٥٦٧٨٩';
const fixDigits = (s) => s.replace(/[۰-۹]/g, (c) => PD.indexOf(c)).replace(/[٠-٩]/g, (c) => AD.indexOf(c));
const fixLetters = (s) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
const num = (s) => Number(String(s).replace(/,/g, '').replace('/', '.'));

function htmlToText(h) {
  return h
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, '&');
}

// همه‌ی هشتگ‌های یک متن (بدون تکرار)
function hashtags(text) {
  return [...new Set([...text.matchAll(/#([\u0600-\u06FF\w\u200c]+)/g)].map((m) => m[1].replace(/\u200c/g, '')))];
}

// صفحه‌ی t.me/s/<channel> را به لیست پست‌ها تبدیل می‌کند.
function parsePage(html) {
  const chunks = html.split(/(?=<div class="tgme_widget_message_wrap)/).filter((c) => c.startsWith('<div class="tgme_widget_message_wrap'));
  const posts = [];
  let minId = Infinity;
  for (const c of chunks) {
    const idm = c.match(/data-post="[^"/]+\/(\d+)"/);
    if (!idm) continue;
    const id = +idm[1];
    minId = Math.min(minId, id);
    const tm = c.match(/<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/);
    if (!tm) continue;
    const dm = c.match(/<time[^>]*datetime="([^"]+)"/);
    const text = fixLetters(fixDigits(htmlToText(tm[1])));
    posts.push({ id, date: dm ? dm[1] : null, text, tags: hashtags(text) });
  }
  return { posts, minId: Number.isFinite(minId) ? minId : null };
}

// پست «صورت مالی» را به رکورد ساختاریافته تبدیل می‌کند؛ اگر پست گزارش مالی نبود null.
function extractRecord(post) {
  const t = post.text;
  const per = t.match(/صورت\s*مالی\s*(شش\s*ماهه|6\s*ماهه|نه\s*ماهه|9\s*ماهه)/);
  if (!per) return null;
  const period = /شش|6/.test(per[1]) ? 6 : 9;
  const sym = t.match(/#([\u0600-\u06FF\w\u200c]+)/);
  if (!sym) return null;
  const symbol = sym[1].replace(/\u200c/g, '');

  let eps = null;
  const loss = t.match(/(?:شش\s*ماهه|نه\s*ماهه|6\s*ماهه|9\s*ماهه)\s*([\d,]+)\s*ریال\s*\**\s*زیان/);
  const prof = t.match(/سود\s*(?:شش\s*ماهه|نه\s*ماهه|6\s*ماهه|9\s*ماهه)\s*([\d,]+)\s*ریال/);
  if (loss) eps = -num(loss[1]);
  else if (prof) eps = num(prof[1]);
  const price = t.match(/قیمت\s*روز\s*([\d,]+)/);
  const mcap = t.match(/ارزش\s*بازار\s*([\d,]+(?:\/\d+)?)\s*همت/);
  if (eps == null || !price || !mcap) return null;

  const q = (name) => { const m = t.match(new RegExp('سود\\s*' + name + '\\s*([\\d,]+)\\s*ریال')); return m ? num(m[1]) : null; };

  // سهم سود یک‌باره (تسعیر ارز، فروش سرمایه‌گذاری و ...)
  let oneOffRial = 0;
  for (const m of t.matchAll(/([\d,]+)\s*ریال\s*از\s*سود\s*مربوط\s*به/g)) oneOffRial += num(m[1]);
  let oneOffPct = 0;
  for (const m of t.matchAll(/(\d+)\s*%\s*از\s*سود\s*ناخالص\s*مربوط\s*به\s*(?:فروش|تسعیر)/g)) oneOffPct += +m[1];
  const share = Math.max(eps > 0 ? oneOffRial / eps : 0, oneOffPct / 100);
  let w = share >= 0.6 ? 2 : share >= 0.3 ? 1 : 0;
  if (eps <= 0) w = 2;

  const notes = [];
  const cap = t.match(/افزایش\s*سرمایه[‌\s]*ی?\s*(\d+)\s*%\s*([^\n.]*)/);
  if (cap) notes.push(`افزایش سرمایه ${cap[1]}٪ ${cap[2].trim()}`.trim());
  for (const line of t.split('\n')) {
    if (/از\s*سود\s*(?:ناخالص\s*)?مربوط\s*به|بخشی\s*از\s*سود\s*در\s*انتهای|زیان\s*انباشته/.test(line) && notes.length < 3) notes.push(line.replace(/^[\s*_]+/, '').trim());
  }

  return {
    symbol, industry: industryOf(symbol), period,
    eps, price: num(price[1]), mcap: num(mcap[1]),
    q1: q('بهار'), q2: q('تابستان'),
    w, note: notes.join(' · ').slice(0, 260),
    postId: post.id, date: post.date,
  };
}

module.exports = { parsePage, extractRecord, htmlToText, hashtags };
