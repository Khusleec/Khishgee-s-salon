/* =========================================================================
   Khishgee's Salon — хэрэглэгчийн талын програм
   ========================================================================= */
'use strict';

// ---------------------------------------------------------------------------
// Туслах
// ---------------------------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const mnt = (n) => Number(n || 0).toLocaleString('mn-MN') + '₮';

const dateMn = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
const dateTimeMn = (iso) => {
  const d = new Date(iso);
  return `${dateMn(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const icon = (name, size = 20) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

function stars(rating) {
  const r = Number(rating) || 0;
  const filled = Math.round(r);
  let out = '';
  for (let i = 1; i <= 5; i++) out += i <= filled ? '★' : '☆';
  return `<span class="stars" aria-label="${r.toFixed(1)} оноо">${out}</span>`;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* хоосон хариу */ }
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Алдаа гарлаа');
  return data;
}

function toast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'ok' ? icon('check', 18) : type === 'err' ? icon('x', 18) : icon('spark', 18)}<span>${esc(message)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

// Ангиллын дүрс — сангийн icon талбарыг sprite-ийн нэртэй холбоно
const CAT_ICON = {
  bottle: 'bottle', jar: 'jar', drop: 'drop', tube: 'tube',
  spray: 'spray', tool: 'tool', polish: 'polish',
};

const DISTRICTS = ['Багануур', 'Багахангай', 'Баянгол', 'Баянзүрх', 'Налайх',
  'Сонгинохайрхан', 'Сүхбаатар', 'Хан-Уул', 'Чингэлтэй'];

const STATUS_MAP = {
  new:       { label: 'Шинэ захиалга',  chip: 'chip-info',   step: 0 },
  confirmed: { label: 'Баталгаажсан',   chip: 'chip-plum',   step: 1 },
  packed:    { label: 'Савлагдсан',     chip: 'chip-gold',   step: 2 },
  shipping:  { label: 'Хүргэлтэд гарсан', chip: 'chip-warn', step: 3 },
  delivered: { label: 'Хүргэгдсэн',     chip: 'chip-ok',     step: 4 },
  cancelled: { label: 'Цуцлагдсан',     chip: 'chip-danger', step: -1 },
};

const DELIVERY_LABEL = { ub: 'Хотын хүргэлт', pickup: 'Дэлгүүрээс авах', country: 'Орон нутаг' };
const PAYMENT_LABEL = { cash: 'Бэлнээр (хүргэлтээр)', transfer: 'Дансаар шилжүүлэх', qpay: 'QPay / картаар' };

// ---------------------------------------------------------------------------
// Төлөв
// ---------------------------------------------------------------------------
const store = {
  settings: {},
  categories: [],
  brands: [],
  price: { min: 0, max: 0 },
  user: null,
  cart: JSON.parse(localStorage.getItem('ks_cart') || '[]'),
  favs: JSON.parse(localStorage.getItem('ks_favs') || '[]'),
  promo: JSON.parse(localStorage.getItem('ks_promo') || 'null'),
};

const saveCart = () => { localStorage.setItem('ks_cart', JSON.stringify(store.cart)); renderCart(); };

// Зочноор захиалсан хүн баталгаажуулалтаа дахин үзэх боломжтой байхын тулд
// захиалгын дугаар + утсыг зөвхөн энэ төхөөрөмж дээр хадгална.
const myOrders = () => { try { return JSON.parse(localStorage.getItem('ks_orders') || '[]'); } catch { return []; } };
function rememberOrder(code, phone) {
  const list = myOrders().filter((o) => o.code !== code);
  list.unshift({ code, phone, at: Date.now() });
  localStorage.setItem('ks_orders', JSON.stringify(list.slice(0, 20)));
}
const phoneForOrder = (code) => myOrders().find((o) => o.code === code)?.phone || '';
const saveFavs = () => { localStorage.setItem('ks_favs', JSON.stringify(store.favs)); renderFavCount(); };
const cartQty = () => store.cart.reduce((s, i) => s + i.qty, 0);
const cartSubtotal = () => store.cart.reduce((s, i) => s + i.price * i.qty, 0);

function addToCart(p, qty = 1) {
  const line = store.cart.find((i) => i.id === p.id);
  if (line) line.qty = Math.min(99, line.qty + qty);
  else store.cart.push({ id: p.id, name: p.name, price: p.price, qty, image: p.image || `/img/p/${p.id}.svg`, stock: p.stock });
  saveCart();
  toast(`"${p.name}" сагсанд нэмэгдлээ`, 'ok');
}

function toggleFav(id) {
  const i = store.favs.indexOf(id);
  if (i >= 0) { store.favs.splice(i, 1); toast('Хадгалсанаас хаслаа'); }
  else { store.favs.push(id); toast('Хадгалсан жагсаалтад нэмэгдлээ', 'ok'); }
  saveFavs();
  $$(`.card-fav[data-fav="${id}"]`).forEach((b) => {
    const on = store.favs.includes(id);
    b.classList.toggle('on', on);
    b.innerHTML = icon(on ? 'heart-fill' : 'heart', 17);
  });
}

function deliveryFee(subtotal, method = 'ub') {
  if (method === 'pickup') return 0;
  if (method === 'country') return Number(store.settings.country_delivery_fee || 15000);
  return subtotal >= Number(store.settings.free_delivery_from || 150000) ? 0 : Number(store.settings.delivery_fee || 8000);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const isMobile = () => window.matchMedia('(max-width: 820px)').matches;

// --- Доод хуудас (bottom sheet) ---
let sheetRestore = null;
function openBSheet(title, bodyNode, footHtml = '') {
  $('#bsheetTitle').textContent = title;
  const body = $('#bsheetBody');
  body.innerHTML = '';
  if (typeof bodyNode === 'string') body.innerHTML = bodyNode;
  else body.append(bodyNode);
  $('#bsheetFoot').innerHTML = footHtml;
  $('#bsheet').classList.add('on');
  $('#overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeBSheet() {
  const sheet = $('#bsheet');
  if (!sheet.classList.contains('on')) return;
  sheet.classList.remove('on');
  if (!$('#cartDrawer').classList.contains('on')) {
    $('#overlay').classList.remove('on');
    document.body.style.overflow = '';
  }
  if (sheetRestore) { sheetRestore(); sheetRestore = null; }
}

const routes = [];
const route = (pattern, view) => {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ rx, keys, view });
};

function go(url, replace = false) {
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
  render();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a && a.getAttribute('href')?.startsWith('/')) {
    e.preventDefault();
    go(a.getAttribute('href'));
  }
});
window.addEventListener('popstate', () => render());

async function render() {
  const path = location.pathname;
  const query = Object.fromEntries(new URLSearchParams(location.search));
  const app = $('#app');

  for (const r of routes) {
    const m = r.rx.exec(path);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    closeBSheet();
    document.body.classList.remove('has-pdp-bar', 'has-checkout-bar');
    $('#fabActions').hidden = true;
    $('#fabBtn').classList.remove('on');
    window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      await r.view(app, params, query);
    } catch (err) {
      app.innerHTML = `<div class="wrap"><div class="empty"><h2>Алдаа гарлаа</h2><p>${esc(err.message)}</p>
        <a class="btn" href="/" data-link>Нүүр хуудас</a></div></div>`;
    }
    syncNav(path);
    return;
  }
  app.innerHTML = notFoundView();
  syncNav(path);
}

function syncNav(path) {
  $$('#mainnav .navlink').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === path + location.search));
  $$('#mobileNav a').forEach((a) => a.classList.toggle('active', a.dataset.m === path));
}

// ---------------------------------------------------------------------------
// Дахин ашиглагдах хэсгүүд
// ---------------------------------------------------------------------------
function productCard(p) {
  const off = p.compare_price && p.compare_price > p.price
    ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const fav = store.favs.includes(p.id);
  const stockCls = p.stock === 0 ? 'out' : p.stock <= 10 ? 'low' : '';
  const stockTxt = p.stock === 0 ? 'Дууссан' : p.stock <= 10 ? `Үлдсэн ${p.stock}ш` : 'Бэлэн байгаа';

  return `
  <article class="card">
    <a class="card-media" href="/product/${p.id}" data-link aria-label="${esc(p.name)}">
      <img src="${p.image || `/img/p/${p.id}.svg`}" alt="${esc(p.name)}" loading="lazy" width="600" height="600">
    </a>
    <div class="card-badges">
      ${p.badge ? `<span class="chip ${p.badge === 'Хямдрал' ? 'chip-danger' : p.badge === 'Шинэ' ? 'chip-ok' : 'chip-gold'}">${esc(p.badge)}</span>` : ''}
      ${off ? `<span class="chip chip-danger">−${off}%</span>` : ''}
    </div>
    <button class="card-fav${fav ? ' on' : ''}" data-fav="${p.id}" aria-label="Хадгалах">${icon(fav ? 'heart-fill' : 'heart', 17)}</button>
    <div class="card-quick">
      <button class="btn btn-block btn-sm" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>
        ${icon('cart', 16)} ${p.stock === 0 ? 'Дууссан' : 'Сагсанд'}
      </button>
    </div>
    <div class="card-body">
      <span class="card-brand">${esc(p.brand)}</span>
      <a class="card-title" href="/product/${p.id}" data-link>${esc(p.name)}</a>
      <div class="card-meta">${stars(p.rating)} <span>${Number(p.rating).toFixed(1)}</span><span class="d-only"> · ${p.sold} зарагдсан</span></div>
      <div class="stock-line"><span class="dot ${stockCls}"></span><span class="muted">${stockTxt}</span></div>
      <div class="card-price">
        <span class="price">${mnt(p.price)}</span>
        ${off ? `<span class="price-old">${mnt(p.compare_price)}</span>` : ''}
      </div>
    </div>
  </article>`;
}

const skeletonGrid = (n = 8) =>
  `<div class="prod-grid">${'<div class="sk sk-card"></div>'.repeat(n)}</div>`;

function crumbs(items) {
  return `<div class="wrap"><nav class="crumbs">` + items.map((it, i) =>
    (it.href ? `<a href="${it.href}" data-link>${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`)
    + (i < items.length - 1 ? `<span style="opacity:.5">›</span>` : '')
  ).join('') + `</nav></div>`;
}

const notFoundView = () => `
  <div class="wrap"><div class="empty" style="padding-block:90px">
    <div class="empty-ico">${icon('search', 32)}</div>
    <h2>Хуудас олдсонгүй</h2>
    <p>Таны хайсан хуудас байхгүй эсвэл зөөгдсөн байна.</p>
    <a class="btn" href="/" data-link>Нүүр хуудас руу буцах</a>
  </div></div>`;

// ---------------------------------------------------------------------------
// Нүүр хуудас
// ---------------------------------------------------------------------------
route('/', async (app) => {
  app.innerHTML = `
  <section class="hero" style="padding:0">
    <div class="wrap">
      <div>
        <span class="hero-eyebrow">${icon('spark', 16)} Мэргэжлийн салоны нийлүүлэгч</span>
        <h1>Үс, хумсныхаа <em>гоо сайхныг</em> мэргэжлийн түвшинд</h1>
        <p class="hero-lead">Салонд ашиглагддаг жинхэнэ бүтээгдэхүүнийг шууд гэрт тань. Улаанбаатар хотод 24 цагийн дотор хүргэнэ, 150,000₮-с дээш захиалгад хүргэлт үнэгүй.</p>
        <div class="hero-cta">
          <a class="btn btn-lg" href="/catalog" data-link>Дэлгүүр хэсэх ${icon('arrow', 18)}</a>
          <a class="btn btn-lg btn-outline" href="/catalog?sale=1" data-link>Хямдралтай бараа</a>
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><b id="hsProducts">40+</b><span>Бүтээгдэхүүн</span></div>
          <div class="hero-stat"><b>8</b><span>Дэлхийн брэнд</span></div>
          <div class="hero-stat"><b>2,400+</b><span>Сэтгэл ханамжтай үйлчлүүлэгч</span></div>
          <div class="hero-stat"><b>24ц</b><span>Хүргэлтийн хугацаа</span></div>
        </div>
      </div>
      <div class="hero-art">
        <div class="blob"></div>
        <div class="hero-card c1"><img src="/img/p/1.svg" alt="" loading="eager"></div>
        <div class="hero-card c2"><img src="/img/p/22.svg" alt="" loading="eager"></div>
        <div class="hero-card c3"><img src="/img/p/8.svg" alt="" loading="lazy"></div>
        <div class="hero-pill">${icon('truck', 18)} <span>Өнөөдөр захиалбал <b>маргааш</b> гарт</span></div>
      </div>
    </div>
  </section>

  <div class="trust">
    <div class="wrap">
      <div class="trust-item"><span class="trust-ico">${icon('shield', 20)}</span><div><b>100% жинхэнэ</b><span>Албан ёсны импорт</span></div></div>
      <div class="trust-item"><span class="trust-ico">${icon('truck', 20)}</span><div><b>Шуурхай хүргэлт</b><span>УБ хотод 24 цагт</span></div></div>
      <div class="trust-item"><span class="trust-ico">${icon('card', 20)}</span><div><b>Уян хатан төлбөр</b><span>Бэлэн · Данс · QPay</span></div></div>
      <div class="trust-item"><span class="trust-ico">${icon('phone', 20)}</span><div><b>Мэргэжлийн зөвлөгөө</b><span>Үсчин, маникюрчаас</span></div></div>
    </div>
  </div>

  <section>
    <div class="wrap">
      <div class="sec-head">
        <div>
          <div class="sec-kicker">Ангилал</div>
          <h2>Юу хайж байна вэ?</h2>
          <p>Үс, хумсны бүх төрлийн мэргэжлийн бүтээгдэхүүн нэг дороос.</p>
        </div>
        <a class="link-more" href="/catalog" data-link>Бүгдийг үзэх ${icon('chev', 15)}</a>
      </div>
      <div class="cat-grid" id="homeCats"></div>
    </div>
  </section>

  <section style="background:var(--surface);border-block:1px solid var(--line)">
    <div class="wrap">
      <div class="sec-head">
        <div>
          <div class="sec-kicker">Эрэлттэй</div>
          <h2>Хамгийн их зарагддаг</h2>
          <p>Салонууд болон гэрийн хэрэглэгчдийн сонголт.</p>
        </div>
        <a class="link-more" href="/catalog?sort=popular" data-link>Бүгдийг үзэх ${icon('chev', 15)}</a>
      </div>
      <div id="homePopular">${skeletonGrid(8)}</div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="panel promo-banner">
        <div>
          <div class="sec-kicker">Урамшуулал</div>
          <h2>Эхний захиалгадаа 10% хөнгөлөлт</h2>
          <p>Худалдан авалт хийхдээ <b style="background:rgba(255,255,255,.18);padding:3px 10px;border-radius:8px">SHINE10</b> кодыг ашиглаарай. 50,000₮-с дээш захиалгад хүчинтэй.</p>
        </div>
        <a class="btn btn-gold btn-lg" href="/catalog" data-link>Одоо худалдан авах</a>
      </div>
    </div>
  </section>

  <section style="padding-top:0">
    <div class="wrap">
      <div class="sec-head">
        <div><div class="sec-kicker">Шинэ</div><h2>Саяхан ирсэн бараа</h2></div>
        <a class="link-more" href="/catalog?sort=new" data-link>Бүгдийг үзэх ${icon('chev', 15)}</a>
      </div>
      <div id="homeNew">${skeletonGrid(8)}</div>
    </div>
  </section>

  <section style="background:var(--bg-2)">
    <div class="wrap">
      <div class="sec-head" style="justify-content:center;text-align:center">
        <div><div class="sec-kicker">Хэрхэн ажилладаг вэ</div><h2>Гурван алхамд гарт тань</h2></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px">
        ${[['Сонгох', 'Каталогоос хэрэгтэй бүтээгдэхүүнээ сагсандаа хийнэ.', 'grid'],
          ['Захиалах', 'Утас, хаягаа үлдээж захиалгаа баталгаажуулна.', 'box'],
          ['Хүлээн авах', 'Манай жолооч 24 цагийн дотор хаяг дээр тань хүргэнэ.', 'truck']]
          .map(([t, d, ic], i) => `
          <div class="panel center">
            <div class="cat-ico" style="margin-bottom:14px">${icon(ic, 26)}</div>
            <div class="chip chip-plum" style="margin-bottom:10px">Алхам ${i + 1}</div>
            <h3 style="margin-bottom:8px">${t}</h3>
            <p class="muted" style="margin:0;font-size:.92rem">${d}</p>
          </div>`).join('')}
      </div>
    </div>
  </section>`;

  // Ангиллууд
  $('#homeCats').innerHTML = store.categories.map((c) => `
    <a class="cat-card" href="/catalog?category=${c.slug}" data-link>
      <span class="cat-ico">${icon(CAT_ICON[c.icon] || 'leaf', 26)}</span>
      <b>${esc(c.name)}</b>
      <span>${c.count} бараа</span>
    </a>`).join('');

  const [pop, fresh] = await Promise.all([
    api('/api/products?sort=popular&per=8'),
    api('/api/products?sort=new&per=8'),
  ]);
  // Утсанд хэвтээ гүйдэг эгнээ — доош гүйлгэх хэмжээг багасгана
  $('#homePopular').innerHTML = `<div class="prod-grid prod-rail">${pop.items.map(productCard).join('')}</div>`;
  $('#homeNew').innerHTML = `<div class="prod-grid">${fresh.items.map(productCard).join('')}</div>`;
  $('#hsProducts').textContent = pop.total + '+';
});

// ---------------------------------------------------------------------------
// Каталог
// ---------------------------------------------------------------------------
route('/catalog', async (app, _p, q) => {
  const cat = store.categories.find((c) => c.slug === q.category);
  const title = q.q ? `"${q.q}" хайлтын үр дүн`
    : cat ? cat.name
    : q.kind === 'hair' ? 'Үсний бүтээгдэхүүн'
    : q.kind === 'nail' ? 'Хумсны бүтээгдэхүүн'
    : q.sale ? 'Хямдралтай бараа'
    : q.sort === 'new' ? 'Шинэ бараа'
    : 'Бүх бүтээгдэхүүн';

  const selBrands = (q.brand || '').split(',').filter(Boolean);
  const activeCount = [q.kind, q.category, q.min, q.max, q.sale].filter(Boolean).length + selBrands.length;

  app.innerHTML = `
  ${crumbs([{ label: 'Нүүр', href: '/' }, { label: title }])}
  <div class="wrap" style="padding-bottom:60px">
    <div class="sec-head" style="margin-bottom:18px">
      <div><h1 style="font-size:clamp(1.45rem,3vw,2.3rem)">${esc(title)}</h1>
      <p id="resultCount" class="muted">Ачаалж байна…</p></div>
    </div>

    <!-- Утасны удирдлага -->
    <div class="catalog-bar">
      <button class="btn btn-outline" id="mFilter">${icon('filter', 16)} Шүүлтүүр
        ${activeCount ? `<span class="count">${activeCount}</span>` : ''}</button>
      <button class="btn btn-outline" id="mSort">${icon('sort', 16)} Эрэмбэ</button>
    </div>
    <div class="chip-row" id="chipRow"></div>

    <div class="catalog">
      <aside class="filters" id="filters">
        <div class="filter-group">
          <h4>Төрөл</h4>
          <div class="filter-list">
            ${[['', 'Бүгд'], ['hair', 'Үсний бүтээгдэхүүн'], ['nail', 'Хумсны бүтээгдэхүүн']].map(([v, l]) => `
              <label class="filter-opt"><input type="radio" name="kind" value="${v}" ${(q.kind || '') === v ? 'checked' : ''}>${l}</label>`).join('')}
          </div>
        </div>
        <div class="filter-group">
          <h4>Ангилал</h4>
          <div class="filter-list">
            <label class="filter-opt"><input type="radio" name="category" value="" ${!q.category ? 'checked' : ''}>Бүх ангилал</label>
            ${store.categories.filter((c) => !q.kind || c.kind === q.kind).map((c) => `
              <label class="filter-opt"><input type="radio" name="category" value="${c.slug}" ${q.category === c.slug ? 'checked' : ''}>
                ${esc(c.name)}<span class="n">${c.count}</span></label>`).join('')}
          </div>
        </div>
        <div class="filter-group">
          <h4>Брэнд</h4>
          <div class="filter-list">
            ${store.brands.map((b) => `
              <label class="filter-opt"><input type="checkbox" name="brand" value="${esc(b)}" ${selBrands.includes(b) ? 'checked' : ''}>${esc(b)}</label>`).join('')}
          </div>
        </div>
        <div class="filter-group">
          <h4>Үнэ (₮)</h4>
          <div class="row" style="gap:8px">
            <input class="select" style="width:100%;border-radius:8px" type="number" id="fMin" placeholder="${store.price.min}" value="${q.min || ''}" min="0">
            <span class="muted">–</span>
            <input class="select" style="width:100%;border-radius:8px" type="number" id="fMax" placeholder="${store.price.max}" value="${q.max || ''}" min="0">
          </div>
          <button class="btn btn-outline btn-sm btn-block" style="margin-top:11px" id="applyPrice">Хэрэглэх</button>
        </div>
        <div class="filter-group">
          <label class="filter-opt"><input type="checkbox" id="fSale" ${q.sale === '1' ? 'checked' : ''}>Зөвхөн хямдралтай</label>
          <button class="btn btn-ghost btn-sm btn-block" style="margin-top:10px" id="clearFilters">Шүүлтүүр цэвэрлэх</button>
        </div>
      </aside>

      <div>
        <div class="toolbar">
          <div class="active-filters" id="activeFilters"></div>
          <select class="select" id="sortSel" aria-label="Эрэмбэлэх">
            ${[['popular', 'Эрэлттэй эхэндээ'], ['new', 'Шинэ эхэндээ'], ['price_asc', 'Үнэ: багаас их'],
               ['price_desc', 'Үнэ: ихээс бага'], ['rating', 'Үнэлгээгээр'], ['name', 'Нэрээр (А-Я)']]
              .map(([v, l]) => `<option value="${v}" ${(q.sort || 'popular') === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div id="catalogGrid">${skeletonGrid(9)}</div>
        <div class="pager" id="pager"></div>
      </div>
    </div>
  </div>`;

  const update = (patch) => {
    const next = { ...q, ...patch };
    delete next.page;
    for (const k of Object.keys(next)) if (!next[k]) delete next[k];
    closeBSheet();
    go('/catalog' + (Object.keys(next).length ? '?' + new URLSearchParams(next) : ''));
  };

  // --- Ангиллын хэвтээ чипс (утас) ---
  const chipCats = store.categories.filter((c) => !q.kind || c.kind === q.kind);
  $('#chipRow').innerHTML = [
    `<a href="/catalog${q.kind ? '?kind=' + q.kind : ''}" data-link class="${!q.category ? 'on' : ''}">Бүгд</a>`,
    ...chipCats.map((c) => `<a href="/catalog?category=${c.slug}" data-link
        class="${q.category === c.slug ? 'on' : ''}">${esc(c.name)}</a>`),
  ].join('');

  // --- Шүүлтүүрийн доод хуудас: жинхэнэ панелийг зөөж оруулна ---
  $('#mFilter').addEventListener('click', () => {
    const panel = $('#filters');
    const parent = panel.parentNode;
    const anchor = panel.nextSibling;
    sheetRestore = () => parent.insertBefore(panel, anchor);
    openBSheet('Шүүлтүүр', panel, `
      <button class="btn btn-outline" id="sheetClear">Цэвэрлэх</button>
      <button class="btn" id="sheetApply">Үр дүнг харах</button>`);
    $('#sheetClear').addEventListener('click', () => { closeBSheet(); go('/catalog'); });
    $('#sheetApply').addEventListener('click', closeBSheet);
  });

  // --- Эрэмбийн доод хуудас ---
  $('#mSort').addEventListener('click', () => {
    const opts = [['popular', 'Эрэлттэй эхэндээ'], ['new', 'Шинэ эхэндээ'], ['price_asc', 'Үнэ: багаас их'],
      ['price_desc', 'Үнэ: ихээс бага'], ['rating', 'Үнэлгээгээр'], ['name', 'Нэрээр (А-Я)']];
    const cur = q.sort || 'popular';
    openBSheet('Эрэмбэлэх', opts.map(([v, l]) =>
      `<button class="sort-opt ${cur === v ? 'on' : ''}" data-sort="${v}">${l}
        ${cur === v ? icon('check', 18) : ''}</button>`).join(''));
    $$('[data-sort]').forEach((b) => b.addEventListener('click', () => update({ sort: b.dataset.sort })));
  });

  $$('input[name="kind"]').forEach((r) => r.addEventListener('change', () => update({ kind: r.value, category: '' })));
  $$('input[name="category"]').forEach((r) => r.addEventListener('change', () => update({ category: r.value })));
  $$('input[name="brand"]').forEach((c) => c.addEventListener('change', () => {
    const list = $$('input[name="brand"]:checked').map((x) => x.value);
    update({ brand: list.join(',') });
  }));
  $('#applyPrice').addEventListener('click', () => update({ min: $('#fMin').value, max: $('#fMax').value }));
  $('#fSale').addEventListener('change', (e) => update({ sale: e.target.checked ? '1' : '' }));
  $('#clearFilters').addEventListener('click', () => go('/catalog'));
  $('#sortSel').addEventListener('change', (e) => update({ sort: e.target.value }));

  // Идэвхтэй шүүлтүүрийн шошго
  const tags = [];
  if (q.kind) tags.push(['kind', q.kind === 'hair' ? 'Үсний' : 'Хумсны']);
  if (cat) tags.push(['category', cat.name]);
  selBrands.forEach((b) => tags.push(['brand:' + b, b]));
  if (q.min) tags.push(['min', `${mnt(q.min)}-с дээш`]);
  if (q.max) tags.push(['max', `${mnt(q.max)}-с доош`]);
  if (q.sale) tags.push(['sale', 'Хямдралтай']);
  if (q.q) tags.push(['q', `Хайлт: ${q.q}`]);
  $('#activeFilters').innerHTML = tags.map(([k, l]) =>
    `<span class="filter-tag">${esc(l)}<button data-rm="${esc(k)}" aria-label="Хасах">×</button></span>`).join('');
  $$('#activeFilters button').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.rm;
    if (key.startsWith('brand:')) {
      const left = selBrands.filter((x) => x !== key.slice(6));
      update({ brand: left.join(',') });
    } else update({ [key]: '' });
  }));

  const params = new URLSearchParams({ per: '12', ...q });
  const data = await api('/api/products?' + params);

  $('#resultCount').textContent = data.total
    ? `Нийт ${data.total} бүтээгдэхүүнээс ${(data.page - 1) * data.per + 1}–${Math.min(data.page * data.per, data.total)} харуулж байна`
    : 'Илэрц олдсонгүй';

  $('#catalogGrid').innerHTML = data.items.length
    ? `<div class="prod-grid">${data.items.map(productCard).join('')}</div>`
    : `<div class="empty"><div class="empty-ico">${icon('search', 30)}</div>
       <h3>Илэрц олдсонгүй</h3><p>Шүүлтүүрээ өөрчилж дахин оролдоно уу.</p>
       <button class="btn btn-outline" onclick="location.href='/catalog'">Шүүлтүүр цэвэрлэх</button></div>`;

  if (data.pages > 1) {
    const btn = (n, label = n, on = false, dis = false) =>
      `<button data-page="${n}" class="${on ? 'on' : ''}" ${dis ? 'disabled' : ''}>${label}</button>`;
    let html = btn(data.page - 1, '‹', false, data.page === 1);
    for (let i = 1; i <= data.pages; i++) {
      if (i === 1 || i === data.pages || Math.abs(i - data.page) <= 1) html += btn(i, i, i === data.page);
      else if (Math.abs(i - data.page) === 2) html += `<button disabled>…</button>`;
    }
    html += btn(data.page + 1, '›', false, data.page === data.pages);
    $('#pager').innerHTML = html;
    $$('#pager button[data-page]').forEach((b) => b.addEventListener('click', () => {
      go('/catalog?' + new URLSearchParams({ ...q, page: b.dataset.page }));
    }));
  }
});

