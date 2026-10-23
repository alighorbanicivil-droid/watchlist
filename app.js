(function () {
'use strict';
const $ = (id) => document.getElementById(id);
const J = window.Jalali, S = window.Scoring, M = window.Merge, fa = J.fa;
const f1 = (n) => Number(n).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

let SNAP = null, OV = store.get('ov', {}), W = Object.assign({}, S.DEFAULT_W, store.get('w', {})), ind = 'all', open = null, cind = 'P';
const IND = () => (SNAP && SNAP.industries) || { O: 'سایر' };
const nCh = () => Math.max((SNAP && SNAP.channels && SNAP.channels.length) || 1, 1);

/* ---------- انتخابگر تاریخ شمسی ---------- */
function mkPicker(id, iso, empty) {
  const el = $(id); el.innerHTML = '';
  const j = iso ? J.fromISO(iso) : null, cy = J.fromISO(J.todayISO())[0];
  const E = empty ? [['', '—']] : [];
  const mk = (opts, val) => { const s = document.createElement('select'); s.onchange = onRange; s.innerHTML = opts.map((o) => `<option value="${o[0]}"${String(o[0]) === String(val) ? ' selected' : ''}>${o[1]}</option>`).join(''); el.appendChild(s); };
  mk(E.concat([cy - 3, cy - 2, cy - 1, cy].map((y) => [y, fa(y)])), j ? j[0] : (empty ? '' : cy));
  mk(E.concat(J.MONTHS.map((n, i) => [i + 1, n])), j ? j[1] : (empty ? '' : 1));
  mk(E.concat(Array.from({ length: 31 }, (_, i) => [i + 1, fa(i + 1)])), j ? j[2] : (empty ? '' : 1));
}
function getP(id) {
  const v = [].map.call($(id).querySelectorAll('select'), (s) => s.value);
  if (!v[0] || !v[1] || !v[2]) return '';
  return J.jToISO(+v[0], +v[1], Math.min(+v[2], J.daysInMonth(+v[0], +v[1])));
}
function onRange() { store.set('range', { from: getP('pfrom'), to: getP('pto') }); if (SNAP) { open = null; renderRank(); } }
const isoAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

/* ---------- بارگذاری داده ---------- */
async function load() {
  let s = null;
  try { const r = await fetch('data/latest.json', { cache: 'no-store' }); if (r.ok) s = await r.json(); } catch (e) { /* ignore */ }
  const loc = store.get('snap', null);
  if (loc && (!s || loc.generatedAt > s.generatedAt)) s = loc;
  SNAP = s || { records: [], channels: [], industries: { O: 'سایر' }, generatedAt: null };
  renderAll();
}
function renderMeta(count) {
  const p = SNAP.prices || {}, from = getP('pfrom'), to = getP('pto');
  let t = SNAP.generatedAt ? `آخرین به‌روزرسانی: ${J.format(SNAP.generatedAt)}` : 'داده‌ای نیست';
  if (SNAP.seed) t += ' (داده‌ی نمونه‌ی اولیه؛ بدون تاریخ گزارش و هنوز به‌روزرسانی خودکار اجرا نشده)';
  t += ` · ${fa(count)} نماد در بازه‌ی انتخابی از ${fa(nCh())} کانال`;
  t += from || to ? ` · بازه: ${from ? J.format(from) : 'ابتدا'} تا ${to ? J.format(to) : 'امروز'}` : ' · بازه: همه‌ی داده‌ی ذخیره‌شده';
  const cover = SNAP.range && SNAP.range.from;
  if (cover && from && from < cover) t += ` ⚠️ داده‌ی ذخیره‌شده فقط از ${J.format(cover)} است؛ برای بازه‌ی بلندتر days را در config.json زیاد کن یا «دریافت اکنون» بزن`;
  t += p.ok ? ` · قیمت فعلی برای ${fa(p.ok)} نماد` : ' · قیمت فعلی در دسترس نیست';
  $('meta').textContent = t;
}

/* ---------- رتبه‌بندی ---------- */
// نمادهایی که گزارششان داخل بازه‌ی انتخابی منتشر شده؛ بدون بازه همه‌ی داده‌ی ذخیره‌شده.
function rangeRecs() {
  const from = getP('pfrom'), to = getP('pto'), pm = SNAP.priceMap || {};
  if (SNAP.reports) return M.derive(SNAP.reports, SNAP.mentions || [], from, to).map((r) => Object.assign(r, pm[r.symbol] ? { priceNow: pm[r.symbol] } : {}));
  return from || to ? [] : SNAP.records; // داده‌ی نمونه تاریخ ندارد
}
function calc() {
  const recs = rangeRecs().map((r) => Object.assign({}, r, { industry: OV[r.symbol] || r.industry }));
  return S.rankAll(recs, W, nCh());
}
function chips(id, cur, fn, all, items) {
  const el = $(id); el.innerHTML = '';
  const add = (k, t) => { const b = document.createElement('button'); b.className = 'chip' + (k === cur ? ' on' : ''); b.textContent = t; b.onclick = () => fn(k); el.appendChild(b); };
  if (all) add('all', `همه صنایع (${fa(items.length)})`);
  Object.keys(IND()).forEach((k) => { if (items && !items.some((d) => d.rec.industry === k)) return; add(k, `${IND()[k]}${items ? ' (' + fa(items.filter((d) => d.rec.industry === k).length) + ')' : ''}`); });
}
const stale = (r) => r.date && J.daysSince(r.date) > 10;
function pct(x) { return `${x >= 0 ? '+' : '−'}${fa(Math.abs(Math.round(x * 100)))}٪`; }

function card(d, i) {
  const r = d.rec, e = document.createElement('div');
  e.className = 'card' + (open === r.symbol ? ' open' : '');
  const tags = (r.w === 2 ? '<span class="tag r">سود یک‌باره</span>' : r.w === 1 ? '<span class="tag">بخشی یک‌باره</span>' : '') +
    (nCh() > 1 ? ` <span class="tag g">✔ ${fa(r.confirms || 1)} از ${fa(nCh())} کانال</span>` : '') +
    (stale(r) ? ' <span class="tag">قدیمی</span>' : '');
  const rel = d.rel == null ? '—' : `<b class="${d.rel <= 1 ? 'up' : 'dn'}">${fa(Math.abs(Math.round((1 - d.rel) * 100)))}٪ ${d.rel <= 1 ? 'ارزان‌تر' : 'گران‌تر'}</b>`;
  const g = d.g == null ? '—' : `<b class="${d.g >= 0 ? 'up' : 'dn'}">${pct(d.g)}</b>`;
  const now = r.priceNow ? `${fa(r.priceNow)} <b class="${r.priceNow >= r.price ? 'up' : 'dn'}">(${pct(r.priceNow / r.price - 1)})</b>` : '—';
  e.innerHTML = `<div class="top"><div class="rank">${fa(i + 1)}</div><div class="sym">${esc(r.symbol)}</div>${tags}<div class="sc">${fa(Math.round(d.sc))}</div></div>
  <div class="why">${esc(d.short)}</div><div class="bar"><i style="width:${d.sc.toFixed(0)}%"></i></div>
  <div class="grid"><div><span>P/E سالانه</span>${d.pe ? f1(d.pe) : 'زیان'}</div><div><span>نسبت به میانه صنعت</span>${rel}</div><div><span>رشد فصلی</span>${g}</div><div><span>ارزش بازار (همت)</span>${f1(r.mcap)}</div></div>
  <div class="prc"><span>قیمت گزارش: ${fa(r.price)}</span><span>قیمت فعلی: ${now}</span><span>تاریخ گزارش: ${r.date ? J.format(r.date) : 'نامشخص'}</span></div>
  <div class="det"><b>دلیل رتبه:</b><ul>${d.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  سود ${r.period === 9 ? '۹ ماهه' : '۶ ماهه'}: ${fa(r.eps)} ریال${r.q1 != null ? ` · سود فصل ۱ ← ۲: ${fa(r.q1)} ← ${fa(r.q2 == null ? 0 : r.q2)}` : ''}<br>
  ${esc(r.note || 'نکته‌ی ویژه‌ای در پست کانال نبود.')}<br>
  کانال‌ها: ${esc((r.channels || []).join('، ') || '—')}${(r.mentionedBy || []).length ? ' · ذکر‌شده در: ' + esc(r.mentionedBy.join('، ')) : ''}<br>
  <label>تغییر صنعت: <select>${Object.keys(IND()).map((k) => `<option value="${k}"${k === r.industry ? ' selected' : ''}>${esc(IND()[k])}</option>`).join('')}</select></label></div>`;
  e.onclick = (ev) => { if (ev.target.tagName === 'SELECT' || ev.target.tagName === 'LABEL') return; open = open === r.symbol ? null : r.symbol; renderRank(); };
  e.querySelector('select').onchange = (ev) => { OV[r.symbol] = ev.target.value; store.set('ov', OV); renderRank(); };
  return e;
}

function renderRank() {
  const { items, stats } = calc();
  renderMeta(items.length);
  const codes = Object.keys(IND()).filter((k) => items.some((d) => d.rec.industry === k));
  if (ind !== 'all' && !codes.includes(ind)) ind = 'all';
  chips('inds', ind, (k) => { ind = k; open = null; renderRank(); }, true, items);
  const c = $('cards'); c.innerHTML = '';
  if (!items.length) { c.innerHTML = '<p class="sub">در این بازه گزارشی پیدا نشد. بازه را بازتر کن یا «همه‌ی داده» را بزن.</p>'; return; }
  (ind === 'all' ? codes : [ind]).forEach((k) => {
    const list = items.filter((d) => d.rec.industry === k), st = stats.byInd[k];
    const h = document.createElement('div'); h.className = 'lbl';
    h.innerHTML = `<b>${esc(IND()[k])}</b> · ${fa(list.length)} نماد · میانه‌ی P/E ${f1(st.median)}${st.fallback ? ' (کمتر از ۳ نماد؛ از میانه‌ی کل نمادها استفاده شد)' : ''}`;
    c.appendChild(h);
    list.forEach((d, i) => c.appendChild(card(d, i)));
  });
}
const WL = { v: 'ارزانی (P/E نسبت به صنعت)', g: 'روند سود فصلی', q: 'کیفیت سود', s: 'اندازه‌ی بازار', c: 'تأیید کانال‌ها' };
function buildWeights() {
  const box = $('ws'); box.innerHTML = '';
  Object.keys(WL).forEach((k) => {
    const r = document.createElement('div'); r.className = 'w';
    r.innerHTML = `<span>${WL[k]}</span><input type="range" min="0" max="100" value="${W[k]}"><b>${fa(W[k])}</b>`;
    r.querySelector('input').oninput = (e) => { W[k] = +e.target.value; r.querySelector('b').textContent = fa(W[k]); store.set('w', W); renderRank(); };
    box.appendChild(r);
  });
}

/* ---------- دریافت اکنون ---------- */
$('go').onclick = async () => {
  const b = $('go'), st = $('st'); b.disabled = true; st.className = ''; st.textContent = 'در حال خواندن کانال‌ها…';
  try {
    const from = getP('pfrom'), to = getP('pto');
    if (from && to && from > to) throw new Error('تاریخ شروع باید قبل از تاریخ پایان باشد.');
    const url = '/api/snapshot?urls=' + encodeURIComponent($('chs').value) + (from ? '&from=' + from : '') + (to ? '&to=' + to : '');
    const res = await fetch(url);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) throw new Error('سرور در دسترس نیست. با npm start اجرا کن؛ روی GitHub Pages فقط داده‌ی روزانه‌ی خودکار نمایش داده می‌شود.');
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'خطای ناشناخته');
    SNAP = j; ind = 'all'; open = null; store.set('snap', j); store.set('chs', $('chs').value); store.set('range', { from, to });
    st.textContent = `${fa(j.scanned)} پست بررسی شد · ${fa(j.records.length)} نماد` + (j.truncated ? ' ⚠️ به سقف ۳۰ صفحه رسید؛ بازه را کوتاه‌تر کن.' : '') + (j.failed.length ? ` · ${fa(j.failed.length)} کانال ناموفق` : '');
    renderAll();
  } catch (e) { st.className = 'err'; st.textContent = e.message; } finally { b.disabled = false; }
};
document.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { const n = +b.dataset.d; mkPicker('pfrom', n ? isoAgo(n) : '', true); mkPicker('pto', '', true); onRange(); });

