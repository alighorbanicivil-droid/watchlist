'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parsePage, extractRecord } = require('../lib/parser');
const { parseChannel, parseDay, inRange } = require('../lib/channel');

const post = (id, inner) => `<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message text_not_supported_wrap js-widget_message" data-post="FocusWatchList/${id}"><div class="tgme_widget_message_text js-message_text" dir="auto">${inner}</div><a class="tgme_widget_message_date"><time datetime="2026-10-21T11:05:00+00:00" class="time">11:05</time></a></div></div>`;

const HTML =
  post(11789, '<a href="?q=%23%D8%B4%D8%B1%D8%A7%D8%B2">#شراز</a><br/><i class="emoji"><b>🔵</b></i> صورت مالی شش ماهه‌ی حسابرسی نشده؛<br/><br/>سود بهار 4760 ریال<br/>سود تابستان 17126 ریال<br/><br/><b>سود شش ماهه 21886 ریال</b><br/>قیمت روز 95610 ریال<br/>ارزش بازار 105 همت') +
  post(11790, '<a>#شبندر</a><br/>صورت مالی شش ماهه‌ی حسابرسی نشده؛<br/><b>سود شش ماهه 3010 ریال</b><br/>قیمت روز 15250 ریال<br/>ارزش بازار 625 همت<br/>برنامه‌ی افزایش سرمایه‌ی 119% از آورده‌ی نقدی دارد.') +
  post(11791, '<a>#حفاری</a><br/>صورت مالی شش ماهه‌ی حسابرسی نشده؛<br/><b>سود شش ماهه 830 ریال</b>*<br/>قیمت روز 5980 ریال<br/>ارزش بازار 10/8 همت<br/>* 460 ریال از سود مربوط به تسعیر دارایی ارزی است.') +
  post(11792, '<a>#خودرو</a><br/>صورت مالی شش ماهه‌ی حسابرسی نشده؛<br/><b>شش ماهه 31 ریال</b> زیان<br/>قیمت روز 679 ریال<br/>ارزش بازار 174 همت') +
  post(11793, '<a>#داترا</a> گزارش فروش مرداد؛ سود سه ماهه 268 ریال قیمت روز 6830 ریال ارزش بازار 3/9 همت') +
  '<div class="tgme_widget_message_wrap"><div data-post="FocusWatchList/11780"></div></div>';

test('parsePage: پست‌ها و کمترین شناسه', () => {
  const { posts, minId } = parsePage(HTML);
  assert.strictEqual(posts.length, 5);
  assert.strictEqual(minId, 11780);
});

test('extractRecord: گزارش عادی با روند فصلی', () => {
  const r = extractRecord(parsePage(HTML).posts[0]);
  assert.deepStrictEqual([r.symbol, r.industry, r.period, r.eps, r.price, r.mcap, r.q1, r.q2, r.w], ['شراز', 'P', 6, 21886, 95610, 105, 4760, 17126, 0]);
});

test('extractRecord: افزایش سرمایه در نکته', () => {
  const r = extractRecord(parsePage(HTML).posts[1]);
  assert.match(r.note, /افزایش سرمایه 119٪/);
});

test('extractRecord: سود یک‌باره و ارزش بازار اعشاری', () => {
  const r = extractRecord(parsePage(HTML).posts[2]);
  assert.strictEqual(r.mcap, 10.8);
  assert.strictEqual(r.w, 1); // 460/830 ≈ 55٪
});

test('extractRecord: زیان', () => {
  const r = extractRecord(parsePage(HTML).posts[3]);
  assert.strictEqual(r.eps, -31);
  assert.strictEqual(r.w, 2);
});

test('extractRecord: گزارش فروش نادیده گرفته می‌شود', () => {
  assert.strictEqual(extractRecord(parsePage(HTML).posts[4]), null);
});

test('parseChannel: فرمت‌های مختلف لینک', () => {
  for (const s of ['https://t.me/FocusWatchList', 't.me/s/FocusWatchList', '@FocusWatchList', 'FocusWatchList', 'https://t.me/FocusWatchList/11808'])
    assert.strictEqual(parseChannel(s), 'FocusWatchList');
  assert.strictEqual(parseChannel('https://evil.com/x'), null);
  assert.strictEqual(parseChannel('a'), null);
});

test('بازه‌ی تاریخ: parseDay و inRange', () => {
  assert.strictEqual(parseDay('2026-09-01', false), Date.UTC(2026, 8, 1));
  assert.strictEqual(parseDay('2026-09-01', true), Date.UTC(2026, 8, 1, 23, 59, 59));
  assert.strictEqual(parseDay('bad'), null);
  const f = parseDay('2026-09-01'), t = parseDay('2026-09-30', true);
  assert.ok(inRange(Date.parse('2026-09-15T10:00:00+00:00'), f, t));
  assert.ok(!inRange(Date.parse('2026-08-31T23:00:00+00:00'), f, t));
  assert.ok(!inRange(Date.parse('2026-10-01T00:00:00+00:00'), f, t));
  assert.ok(inRange(null, f, t));
});
