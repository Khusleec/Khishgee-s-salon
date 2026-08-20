// ---------------------------------------------------------------------------
// Тохиргоо — .env файлаас уншина (гадаад сан ашиглахгүй)
//
// Түлхүүр байхгүй үед систем "mock" горимд ажиллана: бүх урсгал бүрэн
// ажиллах бөгөөд зөвхөн гадаад сүлжээний дуудлага л дотооддоо дуурайгдана.
// Жинхэнэ түлхүүрээ .env-д бичихэд ямар ч код өөрчлөхгүйгээр live болно.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

export const ENV_PATH = path.join(process.cwd(), '.env');

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
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

function loadEnv(): Record<string, string | undefined> {
  let fileEnv: Record<string, string> = {};
  try {
    if (fs.existsSync(ENV_PATH)) fileEnv = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
  } catch (e) {
    console.warn('[config] .env уншиж чадсангүй:', (e as Error).message);
  }
  // Процессын хувьсагч .env-ээс давамгайлна
  return { ...fileEnv, ...process.env };
}

export const env = loadEnv();

export const get = (key: string, fallback = ''): string => {
  const v = env[key];
  return v == null || v === '' ? fallback : String(v);
};

export const bool = (key: string, fallback = false): boolean => {
  const v = get(key, '').toLowerCase();
  if (!v) return fallback;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
};

// --------------------------- Өгөгдлийн хавтас --------------------------------
// Vercel зэрэг serverless орчинд ажлын хавтас зөвхөн уншигдана — /tmp л бичигдэнэ.
// Тэнд SQLite болон байршуулсан зураг түр хадгалагдана (cold start бүрт шинэчлэгдэнэ).
export const dataDir = process.env.KS_DATA_DIR
  || (process.env.VERCEL ? path.join('/tmp', 'ks-data') : path.join(process.cwd(), 'data'));

// ------------------------------- QPay --------------------------------------
const qpayBase = {
  username: get('QPAY_USERNAME'),
  password: get('QPAY_PASSWORD'),
  invoiceCode: get('QPAY_INVOICE_CODE'),
  baseUrl: get('QPAY_BASE_URL', 'https://merchant.qpay.mn/v2'),
  callbackBase: get('PUBLIC_BASE_URL', `http://localhost:${get('PORT', '3000')}`),
};

export const qpay = {
  ...qpayBase,
  // Гурван утга бүрэн байж байж жинхэнэ QPay руу залгана
  live: Boolean(qpayBase.username && qpayBase.password && qpayBase.invoiceCode),
};

// -------------------------------- SMS --------------------------------------
// provider: mock | http | twilio
const smsBase = {
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

export const sms = {
  ...smsBase,
  live: (() => {
    if (smsBase.provider === 'http') return Boolean(smsBase.url);
    if (smsBase.provider === 'twilio') {
      return Boolean(smsBase.twilioSid && smsBase.twilioToken && smsBase.twilioFrom);
    }
    return false;
  })(),
};

// ------------------------------ Зураг --------------------------------------
export const uploads = {
  maxBytes: Number(get('UPLOAD_MAX_BYTES', String(5 * 1024 * 1024))),
  dir: path.join(dataDir, 'uploads'),
};

// ---------------------------- Нууц үг сэргээх -------------------------------
export const reset = {
  ttlMinutes: Number(get('RESET_CODE_TTL_MIN', '15')),
  maxAttempts: Number(get('RESET_MAX_ATTEMPTS', '5')),
  // mock горимд кодыг хариунд буцаах эсэх (зөвхөн хөгжүүлэлтэд)
  revealInMock: bool('RESET_REVEAL_IN_MOCK', true),
};

export function summary(): { qpay: string; sms: string } {
  return {
    qpay: qpay.live ? 'live' : 'mock',
    sms: sms.live ? `live (${sms.provider})` : 'mock',
  };
}
