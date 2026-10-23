'use strict';
const { NAMES } = require('./industries');
const { fetchChannels } = require('./channel');
const { applyPrices } = require('./prices');
const { derive } = require('../merge.js');

// نتیجه‌ی چند کانال را یکی می‌کند: همه‌ی گزارش‌ها + همه‌ی ذکرها (با نام کانال)
function collect(results) {
  const ok = results.filter((r) => !r.error);
  return {
    reports: ok.flatMap((r) => r.reports),
    mentions: ok.flatMap((r) => r.mentions.map(([sym, d]) => [r.channel, sym, d])),
  };
}

async function buildFromChannels(names, { from = '', to = '', pages = 3, maxPages, prices = true } = {}) {
  const results = await fetchChannels(names, { from, to, pages, maxPages });
  const { reports, mentions } = collect(results);
  const records = derive(reports, mentions, from, to);
  const priceInfo = prices ? await applyPrices(records) : { ok: 0, failed: 0, skipped: true };
  const priceMap = {};
  for (const r of records) if (r.priceNow) priceMap[r.symbol] = r.priceNow;
  return {
    generatedAt: new Date().toISOString(),
    range: { from: from || null, to: to || null },
    channels: results.filter((r) => !r.error).map((r) => r.channel),
    failed: results.filter((r) => r.error).map((r) => ({ channel: r.channel, error: r.error })),
    scanned: results.reduce((a, r) => a + (r.scanned || 0), 0),
    truncated: results.some((r) => r.truncated),
    prices: priceInfo,
    priceMap,
    industries: NAMES,
    records, // جدیدترین گزارش هر نماد در کل بازه
    reports, // همه‌ی گزارش‌ها؛ مرورگر با آن‌ها بازه‌ی دلخواه را فیلتر می‌کند
    mentions,
  };
}

module.exports = { collect, buildFromChannels };
