import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { db, seedDatabase } from './db.ts';
import routes from './api.ts';
import * as config from './config.ts';
import type { Ctx, Route } from './types.ts';

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(import.meta.dirname, '..', 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

// ---------------------------------------------------------------------------
// Туслах
// ---------------------------------------------------------------------------
function parseCookies(header = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req: IncomingMessage, limit = 1024 * 512): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) { reject(new Error('too-large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function compile(pattern: string): { rx: RegExp; keys: string[] } {
  const keys: string[] = [];
  const rx = new RegExp('^' + pattern.replace(/:([A-Za-z_]+)/g, (_, k: string) => {
    keys.push(k);
    return '([^/]+)';
  }) + '$');
  return { rx, keys };
}

type CompiledRoute = Route & { rx: RegExp; keys: string[] };

const compiled: CompiledRoute[] = routes.map((r) => ({ ...r, ...compile(r.path) }));

// ---------------------------------------------------------------------------
// Статик файл
// ---------------------------------------------------------------------------
function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): void {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';

  const full = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403).end('Forbidden'); return; }

  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      // SPA: мэдэгдэхгүй зам бүрийг зохих бүрхүүлд буулгана
      const shell = rel.startsWith('/admin') ? 'admin.html' : 'index.html';
      const file = path.join(PUBLIC_DIR, shell);
      fs.readFile(file, (e2, buf) => {
        if (e2) { res.writeHead(404).end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(buf);
      });
      return;
    }
    const ext = path.extname(full).toLowerCase();
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=3600';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    fs.createReadStream(full).pipe(res);
  });
}

// ---------------------------------------------------------------------------
// Сервер
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  const ctx: Ctx = {
    req,
    res,
    url,
    query: Object.fromEntries(url.searchParams),
    cookies: parseCookies(req.headers.cookie),
    params: {},
    body: null,
    setCookie(name, value, opts = {}) {
      const bits = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
      if (opts.maxAge != null) bits.push(`Max-Age=${opts.maxAge}`);
      const prev = res.getHeader('Set-Cookie');
      const list = prev ? (Array.isArray(prev) ? prev : [String(prev)]) : [];
      res.setHeader('Set-Cookie', [...list, bits.join('; ')]);
    },
    json(data, status = 200) {
      const buf = Buffer.from(JSON.stringify(data), 'utf8');
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length });
      res.end(buf);
    },
    raw(buf, type, status = 200, extra = {}) {
      res.writeHead(status, { 'Content-Type': type, ...extra });
      res.end(buf);
    },
    fail(message, status = 400) {
      ctx.json({ ok: false, error: message }, status);
    },
  };

  for (const route of compiled) {
    if (route.method !== req.method) continue;
    const m = route.rx.exec(pathname);
    if (!m) continue;
    route.keys.forEach((k, i) => { ctx.params[k] = decodeURIComponent(m[i + 1]); });

    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT' || req.method === 'DELETE') {
      try {
        // Зураг байршуулах зэрэг маршрут түүхий биеийг өөрөө задална
        const limit = route.limit || 1024 * 512;
        const buf = await readBody(req, limit);
        if (route.raw) {
          ctx.rawBody = buf;
          ctx.body = {};
        } else {
          ctx.body = buf.length ? JSON.parse(buf.toString('utf8')) : {};
        }
      } catch (e) {
        if ((e as Error).message === 'too-large') return ctx.fail('Хэт том хүсэлт', 413);
        ctx.body = {};
      }
    }

    try {
      await route.handler(ctx);
    } catch (err) {
      console.error(`[${req.method} ${pathname}]`, err);
      if (!res.headersSent) ctx.fail('Серверийн алдаа гарлаа', 500);
    }
    return;
  }

  if (pathname.startsWith('/api/')) return ctx.fail('Ийм хаяг олдсонгүй', 404);
  serveStatic(req, res, pathname);
});

// ---------------------------------------------------------------------------
// Эхлүүлэх
// ---------------------------------------------------------------------------
const fresh = seedDatabase();
setInterval(() => {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}, 3600_000).unref();

server.listen(PORT, () => {
  const line = '─'.repeat(58);
  console.log(`\n${line}`);
  console.log(`  Khishgee's Salon  ·  сервер ажиллаж байна`);
  console.log(line);
  console.log(`  Дэлгүүр : http://localhost:${PORT}/`);
  console.log(`  Админ   : http://localhost:${PORT}/admin`);
  console.log(line);
  console.log(`  Админ нэвтрэх : 99112233 / admin123`);
  console.log(`  Хэрэглэгч     : 99001122 / test1234`);
  console.log(line);
  const modes = config.summary();
  console.log(`  QPay : ${modes.qpay}${modes.qpay === 'mock' ? '  (.env-д түлхүүр нэмбэл live болно)' : ''}`);
  console.log(`  SMS  : ${modes.sms}${modes.sms === 'mock' ? '   (мессеж консол дээр хэвлэгдэнэ)' : ''}`);
  console.log(`${line}\n`);
  if (fresh) console.log('  ✔ Мэдээллийн сан үүсгэж, жишээ өгөгдөл ачааллаа.\n');
});
