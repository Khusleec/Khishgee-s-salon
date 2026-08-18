'use strict';

// ---------------------------------------------------------------------------
// Тохиргоо — .env файлаас уншина (гадаад сан ашиглахгүй)
//
// Түлхүүр байхгүй үед систем "mock" горимд ажиллана: бүх урсгал бүрэн
// ажиллах бөгөөд зөвхөн гадаад сүлжээний дуудлага л дотооддоо дуурайгдана.
// Жинхэнэ түлхүүрээ .env-д бичихэд ямар ч код өөрчлөхгүйгээр live болно.
// ---------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');

const ENV_PATH = path.join(__dirname, '..', '.env');

function parseEnv(text) {
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Хашилтыг арилгана
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function loadEnv() {
  let fileEnv = {};
  try {
    if (fs.existsSync(ENV_PATH)) fileEnv = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
  } catch (e) {
    console.warn('[config] .env уншиж чадсангүй:', e.message);
  }
  // Процессын хувьсагч .env-ээс давамгайлна
  return { ...fileEnv, ...process.env };
}

const env = loadEnv();

const get = (key, fallback = '') => {
  const v = env[key];
  return v == null || v === '' ? fallback : String(v);
};

const bool = (key, fallback = false) => {
  const v = get(key, '').toLowerCase();
  if (!v) return fallback;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
};

// ------------------------------- QPay --------------------------------------
const qpay = {
  username: get('QPAY_USERNAME'),
  password: get('QPAY_PASSWORD'),
  invoiceCode: get('QPAY_INVOICE_CODE'),
  baseUrl: get('QPAY_BASE_URL', 'https://merchant.qpay.mn/v2'),
  callbackBase: get('PUBLIC_BASE_URL', `http://localhost:${get('PORT', '3000')}`),
};
// Гурван утга бүрэн байж байж жинхэнэ QPay руу залгана
qpay.live = Boolean(qpay.username && qpay.password && qpay.invoiceCode);

// -------------------------------- SMS --------------------------------------
// provider: mock | http | twilio
const sms = {
  provider: get('SMS_PROVIDER', 'mock').toLowerCase(),
  from: get('SMS_FROM', 'Khishgee'),
  // Ерөнхий HTTP gateway (Монголын оператор/агрегаторуудад тохирно)
  url: get('SMS_HTTP_URL'),
  method: get('SMS_HTTP_METHOD', 'GET').toUpperCase(),
  // Жишээ: "key=ABC&from={from}&to={to}&text={text}"
  query: get('SMS_HTTP_QUERY'),
  body: get('SMS_HTTP_BODY'),
  contentType: get('SMS_HTTP_CONTENT_TYPE', 'application/x-www-form-urlencoded'),
  authHeader: get('SMS_HTTP_AUTH_HEADER'),
  // Twilio
  twilioSid: get('TWILIO_ACCOUNT_SID'),
  twilioToken: get('TWILIO_AUTH_TOKEN'),
  twilioFrom: get('TWILIO_FROM'),
  countryCode: get('SMS_COUNTRY_CODE', '976'),
  // Аль эвент дээр мессеж явуулах
  notifyOnOrder: bool('SMS_NOTIFY_ON_ORDER', true),
  notifyOnStatus: bool('SMS_NOTIFY_ON_STATUS', true),
};

sms.live = (() => {
  if (sms.provider === 'http') return Boolean(sms.url);
  if (sms.provider === 'twilio') return Boolean(sms.twilioSid && sms.twilioToken && sms.twilioFrom);
  return false;
})();

// ------------------------------ Зураг --------------------------------------
const uploads = {
  maxBytes: Number(get('UPLOAD_MAX_BYTES', String(5 * 1024 * 1024))),
  dir: path.join(process.env.KS_DATA_DIR || path.join(__dirname, '..', 'data'), 'uploads'),
};

// ---------------------------- Нууц үг сэргээх -------------------------------
const reset = {
  ttlMinutes: Number(get('RESET_CODE_TTL_MIN', '15')),
  maxAttempts: Number(get('RESET_MAX_ATTEMPTS', '5')),
  // mock горимд кодыг хариунд буцаах эсэх (зөвхөн хөгжүүлэлтэд)
  revealInMock: bool('RESET_REVEAL_IN_MOCK', true),
};

function summary() {
  return {
    qpay: qpay.live ? 'live' : 'mock',
    sms: sms.live ? `live (${sms.provider})` : 'mock',
  };
}

module.exports = { env, get, bool, qpay, sms, uploads, reset, summary, ENV_PATH };
