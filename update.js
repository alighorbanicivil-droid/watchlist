'use strict';
// به‌روزرسانی خودکار: کانال‌های config.json را می‌خواند و data/ را می‌نویسد.
const fs = require('fs');
const path = require('path');
const { buildFromChannels } = require('../lib/snapshot');
const S = require('../scoring.js');

const DATA = path.join(__dirname, '..', 'data');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

(async () => {
  const now = new Date();
  const from = new Date(now.getTime() - (cfg.days || 90) * 864e5).toISOString().slice(0, 10);
  const snap = await buildFromChannels(cfg.channels, { from, maxPages: cfg.maxPages || 120, prices: cfg.prices !== false });
  if (!snap.records.length) throw new Error('هیچ گزارش مالی‌ای در بازه پیدا نشد؛ داده‌ی قبلی دست‌نخورده ماند.');

  fs.mkdirSync(path.join(DATA, 'history'), { recursive: true });
  fs.writeFileSync(path.join(DATA, 'latest.json'), JSON.stringify(snap));

  // تاریخچه‌ی فشرده برای بخش «سابقه عملکرد»
  const { items } = S.rankAll(snap.records, S.DEFAULT_W, snap.channels.length);
  const day = now.toISOString().slice(0, 10);
  const hist = {
    date: day,
    items: items.map((it) => ({
      s: it.rec.symbol, i: it.rec.industry, sc: Math.round(it.sc * 10) / 10, rk: it.rk,
      p: it.rec.priceNow || it.rec.price, src: it.rec.priceNow ? 'live' : 'report',
    })),
  };
  fs.writeFileSync(path.join(DATA, 'history', `${day}.json`), JSON.stringify(hist));
  const days = fs.readdirSync(path.join(DATA, 'history')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort();
  fs.writeFileSync(path.join(DATA, 'history', 'index.json'), JSON.stringify(days));

  console.log(`✓ ${snap.records.length} نماد از ${snap.channels.length} کانال | قیمت زنده: ${snap.prices.ok}/${snap.records.length}`);
  if (snap.truncated) console.warn('⚠️ به سقف maxPages رسید و به تاریخ شروع نرسید؛ days را کمتر یا maxPages را بیشتر کن.');
  if (snap.failed.length) console.warn('کانال‌های ناموفق:', snap.failed);
})().catch((e) => { console.error(e.message); process.exit(1); });
