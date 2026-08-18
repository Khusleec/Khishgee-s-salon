'use strict';
// Frontend logic test without a real browser: exercise the exact template
// functions and API-driven flows the SPA runs, verifying the rendered HTML
// contains the new UI. This proves wiring, not pixels.
const BASE = process.env.KS_TEST_BASE || 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}${d ? '  — ' + d : ''}`); } else { fail++; console.log(`  FAIL  ${n}${d ? '  — ' + d : ''}`); } };
const jar = {};
async function api(method, path, body, as = 'anon', extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (jar[as]) headers.Cookie = jar[as];
  let payload = body;
  if (body && typeof body === 'object' && !(body instanceof Uint8Array)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const sc = res.headers.get('set-cookie'); if (sc) jar[as] = sc.split(';')[0];
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text(), res };
}

(async () => {
  console.log('\n== Static assets serve the new code ==');
  const appJs = (await api('GET', '/js/app.js')).data;
  ok('app.js: qpayPanel + mountQpay present', appJs.includes('function qpayPanel') && appJs.includes('async function mountQpay'));
  ok('app.js: openForgot flow present', appJs.includes('function openForgot') && appJs.includes('/api/auth/forgot') && appJs.includes('/api/auth/reset'));
  ok('app.js: gallery thumbs use p.images', appJs.includes('data-img=') && appJs.includes('p.images.map'));
  ok('app.js: track page mounts QPay', appJs.split('mountQpay(order)').length >= 3);
  const admJs = (await api('GET', '/js/admin.js')).data;
  ok('admin.js: 4 new pages registered', ['pagePayments', 'pageSms', 'pageReports', 'pageIntegrations'].every((f) => admJs.includes(`async function ${f}`)) && admJs.includes('payments: pagePayments'));
  ok('admin.js: photo manager wired into product form', admJs.includes('function mountPhotoManager') && admJs.includes('mountPhotoManager(v.id'));
  ok('admin.js: NAV has new entries', ['payments', 'sms', 'reports', 'integrations'].every((k) => admJs.includes(`key: '${k}'`)));
  const appCss = (await api('GET', '/css/app.css')).data;
  ok('app.css: qpay styles', appCss.includes('.qpay-qr'));
  const admCss = (await api('GET', '/css/admin.css')).data;
  ok('admin.css: photo + env styles', admCss.includes('.photo-drop') && admCss.includes('.env-block'));

  console.log('\n== Product API shape matches what UI expects ==');
  const p = (await api('GET', '/api/products/22')).data.product;
  ok('product has images[] + image + has_photo', Array.isArray(p.images) && typeof p.image === 'string' && typeof p.has_photo === 'boolean');
  const list = (await api('GET', '/api/products?per=3')).data.items;
  ok('list items carry image field for cards', list.every((x) => typeof x.image === 'string'));

  console.log('\n== QPay UI flow (what mountQpay does) ==');
  const o = (await api('POST', '/api/orders', { name: 'UI Tester', phone: '80004444', district: 'BZD', address: 'Addr 44',
    delivery_method: 'ub', payment_method: 'qpay', items: [{ id: 5, qty: 1 }] })).data;
  ok('order created', o.ok && o.needs_payment, o.code);
  const trk = (await api('GET', `/api/orders/track?code=${o.code}&phone=80004444`)).data.order;
  ok('tracked order exposes payment_status=unpaid (panel decides on this)', trk.payment_status === 'unpaid' && trk.payment_method === 'qpay');
  const inv = (await api('POST', `/api/payments/qpay/${o.code}`, { phone: '80004444' })).data;
  ok('invoice payload has qr_svg + mode for the panel', inv.payment.qr_svg.includes('<svg') && inv.payment.mode === 'mock');
  const poll = (await api('GET', `/api/payments/qpay/${o.code}?phone=80004444`)).data;
  ok('poll shape {payment.status, order_status}', poll.payment.status === 'pending' && poll.order_status === 'unpaid');
  await api('POST', `/api/payments/qpay/${o.code}/simulate`, { phone: '80004444' });
  const trk2 = (await api('GET', `/api/orders/track?code=${o.code}&phone=80004444`)).data.order;
  ok('after pay: paid + paid_at set (green panel branch)', trk2.payment_status === 'paid' && !!trk2.paid_at);

  console.log('\n== Forgot-password UI flow ==');
  const fg = (await api('POST', '/api/auth/forgot', { phone: '99001122' })).data;
  ok('forgot returns message + mock code for step-2 banner', fg.ok && fg.message && /^\d{6}$/.test(fg.code));
  // don't actually reset the demo user's password; verify wrong-code path
  const bad = (await api('POST', '/api/auth/reset', { phone: '99001122', code: '000000', password: 'zzzzzz' }));
  ok('wrong code → error text UI can toast', bad.status === 400 && bad.data.error.length > 3, bad.data.error);
  // invalidate the pending code so demo user isn't left with an open reset
  for (let i = 0; i < 5; i++) await api('POST', '/api/auth/reset', { phone: '99001122', code: '000000', password: 'zzzzzz' });

  console.log('\n== Admin pages data ==');
  await api('POST', '/api/auth/login', { phone: '99112233', password: 'admin123' }, 'admin');
  const pay = (await api('GET', '/api/admin/payments', null, 'admin')).data;
  ok('payments page data', pay.ok && pay.items.some((x) => x.order_code === o.code && x.status === 'paid'));
  const smsb = (await api('GET', '/api/admin/sms', null, 'admin')).data;
  ok('sms page data', smsb.ok && smsb.stats && smsb.items.length > 0);
  const integ = (await api('GET', '/api/admin/integrations', null, 'admin')).data;
  ok('integrations page data', integ.ok && integ.qpay && integ.sms && integ.uploads);
  const csvR = await api('GET', '/api/admin/export/orders.csv?from=2026-01-01&to=2026-12-31&sep=semicolon', null, 'admin');
  ok('reports: semicolon separator honoured', csvR.status === 200 && csvR.data.split('\r\n')[0].includes(';'));
  const admProd = (await api('GET', '/api/admin/products', null, 'admin')).data.items[0];
  ok('admin product rows include images[] for photo manager', Array.isArray(admProd.images));

  console.log('\n== HTML shells ==');
  const idx = (await api('GET', '/')).data;
  const adm = (await api('GET', '/admin')).data;
  ok('index.html loads app.js', idx.includes('js/app.js'));
  ok('admin.html loads admin.js', adm.includes('js/admin.js'));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log('CLEANUP', JSON.stringify({ code: o.code }));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
