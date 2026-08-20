// End-to-end backend test of the 5 new features against the running server.
import * as csvMod from '../server/csv.ts';

const BASE = process.env.KS_TEST_BASE || 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (name: string, cond: unknown, detail = ''): void => {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

type ApiResult = { status: number; data: any; headers: Headers };
type ApiOpts = { as?: string; headers?: Record<string, string> };

const jar: Record<string, string> = {};
async function api(method: string, path: string, body?: unknown, opts: ApiOpts = {}): Promise<ApiResult> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  const who = opts.as || 'anon';
  if (jar[who]) headers.Cookie = jar[who];
  let payload = body;
  if (body && !(body instanceof Uint8Array) && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload as any, redirect: 'manual' });
  const sc = res.headers.get('set-cookie');
  if (sc) jar[who] = sc.split(';')[0];
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers };
}

console.log('\n== 1. Password reset ==');
// register a throwaway user
const reg = await api('POST', '/api/auth/register', { name: 'Reset Test', phone: '80001111', password: 'oldpass1' }, { as: 'u' });
ok('register throwaway user', reg.data.ok, JSON.stringify(reg.data).slice(0, 80));

const forgotBad = await api('POST', '/api/auth/forgot', { phone: '80009999' });
ok('forgot: unknown phone gets generic OK (no enumeration)', forgotBad.data.ok && !forgotBad.data.code);

const forgot = await api('POST', '/api/auth/forgot', { phone: '80001111' });
ok('forgot: known phone → code returned in mock mode', forgot.data.ok && /^\d{6}$/.test(forgot.data.code || ''), 'code=' + forgot.data.code);

const rl = await api('POST', '/api/auth/forgot', { phone: '80001111' });
ok('forgot: rate-limited on immediate retry (429)', rl.status === 429);

const wrong = await api('POST', '/api/auth/reset', { phone: '80001111', code: '000000', password: 'newpass1' });
ok('reset: wrong code rejected', wrong.status === 400 && /буруу/.test(wrong.data.error), wrong.data.error);

const right = await api('POST', '/api/auth/reset', { phone: '80001111', code: forgot.data.code, password: 'newpass1' }, { as: 'u2' });
ok('reset: correct code → password changed + session', right.data.ok && right.data.user?.phone === '80001111');

const reuse = await api('POST', '/api/auth/reset', { phone: '80001111', code: forgot.data.code, password: 'again123' });
ok('reset: code cannot be reused', reuse.status === 400);

const oldLogin = await api('POST', '/api/auth/login', { phone: '80001111', password: 'oldpass1' });
ok('login with OLD password fails', oldLogin.status === 401);
const newLogin = await api('POST', '/api/auth/login', { phone: '80001111', password: 'newpass1' }, { as: 'u3' });
ok('login with NEW password works', newLogin.data.ok);

const oldSess = await api('GET', '/api/me', null, { as: 'u' });
ok('old session invalidated after reset', oldSess.status === 401);

console.log('\n== 2. Admin login ==');
const adm = await api('POST', '/api/auth/login', { phone: '99112233', password: 'admin123' }, { as: 'admin' });
ok('admin login', adm.data.ok && adm.data.user.role === 'admin');

console.log('\n== 3. Product image upload ==');
// build a tiny valid PNG (1x1) and a fake "exe" renamed .png
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const boundary = '----KhishgeeTestBoundary7f3a';
const part = (name: string, filename: string, mime: string, data: Buffer): Buffer => Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),
  data, Buffer.from('\r\n'),
]);
const body = Buffer.concat([
  part('images', 'test-photo.png', 'image/png', png),
  part('images', 'evil.png', 'image/png', Buffer.from('MZ\x90\x00this is not an image at all, it is a PE header')),
  Buffer.from(`--${boundary}--\r\n`),
]);
const up = await api('POST', '/api/admin/products/22/images', body, {
  as: 'admin', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
});
ok('upload: valid PNG accepted, fake image rejected', up.data.ok && up.data.images?.length === 1 && up.data.errors?.length === 1,
  `saved=${up.data.images?.length} errors=${JSON.stringify(up.data.errors)}`);
const imgUrl = up.data.images?.[0]?.url;
ok('upload: dimensions detected', up.data.images?.[0]?.width === 1 && up.data.images?.[0]?.height === 1);

const served = await api('GET', imgUrl);
ok('uploaded image served with correct MIME', served.status === 200 && served.headers.get('content-type') === 'image/png' && served.data.length === png.length);

const prod = await api('GET', '/api/products/22');
ok('product now uses real photo as primary image', prod.data.product?.image === imgUrl && prod.data.product?.has_photo === true, 'image=' + prod.data.product?.image);

const noauth = await api('POST', '/api/admin/products/22/images', body, { headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } });
ok('upload without admin session → 403', noauth.status === 403);

const del = await api('DELETE', `/api/admin/products/22/images/${up.data.images[0].id}`, null, { as: 'admin' });
ok('delete image', del.data.ok);
const gone = await api('GET', imgUrl);
ok('deleted image file no longer served', gone.status === 404);
const prod2 = await api('GET', '/api/products/22');
ok('product falls back to SVG after delete', prod2.data.product?.image === '/img/p/22.svg');

