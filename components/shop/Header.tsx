'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Icon } from './Icon';
import { useShop } from './store';

function MainNav() {
  const { categories } = useShop();
  const pathname = usePathname();
  const search = useSearchParams();
  const current = pathname + (search.size ? '?' + search.toString() : '');
  const cls = (href: string, extra = '') =>
    `navlink${extra}${href === current ? ' active' : ''}`;

  return (
    <div className="wrap" id="mainnav">
      <Link className={cls('/catalog')} href="/catalog">Бүх бараа</Link>
      <Link className={cls('/catalog?kind=hair')} href="/catalog?kind=hair">Үсний бүтээгдэхүүн</Link>
      <Link className={cls('/catalog?kind=nail')} href="/catalog?kind=nail">Хумсны бүтээгдэхүүн</Link>
      {categories.slice(0, 5).map((c) => (
        <Link key={c.slug} className={cls(`/catalog?category=${c.slug}`)} href={`/catalog?category=${c.slug}`}>{c.name}</Link>
      ))}
      <Link className={cls('/catalog?sale=1', ' hot')} href="/catalog?sale=1">Хямдрал</Link>
      <Link className={cls('/about')} href="/about" style={{ marginLeft: 'auto' }}>Бидний тухай</Link>
    </div>
  );
}

export function Header() {
  const { settings, user, cartQty, favs, hydrated, openCart, openAuth } = useShop();
  const router = useRouter();
  const [q, setQ] = useState('');
  const favCount = hydrated ? favs.length : 0;
  const cartN = hydrated ? cartQty : 0;

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <span className="topbar-marquee">✦ 150,000₮-с дээш захиалгад хүргэлт <b>ҮНЭГҮЙ</b> · Улаанбаатар хотод 24 цагт</span>
          <div className="topbar-links">
            <Link href="/track">Захиалга шалгах</Link>
            <Link href="/help">Тусламж</Link>
            <a href={`tel:${settings.phone || ''}`} id="topPhone">☎ {settings.phone || ''}</a>
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="wrap header-main">
          <Link href="/" className="logo">
            <span className="logo-mark">K</span>
            <span className="logo-text">
              <span className="logo-name">Khishgee&#39;s</span><br />
              <span className="logo-sub">Salon Supply</span>
            </span>
          </Link>

          <form
            className="searchbox"
            id="searchForm"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const query = q.trim();
              router.push(query ? '/catalog?q=' + encodeURIComponent(query) : '/catalog');
            }}
          >
            <svg className="search-ico" width={18} height={18}><use href="#i-search" /></svg>
            <input
              type="search"
              id="searchInput"
              placeholder="Шампунь, гель лак, багаж хайх…"
              aria-label="Бараа хайх"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="search-go" type="submit" aria-label="Хайх"><svg width={16} height={16}><use href="#i-search" /></svg></button>
          </form>

          <div className="header-actions">
            <Link href="/wishlist" className="iconbtn hide-m" aria-label="Хадгалсан" title="Хадгалсан">
              <svg width={21} height={21}><use href="#i-heart" /></svg>
              <span className="count-badge" id="favCount" hidden={favCount === 0}>{favCount}</span>
            </Link>
            <button
              type="button"
              className="iconbtn hide-m"
              id="accountBtn"
              aria-label="Хэрэглэгч"
              title={user ? user.name : 'Нэвтрэх'}
              onClick={() => (user ? router.push('/account') : openAuth())}
            >
              {user
                ? <span className="avatar" style={{ width: 30, height: 30, fontSize: '.85rem' }}>{user.name.trim()[0] || 'K'}</span>
                : <Icon name="user" size={21} />}
            </button>
            <button type="button" className="iconbtn" id="cartBtn" aria-label="Сагс" title="Сагс" onClick={openCart}>
              <svg width={21} height={21}><use href="#i-cart" /></svg>
              <span className="count-badge" id="cartCount" hidden={cartN === 0}>{cartN}</span>
            </button>
          </div>
        </div>

        <nav className="mainnav">
          <Suspense fallback={<div className="wrap" id="mainnav" />}>
            <MainNav />
          </Suspense>
        </nav>
      </header>
    </>
  );
}
