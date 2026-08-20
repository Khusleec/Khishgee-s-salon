'use client';

import {
  createContext, useCallback, useContext, useEffect, useState,
  type FormEvent, type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, type AdminUser, type Category, type ListResp } from './lib';
import { Icon, Toasts, toast } from './ui';

/* =========================================================================
   Админ бүрхүүл: нэвтрэх дэлгэц, хажуугийн цэс, толгой, доод навигац
   ========================================================================= */

// ---------------------------------------------------------------------------
// Контекст
// ---------------------------------------------------------------------------
export interface HeadState { title: string; sub?: string; actions?: ReactNode; }

interface AdminCtxValue {
  user: AdminUser;
  cats: Category[];
  reloadCats: () => Promise<void>;
  setHead: (h: HeadState) => void;
  setNewCount: (n: number) => void;
}

const AdminCtx = createContext<AdminCtxValue | null>(null);

export function useAdmin(): AdminCtxValue {
  const v = useContext(AdminCtx);
  if (!v) throw new Error('useAdmin() зөвхөн AdminChrome дотор ажиллана');
  return v;
}

// ---------------------------------------------------------------------------
// Навигац
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

const routeFor = (key: string): string => (key === 'dash' ? '/admin' : `/admin/${key}`);

// ---------------------------------------------------------------------------
// SVG спрайт (public/_legacy-admin.html-ээс)
// ---------------------------------------------------------------------------
function Sprite() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true">
      <symbol id="i-dash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="7" height="9" rx="2" /><rect x="13.5" y="3.5" width="7" height="5" rx="2" /><rect x="13.5" y="11.5" width="7" height="9" rx="2" /><rect x="3.5" y="15.5" width="7" height="5" rx="2" /></symbol>
      <symbol id="i-box" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M12 3l8 4v10l-8 4-8-4V7z" /><path d="M4 7l8 4 8-4M12 11v10" /></symbol>
      <symbol id="i-tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="7.5" r="1.4" /></symbol>
      <symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="9" cy="8" r="3.4" /><path d="M2.5 19a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 13.4A6.5 6.5 0 0 1 21.5 19" /></symbol>
      <symbol id="i-cog" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.8-1.3-1.9-3.3-2.1.8a7.6 7.6 0 0 0-2.6-1.5L14.2 3H9.8l-.4 2.2a7.6 7.6 0 0 0-2.6 1.5l-2.1-.8-1.9 3.3 1.8 1.3a7.6 7.6 0 0 0 0 3l-1.8 1.3 1.9 3.3 2.1-.8a7.6 7.6 0 0 0 2.6 1.5l.4 2.2h4.4l.4-2.2a7.6 7.6 0 0 0 2.6-1.5l2.1.8 1.9-3.3z" /></symbol>
      <symbol id="i-grid" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></symbol>
      <symbol id="i-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /></symbol>
      <symbol id="i-coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><ellipse cx="12" cy="6.5" rx="7.5" ry="3.2" /><path d="M4.5 6.5v11c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2v-11" /><path d="M4.5 12c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></symbol>
      <symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></symbol>
      <symbol id="i-out" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 8 6 12l4 4M6 12h9" /></symbol>
      <symbol id="i-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4 2.8 20h18.4z" /><path d="M12 10v4M12 17.2v.1" /></symbol>
      <symbol id="i-spark" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9z" /></symbol>
      <symbol id="i-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></symbol>
      <symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" /></symbol>
      <symbol id="i-edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 20h4L20 8l-4-4L4 16z" /><path d="M14 6l4 4" /></symbol>
      <symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" /></symbol>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Нэвтрэх дэлгэц
// ---------------------------------------------------------------------------
function LoginView({ onLogin }: { onLogin: (u: AdminUser) => void }) {
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      const r = await api<{ user: AdminUser }>('/api/auth/login', { method: 'POST', body: f });
      if (r.user.role !== 'admin') throw new Error('Танд админ эрх байхгүй байна');
      onLogin(r.user);
    } catch (err) {
      toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="center" style={{ marginBottom: 24 }}>
          <span className="logo-mark" style={{ margin: '0 auto 14px', width: 52, height: 52, fontSize: '1.5rem' }}>K</span>
          <h2 style={{ fontSize: '1.5rem' }}>Админ самбар</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '.9rem' }}>Khishgee&apos;s Salon удирдлагын систем</p>
        </div>
        <form id="loginForm" onSubmit={submit}>
          <div className="field"><label>Утасны дугаар</label>
            <input name="phone" inputMode="numeric" maxLength={8} placeholder="99112233" required autoFocus /></div>
          <div className="field"><label>Нууц үг</label>
            <input name="password" type="password" placeholder="••••••••" required /></div>
          <button className="btn btn-lg btn-block" type="submit" id="loginBtn" disabled={busy}>
            {busy ? 'Шалгаж байна…' : 'Нэвтрэх'}
          </button>
        </form>
        <div className="panel" style={{ background: 'var(--bg-2)', border: 'none', marginTop: 20, padding: '14px 16px', fontSize: '.84rem' }}>
          <b>Туршилтын эрх</b><br /><span className="muted">Утас: 99112233 · Нууц үг: admin123</span>
        </div>
        <p style={{ textAlign: 'center', margin: '16px 0 0' }}>
          <a href="/" style={{ color: 'var(--plum)', fontSize: '.88rem' }}>← Дэлгүүр рүү буцах</a>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Бүрхүүл
