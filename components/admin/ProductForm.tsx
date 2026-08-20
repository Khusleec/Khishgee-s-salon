'use client';

import { useRef, useState, type DragEvent } from 'react';
import { api, SHAPES, type Category, type Product, type ProductImage } from './lib';
import { Icon, Sheet, toast } from './ui';

/* =========================================================================
   Бараа нэмэх/засах форм + жинхэнэ зургийн менежер (sheet дотор)
   ========================================================================= */

function PhotoManager({ productId, initial, onChanged }: {
  productId: number;
  initial: ProductImage[];
  onChanged: () => void;
}) {
  const [images, setImages] = useState<ProductImage[]>(initial);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const del = async (id: number) => {
    if (!confirm('Энэ зургийг устгах уу?')) return;
    try {
      await api(`/api/admin/products/${productId}/images/${id}`, { method: 'DELETE' });
      setImages((xs) => xs.filter((x) => x.id !== id));
      onChanged();
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  const makeFirst = async (id: number) => {
    const order = [id, ...images.map((x) => x.id).filter((x) => x !== id)];
    try {
      const r = await api<{ images: ProductImage[] }>(`/api/admin/products/${productId}/images`, { method: 'PATCH', body: { order } });
      setImages(r.images);
      onChanged();
      toast('Үндсэн зураг солигдлоо', 'ok');
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  const upload = async (files: FileList) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) { toast('Зөвхөн зураг оруулна уу', 'err'); return; }
    const fd = new FormData();
    list.forEach((f) => fd.append('images', f, f.name));
    setStatus(`${list.length} зураг байршуулж байна…`);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/images`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Байршуулж чадсангүй');
      setImages((xs) => [...xs, ...data.images]);
      onChanged();
      setStatus(data.errors?.length ? `Алдаа: ${data.errors.join('; ')}` : '');
      toast(`${data.images.length} зураг нэмэгдлээ`, 'ok');
    } catch (e) {
      setStatus('');
      toast((e as Error).message, 'err');
    } finally { setBusy(false); }
  };

  const dragOn = (e: DragEvent) => { e.preventDefault(); setOver(true); };
  const dragOff = (e: DragEvent) => { e.preventDefault(); setOver(false); };

  return (
    <div className="photo-box" id="photoBox">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <b>Жинхэнэ зураг</b>
        <span className="muted" style={{ fontSize: '.8rem' }}>JPG · PNG · WebP · GIF, 5MB хүртэл</span>
      </div>
      <p className="muted" style={{ fontSize: '.82rem', margin: '0 0 10px' }}>Эхний зураг нь үндсэн зураг. Зураггүй бол өнгө/хэлбэрээс үүссэн SVG харагдана.</p>
      <div className="photo-grid" id="photoGrid">
        {images.length ? images.map((im, i) => (
          <div className="photo-item" data-id={im.id} key={im.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt="" />
            {i === 0 ? <span className="photo-main">Үндсэн</span> : null}
            <div className="photo-actions">
              {i > 0 ? <button type="button" title="Үндсэн болгох" onClick={() => makeFirst(im.id)}>★</button> : null}
              <button type="button" title="Устгах" onClick={() => del(im.id)}><Icon n="trash" s={14} /></button>
            </div>
          </div>
        )) : <div className="muted" style={{ fontSize: '.84rem', padding: '6px 0' }}>Одоогоор зураг байхгүй</div>}
      </div>
      <label
        className={`photo-drop${over ? ' over' : ''}${busy ? ' busy' : ''}`}
        id="photoDrop"
        onDragEnter={dragOn}
        onDragOver={dragOn}
        onDragLeave={dragOff}
        onDrop={(e) => {
          dragOff(e);
          if (e.dataTransfer?.files?.length) upload(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          id="photoInput"
          ref={inputRef}
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = '';
          }}
        />
        <Icon n="plus" s={20} /><span>Зураг сонгох эсвэл энд чирж тавих</span>
      </label>
      <div id="photoStatus" className="muted" style={{ fontSize: '.8rem', marginTop: 6 }}>{status}</div>
    </div>
  );
}

export default function ProductForm({ open, product, cats, onClose, onSaved }: {
  open: boolean;
  product: Product | null;
  cats: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !product;
  const v: Partial<Product> = product || { hue: 320, shape: 'bottle', active: 1, price: 0, stock: 0, rating: 5 };

  const formRef = useRef<HTMLFormElement>(null);
  const [hue, setHue] = useState(v.hue ?? 320);
  const [shape, setShape] = useState(v.shape || 'bottle');
  const [brand, setBrand] = useState(v.brand || '');
  const [active, setActive] = useState(!!v.active);

  const save = async () => {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const body = {
      ...f,
      hue,
      shape,
      price: +f.price,
      compare_price: f.compare_price ? +f.compare_price : null,
      stock: +f.stock,
      category_id: +f.category_id,
      active: !!f.active,
    };
    try {
      if (isNew) await api('/api/admin/products', { method: 'POST', body });
      else await api('/api/admin/products/' + v.id, { method: 'PATCH', body });
      toast(isNew ? 'Бараа нэмэгдлээ' : 'Хадгалагдлаа', 'ok');
      onClose();
      onSaved();
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  return (
    <Sheet
      open={open}
      title={isNew ? 'Шинэ бараа нэмэх' : 'Бараа засах'}
      onClose={onClose}
      foot={(
        <>
          <button className="btn btn-outline" id="cancelBtn" onClick={onClose}>Болих</button>
          <button className="btn" id="saveProd" onClick={save}>{isNew ? 'Нэмэх' : 'Хадгалах'}</button>
        </>
      )}
    >
      <form id="prodForm" ref={formRef}>
        <div className="row" style={{ gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            id="preview"
            className="thumb"
            style={{ width: 104, height: 104, borderRadius: 16 }}
            src={`/img/preview.svg?hue=${hue}&shape=${shape}&brand=${encodeURIComponent(brand)}`}
            alt=""
          />
          <div style={{ flex: 1 }}>
            <div className="field" style={{ marginBottom: 10 }}><label>Зургийн өнгө (0–360)</label>
              <input type="range" id="hue" min={0} max={359} value={hue} style={{ padding: 0 }}
                onChange={(e) => setHue(+e.target.value)} /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Савны хэлбэр</label>
              <select name="shape" id="shape" value={shape} onChange={(e) => setShape(e.target.value)}>
                {SHAPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
          </div>
        </div>

        <div className="field"><label>Барааны нэр <span className="req">*</span></label>
          <input name="name" defaultValue={v.name || ''} required placeholder="Ж: Кератин шампунь 500мл" /></div>

        <div className="grid-2">
          <div className="field"><label>SKU</label>
            <input name="sku" defaultValue={v.sku || ''} placeholder="Автоматаар үүснэ" /></div>
          <div className="field"><label>Брэнд</label>
            <input name="brand" defaultValue={v.brand || ''} placeholder="Ж: Lumière Pro" onChange={(e) => setBrand(e.target.value)} /></div>
          <div className="field"><label>Ангилал <span className="req">*</span></label>
            <select name="category_id" required defaultValue={v.category_id ? String(v.category_id) : undefined}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="field"><label>Хэмжээ</label>
            <input name="volume" defaultValue={v.volume || ''} placeholder="500 мл" /></div>
          <div className="field"><label>Үнэ (₮) <span className="req">*</span></label>
            <input name="price" type="number" min={0} step={500} defaultValue={v.price} required /></div>
          <div className="field"><label>Хуучин үнэ (₮)</label>
            <input name="compare_price" type="number" min={0} step={500} defaultValue={v.compare_price || ''} placeholder="хямдрал харуулах" /></div>
          <div className="field"><label>Үлдэгдэл</label>
            <input name="stock" type="number" min={0} defaultValue={v.stock} /></div>
          <div className="field"><label>Шошго</label>
            <select name="badge" defaultValue={v.badge || ''}>
              {['', 'Шинэ', 'Хямдрал', 'Эрэлттэй', 'Багц'].map((b) => (
                <option key={b} value={b}>{b || '— байхгүй —'}</option>
              ))}
            </select></div>
        </div>

        <div className="field"><label>Богино тайлбар</label>
          <input name="short" defaultValue={v.short || ''} placeholder="Картан дээр харагдах 1 өгүүлбэр" /></div>
        <div className="field"><label>Дэлгэрэнгүй тайлбар</label>
          <textarea name="description" rows={4} defaultValue={v.description || ''} /></div>
        <div className="field"><label>Хэрэглэх заавар</label>
          <textarea name="howto" rows={3} defaultValue={v.howto || ''} /></div>
        <div className="field"><label>Найрлага</label>
          <textarea name="ingredients" rows={2} defaultValue={v.ingredients || ''} /></div>

        <label className={`opt-card${active ? ' on' : ''}`} id="activeCard">
          <input type="checkbox" name="active" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span><b>Дэлгүүрт харуулах</b><span>Идэвхгүй бол каталогид харагдахгүй</span></span>
        </label>
      </form>

      {isNew ? (
        <p className="muted" style={{ fontSize: '.84rem', marginTop: 14 }}>
          <Icon n="spark" s={14} /> Барааг нэмсний дараа засах цонхноос жинхэнэ зураг оруулах боломжтой.
        </p>
      ) : (
        <PhotoManager productId={v.id!} initial={v.images || []} onChanged={onSaved} />
      )}
    </Sheet>
  );
}
