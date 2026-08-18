'use strict';

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

const { db, getSettings } = require('./db');
const cfg = require('./config');

const now = () => new Date().toISOString();

// --------------------------- Дугаар цэгцлэх ---------------------------------
function normalize(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  // Аль хэдийн улсын кодтой бол хэвээр
  if (digits.length > 8 && digits.startsWith(cfg.sms.countryCode)) return digits;
  if (digits.length === 8) return cfg.sms.countryCode + digits;
  return digits;
}

// ------------------------------ Илгээх --------------------------------------
async function deliverHttp(to, text) {
  const fill = (tpl) => String(tpl || '')
    .replace(/\{to\}/g, encodeURIComponent(to))
    .replace(/\{text\}/g, encodeURIComponent(text))
    .replace(/\{from\}/g, encodeURIComponent(cfg.sms.from));

  let url = cfg.sms.url;
  const opts = { method: cfg.sms.method, headers: {} };
  if (cfg.sms.authHeader) opts.headers.Authorization = cfg.sms.authHeader;

  if (cfg.sms.method === 'GET') {
    const q = fill(cfg.sms.query);
    if (q) url += (url.includes('?') ? '&' : '?') + q;
  } else {
    opts.headers['Content-Type'] = cfg.sms.contentType;
    opts.body = cfg.sms.body
      ? fill(cfg.sms.body)
      : `from=${encodeURIComponent(cfg.sms.from)}&to=${encodeURIComponent(to)}&text=${encodeURIComponent(text)}`;
  }

  const res = await fetch(url, opts);
  const body = await res.text();
  if (!res.ok) throw new Error(`gateway ${res.status}: ${body.slice(0, 200)}`);
  return body.slice(0, 500);
}

async function deliverTwilio(to, text) {
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

/**
 * Мессеж илгээнэ. Хэзээ ч алдаа шиднэ гэж бүү бод — захиалга үүсэх урсгалыг
 * SMS-ийн алдаа зогсоох ёсгүй тул алдааг зөвхөн sms_outbox-д тэмдэглэнэ.
 */
async function sendSms(phone, text, opts = {}) {
  const to = normalize(phone);
  const kind = opts.kind || 'other';
  const provider = cfg.sms.live ? cfg.sms.provider : 'mock';

  if (!to) return { ok: false, error: 'Дугаар байхгүй' };

  const res = db.prepare(
    `INSERT INTO sms_outbox(phone, body, kind, provider, status, order_id, created_at)
     VALUES(?, ?, ?, ?, 'queued', ?, ?)`
  ).run(to, text, kind, provider, opts.orderId ?? null, now());
  const id = res.lastInsertRowid;

  const mark = (status, error = '') => {
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
    console.error('[sms]', e.message);
    mark('failed', e.message);
    return { ok: false, id, error: e.message };
  }
}

// ------------------------------ Загварууд -----------------------------------
const STATUS_TEXT = {
  new: 'хүлээн авлаа',
  confirmed: 'баталгаажлаа',
  packed: 'савлагдаж дууслаа',
  shipping: 'хүргэлтэд гарлаа',
  delivered: 'хүргэгдлээ',
  cancelled: 'цуцлагдлаа',
};

const mnt = (n) => Number(n || 0).toLocaleString('mn-MN') + '₮';

function orderCreatedText(order) {
  const s = getSettings();
  return `${s.store_name}\nЗахиалга ${order.code} хүлээн авлаа.\nДүн: ${mnt(order.total)}\nБид удахгүй холбогдоно. Утас: ${s.phone}`;
}

function orderStatusText(order) {
  const s = getSettings();
  const word = STATUS_TEXT[order.status] || order.status;
  let extra = '';
  if (order.status === 'shipping') extra = '\nЖолооч тантай холбогдоно.';
  if (order.status === 'delivered') extra = '\nБидний үйлчилгээг сонгосонд баярлалаа!';
  if (order.status === 'cancelled') extra = `\nАсуулт байвал ${s.phone} руу залгана уу.`;
  return `${s.store_name}\nЗахиалга ${order.code} ${word}.${extra}`;
}

function resetCodeText(code) {
  const s = getSettings();
  return `${s.store_name}\nНууц үг сэргээх код: ${code}\n${cfg.reset.ttlMinutes} минутын дотор хүчинтэй.\nЭнэ хүсэлтийг та илгээгээгүй бол хэнд ч бүү дамжуулаарай.`;
}

// ------------------------- Захиалгын мэдэгдэл -------------------------------
function notifyOrderCreated(order) {
  if (!cfg.sms.notifyOnOrder) return;
  sendSms(order.phone, orderCreatedText(order), { kind: 'order', orderId: order.id });
}

function notifyOrderStatus(order) {
  if (!cfg.sms.notifyOnStatus) return;
  sendSms(order.phone, orderStatusText(order), { kind: 'status', orderId: order.id });
}

module.exports = {
  sendSms,
  normalize,
  notifyOrderCreated,
  notifyOrderStatus,
  resetCodeText,
  orderCreatedText,
  orderStatusText,
};