/* ---------- چک‌لیست ---------- */
const GEN = ['کیفیت سود: سهم سود تکرارپذیر چقدر است؟ (فروش سرمایه‌گذاری و تسعیر ارز یک‌باره‌اند)', 'روند فصلی: سود فصل دوم از فصل اول بیشتر است؟', 'P/E سالانه‌شده را با میانگین صنعت مقایسه کردم', 'نوع افزایش سرمایه را بررسی کردم (انباشته یا آورده نقدی)', 'ارزش بازار و نقدشوندگی برای حجم خریدم مناسب است', 'اعداد کانال را با صورت مالی در کدال تطبیق دادم'];
const SPEC = {
  P: ['نرخ جهانی محصول و روند دلار را چک کردم', 'حاشیه سود نسبت به فصل قبل و تعدیل فروش پایان دوره', 'محدودیت خوراک (گاز/نفتا) و توقف‌های تولید', 'سهم سود تسعیر ارز از کل سود'],
  M: ['نرخ جهانی فلز و دلار و روند آن', 'هزینه انرژی و مواد اولیه', 'بخش سود پایان سال از تقسیم سود سرمایه‌پذیرها', 'رشد نرخ فروش تابستان نسبت به بهار'],
  D: ['نرخ‌گذاری دستوری و ارز ترجیحی مواد اولیه', 'سهم صادرات و ظرفیت تولید', 'وابستگی به واردات مواد اولیه', 'افزایش نرخ جدید فروش و اثر آن'],
  I: ['ارزش پورتفوی نسبت به ارزش بازار (NAV)', 'نمادهای اصلی پورتفو و وضعیت آن‌ها', 'سود تکرارپذیر در برابر سود فروش سرمایه‌گذاری', 'سود تغییر ارزش که هنوز شناسایی نشده'],
  B: ['ارزش سرمایه‌گذاری‌ها نسبت به ارزش بازار', 'سود تغییر ارزش شناسایی‌نشده و فروش وثایق', 'کیفیت دارایی و مطالبات/خسارت‌ها', 'سهم سپرده و اوراق در سرمایه‌گذاری‌ها'],
  F: ['نرخ‌گذاری دستوری و تغییر قیمت فروش', 'نوسان قیمت مواد اولیه و ارز', 'حاشیه سود و رقابت بازار', 'نوع افزایش سرمایه (تجدید ارزیابی یا انباشته)'],
  A: ['نرخ‌گذاری دستوری و افزایش‌های جدید', 'زیان انباشته و جریان نقدی', 'تأمین قطعات و فروش در برابر تولید', 'سهم درآمدهای غیرعملیاتی از سود'],
  C: ['هزینه سوخت و انرژی', 'سهم صادرات', 'سود سرمایه‌گذاری‌ها در پایان سال', 'ظرفیت و میزان فروش ماهانه'],
  T: ['رشد درآمد ماهانه و قراردادها', 'سود غیرعملیاتی (فروش دارایی، کمک دولتی)', 'افزایش سرمایه نقدی و رقیق‌سازی', 'وابستگی به مشتریان بزرگ'],
  L: ['تعدیل فروش پایان دوره‌ی فصلی', 'وابستگی به صنایع مادر', 'سهم تسعیر ارز و فروش سرمایه‌گذاری', 'تغییر سال مالی و اثر ۹ ماهه'],
  O: ['فعالیت اصلی شرکت و ماهیت سود', 'روند فصلی و ثبات سود', 'نقدشوندگی و ارزش بازار کوچک', 'دلیل افزایش سرمایه'],
};
// کتابخانه‌ی تکنیک‌ها: [شناسه، نام، توضیح، موارد]
const TECH = [
  ['graham', 'حاشیه امنیت گراهام', 'سرمایه‌گذاری ارزشی کلاسیک', ['P/E زیر ۱۵ و کمتر از میانه‌ی صنعت', 'P/B زیر ۱.۵', 'سود مثبت حداقل ۳ سال اخیر', 'بدهی به حقوق صاحبان سهام زیر ۱', 'قیمت دست‌کم ۳۰٪ زیر ارزش ذاتی تخمینی']],
  ['canslim', 'CAN SLIM (ویلیام اونیل)', 'رشد + مومنتوم', ['سود فصل جاری نسبت به فصل مشابه سال قبل رشد دارد', 'رشد سود سالانه چندساله', 'محرک جدید: محصول، مدیریت یا سقف قیمتی جدید', 'عرضه و تقاضا: حجم و سهام شناور', 'نماد لیدر صنعت است', 'ورود پول هوشمند/نهادی', 'روند بازار کل مثبت است']],
  ['magic', 'فرمول جادویی گرینبلات', 'بازده سرمایه + بازده سود', ['بازده سرمایه (ROC) بالا', 'بازده سود (معکوس P/E) بالا', 'رتبه‌ی ترکیبی در بین نمادهای صنعت', 'نگهداری حدود یک سال و بازنگری دوره‌ای']],
  ['piotroski', 'امتیاز F پیوتروسکی', 'سلامت مالی با ۹ معیار؛ ۷ به بالا خوب است', ['سود خالص مثبت', 'جریان نقد عملیاتی مثبت', 'بهبود بازده دارایی‌ها (ROA)', 'جریان نقد عملیاتی بیشتر از سود', 'کاهش اهرم مالی', 'بهبود نسبت جاری', 'عدم انتشار سهام جدید (رقیق‌سازی)', 'بهبود حاشیه سود ناخالص', 'بهبود گردش دارایی‌ها']],
  ['peg', 'PEG (پیتر لینچ)', 'ارزانی نسبت به رشد', ['رشد سود سالانه پایدار است', 'PEG = P/E ÷ رشد سود؛ زیر ۱ جذاب است', 'رشد یک‌باره نیست', 'بدهی قابل کنترل است']],
  ['dcf', 'ارزش ذاتی و حاشیه امنیت', 'برآورد ارزش واقعی', ['پیش‌بینی سود ۳ تا ۵ سال آینده', 'نرخ تنزیل منطقی انتخاب شده', 'سه سناریو: بدبینانه، پایه، خوش‌بینانه', 'حاشیه امنیت دست‌کم ۲۰ تا ۳۰ درصد']],
  ['nav', 'NAV برای هلدینگ‌ها', 'ارزش خالص دارایی', ['ارزش روز پورتفوی بورسی', 'ارزش سرمایه‌گذاری‌های غیربورسی', 'NAV هر سهم و تخفیف/صرف قیمت به آن', 'وضعیت سهام اصلی پورتفو']],
  ['tech', 'تحلیل تکنیکال پایه', 'روند و زمان‌بندی ورود', ['روند: سقف و کف‌های بالاتر', 'حمایت و مقاومت‌های کلیدی', 'شکست همراه با حجم', 'قیمت بالای میانگین ۵۰ و ۲۰۰ روزه', 'RSI در اشباع خرید نیست']],
  ['flow', 'قدرت خریدار حقیقی (بورس ایران)', 'رفتار پول حقیقی و حقوقی', ['ورود پول حقیقی خالص مثبت', 'قدرت خریدار به فروشنده بیشتر از ۱', 'سرانه خرید بیشتر از سرانه فروش', 'حجم معاملات نسبت به میانگین ماهانه', 'وضعیت صف خرید/فروش و حجم صف']],
  ['risk', 'مدیریت ریسک ۱ تا ۲ درصد', 'حفظ سرمایه', ['ریسک هر معامله حداکثر ۲٪ سرمایه', 'حد ضرر قبل از ورود تعیین شده', 'نسبت ریسک به ریوارد حداقل ۱ به ۲', 'سقف وزن هر نماد در سبد', 'سقف وزن هر صنعت در سبد']],
  ['invert', 'وارونه‌فکری مانگر', 'اول به شکست فکر کن', ['چطور ممکن است ضرر کنم؟', 'بدترین سناریو چیست؟', 'چه چیزی را نمی‌دانم؟', 'اگر ۳۰٪ افت کند نگه می‌دارم؟', 'دلیل فروش را از قبل نوشته‌ام']],
  ['quality', 'کیفیت سود', 'سود واقعی یا حسابداری؟', ['جریان نقد عملیاتی نسبت به سود', 'سهم سود یک‌باره و تسعیر ارز', 'تغییر حساب‌های دریافتنی و موجودی', 'تکرارپذیری سود فصل به فصل']],
  ['dividend', 'سود تقسیمی', 'بازده نقدی', ['سیاست تقسیم سود (درصد)', 'بازده نقدی نسبت به قیمت', 'پایداری تقسیم سود چند سال اخیر', 'زمان مجمع', 'تفاوت سود تحقق‌یافته و قابل تقسیم']],
  ['kadal', 'رصد کدال و رخدادها', 'اتفاق‌های قیمت‌ساز', ['افزایش سرمایه: نوع و زمان', 'تقسیم سود و مجمع', 'گزارش فعالیت ماهانه', 'تغییر هیئت‌مدیره یا معاملات خاص', 'احتمال توقف یا ابطال نماد']],
  ['commodity', 'زنجیره ارزش و نرخ جهانی', 'برای صادرات‌محورها', ['روند نرخ جهانی محصول', 'نرخ ارز و تأثیر آن', 'هزینه انرژی و خوراک', 'سهم صادرات از فروش', 'حاشیه سود ناخالص']],
];
let CK = store.get('ck', { ticks: {}, added: {}, custom: [] });
const saveCk = () => store.set('ck', CK);
const techById = (id) => TECH.find((t) => t[0] === id) ? { id, name: TECH.find((t) => t[0] === id)[1], items: TECH.find((t) => t[0] === id)[3] } : (CK.custom.find((c) => c.id === id) || null);

