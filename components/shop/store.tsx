'use client';
/* =========================================================================
   Дэлгүүрийн нийтлэг төлөв — сагс, хадгалсан, хэрэглэгч, тохиргоо, toast
   localStorage түлхүүрүүд эх SPA-тай яг ижил: ks_cart, ks_favs, ks_promo
   ========================================================================= */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  api, isMobile,
  type BootstrapResponse, type CartItem, type Category, type DeliveryMethod,
  type Product, type Promo, type Settings, type User,
} from './lib';

export interface Toast { id: number; message: string; type: string; hiding: boolean; }

export type AuthModalState =
  | { kind: 'auth'; mode: 'login' | 'reg' }
  | { kind: 'forgot'; step: 1 | 2; phone: string; mockCode: string }
  | null;

interface ShopContextValue {
  ready: boolean;
  hydrated: boolean;
  settings: Settings;
  categories: Category[];
  brands: string[];
  price: { min: number; max: number };
  user: User | null;
  setUser: (u: User | null) => void;
  cart: CartItem[];
  favs: number[];
  promo: Promo | null;
  setPromo: (p: Promo | null) => void;
  cartQty: number;
  cartSubtotal: number;
  addToCart: (p: Product, qty?: number) => void;
  addToCartById: (id: number) => Promise<void>;
  incCart: (id: number) => void;
  decCart: (id: number) => void;
  removeCart: (id: number) => void;
  clearCart: () => void;
  toggleFav: (id: number) => void;
  deliveryFee: (subtotal: number, method?: DeliveryMethod) => number;
  toast: (message: string, type?: string) => void;
  toasts: Toast[];
  drawerOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  modal: AuthModalState;
  openAuth: (mode?: 'login' | 'reg') => void;
  openForgot: (step?: 1 | 2, phone?: string, mockCode?: string) => void;
  closeModal: () => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within ShopProvider');
  return ctx;
}

const readJson = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
};

let toastSeq = 1;

export function ShopProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [price, setPrice] = useState({ min: 0, max: 0 });
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favs, setFavs] = useState<number[]>([]);
  const [promo, setPromoState] = useState<Promo | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<AuthModalState>(null);

  // --- localStorage-с ачаалах (гидрешны зөрүүнээс сэргийлж эхний render-ийн дараа) ---
  useEffect(() => {
    setCart(readJson<CartItem[]>('ks_cart', []));
    setFavs(readJson<number[]>('ks_favs', []));
    setPromoState(readJson<Promo | null>('ks_promo', null));
    setHydrated(true);
  }, []);

  // --- Bootstrap ---
  const toast = useCallback((message: string, type = '') => {
    const id = toastSeq++;
    setToasts((list) => [...list, { id, message, type, hiding: false }]);
    setTimeout(() => setToasts((list) => list.map((t) => (t.id === id ? { ...t, hiding: true } : t))), 3200);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3520);
  }, []);

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      try {
        const data = await api<BootstrapResponse>('/api/bootstrap');
        setSettings(data.settings);
        setCategories(data.categories);
        setBrands(data.brands);
        setPrice(data.price);
        setUser(data.user);
      } catch {
        toast('Серверт холбогдож чадсангүй', 'err');
      }
      setReady(true);
    })();
  }, [toast]);

  // --- Хадгалалт ---
  useEffect(() => { if (hydrated) localStorage.setItem('ks_cart', JSON.stringify(cart)); }, [cart, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem('ks_favs', JSON.stringify(favs)); }, [favs, hydrated]);

  const setPromo = useCallback((p: Promo | null) => {
    setPromoState(p);
    if (p) localStorage.setItem('ks_promo', JSON.stringify(p));
    else localStorage.removeItem('ks_promo');
  }, []);

  // --- Сагс ---
  const addToCart = useCallback((p: Product, qty = 1) => {
    setCart((cur) => {
      const line = cur.find((i) => i.id === p.id);
      if (line) return cur.map((i) => (i.id === p.id ? { ...i, qty: Math.min(99, i.qty + qty) } : i));
      return [...cur, { id: p.id, name: p.name, price: p.price, qty, image: p.image || `/img/p/${p.id}.svg`, stock: p.stock }];
    });
    toast(`"${p.name}" сагсанд нэмэгдлээ`, 'ok');
  }, [toast]);

  const addToCartById = useCallback(async (id: number) => {
    const { product } = await api<{ product: Product }>('/api/products/' + id);
    addToCart(product, 1);
    // утсанд бүтэн дэлгэцийн самбар нээх нь бүдүүлэг тул зөвхөн мэдэгдэнэ
    if (!isMobile()) setDrawerOpen(true);
  }, [addToCart]);

  const incCart = useCallback((id: number) => {
    setCart((cur) => cur.map((i) => (i.id === id ? { ...i, qty: Math.min(99, i.qty + 1) } : i)));
  }, []);
  const decCart = useCallback((id: number) => {
    setCart((cur) => cur
      .map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i))
      .filter((i) => i.qty > 0));
  }, []);
  const removeCart = useCallback((id: number) => {
    setCart((cur) => cur.filter((i) => i.id !== id));
  }, []);
  const clearCart = useCallback(() => setCart([]), []);

  const toggleFav = useCallback((id: number) => {
    setFavs((cur) => {
      if (cur.includes(id)) { toast('Хадгалсанаас хаслаа'); return cur.filter((x) => x !== id); }
      toast('Хадгалсан жагсаалтад нэмэгдлээ', 'ok');
      return [...cur, id];
    });
  }, [toast]);

  const deliveryFee = useCallback((subtotal: number, method: DeliveryMethod = 'ub') => {
    if (method === 'pickup') return 0;
    if (method === 'country') return Number(settings.country_delivery_fee || 15000);
    return subtotal >= Number(settings.free_delivery_from || 150000) ? 0 : Number(settings.delivery_fee || 8000);
  }, [settings]);

  const cartQty = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

  const openCart = useCallback(() => setDrawerOpen(true), []);
  const closeCart = useCallback(() => setDrawerOpen(false), []);

  const openAuth = useCallback((mode: 'login' | 'reg' = 'login') => setModal({ kind: 'auth', mode }), []);
  const openForgot = useCallback((step: 1 | 2 = 1, phone = '', mockCode = '') =>
    setModal({ kind: 'forgot', step, phone, mockCode }), []);
  const closeModal = useCallback(() => setModal(null), []);

  // Самбар/модал нээлттэй үед body гүйлгэхгүй
  useEffect(() => {
    document.body.style.overflow = drawerOpen || modal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen, modal]);

  // Escape товч
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawerOpen(false); setModal(null); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const value: ShopContextValue = {
    ready, hydrated, settings, categories, brands, price,
    user, setUser, cart, favs, promo, setPromo,
    cartQty, cartSubtotal,
    addToCart, addToCartById, incCart, decCart, removeCart, clearCart,
    toggleFav, deliveryFee, toast, toasts,
    drawerOpen, openCart, closeCart,
    modal, openAuth, openForgot, closeModal,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
