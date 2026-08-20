import crypto from 'node:crypto';
import path from 'node:path';
import { db, getSettings, setSetting, DEFAULT_SETTINGS } from './db.ts';
import { hashPassword, verifyPassword, newToken } from './auth.ts';
import { productSvg } from './images.ts';
import { getIcon } from './icons.ts';
import * as config from './config.ts';
import * as sms from './sms.ts';
import * as qpay from './qpay.ts';
import * as uploads from './uploads.ts';
import * as csv from './csv.ts';
import * as qr from './qr.ts';
import type {
  Ctx, Handler, Route,
  CategoryRow, Product, ProductRow, ProductImageRow,
  UserRow, Order, OrderRow, OrderItemRow,
  PromoRow, PaymentRow, PasswordResetRow,
} from './types.ts';
import type { CsvValue } from './csv.ts';

const SESSION_DAYS = 30;
const STATUSES = ['new', 'confirmed', 'packed', 'shipping', 'delivered', 'cancelled'];

// ---------------------------------------------------------------------------
// Туслах функцууд
// ---------------------------------------------------------------------------
const now = (): string => new Date().toISOString();
const int = (v: unknown, d = 0): number => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
const str = (v: unknown, max = 500): string => String(v ?? '').trim().slice(0, max);

function currentUser(ctx: Ctx): UserRow | null {
  const token = ctx.cookies.sid;
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`).get(token, Date.now()) as UserRow | undefined;
  return row || null;
}

function publicUser(u: UserRow | null): Partial<UserRow> | null {
  if (!u) return null;
  const { id, name, phone, email, role, address, district, created_at } = u;
  return { id, name, phone, email, role, address, district, created_at };
}

function requireAuth(ctx: Ctx): UserRow | null {
  const u = currentUser(ctx);
  if (!u) { ctx.fail('Нэвтэрч орно уу', 401); return null; }
  return u;
}

function requireAdmin(ctx: Ctx): UserRow | null {
  const u = currentUser(ctx);
  if (!u || u.role !== 'admin') { ctx.fail('Админ эрх шаардлагатай', 403); return null; }
  return u;
}

function startSession(ctx: Ctx, userId: number | bigint): void {
  const token = newToken();
  const expires = Date.now() + SESSION_DAYS * 86400000;
  db.prepare('INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?)').run(token, userId, expires);
  ctx.setCookie('sid', token, { maxAge: SESSION_DAYS * 86400 });
}

const normPhone = (p: unknown): string => str(p, 20).replace(/[^0-9]/g, '');

function validPhone(p: string): boolean {
  return /^[0-9]{8}$/.test(p);
}

function orderCode(): string {
  const taken = db.prepare('SELECT 1 FROM orders WHERE code = ?');
  const base = (db.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }).n;
  for (let i = 0; i < 50; i++) {
    const code = 'KS' + String(100001 + base + i) + crypto.randomInt(10, 99);
    if (!taken.get(code)) return code;
  }
  return 'KS' + Date.now().toString().slice(-8);
}

const listImages = db.prepare(
  'SELECT id, file, mime, width, height, sort FROM product_images WHERE product_id = ? ORDER BY sort, id'
);

function attachProductExtras(p: Product): Product {
  if (!p) return p;
  const imgs = listImages.all(p.id) as ProductImageRow[];
  // Жинхэнэ зураг байвал түүнийг, байхгүй бол үүсгэсэн SVG-г үзүүлнэ
  p.images = imgs.map((im) => ({ ...im, url: `/img/u/${im.file}` }));
  p.image = p.images.length ? p.images[0].url : `/img/p/${p.id}.svg`;
  p.has_photo = p.images.length > 0;
  p.in_stock = p.stock > 0;
  return p;
}

const PRODUCT_COLUMNS = `p.*, c.slug AS category_slug, c.name AS category_name, c.kind AS kind`;

// ---------------------------------------------------------------------------
// Маршрутууд
// ---------------------------------------------------------------------------
const routes: Route[] = [];
const on = (method: string, path: string, handler: Handler): number =>
  routes.push({ method, path, handler });

// ------------------------- Зураг ------------------------------------------
on('GET', '/img/p/:id.svg', (ctx) => {
  const id = int(ctx.params.id);
  const p = db.prepare('SELECT hue, shape, name, brand FROM products WHERE id = ?').get(id) as
    Pick<ProductRow, 'hue' | 'shape' | 'name' | 'brand'> | undefined;
  const svg = productSvg(p || { hue: 300, shape: 'bottle', brand: 'KS' });
  ctx.raw(Buffer.from(svg, 'utf8'), 'image/svg+xml; charset=utf-8', 200, {
    'Cache-Control': 'public, max-age=86400',
  });
});

// ------------------------- PWA дүрс ----------------------------------------
on('GET', '/icons/icon-:size.png', (ctx) => {
  const size = Math.min(512, Math.max(48, int(ctx.params.size, 192)));
  ctx.raw(getIcon(size), 'image/png', 200, { 'Cache-Control': 'public, max-age=604800' });
});

on('GET', '/icons/maskable-:size.png', (ctx) => {
  const size = Math.min(512, Math.max(48, int(ctx.params.size, 512)));
  ctx.raw(getIcon(size, { maskable: true }), 'image/png', 200, { 'Cache-Control': 'public, max-age=604800' });
});

// Байршуулсан жинхэнэ зураг
on('GET', '/img/u/:file', (ctx) => {
  const name = str(ctx.params.file, 120);
  const buf = uploads.readImage(name);
  if (!buf) return ctx.fail('Зураг олдсонгүй', 404);
  const ext = path.extname(name).toLowerCase();
  ctx.raw(buf, uploads.MIME_BY_EXT[ext] || 'application/octet-stream', 200, {
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
});

// Админ хэсэгт бараа үүсгэхэд урьдчилан харах зураг
on('GET', '/img/preview.svg', (ctx) => {
  const svg = productSvg({
    hue: int(ctx.query.hue, 300),
    shape: str(ctx.query.shape, 20) || 'bottle',
    brand: str(ctx.query.brand, 20),
  });
  ctx.raw(Buffer.from(svg, 'utf8'), 'image/svg+xml; charset=utf-8');
});

// ------------------------- Эхлэл ------------------------------------------
on('GET', '/api/bootstrap', (ctx) => {
  const categories = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS count
    FROM categories c ORDER BY c.sort`).all();
  const brands = (db.prepare('SELECT DISTINCT brand FROM products WHERE active = 1 ORDER BY brand').all() as { brand: string }[])
    .map((r) => r.brand).filter(Boolean);
  const range = db.prepare('SELECT MIN(price) AS min, MAX(price) AS max FROM products WHERE active = 1').get() as
    { min: number | null; max: number | null };
  ctx.json({
    ok: true,
    settings: getSettings(),
    categories,
    brands,
    price: { min: range.min || 0, max: range.max || 0 },
    user: publicUser(currentUser(ctx)),
  });
});