function buildLib() {
  const sel = $('lib'); sel.innerHTML = '';
  const og = (label, opts) => `<optgroup label="${label}">${opts.map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</optgroup>`;
  sel.innerHTML = og('تکنیک‌های حرفه‌ای', TECH.map((t) => [t[0], t[1]])) + (CK.custom.length ? og('چک‌لیست‌های من', CK.custom.map((c) => [c.id, c.name])) : '') + '<option value="__new">➕ ساخت چک‌لیست جدید…</option>';
  descr();
}
function descr() {
  const v = $('lib').value; $('newbox').classList.toggle('hide', v !== '__new');
  const t = TECH.find((x) => x[0] === v);
  $('tdesc').textContent = t ? `${t[2]} · ${fa(t[3].length)} مورد` : '';
}
$('lib').onchange = descr;
$('addt').onclick = () => {
  const v = $('lib').value; if (v === '__new') return;
  CK.added[cind] = CK.added[cind] || [];
  if (!CK.added[cind].includes(v)) CK.added[cind].push(v);
  saveCk(); renderCk();
};
$('savenew').onclick = () => {
  const name = $('nname').value.trim(), items = $('nitems').value.split('\n').map((x) => x.trim()).filter(Boolean);
  if (!name || !items.length) return;
  const id = 'u' + Date.now(); CK.custom.push({ id, name, items });
  CK.added[cind] = (CK.added[cind] || []).concat(id); saveCk();
  $('nname').value = ''; $('nitems').value = ''; buildLib(); $('lib').value = id; descr(); renderCk();
};
function groups() {
  const g = [{ id: 'spec', title: 'مخصوص ' + IND()[cind], items: SPEC[cind] || SPEC.O }, { id: 'gen', title: 'عمومی', items: GEN }];
  (CK.added[cind] || []).forEach((id) => { const t = techById(id); if (t) g.push({ id, title: t.name, items: t.items, removable: true }); });
  return g;
}
function renderCk() {
  chips('cinds', cind, (k) => { cind = k; renderCk(); }, false, null);
  const L = $('cklist'); L.innerHTML = ''; let total = 0, done = 0;
  groups().forEach((g) => {
    const h = document.createElement('div'); h.className = 'gh'; h.textContent = g.title;
    if (g.removable) { const x = document.createElement('button'); x.className = 'ghost'; x.textContent = '× حذف'; x.onclick = () => { CK.added[cind] = CK.added[cind].filter((i) => i !== g.id); saveCk(); renderCk(); }; h.appendChild(x); }
    L.appendChild(h);
    g.items.forEach((txt, i) => {
      const k = `${cind}|${g.id}|${i}`, on = !!CK.ticks[k]; total++; if (on) done++;
      const l = document.createElement('label'); l.className = 'ck' + (on ? ' done' : '');
      l.innerHTML = `<input type="checkbox"${on ? ' checked' : ''}><span>${esc(txt)}</span>`;
      l.firstChild.onchange = (e) => { if (e.target.checked) CK.ticks[k] = 1; else delete CK.ticks[k]; saveCk(); renderCk(); };
      l.dataset.k = k; L.appendChild(l);
    });
  });
  $('prog').textContent = `${fa(done)} از ${fa(total)} مورد انجام شد`;
}
function setAll(on) { document.querySelectorAll('#cklist .ck').forEach((l) => { if (on) CK.ticks[l.dataset.k] = 1; else delete CK.ticks[l.dataset.k]; }); saveCk(); renderCk(); }
$('all').onclick = () => setAll(true); $('none').onclick = () => setAll(false);

