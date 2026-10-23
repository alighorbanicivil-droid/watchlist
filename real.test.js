'use strict';
// متن پست‌های واقعی کانال @FocusWatchList (۲۰۲۶-۱۰)؛ برای اینکه اگر قالب پست‌ها عوض شد زود بفهمیم.
const test = require('node:test');
const assert = require('node:assert');
const { parsePage, extractRecord } = require('../lib/parser');

const REAL = {
  شراز: '#شراز\n🔵 صورت مالی شش ماهه‌ی حسابرسی نشده؛\n🔵 مروری بر سود فصلی:\nسود بهار 4760 ریال\nسود تابستان 17126 ریال\n✅سود شش ماهه 21886 ریال\nقیمت روز 95610 ریال\nارزش بازار 105 همت',
  نان: '#نان\n🔵 صورت مالی شش ماهه‌ی حسابرسی نشده؛\n✅سود شش ماهه 849 ریال*\nقیمت روز 6560 ریال\nارزش بازار 6/6 همت\n* 120 ریال از سود مربوط به تسعیر دارایی ارزی است.',
  فولاد: '#فولاد\n🔵 صورت مالی شش ماهه‌ی حسابرسی نشده؛\n✅سود شش ماهه 306 ریال*\nقیمت روز 4220 ریال\nارزش بازار 817 همت\n* 35 ریال از سود مربوط به تسعیر دارایی‌های ارزی و 40 ریال مربوط به سود فروش ضایعات و سرمایه‌گذاری‌ها است.\n_ بخشی از سود در انتهای سال و از تقسیم سود سرمایه‌گذاری‌ها حاصل می‌شود.',
  خودرو: '#خودرو\n🔵 صورت مالی شش ماهه‌ی حسابرسی نشده؛\n✅شش ماهه 31 ریال زیان\nقیمت روز 679 ریال\nارزش بازار 174 همت\n‼️ باید توجه داشت که زیان انباشته‌ی شرکت در انتهای دوره‌ی شش ماهه حدود 128 همت است.',
  وتوشه: '#وتوشه\n🔵 صورت مالی شش ماهه‌ی حسابرسی نشده؛\n🔵 مروری بر سود فصلی:\nسود بهار 391 ریال\nسود تابستان 1019 ریال\n✅سود شش ماهه 1410 ریال*\nقیمت روز 9710 ریال\nارزش بازار 9/7 همت\n* 44% از سود ناخالص مربوط به تسعیر دارایی ارزی و 52% درآمد سود سهام است.\n◀️ ارزش پورتفوی بورسی شرکت در انتهای شهریور ماه 14/4 همت است که وزن اصلی آن را به ترتیب #لخزر، #بشهاب و #وخاور تشکیل می‌دهد.\n⏳ برنامه‌ی افزایش سرمایه‌ی 30% از سود انباشته دارد که مجمع آن 30 شهریور برگزار می‌شود.',
  حفاری: '#حفاری\n🔵 صورت مالی شش ماهه‌ی حسابرسی نشده؛\n✅ سود شش ماهه 830 ریال*\nقیمت روز 5980 ریال\nارزش بازار 10/8 همت\n* 460 ریال از سود مربوط به تسعیر دارایی ارزی است.\n_ فروش ماهانه در انتهای دوره‌ی فصلی تعدیل می‌شود.',
};
const SALES = '#شگویا 🔵 گزارش فروش شهریور؛ ✅ سود سه ماهه 10 ریال قیمت روز 13310 ریال ارزش بازار 45/2 همت';
const rec = (name) => extractRecord({ id: 1, date: '2026-10-21T11:05:00+00:00', text: REAL[name] });

test('شراز: روند فصلی و ارزش بازار', () => {
  const r = rec('شراز');
  assert.deepStrictEqual([r.eps, r.price, r.mcap, r.q1, r.q2, r.w, r.industry], [21886, 95610, 105, 4760, 17126, 0, 'P']);
});
test('نان: سود یک‌باره ۱۴٪ ⇒ w=0 و ارزش بازار اعشاری', () => {
  const r = rec('نان');
  assert.deepStrictEqual([r.mcap, r.w], [6.6, 0]);
});
test('فولاد: فقط ۳۵ ریال تسعیر شمرده می‌شود ⇒ w=0', () => assert.strictEqual(rec('فولاد').w, 0));
test('خودرو: زیان', () => { const r = rec('خودرو'); assert.deepStrictEqual([r.eps, r.w], [-31, 2]); assert.match(r.note, /زیان انباشته/); });
test('وتوشه: ۴۴٪ تسعیر ⇒ w=1 و افزایش سرمایه در نکته', () => { const r = rec('وتوشه'); assert.strictEqual(r.w, 1); assert.match(r.note, /افزایش سرمایه 30٪/); });
test('حفاری: ۴۶۰ از ۸۳۰ ⇒ w=1', () => assert.strictEqual(rec('حفاری').w, 1));
test('گزارش فروش رد می‌شود', () => assert.strictEqual(extractRecord({ id: 2, text: SALES }), null));

test('پیش‌نمایش ریپلای جای متن اصلی را نمی‌گیرد', () => {
  const html = `<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="FocusWatchList/11792">
  <div class="tgme_widget_message_reply"><div class="tgme_widget_message_text js-message_reply_text">Watch List #شگویا 🔵 گزارش فروش شهریور</div></div>
  <div class="tgme_widget_message_text js-message_text" dir="auto"><a href="?q=%23x">#شگویا</a><br/>🔵 صورت مالی شش ماهه‌ی حسابرسی نشده؛<br/><b>سود شش ماهه 935 ریال</b><br/>قیمت روز 13450 ریال<br/>ارزش بازار 45/7 همت</div>
  <a class="tgme_widget_message_date"><time datetime="2026-10-21T11:24:00+00:00" class="time">11:24</time></a></div></div>`;
  const { posts } = parsePage(html);
  assert.strictEqual(posts.length, 1);
  const r = extractRecord(posts[0]);
  assert.deepStrictEqual([r.symbol, r.eps, r.mcap, r.date], ['شگویا', 935, 45.7, '2026-10-21T11:24:00+00:00']);
  assert.deepStrictEqual(posts[0].tags, ['شگویا']);
});
