/* =========================================================================
   Khishgee's Salon — админ самбар
   ========================================================================= */
'use strict';

// ---------------------------------------------------------------------------
// Төрлүүд (зөвхөн compile-time — үүсэх JS-д ямар ч нөлөөгүй)
// ---------------------------------------------------------------------------
type OrderStatus = 'new' | 'confirmed' | 'packed' | 'shipping' | 'delivered' | 'cancelled';

interface AdminUser { name: string; phone: string; role: string; }

interface Category { id: number; name: string; slug: string; kind: string; count: number; }

interface ProductImage { id: number; url: string; }

interface Product {
  id: number; name: string; sku: string; brand: string;
  category_id: number; category_name: string;
  price: number; compare_price: number | null;
  stock: number; sold: number; active: number;
  image: string; hue: number; shape: string;
  badge?: string; volume?: string; short?: string;
  description?: string; howto?: string; ingredients?: string;
  rating?: number; images?: ProductImage[];
}

interface OrderItem { product_id: number; name: string; sku: string; price: number; qty: number; }

interface Order {
  id: number; code: string; status: OrderStatus;
  customer_name: string; phone: string; created_at: string;
  subtotal: number; delivery_fee: number; discount: number; total: number;
  promo_code: string; note: string; district: string; address: string;
  payment_method: string; payment_status: string; delivery_method: string;
  items: OrderItem[];
}

interface Promo { code: string; type: string; value: number; min_total: number; note: string; active: number; }

interface Customer {
  name: string; phone: string; email: string; district: string;
  orders: number; spent: number; created_at: string;
}

interface Payment {
  created_at: string; order_id: number; order_code: string;
  customer_name: string; phone: string; invoice_id: string;
  amount: number; paid_amount: number; status: string; mode: string;
}

interface SmsMessage { created_at: string; phone: string; kind: string; body: string; status: string; error?: string; }

interface SeriesPoint { label: string; revenue: number; orders: number; }

interface Stats {
  byStatus: Record<OrderStatus, number>;
  totals: { revenue: number; orders: number; customers: number; products: number };
  month: { revenue: number };
  today: { orders: number };
  series: SeriesPoint[];
  topProducts: { id: number; name: string; qty: number; revenue: number }[];
  lowStock: { id: number; name: string; sku: string; category_name: string; stock: number }[];
  recent: Pick<Order, 'code' | 'status' | 'customer_name' | 'created_at' | 'total'>[];
  byCategory: { name: string; revenue: number }[];
}

interface ListResp<T> { items: T[]; }
interface OrdersResp extends ListResp<Order> { total: number; page: number; pages: number; }
interface PaymentsResp extends ListResp<Payment> { live: boolean; }
interface SmsResp extends ListResp<SmsMessage> {
  stats: { sent?: number; failed?: number };
  live: boolean; provider: string;
}

interface IntegrationsInfo {
  qpay: { live: boolean; base_url?: string; callback_base?: string; missing: string[] };
  sms: { live: boolean; notify_on_order: boolean; notify_on_status: boolean; provider?: string };
  uploads: { max_bytes: number };
}

interface ApiOptions extends Omit<RequestInit, 'body'> { body?: unknown; }

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document): T => r.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document): T[] => [...r.querySelectorAll(s)] as T[];

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

const mnt = (n: number) => Number(n || 0).toLocaleString('mn-MN') + '₮';
const kmnt = (n: number) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'сая₮'
  : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + 'мянга' : n + '₮');

const dateMn = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
const timeMn = (iso: string) => {
  const d = new Date(iso);
  return `${dateMn(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const icon = (n: string, s = 20) => `<svg width="${s}" height="${s}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

async function api<T = { ok?: boolean }>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await fetch(path, {
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: { ok?: boolean; error?: string } = {};
  try { data = await res.json(); } catch { /* хоосон */ }
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Алдаа гарлаа');
  return data as T;
}

function toast(msg: string, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'ok' ? icon('check', 18) : type === 'err' ? icon('x', 18) : icon('spark', 18)}<span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

const STATUS: Record<OrderStatus, { label: string; chip: string }> = {
  new:       { label: 'Шинэ',          chip: 'chip-info' },
  confirmed: { label: 'Баталгаажсан',  chip: 'chip-plum' },
  packed:    { label: 'Савлагдсан',    chip: 'chip-gold' },
  shipping:  { label: 'Хүргэлтэд',     chip: 'chip-warn' },
  delivered: { label: 'Хүргэгдсэн',    chip: 'chip-ok' },
  cancelled: { label: 'Цуцлагдсан',    chip: 'chip-danger' },
};
const DELIVERY: Record<string, string> = { ub: 'Хотын хүргэлт', pickup: 'Өөрөө авах', country: 'Орон нутаг' };
const PAYMENT: Record<string, string> = { cash: 'Бэлнээр', transfer: 'Дансаар', qpay: 'QPay/карт' };
const SHAPES = [['bottle', 'Лонх'], ['jar', 'Сав (маск)'], ['tube', 'Тюбик'], ['spray', 'Шүршигч'],
  ['drop', 'Дуслуур'], ['polish', 'Лакны сав'], ['tool', 'Багаж'], ['set', 'Багц']];

const state: {
  user: AdminUser | null;
  cats: Category[];
  page: string;
  cache: { orders?: Order[]; products?: Product[] };
  sep?: boolean;
} = { user: null, cats: [], page: 'dash', cache: {} };

const isMobile = () => window.matchMedia('(max-width: 820px)').matches;

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------
function openSheet(title: string, body: string, foot = '') {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = body;
  $('#sheetFoot').innerHTML = foot;
  $('#sheet').classList.add('on');
  $('#overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheet').classList.remove('on');
  $('#overlay').classList.remove('on');
  document.body.style.overflow = '';
}

// ---------------------------------------------------------------------------
// Нэвтрэх дэлгэц
// ---------------------------------------------------------------------------
function loginView() {
  $('#root').innerHTML = `
  <div class="login-wrap">
    <div class="login-card">
      <div class="center" style="margin-bottom:24px">
        <span class="logo-mark" style="margin:0 auto 14px;width:52px;height:52px;font-size:1.5rem">K</span>
        <h2 style="font-size:1.5rem">Админ самбар</h2>
        <p class="muted" style="margin:4px 0 0;font-size:.9rem">Khishgee's Salon удирдлагын систем</p>
      </div>
      <form id="loginForm">
        <div class="field"><label>Утасны дугаар</label>
          <input name="phone" inputmode="numeric" maxlength="8" placeholder="99112233" required autofocus></div>
        <div class="field"><label>Нууц үг</label>
          <input name="password" type="password" placeholder="••••••••" required></div>
        <button class="btn btn-lg btn-block" type="submit" id="loginBtn">Нэвтрэх</button>
      </form>
      <div class="panel" style="background:var(--bg-2);border:none;margin-top:20px;padding:14px 16px;font-size:.84rem">
        <b>Туршилтын эрх</b><br><span class="muted">Утас: 99112233 · Нууц үг: admin123</span>
      </div>
      <p style="text-align:center;margin:16px 0 0"><a href="/" style="color:var(--plum);font-size:.88rem">← Дэлгүүр рүү буцах</a></p>
    </div>
  </div>`;

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target as HTMLFormElement));
    const btn = $<HTMLButtonElement>('#loginBtn');
    btn.disabled = true; btn.textContent = 'Шалгаж байна…';
    try {
      const r = await api<{ user: AdminUser }>('/api/auth/login', { method: 'POST', body: f });
      if (r.user.role !== 'admin') throw new Error('Танд админ эрх байхгүй байна');
      state.user = r.user;
      await boot();
    } catch (err: any) {
      toast(err.message, 'err');
      btn.disabled = false; btn.textContent = 'Нэвтрэх';
    }
  });
}

// ---------------------------------------------------------------------------
// Бүрхүүл
// ---------------------------------------------------------------------------
const NAV = [
  { key: 'dash', label: 'Хяналтын самбар', icon: 'dash', group: 'Ерөнхий' },
  { key: 'orders', label: 'Захиалга', icon: 'cart', group: 'Ерөнхий' },
  { key: 'products', label: 'Бараа', icon: 'box', group: 'Каталог' },
  { key: 'categories', label: 'Ангилал', icon: 'grid', group: 'Каталог' },
  { key: 'promos', label: 'Урамшуулал', icon: 'tag', group: 'Каталог' },
  { key: 'customers', label: 'Хэрэглэгч', icon: 'users', group: 'Бусад' },
  { key: 'payments', label: 'Төлбөр', icon: 'coin', group: 'Бусад' },
  { key: 'sms', label: 'Мессеж', icon: 'spark', group: 'Бусад' },
  { key: 'reports', label: 'Тайлан', icon: 'out', group: 'Бусад' },
  { key: 'integrations', label: 'Холболт', icon: 'warn', group: 'Систем' },
  { key: 'settings', label: 'Тохиргоо', icon: 'cog', group: 'Систем' },
];

