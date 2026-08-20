'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '@/components/shop/Icon';
import { Crumbs, FavButton, ProductCard, SkeletonGrid, Stars } from '@/components/shop/bits';
import { api, dateMn, mnt, type ProductDetailResponse } from '@/components/shop/lib';
import { useShop } from '@/components/shop/store';

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { settings, user, addToCart, toast } = useShop();

  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [qty, setQtyState] = useState(1);
  const [tab, setTab] = useState('desc');
  const [mainImg, setMainImg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError('');
    api<ProductDetailResponse>('/api/products/' + id)
      .then((r) => {
        if (!alive) return;
        setData(r);
        if (refresh === 0) { setQtyState(1); setTab('desc'); setMainImg(null); }
        document.title = `${r.product.name} — Khishgee's Salon`;
      })
      .catch((err) => { if (alive) setError((err as Error).message); });
    return () => { alive = false; };
  }, [id, refresh]);

  // Утасны доод мөрийн зай
  useEffect(() => {
    document.body.classList.add('has-pdp-bar');
    return () => document.body.classList.remove('has-pdp-bar');
  }, []);

  if (error) {
    return (
      <div className="wrap">
        <div className="empty">
          <h2>Алдаа гарлаа</h2><p>{error}</p>
          <Link className="btn" href="/">Нүүр хуудас</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="wrap" style={{ paddingBlock: 40 }}><SkeletonGrid n={2} /></div>;
  }

  const { product: p, reviews, related } = data;
  const off = p.compare_price && p.compare_price > p.price
    ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const maxQty = Math.max(1, p.stock);
  const setQty = (v: number) => setQtyState(Math.min(maxQty, Math.max(1, v || 1)));
  const img = mainImg || p.image;

  const submitReview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/products/${p.id}/reviews`, {
        method: 'POST',
        body: { name: f.get('name'), rating: +(f.get('rating') as string), comment: f.get('comment') },
      });
      toast('Сэтгэгдэл нэмэгдлээ. Баярлалаа!', 'ok');
      setRefresh((n) => n + 1);
    } catch (err) { toast((err as Error).message, 'err'); }
  };

  return (
    <>
      <Crumbs items={[
        { label: 'Нүүр', href: '/' }, { label: 'Каталог', href: '/catalog' },
        { label: p.category_name || '', href: '/catalog?category=' + p.category_slug }, { label: p.name },
      ]} />

      <div className="wrap" style={{ paddingBottom: 50 }}>
        <div className="pdp">
          <div className="pdp-media">
            <div className="pdp-main">
              <img id="pdpImg" src={img} alt={p.name} width={600} height={600} />
              <FavButton id={p.id} size={19} style={{ top: 14, right: 14, width: 40, height: 40 }} />
            </div>
            <div className="pdp-thumbs">
              {p.images && p.images.length > 1 ? (
                // Олон жинхэнэ зурагтай бол галерей
                p.images.map((im, i) => (
                  <button type="button" key={im.url} className={(mainImg ? mainImg === im.url : i === 0) ? 'on' : ''}
                    onClick={() => setMainImg(im.url)}>
                    <img src={im.url} alt="" />
                  </button>
                ))
              ) : (
                <>
                  <button type="button" className="on"><img src={p.image} alt="" /></button>
                  {related.slice(0, 3).map((r) => (
                    <button type="button" key={r.id} onClick={() => router.push('/product/' + r.id)}>
                      <img src={r.image} alt={r.name} />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="card-brand">{p.brand}</span>
              {p.badge ? <span className="chip chip-gold">{p.badge}</span> : null}
              <span className="chip">SKU: {p.sku}</span>
            </div>
            <h1 className="pdp-title">{p.name}</h1>
            <div className="row" style={{ gap: 10 }}>
              <Stars rating={p.rating} />
              <b>{Number(p.rating).toFixed(1)}</b>
              <span className="muted">· {reviews.length} сэтгэгдэл · {p.sold} зарагдсан</span>
            </div>

            <p style={{ marginTop: 16, fontSize: '1.02rem', color: 'var(--ink-2)' }}>{p.short}</p>

            <div className="pdp-price">
              <span className="price">{mnt(p.price)}</span>
              {off ? <><span className="price-old">{mnt(p.compare_price)}</span><span className="price-off">−{off}% хэмнэлт</span></> : null}
            </div>

            <div className="stock-line" style={{ marginBottom: 20, fontSize: '.9rem' }}>
              <span className={`dot ${p.stock === 0 ? 'out' : p.stock <= 10 ? 'low' : ''}`} />
              {p.stock === 0 ? <b style={{ color: 'var(--danger)' }}>Түр дууссан</b>
                : p.stock <= 10 ? <b style={{ color: 'var(--warn)' }}>Яараарай — үлдсэн {p.stock}ш</b>
                : <b style={{ color: 'var(--ok)' }}>Бэлэн байгаа ({p.stock}ш)</b>}
            </div>

            <div className="pdp-actions">
              <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div className="qty">
                  <button type="button" id="qMinus" aria-label="Хасах" onClick={() => setQty(qty - 1)}>−</button>
                  <input id="qInput" type="number" value={qty} min={1} max={maxQty} aria-label="Тоо ширхэг"
                    onChange={(e) => setQty(+e.target.value)} />
                  <button type="button" id="qPlus" aria-label="Нэмэх" onClick={() => setQty(qty + 1)}>+</button>
                </div>
                <button type="button" className="btn btn-lg" id="addBtn" disabled={p.stock === 0}
                  style={{ flex: 1, minWidth: 190 }} onClick={() => addToCart(p, qty)}>
                  <Icon name="cart" size={18} /> Сагсанд нэмэх
                </button>
              </div>
              <button type="button" className="btn btn-lg btn-dark btn-block" id="buyNow" disabled={p.stock === 0}
                onClick={() => { addToCart(p, qty); router.push('/checkout'); }}>Шууд худалдан авах</button>
            </div>

            <div className="spec">
              <div><dt>Ангилал</dt><dd style={{ margin: 0 }}>{p.category_name}</dd></div>
              {p.volume ? <div><dt>Хэмжээ</dt><dd style={{ margin: 0 }}>{p.volume}</dd></div> : null}
              <div><dt>Брэнд</dt><dd style={{ margin: 0 }}>{p.brand}</dd></div>
              <div><dt>Хүргэлт</dt><dd style={{ margin: 0 }}>УБ хотод 24 цагт · {mnt(settings.delivery_fee)} ({mnt(settings.free_delivery_from)}-с дээш үнэгүй)</dd></div>
            </div>

            <div className="panel" style={{ background: 'var(--bg-2)', border: 'none', padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
              <Icon name="shield" size={24} />
              <div style={{ fontSize: '.88rem' }}><b>Жинхэнэ бүтээгдэхүүний баталгаа.</b><br />
                <span className="muted">Задлаагүй бол 7 хоногийн дотор буцаах боломжтой.</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingBottom: 60 }}>
        <div className="tabs">
          <button type="button" className={`tab${tab === 'desc' ? ' on' : ''}`} onClick={() => setTab('desc')}>Дэлгэрэнгүй</button>
          <button type="button" className={`tab${tab === 'howto' ? ' on' : ''}`} onClick={() => setTab('howto')}>Хэрэглэх заавар</button>
          <button type="button" className={`tab${tab === 'ing' ? ' on' : ''}`} onClick={() => setTab('ing')}>Найрлага</button>
          <button type="button" className={`tab${tab === 'rev' ? ' on' : ''}`} onClick={() => setTab('rev')}>Сэтгэгдэл ({reviews.length})</button>
        </div>

        <div id="tab-desc" className="tabpane" hidden={tab !== 'desc'}>
          <div className="panel"><p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.75 }}>{p.description}</p></div>
        </div>
        <div id="tab-howto" className="tabpane" hidden={tab !== 'howto'}>
          <div className="panel"><p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.75 }}>{p.howto || 'Мэдээлэл байхгүй.'}</p></div>
        </div>
        <div id="tab-ing" className="tabpane" hidden={tab !== 'ing'}>
          <div className="panel">
            <p style={{ margin: 0, fontFamily: 'var(--font)', color: 'var(--ink-2)' }}>{p.ingredients || 'Мэдээлэл байхгүй.'}</p>
            <p className="muted" style={{ fontSize: '.84rem', margin: '14px 0 0' }}>Мэдрэг арьстай хүмүүс эхлээд бага хэсэгт туршиж үзнэ үү.</p>
          </div>
        </div>
        <div id="tab-rev" className="tabpane" hidden={tab !== 'rev'}>
          <div className="panel">
            {reviews.length ? reviews.map((r, i) => (
              <div className="review" key={i}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="avatar">{r.name.trim()[0] || '?'}</span>
                  <div style={{ flex: 1 }}>
                    <div className="row-between" style={{ marginBottom: 2 }}>
                      <b>{r.name}</b>
                      <span className="muted" style={{ fontSize: '.8rem' }}>{dateMn(r.created_at)}</span>
                    </div>
                    <Stars rating={r.rating} />
                    <p style={{ margin: '6px 0 0' }}>{r.comment}</p>
                  </div>
                </div>
              </div>
            )) : <p className="muted">Одоогоор сэтгэгдэл алга. Хамгийн эхэнд үлдээгээрэй!</p>}

            <form id="revForm" style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 22 }} onSubmit={submitReview}>
              <h3 style={{ marginBottom: 14 }}>Сэтгэгдэл үлдээх</h3>
              <div className="grid-2">
                <div className="field"><label>Таны нэр</label><input name="name" defaultValue={user?.name || ''} placeholder="Нэр" required /></div>
                <div className="field"><label>Үнэлгээ</label>
                  <select name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => <option value={n} key={n}>{'★'.repeat(n)} {n}</option>)}
                  </select>
                </div>
              </div>
              <div className="field"><label>Сэтгэгдэл</label><textarea name="comment" placeholder="Бүтээгдэхүүний талаарх сэтгэгдлээ бичнэ үү…" required /></div>
              <button className="btn" type="submit">Илгээх</button>
            </form>
          </div>
        </div>
      </div>

      {related.length ? (
        <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
          <div className="wrap">
            <div className="sec-head"><div><div className="sec-kicker">Санал болгох</div><h2>Төстэй бүтээгдэхүүн</h2></div></div>
            <div className="prod-grid">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
          </div>
        </section>
      ) : null}

      {/* Утсанд: дэлгэцийн доод хэсэгт байнга харагдах үйлдлийн мөр */}
      <div className="pdp-bar">
        {p.stock === 0 ? (
          <button type="button" className="btn btn-block" disabled>Түр дууссан</button>
        ) : (
          <>
            <div className="qty">
              <button type="button" id="qMinusM" aria-label="Хасах" onClick={() => setQty(qty - 1)}>−</button>
              <input id="qInputM" type="number" value={qty} min={1} max={p.stock} aria-label="Тоо ширхэг"
                onChange={(e) => setQty(+e.target.value)} />
              <button type="button" id="qPlusM" aria-label="Нэмэх" onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <button type="button" className="btn" id="addBtnM" onClick={() => addToCart(p, qty)}>
              <Icon name="cart" size={17} /> Сагсанд · <span id="barTotal">{mnt(p.price * qty)}</span>
            </button>
          </>
        )}
      </div>
    </>
  );
}