// ---------------------------------------------------------------------------
// Барааны дэлгэрэнгүй
// ---------------------------------------------------------------------------
route('/product/:id', async (app, params) => {
  app.innerHTML = `<div class="wrap" style="padding-block:40px">${skeletonGrid(2)}</div>`;
  const { product: p, reviews, related } = await api('/api/products/' + params.id);

  const off = p.compare_price && p.compare_price > p.price
    ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const fav = store.favs.includes(p.id);

  app.innerHTML = `
  ${crumbs([{ label: 'Нүүр', href: '/' }, { label: 'Каталог', href: '/catalog' },
    { label: p.category_name, href: '/catalog?category=' + p.category_slug }, { label: p.name }])}

  <div class="wrap" style="padding-bottom:50px">
    <div class="pdp">
      <div class="pdp-media">
        <div class="pdp-main">
          <img id="pdpImg" src="${p.image}" alt="${esc(p.name)}" width="600" height="600">
          <button class="card-fav${fav ? ' on' : ''}" data-fav="${p.id}" aria-label="Хадгалах"
            style="top:14px;right:14px;width:40px;height:40px">${icon(fav ? 'heart-fill' : 'heart', 19)}</button>
        </div>
        <div class="pdp-thumbs">
          ${(p.images && p.images.length > 1)
            // Олон жинхэнэ зурагтай бол галерей
            ? p.images.map((im, i) => `<button class="${i === 0 ? 'on' : ''}" data-img="${esc(im.url)}"><img src="${esc(im.url)}" alt=""></button>`).join('')
            : `<button class="on"><img src="${p.image}" alt=""></button>
          ${related.slice(0, 3).map((r) => `<button data-goto="${r.id}"><img src="${r.image}" alt="${esc(r.name)}"></button>`).join('')}`}
        </div>
      </div>

      <div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <span class="card-brand">${esc(p.brand)}</span>
          ${p.badge ? `<span class="chip chip-gold">${esc(p.badge)}</span>` : ''}
          <span class="chip">SKU: ${esc(p.sku)}</span>
        </div>
        <h1 class="pdp-title">${esc(p.name)}</h1>
        <div class="row" style="gap:10px">
          ${stars(p.rating)}
          <b>${Number(p.rating).toFixed(1)}</b>
          <span class="muted">· ${reviews.length} сэтгэгдэл · ${p.sold} зарагдсан</span>
        </div>

        <p style="margin-top:16px;font-size:1.02rem;color:var(--ink-2)">${esc(p.short)}</p>

        <div class="pdp-price">
          <span class="price">${mnt(p.price)}</span>
          ${off ? `<span class="price-old">${mnt(p.compare_price)}</span><span class="price-off">−${off}% хэмнэлт</span>` : ''}
        </div>

        <div class="stock-line" style="margin-bottom:20px;font-size:.9rem">
          <span class="dot ${p.stock === 0 ? 'out' : p.stock <= 10 ? 'low' : ''}"></span>
          ${p.stock === 0 ? '<b style="color:var(--danger)">Түр дууссан</b>'
            : p.stock <= 10 ? `<b style="color:var(--warn)">Яараарай — үлдсэн ${p.stock}ш</b>`
            : `<b style="color:var(--ok)">Бэлэн байгаа (${p.stock}ш)</b>`}
        </div>

        <div class="pdp-actions">
          <div class="row" style="gap:12px;flex-wrap:wrap;margin-bottom:12px">
            <div class="qty">
              <button id="qMinus" aria-label="Хасах">−</button>
              <input id="qInput" type="number" value="1" min="1" max="${Math.max(1, p.stock)}" aria-label="Тоо ширхэг">
              <button id="qPlus" aria-label="Нэмэх">+</button>
            </div>
            <button class="btn btn-lg" id="addBtn" ${p.stock === 0 ? 'disabled' : ''} style="flex:1;min-width:190px">
              ${icon('cart', 18)} Сагсанд нэмэх
            </button>
          </div>
          <button class="btn btn-lg btn-dark btn-block" id="buyNow" ${p.stock === 0 ? 'disabled' : ''}>Шууд худалдан авах</button>
        </div>

        <div class="spec">
          <div><dt>Ангилал</dt><dd style="margin:0">${esc(p.category_name)}</dd></div>
          ${p.volume ? `<div><dt>Хэмжээ</dt><dd style="margin:0">${esc(p.volume)}</dd></div>` : ''}
          <div><dt>Брэнд</dt><dd style="margin:0">${esc(p.brand)}</dd></div>
          <div><dt>Хүргэлт</dt><dd style="margin:0">УБ хотод 24 цагт · ${mnt(store.settings.delivery_fee)} (${mnt(store.settings.free_delivery_from)}-с дээш үнэгүй)</dd></div>
        </div>

        <div class="panel" style="background:var(--bg-2);border:none;padding:16px 18px;display:flex;gap:14px;align-items:center">
          ${icon('shield', 24)}
          <div style="font-size:.88rem"><b>Жинхэнэ бүтээгдэхүүний баталгаа.</b><br>
          <span class="muted">Задлаагүй бол 7 хоногийн дотор буцаах боломжтой.</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="wrap" style="padding-bottom:60px">
    <div class="tabs">
      <button class="tab on" data-tab="desc">Дэлгэрэнгүй</button>
      <button class="tab" data-tab="howto">Хэрэглэх заавар</button>
      <button class="tab" data-tab="ing">Найрлага</button>
      <button class="tab" data-tab="rev">Сэтгэгдэл (${reviews.length})</button>
    </div>

    <div id="tab-desc" class="tabpane">
      <div class="panel"><p style="margin:0;font-size:1rem;line-height:1.75">${esc(p.description)}</p></div>
    </div>
    <div id="tab-howto" class="tabpane" hidden>
      <div class="panel"><p style="margin:0;font-size:1rem;line-height:1.75">${esc(p.howto) || 'Мэдээлэл байхгүй.'}</p></div>
    </div>
    <div id="tab-ing" class="tabpane" hidden>
      <div class="panel"><p style="margin:0;font-family:var(--font);color:var(--ink-2)">${esc(p.ingredients) || 'Мэдээлэл байхгүй.'}</p>
      <p class="muted" style="font-size:.84rem;margin:14px 0 0">Мэдрэг арьстай хүмүүс эхлээд бага хэсэгт туршиж үзнэ үү.</p></div>
    </div>
    <div id="tab-rev" class="tabpane" hidden>
      <div class="panel">
        ${reviews.length ? reviews.map((r) => `
          <div class="review">
            <div class="row" style="align-items:flex-start">
              <span class="avatar">${esc(r.name.trim()[0] || '?')}</span>
              <div style="flex:1">
                <div class="row-between" style="margin-bottom:2px">
                  <b>${esc(r.name)}</b>
                  <span class="muted" style="font-size:.8rem">${dateMn(r.created_at)}</span>
                </div>
                ${stars(r.rating)}
                <p style="margin:6px 0 0">${esc(r.comment)}</p>
              </div>
            </div>
          </div>`).join('') : '<p class="muted">Одоогоор сэтгэгдэл алга. Хамгийн эхэнд үлдээгээрэй!</p>'}

        <form id="revForm" style="margin-top:24px;border-top:1px solid var(--line);padding-top:22px">
          <h3 style="margin-bottom:14px">Сэтгэгдэл үлдээх</h3>
          <div class="grid-2">
            <div class="field"><label>Таны нэр</label><input name="name" value="${esc(store.user?.name || '')}" placeholder="Нэр" required></div>
            <div class="field"><label>Үнэлгээ</label>
              <select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${'★'.repeat(n)} ${n}</option>`).join('')}</select>
            </div>
          </div>
          <div class="field"><label>Сэтгэгдэл</label><textarea name="comment" placeholder="Бүтээгдэхүүний талаарх сэтгэгдлээ бичнэ үү…" required></textarea></div>
          <button class="btn" type="submit">Илгээх</button>
        </form>
      </div>
    </div>
  </div>

  ${related.length ? `
  <section style="background:var(--surface);border-top:1px solid var(--line)">
    <div class="wrap">
      <div class="sec-head"><div><div class="sec-kicker">Санал болгох</div><h2>Төстэй бүтээгдэхүүн</h2></div></div>
      <div class="prod-grid">${related.map(productCard).join('')}</div>
    </div>
  </section>` : ''}`;

  document.title = `${p.name} — Khishgee's Salon`;

  // Утсанд: дэлгэцийн доод хэсэгт байнга харагдах үйлдлийн мөр
  const bar = document.createElement('div');
  bar.className = 'pdp-bar';
  bar.innerHTML = p.stock === 0
    ? `<button class="btn btn-block" disabled>Түр дууссан</button>`
    : `<div class="qty">
         <button id="qMinusM" aria-label="Хасах">−</button>
         <input id="qInputM" type="number" value="1" min="1" max="${p.stock}" aria-label="Тоо ширхэг">
         <button id="qPlusM" aria-label="Нэмэх">+</button>
       </div>
       <button class="btn" id="addBtnM">${icon('cart', 17)} Сагсанд · <span id="barTotal">${mnt(p.price)}</span></button>`;
  app.append(bar);
  document.body.classList.add('has-pdp-bar');

  // Ширхгийн тоог хоёр удирдлагын хооронд синк болгоно
  let qty = 1;
  const maxQty = Math.max(1, p.stock);
  const syncQty = (v) => {
    qty = Math.min(maxQty, Math.max(1, v || 1));
    const a = $('#qInput'), b = $('#qInputM'), t = $('#barTotal');
    if (a) a.value = qty;
    if (b) b.value = qty;
    if (t) t.textContent = mnt(p.price * qty);
  };

  $('#qMinus').addEventListener('click', () => syncQty(qty - 1));
  $('#qPlus').addEventListener('click', () => syncQty(qty + 1));
  $('#qInput').addEventListener('change', (e) => syncQty(+e.target.value));
  $('#qMinusM')?.addEventListener('click', () => syncQty(qty - 1));
  $('#qPlusM')?.addEventListener('click', () => syncQty(qty + 1));
  $('#qInputM')?.addEventListener('change', (e) => syncQty(+e.target.value));

  $('#addBtn').addEventListener('click', () => addToCart(p, qty));
  $('#addBtnM')?.addEventListener('click', () => addToCart(p, qty));
  $('#buyNow').addEventListener('click', () => { addToCart(p, qty); go('/checkout'); });

  $$('.pdp-thumbs button[data-goto]').forEach((b) =>
    b.addEventListener('click', () => go('/product/' + b.dataset.goto)));

  // Галерейн зураг солих
  $$('.pdp-thumbs button[data-img]').forEach((b) =>
    b.addEventListener('click', () => {
      $$('.pdp-thumbs button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      $('#pdpImg').src = b.dataset.img;
    }));

  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.remove('on'));
    t.classList.add('on');
    $$('.tabpane').forEach((pane) => { pane.hidden = pane.id !== 'tab-' + t.dataset.tab; });
  }));

  $('#revForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api(`/api/products/${p.id}/reviews`, {
        method: 'POST',
        body: { name: f.get('name'), rating: +f.get('rating'), comment: f.get('comment') },
      });
      toast('Сэтгэгдэл нэмэгдлээ. Баярлалаа!', 'ok');
      render();
    } catch (err) { toast(err.message, 'err'); }
  });
});