// ------------------------- Бүтээгдэхүүн -----------------------------------
on('GET', '/api/products', (ctx) => {
  const q = ctx.query;
  const where = ['p.active = 1'];
  const args: (string | number)[] = [];

  if (q.kind && (q.kind === 'hair' || q.kind === 'nail')) { where.push('c.kind = ?'); args.push(q.kind); }
  if (q.category) { where.push('c.slug = ?'); args.push(str(q.category, 60)); }
  if (q.brand) {
    const list = str(q.brand, 200).split(',').filter(Boolean);
    if (list.length) { where.push(`p.brand IN (${list.map(() => '?').join(',')})`); args.push(...list); }
  }
  if (q.q) {
    const like = `%${str(q.q, 60)}%`;
    where.push('(p.name LIKE ? OR p.brand LIKE ? OR p.short LIKE ? OR p.sku LIKE ?)');
    args.push(like, like, like, like);
  }
  if (q.min) { where.push('p.price >= ?'); args.push(int(q.min)); }
  if (q.max) { where.push('p.price <= ?'); args.push(int(q.max)); }
  if (q.badge) { where.push('p.badge = ?'); args.push(str(q.badge, 40)); }
  if (q.sale === '1') { where.push('p.compare_price IS NOT NULL AND p.compare_price > p.price'); }

  const ORDERS: Record<string, string> = {
    popular: 'p.sold DESC, p.rating DESC',
    new: 'p.created_at DESC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
    rating: 'p.rating DESC, p.sold DESC',
    name: 'p.name ASC',
  };
  const order = (q.sort && ORDERS[q.sort]) || ORDERS.popular;

  const per = Math.min(48, Math.max(1, int(q.per, 12)));
  const page = Math.max(1, int(q.page, 1));
  const clause = where.join(' AND ');

  const total = (db.prepare(
    `SELECT COUNT(*) AS n FROM products p JOIN categories c ON c.id = p.category_id WHERE ${clause}`
  ).get(...args) as { n: number }).n;

  const items = (db.prepare(
    `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`
  ).all(...args, per, (page - 1) * per) as unknown as Product[]).map(attachProductExtras);

  ctx.json({ ok: true, items, total, page, per, pages: Math.max(1, Math.ceil(total / per)) });
});

on('GET', '/api/products/:id', (ctx) => {
  const p = db.prepare(
    `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`
  ).get(int(ctx.params.id)) as Product | undefined;
  if (!p) return ctx.fail('Бүтээгдэхүүн олдсонгүй', 404);
  attachProductExtras(p);

  const reviews = db.prepare(
    'SELECT id, name, rating, comment, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC'
  ).all(p.id);

  const related = (db.prepare(
    `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.category_id = ? AND p.id != ? AND p.active = 1 ORDER BY p.sold DESC LIMIT 4`
  ).all(p.category_id, p.id) as unknown as Product[]).map(attachProductExtras);

  ctx.json({ ok: true, product: p, reviews, related });
});

on('POST', '/api/products/:id/reviews', (ctx) => {
  const id = int(ctx.params.id);
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!p) return ctx.fail('Бүтээгдэхүүн олдсонгүй', 404);

  const user = currentUser(ctx);
  const name = str(ctx.body.name || user?.name, 60) || 'Зочин';
  const rating = Math.min(5, Math.max(1, int(ctx.body.rating, 5)));
  const comment = str(ctx.body.comment, 600);
  if (comment.length < 3) return ctx.fail('Сэтгэгдлээ бичнэ үү', 400);

  db.prepare(
    'INSERT INTO reviews(product_id, user_id, name, rating, comment, created_at) VALUES(?, ?, ?, ?, ?, ?)'
  ).run(id, user?.id ?? null, name, rating, comment, now());

  const agg = db.prepare('SELECT AVG(rating) AS a FROM reviews WHERE product_id = ?').get(id) as { a: number };
  db.prepare('UPDATE products SET rating = ? WHERE id = ?').run(Math.round(agg.a * 10) / 10, id);

  ctx.json({ ok: true });
});

// ------------------------- Урамшуулал --------------------------------------
on('POST', '/api/promo/check', (ctx) => {
  const code = str(ctx.body.code, 40).toUpperCase();
  const subtotal = int(ctx.body.subtotal);
  const promo = db.prepare('SELECT * FROM promos WHERE code = ? AND active = 1').get(code) as PromoRow | undefined;
  if (!promo) return ctx.fail('Ийм код олдсонгүй', 404);
  if (subtotal < promo.min_total) {
    return ctx.fail(`Энэ код ${promo.min_total.toLocaleString('mn-MN')}₮-с дээш захиалгад хүчинтэй`, 400);
  }
  const discount = promo.type === 'percent'
    ? Math.round(subtotal * promo.value / 100)
    : Math.min(promo.value, subtotal);
  ctx.json({ ok: true, code: promo.code, discount, note: promo.note });
});

