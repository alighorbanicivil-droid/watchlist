(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Jalali = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const fa = (n) => Number(n).toLocaleString('fa-IR', { useGrouping: false });

  function toJalali(gy, gm, gd) {
    const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gdm[gm - 1];
    let jy = -1595 + 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    let jm, jd;
    if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + (days % 31); }
    else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + ((days - 186) % 30); }
    return [jy, jm, jd];
  }

  function toGregorian(jy, jm, jd) {
    jy += 1595;
    let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    let gd = days + 1;
    const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
    const sal = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 0;
    while (gm < 13 && gd > sal[gm]) { gd -= sal[gm]; gm++; }
    return [gy, gm, gd];
  }

  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (gy, gm, gd) => `${gy}-${pad(gm)}-${pad(gd)}`;
  // تاریخ میلادی (YYYY-MM-DD یا ISO کامل) -> [jy, jm, jd]
  function fromISO(iso) { const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? toJalali(+m[1], +m[2], +m[3]) : null; }
  // [jy,jm,jd] -> YYYY-MM-DD میلادی
  function jToISO(jy, jm, jd) { const g = toGregorian(jy, jm, jd); return isoOf(g[0], g[1], g[2]); }
  function daysInMonth(jy, jm) { return jm <= 6 ? 31 : jm <= 11 ? 30 : (isLeap(jy) ? 30 : 29); }
  function isLeap(jy) { return toJalali(...toGregorian(jy, 12, 30).slice(0, 3))[2] === 30 && toJalali(...toGregorian(jy, 12, 30))[1] === 12; }
  // «۲ آبان ۱۴۰۵»
  function format(iso) { const j = fromISO(iso); return j ? `${fa(j[2])} ${MONTHS[j[1] - 1]} ${fa(j[0])}` : '—'; }
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const daysSince = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 864e5);

  return { MONTHS, toJalali, toGregorian, fromISO, jToISO, daysInMonth, format, todayISO, daysSince, fa };
});
