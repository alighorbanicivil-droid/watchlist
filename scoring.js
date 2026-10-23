(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Scoring = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DEFAULT_W = { v: 35, g: 20, q: 25, s: 10, c: 10 };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fa = (n) => Number(n).toLocaleString('fa-IR');
  const f1 = (n) => Number(n).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const peOf = (r) => (r.eps > 0 ? r.price / (r.eps * (r.period === 6 ? 2 : 4 / 3)) : null);
  const growthOf = (r) => (r.q1 > 0 && r.q2 != null ? r.q2 / r.q1 - 1 : null);
  function median(a) {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // میانه‌ی P/E هر صنعت؛ اگر کمتر از ۳ نماد داشت، میانه‌ی کل نمادها جایگزین می‌شود.
  function industryStats(recs) {
    const all = recs.map(peOf).filter((x) => x != null);
    const overall = median(all) || 5;
    const byInd = {};
    for (const code of new Set(recs.map((r) => r.industry))) {
      const arr = recs.filter((r) => r.industry === code).map(peOf).filter((x) => x != null);
      byInd[code] = arr.length >= 3 ? { median: median(arr), n: arr.length, fallback: false } : { median: overall, n: arr.length, fallback: true };
    }
    return { overall, byInd };
  }

  function scoreOne(r, stats, W = DEFAULT_W, nCh = 1) {
    const pe = peOf(r), g = growthOf(r);
    const st = stats.byInd[r.industry] || { median: stats.overall, fallback: true };
    const rel = pe ? pe / st.median : null;
    const vRel = rel == null ? 0 : clamp(1.5 - rel, 0, 1);
    const vAbs = pe ? clamp((12 - pe) / 10, 0, 1) : 0;
    const parts = {
      v: 0.7 * vRel + 0.3 * vAbs,
      g: g == null ? 0.4 : clamp(g / 1.5, 0, 1),
      q: [1, 0.5, 0][r.w || 0],
      s: clamp(Math.log10(Math.max(r.mcap, 1)) / 2, 0, 1),
      c: nCh > 1 ? clamp(((r.confirms || 1) - 1) / (nCh - 1), 0, 1) : 0.5,
    };
    const tot = W.v + W.g + W.q + W.s + W.c || 1;
    const sc = (100 * (W.v * parts.v + W.g * parts.g + W.q * parts.q + W.s * parts.s + W.c * parts.c)) / tot;

    const label = st.fallback ? 'کل نمادها' : 'صنعت';
    const R = {};
    if (pe == null) R.pe = 'زیان‌ده؛ P/E معنی ندارد';
    else { const d = Math.round((1 - rel) * 100); R.pe = `P/E ${f1(pe)}؛ ${fa(Math.abs(d))}٪ ${d >= 0 ? 'پایین‌تر' : 'بالاتر'} از میانه ${label} (${f1(st.median)})`; }
    if (g != null) R.g = `سود فصل دوم ${g >= 0 ? '+' : '−'}${fa(Math.abs(Math.round(g * 100)))}٪ نسبت به فصل اول`;
    R.q = ['سود عمدتاً عملیاتی', 'بخشی از سود یک‌باره است', 'بخش عمده‌ی سود یک‌باره است'][r.w || 0];
    if (r.mcap < 3) R.s = 'ارزش بازار کوچک؛ نقدشوندگی کم';
    else if (r.mcap >= 50) R.s = 'ارزش بازار بزرگ و نقدشونده';
    if (nCh > 1) R.c = `تأیید ${fa(r.confirms || 1)} از ${fa(nCh)} کانال`;
    const reasons = ['pe', 'g', 'q', 's', 'c'].map((k) => R[k]).filter(Boolean);
    const short = [R.pe, r.w > 0 ? R.q : R.g || R.q, R.c].filter(Boolean).slice(0, 3).join(' · ');
    return { sc, pe, rel, g, parts, reasons, short, median: st.median };
  }

  // همه‌ی رکوردها را امتیاز می‌دهد و رتبه‌ی کل و رتبه‌ی داخل صنعت را می‌گذارد.
  function rankAll(recs, W = DEFAULT_W, nCh = 1) {
    const stats = industryStats(recs);
    const items = recs.map((rec) => ({ rec, ...scoreOne(rec, stats, W, nCh) })).sort((a, b) => b.sc - a.sc);
    const cnt = {};
    items.forEach((it, i) => { it.rkAll = i + 1; cnt[it.rec.industry] = (cnt[it.rec.industry] || 0) + 1; it.rk = cnt[it.rec.industry]; });
    return { items, stats };
  }

  return { DEFAULT_W, peOf, growthOf, median, industryStats, scoreOne, rankAll };
});