// ---------------------------------------------------------------------------
// Сагсны хуудас
// ---------------------------------------------------------------------------
route('/cart', async (app) => {
  const sub = cartSubtotal();
  app.innerHTML = `
  ${crumbs([{ label: 'Нүүр', href: '/' }, { label: 'Сагс' }])}
  <div class="wrap" style="padding-bottom:60px">
    <h1 style="margin-bottom:24px">Миний сагс</h1>
    ${store.cart.length === 0 ? `
      <div class="empty" style="padding-block:70px">
        <div class="empty-ico">${icon('cart', 32)}</div>
        <h3>Сагс хоосон байна</h3>
        <p>Танд таалагдах бүтээгдэхүүнийг каталогоос сонгоно уу.</p>
        <a class="btn" href="/catalog" data-link>Дэлгүүр хэсэх</a>
      </div>` : `
      <div style="display:grid;grid-template-columns:1fr 350px;gap:26px;align-items:start" class="cart-layout">
        <div class="panel">
          ${store.cart.map((i) => `
            <div class="cart-item">
              <a href="/product/${i.id}" data-link><img src="${i.image}" alt="${esc(i.name)}"></a>
              <div>
                <a class="name" href="/product/${i.id}" data-link>${esc(i.name)}</a>
                <div class="muted" style="font-size:.84rem;margin:4px 0 8px">${mnt(i.price)} × ${i.qty}</div>
                <div class="qty-mini">
                  <button data-dec="${i.id}">−</button><span>${i.qty}</span><button data-inc="${i.id}">+</button>
                </div>
              </div>
              <div style="text-align:right">
                <div class="price" style="font-size:1.05rem">${mnt(i.price * i.qty)}</div>
                <button class="btn btn-ghost btn-sm" data-rm="${i.id}" style="color:var(--danger);padding:4px 8px;margin-top:6px">Хасах</button>
              </div>
            </div>`).join('')}
        </div>
        <div class="panel" style="position:sticky;top:150px">
          <h3 style="margin-bottom:14px">Захиалгын дүн</h3>
          <div class="sum-row"><span>Барааны дүн</span><b>${mnt(sub)}</b></div>
          <div class="sum-row"><span>Хүргэлт</span><b>${deliveryFee(sub) === 0 ? '<span style="color:var(--ok)">Үнэгүй</span>' : mnt(deliveryFee(sub))}</b></div>
          ${sub < Number(store.settings.free_delivery_from) ? `
            <div class="chip chip-gold" style="width:100%;justify-content:center;margin:10px 0">
              ${mnt(Number(store.settings.free_delivery_from) - sub)} нэмбэл хүргэлт үнэгүй
            </div>` : ''}
          <div class="sum-row total"><span>Нийт</span><span class="price">${mnt(sub + deliveryFee(sub))}</span></div>
          <a class="btn btn-lg btn-block" href="/checkout" data-link style="margin-top:16px">Захиалга үргэлжлүүлэх</a>
          <a class="btn btn-ghost btn-block" href="/catalog" data-link style="margin-top:8px">Үргэлжлүүлэн худалдан авах</a>
        </div>
      </div>`}
  </div>`;

  $$('[data-inc]').forEach((b) => b.addEventListener('click', () => {
    const it = store.cart.find((x) => x.id === +b.dataset.inc); it.qty = Math.min(99, it.qty + 1); saveCart(); render();
  }));
  $$('[data-dec]').forEach((b) => b.addEventListener('click', () => {
    const it = store.cart.find((x) => x.id === +b.dataset.dec);
    it.qty > 1 ? it.qty-- : store.cart.splice(store.cart.indexOf(it), 1);
    saveCart(); render();
  }));
  $$('[data-rm]').forEach((b) => b.addEventListener('click', () => {
    store.cart = store.cart.filter((x) => x.id !== +b.dataset.rm); saveCart(); render();
  }));
});

