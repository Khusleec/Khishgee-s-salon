'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api, mnt, timeMn, ordersFilter, STATUS, DELIVERY, PAYMENT,
  type Order, type OrderStatus, type OrdersResp,
} from '../../../components/admin/lib';
import { Icon, Sheet, toast, ErrorBox } from '../../../components/admin/ui';
import { useAdmin } from '../../../components/admin/chrome';

/* =========================================================================
   Хуудас: Захиалга
   ========================================================================= */

function OrderDetail({ o }: { o: Order }) {
  return (
    <>
      <div className="row-between" style={{ marginBottom: 18 }}>
        <span className={`chip ${STATUS[o.status].chip}`} style={{ padding: '8px 16px' }}>{STATUS[o.status].label}</span>
        <span className="muted" style={{ fontSize: '.85rem' }}>{timeMn(o.created_at)}</span>
      </div>

      <div className="box" style={{ marginBottom: 14 }}>
        <div className="box-head"><h3>Үйлчлүүлэгч</h3></div>
        <div className="box-body">
          <div className="spec" style={{ margin: 0 }}>
            <div><dt>Нэр</dt><dd style={{ margin: 0 }}><b>{o.customer_name}</b></dd></div>
            <div><dt>Утас</dt><dd style={{ margin: 0 }}><a href={`tel:${o.phone}`} style={{ color: 'var(--plum)' }}>{o.phone}</a></dd></div>
            <div><dt>Хүргэлт</dt><dd style={{ margin: 0 }}>{DELIVERY[o.delivery_method]}</dd></div>
            <div><dt>Хаяг</dt><dd style={{ margin: 0 }}>{o.district} {o.address}</dd></div>
            <div><dt>Төлбөр</dt><dd style={{ margin: 0 }}>{PAYMENT[o.payment_method]}
              {o.payment_status === 'paid' ? <> <span className="chip chip-ok" style={{ margin: 0 }}>Төлөгдсөн</span></>
                : o.payment_method === 'qpay' ? <> <span className="chip chip-gold" style={{ margin: 0 }}>Төлөөгүй</span></> : null}
            </dd></div>
            {o.note ? <div><dt>Тайлбар</dt><dd style={{ margin: 0 }}>{o.note}</dd></div> : null}
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-head"><h3>Бараа ({o.items.length})</h3></div>
        <div className="scroll-x"><table className="dtable">
          <thead><tr><th>Бараа</th><th className="num">Үнэ</th><th className="num">Тоо</th><th className="num">Дүн</th></tr></thead>
          <tbody>{o.items.map((i, idx) => (
            <tr key={idx}>
              <td className="primary"><div className="cell-prod">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumb" src={`/img/p/${i.product_id}.svg`} alt="" />
                <div><b>{i.name}</b><span>{i.sku}</span></div></div></td>
              <td className="num" data-label="Нэгж үнэ">{mnt(i.price)}</td>
              <td className="num" data-label="Тоо">{i.qty}</td>
              <td className="num" data-label="Дүн"><b>{mnt(i.price * i.qty)}</b></td>
            </tr>
          ))}</tbody>
        </table></div>
        <div className="box-body">
          <div className="sum-row"><span>Барааны дүн</span><b>{mnt(o.subtotal)}</b></div>
          <div className="sum-row"><span>Хүргэлт</span><b>{o.delivery_fee ? mnt(o.delivery_fee) : 'Үнэгүй'}</b></div>
          {o.discount ? <div className="sum-row" style={{ color: 'var(--ok)' }}><span>Хөнгөлөлт {o.promo_code}</span><b>−{mnt(o.discount)}</b></div> : null}
          <div className="sum-row total"><span>Нийт</span><span className="price">{mnt(o.total)}</span></div>
        </div>
      </div>
    </>
  );
}

