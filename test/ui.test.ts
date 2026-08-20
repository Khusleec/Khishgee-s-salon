// Frontend logic test without a real browser: exercise the exact template
// functions and API-driven flows the SPA runs, verifying the rendered HTML
// contains the new UI. This proves wiring, not pixels.
export {}; // top-level await шаардлагаар модуль болгоно
const BASE = process.env.KS_TEST_BASE || 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (n: string, c: unknown, d = ''): void => {
  if (c) { pass++; console.log(`  PASS  ${n}${d ? '  — ' + d : ''}`); }
  else { fail++; console.log(`  FAIL  ${n}${d ? '  — ' + d : ''}`); }
};
const jar: Record<string, string> = {};
async function api(method: string, path: string, body?: unknown, as = 'anon',
  extraHeaders: Record<string, string> = {}): Promise<{ status: number; data: any; res: Response }> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (jar[as]) headers.Cookie = jar[as];
  let payload = body;
  if (body && typeof body === 'object' && !(body instanceof Uint8Array)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload as any });
  const sc = res.headers.get('set-cookie'); if (sc) jar[as] = sc.split(';')[0];
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text(), res };
}

console.log('\n== Next.js pages render ==');
for (const [route, marker] of [
  ['/', 'Khishgee'],
  ['/catalog', 'Khishgee'],
  ['/product/22', 'Khishgee'],
  ['/track', 'Khishgee'],
  ['/admin', 'Khishgee'],
] as [string, string][]) {
  const r = await api('GET', route);
  const html = String(r.data);
  const broken = html.includes('Unhandled Runtime Error') || html.includes('__next_error__');
  ok(`page ${route} renders`, r.status === 200 && html.includes(marker) && !broken,
    `status=${r.status}${broken ? ' (error page)' : ''}`);
}

console.log('\n== Product API shape matches what UI expects ==');
const p = (await api('GET', '/api/products/22')).data.product;
ok('product has images[] + image + has_photo', Array.isArray(p.images) && typeof p.image === 'string' && typeof p.has_photo === 'boolean');
const list = (await api('GET', '/api/products?per=3')).data.items;
ok('list items carry image field for cards', list.every((x: any) => typeof x.image === 'string'));

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
ok('payments page data', pay.ok && pay.items.some((x: any) => x.order_code === o.code && x.status === 'paid'));
const smsb = (await api('GET', '/api/admin/sms', null, 'admin')).data;
ok('sms page data', smsb.ok && smsb.stats && smsb.items.length > 0);
const integ = (await api('GET', '/api/admin/integrations', null, 'admin')).data;
ok('integrations page data', integ.ok && integ.qpay && integ.sms && integ.uploads);
const csvR = await api('GET', '/api/admin/export/orders.csv?from=2026-01-01&to=2026-12-31&sep=semicolon', null, 'admin');
ok('reports: semicolon separator honoured', csvR.status === 200 && csvR.data.split('\r\n')[0].includes(';'));
const admProd = (await api('GET', '/api/admin/products', null, 'admin')).data.items[0];
ok('admin product rows include images[] for photo manager', Array.isArray(admProd.images));

console.log('\n== HTML shells ==');
const idx = String((await api('GET', '/')).data);
const adm = String((await api('GET', '/admin')).data);
ok('storefront shell is a Next page with app chunks', idx.includes('/_next/'));
ok('admin shell is a Next page with app chunks', adm.includes('/_next/'));

console.log(`\n${pass} passed, ${fail} failed`);
console.log('CLEANUP', JSON.stringify({ code: o.code }));
process.exit(fail ? 1 : 0);
