'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/shop/Icon';
import { Crumbs, ProductCard, SkeletonGrid } from '@/components/shop/bits';
import { api, mnt, SORT_OPTIONS, type ProductListResponse } from '@/components/shop/lib';
import { useShop } from '@/components/shop/store';

type Query = Record<string, string>;

// ---------------------------------------------------------------------------
// Доод хуудас (bottom sheet) — зөвхөн утсанд харагдана
// ---------------------------------------------------------------------------
function BottomSheet({ title, onClose, foot, children }: {
  title: string; onClose: () => void; foot?: ReactNode; children: ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <>
      <div className="overlay on" onClick={onClose} />
      <div className="bsheet on" id="bsheet" role="dialog" aria-modal="true" aria-label="Шүүлтүүр">
        <div className="bsheet-grab" />
        <div className="bsheet-head">
          <h3 id="bsheetTitle">{title}</h3>
          <button type="button" className="iconbtn" id="bsheetClose" aria-label="Хаах" onClick={onClose}>
            <svg width={20} height={20}><use href="#i-x" /></svg>
          </button>
        </div>
        <div className="bsheet-body" id="bsheetBody">{children}</div>
        <div className="bsheet-foot" id="bsheetFoot">{foot}</div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Шүүлтүүрийн панел — aside болон доод хуудсанд хоёуланд ашиглана
// ---------------------------------------------------------------------------
function Filters({ q, variant, update, clear }: {
  q: Query; variant: string;
  update: (patch: Record<string, string | undefined>) => void;
  clear: () => void;
}) {
  const { categories, brands, price } = useShop();
  const selBrands = (q.brand || '').split(',').filter(Boolean);
  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="filters" id={variant === 'sheet' ? undefined : 'filters'}>
      <div className="filter-group">
        <h4>Төрөл</h4>
        <div className="filter-list">
          {([['', 'Бүгд'], ['hair', 'Үсний бүтээгдэхүүн'], ['nail', 'Хумсны бүтээгдэхүүн']] as [string, string][]).map(([v, l]) => (
            <label className="filter-opt" key={v}>
              <input type="radio" name={`${variant}-kind`} value={v}
                checked={(q.kind || '') === v}
                onChange={() => update({ kind: v, category: '' })} />{l}
            </label>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <h4>Ангилал</h4>
        <div className="filter-list">
          <label className="filter-opt">
            <input type="radio" name={`${variant}-category`} value=""
              checked={!q.category} onChange={() => update({ category: '' })} />Бүх ангилал
          </label>
          {categories.filter((c) => !q.kind || c.kind === q.kind).map((c) => (
            <label className="filter-opt" key={c.slug}>
              <input type="radio" name={`${variant}-category`} value={c.slug}
                checked={q.category === c.slug} onChange={() => update({ category: c.slug })} />
              {c.name}<span className="n">{c.count}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <h4>Брэнд</h4>
        <div className="filter-list">
          {brands.map((b) => (
            <label className="filter-opt" key={b}>
              <input type="checkbox" name={`${variant}-brand`} value={b}
                checked={selBrands.includes(b)}
                onChange={(e) => {
                  const list = e.target.checked ? [...selBrands, b] : selBrands.filter((x) => x !== b);
                  update({ brand: list.join(',') });
                }} />{b}
            </label>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <h4>Үнэ (₮)</h4>
        <div className="row" style={{ gap: 8 }}>
          <input ref={minRef} className="select" style={{ width: '100%', borderRadius: 8 }} type="number"
            placeholder={String(price.min)} defaultValue={q.min || ''} min={0} />
          <span className="muted">–</span>
          <input ref={maxRef} className="select" style={{ width: '100%', borderRadius: 8 }} type="number"
            placeholder={String(price.max)} defaultValue={q.max || ''} min={0} />
        </div>
        <button type="button" className="btn btn-outline btn-sm btn-block" style={{ marginTop: 11 }}
          onClick={() => update({ min: minRef.current?.value, max: maxRef.current?.value })}>Хэрэглэх</button>
      </div>
      <div className="filter-group">
        <label className="filter-opt">
          <input type="checkbox" checked={q.sale === '1'}
            onChange={(e) => update({ sale: e.target.checked ? '1' : '' })} />Зөвхөн хямдралтай
        </label>
        <button type="button" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} onClick={clear}>Шүүлтүүр цэвэрлэх</button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Каталог
// ---------------------------------------------------------------------------
export default function CatalogClient() {
  const { categories } = useShop();
  const router = useRouter();
  const searchParams = useSearchParams();
  const q: Query = Object.fromEntries(searchParams);
  const qKey = searchParams.toString();

  const [data, setData] = useState<ProductListResponse | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<'' | 'filter' | 'sort'>('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    const params = new URLSearchParams({ per: '12', ...Object.fromEntries(new URLSearchParams(qKey)) });
    api<ProductListResponse>('/api/products?' + params)
      .then((r) => { if (alive) setData(r); })
      .catch((err) => { if (alive) setError((err as Error).message); });
    return () => { alive = false; };
  }, [qKey]);

  const cat = categories.find((c) => c.slug === q.category);
  const title = q.q ? `"${q.q}" хайлтын үр дүн`
    : cat ? cat.name
    : q.kind === 'hair' ? 'Үсний бүтээгдэхүүн'
    : q.kind === 'nail' ? 'Хумсны бүтээгдэхүүн'
    : q.sale ? 'Хямдралтай бараа'
    : q.sort === 'new' ? 'Шинэ бараа'
    : 'Бүх бүтээгдэхүүн';

  const selBrands = (q.brand || '').split(',').filter(Boolean);
  const activeCount = [q.kind, q.category, q.min, q.max, q.sale].filter(Boolean).length + selBrands.length;

  const update = (patch: Record<string, string | undefined>) => {
    const next: Record<string, string | undefined> = { ...q, ...patch };
    delete next.page;
    for (const k of Object.keys(next)) if (!next[k]) delete next[k];
    setSheet('');
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(next)) if (v) clean[k] = v;
    router.push('/catalog' + (Object.keys(clean).length ? '?' + new URLSearchParams(clean) : ''));
  };
  const clearAll = () => { setSheet(''); router.push('/catalog'); };
  const goPage = (n: number) => {
    router.push('/catalog?' + new URLSearchParams({ ...q, page: String(n) }));
  };

  // Идэвхтэй шүүлтүүрийн шошго
  const tags: [string, string][] = [];
  if (q.kind) tags.push(['kind', q.kind === 'hair' ? 'Үсний' : 'Хумсны']);
  if (cat) tags.push(['category', cat.name]);
  selBrands.forEach((b) => tags.push(['brand:' + b, b]));
  if (q.min) tags.push(['min', `${mnt(q.min)}-с дээш`]);
  if (q.max) tags.push(['max', `${mnt(q.max)}-с доош`]);
  if (q.sale) tags.push(['sale', 'Хямдралтай']);
  if (q.q) tags.push(['q', `Хайлт: ${q.q}`]);

  const removeTag = (key: string) => {
    if (key.startsWith('brand:')) {
      const left = selBrands.filter((x) => x !== key.slice(6));
      update({ brand: left.join(',') });
    } else update({ [key]: '' });
  };

  const chipCats = categories.filter((c) => !q.kind || c.kind === q.kind);
  const cur = q.sort || 'popular';

  // Хуудаслалт
  const pagerButtons: ReactNode[] = [];
  if (data && data.pages > 1) {
    const btn = (n: number, label: string | number, on = false, dis = false, key?: string) => (
      <button key={key ?? `p${n}-${label}`} className={on ? 'on' : ''} disabled={dis} onClick={() => goPage(n)}>{label}</button>
    );
    pagerButtons.push(btn(data.page - 1, '‹', false, data.page === 1, 'prev'));
    for (let i = 1; i <= data.pages; i++) {
      if (i === 1 || i === data.pages || Math.abs(i - data.page) <= 1) pagerButtons.push(btn(i, i, i === data.page));
      else if (Math.abs(i - data.page) === 2) pagerButtons.push(<button key={`gap${i}`} disabled>…</button>);
    }
    pagerButtons.push(btn(data.page + 1, '›', false, data.page === data.pages, 'next'));
  }

  return (
    <>
      <Crumbs items={[{ label: 'Нүүр', href: '/' }, { label: title }]} />
      <div className="wrap" style={{ paddingBottom: 60 }}>
        <div className="sec-head" style={{ marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.45rem,3vw,2.3rem)' }}>{title}</h1>
            <p id="resultCount" className="muted">
              {error ? 'Илэрц олдсонгүй'
                : !data ? 'Ачаалж байна…'
                : data.total
                  ? `Нийт ${data.total} бүтээгдэхүүнээс ${(data.page - 1) * data.per + 1}–${Math.min(data.page * data.per, data.total)} харуулж байна`
                  : 'Илэрц олдсонгүй'}
            </p>
          </div>
        </div>

        {/* Утасны удирдлага */}
        <div className="catalog-bar">
          <button type="button" className="btn btn-outline" id="mFilter" onClick={() => setSheet('filter')}>
            <Icon name="filter" size={16} /> Шүүлтүүр
            {activeCount ? <span className="count">{activeCount}</span> : null}
          </button>
          <button type="button" className="btn btn-outline" id="mSort" onClick={() => setSheet('sort')}>
            <Icon name="sort" size={16} /> Эрэмбэ
          </button>
        </div>
        <div className="chip-row" id="chipRow">
          <Link href={`/catalog${q.kind ? '?kind=' + q.kind : ''}`} className={!q.category ? 'on' : ''}>Бүгд</Link>
          {chipCats.map((c) => (
            <Link href={`/catalog?category=${c.slug}`} key={c.slug} className={q.category === c.slug ? 'on' : ''}>{c.name}</Link>
          ))}
        </div>

        <div className="catalog">
          <Filters q={q} variant="side" update={update} clear={clearAll} />

          <div>
            <div className="toolbar">
              <div className="active-filters" id="activeFilters">
                {tags.map(([k, l]) => (
                  <span className="filter-tag" key={k}>
                    {l}<button type="button" aria-label="Хасах" onClick={() => removeTag(k)}>×</button>
                  </span>
                ))}
              </div>
              <select
                className="select"
                id="sortSel"
                aria-label="Эрэмбэлэх"
                value={cur}
                onChange={(e) => update({ sort: e.target.value })}
              >
                {SORT_OPTIONS.map(([v, l]) => <option value={v} key={v}>{l}</option>)}
              </select>
            </div>
            <div id="catalogGrid">
              {!data && !error ? <SkeletonGrid n={9} /> : null}
              {error || (data && !data.items.length) ? (
                <div className="empty">
                  <div className="empty-ico"><Icon name="search" size={30} /></div>
                  <h3>Илэрц олдсонгүй</h3>
                  <p>Шүүлтүүрээ өөрчилж дахин оролдоно уу.</p>
                  <button type="button" className="btn btn-outline" onClick={clearAll}>Шүүлтүүр цэвэрлэх</button>
                </div>
              ) : null}
              {data && data.items.length ? (
                <div className="prod-grid">{data.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
              ) : null}
            </div>
            <div className="pager" id="pager">{pagerButtons}</div>
          </div>
        </div>
      </div>

      {sheet === 'filter' ? (
        <BottomSheet
          title="Шүүлтүүр"
          onClose={() => setSheet('')}
          foot={(
            <>
              <button type="button" className="btn btn-outline" id="sheetClear" onClick={clearAll}>Цэвэрлэх</button>
              <button type="button" className="btn" id="sheetApply" onClick={() => setSheet('')}>Үр дүнг харах</button>
            </>
          )}
        >
          <Filters q={q} variant="sheet" update={update} clear={clearAll} />
        </BottomSheet>
      ) : null}

      {sheet === 'sort' ? (
        <BottomSheet title="Эрэмбэлэх" onClose={() => setSheet('')}>
          {SORT_OPTIONS.map(([v, l]) => (
            <button type="button" key={v} className={`sort-opt ${cur === v ? 'on' : ''}`} onClick={() => update({ sort: v })}>
              {l} {cur === v ? <Icon name="check" size={18} /> : null}
            </button>
          ))}
        </BottomSheet>
      ) : null}
    </>
  );
}