function shell() {
  let lastGroup = '';
  const nav = NAV.map((n) => {
    const head = n.group !== lastGroup ? `<div class="side-label">${n.group}</div>` : '';
    lastGroup = n.group;
    return head + `<button class="side-link" data-nav="${n.key}">${icon(n.icon, 19)}<span>${n.label}</span>
      <span class="pill" data-pill="${n.key}" hidden></span></button>`;
  }).join('');

  $('#root').innerHTML = `
  <div class="layout">
    <aside class="side" id="side">
      <div class="side-head">
        <div class="logo">
          <span class="logo-mark">K</span>
          <span class="logo-text"><span class="logo-name">Khishgee's</span><br><span class="logo-sub">Admin panel</span></span>
        </div>
      </div>
      <nav class="side-nav">${nav}</nav>
      <div class="side-foot">
        <div class="row" style="gap:10px;margin-bottom:10px">
          <span class="avatar" style="width:34px;height:34px;font-size:.9rem">${esc(state.user!.name.trim()[0] || 'A')}</span>
          <div style="line-height:1.25;min-width:0">
            <b style="color:#fff;font-size:.86rem">${esc(state.user!.name)}</b><br>
            <span style="color:#9d8c93;font-size:.76rem">${esc(state.user!.phone)}</span>
          </div>
        </div>
        <div class="row" style="gap:6px">
          <a class="btn btn-ghost btn-sm" href="/" style="color:#cbbac3;flex:1">${icon('home', 15)} Дэлгүүр</a>
          <button class="btn btn-ghost btn-sm" id="logoutBtn" style="color:#cbbac3">${icon('out', 15)} Гарах</button>
        </div>
      </div>
    </aside>

    <div class="admin-main">
      <header class="admin-top">
        <button class="iconbtn burger" id="burger" aria-label="Цэс">${icon('menu', 22)}</button>
        <div style="flex:1;min-width:0">
          <h1 id="pageTitle">—</h1>
          <div class="sub" id="pageSub"></div>
        </div>
        <div id="pageActions" class="row" style="gap:8px"></div>
      </header>
      <div class="admin-body" id="content"></div>
    </div>
  </div>`;

  $$('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    location.hash = b.dataset.nav!;
    $('#side').classList.remove('on');
    $('#overlay').classList.remove('on');
  }));

  $('#burger').addEventListener('click', () => {
    $('#side').classList.toggle('on');
    $('#overlay').classList.toggle('on');
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    $('#adminNav').hidden = true;
    loginView();
  });

  // --- Утасны доод навигац ---
  $('#adminNav').hidden = false;
  $$('[data-anav]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.anav === '__menu') {
      $('#side').classList.toggle('on');
      $('#overlay').classList.toggle('on');
      return;
    }
    location.hash = b.dataset.anav!;
  }));
}

function setHead(title: string, sub = '', actions = '') {
  $('#pageTitle').textContent = title;
  $('#pageSub').textContent = sub;
  $('#pageActions').innerHTML = actions;
  $$('[data-nav]').forEach((b) => b.classList.toggle('on', b.dataset.nav === state.page));
  $$('[data-anav]').forEach((b) => b.classList.toggle('on', b.dataset.anav === state.page));
}

// ---------------------------------------------------------------------------
// График
// ---------------------------------------------------------------------------
function barChart(series: SeriesPoint[], key: 'revenue' | 'orders' = 'revenue') {
  // Утсанд viewBox-ыг нарийсгаж, бичиг жижгэрч уншигдахгүй болохоос сэргийлнэ
  const compact = isMobile();
  const W = compact ? 360 : 720;
  const H = compact ? 210 : 230;
  const padL = compact ? 42 : 52, padB = 24, padT = 12, padR = 8;
  const max = Math.max(1, ...series.map((s) => s[key]));
  const cw = (W - padL - padR) / series.length;
  const bw = Math.min(34, cw * 0.6);

  const ticks = (compact ? [0, .5, 1] : [0, .25, .5, .75, 1]).map((t) => {
    const v = max * t;
    const y = padT + (H - padT - padB) * (1 - t);
    return `<line class="grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>
            <text class="axis" x="${padL - 8}" y="${y + 4}" text-anchor="end">${kmnt(Math.round(v))}</text>`;
  }).join('');

  const bars = series.map((s, i) => {
    const h = Math.max(2, (H - padT - padB) * (s[key] / max));
    const x = padL + cw * i + (cw - bw) / 2;
    const y = H - padB - h;
    return `<rect class="bar" x="${x}" y="${y}" width="${bw}" height="${h}" rx="5">
        <title>${s.label}: ${mnt(s.revenue)} · ${s.orders} захиалга</title></rect>
      <text class="axis" x="${x + bw / 2}" y="${H - padB + 15}" text-anchor="middle">${s.label}</text>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Сүүлийн 14 хоногийн борлуулалт">
    <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9506e"/><stop offset="1" stop-color="#7b2e52"/>
    </linearGradient></defs>
    ${ticks}${bars}
  </svg>`;
}

function hbars(rows: { label: string; value: number; display: string }[]) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => `
    <div class="hbar-row">
      <span>${esc(r.label)}</span><b>${esc(r.display)}</b>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(r.value / max * 100).toFixed(1)}%"></div></div>
    </div>`).join('');
}

