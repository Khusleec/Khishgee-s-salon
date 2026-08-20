'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useShop } from './store';

export function MobileNav() {
  const { cartQty, favs, hydrated } = useShop();
  const pathname = usePathname();
  const cls = (p: string) => (pathname === p ? 'active' : undefined);
  const cartN = hydrated ? cartQty : 0;
  const favN = hydrated ? favs.length : 0;

  return (
    <nav className="mobile-nav" id="mobileNav">
      <Link href="/" className={cls('/')}><svg width={21} height={21}><use href="#i-home" /></svg>Нүүр</Link>
      <Link href="/catalog" className={cls('/catalog')}><svg width={21} height={21}><use href="#i-grid" /></svg>Каталог</Link>
      <Link href="/cart" className={cls('/cart')}><svg width={21} height={21}><use href="#i-cart" /></svg>Сагс<span className="m-badge" id="navCart" hidden={cartN === 0}>{cartN}</span></Link>
      <Link href="/wishlist" className={cls('/wishlist')}><svg width={21} height={21}><use href="#i-heart" /></svg>Хадгалсан<span className="m-badge" id="navFav" hidden={favN === 0}>{favN}</span></Link>
      <Link href="/account" className={cls('/account')}><svg width={21} height={21}><use href="#i-user" /></svg>Профайл</Link>
    </nav>
  );
}