// ---------------------------------------------------------------------------
export default function AdminChrome({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [head, setHeadState] = useState<HeadState>({ title: '—', sub: '' });
  const [newCount, setNewCountState] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // body.admin — админ CSS-ийн суурь сонгогч
  useEffect(() => {
    document.body.classList.add('admin');
    return () => { document.body.classList.remove('admin'); };
  }, []);

  // Админ эрх дууссан үед нэвтрэх дэлгэц рүү буцаана
  useEffect(() => {
    const onUnauth = () => setUser(null);
    window.addEventListener('admin:unauth', onUnauth);
    return () => window.removeEventListener('admin:unauth', onUnauth);
  }, []);

  // Эхлүүлэх — session cookie-той эсэхийг шалгана
  useEffect(() => {
    api<{ user?: AdminUser | null }>('/api/bootstrap')
      .then((b) => { if (b.user && b.user.role === 'admin') setUser(b.user); })
      .catch(() => { /* сервер боломжгүй */ })
      .finally(() => setChecked(true));
  }, []);

  const reloadCats = useCallback(async () => {
    const d = await api<ListResp<Category>>('/api/admin/categories');
    setCats(d.items);
  }, []);

  useEffect(() => {
    if (user) reloadCats().catch(() => { /* дараа нь ачаална */ });
  }, [user, reloadCats]);

  // Хуудас солигдоход цэс хаагдана
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const setHead = useCallback((h: HeadState) => setHeadState(h), []);
  const setNewCount = useCallback((n: number) => setNewCountState(n), []);

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  if (!checked) {
    return <><Sprite /><Toasts /></>;
  }

  if (!user) {
    return (
      <>
        <Sprite />
        <LoginView onLogin={setUser} />
        <Toasts />
      </>
    );
  }

  const seg = pathname ? pathname.split('/').filter(Boolean) : [];
  const active = seg.length < 2 ? 'dash' : seg[1];
  const go = (key: string) => { router.push(routeFor(key)); setMenuOpen(false); };

  const sideNav: ReactNode[] = [];
  let lastGroup = '';
  for (const n of NAV) {
    if (n.group !== lastGroup) sideNav.push(<div className="side-label" key={`g-${n.group}`}>{n.group}</div>);
    lastGroup = n.group;
    const pillOn = n.key === 'orders' && newCount > 0;
    sideNav.push(
      <button className={`side-link${active === n.key ? ' on' : ''}`} data-nav={n.key} key={n.key} onClick={() => go(n.key)}>
        <Icon n={n.icon} s={19} /><span>{n.label}</span>
        <span className="pill" data-pill={n.key} hidden={!pillOn}>{pillOn ? newCount : ''}</span>
      </button>
    );
  }

  return (
    <AdminCtx.Provider value={{ user, cats, reloadCats, setHead, setNewCount }}>
      <Sprite />
      <div className="layout">
        <aside className={`side${menuOpen ? ' on' : ''}`} id="side">
          <div className="side-head">
            <div className="logo">
              <span className="logo-mark">K</span>
              <span className="logo-text"><span className="logo-name">Khishgee&apos;s</span><br /><span className="logo-sub">Admin panel</span></span>
            </div>
          </div>
          <nav className="side-nav">{sideNav}</nav>
          <div className="side-foot">
            <div className="row" style={{ gap: 10, marginBottom: 10 }}>
              <span className="avatar" style={{ width: 34, height: 34, fontSize: '.9rem' }}>{user.name.trim()[0] || 'A'}</span>
              <div style={{ lineHeight: 1.25, minWidth: 0 }}>
                <b style={{ color: '#fff', fontSize: '.86rem' }}>{user.name}</b><br />
                <span style={{ color: '#9d8c93', fontSize: '.76rem' }}>{user.phone}</span>
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <a className="btn btn-ghost btn-sm" href="/" style={{ color: '#cbbac3', flex: 1 }}><Icon n="home" s={15} /> Дэлгүүр</a>
              <button className="btn btn-ghost btn-sm" id="logoutBtn" style={{ color: '#cbbac3' }} onClick={logout}><Icon n="out" s={15} /> Гарах</button>
            </div>
          </div>
        </aside>

        <div className="admin-main">
          <header className="admin-top">
            <button className="iconbtn burger" id="burger" aria-label="Цэс" onClick={() => setMenuOpen((o) => !o)}><Icon n="menu" s={22} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 id="pageTitle">{head.title}</h1>
              <div className="sub" id="pageSub">{head.sub || ''}</div>
            </div>
            <div id="pageActions" className="row" style={{ gap: 8 }}>{head.actions}</div>
          </header>
          <div className="admin-body" id="content">{children}</div>
        </div>
      </div>

      {/* Утасны доод навигац */}
      <nav className="admin-nav" id="adminNav">
        <button data-anav="dash" className={active === 'dash' ? 'on' : ''} onClick={() => go('dash')}><Icon n="dash" s={21} />Самбар</button>
        <button data-anav="orders" className={active === 'orders' ? 'on' : ''} onClick={() => go('orders')}>
          <Icon n="cart" s={21} />Захиалга<span className="n-badge" id="navNew" hidden={!newCount}>{newCount}</span>
        </button>
        <button data-anav="products" className={active === 'products' ? 'on' : ''} onClick={() => go('products')}><Icon n="box" s={21} />Бараа</button>
        <button data-anav="__menu" onClick={() => setMenuOpen((o) => !o)}><Icon n="menu" s={21} />Цэс</button>
      </nav>

      <div className={`overlay${menuOpen ? ' on' : ''}`} onClick={() => setMenuOpen(false)} />
      <Toasts />
    </AdminCtx.Provider>
  );
}
