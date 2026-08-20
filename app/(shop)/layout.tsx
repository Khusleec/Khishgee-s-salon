import type { ReactNode } from 'react';
import { ShopProvider } from '@/components/shop/store';
import { Sprite } from '@/components/shop/Sprite';
import { Header } from '@/components/shop/Header';
import { Footer } from '@/components/shop/Footer';
import { MobileNav } from '@/components/shop/MobileNav';
import { Fab } from '@/components/shop/Fab';
import { CartDrawer } from '@/components/shop/CartDrawer';
import { AuthModal } from '@/components/shop/AuthModal';
import { Toasts } from '@/components/shop/Toasts';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ShopProvider>
      <Sprite />
      <Header />
      <main id="app">{children}</main>
      <Footer />
      <MobileNav />
      <Fab />
      <CartDrawer />
      <AuthModal />
      <Toasts />
    </ShopProvider>
  );
}