console.log('\n== 4. CSV export ==');
for (const f of ['orders', 'products', 'customers', 'sales']) {
  const r = await api('GET', `/api/admin/export/${f}.csv`, null, { as: 'admin' });
  const text = r.data.toString('utf8');
  const lines = text.split('\r\n').filter(Boolean);
  const bom = r.data[0] === 0xef && r.data[1] === 0xbb && r.data[2] === 0xbf;
  ok(`export ${f}.csv`, r.status === 200 && bom && lines.length > 1 && r.headers.get('content-disposition')?.includes('attachment'),
    `${lines.length - 1} rows, BOM=${bom}, header="${lines[0].slice(0, 50)}…"`);
}
const noAuthCsv = await api('GET', '/api/admin/export/orders.csv');
ok('export without admin → 403', noAuthCsv.status === 403);
// CSV injection guard
ok('csv: formula injection neutralised', csvMod.cell('=HYPERLINK("http://x")').startsWith("\"'="), csvMod.cell('=1+1'));
ok('csv: quotes/commas escaped', csvMod.cell('a,"b"') === '"a,""b"""');

console.log('\n== 5. QPay payment flow (mock) ==');
const order = await api('POST', '/api/orders', {
  name: 'QPay Tester', phone: '80002222', district: 'Sukhbaatar', address: 'Test address 12',
  delivery_method: 'ub', payment_method: 'qpay', items: [{ id: 22, qty: 1 }],
});
ok('order created with qpay + needs_payment flag', order.data.ok && order.data.needs_payment === true, 'code=' + order.data.code);
const code = order.data.code;

const inv = await api('POST', `/api/payments/qpay/${code}`, { phone: '80002222' });
ok('invoice created (mock)', inv.data.ok && inv.data.payment?.mode === 'mock' && inv.data.payment?.qr_svg?.startsWith('<svg'),
  `invoice=${inv.data.payment?.invoice_id} qr_svg=${inv.data.payment?.qr_svg?.length}b`);

const wrongPhone = await api('POST', `/api/payments/qpay/${code}`, { phone: '11111111' });
ok('invoice with wrong phone → 403', wrongPhone.status === 403);

const st1 = await api('GET', `/api/payments/qpay/${code}?phone=80002222`);
ok('status: pending before payment', st1.data.payment?.status === 'pending' && st1.data.order_status === 'unpaid');

const sim = await api('POST', `/api/payments/qpay/${code}/simulate`, { phone: '80002222' });
ok('simulate payment (mock only)', sim.data.ok && sim.data.status === 'paid');

const st2 = await api('GET', `/api/payments/qpay/${code}?phone=80002222`);
ok('status: paid after simulate', st2.data.payment?.status === 'paid' && st2.data.order_status === 'paid');

const trk = await api('GET', `/api/orders/track?code=${code}&phone=80002222`);
ok('order auto-confirmed + payment_status=paid', trk.data.order?.status === 'confirmed' && trk.data.order?.payment_status === 'paid',
  `status=${trk.data.order?.status} pay=${trk.data.order?.payment_status}`);

const dup = await api('POST', `/api/payments/qpay/${code}`, { phone: '80002222' });
ok('cannot create invoice for already-paid order (409)', dup.status === 409);

const cb = await api('GET', `/api/payments/qpay-callback?order=${code}`);
ok('callback endpoint reachable (not swallowed by :code)', cb.status === 200 && cb.data.ok);

const adminPay = await api('GET', '/api/admin/payments', null, { as: 'admin' });
ok('admin payments list', adminPay.data.ok && adminPay.data.items.some((p: any) => p.order_code === code && p.status === 'paid'));

console.log('\n== 6. SMS outbox ==');
const box = await api('GET', '/api/admin/sms', null, { as: 'admin' });
const kinds: Record<string, number> = {};
for (const m of box.data.items) kinds[m.kind] = (kinds[m.kind] || 0) + 1;
ok('sms outbox has reset + order + status messages', kinds.reset >= 1 && kinds.order >= 1 && kinds.status >= 1, JSON.stringify(kinds));
ok('sms: all mock messages marked sent', box.data.items.every((m: any) => m.status === 'sent'));
const orderSms = box.data.items.find((m: any) => m.kind === 'order' && m.body.includes(code));
ok('sms: order text contains code + amount', orderSms && /₮/.test(orderSms.body), orderSms?.body.replace(/\n/g, ' / '));

const test = await api('POST', '/api/admin/sms/test', { phone: '80003333', text: 'test' }, { as: 'admin' });
ok('admin test SMS', test.data.ok && test.data.result.mock === true);

// status change → sms
const oid = adminPay.data.items.find((p: any) => p.order_code === code).order_id;
await api('PATCH', `/api/admin/orders/${oid}`, { status: 'shipping' }, { as: 'admin' });
const box2 = await api('GET', '/api/admin/sms', null, { as: 'admin' });
const ship = box2.data.items.find((m: any) => m.order_id === oid && /хүргэлтэд гарлаа/.test(m.body));
ok('status change → SMS with Mongolian status text', Boolean(ship), ship?.body.replace(/\n/g, ' / '));

const integ = await api('GET', '/api/admin/integrations', null, { as: 'admin' });
ok('integrations status endpoint', integ.data.ok && integ.data.qpay.live === false && integ.data.qpay.missing.length === 3);

console.log(`\n${pass} passed, ${fail} failed`);
// expose ids for cleanup
console.log('CLEANUP', JSON.stringify({ code, oid }));
process.exit(fail ? 1 : 0);
