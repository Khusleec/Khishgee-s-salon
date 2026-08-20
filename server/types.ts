// ---------------------------------------------------------------------------
// Дундын төрлүүд — HTTP контекст, маршрут, өгөгдлийн сангийн мөрүүд
// ---------------------------------------------------------------------------

import type { IncomingMessage, ServerResponse } from 'node:http';

// ------------------------------- HTTP ---------------------------------------
export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  query: Record<string, string>;
  cookies: Record<string, string>;
  params: Record<string, string>;
  /** JSON биетэй хүсэлтэд задалсан бие; бусад үед null */
  body: any;
  /** raw: true маршрутад л оноогдоно (жишээ нь зураг байршуулах) */
  rawBody?: Buffer;
  setCookie(name: string, value: string, opts?: { maxAge?: number }): void;
  json(data: unknown, status?: number): void;
  raw(buf: Buffer, type: string, status?: number, extra?: Record<string, string | number>): void;
  fail(message: string, status?: number): void;
}

export type Handler = (ctx: Ctx) => void | Promise<void>;

export interface Route {
  method: string;
  path: string;
  handler: Handler;
  /** Биеийг JSON гэж задлахгүй, түүхийгээр нь ctx.rawBody-д өгнө */
  raw?: boolean;
  /** Биеийн дээд хэмжээ (байт) */
  limit?: number;
}

// --------------------------- Өгөгдлийн сан ----------------------------------
// node:sqlite-ийн .get()/.all() Record буцаадаг тул мөр бүрийг эдгээр
// төрөл рүү cast хийж ашиглана. (type alias — далд индекс гарын үсэгтэй
// тул Record-оос шууд хөрвүүлж болно.)

export type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  kind: string;
  icon: string;
  sort: number;
};

export type ProductRow = {
  id: number;
  sku: string;
  name: string;
  brand: string;
  category_id: number;
  price: number;
  compare_price: number | null;
  stock: number;
  hue: number;
  shape: string;
  badge: string;
  rating: number;
  sold: number;
  volume: string;
  short: string;
  description: string;
  howto: string;
  ingredients: string;
  active: number;
  created_at: string;
};

export type ProductImageRow = {
  id: number;
  file: string;
  mime: string;
  width: number;
  height: number;
  sort: number;
};

/** PRODUCT_COLUMNS сонголт + attachProductExtras-ийн нэмдэг талбарууд */
export type Product = ProductRow & {
  category_slug?: string;
  category_name?: string;
  kind?: string;
  images?: (ProductImageRow & { url: string })[];
  image?: string;
  has_photo?: boolean;
  in_stock?: boolean;
};

export type UserRow = {
  id: number;
  name: string;
  phone: string;
  email: string;
  password_hash: string;
  role: string;
  address: string;
  district: string;
  created_at: string;
};

export type OrderRow = {
  id: number;
  code: string;
  user_id: number | null;
  customer_name: string;
  phone: string;
  district: string;
  address: string;
  note: string;
  delivery_method: string;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  promo_code: string;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
  payment_status: string;
  paid_at: string | null;
};

export type OrderItemRow = {
  id: number;
  order_id: number;
  product_id: number | null;
  name: string;
  sku: string;
  hue: number;
  shape: string;
  price: number;
  qty: number;
};

export type Order = OrderRow & { items?: OrderItemRow[] };

export type PromoRow = {
  code: string;
  type: string;
  value: number;
  min_total: number;
  active: number;
  note: string;
};

export type PaymentRow = {
  id: number;
  order_id: number;
  provider: string;
  mode: string;
  invoice_id: string;
  qr_text: string;
  short_url: string;
  amount: number;
  status: string;
  paid_amount: number;
  payment_id: string;
  raw: string;
  created_at: string;
  updated_at: string;
};

export type PasswordResetRow = {
  id: number;
  user_id: number;
  phone: string;
  code_hash: string;
  expires_at: number;
  attempts: number;
  used_at: string | null;
  created_at: string;
};