// ---------------------------------------------------------------------------
// Захиалга баталгаажуулах
// ---------------------------------------------------------------------------
route('/checkout', async (app) => {
  if (!store.cart.length) return go('/cart', true);

  let method = 'ub';
  let promo = store.promo;

  const draw = () => {
    const sub = cartSubtotal();
    const fee = deliveryFee(sub, method);
    const disc = promo?.discount || 0;
    const grand = Math.max(0, sub + fee - disc);

    const barTotal = $('#cbTotal');
    if (barTotal) barTotal.textContent = mnt(grand);
    const togglePrice = $('#coTogglePrice');
    if (togglePrice) togglePrice.textContent = mnt(grand);
    const mItems = $('#coMobileItems');
    if (mItems) {
      mItems.innerHTML = store.cart.map((i) => `
        <div class="row" style="gap:11px;padding:8px 0;border-bottom:1px solid var(--line-2)">
          <img src="${i.image}" alt="" style="width:46px;height:46px;border-radius:9px;background:var(--bg-2)">
          <div style="flex:1;font-size:.85rem;line-height:1.35">${esc(i.name)}<br>
            <span class="muted">${i.qty} ш × ${mnt(i.price)}</span></div>
          <b style="font-size:.88rem">${mnt(i.price * i.qty)}</b>
        </div>`).join('') + `
        <div style="margin-top:10px">
          <div class="sum-row"><span>Барааны дүн</span><b>${mnt(sub)}</b></div>
          <div class="sum-row"><span>Хүргэлт</span><b>${fee === 0 ? '<span style="color:var(--ok)">Үнэгүй</span>' : mnt(fee)}</b></div>
          ${disc ? `<div class="sum-row" style="color:var(--ok)"><span>Хөнгөлөлт</span><b>−${mnt(disc)}</b></div>` : ''}
        </div>`;
    }

    $('#coSummary').innerHTML = `
      ${store.cart.map((i) => `
        <div class="row" style="gap:11px;padding:9px 0;border-bottom:1px solid var(--line-2)">
          <img src="${i.image}" alt="" style="width:52px;height:52px;border-radius:10px;background:var(--bg-2)">
          <div style="flex:1;font-size:.87rem;line-height:1.35">${esc(i.name)}<br><span class="muted">${i.qty} ш × ${mnt(i.price)}</span></div>
          <b style="font-size:.9rem">${mnt(i.price * i.qty)}</b>
        </div>`).join('')}
      <div style="margin-top:14px">
        <div class="sum-row"><span>Барааны дүн</span><b>${mnt(sub)}</b></div>
        <div class="sum-row"><span>Хүргэлт (${DELIVERY_LABEL[method]})</span><b>${fee === 0 ? '<span style="color:var(--ok)">Үнэгүй</span>' : mnt(fee)}</b></div>
        ${disc ? `<div class="sum-row" style="color:var(--ok)"><span>Хөнгөлөлт (${esc(promo.code)})</span><b>−${mnt(disc)}</b></div>` : ''}
        <div class="sum-row total"><span>Төлөх дүн</span><span class="price">${mnt(Math.max(0, sub + fee - disc))}</span></div>
      </div>`;
  };

  app.innerHTML = `
  ${crumbs([{ label: 'Нүүр', href: '/' }, { label: 'Сагс', href: '/cart' }, { label: 'Захиалга' }])}
  <div class="wrap" style="padding-bottom:60px">
    <h1 style="margin-bottom:18px">Захиалга баталгаажуулах</h1>
    <form id="coForm" style="display:grid;grid-template-columns:1fr 370px;gap:26px;align-items:start" class="cart-layout">
      <div>
        <!-- Утсанд: захиалгын хураангуйг дээр нь эвхэгддэг байдлаар -->
        <button type="button" class="co-toggle m-only" id="coToggle" aria-expanded="false">
          <span>${icon('cart', 17)} Таны захиалга (${cartQty()} бараа)</span>
          <span class="row" style="gap:8px"><b id="coTogglePrice"></b><span class="arw">${icon('chev', 15)}</span></span>
        </button>
        <div class="panel m-only" id="coMobileItems" hidden style="margin-bottom:14px"></div>

        <div class="panel">
          <div class="panel-title"><span class="step-n">1</span> Хүлээн авагчийн мэдээлэл</div>
          <div class="grid-2">
            <div class="field"><label>Овог нэр <span class="req">*</span></label>
              <input name="name" required autocomplete="name" placeholder="Ж: Б. Сарантуяа" value="${esc(store.user?.name || '')}"></div>
            <div class="field"><label>Утасны дугаар <span class="req">*</span></label>
              <input name="phone" required type="tel" inputmode="numeric" pattern="[0-9]{8}" maxlength="8"
                autocomplete="tel-national" placeholder="99112233" value="${esc(store.user?.phone || '')}">
              <span class="hint">8 оронтой дугаар</span></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title"><span class="step-n">2</span> Хүргэлтийн сонголт</div>
          <div class="opt-list" id="delivOpts">
            <label class="opt-card on"><input type="radio" name="delivery_method" value="ub" checked>
              <span><b>Улаанбаатар хотод хүргэх</b><span>24 цагийн дотор · ${mnt(store.settings.delivery_fee)} (${mnt(store.settings.free_delivery_from)}-с дээш үнэгүй)</span></span></label>
            <label class="opt-card"><input type="radio" name="delivery_method" value="pickup">
              <span><b>Дэлгүүрээс өөрөө авах</b><span>${esc(store.settings.address)} · Үнэгүй</span></span></label>
            <label class="opt-card"><input type="radio" name="delivery_method" value="country">
              <span><b>Орон нутаг руу илгээх</b><span>Унаагаар 1-3 хоног · ${mnt(store.settings.country_delivery_fee)}</span></span></label>
          </div>

          <div id="addrFields" style="margin-top:18px">
            <div class="grid-2">
              <div class="field"><label>Дүүрэг / Аймаг <span class="req">*</span></label>
                <select name="district" required>
                  <option value="">— Дүүрэг сонгоно уу —</option>
                  ${DISTRICTS.map((d) => `<option ${store.user?.district?.startsWith(d) ? 'selected' : ''}>${d}</option>`).join('')}
                  <option>Орон нутаг</option>
                </select></div>
              <div class="field"><label>Хороо / Сум</label><input name="khoroo" placeholder="Ж: 5-р хороо"></div>
            </div>
            <div class="field"><label>Дэлгэрэнгүй хаяг <span class="req">*</span></label>
              <input name="address" autocomplete="street-address" placeholder="Байр, орц, давхар, тоот" value="${esc(store.user?.address || '')}"></div>
          </div>

          <div class="field"><label>Нэмэлт тайлбар</label>
            <textarea name="note" placeholder="Жишээ: Ажлын цагаар залгаарай, орцны код 1234…"></textarea></div>
        </div>

        <div class="panel">
          <div class="panel-title"><span class="step-n">3</span> Төлбөрийн хэлбэр</div>
          <div class="opt-list" id="payOpts">
            <label class="opt-card on"><input type="radio" name="payment_method" value="cash" checked>
              <span><b>Бэлнээр төлөх</b><span>Хүргэлтийн үед жолоочид өгнө</span></span></label>
            <label class="opt-card"><input type="radio" name="payment_method" value="transfer">
              <span><b>Дансаар шилжүүлэх</b><span>${esc(store.settings.bank_account)}</span></span></label>
            <label class="opt-card"><input type="radio" name="payment_method" value="qpay">
              <span><b>QPay / картаар</b><span>Захиалга үүссэний дараа QR илгээнэ</span></span></label>
          </div>
        </div>
      </div>

      <div class="panel co-side" style="position:sticky;top:150px">
        <h3 style="margin-bottom:14px" class="d-only">Таны захиалга</h3>
        <h3 style="margin-bottom:14px" class="m-only">Урамшуулал</h3>
        <div id="coSummary" class="d-only"></div>

        <div class="field" style="margin-top:16px">
          <label>Урамшууллын код</label>
          <div class="row" style="gap:8px">
            <input id="promoInput" placeholder="SHINE10" value="${esc(promo?.code || '')}" style="flex:1;padding:12px 14px;border:1px solid var(--line);border-radius:8px">
            <button class="btn btn-outline" type="button" id="promoBtn">Шалгах</button>
          </div>
          <span class="hint" id="promoMsg">${promo ? `✔ ${esc(promo.note || '')}` : 'Код байвал энд оруулна уу'}</span>
        </div>

        <button class="btn btn-lg btn-block co-submit-desktop" type="submit" id="placeBtn" style="margin-top:8px">Захиалга баталгаажуулах</button>
        <p class="muted" style="font-size:.78rem;margin:12px 0 0;text-align:center">Захиалга өгснөөр та үйлчилгээний нөхцөлийг зөвшөөрч байна.</p>
      </div>
    </form>
  </div>`;

  // Утасны доод мөр — нийт дүн + илгээх
  const bar = document.createElement('div');
  bar.className = 'checkout-bar';
  bar.innerHTML = `
    <div class="cb-total"><small>Төлөх дүн</small><b id="cbTotal">—</b></div>
    <button class="btn" type="button" id="placeBtnM">Захиалах</button>`;
  app.append(bar);
  document.body.classList.add('has-checkout-bar');

  $('#coToggle').addEventListener('click', (e) => {
    const open = $('#coMobileItems').hidden;
    $('#coMobileItems').hidden = !open;
    e.currentTarget.classList.toggle('open', open);
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  $('#placeBtnM').addEventListener('click', () => $('#coForm').requestSubmit());

  draw();

  const syncCards = (name) => $$(`input[name="${name}"]`).forEach((r) =>
    r.closest('.opt-card').classList.toggle('on', r.checked));

  $$('input[name="delivery_method"]').forEach((r) => r.addEventListener('change', () => {
    method = r.value;
    syncCards('delivery_method');
    $('#addrFields').style.display = method === 'pickup' ? 'none' : '';
    draw();
  }));
  $$('input[name="payment_method"]').forEach((r) =>
    r.addEventListener('change', () => syncCards('payment_method')));

  $('#promoBtn').addEventListener('click', async () => {
    const code = $('#promoInput').value.trim();
    if (!code) { promo = null; store.promo = null; localStorage.removeItem('ks_promo'); $('#promoMsg').textContent = ''; draw(); return; }
    try {
      const r = await api('/api/promo/check', { method: 'POST', body: { code, subtotal: cartSubtotal() } });
      promo = { code: r.code, discount: r.discount, note: r.note };
      store.promo = promo;
      localStorage.setItem('ks_promo', JSON.stringify(promo));
      $('#promoMsg').innerHTML = `<span style="color:var(--ok)">✔ ${esc(r.note)} — ${mnt(r.discount)} хөнгөллөө</span>`;
      draw();
    } catch (err) {
      promo = null;
      $('#promoMsg').innerHTML = `<span style="color:var(--danger)">${esc(err.message)}</span>`;
      draw();
    }
  });

  $('#coForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const phone = String(f.get('phone') || '').replace(/\D/g, '');
    if (phone.length !== 8) return toast('Утасны дугаар 8 оронтой байх ёстой', 'err');

    const khoroo = String(f.get('khoroo') || '').trim();
    const address = [khoroo, String(f.get('address') || '').trim()].filter(Boolean).join(', ');
    if (method !== 'pickup' && address.length < 4) return toast('Хүргэлтийн хаягаа бүрэн оруулна уу', 'err');

    const btns = [$('#placeBtn'), $('#placeBtnM')].filter(Boolean);
    btns.forEach((b) => { b.disabled = true; b.textContent = 'Илгээж байна…'; });
    try {
      const res = await api('/api/orders', {
        method: 'POST',
        body: {
          name: f.get('name'), phone,
          district: f.get('district'),
          address: method === 'pickup' ? 'Дэлгүүрээс авна' : address,
          note: f.get('note'),
          delivery_method: method,
          payment_method: f.get('payment_method'),
          promo_code: promo?.code || '',
          items: store.cart.map((i) => ({ id: i.id, qty: i.qty })),
        },
      });
      rememberOrder(res.code, phone);
      store.cart = []; saveCart();
      store.promo = null; localStorage.removeItem('ks_promo');
      go('/order/' + res.code + '?new=1');
    } catch (err) {
      toast(err.message, 'err');
      btns.forEach((b, i) => { b.disabled = false; b.textContent = i ? 'Захиалах' : 'Захиалга баталгаажуулах'; });
    }
  });
});

// ---------------------------------------------------------------------------
// Захиалгын дэлгэрэнгүй / хяналт
// ---------------------------------------------------------------------------
function orderStepper(status) {
  if (status === 'cancelled') {
    return `<div class="panel" style="background:var(--danger-100);border-color:#f2ccc8;text-align:center">
      <b style="color:var(--danger)">Энэ захиалга цуцлагдсан байна.</b>
      <p class="muted" style="margin:6px 0 0;font-size:.88rem">Дэлгэрэнгүй мэдээлэл авах бол ${esc(store.settings.phone)} дугаарт холбогдоно уу.</p></div>`;
  }
  const steps = [['new', 'Хүлээн авсан'], ['confirmed', 'Баталгаажсан'], ['packed', 'Савлагдсан'],
    ['shipping', 'Хүргэлтэд'], ['delivered', 'Хүргэгдсэн']];
  const cur = STATUS_MAP[status]?.step ?? 0;
  return `<div class="stepper">${steps.map(([k, l], i) => `
    <div class="step ${i < cur ? 'done' : i === cur ? 'on' : ''}">
      <div class="step-dot">${i < cur ? '✓' : i + 1}</div>
      <small>${l}</small>
    </div>`).join('')}</div>`;
}

function orderDetail(o, isNew) {
  const st = STATUS_MAP[o.status] || STATUS_MAP.new;
  return `
  <div class="wrap" style="padding-bottom:60px;max-width:860px">
    ${isNew ? `
      <div class="panel center" style="background:linear-gradient(135deg,var(--ok-100),#f2fbf6);border-color:#cfe9dc;margin-bottom:20px">
        <div class="cat-ico" style="background:var(--ok);color:#fff;margin-bottom:12px">${icon('check', 28)}</div>
        <h2 style="margin-bottom:8px">Захиалга амжилттай!</h2>
        <p class="muted" style="margin:0">Манай ажилтан удахгүй <b>${esc(o.phone)}</b> дугаарт холбогдож захиалгыг баталгаажуулна.</p>
      </div>` : ''}

    <div class="panel">
      <div class="row-between" style="margin-bottom:6px">
        <div>
          <div class="sec-kicker" style="margin-bottom:2px">Захиалгын дугаар</div>
          <h2 style="font-size:1.7rem">${esc(o.code)}</h2>
        </div>
        <span class="chip ${st.chip}" style="font-size:.88rem;padding:8px 16px">${st.label}</span>
      </div>
      <p class="muted" style="font-size:.88rem">${dateTimeMn(o.created_at)} · ${DELIVERY_LABEL[o.delivery_method]} · ${PAYMENT_LABEL[o.payment_method]}</p>
      ${orderStepper(o.status)}
    </div>

    <div class="panel">
      <h3 style="margin-bottom:14px">Захиалсан бараа</h3>
      ${o.items.map((i) => `
        <div class="cart-item" style="grid-template-columns:60px 1fr auto">
          <img src="/img/p/${i.product_id}.svg" alt="" style="width:60px;height:60px">
          <div><a class="name" href="/product/${i.product_id}" data-link>${esc(i.name)}</a>
            <div class="muted" style="font-size:.83rem">${esc(i.sku)} · ${mnt(i.price)} × ${i.qty}</div></div>
          <b>${mnt(i.price * i.qty)}</b>
        </div>`).join('')}
      <div style="margin-top:14px">
        <div class="sum-row"><span>Барааны дүн</span><b>${mnt(o.subtotal)}</b></div>
        <div class="sum-row"><span>Хүргэлт</span><b>${o.delivery_fee ? mnt(o.delivery_fee) : 'Үнэгүй'}</b></div>
        ${o.discount ? `<div class="sum-row" style="color:var(--ok)"><span>Хөнгөлөлт ${esc(o.promo_code)}</span><b>−${mnt(o.discount)}</b></div>` : ''}
        <div class="sum-row total"><span>Нийт</span><span class="price">${mnt(o.total)}</span></div>
      </div>
    </div>

    <div class="panel">
      <h3 style="margin-bottom:14px">Хүргэлтийн мэдээлэл</h3>
      <div class="spec" style="margin:0">
        <div><dt>Хүлээн авагч</dt><dd style="margin:0">${esc(o.customer_name)}</dd></div>
        <div><dt>Утас</dt><dd style="margin:0">${esc(o.phone)}</dd></div>
        <div><dt>Хаяг</dt><dd style="margin:0">${esc(o.district)} ${esc(o.address)}</dd></div>
        ${o.note ? `<div><dt>Тайлбар</dt><dd style="margin:0">${esc(o.note)}</dd></div>` : ''}
      </div>
      ${o.payment_method === 'transfer' ? `
        <div class="panel" style="background:var(--gold-100);border:none;margin-top:16px">
          <b>Шилжүүлэх данс</b><br>${esc(store.settings.bank_account)}<br>
          <span class="muted" style="font-size:.86rem">Гүйлгээний утга дээр <b>${esc(o.code)}</b> гэж бичнэ үү.</span>
        </div>` : ''}
    </div>

    ${o.payment_method === 'qpay' ? qpayPanel(o) : ''}

    <div class="row" style="justify-content:center;margin-top:22px;gap:10px">
      <a class="btn btn-outline" href="/catalog" data-link>Дэлгүүр хэсэх</a>
      <a class="btn btn-ghost" href="tel:${esc(store.settings.phone)}">${icon('phone', 16)} ${esc(store.settings.phone)}</a>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// QPay төлбөр
// ---------------------------------------------------------------------------
function qpayPanel(o) {
  if (o.payment_status === 'paid' || o.status === 'cancelled') {
    return o.payment_status === 'paid' ? `
      <div class="panel" style="background:var(--ok-100);border-color:#cfe9dc">
        <div class="row" style="gap:12px;align-items:center">
          <div class="cat-ico" style="background:var(--ok);color:#fff;width:44px;height:44px;flex:none">${icon('check', 22)}</div>
          <div><b>Төлбөр төлөгдсөн</b>
            <p class="muted" style="margin:2px 0 0;font-size:.88rem">${mnt(o.total)} · ${o.paid_at ? dateTimeMn(o.paid_at) : 'QPay'}</p></div>
        </div>
      </div>` : '';
  }
  return `
    <div class="panel" id="qpayPanel">
      <div class="row-between" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">QPay-ээр төлөх</h3>
        <span class="chip chip-gold">Төлөгдөөгүй · ${mnt(o.total)}</span>
      </div>
      <div id="qpayBody" class="center" style="padding:20px 0">
        <div class="sk" style="width:220px;height:220px;margin:0 auto;border-radius:16px"></div>
        <p class="muted" style="margin-top:12px;font-size:.88rem">Нэхэмжлэх үүсгэж байна…</p>
      </div>
    </div>`;
}

async function mountQpay(order) {
  const body = $('#qpayBody');
  if (!body) return;
  const phone = phoneForOrder(order.code);
  const qs = phone ? `?phone=${encodeURIComponent(phone)}` : '';

  let payment;
  try {
    const r = await api(`/api/payments/qpay/${encodeURIComponent(order.code)}`, { method: 'POST', body: { phone } });
    payment = r.payment;
  } catch (err) {
    body.innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>
      <button class="btn btn-outline" id="qpayRetry">Дахин оролдох</button>`;
    $('#qpayRetry').addEventListener('click', () => { qpayPanel(order); mountQpay(order); });
    return;
  }

  const isMock = payment.mode === 'mock';
  const bankLinks = (payment.urls || []).slice(0, 8);
  body.innerHTML = `
    <div class="qpay-qr">${payment.qr_svg || ''}</div>
    <p style="margin:14px 0 4px;font-weight:600">${isMock ? 'Туршилтын QR' : 'Банкныхаа аппаар уншуулна уу'}</p>
    <p class="muted" style="font-size:.86rem;margin:0 0 14px">
      ${isMock
        ? 'QPay түлхүүр тохируулаагүй тул энэ бол дотоод туршилтын горим. Доорх товчоор төлөгдсөн мэт болгож болно.'
        : 'Khan Bank, TDB, Golomt, Xac, State Bank, Most Money, SocialPay гэх мэт QPay дэмждэг дурын апп ашиглана.'}
    </p>
    ${payment.short_url && !isMock ? `<a class="btn btn-block" href="${esc(payment.short_url)}" target="_blank" rel="noopener" style="margin-bottom:10px">Утсан дээрээ QPay нээх</a>` : ''}
    ${bankLinks.length ? `<div class="qpay-banks">${bankLinks.map((u) => `
      <a href="${esc(u.link)}" title="${esc(u.description || u.name)}">
        ${u.logo ? `<img src="${esc(u.logo)}" alt="${esc(u.name)}">` : `<span>${esc(u.name)}</span>`}
      </a>`).join('')}</div>` : ''}
    <div class="row" style="justify-content:center;gap:10px;margin-top:8px;flex-wrap:wrap">
      <button class="btn btn-outline" id="qpayCheck">${icon('spark', 16)} Төлбөр шалгах</button>
      ${isMock ? `<button class="btn btn-ghost" id="qpaySim">Төлсөн мэт болгох (туршилт)</button>` : ''}
    </div>
    <p class="muted" id="qpayHint" style="font-size:.8rem;margin:12px 0 0">Төлбөр орсны дараа энэ хуудас автоматаар шинэчлэгдэнэ.</p>`;

  let stopped = false;
  const onPaid = () => {
    stopped = true;
    toast('Төлбөр амжилттай хүлээн авлаа!', 'ok');
    render();
  };
  const check = async (loud = false) => {
    try {
      const r = await api(`/api/payments/qpay/${encodeURIComponent(order.code)}${qs}`);
      if (r.order_status === 'paid' || r.payment?.status === 'paid') return onPaid();
      if (loud) toast('Төлбөр хараахан ороогүй байна', '');
    } catch (err) {
      if (loud) toast(err.message, 'err');
    }
  };

  $('#qpayCheck').addEventListener('click', () => check(true));
  $('#qpaySim')?.addEventListener('click', async () => {
    try {
      await api(`/api/payments/qpay/${encodeURIComponent(order.code)}/simulate`, { method: 'POST', body: { phone } });
      onPaid();
    } catch (err) { toast(err.message, 'err'); }
  });

  // 5 секунд тутам шалгана; хуудаснаас гарахад зогсоно
  const timer = setInterval(() => {
    if (stopped || !document.body.contains(body)) { clearInterval(timer); return; }
    check(false);
  }, 5000);
}