// ---------------------------------------------------------------------------
// Хуудас: Хяналтын самбар
// ---------------------------------------------------------------------------
async function pageDash() {
  setHead('Хяналтын самбар', 'Дэлгүүрийн өнөөдрийн байдал');
  $('#content').innerHTML = `<div class="sk" style="height:420px"></div>`;

  const s = await api<Stats>('/api/admin/stats');
  const pendingCount = s.byStatus.new + s.byStatus.confirmed + s.byStatus.packed + s.byStatus.shipping;
  for (const sel of ['[data-pill="orders"]', '#navNew']) {
    const el = $(sel);
    if (!el) continue;
    el.hidden = !s.byStatus.new;
    el.textContent = s.byStatus.new as unknown as string;
  }

  const avg = s.totals.orders ? Math.round(s.totals.revenue / s.totals.orders) : 0;
  // Нарийн дэлгэцэд 14 багана бөөгнөрдөг тул 7 хоногоор харуулна
  const series = isMobile() ? s.series.slice(-7) : s.series;

  $('#content').innerHTML = `
  <div class="stat-grid">
    <div class="stat gold">
      <div class="stat-ico">${icon('coin', 21)}</div>
      <div class="stat-label">Нийт орлого</div>
      <div class="stat-value">${mnt(s.totals.revenue)}</div>
      <div class="stat-delta up">Сүүлийн 30 хоногт ${mnt(s.month.revenue)}</div>
    </div>
    <div class="stat">
      <div class="stat-ico">${icon('cart', 21)}</div>
      <div class="stat-label">Нийт захиалга</div>
      <div class="stat-value">${s.totals.orders}</div>
      <div class="stat-delta up">Өнөөдөр ${s.today.orders} захиалга</div>
    </div>
    <div class="stat ok">
      <div class="stat-ico">${icon('users', 21)}</div>
      <div class="stat-label">Бүртгэлтэй хэрэглэгч</div>
      <div class="stat-value">${s.totals.customers}</div>
      <div class="stat-delta">Дундаж захиалга ${mnt(avg)}</div>
    </div>
    <div class="stat info">
      <div class="stat-ico">${icon('box', 21)}</div>
      <div class="stat-label">Идэвхтэй бараа</div>
      <div class="stat-value">${s.totals.products}</div>
      <div class="stat-delta ${pendingCount ? 'down' : ''}">${pendingCount} захиалга хүлээгдэж байна</div>
    </div>
  </div>

  <div class="cols cols-2" style="margin-bottom:16px">
    <div class="box">
      <div class="box-head">
        <div><h3>Борлуулалтын явц</h3><span class="muted" style="font-size:.83rem">Сүүлийн ${series.length} хоног</span></div>
        <span class="chip chip-plum">Нийт ${mnt(series.reduce((a, x) => a + x.revenue, 0))}</span>
      </div>
      <div class="box-body">${barChart(series)}</div>
    </div>

    <div class="box">
      <div class="box-head"><h3>Захиалгын төлөв</h3></div>
      <div class="box-body">
        ${hbars(Object.entries(s.byStatus).map(([k, v]) => ({
          label: STATUS[k as OrderStatus].label, value: v, display: v + ' ш',
        })))}
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn btn-outline btn-sm" data-goto="orders">Захиалга удирдах</button>
        </div>
      </div>
    </div>
  </div>

  <div class="cols cols-2b" style="margin-bottom:16px">
    <div class="box">
      <div class="box-head"><h3>Хамгийн их зарагдсан</h3><span class="muted" style="font-size:.82rem">Тоо ширхгээр</span></div>
      <div class="scroll-x"><table class="dtable">
        <thead><tr><th>Бараа</th><th class="num">Ширхэг</th><th class="num">Орлого</th></tr></thead>
        <tbody>${s.topProducts.map((p) => `
          <tr>
            <td class="primary"><div class="cell-prod">
              <img class="thumb" src="/img/p/${p.id}.svg" alt="">
              <b>${esc(p.name)}</b></div></td>
            <td class="num" data-label="Ширхэг"><b>${p.qty}</b></td>
            <td class="num" data-label="Орлого">${mnt(p.revenue)}</td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="box">
      <div class="box-head">
        <h3>Үлдэгдэл багатай</h3>
        <button class="btn btn-outline btn-sm" data-goto="products">Бүгдийг харах</button>
      </div>
      <div class="scroll-x"><table class="dtable">
        <thead><tr><th>Бараа</th><th>Ангилал</th><th class="num">Үлдэгдэл</th></tr></thead>
        <tbody>${s.lowStock.map((p) => `
          <tr>
            <td class="primary"><div class="cell-prod">
              <img class="thumb" src="/img/p/${p.id}.svg" alt="">
              <div><b>${esc(p.name)}</b><span>${esc(p.sku)}</span></div></div></td>
            <td class="muted" data-label="Ангилал">${esc(p.category_name)}</td>
            <td class="num" data-label="Үлдэгдэл"><span class="chip ${p.stock === 0 ? 'chip-danger' : p.stock <= 20 ? 'chip-warn' : 'chip-ok'}">${p.stock} ш</span></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  </div>

  <div class="cols cols-2">
    <div class="box">
      <div class="box-head"><h3>Сүүлийн захиалгууд</h3>
        <button class="btn btn-outline btn-sm" data-goto="orders">Бүгд</button></div>
      <div class="scroll-x"><table class="dtable">
        <thead><tr><th>Дугаар</th><th>Үйлчлүүлэгч</th><th>Огноо</th><th class="num">Дүн</th><th>Төлөв</th></tr></thead>
        <tbody>${s.recent.map((o) => `
          <tr>
            <td class="primary"><div class="row-between">
              <b>${esc(o.code)}</b>
              <span class="chip ${STATUS[o.status].chip}">${STATUS[o.status].label}</span></div></td>
            <td data-label="Үйлчлүүлэгч">${esc(o.customer_name)}</td>
            <td class="muted" data-label="Огноо">${timeMn(o.created_at)}</td>
            <td class="num" data-label="Дүн"><b>${mnt(o.total)}</b></td>
            <td class="d-only" data-label="Төлөв"><span class="chip ${STATUS[o.status].chip}">${STATUS[o.status].label}</span></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="box">
      <div class="box-head"><h3>Ангиллын орлого</h3></div>
      <div class="box-body">
        ${hbars(s.byCategory.filter((c) => c.revenue > 0).map((c) => ({
          label: c.name, value: c.revenue, display: mnt(c.revenue),
        })))}
      </div>
    </div>
  </div>`;

  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.goto!; }));
}

// ---------------------------------------------------------------------------
// Хуудас: Захиалга
// ---------------------------------------------------------------------------
let ordersFilter = { status: '', q: '', page: 1 };

async function pageOrders() {
  setHead('Захиалга', 'Захиалгын төлөв удирдах');
  $('#content').innerHTML = `
    <div class="toolbar-admin">
      <div class="seg" id="statusSeg">
        <button data-st="" class="${!ordersFilter.status ? 'on' : ''}">Бүгд</button>
        ${Object.entries(STATUS).map(([k, v]) =>
          `<button data-st="${k}" class="${ordersFilter.status === k ? 'on' : ''}">${v.label}</button>`).join('')}
      </div>
      <div class="search-admin">
        ${icon('search', 17)}
        <input id="oSearch" placeholder="Дугаар, нэр, утсаар хайх…" value="${esc(ordersFilter.q)}">
      </div>
    </div>
    <div class="box" id="ordersBox"><div class="box-body"><div class="sk" style="height:300px"></div></div></div>`;

  $$('#statusSeg button').forEach((b) => b.addEventListener('click', () => {
    ordersFilter.status = b.dataset.st!; ordersFilter.page = 1; pageOrders();
  }));
  let t: number | undefined;
  $('#oSearch').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { ordersFilter.q = (e.target as HTMLInputElement).value.trim(); ordersFilter.page = 1; loadOrders(); }, 320);
  });

  loadOrders();
}

async function loadOrders() {
  const p = new URLSearchParams({ per: '20', page: ordersFilter.page } as unknown as Record<string, string>);
  if (ordersFilter.status) p.set('status', ordersFilter.status);
  if (ordersFilter.q) p.set('q', ordersFilter.q);

  const d = await api<OrdersResp>('/api/admin/orders?' + p);
  state.cache.orders = d.items;

  $('#ordersBox').innerHTML = `
    <div class="box-head">
      <h3>${d.total} захиалга</h3>
      <span class="muted" style="font-size:.83rem">Хуудас ${d.page}/${d.pages}</span>
    </div>
    ${d.items.length ? `
    <div class="scroll-x"><table class="dtable">
      <thead><tr>
        <th>Дугаар</th><th>Үйлчлүүлэгч</th><th>Бараа</th><th>Хүргэлт</th>
        <th>Огноо</th><th class="num">Дүн</th><th>Төлөв</th><th></th>
      </tr></thead>
      <tbody>${d.items.map((o) => `
        <tr>
          <td class="primary">
            <div class="row-between">
              <span><b>${esc(o.code)}</b>
                <span class="muted" style="font-size:.76rem"> · ${PAYMENT[o.payment_method] || ''}</span>${o.payment_status === 'paid' ? ' <span class="chip chip-ok" style="padding:1px 7px;font-size:.7rem;margin:0">Төлсөн</span>' : ''}</span>
              <span class="chip ${STATUS[o.status].chip} m-only" style="margin:0">${STATUS[o.status].label}</span>
            </div>
          </td>
          <td data-label="Хэрэглэгч">
            <span style="text-align:right">${esc(o.customer_name)}<br>
              <a href="tel:${esc(o.phone)}" class="muted" style="font-size:.8rem">${esc(o.phone)}</a></span>
          </td>
          <td data-label="Бараа">
            <div class="row" style="gap:3px">
              ${o.items.slice(0, 3).map((i) => `<img class="thumb" style="width:32px;height:32px" src="/img/p/${i.product_id}.svg" alt="" title="${esc(i.name)}">`).join('')}
              ${o.items.length > 3 ? `<span class="muted" style="font-size:.78rem">+${o.items.length - 3}</span>` : ''}
            </div>
          </td>
          <td class="muted" style="font-size:.82rem" data-label="Хүргэлт">
            <span style="text-align:right">${DELIVERY[o.delivery_method] || ''}<br>${esc(o.district)}</span></td>
          <td class="muted" style="font-size:.82rem" data-label="Огноо">${timeMn(o.created_at)}</td>
          <td class="num" data-label="Дүн"><b>${mnt(o.total)}</b></td>
          <td data-label="Төлөв">
            <select class="status-sel" data-status="${o.id}">
              ${Object.entries(STATUS).map(([k, v]) =>
                `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </td>
          <td class="actions"><div class="row">
            <button class="btn btn-ghost btn-sm" data-view="${o.id}">${icon('eye', 16)}<span class="m-only">Дэлгэрэнгүй</span></button>
          </div></td>
        </tr>`).join('')}</tbody>
    </table></div>
    ${d.pages > 1 ? `<div class="box-body"><div class="pager" id="oPager">
      ${Array.from({ length: d.pages }, (_, i) => i + 1)
        .map((n) => {
          if (n === 1 || n === d.pages || Math.abs(n - d.page) <= 1) {
            return `<button data-p="${n}" class="${n === d.page ? 'on' : ''}">${n}</button>`;
          }
          return Math.abs(n - d.page) === 2 ? '<button disabled>…</button>' : '';
        }).join('')}
    </div></div>` : ''}`
    : `<div class="box-body"><div class="empty"><div class="empty-ico">${icon('cart', 28)}</div>
        <h3>Захиалга олдсонгүй</h3><p>Шүүлтүүрээ өөрчилж үзнэ үү.</p></div></div>`}`;

  $$<HTMLSelectElement>('[data-status]').forEach((sel) => sel.addEventListener('change', async () => {
    const id = sel.dataset.status!;
    const prev = state.cache.orders!.find((o) => o.id === +id)?.status;
    try {
      await api('/api/admin/orders/' + id, { method: 'PATCH', body: { status: sel.value } });
      toast(`${STATUS[sel.value as OrderStatus].label} болголоо`, 'ok');
      loadOrders();
    } catch (err: any) { toast(err.message, 'err'); sel.value = prev!; }
  }));

  $$('[data-view]').forEach((b) => b.addEventListener('click', () => {
    const o = state.cache.orders!.find((x) => x.id === +b.dataset.view!)!;
    showOrder(o);
  }));

  $$('#oPager button').forEach((b) => b.addEventListener('click', () => {
    ordersFilter.page = +b.dataset.p!; loadOrders();
  }));
}

function showOrder(o: Order) {
  openSheet(`Захиалга ${o.code}`, `
    <div class="row-between" style="margin-bottom:18px">
      <span class="chip ${STATUS[o.status].chip}" style="padding:8px 16px">${STATUS[o.status].label}</span>
      <span class="muted" style="font-size:.85rem">${timeMn(o.created_at)}</span>
    </div>

    <div class="box" style="margin-bottom:14px">
      <div class="box-head"><h3>Үйлчлүүлэгч</h3></div>
      <div class="box-body">
        <div class="spec" style="margin:0">
          <div><dt>Нэр</dt><dd style="margin:0"><b>${esc(o.customer_name)}</b></dd></div>
          <div><dt>Утас</dt><dd style="margin:0"><a href="tel:${esc(o.phone)}" style="color:var(--plum)">${esc(o.phone)}</a></dd></div>
          <div><dt>Хүргэлт</dt><dd style="margin:0">${DELIVERY[o.delivery_method]}</dd></div>
          <div><dt>Хаяг</dt><dd style="margin:0">${esc(o.district)} ${esc(o.address)}</dd></div>
          <div><dt>Төлбөр</dt><dd style="margin:0">${PAYMENT[o.payment_method]}${o.payment_status === 'paid' ? ' <span class="chip chip-ok" style="margin:0">Төлөгдсөн</span>' : o.payment_method === 'qpay' ? ' <span class="chip chip-gold" style="margin:0">Төлөөгүй</span>' : ''}</dd></div>
          ${o.note ? `<div><dt>Тайлбар</dt><dd style="margin:0">${esc(o.note)}</dd></div>` : ''}
        </div>
      </div>
    </div>

    <div class="box">
      <div class="box-head"><h3>Бараа (${o.items.length})</h3></div>
      <div class="scroll-x"><table class="dtable">
        <thead><tr><th>Бараа</th><th class="num">Үнэ</th><th class="num">Тоо</th><th class="num">Дүн</th></tr></thead>
        <tbody>${o.items.map((i) => `
          <tr>
            <td class="primary"><div class="cell-prod"><img class="thumb" src="/img/p/${i.product_id}.svg" alt="">
              <div><b>${esc(i.name)}</b><span>${esc(i.sku)}</span></div></div></td>
            <td class="num" data-label="Нэгж үнэ">${mnt(i.price)}</td>
            <td class="num" data-label="Тоо">${i.qty}</td>
            <td class="num" data-label="Дүн"><b>${mnt(i.price * i.qty)}</b></td>
          </tr>`).join('')}</tbody>
      </table></div>
      <div class="box-body">
        <div class="sum-row"><span>Барааны дүн</span><b>${mnt(o.subtotal)}</b></div>
        <div class="sum-row"><span>Хүргэлт</span><b>${o.delivery_fee ? mnt(o.delivery_fee) : 'Үнэгүй'}</b></div>
        ${o.discount ? `<div class="sum-row" style="color:var(--ok)"><span>Хөнгөлөлт ${esc(o.promo_code)}</span><b>−${mnt(o.discount)}</b></div>` : ''}
        <div class="sum-row total"><span>Нийт</span><span class="price">${mnt(o.total)}</span></div>
      </div>
    </div>`,
    `<div class="row" style="gap:8px;flex:1;flex-wrap:wrap">
      <select class="status-sel" id="sheetStatus" style="flex:1;min-width:150px">
        ${Object.entries(STATUS).map(([k, v]) =>
          `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select>
      <button class="btn" id="sheetSave">Төлөв хадгалах</button>
    </div>`);

  $('#sheetSave').addEventListener('click', async () => {
    try {
      await api('/api/admin/orders/' + o.id, { method: 'PATCH', body: { status: $<HTMLSelectElement>('#sheetStatus').value } });
      toast('Төлөв шинэчлэгдлээ', 'ok');
      closeSheet(); loadOrders();
    } catch (err: any) { toast(err.message, 'err'); }
  });
}

// ---------------------------------------------------------------------------
// Хуудас: Бараа
// ---------------------------------------------------------------------------
let prodFilter = { q: '', category: '', stock: '' };

async function pageProducts() {
  setHead('Бараа', 'Каталогийн бүтээгдэхүүн удирдах',
    `<button class="btn" id="newProd">${icon('plus', 17)} Шинэ бараа</button>`);

  $('#content').innerHTML = `
    <div class="toolbar-admin">
      <div class="search-admin">${icon('search', 17)}
        <input id="pSearch" placeholder="Нэр, SKU, брэндээр хайх…" value="${esc(prodFilter.q)}"></div>
      <select class="select" id="pCat">
        <option value="">Бүх ангилал</option>
        ${state.cats.map((c) => `<option value="${c.slug}" ${prodFilter.category === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
      <div class="seg">
        <button data-stk="" class="${!prodFilter.stock ? 'on' : ''}">Бүгд</button>
        <button data-stk="low" class="${prodFilter.stock === 'low' ? 'on' : ''}">Үлдэгдэл багатай</button>
      </div>
    </div>
    <div class="box" id="prodBox"><div class="box-body"><div class="sk" style="height:340px"></div></div></div>`;

  $('#newProd').addEventListener('click', () => productForm(null));
  let t: number | undefined;
  $('#pSearch').addEventListener('input', (e) => {
    clearTimeout(t); t = setTimeout(() => { prodFilter.q = (e.target as HTMLInputElement).value.trim(); loadProducts(); }, 300);
  });
  $('#pCat').addEventListener('change', (e) => { prodFilter.category = (e.target as HTMLSelectElement).value; loadProducts(); });
  $$('[data-stk]').forEach((b) => b.addEventListener('click', () => { prodFilter.stock = b.dataset.stk!; pageProducts(); }));

  loadProducts();
}

async function loadProducts() {
  const p = new URLSearchParams();
  if (prodFilter.q) p.set('q', prodFilter.q);
  if (prodFilter.category) p.set('category', prodFilter.category);
  if (prodFilter.stock) p.set('stock', prodFilter.stock);

  const d = await api<ListResp<Product>>('/api/admin/products?' + p);
  state.cache.products = d.items;

  $('#prodBox').innerHTML = `
    <div class="box-head"><h3>${d.items.length} бараа</h3>
      <span class="muted" style="font-size:.83rem">Нийт үнэлгээ: ${mnt(d.items.reduce((a, x) => a + x.price * x.stock, 0))}</span></div>
    ${d.items.length ? `
    <div class="scroll-x"><table class="dtable">
      <thead><tr><th>Бараа</th><th>Ангилал</th><th class="num">Үнэ</th><th class="num">Үлдэгдэл</th>
        <th class="num">Зарагдсан</th><th>Төлөв</th><th></th></tr></thead>
      <tbody>${d.items.map((p) => `
        <tr>
          <td class="primary"><div class="cell-prod"><img class="thumb" src="${p.image}" alt="">
            <div><b>${esc(p.name)}</b><span>${esc(p.sku)} · ${esc(p.brand)}</span></div></div></td>
          <td class="muted" data-label="Ангилал">${esc(p.category_name)}</td>
          <td class="num" data-label="Үнэ"><b>${mnt(p.price)}</b>${p.compare_price ? `<br><span class="muted" style="font-size:.75rem;text-decoration:line-through">${mnt(p.compare_price)}</span>` : ''}</td>
          <td class="num" data-label="Үлдэгдэл">
            <input type="number" min="0" value="${p.stock}" data-stock="${p.id}" aria-label="Үлдэгдэл"
              style="width:74px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;text-align:right"></td>
          <td class="num muted" data-label="Зарагдсан">${p.sold}</td>
          <td data-label="Төлөв"><span class="chip ${p.active ? 'chip-ok' : ''}">${p.active ? 'Идэвхтэй' : 'Нуусан'}</span></td>
          <td class="actions">
            <div class="row" style="gap:4px">
              <button class="btn btn-ghost btn-sm" data-edit="${p.id}" title="Засах">${icon('edit', 16)}<span class="m-only">Засах</span></button>
              <button class="btn btn-ghost btn-sm" data-del="${p.id}" title="Устгах" style="color:var(--danger)">${icon('trash', 16)}<span class="m-only">Устгах</span></button>
            </div>
          </td>
        </tr>`).join('')}</tbody>
    </table></div>`
    : `<div class="box-body"><div class="empty"><h3>Бараа олдсонгүй</h3></div></div>`}`;

  $$<HTMLInputElement>('[data-stock]').forEach((inp) => inp.addEventListener('change', async () => {
    try {
      await api('/api/admin/products/' + inp.dataset.stock, { method: 'PATCH', body: { stock: +inp.value } });
      toast('Үлдэгдэл шинэчлэгдлээ', 'ok');
    } catch (err: any) { toast(err.message, 'err'); }
  }));

  $$('[data-edit]').forEach((b) => b.addEventListener('click', () =>
    productForm(state.cache.products!.find((x) => x.id === +b.dataset.edit!))));

  $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const p = state.cache.products!.find((x) => x.id === +b.dataset.del!)!;
    if (!confirm(`"${p.name}" барааг устгах уу?\n\nЗахиалгад орсон бол устгахын оронд нуугдана.`)) return;
    try {
      const r = await api<{ archived?: boolean }>('/api/admin/products/' + p.id, { method: 'DELETE' });
      toast(r.archived ? 'Бараа нуугдлаа (захиалгад ашиглагдсан)' : 'Бараа устлаа', 'ok');
      loadProducts();
    } catch (err: any) { toast(err.message, 'err'); }
  }));
}

function productForm(p?: Product | null) {
  const isNew = !p;
  const v: Partial<Product> = p || { hue: 320, shape: 'bottle', active: 1, price: 0, stock: 0, rating: 5 };

  openSheet(isNew ? 'Шинэ бараа нэмэх' : 'Бараа засах', `
    <form id="prodForm">
      <div class="row" style="gap:16px;align-items:flex-start;margin-bottom:18px">
        <img id="preview" class="thumb" style="width:104px;height:104px;border-radius:16px"
          src="/img/preview.svg?hue=${v.hue}&shape=${v.shape}&brand=${encodeURIComponent(v.brand || '')}" alt="">
        <div style="flex:1">
          <div class="field" style="margin-bottom:10px"><label>Зургийн өнгө (0–360)</label>
            <input type="range" id="hue" min="0" max="359" value="${v.hue}" style="padding:0"></div>
          <div class="field" style="margin-bottom:0"><label>Савны хэлбэр</label>
            <select name="shape" id="shape">
              ${SHAPES.map(([k, l]) => `<option value="${k}" ${v.shape === k ? 'selected' : ''}>${l}</option>`).join('')}
            </select></div>
        </div>
      </div>

      <div class="field"><label>Барааны нэр <span class="req">*</span></label>
        <input name="name" value="${esc(v.name || '')}" required placeholder="Ж: Кератин шампунь 500мл"></div>

      <div class="grid-2">
        <div class="field"><label>SKU</label>
          <input name="sku" value="${esc(v.sku || '')}" placeholder="Автоматаар үүснэ"></div>
        <div class="field"><label>Брэнд</label>
          <input name="brand" value="${esc(v.brand || '')}" placeholder="Ж: Lumière Pro"></div>
        <div class="field"><label>Ангилал <span class="req">*</span></label>
          <select name="category_id" required>
            ${state.cats.map((c) => `<option value="${c.id}" ${v.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Хэмжээ</label>
          <input name="volume" value="${esc(v.volume || '')}" placeholder="500 мл"></div>
        <div class="field"><label>Үнэ (₮) <span class="req">*</span></label>
          <input name="price" type="number" min="0" step="500" value="${v.price}" required></div>
        <div class="field"><label>Хуучин үнэ (₮)</label>
          <input name="compare_price" type="number" min="0" step="500" value="${v.compare_price || ''}" placeholder="хямдрал харуулах"></div>
        <div class="field"><label>Үлдэгдэл</label>
          <input name="stock" type="number" min="0" value="${v.stock}"></div>
        <div class="field"><label>Шошго</label>
          <select name="badge">
            ${['', 'Шинэ', 'Хямдрал', 'Эрэлттэй', 'Багц'].map((b) =>
              `<option value="${b}" ${(v.badge || '') === b ? 'selected' : ''}>${b || '— байхгүй —'}</option>`).join('')}
          </select></div>
      </div>

      <div class="field"><label>Богино тайлбар</label>
        <input name="short" value="${esc(v.short || '')}" placeholder="Картан дээр харагдах 1 өгүүлбэр"></div>
      <div class="field"><label>Дэлгэрэнгүй тайлбар</label>
        <textarea name="description" rows="4">${esc(v.description || '')}</textarea></div>
      <div class="field"><label>Хэрэглэх заавар</label>
        <textarea name="howto" rows="3">${esc(v.howto || '')}</textarea></div>
      <div class="field"><label>Найрлага</label>
        <textarea name="ingredients" rows="2">${esc(v.ingredients || '')}</textarea></div>

      <label class="opt-card ${v.active ? 'on' : ''}" id="activeCard">
        <input type="checkbox" name="active" ${v.active ? 'checked' : ''}>
        <span><b>Дэлгүүрт харуулах</b><span>Идэвхгүй бол каталогид харагдахгүй</span></span>
      </label>
    </form>

    ${isNew ? `<p class="muted" style="font-size:.84rem;margin-top:14px">${icon('spark', 14)} Барааг нэмсний дараа засах цонхноос жинхэнэ зураг оруулах боломжтой.</p>` : `
    <div class="photo-box" id="photoBox">
      <div class="row-between" style="margin-bottom:10px">
        <b>Жинхэнэ зураг</b>
        <span class="muted" style="font-size:.8rem">JPG · PNG · WebP · GIF, 5MB хүртэл</span>
      </div>
      <p class="muted" style="font-size:.82rem;margin:0 0 10px">Эхний зураг нь үндсэн зураг. Зураггүй бол өнгө/хэлбэрээс үүссэн SVG харагдана.</p>
      <div class="photo-grid" id="photoGrid"></div>
      <label class="photo-drop" id="photoDrop">
        <input type="file" id="photoInput" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden>
        ${icon('plus', 20)}<span>Зураг сонгох эсвэл энд чирж тавих</span>
      </label>
      <div id="photoStatus" class="muted" style="font-size:.8rem;margin-top:6px"></div>
    </div>`}`,
    `<button class="btn btn-outline" id="cancelBtn">Болих</button>
     <button class="btn" id="saveProd">${isNew ? 'Нэмэх' : 'Хадгалах'}</button>`);

  const preview = $<HTMLImageElement>('#preview');
  const updatePreview = () => {
    const brand = ($<HTMLFormElement>('#prodForm').elements as unknown as { brand: HTMLInputElement }).brand.value;
    preview.src = `/img/preview.svg?hue=${$<HTMLInputElement>('#hue').value}&shape=${$<HTMLSelectElement>('#shape').value}&brand=${encodeURIComponent(brand)}`;
  };
  $('#hue').addEventListener('input', updatePreview);
  $('#shape').addEventListener('change', updatePreview);
  ($<HTMLFormElement>('#prodForm').elements as unknown as { brand: HTMLInputElement }).brand.addEventListener('change', updatePreview);

  $('#activeCard').addEventListener('change', (e) =>
    (e.currentTarget as HTMLElement).classList.toggle('on', (e.target as HTMLInputElement).checked));

  $('#cancelBtn').addEventListener('click', closeSheet);

  if (!isNew) mountPhotoManager(v.id!, v.images || []);

  $('#saveProd').addEventListener('click', async () => {
    const form = $<HTMLFormElement>('#prodForm');
    if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const body = {
      ...f,
      hue: +$<HTMLInputElement>('#hue').value,
      shape: $<HTMLSelectElement>('#shape').value,
      price: +f.price,
      compare_price: f.compare_price ? +f.compare_price : null,
      stock: +f.stock,
      category_id: +f.category_id,
      active: !!f.active,
    };
    try {
      if (isNew) await api('/api/admin/products', { method: 'POST', body });
      else await api('/api/admin/products/' + v.id, { method: 'PATCH', body });
      toast(isNew ? 'Бараа нэмэгдлээ' : 'Хадгалагдлаа', 'ok');
      closeSheet();
      loadProducts();
    } catch (err: any) { toast(err.message, 'err'); }
  });
}

// ---------------------------------------------------------------------------
// Хуудас: Ангилал
// ---------------------------------------------------------------------------
async function pageCategories() {
  setHead('Ангилал', 'Каталогийн бүтэц');
  const d = await api<ListResp<Category>>('/api/admin/categories');
  state.cats = d.items;

  $('#content').innerHTML = `
  <div class="cols cols-2">
    <div class="box">
      <div class="box-head"><h3>${d.items.length} ангилал</h3></div>
      <div class="scroll-x"><table class="dtable">
        <thead><tr><th>Нэр</th><th>Slug</th><th>Төрөл</th><th class="num">Бараа</th><th></th></tr></thead>
        <tbody>${d.items.map((c) => `
          <tr>
            <td class="primary"><b>${esc(c.name)}</b></td>
            <td class="muted" data-label="Slug"><code>${esc(c.slug)}</code></td>
            <td data-label="Төрөл"><span class="chip ${c.kind === 'nail' ? 'chip-plum' : 'chip-gold'}">${c.kind === 'nail' ? 'Хумс' : 'Үс'}</span></td>
            <td class="num" data-label="Бараа">${c.count}</td>
            <td class="actions"><div class="row"><button class="btn btn-ghost btn-sm" data-delcat="${c.id}" style="color:var(--danger)">${icon('trash', 16)}<span class="m-only">Устгах</span></button></div></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="box">
      <div class="box-head"><h3>Шинэ ангилал</h3></div>
      <div class="box-body">
        <form id="catForm">
          <div class="field"><label>Нэр <span class="req">*</span></label>
            <input name="name" required placeholder="Ж: Үсний сойз"></div>
          <div class="field"><label>Slug (латинаар)</label>
            <input name="slug" placeholder="hair-brush" pattern="[a-z0-9\\-]*">
            <span class="hint">Хоосон бол автоматаар үүснэ</span></div>
          <div class="field"><label>Төрөл</label>
            <select name="kind"><option value="hair">Үсний</option><option value="nail">Хумсны</option></select></div>
          <button class="btn btn-block" type="submit">${icon('plus', 17)} Ангилал нэмэх</button>
        </form>
      </div>
    </div>
  </div>`;

  $('#catForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/categories', { method: 'POST', body: Object.fromEntries(new FormData(e.target as HTMLFormElement)) });
      toast('Ангилал нэмэгдлээ', 'ok');
      pageCategories();
    } catch (err: any) { toast(err.message, 'err'); }
  });

  $$('[data-delcat]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Энэ ангиллыг устгах уу?')) return;
    try {
      await api('/api/admin/categories/' + b.dataset.delcat, { method: 'DELETE' });
      toast('Устлаа', 'ok'); pageCategories();
    } catch (err: any) { toast(err.message, 'err'); }
  }));
}