/* ---------- سابقه عملکرد ---------- */
const bar = (label, v, scale) => {
  const w = Math.min(Math.abs(v) / scale, 1) * 50, neg = v < 0;
  return `<div class="br"><span>${esc(label)}</span><div class="t"><u></u><i class="${neg ? 'n' : ''}" style="${neg ? 'right' : 'left'}:50%;width:${w}%;${neg ? 'right:50%;left:auto' : ''}"></i></div><b class="${neg ? 'dn' : 'up'}">${pct(v)}</b></div>`;
};
async function perfLoad() {
  const out = $('perfout'); out.innerHTML = '<p class="sub">در حال بارگذاری…</p>';
  let days = [];
  try { const r = await fetch('data/history/index.json', { cache: 'no-store' }); if (r.ok) days = await r.json(); } catch (e) { /* ignore */ }
  const sel = $('base'); sel.innerHTML = days.map((d) => `<option value="${d}">${J.format(d)}</option>`).join('');
  if (!days.length) { out.innerHTML = '<p class="sub">هنوز تاریخچه‌ای ثبت نشده. با هر به‌روزرسانی خودکار روزانه یک عکس فوری از رتبه‌بندی ذخیره می‌شود؛ چند روز بعد اینجا عملکرد نمادهای برتر را می‌بینی.</p>'; return; }
  sel.value = days[0]; sel.onchange = perfShow; perfShow();
}
async function perfShow() {
  const out = $('perfout'), d = $('base').value;
  let H; try { const r = await fetch(`data/history/${d}.json`, { cache: 'no-store' }); H = await r.json(); } catch (e) { out.innerHTML = '<p class="err">خواندن تاریخچه ممکن نشد.</p>'; return; }
  const now = {}; SNAP.records.forEach((r) => { now[r.symbol] = { p: r.priceNow || r.price, live: !!r.priceNow }; });
  const rows = H.items.filter((x) => now[x.s]).map((x) => ({ s: x.s, i: x.i, ch: now[x.s].p / x.p - 1, live: x.src === 'live' && now[x.s].live }));
  if (!rows.length) { out.innerHTML = '<p class="sub">نماد مشترکی برای مقایسه نیست.</p>'; return; }
  const avg = (a) => a.reduce((s, x) => s + x.ch, 0) / a.length;
  const by = {}; rows.forEach((r) => { (by[r.i] = by[r.i] || []).push(r); });
  const liveShare = rows.filter((r) => r.live).length / rows.length;
  const all = avg(rows), scale = Math.max(0.1, ...rows.map((r) => Math.abs(r.ch)));
  const sorted = [...rows].sort((a, b) => b.ch - a.ch);
  out.innerHTML = `<div class="panel"><b>نمادهای رتبه‌بندی‌شده در ${J.format(d)}</b><br>میانگین تغییر قیمت تا امروز: <b class="${all >= 0 ? 'up' : 'dn'}">${pct(all)}</b> روی ${fa(rows.length)} نماد · موفق: ${fa(rows.filter((r) => r.ch > 0).length)} نماد</div>
  ${liveShare < 0.5 ? '<p class="sub err">⚠️ بیشتر قیمت‌ها «قیمت گزارش» کانال‌اند، نه قیمت زنده؛ تغییر نشان‌داده‌شده بازده واقعی بازار نیست. برای قیمت زنده منبع قیمت باید در دسترس باشد.</p>' : ''}
  <div class="lbl">میانگین تغییر به‌تفکیک صنعت</div>${Object.keys(by).map((k) => bar(IND()[k] || k, avg(by[k]), scale)).join('')}
  <div class="lbl">بهترین و بدترین نمادها</div>${sorted.slice(0, 5).concat(sorted.slice(-5).reverse()).filter((x, i, a) => a.indexOf(x) === i).map((x) => bar(x.s, x.ch, scale)).join('')}`;
}