route('/order/:code', async (app, params, q) => {
  app.innerHTML = `<div class="wrap" style="padding-block:60px"><div class="sk" style="height:280px"></div></div>`;
  try {
    const phone = phoneForOrder(params.code);
    const { order } = await api(`/api/orders/track?code=${encodeURIComponent(params.code)}`
      + (phone ? `&phone=${encodeURIComponent(phone)}` : ''));
    app.innerHTML = crumbs([{ label: 'Нүүр', href: '/' }, { label: 'Захиалга ' + order.code }]) + orderDetail(order, q.new === '1');
    if (order.payment_method === 'qpay' && order.payment_status !== 'paid' && order.status !== 'cancelled') mountQpay(order);
  } catch {
    go('/track?code=' + encodeURIComponent(params.code), true);
  }
});

route('/track', async (app, _p, q) => {
  app.innerHTML = `
  ${crumbs([{ label: 'Нүүр', href: '/' }, { label: 'Захиалга шалгах' }])}
  <div class="wrap" style="padding-bottom:70px;max-width:560px">
    <div class="panel">
      <div class="center" style="margin-bottom:20px">
        <div class="cat-ico" style="margin:0 auto 12px">${icon('box', 26)}</div>
        <h1 style="font-size:1.6rem;margin-bottom:6px">Захиалгын явц шалгах</h1>
        <p class="muted" style="margin:0">Захиалгын дугаар болон утасны дугаараа оруулна уу.</p>
      </div>
      <form id="trackForm">
        <div class="field"><label>Захиалгын дугаар</label>
          <input name="code" placeholder="KS10012345" value="${esc(q.code || '')}" required></div>
        <div class="field"><label>Утасны дугаар</label>
          <input name="phone" inputmode="numeric" maxlength="8" placeholder="99112233" required></div>
        <button class="btn btn-lg btn-block" type="submit">Шалгах</button>
      </form>
      <p class="muted" style="font-size:.84rem;margin:16px 0 0;text-align:center">
        Дугаараа мартсан бол ${esc(store.settings.phone)} дугаарт залгана уу.</p>
    </div>
    <div id="recentOrders"></div>
    <div id="trackResult"></div>
  </div>`;

  const recent = myOrders();
  if (recent.length) {
    $('#recentOrders').innerHTML = `
      <div class="panel" style="margin-top:14px">
        <h3 style="font-size:1rem;margin-bottom:12px">Энэ утаснаас хийсэн захиалга</h3>
        ${recent.slice(0, 5).map((o) => `
          <a class="row-between" href="/order/${encodeURIComponent(o.code)}" data-link
             style="padding:11px 0;border-bottom:1px solid var(--line-2)">
            <span><b>${esc(o.code)}</b><br>
              <span class="muted" style="font-size:.8rem">${dateMn(new Date(o.at).toISOString())}</span></span>
            <span class="link-more">Үзэх ${icon('chev', 14)}</span>
          </a>`).join('')}
      </div>`;
  }

  $('#trackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const { order } = await api(`/api/orders/track?code=${encodeURIComponent(f.get('code'))}&phone=${encodeURIComponent(f.get('phone'))}`);
      // Утасны дугаарыг санаж үлдвэл QPay нэхэмжлэх үүсгэхэд ашиглана
      rememberOrder(order.code, String(f.get('phone') || '').replace(/\D/g, ''));
      $('#trackResult').innerHTML = orderDetail(order, false);
      if (order.payment_method === 'qpay' && order.payment_status !== 'paid' && order.status !== 'cancelled') mountQpay(order);
      $('#trackResult').scrollIntoView({ behavior: 'smooth' });
    } catch (err) { toast(err.message, 'err'); }
  });
});

