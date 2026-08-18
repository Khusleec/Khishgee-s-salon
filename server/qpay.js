'use strict';

// ---------------------------------------------------------------------------
// QPay v2 холболт
//
// .env дотор QPAY_USERNAME / QPAY_PASSWORD / QPAY_INVOICE_CODE гурвуулаа
// байвал жинхэнэ merchant.qpay.mn руу залгана. Байхгүй бол mock горимд
// дотооддоо нэхэмжлэх үүсгэж, QR-ийг өөрсдөө зурж, «төлөгдсөн» болгох
// боломжийг олгоно — урсгал бүрэн ажиллана, зөвхөн банк л оролцохгүй.
//
// API:
//   createInvoice(order)   → { invoiceId, qrText, qrSvg, shortUrl, mode }
//   checkPayment(payment)  → { paid, amount, paymentId, raw }
//   cancelInvoice(payment)
// ---------------------------------------------------------------------------

const crypto = require('node:crypto');
const cfg = require('./config');
const qr = require('./qr');

// ------------------------------ Токен кэш -----------------------------------
let tokenCache = { value: '', expiresAt: 0 };

async function getToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.value;

  const auth = Buffer.from(`${cfg.qpay.username}:${cfg.qpay.password}`).toString('base64');
  const res = await fetch(`${cfg.qpay.baseUrl}/auth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`QPay auth ${res.status}: ${text.slice(0, 200)}`);

  const data = JSON.parse(text);
  tokenCache = {
    value: data.access_token,
    // expires_in секундээр ирдэг; ирээгүй бол 1 цаг гэж үзнэ
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return tokenCache.value;
}

async function call(path, body, method = 'POST') {
  const token = await getToken();
  const res = await fetch(`${cfg.qpay.baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`QPay ${path} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// ------------------------------ Нэхэмжлэх -----------------------------------
/**
 * Захиалгад QPay нэхэмжлэх үүсгэнэ.
 * @param {object} order  orders хүснэгтийн мөр
 */
async function createInvoice(order) {
  const callbackUrl = `${cfg.qpay.callbackBase}/api/payments/qpay-callback?order=${encodeURIComponent(order.code)}`;

  if (!cfg.qpay.live) {
    // ------------------------- mock горим ---------------------------------
    // QPay-ийн бодит qr_text нь EMVCo форматтай байдаг. Дотоод горимд
    // танигдахуйц, гэхдээ жинхэнэ мөнгө хөдөлгөхгүй мөр үүсгэнэ.
    const invoiceId = 'mock_' + crypto.randomBytes(8).toString('hex');
    const qrText = [
      'QPAY-MOCK',
      order.code,
      String(order.total),
      'MNT',
      invoiceId,
    ].join('|');
    return {
      mode: 'mock',
      invoiceId,
      qrText,
      qrSvg: qr.toSvg(qrText, { scale: 6 }),
      shortUrl: `${cfg.qpay.callbackBase}/pay/${order.code}`,
      urls: [],
    };
  }

  // -------------------------- жинхэнэ горим --------------------------------
  const data = await call('/invoice', {
    invoice_code: cfg.qpay.invoiceCode,
    sender_invoice_no: order.code,
    invoice_receiver_code: String(order.user_id || 'terminal'),
    invoice_description: `Khishgee's Salon — ${order.code}`,
    amount: order.total,
    callback_url: callbackUrl,
  });

  const qrText = data.qr_text || '';
  return {
    mode: 'live',
    invoiceId: data.invoice_id,
    qrText,
    // QPay өөрөө qr_image (base64 PNG) буцаадаг ч бид qr_text-ээс SVG зурвал
    // ямар ч хэмжээнд тод харагдана.
    qrSvg: qrText ? qr.toSvg(qrText, { scale: 6 }) : '',
    qrImageBase64: data.qr_image || '',
    shortUrl: data.qPay_shortUrl || '',
    urls: Array.isArray(data.urls) ? data.urls : [],
    raw: data,
  };
}

/**
 * Төлбөр төлөгдсөн эсэхийг шалгана.
 * @param {object} payment  payments хүснэгтийн мөр
 */
async function checkPayment(payment) {
  if (payment.mode !== 'live' || !cfg.qpay.live) {
    // mock — DB дэх төлөв нь эцсийн үнэн
    return {
      paid: payment.status === 'paid',
      amount: payment.paid_amount,
      paymentId: payment.payment_id,
      raw: null,
    };
  }

  const data = await call('/payment/check', {
    object_type: 'INVOICE',
    object_id: payment.invoice_id,
    offset: { page_number: 1, page_limit: 100 },
  });

  const rows = Array.isArray(data.rows) ? data.rows : [];
  const paidRows = rows.filter((r) => String(r.payment_status).toUpperCase() === 'PAID');
  const amount = paidRows.reduce((sum, r) => sum + Number(r.payment_amount || 0), 0);

  return {
    paid: amount > 0 && amount >= Number(payment.amount),
    amount,
    paymentId: paidRows[0]?.payment_id || '',
    raw: data,
  };
}

async function cancelInvoice(payment) {
  if (payment.mode !== 'live' || !cfg.qpay.live || !payment.invoice_id) return { ok: true, mock: true };
  await call(`/invoice/${encodeURIComponent(payment.invoice_id)}`, null, 'DELETE');
  return { ok: true };
}

module.exports = { createInvoice, checkPayment, cancelInvoice, getToken, isLive: () => cfg.qpay.live };