// ------------------------- Захиалга ----------------------------------------
on('POST', '/api/orders', (ctx) => {
  const b = ctx.body || {};
  const user = currentUser(ctx);
  const items: { id?: unknown; qty?: unknown }[] = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return ctx.fail('Сагс хоосон байна', 400);

  const name = str(b.name, 80);
  const phone = normPhone(b.phone);
  if (name.length < 2) return ctx.fail('Нэрээ бүрэн оруулна уу', 400);
  if (!validPhone(phone)) return ctx.fail('Утасны дугаар 8 оронтой байх ёстой', 400);

  const delivery = ['ub', 'pickup', 'country'].includes(b.delivery_method) ? b.delivery_method : 'ub';
  const payment = ['cash', 'transfer', 'qpay'].includes(b.payment_method) ? b.payment_method : 'cash';
  const district = str(b.district, 80);
  const address = str(b.address, 300);
  if (delivery !== 'pickup' && address.length < 4) return ctx.fail('Хүргэлтийн хаягаа оруулна уу', 400);

  // Үнийг ҮРГЭЛЖ сервер талд дахин тооцно
  const getP = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1');
  const lines: { p: ProductRow; qty: number }[] = [];
  let subtotal = 0;
  for (const it of items) {
    const p = getP.get(int(it.id)) as ProductRow | undefined;
    if (!p) return ctx.fail('Захиалгад байхгүй бүтээгдэхүүн орсон байна', 400);
    const qty = Math.max(1, Math.min(99, int(it.qty, 1)));
    if (p.stock < qty) return ctx.fail(`"${p.name}" — үлдэгдэл хүрэлцэхгүй байна (${p.stock}ш)`, 409);
    subtotal += p.price * qty;
    lines.push({ p, qty });
  }

  const s = getSettings();
  let deliveryFee = 0;
  if (delivery === 'ub') deliveryFee = subtotal >= Number(s.free_delivery_from) ? 0 : Number(s.delivery_fee);
  else if (delivery === 'country') deliveryFee = Number(s.country_delivery_fee);

  let discount = 0;
  let promoCode = '';
  if (b.promo_code) {
    const promo = db.prepare('SELECT * FROM promos WHERE code = ? AND active = 1')
      .get(str(b.promo_code, 40).toUpperCase()) as PromoRow | undefined;
    if (promo && subtotal >= promo.min_total) {
      discount = promo.type === 'percent'
        ? Math.round(subtotal * promo.value / 100)
        : Math.min(promo.value, subtotal);
      promoCode = promo.code;
    }
  }

  const total = Math.max(0, subtotal + deliveryFee - discount);
  const code = orderCode();
  const ts = now();

  const tx = (): void => {
    const res = db.prepare(`
      INSERT INTO orders(code, user_id, customer_name, phone, district, address, note,
                         delivery_method, payment_method, subtotal, delivery_fee, discount,
                         promo_code, total, status, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`
    ).run(code, user?.id ?? null, name, phone, district, address, str(b.note, 400),
      delivery, payment, subtotal, deliveryFee, discount, promoCode, total, ts, ts);

    const insItem = db.prepare(
      'INSERT INTO order_items(order_id, product_id, name, sku, hue, shape, price, qty) VALUES(?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const dec = db.prepare('UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ?');
    for (const { p, qty } of lines) {
      insItem.run(res.lastInsertRowid, p.id, p.name, p.sku, p.hue, p.shape, p.price, qty);
      dec.run(qty, qty, p.id);
    }
  };

  db.exec('BEGIN');
  try { tx(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }

  // Захиалга амжилттай үүссэний дараа SMS (алдаа гарсан ч захиалгад нөлөөлөхгүй)
  const created = db.prepare('SELECT * FROM orders WHERE code = ?').get(code) as unknown as OrderRow;
  sms.notifyOrderCreated(created);

  ctx.json({
    ok: true,
    code,
    total,
    subtotal,
    delivery_fee: deliveryFee,
    discount,
    payment_method: payment,
    needs_payment: payment === 'qpay',
  });
});

function loadOrder(where: string, ...args: (string | number)[]): Order | null {
  const order = db.prepare(`SELECT * FROM orders WHERE ${where}`).get(...args) as Order | undefined;
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as unknown as OrderItemRow[];
  return order;
}

on('GET', '/api/orders/track', (ctx) => {
  const code = str(ctx.query.code, 30).toUpperCase();
  const phone = normPhone(ctx.query.phone);
  if (!code) return ctx.fail('Захиалгын дугаараа оруулна уу', 400);
  const order = loadOrder('code = ?', code);
  if (!order) return ctx.fail('Захиалга олдсонгүй', 404);

  const user = currentUser(ctx);
  const owner = user && (user.role === 'admin' || user.id === order.user_id);
  if (!owner && order.phone !== phone) return ctx.fail('Утасны дугаар таарахгүй байна', 403);

  ctx.json({ ok: true, order });
});

// ------------------------- Нэвтрэх / бүртгэл -------------------------------
on('POST', '/api/auth/register', (ctx) => {
  const name = str(ctx.body.name, 80);
  const phone = normPhone(ctx.body.phone);
  const password = String(ctx.body.password || '');
  if (name.length < 2) return ctx.fail('Нэрээ оруулна уу', 400);
  if (!validPhone(phone)) return ctx.fail('Утасны дугаар 8 оронтой байх ёстой', 400);
  if (password.length < 6) return ctx.fail('Нууц үг дор хаяж 6 тэмдэгт байна', 400);

  const exists = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (exists) return ctx.fail('Энэ дугаар бүртгэлтэй байна', 409);

  const res = db.prepare(
    'INSERT INTO users(name, phone, email, password_hash, role, created_at) VALUES(?, ?, ?, ?, ?, ?)'
  ).run(name, phone, str(ctx.body.email, 120), hashPassword(password), 'customer', now());

  startSession(ctx, res.lastInsertRowid);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid) as unknown as UserRow;
  ctx.json({ ok: true, user: publicUser(u) });
});

on('POST', '/api/auth/login', (ctx) => {
  const phone = normPhone(ctx.body.phone);
  const password = String(ctx.body.password || '');
  const u = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as UserRow | undefined;
  if (!u || !verifyPassword(password, u.password_hash)) {
    return ctx.fail('Утас эсвэл нууц үг буруу байна', 401);
  }
  startSession(ctx, u.id);
  ctx.json({ ok: true, user: publicUser(u) });
});

on('POST', '/api/auth/logout', (ctx) => {
  if (ctx.cookies.sid) db.prepare('DELETE FROM sessions WHERE token = ?').run(ctx.cookies.sid);
  ctx.setCookie('sid', '', { maxAge: 0 });
  ctx.json({ ok: true });
});

on('GET', '/api/me', (ctx) => {
  const u = requireAuth(ctx); if (!u) return;
  const orders = db.prepare(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(u.id) as unknown as Order[];
  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  for (const o of orders) o.items = getItems.all(o.id) as unknown as OrderItemRow[];
  ctx.json({ ok: true, user: publicUser(u), orders });
});

on('PATCH', '/api/me', (ctx) => {
  const u = requireAuth(ctx); if (!u) return;
  const name = str(ctx.body.name, 80) || u.name;
  db.prepare('UPDATE users SET name = ?, email = ?, address = ?, district = ? WHERE id = ?')
    .run(name, str(ctx.body.email, 120), str(ctx.body.address, 300), str(ctx.body.district, 80), u.id);
  ctx.json({ ok: true, user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id) as unknown as UserRow) });
});

