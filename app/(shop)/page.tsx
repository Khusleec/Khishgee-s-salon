'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/shop/Icon';
import { ProductCard, SkeletonGrid } from '@/components/shop/bits';
import { api, CAT_ICON, type Product, type ProductListResponse } from '@/components/shop/lib';
import { useShop } from '@/components/shop/store';

const STEPS: [string, string, string][] = [
  ['Сонгох', 'Каталогоос хэрэгтэй бүтээгдэхүүнээ сагсандаа хийнэ.', 'grid'],
  ['Захиалах', 'Утас, хаягаа үлдээж захиалгаа баталгаажуулна.', 'box'],
  ['Хүлээн авах', 'Манай жолооч 24 цагийн дотор хаяг дээр тань хүргэнэ.', 'truck'],
];

export default function HomePage() {
  const { categories, toast } = useShop();
  const [popular, setPopular] = useState<Product[] | null>(null);
  const [fresh, setFresh] = useState<Product[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pop, nw] = await Promise.all([
          api<ProductListResponse>('/api/products?sort=popular&per=8'),
          api<ProductListResponse>('/api/products?sort=new&per=8'),
        ]);
        if (!alive) return;
        setPopular(pop.items);
        setFresh(nw.items);
        setTotal(pop.total);
      } catch (err) {
        if (alive) toast((err as Error).message, 'err');
      }
    })();
    return () => { alive = false; };
  }, [toast]);

  return (
    <>
      <section className="hero" style={{ padding: 0 }}>
        <div className="wrap">
          <div>
            <span className="hero-eyebrow"><Icon name="spark" size={16} /> Мэргэжлийн салоны нийлүүлэгч</span>
            <h1>Үс, хумсныхаа <em>гоо сайхныг</em> мэргэжлийн түвшинд</h1>
            <p className="hero-lead">Салонд ашиглагддаг жинхэнэ бүтээгдэхүүнийг шууд гэрт тань. Улаанбаатар хотод 24 цагийн дотор хүргэнэ, 150,000₮-с дээш захиалгад хүргэлт үнэгүй.</p>
            <div className="hero-cta">
              <Link className="btn btn-lg" href="/catalog">Дэлгүүр хэсэх <Icon name="arrow" size={18} /></Link>
              <Link className="btn btn-lg btn-outline" href="/catalog?sale=1">Хямдралтай бараа</Link>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><b id="hsProducts">{total !== null ? `${total}+` : '40+'}</b><span>Бүтээгдэхүүн</span></div>
              <div className="hero-stat"><b>8</b><span>Дэлхийн брэнд</span></div>
              <div className="hero-stat"><b>2,400+</b><span>Сэтгэл ханамжтай үйлчлүүлэгч</span></div>
              <div className="hero-stat"><b>24ц</b><span>Хүргэлтийн хугацаа</span></div>
            </div>
          </div>
          <div className="hero-art">
            <div className="blob" />
            <div className="hero-card c1"><img src="/img/p/1.svg" alt="" loading="eager" /></div>
            <div className="hero-card c2"><img src="/img/p/22.svg" alt="" loading="eager" /></div>
            <div className="hero-card c3"><img src="/img/p/8.svg" alt="" loading="lazy" /></div>
            <div className="hero-pill"><Icon name="truck" size={18} /> <span>Өнөөдөр захиалбал <b>маргааш</b> гарт</span></div>
          </div>
        </div>
      </section>

      <div className="trust">
        <div className="wrap">
          <div className="trust-item"><span className="trust-ico"><Icon name="shield" size={20} /></span><div><b>100% жинхэнэ</b><span>Албан ёсны импорт</span></div></div>
          <div className="trust-item"><span className="trust-ico"><Icon name="truck" size={20} /></span><div><b>Шуурхай хүргэлт</b><span>УБ хотод 24 цагт</span></div></div>
          <div className="trust-item"><span className="trust-ico"><Icon name="card" size={20} /></span><div><b>Уян хатан төлбөр</b><span>Бэлэн · Данс · QPay</span></div></div>
          <div className="trust-item"><span className="trust-ico"><Icon name="phone" size={20} /></span><div><b>Мэргэжлийн зөвлөгөө</b><span>Үсчин, маникюрчаас</span></div></div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-kicker">Ангилал</div>
              <h2>Юу хайж байна вэ?</h2>
              <p>Үс, хумсны бүх төрлийн мэргэжлийн бүтээгдэхүүн нэг дороос.</p>
            </div>
            <Link className="link-more" href="/catalog">Бүгдийг үзэх <Icon name="chev" size={15} /></Link>
          </div>
          <div className="cat-grid" id="homeCats">
            {categories.map((c) => (
              <Link className="cat-card" href={`/catalog?category=${c.slug}`} key={c.slug}>
                <span className="cat-ico"><Icon name={CAT_ICON[c.icon] || 'leaf'} size={26} /></span>
                <b>{c.name}</b>
                <span>{c.count} бараа</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--surface)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-kicker">Эрэлттэй</div>
              <h2>Хамгийн их зарагддаг</h2>
              <p>Салонууд болон гэрийн хэрэглэгчдийн сонголт.</p>
            </div>
            <Link className="link-more" href="/catalog?sort=popular">Бүгдийг үзэх <Icon name="chev" size={15} /></Link>
          </div>
          <div id="homePopular">
            {popular
              ? <div className="prod-grid prod-rail">{popular.map((p) => <ProductCard key={p.id} p={p} />)}</div>
              : <SkeletonGrid n={8} />}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="panel promo-banner">
            <div>
              <div className="sec-kicker">Урамшуулал</div>
              <h2>Эхний захиалгадаа 10% хөнгөлөлт</h2>
              <p>Худалдан авалт хийхдээ <b style={{ background: 'rgba(255,255,255,.18)', padding: '3px 10px', borderRadius: 8 }}>SHINE10</b> кодыг ашиглаарай. 50,000₮-с дээш захиалгад хүчинтэй.</p>
            </div>
            <Link className="btn btn-gold btn-lg" href="/catalog">Одоо худалдан авах</Link>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <div><div className="sec-kicker">Шинэ</div><h2>Саяхан ирсэн бараа</h2></div>
            <Link className="link-more" href="/catalog?sort=new">Бүгдийг үзэх <Icon name="chev" size={15} /></Link>
          </div>
          <div id="homeNew">
            {fresh
              ? <div className="prod-grid">{fresh.map((p) => <ProductCard key={p.id} p={p} />)}</div>
              : <SkeletonGrid n={8} />}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--bg-2)' }}>
        <div className="wrap">
          <div className="sec-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <div><div className="sec-kicker">Хэрхэн ажилладаг вэ</div><h2>Гурван алхамд гарт тань</h2></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 20 }}>
            {STEPS.map(([t, d, ic], i) => (
              <div className="panel center" key={t}>
                <div className="cat-ico" style={{ marginBottom: 14 }}><Icon name={ic} size={26} /></div>
                <div className="chip chip-plum" style={{ marginBottom: 10 }}>Алхам {i + 1}</div>
                <h3 style={{ marginBottom: 8 }}>{t}</h3>
                <p className="muted" style={{ margin: 0, fontSize: '.92rem' }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
