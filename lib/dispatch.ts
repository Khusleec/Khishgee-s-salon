// ---------------------------------------------------------------------------
// Маршрут тараагч — Next.js route handler-ийн web Request-ийг lib/api.ts дахь
// маршрутын хүснэгтэд тааруулж, Ctx үүсгэн ажиллуулна.
//
// Ингэснээр API-ийн бүх логик (нэвтрэлт, захиалга, QPay, CSV гэх мэт) нэг
// дор, өмнөх хувилбартай яг ижил URL/хариултаар үлдэнэ.
// ---------------------------------------------------------------------------

import routes from './api.ts';
import type { Ctx, Route } from './types.ts';

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

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/**
 * Хүсэлтийг маршрутын хүснэгтээр тааруулж ажиллуулна.
 * Тохирох маршрут байхгүй бол null (дуудагч тал 404-өө шийднэ).
 */
export async function dispatch(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  for (const route of compiled) {
    if (route.method !== method) continue;
    const m = route.rx.exec(pathname);
    if (!m) continue;

    // ---- Ctx угсрах --------------------------------------------------------
    let response: Response | null = null;
    const pendingCookies: string[] = [];

    const finish = (body: BodyInit, status: number, headers: Record<string, string | number>): void => {
      if (response) return;                     // эхний хариулт л хүчинтэй
      const h = new Headers();
      for (const [k, v] of Object.entries(headers)) h.set(k, String(v));
      for (const c of pendingCookies) h.append('Set-Cookie', c);
      response = new Response(body, { status, headers: h });
    };

    const ctx: Ctx = {
      url,
      headers: request.headers,
      query: Object.fromEntries(url.searchParams),
      cookies: parseCookies(request.headers.get('cookie') || ''),
      params: {},
      body: null,
      setCookie(name, value, opts = {}) {
        const bits = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
        if (opts.maxAge != null) bits.push(`Max-Age=${opts.maxAge}`);
        pendingCookies.push(bits.join('; '));
      },
      json(data, status = 200) {
        const buf = Buffer.from(JSON.stringify(data), 'utf8');
        finish(buf, status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length });
      },
      raw(buf, type, status = 200, extra = {}) {
        finish(buf as unknown as BodyInit, status, { 'Content-Type': type, ...extra });
      },
      fail(message, status = 400) {
        ctx.json({ ok: false, error: message }, status);
      },
    };

    route.keys.forEach((k, i) => { ctx.params[k] = decodeURIComponent(m[i + 1]); });

    // ---- Биеийг унших ------------------------------------------------------
    if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
      try {
        const limit = route.limit || 1024 * 512;
        const buf = Buffer.from(await request.arrayBuffer());
        if (buf.length > limit) { ctx.fail('Хэт том хүсэлт', 413); return response; }
        if (route.raw) {
          ctx.rawBody = buf;
          ctx.body = {};
        } else {
          ctx.body = buf.length ? JSON.parse(buf.toString('utf8')) : {};
        }
      } catch {
        ctx.body = {};
      }
    }

    // ---- Ажиллуулах --------------------------------------------------------
    try {
      await route.handler(ctx);
    } catch (err) {
      console.error(`[${method} ${pathname}]`, err);
      if (!response) ctx.fail('Серверийн алдаа гарлаа', 500);
    }

    return response ?? new Response(null, { status: 204 });
  }

  return null;
}

/** /api/* доторх тохирохгүй хаягт өгөх стандарт 404 */
export function apiNotFound(): Response {
  return Response.json({ ok: false, error: 'Ийм хаяг олдсонгүй' }, { status: 404 });
}
