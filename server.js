'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseChannels } = require('./lib/channel');
const { buildFromChannels } = require('./lib/snapshot');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

// محدودیت ساده‌ی درخواست برای هر IP (۱۵ درخواست در دقیقه)
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 15;
}

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/snapshot') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (limited(ip)) return send(res, 429, { error: 'درخواست‌ها زیاد است؛ یک دقیقه بعد دوباره تلاش کن.' });
    const { names, bad } = parseChannels(url.searchParams.get('urls'));
    if (!names.length) return send(res, 400, { error: 'لینک کانال معتبر نیست. نمونه: https://t.me/FocusWatchList' });
    try {
      const snap = await buildFromChannels(names, {
        from: url.searchParams.get('from') || '',
        to: url.searchParams.get('to') || '',
        prices: url.searchParams.get('prices') !== '0',
      });
      if (bad.length) snap.failed.push(...bad.map((b) => ({ channel: b, error: 'لینک نامعتبر' })));
      return send(res, 200, snap);
    } catch (e) {
      return send(res, 502, { error: e.message || 'خطا در دریافت اطلاعات کانال' });
    }
  }
  // فایل‌های استاتیک
  let p = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

if (require.main === module) server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
module.exports = server;