export default function OrdersPage() {
  const { setHead } = useAdmin();
  const [filter, setFilterState] = useState({ ...ordersFilter });
  const [q, setQ] = useState(ordersFilter.q);
  const [data, setData] = useState<OrdersResp | null>(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState<Order | null>(null);
  const sheetSel = useRef<HTMLSelectElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setFilter = (patch: Partial<typeof filter>) => {
    setFilterState((f) => {
      const next = { ...f, ...patch };
      Object.assign(ordersFilter, next);
      return next;
    });
  };

  useEffect(() => {
    setHead({ title: 'Захиалга', sub: 'Захиалгын төлөв удирдах' });
  }, [setHead]);

  const load = useCallback(async (f: { status: string; q: string; page: number }) => {
    const p = new URLSearchParams({ per: '20', page: String(f.page) });
    if (f.status) p.set('status', f.status);
    if (f.q) p.set('q', f.q);
    try {
      const d = await api<OrdersResp>('/api/admin/orders?' + p);
      setData(d);
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const changeStatus = async (o: Order, sel: HTMLSelectElement) => {
    const prev = o.status;
    try {
      await api('/api/admin/orders/' + o.id, { method: 'PATCH', body: { status: sel.value } });
      toast(`${STATUS[sel.value as OrderStatus].label} болголоо`, 'ok');
      load(filter);
    } catch (e) {
      toast((e as Error).message, 'err');
      sel.value = prev;
    }
  };

  const saveSheet = async () => {
    if (!view || !sheetSel.current) return;
    try {
      await api('/api/admin/orders/' + view.id, { method: 'PATCH', body: { status: sheetSel.current.value } });
      toast('Төлөв шинэчлэгдлээ', 'ok');
      setView(null);
      load(filter);
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  const pager: (number | '…')[] = [];
  if (data && data.pages > 1) {
    for (let n = 1; n <= data.pages; n++) {
      if (n === 1 || n === data.pages || Math.abs(n - data.page) <= 1) pager.push(n);
      else if (Math.abs(n - data.page) === 2) pager.push('…');
    }
  }

  return (
    <>
      <div className="toolbar-admin">
        <div className="seg" id="statusSeg">
          <button data-st="" className={!filter.status ? 'on' : ''} onClick={() => setFilter({ status: '', page: 1 })}>Бүгд</button>
          {(Object.entries(STATUS) as [OrderStatus, { label: string }][]).map(([k, v]) => (
            <button key={k} data-st={k} className={filter.status === k ? 'on' : ''} onClick={() => setFilter({ status: k, page: 1 })}>{v.label}</button>
          ))}
        </div>
        <div className="search-admin">
          <Icon n="search" s={17} />
          <input
            id="oSearch"
            placeholder="Дугаар, нэр, утсаар хайх…"
            value={q}
            onChange={(e) => {
              const val = e.target.value;
              setQ(val);
              clearTimeout(debounce.current);
              debounce.current = setTimeout(() => setFilter({ q: val.trim(), page: 1 }), 320);
            }}
          />
        </div>
      </div>

      {err ? <ErrorBox msg={err} /> : (
        <div className="box" id="ordersBox">
          {!data ? <div className="box-body"><div className="sk" style={{ height: 300 }} /></div> : (
            <>
              <div className="box-head">
                <h3>{data.total} захиалга</h3>
                <span className="muted" style={{ fontSize: '.83rem' }}>Хуудас {data.page}/{data.pages}</span>
              </div>
              {data.items.length ? (
                <>
                  <div className="scroll-x"><table className="dtable">
                    <thead><tr>
                      <th>Дугаар</th><th>Үйлчлүүлэгч</th><th>Бараа</th><th>Хүргэлт</th>
                      <th>Огноо</th><th className="num">Дүн</th><th>Төлөв</th><th></th>
                    </tr></thead>
                    <tbody>{data.items.map((o) => (
                      <tr key={o.id}>
                        <td className="primary">
                          <div className="row-between">
                            <span><b>{o.code}</b>
                              <span className="muted" style={{ fontSize: '.76rem' }}> · {PAYMENT[o.payment_method] || ''}</span>
                              {o.payment_status === 'paid' ? <> <span className="chip chip-ok" style={{ padding: '1px 7px', fontSize: '.7rem', margin: 0 }}>Төлсөн</span></> : null}</span>
                            <span className={`chip ${STATUS[o.status].chip} m-only`} style={{ margin: 0 }}>{STATUS[o.status].label}</span>
                          </div>
                        </td>
                        <td data-label="Хэрэглэгч">
                          <span style={{ textAlign: 'right' }}>{o.customer_name}<br />
                            <a href={`tel:${o.phone}`} className="muted" style={{ fontSize: '.8rem' }}>{o.phone}</a></span>
                        </td>
                        <td data-label="Бараа">
                          <div className="row" style={{ gap: 3 }}>
                            {o.items.slice(0, 3).map((i, idx) => (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img key={idx} className="thumb" style={{ width: 32, height: 32 }} src={`/img/p/${i.product_id}.svg`} alt="" title={i.name} />
                            ))}
                            {o.items.length > 3 ? <span className="muted" style={{ fontSize: '.78rem' }}>+{o.items.length - 3}</span> : null}
                          </div>
                        </td>
                        <td className="muted" style={{ fontSize: '.82rem' }} data-label="Хүргэлт">
                          <span style={{ textAlign: 'right' }}>{DELIVERY[o.delivery_method] || ''}<br />{o.district}</span></td>
                        <td className="muted" style={{ fontSize: '.82rem' }} data-label="Огноо">{timeMn(o.created_at)}</td>
                        <td className="num" data-label="Дүн"><b>{mnt(o.total)}</b></td>
                        <td data-label="Төлөв">
                          <select
                            className="status-sel"
                            data-status={o.id}
                            key={`${o.id}:${o.status}`}
                            defaultValue={o.status}
                            onChange={(e) => changeStatus(o, e.currentTarget)}
                          >
                            {(Object.entries(STATUS) as [OrderStatus, { label: string }][]).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="actions"><div className="row">
                          <button className="btn btn-ghost btn-sm" onClick={() => setView(o)}><Icon n="eye" s={16} /><span className="m-only">Дэлгэрэнгүй</span></button>
                        </div></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                  {data.pages > 1 ? (
                    <div className="box-body"><div className="pager" id="oPager">
                      {pager.map((n, i) => n === '…'
                        ? <button key={`e${i}`} disabled>…</button>
                        : <button key={n} className={n === data.page ? 'on' : ''} onClick={() => setFilter({ page: n })}>{n}</button>)}
                    </div></div>
                  ) : null}
                </>
              ) : (
                <div className="box-body"><div className="empty"><div className="empty-ico"><Icon n="cart" s={28} /></div>
                  <h3>Захиалга олдсонгүй</h3><p>Шүүлтүүрээ өөрчилж үзнэ үү.</p></div></div>
              )}
            </>
          )}
        </div>
      )}

      <Sheet
        open={!!view}
        title={view ? `Захиалга ${view.code}` : ''}
        onClose={() => setView(null)}
        foot={view ? (
          <div className="row" style={{ gap: 8, flex: 1, flexWrap: 'wrap' }}>
            <select className="status-sel" id="sheetStatus" ref={sheetSel} key={view.id} defaultValue={view.status} style={{ flex: 1, minWidth: 150 }}>
              {(Object.entries(STATUS) as [OrderStatus, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button className="btn" id="sheetSave" onClick={saveSheet}>Төлөв хадгалах</button>
          </div>
        ) : null}
      >
        {view ? <OrderDetail o={view} /> : null}
      </Sheet>
    </>
  );
}