// ---------------------------------------------------------------------------
// Хуудас: Урамшуулал
// ---------------------------------------------------------------------------
async function pagePromos() {
  setHead('Урамшуулал', 'Хөнгөлөлтийн кодууд');
  const d = await api<ListResp<Promo>>('/api/admin/promos');

  $('#content').innerHTML = `
  <div class="cols cols-2">
    <div class="box">
      <div class="box-head"><h3>${d.items.length} код</h3></div>
      <div class="scroll-x"><table class="dtable">
        <thead><tr><th>Код</th><th>Хөнгөлөлт</th><th class="num">Доод дүн</th><th>Тайлбар</th><th>Төлөв</th><th></th></tr></thead>
        <tbody>${d.items.map((p) => `
          <tr>
            <td class="primary"><b style="letter-spacing:.06em">${esc(p.code)}</b></td>
            <td data-label="Хөнгөлөлт"><span class="chip chip-gold">${p.type === 'percent' ? p.value + '%' : mnt(p.value)}</span></td>
            <td class="num" data-label="Доод дүн">${p.min_total ? mnt(p.min_total) : '—'}</td>
            <td class="muted" style="font-size:.83rem" data-label="Тайлбар">${esc(p.note)}</td>
            <td data-label="Төлөв"><span class="chip ${p.active ? 'chip-ok' : ''}">${p.active ? 'Идэвхтэй' : 'Идэвхгүй'}</span></td>
            <td class="actions"><div class="row"><button class="btn btn-ghost btn-sm" data-delpromo="${esc(p.code)}" style="color:var(--danger)">${icon('trash', 16)}<span class="m-only">Устгах</span></button></div></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="box">
      <div class="box-head"><h3>Шинэ код</h3></div>
      <div class="box-body">
        <form id="promoForm">
          <div class="field"><label>Код <span class="req">*</span></label>
            <input name="code" required placeholder="ZUN2026" style="text-transform:uppercase"></div>
          <div class="grid-2">
            <div class="field"><label>Төрөл</label>
              <select name="type"><option value="percent">Хувиар (%)</option><option value="amount">Дүнгээр (₮)</option></select></div>
            <div class="field"><label>Хэмжээ <span class="req">*</span></label>
              <input name="value" type="number" min="1" required value="10"></div>
          </div>
          <div class="field"><label>Доод дүн (₮)</label>
            <input name="min_total" type="number" min="0" value="0"></div>
          <div class="field"><label>Тайлбар</label>
            <input name="note" placeholder="Зуны хямдрал"></div>
          <button class="btn btn-block" type="submit">${icon('plus', 17)} Код үүсгэх</button>
        </form>
      </div>
    </div>
  </div>`;

  $('#promoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target as HTMLFormElement)) as Record<string, string>;
    try {
      await api('/api/admin/promos', {
        method: 'POST',
        body: { ...f, value: +f.value, min_total: +f.min_total, active: true },
      });
      toast('Код үүслээ', 'ok'); pagePromos();
    } catch (err: any) { toast(err.message, 'err'); }
  });

  $$('[data-delpromo]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`"${b.dataset.delpromo}" кодыг устгах уу?`)) return;
    await api('/api/admin/promos/' + encodeURIComponent(b.dataset.delpromo!), { method: 'DELETE' });
    toast('Устлаа', 'ok'); pagePromos();
  }));
}

// ---------------------------------------------------------------------------
// Хуудас: Хэрэглэгч
// ---------------------------------------------------------------------------
async function pageCustomers() {
  setHead('Хэрэглэгч', 'Бүртгэлтэй үйлчлүүлэгчид');
  const d = await api<ListResp<Customer>>('/api/admin/customers');
  const totalSpent = d.items.reduce((a, c) => a + c.spent, 0);

  $('#content').innerHTML = `
  <div class="stat-grid">
    <div class="stat"><div class="stat-ico">${icon('users', 21)}</div>
      <div class="stat-label">Нийт хэрэглэгч</div><div class="stat-value">${d.items.length}</div></div>
    <div class="stat gold"><div class="stat-ico">${icon('coin', 21)}</div>
      <div class="stat-label">Нийт худалдан авалт</div><div class="stat-value">${mnt(totalSpent)}</div></div>
    <div class="stat ok"><div class="stat-ico">${icon('cart', 21)}</div>
      <div class="stat-label">Дундаж хэрэглэгчийн үнэ цэн</div>
      <div class="stat-value">${mnt(d.items.length ? Math.round(totalSpent / d.items.length) : 0)}</div></div>
  </div>

  <div class="box">
    <div class="box-head"><h3>Хэрэглэгчид</h3><span class="muted" style="font-size:.83rem">Худалдан авалтаар эрэмбэлсэн</span></div>
    <div class="scroll-x"><table class="dtable">
      <thead><tr><th>Нэр</th><th>Утас</th><th>Имэйл</th><th>Дүүрэг</th>
        <th class="num">Захиалга</th><th class="num">Худалдан авалт</th><th>Бүртгүүлсэн</th></tr></thead>
      <tbody>${d.items.map((c, i) => `
        <tr>
          <td class="primary"><div class="row" style="gap:10px">
            <span class="avatar" style="width:34px;height:34px;font-size:.85rem">${esc(c.name.trim()[0] || '?')}</span>
            <b>${esc(c.name)}</b>${i === 0 && c.spent > 0 ? '<span class="chip chip-gold">VIP</span>' : ''}
          </div></td>
          <td data-label="Утас"><a href="tel:${esc(c.phone)}" style="color:var(--plum)">${esc(c.phone)}</a></td>
          <td class="muted" data-label="Имэйл">${esc(c.email) || '—'}</td>
          <td class="muted" data-label="Дүүрэг">${esc(c.district) || '—'}</td>
          <td class="num" data-label="Захиалга">${c.orders}</td>
          <td class="num" data-label="Худалдан авалт"><b>${mnt(c.spent)}</b></td>
          <td class="muted" data-label="Бүртгүүлсэн">${dateMn(c.created_at)}</td>
        </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Хуудас: Тохиргоо
// ---------------------------------------------------------------------------
const SETTING_LABELS: Record<string, string> = {
  store_name: 'Дэлгүүрийн нэр', tagline: 'Уриа үг', phone: 'Утас 1', phone2: 'Утас 2',
  email: 'Имэйл', address: 'Хаяг', work_hours: 'Ажиллах цаг',
  delivery_fee: 'Хотын хүргэлтийн үнэ (₮)', free_delivery_from: 'Үнэгүй хүргэлтийн доод дүн (₮)',
  country_delivery_fee: 'Орон нутгийн хүргэлт (₮)', bank_account: 'Дансны мэдээлэл',
  facebook: 'Facebook', instagram: 'Instagram',
};

async function pageSettings() {
  setHead('Тохиргоо', 'Дэлгүүрийн ерөнхий мэдээлэл');
  const d = await api<{ settings: Record<string, string> }>('/api/admin/settings');

  const group = (keys: string[]) => keys.map((k) => `
    <div class="field"><label>${SETTING_LABELS[k] || k}</label>
      <input name="${k}" value="${esc(d.settings[k] ?? '')}"></div>`).join('');

  $('#content').innerHTML = `
  <form id="setForm">
    <div class="cols cols-2b">
      <div class="box"><div class="box-head"><h3>Дэлгүүрийн мэдээлэл</h3></div>
        <div class="box-body">${group(['store_name', 'tagline', 'address', 'work_hours'])}</div></div>
      <div class="box"><div class="box-head"><h3>Холбоо барих</h3></div>
        <div class="box-body">${group(['phone', 'phone2', 'email', 'facebook', 'instagram'])}</div></div>
    </div>
    <div class="cols cols-2b" style="margin-top:16px">
      <div class="box"><div class="box-head"><h3>Хүргэлт ба төлбөр</h3></div>
        <div class="box-body">
          ${group(['delivery_fee', 'free_delivery_from', 'country_delivery_fee', 'bank_account'])}
          <p class="muted" style="font-size:.82rem;margin:0">Эдгээр утга нь хэрэглэгчийн талын сагс, захиалгын хуудсанд шууд тусна.</p>
        </div></div>
      <div class="box"><div class="box-head"><h3>Тусламж</h3></div>
        <div class="box-body">
          <div class="panel" style="background:var(--bg-2);border:none">
            <b>Нэвтрэх мэдээлэл</b>
            <p class="muted" style="font-size:.86rem;margin:6px 0 0">
              Админ: 99112233 / admin123<br>Туршилтын хэрэглэгч: 99001122 / test1234</p>
          </div>
          <div class="panel" style="background:var(--gold-100);border:none;margin-top:12px">
            <b>Мэдээллийн сан</b>
            <p class="muted" style="font-size:.86rem;margin:6px 0 0">
              <code>data/salon.db</code> файлд хадгалагдана. Дахин эхлүүлэхэд өгөгдөл хадгалагдана.</p>
          </div>
        </div></div>
    </div>
    <div class="row" style="margin-top:18px;gap:10px">
      <button class="btn btn-lg" type="submit">Тохиргоо хадгалах</button>
    </div>
  </form>`;

  $('#setForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/settings', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target as HTMLFormElement)) });
      toast('Тохиргоо хадгалагдлаа', 'ok');
    } catch (err: any) { toast(err.message, 'err'); }
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Барааны зураг удирдах (засах цонх дотор)
// ---------------------------------------------------------------------------
function mountPhotoManager(productId: number, initial: ProductImage[]) {
  let images = [...initial];
  const grid = $('#photoGrid');
  const status = $('#photoStatus');
  const input = $<HTMLInputElement>('#photoInput');
  const drop = $('#photoDrop');
  if (!grid) return;

  const draw = () => {
    grid.innerHTML = images.length ? images.map((im, i) => `
      <div class="photo-item" data-id="${im.id}">
        <img src="${esc(im.url)}" alt="">
        ${i === 0 ? '<span class="photo-main">Үндсэн</span>' : ''}
        <div class="photo-actions">
          ${i > 0 ? `<button type="button" title="Үндсэн болгох" data-imgfirst="${im.id}">★</button>` : ''}
          <button type="button" title="Устгах" data-imgdel="${im.id}">${icon('trash', 14)}</button>
        </div>
      </div>`).join('')
      : `<div class="muted" style="font-size:.84rem;padding:6px 0">Одоогоор зураг байхгүй</div>`;

    $$('[data-imgdel]', grid).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Энэ зургийг устгах уу?')) return;
      try {
        await api(`/api/admin/products/${productId}/images/${b.dataset.imgdel}`, { method: 'DELETE' });
        images = images.filter((x) => String(x.id) !== b.dataset.imgdel);
        draw(); loadProducts();
      } catch (err: any) { toast(err.message, 'err'); }
    }));
    $$('[data-imgfirst]', grid).forEach((b) => b.addEventListener('click', async () => {
      const id = Number(b.dataset.imgfirst);
      const order = [id, ...images.map((x) => x.id).filter((x) => x !== id)];
      try {
        const r = await api<{ images: ProductImage[] }>(`/api/admin/products/${productId}/images`, { method: 'PATCH', body: { order } });
        images = r.images;
        draw(); loadProducts();
        toast('Үндсэн зураг солигдлоо', 'ok');
      } catch (err: any) { toast(err.message, 'err'); }
    }));
  };

  const upload = async (files: FileList) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return toast('Зөвхөн зураг оруулна уу', 'err');
    const fd = new FormData();
    list.forEach((f) => fd.append('images', f, f.name));
    status.textContent = `${list.length} зураг байршуулж байна…`;
    drop.classList.add('busy');
    try {
      const res = await fetch(`/api/admin/products/${productId}/images`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Байршуулж чадсангүй');
      images = [...images, ...data.images];
      draw(); loadProducts();
      status.textContent = data.errors?.length ? `Алдаа: ${data.errors.join('; ')}` : '';
      toast(`${data.images.length} зураг нэмэгдлээ`, 'ok');
    } catch (err: any) {
      status.textContent = '';
      toast(err.message, 'err');
    } finally { drop.classList.remove('busy'); }
  };

  input.addEventListener('change', () => { if (input.files!.length) upload(input.files!); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) upload(e.dataTransfer.files); });

  draw();
}

// ---------------------------------------------------------------------------
// Хуудас: Тайлан татах
// ---------------------------------------------------------------------------
async function pageReports() {
  setHead('Тайлан', 'Excel-д нээгдэх CSV файл татах');
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const card = (title: string, desc: string, href: string, extra = '') => `
    <div class="box">
      <div class="box-body">
        <h3 style="margin:0 0 6px;font-size:1.02rem">${title}</h3>
        <p class="muted" style="font-size:.86rem;margin:0 0 14px">${desc}</p>
        ${extra}
        <a class="btn" href="${href}" download>${icon('out', 16)} CSV татах</a>
      </div>
    </div>`;

  $('#content').innerHTML = `
    <div class="grid-2" id="reportGrid" style="gap:16px;align-items:start">
      ${card('Захиалгын дэлгэрэнгүй', 'Захиалга бүр нэг мөр — захиалагч, хаяг, бараа, дүн, төлөв, төлбөр.',
        `/api/admin/export/orders.csv?from=${monthAgo}&to=${today}`, `
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <div class="field" style="margin:0"><label>Эхлэх</label><input type="date" id="rFrom" value="${monthAgo}"></div>
          <div class="field" style="margin:0"><label>Дуусах</label><input type="date" id="rTo" value="${today}"></div>
          <div class="field" style="margin:0"><label>Төлөв</label>
            <select id="rStatus" class="select"><option value="">Бүгд</option>
              ${Object.entries(STATUS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select></div>
        </div>`)}
      ${card('Өдрийн борлуулалт', 'Өдөр бүрийн захиалгын тоо, барааны дүн, хүргэлт, хөнгөлөлт, нийт орлого. Цуцлагдсаныг оруулаагүй.',
        '/api/admin/export/sales.csv')}
      ${card('Барааны жагсаалт', 'Бүх бараа — SKU, үнэ, үлдэгдэл, зарагдсан тоо. Тооллого хийхэд тохиромжтой.',
        '/api/admin/export/products.csv')}
      ${card('Хэрэглэгчид', 'Бүртгэлтэй хэрэглэгч бүрийн захиалгын тоо, нийт зарцуулалт.',
        '/api/admin/export/customers.csv')}
    </div>
    <div class="box" style="margin-top:16px"><div class="box-body">
      <b>Excel-д нээхэд кирилл эвдэрвэл</b>
      <p class="muted" style="font-size:.86rem;margin:6px 0 0">Файлууд UTF-8 BOM-той тул Excel 2016+ дээр шууд зөв нээгдэнэ.
      Хуучин Excel дээр: <i>Өгөгдөл → Текстээс/CSV-ээс</i> сонгоод «UTF-8» гэж заана уу.
      Багана бүгд нэг нүдэнд орж байвал <a href="#" id="sepToggle">цэг таслалаар тусгаарлах</a> хувилбарыг ашиглана уу.</p>
    </div></div>`;

  const ordersLink = $<HTMLAnchorElement>('#reportGrid a[href*="orders.csv"]');
  const syncOrders = () => {
    const p = new URLSearchParams();
    if ($<HTMLInputElement>('#rFrom').value) p.set('from', $<HTMLInputElement>('#rFrom').value);
    if ($<HTMLInputElement>('#rTo').value) p.set('to', $<HTMLInputElement>('#rTo').value);
    if ($<HTMLSelectElement>('#rStatus').value) p.set('status', $<HTMLSelectElement>('#rStatus').value);
    if (state.sep) p.set('sep', 'semicolon');
    ordersLink.href = '/api/admin/export/orders.csv?' + p.toString();
  };
  ['rFrom', 'rTo', 'rStatus'].forEach((id) => $('#' + id).addEventListener('change', syncOrders));
  $('#sepToggle').addEventListener('click', (e) => {
    e.preventDefault();
    state.sep = !state.sep;
    $$<HTMLAnchorElement>('#reportGrid a[download]').forEach((a) => {
      const u = new URL(a.href, location.origin);
      if (state.sep) u.searchParams.set('sep', 'semicolon'); else u.searchParams.delete('sep');
      a.href = u.pathname + u.search;
    });
    toast(state.sep ? 'Цэг таслал (;) тусгаарлагч идэвхжлээ' : 'Таслал (,) тусгаарлагч руу буцлаа', 'ok');
  });
}

// ---------------------------------------------------------------------------
// Хуудас: Төлбөр (QPay)
// ---------------------------------------------------------------------------
async function pagePayments() {
  setHead('Төлбөр', 'QPay нэхэмжлэх, төлөлтийн түүх');
  $('#content').innerHTML = `<div class="box"><div class="box-body"><div class="sk" style="height:300px"></div></div></div>`;
  const { items, live } = await api<PaymentsResp>('/api/admin/payments');

  const PST: Record<string, [string, string]> = { pending: ['Хүлээгдэж буй', 'chip-gold'], paid: ['Төлөгдсөн', 'chip-ok'], cancelled: ['Цуцлагдсан', ''], failed: ['Амжилтгүй', 'chip-danger'] };
  const paidSum = items.filter((p) => p.status === 'paid').reduce((s, p) => s + p.paid_amount, 0);

  $('#content').innerHTML = `
    <div class="stat-grid" style="margin-bottom:16px">
      <div class="stat"><div class="stat-ico">${icon('coin', 22)}</div><div><small>QPay-ээр орсон</small><b>${mnt(paidSum)}</b></div></div>
      <div class="stat"><div class="stat-ico">${icon('check', 22)}</div><div><small>Төлөгдсөн</small><b>${items.filter((p) => p.status === 'paid').length}</b></div></div>
      <div class="stat"><div class="stat-ico">${icon('spark', 22)}</div><div><small>Хүлээгдэж буй</small><b>${items.filter((p) => p.status === 'pending').length}</b></div></div>
      <div class="stat"><div class="stat-ico">${icon('cog', 22)}</div><div><small>Горим</small><b>${live ? 'Live' : 'Туршилт'}</b></div></div>
    </div>
    ${live ? '' : `<div class="box" style="margin-bottom:16px;border-color:#f0dfa8;background:var(--gold-100)"><div class="box-body" style="padding:12px 16px;font-size:.88rem">
      ${icon('warn', 16)} <b>Туршилтын горим.</b> QPay-ийн жинхэнэ түлхүүр тохируулаагүй тул нэхэмжлэх дотооддоо үүсч байна.
      <a href="#integrations">Холболт</a> хуудаснаас хэрхэн идэвхжүүлэхийг харна уу.</div></div>`}
    <div class="box"><div class="table-wrap">
      <table class="table">
        <thead><tr><th>Огноо</th><th>Захиалга</th><th>Захиалагч</th><th>Нэхэмжлэх</th><th>Дүн</th><th>Төлөв</th><th>Горим</th></tr></thead>
        <tbody>${items.length ? items.map((p) => `
          <tr>
            <td data-label="Огноо">${timeMn(p.created_at)}</td>
            <td data-label="Захиалга"><a href="#orders" data-order="${p.order_id}"><b>${esc(p.order_code)}</b></a></td>
            <td data-label="Захиалагч">${esc(p.customer_name)}<br><span class="muted" style="font-size:.8rem">${esc(p.phone)}</span></td>
            <td data-label="Нэхэмжлэх"><code style="font-size:.78rem">${esc(p.invoice_id)}</code></td>
            <td data-label="Дүн"><b>${mnt(p.amount)}</b>${p.paid_amount && p.paid_amount !== p.amount ? `<br><span class="muted" style="font-size:.8rem">төлсөн ${mnt(p.paid_amount)}</span>` : ''}</td>
            <td data-label="Төлөв"><span class="chip ${PST[p.status]?.[1] || ''}">${PST[p.status]?.[0] || p.status}</span></td>
            <td data-label="Горим">${p.mode === 'live' ? 'Live' : 'Туршилт'}</td>
          </tr>`).join('')
          : `<tr><td colspan="7"><div class="empty"><h3>Нэхэмжлэх байхгүй</h3><p>QPay-ээр захиалга хийгдэхэд энд харагдана.</p></div></td></tr>`}
        </tbody>
      </table>
    </div></div>`;
}

// ---------------------------------------------------------------------------
// Хуудас: Мессеж (SMS)
// ---------------------------------------------------------------------------
async function pageSms() {
  setHead('Мессеж', 'Үйлчлүүлэгчид илгээсэн SMS',
    `<button class="btn btn-outline" id="smsTest">${icon('spark', 16)} Туршилтын SMS</button>`);
  $('#content').innerHTML = `<div class="box"><div class="box-body"><div class="sk" style="height:300px"></div></div></div>`;
  const { items, stats, live, provider } = await api<SmsResp>('/api/admin/sms');

  const KIND: Record<string, string> = { order: 'Захиалга', status: 'Төлөв', reset: 'Нууц үг', test: 'Туршилт', other: 'Бусад' };
  const SST: Record<string, [string, string]> = { sent: ['Илгээсэн', 'chip-ok'], failed: ['Амжилтгүй', 'chip-danger'], queued: ['Хүлээгдэж буй', 'chip-gold'] };

  $('#content').innerHTML = `
    <div class="stat-grid" style="margin-bottom:16px">
      <div class="stat"><div class="stat-ico">${icon('check', 22)}</div><div><small>Илгээсэн</small><b>${stats.sent || 0}</b></div></div>
      <div class="stat"><div class="stat-ico">${icon('warn', 22)}</div><div><small>Амжилтгүй</small><b>${stats.failed || 0}</b></div></div>
      <div class="stat"><div class="stat-ico">${icon('cog', 22)}</div><div><small>Провайдер</small><b>${live ? esc(provider) : 'Туршилт'}</b></div></div>
    </div>
    ${live ? '' : `<div class="box" style="margin-bottom:16px;border-color:#f0dfa8;background:var(--gold-100)"><div class="box-body" style="padding:12px 16px;font-size:.88rem">
      ${icon('warn', 16)} <b>Туршилтын горим.</b> Мессеж жинхэнэ утас руу явахгүй, зөвхөн энд болон серверийн консол дээр бүртгэгдэнэ.
      <a href="#integrations">Холболт</a> хуудаснаас идэвхжүүлнэ.</div></div>`}
    <div class="box"><div class="table-wrap">
      <table class="table">
        <thead><tr><th>Огноо</th><th>Утас</th><th>Төрөл</th><th>Мессеж</th><th>Төлөв</th></tr></thead>
        <tbody>${items.length ? items.map((m) => `
          <tr>
            <td data-label="Огноо" style="white-space:nowrap">${timeMn(m.created_at)}</td>
            <td data-label="Утас">+${esc(m.phone)}</td>
            <td data-label="Төрөл"><span class="chip">${KIND[m.kind] || m.kind}</span></td>
            <td data-label="Мессеж" style="max-width:420px;white-space:pre-line;font-size:.86rem">${esc(m.body)}${m.error ? `<br><span style="color:var(--danger);font-size:.78rem">${esc(m.error)}</span>` : ''}</td>
            <td data-label="Төлөв"><span class="chip ${SST[m.status]?.[1] || ''}">${SST[m.status]?.[0] || m.status}</span></td>
          </tr>`).join('')
          : `<tr><td colspan="5"><div class="empty"><h3>Мессеж байхгүй</h3><p>Захиалга үүсэх, төлөв солигдоход автоматаар илгээгдэнэ.</p></div></td></tr>`}
        </tbody>
      </table>
    </div></div>`;

  $('#smsTest').addEventListener('click', () => {
    openSheet('Туршилтын SMS илгээх', `
      <form id="smsForm">
        <div class="field"><label>Утасны дугаар</label>
          <input name="phone" inputmode="numeric" maxlength="8" placeholder="99112233" required></div>
        <div class="field"><label>Мессеж</label>
          <textarea name="text" rows="3" placeholder="Khishgee's Salon — туршилтын мессеж."></textarea></div>
      </form>`,
      `<button class="btn btn-outline" id="smsCancel">Болих</button><button class="btn" id="smsSend">Илгээх</button>`);
    $('#smsCancel').addEventListener('click', closeSheet);
    $('#smsSend').addEventListener('click', async () => {
      const f = Object.fromEntries(new FormData($<HTMLFormElement>('#smsForm')));
      try {
        const r = await api<{ result: { mock?: boolean } }>('/api/admin/sms/test', { method: 'POST', body: f });
        toast(r.result.mock ? 'Туршилтын горимд бүртгэгдлээ' : 'Илгээгдлээ', 'ok');
        closeSheet(); pageSms();
      } catch (err: any) { toast(err.message, 'err'); }
    });
  });
}

// ---------------------------------------------------------------------------
// Хуудас: Холболт (QPay, SMS тохиргооны заавар)
// ---------------------------------------------------------------------------
async function pageIntegrations() {
  setHead('Холболт', 'QPay төлбөр, SMS мэдэгдлийн тохиргоо');
  $('#content').innerHTML = `<div class="box"><div class="box-body"><div class="sk" style="height:300px"></div></div></div>`;
  const s = await api<IntegrationsInfo>('/api/admin/integrations');

  const pill = (on: boolean) => `<span class="chip ${on ? 'chip-ok' : 'chip-gold'}">${on ? 'Идэвхтэй (live)' : 'Туршилтын горим'}</span>`;

  $('#content').innerHTML = `
    <div class="box" style="margin-bottom:16px"><div class="box-body">
      <p class="muted" style="font-size:.88rem;margin:0">Түлхүүрүүдийг серверийн үндсэн хавтас дахь <code>.env</code> файлд бичнэ. Хадгалсны дараа серверээ дахин асаана
      (<code>npm start</code>). Түлхүүр байхгүй үед систем <b>туршилтын горимд</b> бүрэн ажиллана — зөвхөн банк, SMS оператор л оролцохгүй.</p>
    </div></div>

    <div class="box" style="margin-bottom:16px"><div class="box-body">
      <div class="row-between" style="margin-bottom:10px"><h3 style="margin:0">QPay</h3>${pill(s.qpay.live)}</div>
      ${s.qpay.live ? `<p class="muted" style="font-size:.86rem">Холбогдсон: <code>${esc(s.qpay.base_url)}</code>. Callback: <code>${esc(s.qpay.callback_base)}/api/payments/qpay-callback</code></p>` : `
      <p class="muted" style="font-size:.86rem">Дутуу: ${s.qpay.missing.map((k) => `<code>${k}</code>`).join(', ')}. QPay-тэй мерчант гэрээ байгуулсны дараа тэдний өгсөн утгуудыг бичнэ:</p>
      <pre class="env-block">QPAY_USERNAME=таны_мерчант_нэр
QPAY_PASSWORD=таны_нууц_үг
QPAY_INVOICE_CODE=ТАНЫ_INVOICE_CODE
# Интернэтэд харагдах хаяг — callback ирүүлэхэд хэрэгтэй
PUBLIC_BASE_URL=https://khishgee.mn</pre>
      <p class="muted" style="font-size:.82rem;margin:8px 0 0">Туршилтын серверт холбох бол <code>QPAY_BASE_URL=https://merchant-sandbox.qpay.mn/v2</code> нэмнэ.</p>`}
    </div></div>

    <div class="box" style="margin-bottom:16px"><div class="box-body">
      <div class="row-between" style="margin-bottom:10px"><h3 style="margin:0">SMS мэдэгдэл</h3>${pill(s.sms.live)}</div>
      <p class="muted" style="font-size:.86rem">Захиалга үүсэхэд: <b>${s.sms.notify_on_order ? 'илгээнэ' : 'илгээхгүй'}</b> ·
        Төлөв солигдоход: <b>${s.sms.notify_on_status ? 'илгээнэ' : 'илгээхгүй'}</b> · Нууц үг сэргээх код: үргэлж</p>
      ${s.sms.live ? `<p class="muted" style="font-size:.86rem">Провайдер: <code>${esc(s.sms.provider)}</code></p>` : `
      <p class="muted" style="font-size:.86rem">Хоёр төрлийн холболт дэмжинэ:</p>
      <p style="font-size:.88rem;margin:10px 0 4px"><b>1. Монголын оператор / агрегатор</b> (ерөнхий HTTP gateway — Skytel, Unitel, Mobicom-ын SMS API, эсвэл messagepro.mn зэрэг)</p>
      <pre class="env-block">SMS_PROVIDER=http
SMS_HTTP_URL=https://api.example.mn/send
SMS_HTTP_METHOD=GET
# {to} {text} {from} гэсэн орлуулагч ашиглана
SMS_HTTP_QUERY=key=ТҮЛХҮҮР&from={from}&to={to}&text={text}
SMS_FROM=Khishgee</pre>
      <p style="font-size:.88rem;margin:12px 0 4px"><b>2. Twilio</b></p>
      <pre class="env-block">SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_FROM=+1xxxxxxxxxx</pre>
      <p class="muted" style="font-size:.82rem;margin:8px 0 0">Мэдэгдлийг унтраах: <code>SMS_NOTIFY_ON_ORDER=false</code>, <code>SMS_NOTIFY_ON_STATUS=false</code></p>`}
    </div></div>

    <div class="box"><div class="box-body">
      <h3 style="margin:0 0 8px">Зураг байршуулалт</h3>
      <p class="muted" style="font-size:.86rem;margin:0">Хамгийн их хэмжээ: <b>${(s.uploads.max_bytes / 1024 / 1024).toFixed(0)}MB</b> (<code>UPLOAD_MAX_BYTES</code>). Файлууд <code>data/uploads/</code> хавтсанд хадгалагдана — нөөцлөхдөө <code>data/</code> хавтсыг бүхэлд нь хуулна.</p>
    </div></div>`;
}

const PAGES: Record<string, () => Promise<void>> = {
  dash: pageDash, orders: pageOrders, products: pageProducts,
  categories: pageCategories, promos: pagePromos,
  customers: pageCustomers, payments: pagePayments, sms: pageSms,
  reports: pageReports, integrations: pageIntegrations, settings: pageSettings,
};

async function route() {
  const key = location.hash.replace('#', '') || 'dash';
  state.page = PAGES[key] ? key : 'dash';
  // Хуудас солигдоход нээлттэй sheet үлдэхгүй
  if ($('#sheet')?.classList.contains('on')) closeSheet();
  try {
    await PAGES[state.page]();
  } catch (err: any) {
    if (/эрх|Нэвтэр/i.test(err.message)) { state.user = null; loginView(); return; }
    $('#content').innerHTML = `<div class="box"><div class="box-body"><div class="empty">
      <h3>Алдаа гарлаа</h3><p>${esc(err.message)}</p></div></div></div>`;
  }
}

window.addEventListener('hashchange', route);

// ---------------------------------------------------------------------------
// Эхлүүлэх
// ---------------------------------------------------------------------------
async function boot() {
  shell();
  try {
    const c = await api<ListResp<Category>>('/api/admin/categories');
    state.cats = c.items;
  } catch { /* дараа нь ачаална */ }
  await route();
}

$('#sheetClose').addEventListener('click', closeSheet);
$('#overlay').addEventListener('click', () => {
  closeSheet();
  $('#side').classList.remove('on');
  $('#overlay').classList.remove('on');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

(async function init() {
  try {
    const b = await api<{ user?: AdminUser }>('/api/bootstrap');
    if (b.user && b.user.role === 'admin') {
      state.user = b.user;
      await boot();
      return;
    }
  } catch { /* сервер боломжгүй */ }
  loginView();
})();
