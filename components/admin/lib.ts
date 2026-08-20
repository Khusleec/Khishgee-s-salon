'use client';

/* =========================================================================
   Khishgee's Salon — админ самбар: нийтлэг төрөл, туслах функцууд
   ========================================================================= */

// ---------------------------------------------------------------------------
// Төрлүүд (хуучин admin.ts-ийн интерфэйсүүдтэй ижил)
// ---------------------------------------------------------------------------
export type OrderStatus = 'new' | 'confirmed' | 'packed' | 'shipping' | 'delivered' | 'cancelled';

export interface AdminUser { name: string; phone: string; role: string; }

export interface Category { id: number; name: string; slug: string; kind: string; count: number; }

export interface ProductImage { id: number; url: string; }

export interface Product {
  id: number; name: string; sku: string; brand: string;
  category_id: number; category_name: string;
  price: number; compare_price: number | null;
  stock: number; sold: number; active: number;
  image: string; hue: number; shape: string;
  badge?: string; volume?: string; short?: string;
  description?: string; howto?: string; ingredients?: string;
  rating?: number; images?: ProductImage[];
}

export interface OrderItem { product_id: number; name: string; sku: string; price: number; qty: number; }

export interface Order {
  id: number; code: string; status: OrderStatus;
  customer_name: string; phone: string; created_at: string;
  subtotal: number; delivery_fee: number; discount: number; total: number;
  promo_code: string; note: string; district: string; address: string;
  payment_method: string; payment_status: string; delivery_method: string;
  items: OrderItem[];
}

export interface Promo { code: string; type: string; value: number; min_total: number; note: string; active: number; }

export interface Customer {
  name: string; phone: string; email: string; district: string;
  orders: number; spent: number; created_at: string;
}

export interface Payment {
  created_at: string; order_id: number; order_code: string;
  customer_name: string; phone: string; invoice_id: string;
  amount: number; paid_amount: number; status: string; mode: string;
}

export interface SmsMessage { created_at: string; phone: string; kind: string; body: string; status: string; error?: string; }

export interface SeriesPoint { label: string; revenue: number; orders: number; }

export interface Stats {
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

export interface ListResp<T> { items: T[]; }
export interface OrdersResp extends ListResp<Order> { total: number; page: number; pages: number; }
export interface PaymentsResp extends ListResp<Payment> { live: boolean; }
export interface SmsResp extends ListResp<SmsMessage> {
  stats: { sent?: number; failed?: number };
  live: boolean; provider: string;
}

export interface IntegrationsInfo {
  qpay: { live: boolean; base_url?: string; callback_base?: string; missing: string[] };
  sms: { live: boolean; notify_on_order: boolean; notify_on_status: boolean; provider?: string };
  uploads: { max_bytes: number };
}

// ---------------------------------------------------------------------------
// Туслах функцууд
// ---------------------------------------------------------------------------
export const mnt = (n: number): string => Number(n || 0).toLocaleString('mn-MN') + '₮';
export const kmnt = (n: number): string => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'сая₮'
  : Math.abs(n) >= 1e3 ? Math.round(n / 1e3) + 'мянга' : n + '₮');

export const dateMn = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
export const timeMn = (iso: string): string => {
  const d = new Date(iso);
  return `${dateMn(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const STATUS: Record<OrderStatus, { label: string; chip: string }> = {
  new:       { label: 'Шинэ',          chip: 'chip-info' },
  confirmed: { label: 'Баталгаажсан',  chip: 'chip-plum' },
  packed:    { label: 'Савлагдсан',    chip: 'chip-gold' },
  shipping:  { label: 'Хүргэлтэд',     chip: 'chip-warn' },
  delivered: { label: 'Хүргэгдсэн',    chip: 'chip-ok' },
  cancelled: { label: 'Цуцлагдсан',    chip: 'chip-danger' },
};
export const DELIVERY: Record<string, string> = { ub: 'Хотын хүргэлт', pickup: 'Өөрөө авах', country: 'Орон нутаг' };
export const PAYMENT: Record<string, string> = { cash: 'Бэлнээр', transfer: 'Дансаар', qpay: 'QPay/карт' };
export const SHAPES: [string, string][] = [['bottle', 'Лонх'], ['jar', 'Сав (маск)'], ['tube', 'Тюбик'], ['spray', 'Шүршигч'],
  ['drop', 'Дуслуур'], ['polish', 'Лакны сав'], ['tool', 'Багаж'], ['set', 'Багц']];

// ---------------------------------------------------------------------------
// API дуудлага — амжилтгүй бол Error шиднэ; админ эрх дууссан бол
// 'admin:unauth' event цацаж нэвтрэх дэлгэц рүү буцаана
// ---------------------------------------------------------------------------
export interface ApiOptions extends Omit<RequestInit, 'body'> { body?: unknown; }

export async function api<T = { ok?: boolean }>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await fetch(path, {
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: { ok?: boolean; error?: string } = {};
  try { data = await res.json(); } catch { /* хоосон */ }
  if (!res.ok || data.ok === false) {
    if ((res.status === 401 || res.status === 403) && path.startsWith('/api/admin')) {
      window.dispatchEvent(new Event('admin:unauth'));
    }
    throw new Error(data.error || 'Алдаа гарлаа');
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Хуудас хооронд хадгалагдах шүүлтүүрүүд (хуучин SPA-ийн module state-тэй ижил)
// ---------------------------------------------------------------------------
export const ordersFilter: { status: string; q: string; page: number } = { status: '', q: '', page: 1 };
export const prodFilter: { q: string; category: string; stock: string } = { q: '', category: '', stock: '' };
export const reportPrefs: { sep: boolean } = { sep: false };
