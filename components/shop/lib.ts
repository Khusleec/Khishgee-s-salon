/* =========================================================================
   Khishgee's Salon — дэлгүүрийн нийтлэг төрөл, туслах функцууд
   ========================================================================= */

// ---------------------------------------------------------------------------
// Төрлүүд (эх SPA-гийн app.ts-тэй ижил)
// ---------------------------------------------------------------------------
export type OrderStatus = 'new' | 'confirmed' | 'packed' | 'shipping' | 'delivered' | 'cancelled';
export type DeliveryMethod = 'ub' | 'pickup' | 'country';
export type PaymentMethod = 'cash' | 'transfer' | 'qpay';

export interface Category { slug: string; name: string; icon: string; kind: string; count: number; }
export interface ProductImage { url: string; }
export interface Product {
  id: number; name: string; brand: string; sku: string;
  price: number; compare_price?: number | null;
  image?: string; images?: ProductImage[];
  stock: number; rating: number; sold: number;
  badge?: string | null; short?: string; description?: string;
  howto?: string | null; ingredients?: string | null; volume?: string | null;
  category_name?: string; category_slug?: string;
}
export interface Review { name: string; rating: number; comment: string; created_at: string; }
export interface CartItem { id: number; name: string; price: number; qty: number; image: string; stock: number; }
export interface User { name: string; phone: string; email?: string; district?: string; address?: string; }
export interface Settings {
  phone?: string; phone2?: string; email?: string; address?: string;
  work_hours?: string; bank_account?: string; facebook?: string;
  delivery_fee?: number; free_delivery_from?: number; country_delivery_fee?: number;
}
export interface Promo { code: string; discount: number; note?: string; }
export interface SavedOrder { code: string; phone: string; at: number; }
export interface OrderItem { product_id: number; name: string; sku: string; price: number; qty: number; }
export interface Order {
  code: string; status: OrderStatus; created_at: string;
  delivery_method: DeliveryMethod; payment_method: PaymentMethod;
  payment_status?: string; paid_at?: string | null;
  items: OrderItem[]; subtotal: number; delivery_fee: number;
  discount?: number; promo_code?: string; total: number;
  customer_name: string; phone: string; district?: string; address?: string; note?: string;
}
export interface StatusInfo { label: string; chip: string; step: number; }
export interface QpayBankLink { name: string; description?: string; logo?: string; link: string; }
export interface QpayPayment { mode?: string; qr_svg?: string; short_url?: string; urls?: QpayBankLink[]; }

// API-ийн хариунууд — бүгд { ok: boolean, ... } хэлбэртэй
export interface ApiBase { ok?: boolean; error?: string; }
export interface ApiOpts extends Omit<RequestInit, 'body'> { body?: unknown; }
export interface BootstrapResponse { settings: Settings; categories: Category[]; brands: string[]; price: { min: number; max: number }; user: User | null; }
export interface ProductListResponse { items: Product[]; total: number; page: number; per: number; pages: number; }
export interface ProductDetailResponse { product: Product; reviews: Review[]; related: Product[]; }
export interface PromoCheckResponse { code: string; discount: number; note: string; }
export interface OrderCreateResponse { code: string; }
export interface OrderTrackResponse { order: Order; }
export interface MeResponse { user: User; orders: Order[]; }
export interface AuthResponse { user: User; }
export interface ForgotResponse { message: string; code?: string; }
export interface QpayCreateResponse { payment: QpayPayment; }
export interface QpayStatusResponse { order_status?: string; payment?: { status?: string }; }

// ---------------------------------------------------------------------------
// Туслах
// ---------------------------------------------------------------------------
export const mnt = (n: number | string | null | undefined): string =>
  Number(n || 0).toLocaleString('mn-MN') + '₮';

export const dateMn = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
export const dateTimeMn = (iso: string): string => {
  const d = new Date(iso);
  return `${dateMn(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export async function api<T = ApiBase>(path: string, opts: ApiOpts = {}): Promise<T> {
  const res = await fetch(path, {
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: ApiBase = {};
  try { data = await res.json(); } catch { /* хоосон хариу */ }
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Алдаа гарлаа');
  return data as T;
}

export const isMobile = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;

// Ангиллын дүрс — сангийн icon талбарыг sprite-ийн нэртэй холбоно
export const CAT_ICON: Record<string, string> = {
  bottle: 'bottle', jar: 'jar', drop: 'drop', tube: 'tube',
  spray: 'spray', tool: 'tool', polish: 'polish',
};

export const DISTRICTS = ['Багануур', 'Багахангай', 'Баянгол', 'Баянзүрх', 'Налайх',
  'Сонгинохайрхан', 'Сүхбаатар', 'Хан-Уул', 'Чингэлтэй'];

export const STATUS_MAP: Record<OrderStatus, StatusInfo> = {
  new:       { label: 'Шинэ захиалга',  chip: 'chip-info',   step: 0 },
  confirmed: { label: 'Баталгаажсан',   chip: 'chip-plum',   step: 1 },
  packed:    { label: 'Савлагдсан',     chip: 'chip-gold',   step: 2 },
  shipping:  { label: 'Хүргэлтэд гарсан', chip: 'chip-warn', step: 3 },
  delivered: { label: 'Хүргэгдсэн',     chip: 'chip-ok',     step: 4 },
  cancelled: { label: 'Цуцлагдсан',     chip: 'chip-danger', step: -1 },
};

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = { ub: 'Хотын хүргэлт', pickup: 'Дэлгүүрээс авах', country: 'Орон нутаг' };
export const PAYMENT_LABEL: Record<PaymentMethod, string> = { cash: 'Бэлнээр (хүргэлтээр)', transfer: 'Дансаар шилжүүлэх', qpay: 'QPay / картаар' };

export const SORT_OPTIONS: [string, string][] = [
  ['popular', 'Эрэлттэй эхэндээ'], ['new', 'Шинэ эхэндээ'], ['price_asc', 'Үнэ: багаас их'],
  ['price_desc', 'Үнэ: ихээс бага'], ['rating', 'Үнэлгээгээр'], ['name', 'Нэрээр (А-Я)'],
];

// Зочноор захиалсан хүн баталгаажуулалтаа дахин үзэх боломжтой байхын тулд
// захиалгын дугаар + утсыг зөвхөн энэ төхөөрөмж дээр хадгална.
export const myOrders = (): SavedOrder[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('ks_orders') || '[]') as SavedOrder[]; } catch { return []; }
};
export function rememberOrder(code: string, phone: string): void {
  const list = myOrders().filter((o) => o.code !== code);
  list.unshift({ code, phone, at: Date.now() });
  localStorage.setItem('ks_orders', JSON.stringify(list.slice(0, 20)));
}
export const phoneForOrder = (code: string): string =>
  myOrders().find((o) => o.code === code)?.phone || '';