// ---------------------------------------------------------------------------
// АДМИН
// ---------------------------------------------------------------------------
on('GET', '/api/admin/stats', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const paid = "status != 'cancelled'";

  const totals = db.prepare(`
    SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
    FROM orders WHERE ${paid}`).get() as { orders: number; revenue: number };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayRow = db.prepare(`
    SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
    FROM orders WHERE ${paid} AND created_at >= ?`).get(today.toISOString());

  const month = new Date(); month.setDate(month.getDate() - 30);
  const monthRow = db.prepare(`
    SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
    FROM orders WHERE ${paid} AND created_at >= ?`).get(month.toISOString());

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all() as
    { status: string; n: number }[]) {
    byStatus[r.status] = r.n;
  }

  // Сүүлийн 14 хоногийн борлуулалт
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - i);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    const row = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
      FROM orders WHERE ${paid} AND created_at >= ? AND created_at < ?`)
      .get(from.toISOString(), to.toISOString()) as { revenue: number; orders: number };
    series.push({
      date: from.toISOString().slice(0, 10),
      label: `${from.getMonth() + 1}/${from.getDate()}`,
      revenue: row.revenue,
      orders: row.orders,
    });
  }

  const topProducts = db.prepare(`
    SELECT oi.product_id AS id, oi.name, oi.hue, oi.shape,
           SUM(oi.qty) AS qty, SUM(oi.qty * oi.price) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
    GROUP BY oi.product_id ORDER BY qty DESC LIMIT 8`).all();

  const lowStock = db.prepare(`
    SELECT p.id, p.name, p.sku, p.stock, p.hue, p.shape, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 ORDER BY p.stock ASC LIMIT 8`).all();

  const recent = db.prepare(
    'SELECT id, code, customer_name, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 8'
  ).all();

  const byCategory = db.prepare(`
    SELECT c.name, c.kind, COALESCE(SUM(oi.qty * oi.price), 0) AS revenue
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    GROUP BY c.id ORDER BY revenue DESC`).all();

  const customers = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").get() as { n: number }).n;
  const products = (db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1').get() as { n: number }).n;

  ctx.json({
    ok: true,
    totals: { ...totals, customers, products },
    today: todayRow,
    month: monthRow,
    byStatus, series, topProducts, lowStock, recent, byCategory,
  });
});

on('GET', '/api/admin/orders', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (ctx.query.status && STATUSES.includes(ctx.query.status)) {
    where.push('status = ?'); args.push(ctx.query.status);
  }
  if (ctx.query.q) {
    const like = `%${str(ctx.query.q, 60)}%`;
    where.push('(code LIKE ? OR customer_name LIKE ? OR phone LIKE ?)');
    args.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM orders ${clause}`).get(...args) as { n: number }).n;
  const per = Math.min(100, Math.max(5, int(ctx.query.per, 25)));
  const page = Math.max(1, int(ctx.query.page, 1));
  const items = db.prepare(
    `SELECT * FROM orders ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...args, per, (page - 1) * per) as unknown as Order[];
  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  for (const o of items) o.items = getItems.all(o.id) as unknown as OrderItemRow[];
  ctx.json({ ok: true, items, total, page, per, pages: Math.max(1, Math.ceil(total / per)) });
});

on('PATCH', '/api/admin/orders/:id', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const id = int(ctx.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
  if (!order) return ctx.fail('Захиалга олдсонгүй', 404);

  const status = str(ctx.body.status, 20);
  if (!STATUSES.includes(status)) return ctx.fail('Төлөв буруу байна', 400);

  // Цуцлахад үлдэгдлийг буцаана
  if (status === 'cancelled' && order.status !== 'cancelled') {
    const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(id) as
      Pick<OrderItemRow, 'product_id' | 'qty'>[];
    const inc = db.prepare('UPDATE products SET stock = stock + ?, sold = MAX(0, sold - ?) WHERE id = ?');
    for (const it of items) if (it.product_id) inc.run(it.qty, it.qty, it.product_id);
  }
  if (order.status === 'cancelled' && status !== 'cancelled') {
    const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(id) as
      Pick<OrderItemRow, 'product_id' | 'qty'>[];
    const dec = db.prepare('UPDATE products SET stock = MAX(0, stock - ?), sold = sold + ? WHERE id = ?');
    for (const it of items) if (it.product_id) dec.run(it.qty, it.qty, it.product_id);
  }

  db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), id);
  const updated = loadOrder('id = ?', id)!;

  // Төлөв солигдсоныг үйлчлүүлэгчид мэдэгдэнэ
  if (status !== order.status) sms.notifyOrderStatus(updated);

  ctx.json({ ok: true, order: updated });
});

on('GET', '/api/admin/products', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (ctx.query.q) {
    const like = `%${str(ctx.query.q, 60)}%`;
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.brand LIKE ?)');
    args.push(like, like, like);
  }
  if (ctx.query.category) { where.push('c.slug = ?'); args.push(str(ctx.query.category, 60)); }
  if (ctx.query.stock === 'low') where.push('p.stock <= 20');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const items = (db.prepare(
    `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
     ${clause} ORDER BY p.id DESC`
  ).all(...args) as unknown as Product[]).map(attachProductExtras);
  ctx.json({ ok: true, items });
});

const PRODUCT_FIELDS = ['sku', 'name', 'brand', 'category_id', 'price', 'compare_price', 'stock',
  'hue', 'shape', 'badge', 'volume', 'short', 'description', 'howto', 'ingredients', 'active'] as const;

type ProductBody = Record<(typeof PRODUCT_FIELDS)[number], string | number | null>;

function readProductBody(b: any): ProductBody {
  return {
    sku: str(b.sku, 40),
    name: str(b.name, 200),
    brand: str(b.brand, 80),
    category_id: int(b.category_id),
    price: Math.max(0, int(b.price)),
    compare_price: b.compare_price ? Math.max(0, int(b.compare_price)) : null,
    stock: Math.max(0, int(b.stock)),
    hue: ((int(b.hue, 300) % 360) + 360) % 360,
    shape: ['bottle', 'jar', 'tube', 'spray', 'drop', 'polish', 'tool', 'set'].includes(b.shape) ? b.shape : 'bottle',
    badge: str(b.badge, 40),
    volume: str(b.volume, 60),
    short: str(b.short, 300),
    description: str(b.description, 3000),
    howto: str(b.howto, 1500),
    ingredients: str(b.ingredients, 1500),
    active: b.active === false || b.active === 0 ? 0 : 1,
  };
}

on('POST', '/api/admin/products', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const p = readProductBody(ctx.body);
  if (!p.name) return ctx.fail('Барааны нэрийг оруулна уу', 400);
  if (!p.sku) p.sku = 'KS-' + crypto.randomInt(1000, 9999);
  if (!p.category_id) return ctx.fail('Ангилал сонгоно уу', 400);
  if (db.prepare('SELECT id FROM products WHERE sku = ?').get(p.sku)) {
    return ctx.fail('Ийм SKU бүртгэлтэй байна', 409);
  }
  const cols = PRODUCT_FIELDS.join(', ');
  const marks = PRODUCT_FIELDS.map(() => '?').join(', ');
  const res = db.prepare(
    `INSERT INTO products(${cols}, rating, sold, created_at) VALUES(${marks}, 5, 0, ?)`
  ).run(...PRODUCT_FIELDS.map((f) => p[f]), now());
  ctx.json({ ok: true, id: res.lastInsertRowid });
});

on('PATCH', '/api/admin/products/:id', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const id = int(ctx.params.id);
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  if (!cur) return ctx.fail('Бараа олдсонгүй', 404);

  // Хэсэгчилсэн засвар (жишээ нь зөвхөн үлдэгдэл/идэвх)
  const merged = readProductBody({ ...cur, ...ctx.body });
  const dup = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(merged.sku, id);
  if (dup) return ctx.fail('Ийм SKU бүртгэлтэй байна', 409);

  db.prepare(`UPDATE products SET ${PRODUCT_FIELDS.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`)
    .run(...PRODUCT_FIELDS.map((f) => merged[f]), id);
  ctx.json({ ok: true });
});

on('DELETE', '/api/admin/products/:id', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const id = int(ctx.params.id);
  const used = (db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?').get(id) as { n: number }).n;
  if (used > 0) {
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
    return ctx.json({ ok: true, archived: true });
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  ctx.json({ ok: true, archived: false });
});

on('GET', '/api/admin/customers', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const items = db.prepare(`
    SELECT u.id, u.name, u.phone, u.email, u.district, u.created_at,
           (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders,
           (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') AS spent
    FROM users u WHERE u.role = 'customer' ORDER BY spent DESC`).all();
  ctx.json({ ok: true, items });
});

on('GET', '/api/admin/promos', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  ctx.json({ ok: true, items: db.prepare('SELECT * FROM promos ORDER BY code').all() });
});

on('POST', '/api/admin/promos', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const code = str(ctx.body.code, 40).toUpperCase().replace(/\s+/g, '');
  if (code.length < 3) return ctx.fail('Код дор хаяж 3 тэмдэгт', 400);
  const type = ctx.body.type === 'amount' ? 'amount' : 'percent';
  const value = Math.max(1, int(ctx.body.value));
  if (type === 'percent' && value > 90) return ctx.fail('Хувь 90-ээс ихгүй байна', 400);
  db.prepare(`
    INSERT INTO promos(code, type, value, min_total, active, note) VALUES(?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET type = excluded.type, value = excluded.value,
      min_total = excluded.min_total, active = excluded.active, note = excluded.note`
  ).run(code, type, value, Math.max(0, int(ctx.body.min_total)),
    ctx.body.active === false ? 0 : 1, str(ctx.body.note, 200));
  ctx.json({ ok: true });
});

on('DELETE', '/api/admin/promos/:code', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  db.prepare('DELETE FROM promos WHERE code = ?').run(str(ctx.params.code, 40).toUpperCase());
  ctx.json({ ok: true });
});

on('GET', '/api/admin/categories', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const items = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS count
    FROM categories c ORDER BY c.sort`).all();
  ctx.json({ ok: true, items });
});

on('POST', '/api/admin/categories', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const name = str(ctx.body.name, 80);
  if (!name) return ctx.fail('Ангиллын нэр оруулна уу', 400);
  const slug = str(ctx.body.slug, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-')
    || 'cat-' + crypto.randomInt(1000, 9999);
  const kind = ctx.body.kind === 'nail' ? 'nail' : 'hair';
  if (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) {
    return ctx.fail('Ийм slug бүртгэлтэй байна', 409);
  }
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM categories').get() as { m: number }).m;
  db.prepare('INSERT INTO categories(slug, name, kind, icon, sort) VALUES(?, ?, ?, ?, ?)')
    .run(slug, name, kind, str(ctx.body.icon, 20) || 'bottle', maxSort + 1);
  ctx.json({ ok: true });
});

on('DELETE', '/api/admin/categories/:id', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const id = int(ctx.params.id);
  const n = (db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').get(id) as { n: number }).n;
  if (n > 0) return ctx.fail(`Энэ ангилалд ${n} бараа байна. Эхлээд шилжүүлнэ үү.`, 409);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  ctx.json({ ok: true });
});

on('GET', '/api/admin/settings', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  ctx.json({ ok: true, settings: getSettings(), keys: Object.keys(DEFAULT_SETTINGS) });
});

on('PATCH', '/api/admin/settings', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  for (const [k, v] of Object.entries(ctx.body || {})) {
    if (k in DEFAULT_SETTINGS) setSetting(k, str(v, 400));
  }
  ctx.json({ ok: true, settings: getSettings() });
});

