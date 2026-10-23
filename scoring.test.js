'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('../scoring.js');
const J = require('../jalali.js');
const { derive } = require('../merge.js');
const { collect } = require('../lib/snapshot');
const { pickInsCode, parsePrice } = require('../lib/prices');

const mk = (symbol, industry, eps, price, extra = {}) => ({ symbol, industry, period: 6, eps, price, mcap: 20, q1: null, q2: null, w: 0, confirms: 1, ...extra });

test('P/E با میانه‌ی صنعت خودش مقایسه می‌شود', () => {
  // هر دو P/E=2.5 ولی صنعت A گران‌تر است ⇒ نماد داخل A باید نسبت به صنعتش ارزان‌تر حساب شود
  const recs = [mk('a1', 'A', 100, 500), mk('a2', 'A', 100, 1000), mk('a3', 'A', 100, 1500), mk('a4', 'A', 100, 2000),
    mk('b1', 'B', 100, 500), mk('b2', 'B', 100, 520), mk('b3', 'B', 100, 540)];
  const { items, stats } = S.rankAll(recs);
  assert.ok(stats.byInd.A.median > stats.byInd.B.median);
  const a1 = items.find((i) => i.rec.symbol === 'a1'), b1 = items.find((i) => i.rec.symbol === 'b1');
  assert.ok(a1.rel < b1.rel);
  assert.match(a1.short, /پایین‌تر از میانه صنعت/);
});
test('صنعت با کمتر از ۳ نماد از میانه‌ی کل استفاده می‌کند', () => {
  const recs = [mk('x', 'Z', 100, 500), mk('a', 'A', 100, 600), mk('b', 'A', 100, 700), mk('c', 'A', 100, 800)];
  assert.strictEqual(S.industryStats(recs).byInd.Z.fallback, true);
});
test('سود یک‌باره و زیان امتیاز را کم می‌کنند و دلیل می‌دهند', () => {
  const recs = [mk('ok', 'A', 100, 500), mk('w1', 'A', 100, 500, { w: 1 }), mk('w2', 'A', 100, 500, { w: 2 }), mk('loss', 'A', -5, 500, { w: 2 })];
  const { items } = S.rankAll(recs);
  const sc = Object.fromEntries(items.map((i) => [i.rec.symbol, i.sc]));
  assert.ok(sc.ok > sc.w1 && sc.w1 > sc.w2 && sc.w2 > sc.loss);
  assert.match(items.find((i) => i.rec.symbol === 'loss').reasons[0], /زیان‌ده/);
});
test('تأیید چند کانال فقط وقتی nCh>1 اثر و دلیل دارد', () => {
  const recs = [mk('t', 'A', 100, 500, { confirms: 3 }), mk('u', 'A', 100, 500, { confirms: 1 })];
  const one = S.rankAll(recs, S.DEFAULT_W, 1).items, three = S.rankAll(recs, S.DEFAULT_W, 3).items;
  assert.ok(!one[0].reasons.some((r) => /کانال/.test(r)));
  assert.strictEqual(three[0].rec.symbol, 't');
  assert.ok(three[0].reasons.some((r) => /تأیید ۳ از ۳ کانال/.test(r)));
});
test('رتبه‌ی داخل صنعت', () => {
  const { items } = S.rankAll([mk('a', 'A', 100, 500), mk('b', 'A', 100, 900), mk('c', 'B', 100, 500)]);
  assert.deepStrictEqual(items.filter((i) => i.rec.industry === 'A').map((i) => i.rk), [1, 2]);
});

test('تاریخ شمسی: نقاط مرجع و رفت‌وبرگشت', () => {
  assert.deepStrictEqual(J.toJalali(2026, 3, 21), [1405, 1, 1]);
  assert.deepStrictEqual(J.toJalali(2026, 9, 23), [1405, 7, 1]);
  assert.strictEqual(J.format('2026-10-23'), '۱ آبان ۱۴۰۵');
  assert.strictEqual(J.jToISO(1405, 8, 1), '2026-10-23');
  assert.strictEqual(J.daysInMonth(1403, 12), 30); // سال کبیسه
  assert.strictEqual(J.daysInMonth(1404, 12), 29);
  for (let y = 2020; y < 2032; y++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= 28; d++)
    assert.deepStrictEqual(J.toGregorian(...J.toJalali(y, m, d)), [y, m, d]);
});

const rp = (channel, symbol, eps, date, postId = 1) => ({ channel, symbol, eps, date, postId });
const REPS = [
  rp('A', 'س', 1, '2026-10-01T10:00:00+00:00', 5), rp('B', 'س', 2, '2026-10-05T10:00:00+00:00', 9),
  rp('A', 'ص', 3, '2026-08-01T10:00:00+00:00', 2), rp('A', 'ع', 4, null, 1),
];
const MENTS = [['A', 'س', '2026-10-02T00:00:00+00:00'], ['C', 'س', '2026-10-03T00:00:00+00:00'], ['D', 'س', '2026-07-01T00:00:00+00:00'], ['C', 'ص', '2026-08-02T00:00:00+00:00']];

test('derive بدون بازه: جدیدترین گزارش و کانال‌های تأییدکننده', () => {
  const m = derive(REPS, MENTS);
  const s = m.find((r) => r.symbol === 'س');
  assert.deepStrictEqual([m.length, s.eps, s.confirms, s.channels.sort().join(), s.mentionedBy.sort().join()], [3, 2, 4, 'A,B', 'A,C,D']);
});
test('derive با بازه: فقط نمادهای منتشرشده در بازه و ذکرهای همان بازه', () => {
  const m = derive(REPS, MENTS, '2026-09-20', '2026-10-31');
  assert.deepStrictEqual(m.map((r) => r.symbol), ['س']); // «ص» قدیمی و «ع» بدون تاریخ خارج‌اند
  assert.strictEqual(m[0].confirms, 3); // A و B و C؛ ذکر D مربوط به تیر است
});
test('derive: اگر گزارش جدیدتر از «تا تاریخ» باشد، گزارش قدیمی‌تر داخل بازه انتخاب می‌شود', () => {
  const m = derive(REPS, MENTS, '2026-09-20', '2026-10-03');
  assert.strictEqual(m[0].eps, 1);
});
test('derive: بازه‌ای که نمادی ندارد خالی است', () => assert.deepStrictEqual(derive(REPS, MENTS, '2025-01-01', '2025-02-01'), []));
test('collect: نام کانال به ذکرها اضافه می‌شود و کانال خطادار حذف', () => {
  const c = collect([{ channel: 'A', reports: [1], mentions: [['x', 'd']] }, { channel: 'B', error: 'e', reports: [], mentions: [] }]);
  assert.deepStrictEqual([c.reports.length, c.mentions[0].join()], [1, 'A,x,d']);
});

test('قیمت: انتخاب کد و استخراج قیمت (قالب فرضی؛ با سرویس واقعی تست نشده)', () => {
  assert.strictEqual(pickInsCode('فولاد,فولاد مبارکه,46348559193224090,x;فولاد1,حق تقدم,111,x', 'فولاد'), '46348559193224090');
  assert.strictEqual(pickInsCode('', 'فولاد'), null);
  assert.strictEqual(parsePrice('09:01:02,A ,3560,3550,3500;x'), 3550);
  assert.strictEqual(parsePrice('x'), null);
});
