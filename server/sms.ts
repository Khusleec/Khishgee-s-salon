// ---------------------------------------------------------------------------
// SMS илгээгч
//
// Гурван провайдер:
//   mock   — гадагш юу ч явуулахгүй, зөвхөн sms_outbox-д бичиж консолд хэвлэнэ
//   http   — ерөнхий HTTP gateway (Монголын оператор/агрегаторуудад тохирно)
//   twilio — Twilio Messages API
//
// Провайдер хамаарахгүйгээр бүх мессеж sms_outbox хүснэгтэд үлдэнэ. Тиймээс
// админ «Мессеж» хуудаснаас юу явсныг, амжилттай эсэхийг хардаг.
// ---------------------------------------------------------------------------

import { db, getSettings } from './db.ts';
import * as cfg from './config.ts';
import type { OrderRow } from './types.ts';

const now = (): string => new Date().toISOString();

// --------------------------- Дугаар цэгцлэх ---------------------------------
export function normalize(phone: string | number | null | undefined): string {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  // Аль хэдийн улсын кодтой бол хэвээр
  if (digits.length > 8 && digits.startsWith(cfg.sms.countryCode)) return digits;
  if (digits.length === 8) return cfg.sms.countryCode + digits;
  return digits;
}

// ------------------------------ Илгээх --------------------------------------
async function deliverHttp(to: string, text: string): Promise<string> {
  const fill = (tpl: string): string => String(tpl || '')
    .replace(/\{to\}/g, encodeURIComponent(to))
    .replace(/\{text\}/g, encodeURIComponent(text))
    .replace(/\{from\}/g, encodeURIComponent(cfg.sms.from));

  let url = cfg.sms.url;
  const headers: Record<string, string> = {};
  const opts: RequestInit = { method: cfg.sms.method, headers };
  if (cfg.sms.authHeader) headers.Authorization = cfg.sms.authHeader;

  if (cfg.sms.method === 'GET') {
    const q = fill(cfg.sms.query);
    if (q) url += (url.includes('?') ? '&' : '?') + q;
  } else {
    headers['Content-Type'] = cfg.sms.contentType;
    opts.body = cfg.sms.body
      ? fill(cfg.sms.body)
      : `from=${encodeURIComponent(cfg.sms.from)}&to=${encodeURIComponent(to)}&text=${encodeURIComponent(text)}`;
  }

  const res = await fetch(url, opts);
  const body = await res.text();
  if (!res.ok) throw new Error(`gateway ${res.status}: ${body.slice(0, 200)}`);
  return body.slice(0, 500);
}

async function deliverTwilio(to: string, text: string): Promise<string> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.sms.twilioSid}/Messages.json`;
  const auth = Buffer.from(`${cfg.sms.twilioSid}:${cfg.sms.twilioToken}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: '+' + to, From: cfg.sms.twilioFrom, Body: text }).toString(),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`twilio ${res.status}: ${body.slice(0, 200)}`);
  return body.slice(0, 500);
}

export type SmsOpts = {
  kind?: 'order' | 'status' | 'reset' | 'test' | 'other';
  orderId?: number | null;
};

export type SmsResult = {
  ok: boolean;
  id?: number | bigint;
  mock?: boolean;
  to?: string;
  text?: string;
  raw?: string;
  error?: string;
};

/**
 * Мессеж илгээнэ. Хэзээ ч алдаа шиднэ гэж бүү бод — захиалга үүсэх урсгалыг
 * SMS-ийн алдаа зогсоох ёсгүй тул алдааг зөвхөн sms_outbox-д тэмдэглэнэ.
 */
export async function sendSms(phone: string, text: string, opts: SmsOpts = {}): Promise<SmsResult> {
  const to = normalize(phone);
  const kind = opts.kind || 'other';
  const provider = cfg.sms.live ? cfg.sms.provider : 'mock';

  if (!to) return { ok: false, error: 'Дугаар байхгүй' };

  const res = db.prepare(
    `INSERT INTO sms_outbox(phone, body, kind, provider, status, order_id, created_at)
     VALUES(?, ?, ?, ?, 'queued', ?, ?)`
  ).run(to, text, kind, provider, opts.orderId ?? null, now());
  const id = res.lastInsertRowid;

  const mark = (status: string, error: string | Error = ''): void => {
    db.prepare('UPDATE sms_outbox SET status = ?, error = ? WHERE id = ?').run(status, String(error).slice(0, 400), id);
  };

  if (!cfg.sms.live) {
    // mock — консол дээр харуулна, ингэснээр хөгжүүлэлтийн үед бүх урсгал бүтэн
    console.log(`\n  ┌─ SMS (mock) → +${to}`);
    for (const line of text.split('\n')) console.log(`  │  ${line}`);
    console.log('  └─ (жинхэнэ илгээхийн тулд .env-д SMS_PROVIDER тохируулна уу)\n');
    mark('sent');
    return { ok: true, id, mock: true, to, text };
  }

  try {
    const raw = cfg.sms.provider === 'twilio'
      ? await deliverTwilio(to, text)
      : await deliverHttp(to, text);
    mark('sent');
    return { ok: true, id, to, raw };
  } catch (e) {
    const err = e as Error;
    console.error('[sms]', err.message);
    mark('failed', err.message);
    return { ok: false, id, error: err.message };
  }
}

// ------------------------------ Загварууд -----------------------------------
const STATUS_TEXT: Record<string, string> = {
  new: 'хүлээн авлаа',
  confirmed: 'баталгаажлаа',
  packed: 'савлагдаж дууслаа',
  shipping: 'хүргэлтэд гарлаа',
  delivered: 'хүргэгдлээ',
  cancelled: 'цуцлагдлаа',
};

const mnt = (n: number | null | undefined): string => Number(n || 0).toLocaleString('mn-MN') + '₮';

export function orderCreatedText(order: OrderRow): string {
  const s = getSettings();
  return `${s.store_name}\nЗахиалга ${order.code} хүлээн авлаа.\nДүн: ${mnt(order.total)}\nБид удахгүй холбогдоно. Утас: ${s.phone}`;
}

export function orderStatusText(order: OrderRow): string {
  const s = getSettings();
  const word = STATUS_TEXT[order.status] || order.status;
  let extra = '';
  if (order.status === 'shipping') extra = '\nЖолооч тантай холбогдоно.';
  if (order.status === 'delivered') extra = '\nБидний үйлчилгээг сонгосонд баярлалаа!';
  if (order.status === 'cancelled') extra = `\nАсуулт байвал ${s.phone} руу залгана уу.`;
  return `${s.store_name}\nЗахиалга ${order.code} ${word}.${extra}`;
}

export function resetCodeText(code: string): string {
  const s = getSettings();
  return `${s.store_name}\nНууц үг сэргээх код: ${code}\n${cfg.reset.ttlMinutes} минутын дотор хүчинтэй.\nЭнэ хүсэлтийг та илгээгээгүй бол хэнд ч бүү дамжуулаарай.`;
}

// ------------------------- Захиалгын мэдэгдэл -------------------------------
export function notifyOrderCreated(order: OrderRow): void {
  if (!cfg.sms.notifyOnOrder) return;
  sendSms(order.phone, orderCreatedText(order), { kind: 'order', orderId: order.id });
}

export function notifyOrderStatus(order: OrderRow): void {
  if (!cfg.sms.notifyOnStatus) return;
  sendSms(order.phone, orderStatusText(order), { kind: 'status', orderId: order.id });
}
