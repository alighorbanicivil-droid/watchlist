(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Merge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ts = (d) => (d ? Date.parse(d) : NaN);

  // از همه‌ی گزارش‌ها و ذکرها، فقط آنچه در بازه‌ی [from, to] (YYYY-MM-DD، میلادی) منتشر شده برمی‌دارد،
  // جدیدترین گزارش هر نماد را انتخاب می‌کند و تعداد کانال‌های تأییدکننده را می‌شمارد.
  // «تأیید» یعنی کانال گزارش مالی آن نماد را منتشر یا آن را با هشتگ ذکر کرده است.
  // اگر بازه تعیین شده باشد، گزارش بدون تاریخ داخل بازه حساب نمی‌شود.
  function derive(reports, mentions, from, to) {
    const f = from ? Date.parse(from + 'T00:00:00Z') : null, t = to ? Date.parse(to + 'T23:59:59Z') : null;
    const inR = (d) => {
      if (f == null && t == null) return true;
      const x = ts(d);
      if (Number.isNaN(x)) return false;
      return (f == null || x >= f) && (t == null || x <= t);
    };
    const by = new Map();
    for (const r of reports || []) {
      if (!inR(r.date)) continue;
      let c = by.get(r.symbol);
      if (!c) { c = { latest: r, channels: new Set() }; by.set(r.symbol, c); }
      c.channels.add(r.channel);
      const a = ts(r.date), b = ts(c.latest.date);
      if (a > b || (Number.isNaN(a) && Number.isNaN(b) && r.postId > c.latest.postId)) c.latest = r;
    }
    const ment = new Map();
    for (const m of mentions || []) {
      const ch = m[0], sym = m[1], d = m[2];
      if (!by.has(sym) || !inR(d)) continue;
      if (!ment.has(sym)) ment.set(sym, new Set());
      ment.get(sym).add(ch);
    }
    return [...by].map(([sym, c]) => {
      const m = ment.get(sym) || new Set();
      return Object.assign({}, c.latest, { channels: [...c.channels], mentionedBy: [...m], confirms: new Set([...c.channels, ...m]).size });
    });
  }
  return { derive };
});