// ---------------------------------------------------------------------------
// НУУЦ ҮГ СЭРГЭЭХ
// ---------------------------------------------------------------------------
const hashCode = (code: string): string => crypto.createHash('sha256').update(String(code)).digest('hex');

on('POST', '/api/auth/forgot', async (ctx) => {
  const phone = normPhone(ctx.body.phone);
  if (!validPhone(phone)) return ctx.fail('Утасны дугаар 8 оронтой байх ёстой', 400);

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as UserRow | undefined;

  // Хэрэглэгч байхгүй ч ижил хариу буцаана — дугаар бүртгэлтэй эсэхийг
  // гаднаас тандах боломжийг хаана.
  const generic = {
    ok: true,
    message: 'Хэрэв энэ дугаар бүртгэлтэй бол сэргээх кодыг илгээлээ.',
    ttl_minutes: config.reset.ttlMinutes,
  };

  if (!user) return ctx.json(generic);

  // Хэт олон хүсэлтээс хамгаална — 1 минутад 1 удаа
  const recent = db.prepare(
    'SELECT created_at FROM password_resets WHERE phone = ? ORDER BY id DESC LIMIT 1'
  ).get(phone) as { created_at: string } | undefined;
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
    return ctx.fail('1 минутын дараа дахин оролдоно уу', 429);
  }

  // Хуучин кодуудыг хүчингүй болгоно
  db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
    .run(now(), user.id);

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = Date.now() + config.reset.ttlMinutes * 60_000;
  db.prepare(
    'INSERT INTO password_resets(user_id, phone, code_hash, expires_at, created_at) VALUES(?, ?, ?, ?, ?)'
  ).run(user.id, phone, hashCode(code), expiresAt, now());

  const sent = await sms.sendSms(phone, sms.resetCodeText(code), { kind: 'reset' });

  // SMS mock горимд ажиллаж байгаа үед кодыг харуулахгүй бол хөгжүүлэгч
  // урсгалыг турших боломжгүй болно. Live горимд ХЭЗЭЭ Ч буцаахгүй.
  if (sent.mock && config.reset.revealInMock) {
    return ctx.json({ ...generic, mock: true, code, hint: 'SMS mock горимд ажиллаж байна' });
  }
  ctx.json(generic);
});