// ---------------------------------------------------------------------------
// Хадгалсан
// ---------------------------------------------------------------------------
route('/wishlist', async (app) => {
  app.innerHTML = `${crumbs([{ label: 'Нүүр', href: '/' }, { label: 'Хадгалсан' }])}
    <div class="wrap" style="padding-bottom:60px"><h1 style="margin-bottom:22px">Хадгалсан бүтээгдэхүүн</h1>
    <div id="favGrid">${skeletonGrid(4)}</div></div>`;

  if (!store.favs.length) {
    $('#favGrid').innerHTML = `<div class="empty"><div class="empty-ico">${icon('heart', 30)}</div>
      <h3>Хоосон байна</h3><p>Таалагдсан бараагаа ♥ товчоор хадгалаарай.</p>
      <a class="btn" href="/catalog" data-link>Дэлгүүр хэсэх</a></div>`;
    return;
  }
  const list = await Promise.all(store.favs.map((id) =>
    api('/api/products/' + id).then((r) => r.product).catch(() => null)));
  const items = list.filter(Boolean);
  $('#favGrid').innerHTML = items.length
    ? `<div class="prod-grid">${items.map(productCard).join('')}</div>`
    : `<div class="empty"><h3>Хоосон байна</h3></div>`;
});

// ---------------------------------------------------------------------------
// Хэрэглэгчийн хэсэг
// ---------------------------------------------------------------------------
route('/account', async (app) => {
  if (!store.user) {
    app.innerHTML = `<div class="wrap"><div class="empty" style="padding-block:80px">
      <div class="empty-ico">${icon('user', 30)}</div>
      <h2>Нэвтэрч орно уу</h2><p>Захиалгын түүх, хаягаа хадгалахын тулд нэвтэрнэ үү.</p>
      <button class="btn" id="loginCta">Нэвтрэх / Бүртгүүлэх</button></div></div>`;
    $('#loginCta').addEventListener('click', () => openAuth());
    return;
  }

  app.innerHTML = `${crumbs([{ label: 'Нүүр', href: '/' }, { label: 'Миний хэсэг' }])}
    <div class="wrap" style="padding-bottom:60px"><div id="acc">${skeletonGrid(2)}</div></div>`;

  const { user, orders } = await api('/api/me');
  store.user = user;

  $('#acc').innerHTML = `
  <div style="display:grid;grid-template-columns:300px 1fr;gap:26px;align-items:start" class="cart-layout">
    <div class="panel">
      <div class="center" style="margin-bottom:18px">
        <span class="avatar" style="width:66px;height:66px;font-size:1.5rem;margin:0 auto 10px">${esc(user.name.trim()[0] || 'K')}</span>
        <h3>${esc(user.name)}</h3>
        <p class="muted" style="margin:2px 0 0;font-size:.88rem">${esc(user.phone)}</p>
      </div>
      <div class="sum-row"><span>Захиалга</span><b>${orders.length}</b></div>
      <div class="sum-row"><span>Нийт худалдан авалт</span><b>${mnt(orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0))}</b></div>
      <button class="btn btn-outline btn-block" id="logoutBtn" style="margin-top:16px">Гарах</button>
    </div>

    <div>
      <div class="panel">
        <h3 style="margin-bottom:16px">Хувийн мэдээлэл</h3>
        <form id="profForm">
          <div class="grid-2">
            <div class="field"><label>Нэр</label><input name="name" value="${esc(user.name)}"></div>
            <div class="field"><label>Имэйл</label><input name="email" type="email" value="${esc(user.email)}"></div>
            <div class="field"><label>Дүүрэг</label>
              <select name="district"><option value="">— сонгох —</option>
              ${DISTRICTS.map((d) => `<option ${user.district === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
            <div class="field"><label>Утас</label><input value="${esc(user.phone)}" disabled></div>
          </div>
          <div class="field"><label>Хаяг</label><input name="address" value="${esc(user.address)}" placeholder="Хороо, байр, тоот"></div>
          <button class="btn" type="submit">Хадгалах</button>
        </form>
      </div>

      <div class="panel">
        <h3 style="margin-bottom:16px">Захиалгын түүх</h3>
        ${orders.length ? `
        <div class="table-wrap" style="border:none">
          <table class="tbl">
            <thead><tr><th>Дугаар</th><th>Огноо</th><th>Бараа</th><th>Дүн</th><th>Төлөв</th><th></th></tr></thead>
            <tbody>${orders.map((o) => `
              <tr>
                <td><b>${esc(o.code)}</b></td>
                <td class="muted">${dateMn(o.created_at)}</td>
                <td class="muted">${o.items.length} нэр төрөл</td>
                <td><b>${mnt(o.total)}</b></td>
                <td><span class="chip ${(STATUS_MAP[o.status] || {}).chip}">${(STATUS_MAP[o.status] || {}).label}</span></td>
                <td><a class="btn btn-ghost btn-sm" href="/order/${o.code}" data-link>Үзэх</a></td>
              </tr>`).join('')}</tbody>
          </table>
        </div>` : `<p class="muted">Захиалга байхгүй байна. <a href="/catalog" data-link style="color:var(--plum)">Дэлгүүр хэсэх →</a></p>`}
      </div>
    </div>
  </div>`;

  $('#logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    store.user = null; renderUserBtn(); toast('Системээс гарлаа'); go('/');
  });

  $('#profForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api('/api/me', { method: 'PATCH', body: f });
      store.user = r.user; renderUserBtn(); toast('Мэдээлэл хадгалагдлаа', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  });
});

// ---------------------------------------------------------------------------
// Статик хуудсууд
// ---------------------------------------------------------------------------
route('/about', async (app) => {
  app.innerHTML = `${crumbs([{ label: 'Нүүр', href: '/' }, { label: 'Бидний тухай' }])}
  <div class="wrap" style="padding-bottom:60px;max-width:820px">
    <h1 style="margin-bottom:18px">Бидний тухай</h1>
    <div class="panel">
      <p>Khishgee's Salon Supply нь 2018 онд Улаанбаатар хотод үүсгэн байгуулагдсан бөгөөд мэргэжлийн үсчин,
      маникюрч нарт зориулсан чанартай бүтээгдэхүүн нийлүүлэхэд төвлөрдөг.</p>
      <p>Бид Солонгос, Итали, Марокко зэрэг орнуудын албан ёсны нийлүүлэгчидтэй шууд ажилладаг тул
      манай бүх бүтээгдэхүүн <b>100% жинхэнэ</b> байх баталгаатай.</p>
      <p style="margin:0">Өнөөдрийн байдлаар Улаанбаатар хотын 120 гаруй салон бидний байнгын харилцагч юм.</p>
    </div>
    <div class="trust" style="border:none;background:none">
      <div class="wrap" style="padding-inline:0">
        <div class="trust-item"><span class="trust-ico">${icon('shield', 20)}</span><div><b>120+</b><span>Түнш салон</span></div></div>
        <div class="trust-item"><span class="trust-ico">${icon('box', 20)}</span><div><b>40+</b><span>Бүтээгдэхүүн</span></div></div>
        <div class="trust-item"><span class="trust-ico">${icon('truck', 20)}</span><div><b>7 жил</b><span>Туршлага</span></div></div>
        <div class="trust-item"><span class="trust-ico">${icon('spark', 20)}</span><div><b>2400+</b><span>Үйлчлүүлэгч</span></div></div>
      </div>
    </div>
  </div>`;
});

route('/help', async (app) => {
  const faq = [
    ['Хүргэлт хэдэн цагт хийгддэг вэ?', 'Улаанбаатар хотод захиалга баталгаажсанаас хойш 24 цагийн дотор, өдрийн 10:00–20:00 цагийн хооронд хүргэнэ. Орон нутагт унаагаар 1-3 хоногт хүрнэ.'],
    ['Хүргэлтийн төлбөр хэд вэ?', 'УБ хотод 8,000₮. 150,000₮-с дээш захиалгад үнэгүй. Орон нутагт 15,000₮ (унааны төлбөр).'],
    ['Ямар байдлаар төлбөр төлөх вэ?', 'Бэлнээр (хүргэлтийн үед), дансаар шилжүүлэх, эсвэл QPay/картаар төлөх боломжтой.'],
    ['Бараа буцаах боломжтой юу?', 'Задлаагүй, ашиглаагүй бүтээгдэхүүнийг 7 хоногийн дотор баримтын хамт буцаах боломжтой. Ариун цэврийн шалтгаанаар задалсан бүтээгдэхүүн буцаагдахгүй.'],
    ['Бүтээгдэхүүн жинхэнэ эсэхийг яаж баталгаажуулах вэ?', 'Бид зөвхөн албан ёсны нийлүүлэгчээс импортолдог. Хүсвэл гаалийн болон импортын баримтыг үзүүлэх боломжтой.'],
    ['Салонд бөөний үнээр авах боломжтой юу?', 'Тийм. 500,000₮-с дээш захиалгад бөөний үнэ санал болгодог. ' + (store.settings.phone || '') + ' дугаарт холбогдоно уу.'],
  ];
  app.innerHTML = `${crumbs([{ label: 'Нүүр', href: '/' }, { label: 'Тусламж' }])}
  <div class="wrap" style="padding-bottom:60px;max-width:820px">
    <h1 style="margin-bottom:6px">Тусламж ба түгээмэл асуулт</h1>
    <p class="muted" style="margin-bottom:24px">Хариултаа олохгүй бол ${esc(store.settings.phone)} дугаарт залгаарай.</p>
    ${faq.map(([q, a]) => `
      <div class="panel" style="padding:0;margin-bottom:10px">
        <details>
          <summary style="padding:18px 22px;cursor:pointer;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:12px">
            ${esc(q)} <span style="color:var(--plum)">+</span></summary>
          <p style="padding:0 22px 20px;margin:0;color:var(--ink-2)">${esc(a)}</p>
        </details>
      </div>`).join('')}
    <div class="panel" style="margin-top:22px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div class="cat-ico" style="margin:0">${icon('phone', 24)}</div>
      <div style="flex:1;min-width:200px"><b>Тусламж хэрэгтэй юу?</b><br>
        <span class="muted">${esc(store.settings.work_hours)}</span></div>
      <a class="btn" href="tel:${esc(store.settings.phone)}">${esc(store.settings.phone)}</a>
    </div>
  </div>`;
});

// ---------------------------------------------------------------------------
// Сагсны самбар
// ---------------------------------------------------------------------------
function renderCart() {
  const n = cartQty();
  for (const id of ['#cartCount', '#navCart']) {
    const badge = $(id);
    if (!badge) continue;
    badge.hidden = n === 0;
    badge.textContent = n;
  }
  $('#cartQty').textContent = n ? `(${n} бараа)` : '';

  const body = $('#cartBody');
  const foot = $('#cartFoot');

  if (!store.cart.length) {
    body.innerHTML = `<div class="empty"><div class="empty-ico">${icon('cart', 30)}</div>
      <h3 style="font-size:1.05rem">Сагс хоосон</h3><p style="font-size:.9rem">Бүтээгдэхүүн нэмээд захиалгаа өгөөрэй.</p></div>`;
    foot.innerHTML = `<a class="btn btn-block" href="/catalog" data-link onclick="document.getElementById('cartClose').click()">Дэлгүүр хэсэх</a>`;
    return;
  }

  body.innerHTML = store.cart.map((i) => `
    <div class="cart-item">
      <img src="${i.image}" alt="${esc(i.name)}">
      <div>
        <div class="name">${esc(i.name)}</div>
        <div class="muted" style="font-size:.82rem;margin:3px 0 7px">${mnt(i.price)}</div>
        <div class="qty-mini"><button data-cdec="${i.id}">−</button><span>${i.qty}</span><button data-cinc="${i.id}">+</button></div>
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;justify-content:space-between">
        <b style="font-size:.92rem">${mnt(i.price * i.qty)}</b>
        <button class="iconbtn" data-crm="${i.id}" style="width:28px;height:28px;color:var(--muted)" aria-label="Хасах">${icon('x', 15)}</button>
      </div>
    </div>`).join('');

  const sub = cartSubtotal();
  const fee = deliveryFee(sub);
  const remain = Number(store.settings.free_delivery_from || 150000) - sub;
  foot.innerHTML = `
    ${remain > 0 ? `<div class="chip chip-gold" style="width:100%;justify-content:center;margin-bottom:12px">
      ${mnt(remain)} нэмбэл хүргэлт үнэгүй</div>` : ''}
    <div class="sum-row"><span>Барааны дүн</span><b>${mnt(sub)}</b></div>
    <div class="sum-row"><span>Хүргэлт</span><b>${fee === 0 ? '<span style="color:var(--ok)">Үнэгүй</span>' : mnt(fee)}</b></div>
    <div class="sum-row total"><span>Нийт</span><span class="price">${mnt(sub + fee)}</span></div>
    <a class="btn btn-lg btn-block" href="/checkout" data-link id="drawerCheckout" style="margin-top:12px">Захиалах</a>
    <a class="btn btn-ghost btn-block" href="/cart" data-link id="drawerCart" style="margin-top:6px">Сагс харах</a>`;

  $$('[data-cinc]').forEach((b) => b.addEventListener('click', () => {
    const it = store.cart.find((x) => x.id === +b.dataset.cinc); it.qty = Math.min(99, it.qty + 1); saveCart();
  }));
  $$('[data-cdec]').forEach((b) => b.addEventListener('click', () => {
    const it = store.cart.find((x) => x.id === +b.dataset.cdec);
    it.qty > 1 ? it.qty-- : store.cart.splice(store.cart.indexOf(it), 1); saveCart();
  }));
  $$('[data-crm]').forEach((b) => b.addEventListener('click', () => {
    store.cart = store.cart.filter((x) => x.id !== +b.dataset.crm); saveCart();
  }));
  ['#drawerCheckout', '#drawerCart'].forEach((s) => $(s)?.addEventListener('click', closeCart));
}

const openCart = () => { $('#cartDrawer').classList.add('on'); $('#overlay').classList.add('on'); document.body.style.overflow = 'hidden'; };
const closeCart = () => { $('#cartDrawer').classList.remove('on'); $('#overlay').classList.remove('on'); document.body.style.overflow = ''; };

function renderFavCount() {
  for (const id of ['#favCount', '#navFav']) {
    const b = $(id);
    if (!b) continue;
    b.hidden = store.favs.length === 0;
    b.textContent = store.favs.length;
  }
}

// ---------------------------------------------------------------------------
// Modal / нэвтрэх
// ---------------------------------------------------------------------------
const openModal = (html) => { $('#modalContent').innerHTML = html; $('#modal').classList.add('on'); document.body.style.overflow = 'hidden'; };
const closeModal = () => { $('#modal').classList.remove('on'); document.body.style.overflow = ''; };

function openAuth(mode = 'login') {
  openModal(`
    <div class="modal-head">
      <div class="center">
        <span class="logo-mark" style="margin:0 auto 12px">K</span>
        <h2 style="font-size:1.4rem">Тавтай морил</h2>
        <p class="muted" style="font-size:.9rem;margin:4px 0 0">Захиалгаа хянах, хаягаа хадгалах</p>
      </div>
    </div>
    <div class="modal-body">
      <div class="auth-tabs">
        <button class="${mode === 'login' ? 'on' : ''}" data-mode="login">Нэвтрэх</button>
        <button class="${mode === 'reg' ? 'on' : ''}" data-mode="reg">Бүртгүүлэх</button>
      </div>
      <form id="authForm">
        <div class="field" id="nameField" ${mode === 'login' ? 'hidden' : ''}>
          <label>Овог нэр</label><input name="name" placeholder="Б. Сарантуяа"></div>
        <div class="field"><label>Утасны дугаар</label>
          <input name="phone" inputmode="numeric" maxlength="8" placeholder="99112233" required></div>
        <div class="field"><label>Нууц үг</label>
          <input name="password" type="password" placeholder="••••••" required minlength="6"></div>
        <button class="btn btn-lg btn-block" type="submit" id="authSubmit">${mode === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}</button>
      </form>
      ${mode === 'login' ? `<p style="text-align:center;margin:12px 0 0">
        <button class="link-more" id="forgotLink" type="button" style="background:none;border:0;cursor:pointer;font:inherit">Нууц үгээ мартсан уу?</button></p>` : ''}
      <p class="muted" style="font-size:.8rem;text-align:center;margin:14px 0 0">
        Туршилтын хэрэглэгч: <b>99001122</b> / <b>test1234</b></p>
    </div>`);

  let current = mode;
  $$('.auth-tabs button').forEach((b) => b.addEventListener('click', () => openAuth(b.dataset.mode)));
  $('#forgotLink')?.addEventListener('click', () => openForgot());

  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = $('#authSubmit');
    btn.disabled = true;
    try {
      const r = await api(current === 'login' ? '/api/auth/login' : '/api/auth/register', { method: 'POST', body: f });
      store.user = r.user;
      renderUserBtn();
      closeModal();
      toast(`Сайн байна уу, ${r.user.name}!`, 'ok');
      if (location.pathname === '/account') render();
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  });
}

// ---------------------------------------------------------------------------
// Нууц үг сэргээх — 2 алхам: утас → SMS код + шинэ нууц үг
// ---------------------------------------------------------------------------
function openForgot(step = 1, phone = '', mockCode = '') {
  openModal(`
    <div class="modal-head">
      <div class="center">
        <span class="logo-mark" style="margin:0 auto 12px">K</span>
        <h2 style="font-size:1.4rem">Нууц үг сэргээх</h2>
        <p class="muted" style="font-size:.9rem;margin:4px 0 0">
          ${step === 1 ? 'Бүртгэлтэй утасны дугаараа оруулна уу' : `<b>${esc(phone)}</b> дугаарт илгээсэн кодыг оруулна уу`}</p>
      </div>
    </div>
    <div class="modal-body">
      ${step === 1 ? `
        <form id="forgotForm">
          <div class="field"><label>Утасны дугаар</label>
            <input name="phone" inputmode="numeric" maxlength="8" placeholder="99112233" required autofocus value="${esc(phone)}"></div>
          <button class="btn btn-lg btn-block" type="submit" id="forgotSubmit">Код авах</button>
        </form>` : `
        ${mockCode ? `<div class="panel" style="background:var(--gold-100);border:none;padding:12px 14px;margin-bottom:14px;font-size:.88rem">
          <b>Туршилтын горим:</b> SMS тохируулаагүй тул код энд харагдаж байна — <b style="font-size:1.1rem;letter-spacing:2px">${esc(mockCode)}</b></div>` : ''}
        <form id="resetForm">
          <div class="field"><label>6 оронтой код</label>
            <input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="••••••" required autofocus
              style="letter-spacing:6px;font-size:1.3rem;text-align:center"></div>
          <div class="field"><label>Шинэ нууц үг</label>
            <input name="password" type="password" placeholder="Дор хаяж 6 тэмдэгт" required minlength="6"></div>
          <div class="field"><label>Шинэ нууц үг давтах</label>
            <input name="password2" type="password" placeholder="••••••" required minlength="6"></div>
          <button class="btn btn-lg btn-block" type="submit" id="resetSubmit">Нууц үг солих</button>
        </form>
        <p style="text-align:center;margin:12px 0 0">
          <button class="link-more" id="resendLink" type="button" style="background:none;border:0;cursor:pointer;font:inherit">Код дахин авах</button></p>`}
      <p style="text-align:center;margin:14px 0 0">
        <button class="link-more" id="backToLogin" type="button" style="background:none;border:0;cursor:pointer;font:inherit">← Нэвтрэх хуудас руу</button></p>
    </div>`);

  $('#backToLogin').addEventListener('click', () => openAuth('login'));
  $('#resendLink')?.addEventListener('click', () => openForgot(1, phone));

  $('#forgotForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = String(new FormData(e.target).get('phone') || '').replace(/\D/g, '');
    if (p.length !== 8) return toast('Утасны дугаар 8 оронтой байх ёстой', 'err');
    const btn = $('#forgotSubmit');
    btn.disabled = true; btn.textContent = 'Илгээж байна…';
    try {
      const r = await api('/api/auth/forgot', { method: 'POST', body: { phone: p } });
      toast(r.message, 'ok');
      openForgot(2, p, r.code || '');
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false; btn.textContent = 'Код авах';
    }
  });

  $('#resetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.password !== f.password2) return toast('Нууц үг хоорондоо таарахгүй байна', 'err');
    const btn = $('#resetSubmit');
    btn.disabled = true;
    try {
      const r = await api('/api/auth/reset', { method: 'POST', body: { phone, code: f.code, password: f.password } });
      store.user = r.user;
      renderUserBtn();
      closeModal();
      toast('Нууц үг шинэчлэгдлээ. Тавтай морил!', 'ok');
      if (location.pathname === '/account') render();
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  });
}

function renderUserBtn() {
  const btn = $('#accountBtn');
  btn.innerHTML = store.user
    ? `<span class="avatar" style="width:30px;height:30px;font-size:.85rem">${esc(store.user.name.trim()[0] || 'K')}</span>`
    : icon('user', 21);
  btn.title = store.user ? store.user.name : 'Нэвтрэх';
}

// ---------------------------------------------------------------------------
// Delegated events
// ---------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) { e.preventDefault(); toggleFav(+fav.dataset.fav); return; }

  const add = e.target.closest('[data-add]');
  if (add) {
    e.preventDefault();
    add.disabled = true;
    try {
      const { product } = await api('/api/products/' + add.dataset.add);
      addToCart(product, 1);
      if (!isMobile()) openCart();   // утсанд бүтэн дэлгэцийн самбар нээх нь бүдүүлэг тул зөвхөн мэдэгдэнэ
    } catch (err) { toast(err.message, 'err'); }
    add.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Эхлүүлэх
// ---------------------------------------------------------------------------
async function boot() {
  $('#year').textContent = new Date().getFullYear();

  try {
    const data = await api('/api/bootstrap');
    Object.assign(store, {
      settings: data.settings, categories: data.categories,
      brands: data.brands, price: data.price, user: data.user,
    });
  } catch {
    toast('Серверт холбогдож чадсангүй', 'err');
  }

  const s = store.settings;
  $('#topPhone').textContent = '☎ ' + (s.phone || '');
  $('#topPhone').href = 'tel:' + (s.phone || '');
  $('#footerContact').innerHTML = `
    <span class="row" style="gap:9px;align-items:flex-start">${icon('pin', 17)}<span>${esc(s.address || '')}</span></span>
    <a class="row" style="gap:9px" href="tel:${esc(s.phone)}">${icon('phone', 17)}<span>${esc(s.phone)} · ${esc(s.phone2 || '')}</span></a>
    <a class="row" style="gap:9px" href="mailto:${esc(s.email)}">${icon('mail', 17)}<span>${esc(s.email)}</span></a>
    <span class="row" style="gap:9px">${icon('clock', 17)}<span>${esc(s.work_hours || '')}</span></span>`;

  $('#mainnav').innerHTML = `
    <a class="navlink" href="/catalog" data-link>Бүх бараа</a>
    <a class="navlink" href="/catalog?kind=hair" data-link>Үсний бүтээгдэхүүн</a>
    <a class="navlink" href="/catalog?kind=nail" data-link>Хумсны бүтээгдэхүүн</a>
    ${store.categories.slice(0, 5).map((c) => `<a class="navlink" href="/catalog?category=${c.slug}" data-link>${esc(c.name)}</a>`).join('')}
    <a class="navlink hot" href="/catalog?sale=1" data-link>Хямдрал</a>
    <a class="navlink" href="/about" data-link style="margin-left:auto">Бидний тухай</a>`;

  renderCart();
  renderFavCount();
  renderUserBtn();

  $('#cartBtn').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#overlay').addEventListener('click', () => { closeCart(); closeBSheet(); });
  $('#bsheetClose').addEventListener('click', closeBSheet);
  $('#accountBtn').addEventListener('click', () => (store.user ? go('/account') : openAuth()));
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalOverlay').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCart(); closeModal(); closeBSheet(); }
  });

  // --- Холбоо барих хөвөгч товч (утас) ---
  const fbPage = (s.facebook || '').replace(/^https?:\/\//, '').replace(/^facebook\.com\//, '').replace(/\/$/, '');
  $('#fabCall').href = 'tel:' + (s.phone || '').replace(/[^0-9+]/g, '');
  $('#fabMsg').href = fbPage ? `https://m.me/${fbPage}` : `https://facebook.com`;
  $('#fabBtn').addEventListener('click', () => {
    const list = $('#fabActions');
    const open = list.hidden;
    list.hidden = !open;
    $('#fabBtn').classList.toggle('on', open);
    $('#fabBtn').setAttribute('aria-expanded', String(open));
  });
  $$('.fab-action').forEach((a) => a.addEventListener('click', () => {
    $('#fabActions').hidden = true;
    $('#fabBtn').classList.remove('on');
  }));

  // --- Service worker: сул сүлжээнд хурдан ачаалахад ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* чухал биш */ });
    });
  }

  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    go(q ? '/catalog?q=' + encodeURIComponent(q) : '/catalog');
  });

  $('#newsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    e.target.reset();
    toast('Бүртгэгдлээ! Хямдралын мэдээг хүргэх болно.', 'ok');
  });

  await render();
}

boot();