/* ---------- خروجی PDF ---------- */
function buildReport() {
  const { items, stats } = calc(), n = nCh();
  const codes = Object.keys(IND()).filter((k) => items.some((d) => d.rec.industry === k));
  const avgSc = (k) => { const a = items.filter((d) => d.rec.industry === k); return a.reduce((s, d) => s + d.sc, 0) / a.length; };
  const chart = codes.map((k) => `<div class="br"><span>${esc(IND()[k])}</span><div class="t"><i style="left:0;width:${avgSc(k).toFixed(0)}%"></i></div><b>${fa(Math.round(avgSc(k)))}</b></div>`).join('');
  const blocks = codes.map((k) => {
    const top = items.filter((d) => d.rec.industry === k), st = stats.byInd[k];
    return `<div class="rp-ind"><div class="rp-ih"><span>${esc(IND()[k])} · ${fa(top.length)} نماد</span><span>میانه‌ی P/E: ${f1(st.median)}${st.fallback ? ' (کل نمادها)' : ''}</span></div><table>
    <tr><th>#</th><th>نماد</th><th>امتیاز</th><th>P/E</th><th>نسبت به صنعت</th><th>رشد فصلی</th><th>ارزش بازار</th><th>قیمت گزارش / فعلی</th><th>تاریخ گزارش</th></tr>
    ${top.map((d, i) => { const r = d.rec; return `<tr><td>${fa(i + 1)}</td><td><b>${esc(r.symbol)}</b>${r.w === 2 ? '<span class="tg r">یک‌باره</span>' : r.w === 1 ? '<span class="tg">بخشی یک‌باره</span>' : ''}${n > 1 ? `<span class="tg" style="color:#15803d;border-color:#15803d">${fa(r.confirms || 1)}/${fa(n)} کانال</span>` : ''}</td>
    <td>${fa(Math.round(d.sc))}<span class="sb"><i style="width:${d.sc.toFixed(0)}%"></i></span></td><td>${d.pe ? f1(d.pe) : 'زیان'}</td><td>${d.rel == null ? '—' : fa(Math.abs(Math.round((1 - d.rel) * 100))) + '٪ ' + (d.rel <= 1 ? 'ارزان‌تر' : 'گران‌تر')}</td><td>${d.g == null ? '—' : pct(d.g)}</td><td>${f1(r.mcap)}</td><td>${fa(r.price)}${r.priceNow ? ' / ' + fa(r.priceNow) : ''}</td><td>${r.date ? J.format(r.date) : '—'}</td></tr>
    <tr class="rs"><td></td><td colspan="8">${esc(d.short)}</td></tr>`; }).join('')}</table></div>`;
  }).join('');
  $('report').innerHTML = `<div class="rp-h"><h2>گزارش نمادهای برتر هر صنعت</h2><p>تاریخ تهیه: ${J.format(J.todayISO())} · کانال‌ها: ${esc((SNAP.channels || []).join('، ') || '—')}${SNAP.range && SNAP.range.from ? ' · بازه: ' + J.format(SNAP.range.from) + (SNAP.range.to ? ' تا ' + J.format(SNAP.range.to) : ' تاکنون') : ''}</p></div>
  <div class="kpis"><div class="kpi"><b>${fa(items.length)}</b>نماد</div><div class="kpi"><b>${fa(codes.length)}</b>صنعت</div><div class="kpi"><b>${fa(n)}</b>کانال</div><div class="kpi"><b>${items.length ? fa(Math.round(items[0].sc)) : '—'}</b>بالاترین امتیاز (${items.length ? esc(items[0].rec.symbol) : ''})</div></div>
  <div class="rp-ind"><div class="rp-ih"><span>میانگین امتیاز نمادهای هر صنعت</span></div>${chart}</div>${blocks}
  <div class="ft">امتیاز ترکیبی از ارزانی (P/E نسبت به میانه‌ی صنعت)، روند سود فصلی، کیفیت سود، اندازه‌ی بازار و تأیید کانال‌هاست و توصیه‌ی مالی نیست. فقط نمادهای مطرح‌شده در کانال(ها) بررسی شده و اعداد باید با کدال تطبیق داده شود.</div>`;
}
$('pdf').onclick = () => {
  if (!SNAP || !SNAP.records.length) return;
  buildReport(); const t = document.title; document.title = 'گزارش-نمادها-' + J.format(J.todayISO()).replace(/\s+/g, '-');
  setTimeout(() => { window.print(); document.title = t; }, 50);
};

/* ---------- زبانه‌ها و شروع ---------- */
document.querySelectorAll('.tabs button[data-t]').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.tabs button[data-t]').forEach((x) => x.classList.toggle('on', x === b));
  ['list', 'ck', 'perf'].forEach((t) => $(t).classList.toggle('hide', b.dataset.t !== t));
  if (b.dataset.t === 'ck') renderCk(); if (b.dataset.t === 'perf') perfLoad();
});
function renderAll() { renderRank(); }
const rng = store.get('range', { from: '', to: '' });
mkPicker('pfrom', rng.from, true); mkPicker('pto', rng.to, true);
$('chs').value = store.get('chs', $('chs').value);
buildWeights(); buildLib(); load();
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