on('POST', '/api/auth/reset', (ctx) => {
  const phone = normPhone(ctx.body.phone);
  const code = str(ctx.body.code, 10).replace(/[^0-9]/g, '');
  const password = String(ctx.body.password || '');
  if (!validPhone(phone)) return ctx.fail('Утасны дугаар буруу байна', 400);
  if (password.length < 6) return ctx.fail('Нууц үг дор хаяж 6 тэмдэгт байна', 400);

  const row = db.prepare(`
    SELECT * FROM password_resets
    WHERE phone = ? AND used_at IS NULL
    ORDER BY id DESC LIMIT 1`).get(phone) as PasswordResetRow | undefined;

  if (!row) return ctx.fail('Сэргээх код олдсонгүй. Дахин хүсэлт илгээнэ үү.', 400);
  if (row.expires_at < Date.now()) return ctx.fail('Кодын хугацаа дууссан байна', 400);
  if (row.attempts >= config.reset.maxAttempts) {
    return ctx.fail('Хэт олон удаа буруу оруулсан тул код хаагдлаа', 429);
  }

  if (hashCode(code) !== row.code_hash) {
    db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    const left = config.reset.maxAttempts - row.attempts - 1;
    return ctx.fail(`Код буруу байна${left > 0 ? ` (${left} оролдлого үлдлээ)` : ''}`, 400);
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), row.user_id);
  db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now(), row.id);
  // Аюулгүйн үүднээс бүх идэвхтэй сешнийг хаана
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);

  startSession(ctx, row.user_id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id) as unknown as UserRow;
  ctx.json({ ok: true, user: publicUser(u), message: 'Нууц үг шинэчлэгдлээ' });
});

