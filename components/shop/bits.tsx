'use client';
/* Дахин ашиглагдах жижиг хэсгүүд — эх SPA-гийн template-үүдтэй ижил DOM */
import Link from 'next/link';
import { Icon } from './Icon';
import { mnt, type Product } from './lib';
import { useShop } from './store';

export function Stars({ rating }: { rating: number | string }) {
  const r = Number(rating) || 0;
  const filled = Math.round(r);
  let out = '';
  for (let i = 1; i <= 5; i++) out += i <= filled ? '★' : '☆';
  return <span className="stars" aria-label={`${r.toFixed(1)} оноо`}>{out}</span>;
}

export interface Crumb { label: string; href?: string; }

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <div className="wrap">
      <nav className="crumbs">
        {items.map((it, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {it.href ? <Link href={it.href}>{it.label}</Link> : <span>{it.label}</span>}
            {i < items.length - 1 ? <span style={{ opacity: 0.5 }}>›</span> : null}
          </span>
        ))}
      </nav>
    </div>
  );
}

export function SkeletonGrid({ n = 8 }: { n?: number }) {
  return (
    <div className="prod-grid">
      {Array.from({ length: n }, (_, i) => <div key={i} className="sk sk-card" />)}
    </div>
  );
}

export function FavButton({ id, size = 17, style }: { id: number; size?: number; style?: React.CSSProperties }) {
  const { favs, toggleFav, hydrated } = useShop();
  const on = hydrated && favs.includes(id);
  return (
    <button
      type="button"
      className={`card-fav${on ? ' on' : ''}`}
      aria-label="Хадгалах"
      style={style}
      onClick={(e) => { e.preventDefault(); toggleFav(id); }}
    >
      <Icon name={on ? 'heart-fill' : 'heart'} size={size} />
    </button>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const { addToCartById, toast } = useShop();
  const off = p.compare_price && p.compare_price > p.price
    ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const stockCls = p.stock === 0 ? 'out' : p.stock <= 10 ? 'low' : '';
  const stockTxt = p.stock === 0 ? 'Дууссан' : p.stock <= 10 ? `Үлдсэн ${p.stock}ш` : 'Бэлэн байгаа';

  return (
    <article className="card">
      <Link className="card-media" href={`/product/${p.id}`} aria-label={p.name}>
        <img src={p.image || `/img/p/${p.id}.svg`} alt={p.name} loading="lazy" width={600} height={600} />
      </Link>
      <div className="card-badges">
        {p.badge ? (
          <span className={`chip ${p.badge === 'Хямдрал' ? 'chip-danger' : p.badge === 'Шинэ' ? 'chip-ok' : 'chip-gold'}`}>{p.badge}</span>
        ) : null}
        {off ? <span className="chip chip-danger">−{off}%</span> : null}
      </div>
      <FavButton id={p.id} />
      <div className="card-quick">
        <button
          type="button"
          className="btn btn-block btn-sm"
          disabled={p.stock === 0}
          onClick={async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try { await addToCartById(p.id); } catch (err) { toast((err as Error).message, 'err'); }
            btn.disabled = p.stock === 0;
          }}
        >
          <Icon name="cart" size={16} /> {p.stock === 0 ? 'Дууссан' : 'Сагсанд'}
        </button>
      </div>
      <div className="card-body">
        <span className="card-brand">{p.brand}</span>
        <Link className="card-title" href={`/product/${p.id}`}>{p.name}</Link>
        <div className="card-meta">
          <Stars rating={p.rating} /> <span>{Number(p.rating).toFixed(1)}</span>
          <span className="d-only"> · {p.sold} зарагдсан</span>
        </div>
        <div className="stock-line"><span className={`dot ${stockCls}`} /><span className="muted">{stockTxt}</span></div>
        <div className="card-price">
          <span className="price">{mnt(p.price)}</span>
          {off ? <span className="price-old">{mnt(p.compare_price)}</span> : null}
        </div>
      </div>
    </article>
  );
}
