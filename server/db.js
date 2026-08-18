'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');
const seed = require('./seed-data');

// KS_DATA_DIR — тест болон тусдаа байршуулалтад өөр хавтас заах боломж
const DATA_DIR = process.env.KS_DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'salon.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ---------------------------------------------------------------------------
// Схем
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  slug    TEXT NOT NULL UNIQUE,
  name    TEXT NOT NULL,
  kind    TEXT NOT NULL,               -- hair | nail
  icon    TEXT NOT NULL DEFAULT 'bottle',
  sort    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sku           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  brand         TEXT NOT NULL DEFAULT '',
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  price         INTEGER NOT NULL,
  compare_price INTEGER,
  stock         INTEGER NOT NULL DEFAULT 0,
  hue           INTEGER NOT NULL DEFAULT 300,
  shape         TEXT NOT NULL DEFAULT 'bottle',
  badge         TEXT NOT NULL DEFAULT '',
  rating        REAL NOT NULL DEFAULT 5,
  sold          INTEGER NOT NULL DEFAULT 0,
  volume        TEXT NOT NULL DEFAULT '',
  short         TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  howto         TEXT NOT NULL DEFAULT '',
  ingredients   TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',   -- customer | admin
  address       TEXT NOT NULL DEFAULT '',
  district      TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,
  user_id         INTEGER REFERENCES users(id),
  customer_name   TEXT NOT NULL,
  phone           TEXT NOT NULL,
  district        TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',
  note            TEXT NOT NULL DEFAULT '',
  delivery_method TEXT NOT NULL DEFAULT 'ub',       -- ub | pickup | country
  payment_method  TEXT NOT NULL DEFAULT 'cash',     -- cash | transfer | qpay
  subtotal        INTEGER NOT NULL,
  delivery_fee    INTEGER NOT NULL DEFAULT 0,
  discount        INTEGER NOT NULL DEFAULT 0,
  promo_code      TEXT NOT NULL DEFAULT '',
  total           INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  name       TEXT NOT NULL,
  sku        TEXT NOT NULL DEFAULT '',
  hue        INTEGER NOT NULL DEFAULT 300,
  shape      TEXT NOT NULL DEFAULT 'bottle',
  price      INTEGER NOT NULL,
  qty        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    INTEGER,
  name       TEXT NOT NULL,
  rating     INTEGER NOT NULL,
  comment    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promos (
  code      TEXT PRIMARY KEY,
  type      TEXT NOT NULL,             -- percent | amount
  value     INTEGER NOT NULL,
  min_total INTEGER NOT NULL DEFAULT 0,
  active    INTEGER NOT NULL DEFAULT 1,
  note      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file       TEXT NOT NULL,               -- data/uploads доторх файлын нэр
  mime       TEXT NOT NULL DEFAULT 'image/jpeg',
  width      INTEGER NOT NULL DEFAULT 0,
  height     INTEGER NOT NULL DEFAULT 0,
  bytes      INTEGER NOT NULL DEFAULT 0,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_outbox (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  phone      TEXT NOT NULL,
  body       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'other',   -- order | status | reset | test
  provider   TEXT NOT NULL DEFAULT 'mock',
  status     TEXT NOT NULL DEFAULT 'queued',  -- queued | sent | failed
  error      TEXT NOT NULL DEFAULT '',
  order_id   INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL DEFAULT 'qpay',
  mode          TEXT NOT NULL DEFAULT 'mock',    -- mock | live
  invoice_id    TEXT NOT NULL DEFAULT '',
  qr_text       TEXT NOT NULL DEFAULT '',
  short_url     TEXT NOT NULL DEFAULT '',
  amount        INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | paid | cancelled | failed
  paid_amount   INTEGER NOT NULL DEFAULT 0,
  payment_id    TEXT NOT NULL DEFAULT '',
  raw           TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_cat    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user     ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_items_order     ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_pimg_product    ON product_images(product_id, sort);
CREATE INDEX IF NOT EXISTS idx_reset_phone     ON password_resets(phone, expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_order  ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_sms_created     ON sms_outbox(created_at);
`);

// ---------------------------------------------------------------------------
// Хувилбар ахиулах — хуучин сан дээр дутуу баганыг нэмнэ
// ---------------------------------------------------------------------------
function addColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

addColumn('orders', 'payment_status', "TEXT NOT NULL DEFAULT 'unpaid'");   // unpaid | paid | refunded
addColumn('orders', 'paid_at', 'TEXT');

// ---------------------------------------------------------------------------
// Тохиргоо
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  store_name: "Khishgee's Salon",
  tagline: 'Мэргэжлийн үс, хумсны бүтээгдэхүүн',
  phone: '7000-8080',
  phone2: '9911-2233',
  email: 'sales@khishgee.mn',
  address: 'Улаанбаатар, Сүхбаатар дүүрэг, 1-р хороо, Их сургуулийн гудамж 12',
  work_hours: 'Даваа–Бямба 10:00–20:00 · Ням 11:00–18:00',
  delivery_fee: '8000',
  free_delivery_from: '150000',
  country_delivery_fee: '15000',
  bank_account: 'Хаан банк · 5xxx xxxx xx · Хишгээ ХХК',
  facebook: 'facebook.com/khishgeesalon',
  instagram: '@khishgee.salon',
};

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

// ---------------------------------------------------------------------------
// Тогтмол санамсаргүй тоо (демо өгөгдөл давтагдах боломжтой байх)
// ---------------------------------------------------------------------------
function makeRng(seedNum) {
  let s = seedNum >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const isoDaysAgo = (days, hour = 12) => {
  const d = new Date(Date.now() - days * 86400000);
  d.setHours(hour, (days * 7) % 60, 0, 0);
  return d.toISOString();
};

// ---------------------------------------------------------------------------
// Эх өгөгдөл
// ---------------------------------------------------------------------------
function seedDatabase() {
  const already = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (already > 0) return false;

  const now = new Date().toISOString();
  const insCat = db.prepare(
    'INSERT INTO categories(slug, name, kind, icon, sort) VALUES(?, ?, ?, ?, ?)'
  );
  for (const c of seed.categories) insCat.run(c.slug, c.name, c.kind, c.icon, c.sort);

  const catId = {};
  for (const c of db.prepare('SELECT id, slug FROM categories').all()) catId[c.slug] = c.id;

  const insProd = db.prepare(`
    INSERT INTO products(sku, name, brand, category_id, price, compare_price, stock, hue, shape,
                         badge, rating, sold, volume, short, description, howto, ingredients,
                         active, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);

  seed.products.forEach((p, i) => {
    insProd.run(p.sku, p.name, p.brand, catId[p.category], p.price, p.compare_price ?? null,
      p.stock, p.hue, p.shape, p.badge || '', p.rating, p.sold, p.volume || '',
      p.short || '', p.description || '', p.howto || '', p.ingredients || '',
      isoDaysAgo(120 - i * 2));
  });

  const insPromo = db.prepare(
    'INSERT INTO promos(code, type, value, min_total, active, note) VALUES(?, ?, ?, ?, ?, ?)'
  );
  for (const p of seed.promos) insPromo.run(p.code, p.type, p.value, p.min_total, p.active, p.note);

  // -- Хэрэглэгчид ------------------------------------------------------------
  const insUser = db.prepare(
    'INSERT INTO users(name, phone, email, password_hash, role, address, district, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insUser.run('Админ', '99112233', 'admin@khishgee.mn', hashPassword('admin123'), 'admin', '', '', now);

  const demoCustomers = [
    ['Б. Сарантуяа', '88112244', 'saraa@example.mn', 'Баянзүрх дүүрэг'],
    ['Э. Номин', '99553311', 'nomin@example.mn', 'Хан-Уул дүүрэг'],
    ['Г. Хулан', '95441122', 'khulan@example.mn', 'Сүхбаатар дүүрэг'],
    ['Д. Мөнхзул', '85667788', 'zulaa@example.mn', 'Баянгол дүүрэг'],
    ['Ц. Ариунаа', '94223311', 'ariun@example.mn', 'Чингэлтэй дүүрэг'],
    ['Н. Оюунчимэг', '80559911', 'oyuka@example.mn', 'Сонгинохайрхан дүүрэг'],
    ['Т. Энхжаргал', '99887744', 'enkhee@example.mn', 'Баянзүрх дүүрэг'],
  ];
  demoCustomers.forEach(([name, phone, email, district], i) => {
    insUser.run(name, phone, email, hashPassword('demo1234'), 'customer',
      `${8 + i}-р хороо, ${20 + i * 3}-р байр, ${i + 4} тоот`, district, isoDaysAgo(200 - i * 12));
  });
  // Жишээ худалдан авагч — нэвтрэх мэдээлэл README дотор
  insUser.run('Хэрэглэгч', '99001122', 'test@example.mn', hashPassword('test1234'), 'customer',
    '5-р хороо, 32-р байр, 14 тоот', 'Сүхбаатар дүүрэг', isoDaysAgo(60));

  // -- Сэтгэгдэл --------------------------------------------------------------
  const prods = db.prepare('SELECT id FROM products').all();
  const insRev = db.prepare(
    'INSERT INTO reviews(product_id, user_id, name, rating, comment, created_at) VALUES(?, NULL, ?, ?, ?, ?)'
  );
  const rng = makeRng(20260818);
  prods.forEach((p, i) => {
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const [text, rating, name] = seed.reviewTexts[(i + k * 2) % seed.reviewTexts.length];
      insRev.run(p.id, name, rating, text, isoDaysAgo(3 + ((i * 5 + k * 11) % 80)));
    }
  });

  // -- Демо захиалгууд --------------------------------------------------------
  const allProducts = db.prepare('SELECT * FROM products').all();
  const customers = db.prepare("SELECT * FROM users WHERE role='customer'").all();
  const districts = ['Баянзүрх дүүрэг', 'Хан-Уул дүүрэг', 'Сүхбаатар дүүрэг', 'Баянгол дүүрэг',
    'Чингэлтэй дүүрэг', 'Сонгинохайрхан дүүрэг'];
  const statuses = ['delivered', 'delivered', 'delivered', 'shipping', 'packed', 'confirmed', 'new', 'cancelled'];
  const payments = ['cash', 'transfer', 'qpay'];

  const insOrder = db.prepare(`
    INSERT INTO orders(code, user_id, customer_name, phone, district, address, note,
                       delivery_method, payment_method, subtotal, delivery_fee, discount,
                       promo_code, total, status, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, '', 'ub', ?, ?, ?, ?, '', ?, ?, ?, ?)`);
  const insItem = db.prepare(
    'INSERT INTO order_items(order_id, product_id, name, sku, hue, shape, price, qty) VALUES(?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const settings = getSettings();
  const fee = Number(settings.delivery_fee);
  const freeFrom = Number(settings.free_delivery_from);

  for (let i = 0; i < 64; i++) {
    const daysAgo = Math.floor(rng() * 45);
    const cust = customers[Math.floor(rng() * customers.length)];
    const itemCount = 1 + Math.floor(rng() * 3);
    const picks = [];
    for (let k = 0; k < itemCount; k++) {
      const p = allProducts[Math.floor(rng() * allProducts.length)];
      if (!picks.find((x) => x.id === p.id)) picks.push(p);
    }
    let subtotal = 0;
    const lines = picks.map((p) => {
      const qty = 1 + Math.floor(rng() * 2);
      subtotal += p.price * qty;
      return { p, qty };
    });
    const deliveryFee = subtotal >= freeFrom ? 0 : fee;
    const status = statuses[Math.floor(rng() * statuses.length)];
    const created = isoDaysAgo(daysAgo, 9 + Math.floor(rng() * 10));
    const code = 'KS' + String(100000 + i * 137 + Math.floor(rng() * 90));
    const res = insOrder.run(code, cust.id, cust.name, cust.phone,
      districts[Math.floor(rng() * districts.length)],
      cust.address, payments[Math.floor(rng() * payments.length)],
      subtotal, deliveryFee, 0, subtotal + deliveryFee, status, created, created);
    for (const { p, qty } of lines) {
      insItem.run(res.lastInsertRowid, p.id, p.name, p.sku, p.hue, p.shape, p.price, qty);
    }
  }

  return true;
}

module.exports = { db, seedDatabase, getSettings, setSetting, DEFAULT_SETTINGS };