// ---------------------------------------------------------------------------
// БАРААНЫ ЗУРАГ (админ)
// ---------------------------------------------------------------------------
routes.push({
  method: 'POST',
  path: '/api/admin/products/:id/images',
  raw: true,
  limit: config.uploads.maxBytes + 64 * 1024,   // multipart толгойд зай үлдээнэ
  handler: (ctx) => {
    const a = requireAdmin(ctx); if (!a) return;
    const id = int(ctx.params.id);
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!product) return ctx.fail('Бараа олдсонгүй', 404);

    let parsed: uploads.MultipartResult;
    try {
      parsed = uploads.parseMultipart(ctx.rawBody!, ctx.req.headers['content-type'] || '');
    } catch (e) {
      return ctx.fail('Файлыг уншиж чадсангүй: ' + (e as Error).message, 400);
    }
    if (!parsed.files.length) return ctx.fail('Зураг сонгоно уу', 400);

    const maxSort = (db.prepare(
      'SELECT COALESCE(MAX(sort), -1) AS m FROM product_images WHERE product_id = ?'
    ).get(id) as { m: number }).m;

    const saved = [];
    const errors: string[] = [];
    let sort = maxSort + 1;
    for (const file of parsed.files) {
      try {
        const info = uploads.saveImage(file);
        const r = db.prepare(`
          INSERT INTO product_images(product_id, file, mime, width, height, bytes, sort, created_at)
          VALUES(?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, info.file, info.mime, info.width, info.height, info.bytes, sort++, now());
        saved.push({ id: r.lastInsertRowid, url: `/img/u/${info.file}`, ...info });
      } catch (e) {
        errors.push(`${file.filename}: ${(e as Error).message}`);
      }
    }

    if (!saved.length) return ctx.fail(errors.join('; ') || 'Зураг хадгалагдсангүй', 400);
    ctx.json({ ok: true, images: saved, errors });
  },
});

on('DELETE', '/api/admin/products/:id/images/:imageId', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const id = int(ctx.params.id);
  const imageId = int(ctx.params.imageId);
  const img = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').get(imageId, id) as
    ProductImageRow | undefined;
  if (!img) return ctx.fail('Зураг олдсонгүй', 404);

  db.prepare('DELETE FROM product_images WHERE id = ?').run(imageId);
  uploads.removeImage(img.file);
  ctx.json({ ok: true });
});

// Эрэмбэ солих — эхний зураг нь үндсэн зураг болно
on('PATCH', '/api/admin/products/:id/images', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const id = int(ctx.params.id);
  const order: unknown[] = Array.isArray(ctx.body.order) ? ctx.body.order : [];
  if (!order.length) return ctx.fail('Эрэмбэ хоосон байна', 400);

  const upd = db.prepare('UPDATE product_images SET sort = ? WHERE id = ? AND product_id = ?');
  order.forEach((imageId, i) => upd.run(i, int(imageId), id));
  ctx.json({
    ok: true,
    images: (listImages.all(id) as ProductImageRow[]).map((im) => ({ ...im, url: `/img/u/${im.file}` })),
  });
});

// ---------------------------------------------------------------------------
// ТАЙЛАН ТАТАХ (CSV)
// ---------------------------------------------------------------------------
const DELIVERY_MN: Record<string, string> = { ub: 'Хотод хүргэх', pickup: 'Өөрөө авах', country: 'Орон нутаг' };
const PAYMENT_MN: Record<string, string> = { cash: 'Бэлнээр', transfer: 'Данс', qpay: 'QPay' };
const STATUS_MN: Record<string, string> = {
  new: 'Шинэ', confirmed: 'Баталгаажсан', packed: 'Савлагдсан',
  shipping: 'Хүргэлтэд', delivered: 'Хүргэгдсэн', cancelled: 'Цуцлагдсан',
};

function sendCsv(ctx: Ctx, filename: string, headers: string[], rows: CsvValue[][]): void {
  const sep = ctx.query.sep === 'semicolon' ? ';' : ',';
  const buf = csv.toBuffer(headers, rows, sep);
  ctx.raw(buf, 'text/csv; charset=utf-8', 200, {
    'Content-Disposition': csv.contentDisposition(filename),
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
  });
}

const dateStamp = (): string => new Date().toISOString().slice(0, 10);

on('GET', '/api/admin/export/orders.csv', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const where: string[] = [];
  const args: string[] = [];
  if (ctx.query.status && STATUSES.includes(ctx.query.status)) {
    where.push('o.status = ?'); args.push(ctx.query.status);
  }
  if (ctx.query.from) { where.push('o.created_at >= ?'); args.push(str(ctx.query.from, 30)); }
  if (ctx.query.to) { where.push('o.created_at <= ?'); args.push(str(ctx.query.to, 30) + 'T23:59:59Z'); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orders = db.prepare(`SELECT * FROM orders o ${clause} ORDER BY o.created_at DESC`).all(...args) as
    unknown as OrderRow[];
  const getItems = db.prepare('SELECT name, sku, price, qty FROM order_items WHERE order_id = ?');

  const rows = orders.map((o) => {
    const items = getItems.all(o.id) as Pick<OrderItemRow, 'name' | 'sku' | 'price' | 'qty'>[];
    return [
      o.code,
      o.created_at.slice(0, 10),
      o.created_at.slice(11, 16),
      o.customer_name,
      o.phone,
      o.district,
      o.address,
      DELIVERY_MN[o.delivery_method] || o.delivery_method,
      PAYMENT_MN[o.payment_method] || o.payment_method,
      STATUS_MN[o.status] || o.status,
      o.payment_status === 'paid' ? 'Төлсөн' : 'Төлөөгүй',
      items.length,
      items.map((i) => `${i.name} x${i.qty}`).join(' | '),
      o.subtotal,
      o.delivery_fee,
      o.discount,
      o.promo_code,
      o.total,
    ];
  });

  sendCsv(ctx, `khishgee-zahialga-${dateStamp()}.csv`, [
    'Дугаар', 'Огноо', 'Цаг', 'Захиалагч', 'Утас', 'Дүүрэг', 'Хаяг',
    'Хүргэлт', 'Төлбөр', 'Төлөв', 'Төлбөрийн төлөв', 'Барааны тоо', 'Бараа',
    'Дүн', 'Хүргэлтийн хураамж', 'Хөнгөлөлт', 'Урамшууллын код', 'Нийт',
  ], rows);
});

on('GET', '/api/admin/export/products.csv', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const items = db.prepare(`
    SELECT p.*, c.name AS category_name FROM products p
    JOIN categories c ON c.id = p.category_id ORDER BY p.id`).all() as
    unknown as (ProductRow & { category_name: string })[];

  const rows = items.map((p) => [
    p.id, p.sku, p.name, p.brand, p.category_name, p.price, p.compare_price || '',
    p.stock, p.sold, p.rating, p.volume, p.active ? 'Идэвхтэй' : 'Нуугдсан',
    p.created_at.slice(0, 10),
  ]);

  sendCsv(ctx, `khishgee-baraa-${dateStamp()}.csv`, [
    'ID', 'SKU', 'Нэр', 'Брэнд', 'Ангилал', 'Үнэ', 'Хуучин үнэ',
    'Үлдэгдэл', 'Заралсан', 'Үнэлгээ', 'Багтаамж', 'Төлөв', 'Бүртгэсэн',
  ], rows);
});

on('GET', '/api/admin/export/customers.csv', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const items = db.prepare(`
    SELECT u.name, u.phone, u.email, u.district, u.address, u.created_at,
           (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders,
           (SELECT COALESCE(SUM(total), 0) FROM orders o
             WHERE o.user_id = u.id AND o.status != 'cancelled') AS spent
    FROM users u WHERE u.role = 'customer' ORDER BY spent DESC`).all() as
    unknown as (Pick<UserRow, 'name' | 'phone' | 'email' | 'district' | 'address' | 'created_at'> &
      { orders: number; spent: number })[];

  const rows = items.map((u) => [
    u.name, u.phone, u.email, u.district, u.address, u.orders, u.spent, u.created_at.slice(0, 10),
  ]);

  sendCsv(ctx, `khishgee-hereglegch-${dateStamp()}.csv`, [
    'Нэр', 'Утас', 'Имэйл', 'Дүүрэг', 'Хаяг', 'Захиалгын тоо', 'Нийт зарцуулалт', 'Бүртгүүлсэн',
  ], rows);
});

// Борлуулалтын өдрөөр нэгтгэсэн тайлан
on('GET', '/api/admin/export/sales.csv', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const rows = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day,
           COUNT(*) AS orders,
           COALESCE(SUM(subtotal), 0) AS subtotal,
           COALESCE(SUM(delivery_fee), 0) AS delivery,
           COALESCE(SUM(discount), 0) AS discount,
           COALESCE(SUM(total), 0) AS total
    FROM orders WHERE status != 'cancelled'
    GROUP BY day ORDER BY day DESC`).all() as
    { day: string; orders: number; subtotal: number; delivery: number; discount: number; total: number }[];

  sendCsv(ctx, `khishgee-borluulalt-${dateStamp()}.csv`,
    ['Өдөр', 'Захиалга', 'Барааны дүн', 'Хүргэлт', 'Хөнгөлөлт', 'Нийт орлого'],
    rows.map((r) => [r.day, r.orders, r.subtotal, r.delivery, r.discount, r.total]));
});

// ---------------------------------------------------------------------------
// QPAY ТӨЛБӨР
// ---------------------------------------------------------------------------
function findOrderForPayment(ctx: Ctx): OrderRow | null {
  const code = str(ctx.params.code, 30).toUpperCase();
  const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(code) as OrderRow | undefined;
  if (!order) { ctx.fail('Захиалга олдсонгүй', 404); return null; }

  // Эзэмшигч эсэхийг шалгана: нэвтэрсэн эзэн, админ, эсвэл утас таарсан зочин
  const user = currentUser(ctx);
  const owner = user && (user.role === 'admin' || user.id === order.user_id);
  const phone = normPhone(ctx.query.phone || ctx.body?.phone);
  if (!owner && order.phone !== phone) { ctx.fail('Утасны дугаар таарахгүй байна', 403); return null; }
  return order;
}

function paymentPublic(row: PaymentRow, extra: Record<string, unknown> = {}) {
  return {
    invoice_id: row.invoice_id,
    status: row.status,
    mode: row.mode,
    amount: row.amount,
    paid_amount: row.paid_amount,
    short_url: row.short_url,
    qr_text: row.qr_text,
    ...extra,
  };
}

on('POST', '/api/payments/qpay/:code', async (ctx) => {
  const order = findOrderForPayment(ctx); if (!order) return;
  if (order.payment_status === 'paid') return ctx.fail('Энэ захиалга аль хэдийн төлөгдсөн', 409);
  if (order.status === 'cancelled') return ctx.fail('Цуцлагдсан захиалга төлөх боломжгүй', 409);

  // Хүчинтэй нэхэмжлэх байвал дахин ашиглана
  const existing = db.prepare(
    "SELECT * FROM payments WHERE order_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
  ).get(order.id) as PaymentRow | undefined;
  if (existing && existing.amount === order.total) {
    return ctx.json({
      ok: true,
      payment: paymentPublic(existing, { qr_svg: existing.qr_text ? qr.toSvg(existing.qr_text, { scale: 6 }) : '' }),
    });
  }

  let inv: qpay.Invoice;
  try {
    inv = await qpay.createInvoice(order);
  } catch (e) {
    console.error('[qpay]', (e as Error).message);
    return ctx.fail('Төлбөрийн нэхэмжлэх үүсгэж чадсангүй. Дараа дахин оролдоно уу.', 502);
  }

  const res = db.prepare(`
    INSERT INTO payments(order_id, provider, mode, invoice_id, qr_text, short_url, amount,
                         status, raw, created_at, updated_at)
    VALUES(?, 'qpay', ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).run(order.id, inv.mode, inv.invoiceId, inv.qrText || '', inv.shortUrl || '', order.total,
    JSON.stringify(inv.raw || {}).slice(0, 4000), now(), now());

  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(res.lastInsertRowid) as unknown as PaymentRow;
  ctx.json({
    ok: true,
    payment: paymentPublic(row, {
      qr_svg: inv.qrSvg,
      qr_image_base64: inv.qrImageBase64 || '',
      urls: inv.urls || [],
    }),
  });
});

on('GET', '/api/payments/qpay/:code', async (ctx) => {
  const order = findOrderForPayment(ctx); if (!order) return;
  const row = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id) as
    PaymentRow | undefined;
  if (!row) return ctx.json({ ok: true, payment: null, order_status: order.payment_status });

  // Live горимд QPay-аас баталгаажуулна
  if (row.status === 'pending' && row.mode === 'live') {
    try {
      const check = await qpay.checkPayment(row);
      if (check.paid) markPaid(order, row, check.amount, check.paymentId);
    } catch (e) {
      console.error('[qpay check]', (e as Error).message);
    }
  }

  const fresh = db.prepare('SELECT * FROM payments WHERE id = ?').get(row.id) as unknown as PaymentRow;
  const freshOrder = db.prepare('SELECT payment_status FROM orders WHERE id = ?').get(order.id) as
    Pick<OrderRow, 'payment_status'>;
  ctx.json({ ok: true, payment: paymentPublic(fresh), order_status: freshOrder.payment_status });
});

function markPaid(order: OrderRow, payment: PaymentRow, amount: number, paymentId: string): OrderRow {
  const ts = now();
  db.prepare(
    "UPDATE payments SET status = 'paid', paid_amount = ?, payment_id = ?, updated_at = ? WHERE id = ?"
  ).run(int(amount), str(paymentId, 80), ts, payment.id);
  db.prepare("UPDATE orders SET payment_status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?")
    .run(ts, ts, order.id);

  // Төлбөр орсон захиалгыг автоматаар баталгаажуулна
  if (order.status === 'new') {
    db.prepare("UPDATE orders SET status = 'confirmed', updated_at = ? WHERE id = ?").run(ts, order.id);
  }
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) as unknown as OrderRow;
  sms.sendSms(updated.phone,
    `${getSettings().store_name}\nЗахиалга ${updated.code}-ийн ${Number(updated.total).toLocaleString('mn-MN')}₮ төлбөр амжилттай хүлээн авлаа. Баярлалаа!`,
    { kind: 'status', orderId: updated.id });
  return updated;
}

// QPay callback — банкнаас ирнэ (нэвтрэлт шаардахгүй, гэхдээ шалгана)
on('GET', '/api/payments/qpay-callback', async (ctx) => {
  const code = str(ctx.query.order, 30).toUpperCase();
  const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(code) as OrderRow | undefined;
  if (!order) return ctx.fail('Захиалга олдсонгүй', 404);

  const row = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id) as
    PaymentRow | undefined;
  if (!row) return ctx.fail('Нэхэмжлэх олдсонгүй', 404);

  // Callback-д хэзээ ч шууд итгэхгүй — QPay-аас өөрөөс нь дахин лавлана
  try {
    const check = await qpay.checkPayment(row);
    if (check.paid) markPaid(order, row, check.amount, check.paymentId);
  } catch (e) {
    console.error('[qpay callback]', (e as Error).message);
    return ctx.fail('Шалгах үед алдаа гарлаа', 502);
  }
  ctx.json({ ok: true });
});

// Зөвхөн mock горимд — «төлсөн» болгож урсгалыг бүтнээр нь турших
on('POST', '/api/payments/qpay/:code/simulate', (ctx) => {
  if (qpay.isLive()) return ctx.fail('Live горимд ашиглах боломжгүй', 403);
  const order = findOrderForPayment(ctx); if (!order) return;
  const row = db.prepare(
    "SELECT * FROM payments WHERE order_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
  ).get(order.id) as PaymentRow | undefined;
  if (!row) return ctx.fail('Хүлээгдэж буй нэхэмжлэх алга', 404);

  const updated = markPaid(order, row, row.amount, 'mock_' + crypto.randomBytes(4).toString('hex'));
  ctx.json({ ok: true, order_status: updated.payment_status, status: 'paid' });
});

// ---------------------------------------------------------------------------
// АДМИН — мессеж, төлбөр, интеграцийн төлөв
// ---------------------------------------------------------------------------
on('GET', '/api/admin/sms', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const items = db.prepare('SELECT * FROM sms_outbox ORDER BY id DESC LIMIT 200').all();
  const stats = (db.prepare(`
    SELECT status, COUNT(*) AS n FROM sms_outbox GROUP BY status`).all() as { status: string; n: number }[])
    .reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: r.n }), {});
  ctx.json({ ok: true, items, stats, live: config.sms.live, provider: config.sms.provider });
});

on('POST', '/api/admin/sms/test', async (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const phone = normPhone(ctx.body.phone);
  if (!validPhone(phone)) return ctx.fail('Утасны дугаар 8 оронтой байх ёстой', 400);
  const text = str(ctx.body.text, 300) || `${getSettings().store_name} — туршилтын мессеж.`;
  const r = await sms.sendSms(phone, text, { kind: 'test' });
  ctx.json({ ok: r.ok, result: r });
});

on('GET', '/api/admin/payments', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  const items = db.prepare(`
    SELECT p.*, o.code AS order_code, o.customer_name, o.phone
    FROM payments p JOIN orders o ON o.id = p.order_id
    ORDER BY p.id DESC LIMIT 200`).all();
  ctx.json({ ok: true, items, live: qpay.isLive() });
});

on('GET', '/api/admin/integrations', (ctx) => {
  const a = requireAdmin(ctx); if (!a) return;
  ctx.json({
    ok: true,
    qpay: {
      live: config.qpay.live,
      base_url: config.qpay.baseUrl,
      callback_base: config.qpay.callbackBase,
      missing: ['QPAY_USERNAME', 'QPAY_PASSWORD', 'QPAY_INVOICE_CODE']
        .filter((k) => !config.env[k]),
    },
    sms: {
      live: config.sms.live,
      provider: config.sms.provider,
      notify_on_order: config.sms.notifyOnOrder,
      notify_on_status: config.sms.notifyOnStatus,
    },
    uploads: { max_bytes: config.uploads.maxBytes },
  });
});

export default routes;
