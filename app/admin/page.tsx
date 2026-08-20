'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, mnt, timeMn, STATUS, type OrderStatus, type Stats } from '../../components/admin/lib';
import { Icon, ErrorBox, useIsMobile } from '../../components/admin/ui';
import { BarChart, HBars } from '../../components/admin/charts';
import { useAdmin } from '../../components/admin/chrome';

/* =========================================================================
   Хуудас: Хяналтын самбар
   ========================================================================= */
export default function DashPage() {
  const { setHead, setNewCount } = useAdmin();
  const router = useRouter();
  const mobile = useIsMobile();
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setHead({ title: 'Хяналтын самбар', sub: 'Дэлгүүрийн өнөөдрийн байдал' });
  }, [setHead]);

  useEffect(() => {
    api<Stats>('/api/admin/stats')
      .then((d) => { setS(d); setNewCount(d.byStatus.new); })
      .catch((e: Error) => setErr(e.message));
  }, [setNewCount]);

  if (err) return <ErrorBox msg={err} />;
  if (!s) return <div className="sk" style={{ height: 420 }} />;

  const pendingCount = s.byStatus.new + s.byStatus.confirmed + s.byStatus.packed + s.byStatus.shipping;
  const avg = s.totals.orders ? Math.round(s.totals.revenue / s.totals.orders) : 0;
  // Нарийн дэлгэцэд 14 багана бөөгнөрдөг тул 7 хоногоор харуулна
  const series = mobile ? s.series.slice(-7) : s.series;
  const goto = (key: string) => router.push(key === 'dash' ? '/admin' : `/admin/${key}`);

  return (
    <>
      <div className="stat-grid">
        <div className="stat gold">
          <div className="stat-ico"><Icon n="coin" s={21} /></div>
          <div className="stat-label">Нийт орлого</div>
          <div className="stat-value">{mnt(s.totals.revenue)}</div>
          <div className="stat-delta up">Сүүлийн 30 хоногт {mnt(s.month.revenue)}</div>
        </div>
        <div className="stat">
          <div className="stat-ico"><Icon n="cart" s={21} /></div>
          <div className="stat-label">Нийт захиалга</div>
          <div className="stat-value">{s.totals.orders}</div>
          <div className="stat-delta up">Өнөөдөр {s.today.orders} захиалга</div>
        </div>
        <div className="stat ok">
          <div className="stat-ico"><Icon n="users" s={21} /></div>
          <div className="stat-label">Бүртгэлтэй хэрэглэгч</div>
          <div className="stat-value">{s.totals.customers}</div>
          <div className="stat-delta">Дундаж захиалга {mnt(avg)}</div>
        </div>
        <div className="stat info">
          <div className="stat-ico"><Icon n="box" s={21} /></div>
          <div className="stat-label">Идэвхтэй бараа</div>
          <div className="stat-value">{s.totals.products}</div>
          <div className={`stat-delta ${pendingCount ? 'down' : ''}`}>{pendingCount} захиалга хүлээгдэж байна</div>
        </div>
      </div>

      <div className="cols cols-2" style={{ marginBottom: 16 }}>
        <div className="box">
          <div className="box-head">
            <div><h3>Борлуулалтын явц</h3><span className="muted" style={{ fontSize: '.83rem' }}>Сүүлийн {series.length} хоног</span></div>
            <span className="chip chip-plum">Нийт {mnt(series.reduce((a, x) => a + x.revenue, 0))}</span>
          </div>
          <div className="box-body"><BarChart series={series} /></div>
        </div>

        <div className="box">
          <div className="box-head"><h3>Захиалгын төлөв</h3></div>
          <div className="box-body">
            <HBars rows={(Object.entries(s.byStatus) as [OrderStatus, number][]).map(([k, v]) => ({
              label: STATUS[k].label, value: v, display: v + ' ш',
            }))} />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button className="btn btn-outline btn-sm" onClick={() => goto('orders')}>Захиалга удирдах</button>
            </div>
          </div>
        </div>
      </div>

      <div className="cols cols-2b" style={{ marginBottom: 16 }}>
        <div className="box">
          <div className="box-head"><h3>Хамгийн их зарагдсан</h3><span className="muted" style={{ fontSize: '.82rem' }}>Тоо ширхгээр</span></div>
          <div className="scroll-x"><table className="dtable">
            <thead><tr><th>Бараа</th><th className="num">Ширхэг</th><th className="num">Орлого</th></tr></thead>
            <tbody>{s.topProducts.map((p) => (
              <tr key={p.id}>
                <td className="primary"><div className="cell-prod">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="thumb" src={`/img/p/${p.id}.svg`} alt="" />
                  <b>{p.name}</b></div></td>
                <td className="num" data-label="Ширхэг"><b>{p.qty}</b></td>
                <td className="num" data-label="Орлого">{mnt(p.revenue)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>

        <div className="box">
          <div className="box-head">
            <h3>Үлдэгдэл багатай</h3>
            <button className="btn btn-outline btn-sm" onClick={() => goto('products')}>Бүгдийг харах</button>
          </div>
          <div className="scroll-x"><table className="dtable">
            <thead><tr><th>Бараа</th><th>Ангилал</th><th className="num">Үлдэгдэл</th></tr></thead>
            <tbody>{s.lowStock.map((p) => (
              <tr key={p.id}>
                <td className="primary"><div className="cell-prod">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="thumb" src={`/img/p/${p.id}.svg`} alt="" />
                  <div><b>{p.name}</b><span>{p.sku}</span></div></div></td>
                <td className="muted" data-label="Ангилал">{p.category_name}</td>
                <td className="num" data-label="Үлдэгдэл"><span className={`chip ${p.stock === 0 ? 'chip-danger' : p.stock <= 20 ? 'chip-warn' : 'chip-ok'}`}>{p.stock} ш</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>

      <div className="cols cols-2">
        <div className="box">
          <div className="box-head"><h3>Сүүлийн захиалгууд</h3>
            <button className="btn btn-outline btn-sm" onClick={() => goto('orders')}>Бүгд</button></div>
          <div className="scroll-x"><table className="dtable">
            <thead><tr><th>Дугаар</th><th>Үйлчлүүлэгч</th><th>Огноо</th><th className="num">Дүн</th><th>Төлөв</th></tr></thead>
            <tbody>{s.recent.map((o) => (
              <tr key={o.code}>
                <td className="primary"><div className="row-between">
                  <b>{o.code}</b>
                  <span className={`chip ${STATUS[o.status].chip}`}>{STATUS[o.status].label}</span></div></td>
                <td data-label="Үйлчлүүлэгч">{o.customer_name}</td>
                <td className="muted" data-label="Огноо">{timeMn(o.created_at)}</td>
                <td className="num" data-label="Дүн"><b>{mnt(o.total)}</b></td>
                <td className="d-only" data-label="Төлөв"><span className={`chip ${STATUS[o.status].chip}`}>{STATUS[o.status].label}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>

        <div className="box">
          <div className="box-head"><h3>Ангиллын орлого</h3></div>
          <div className="box-body">
            <HBars rows={s.byCategory.filter((c) => c.revenue > 0).map((c) => ({
              label: c.name, value: c.revenue, display: mnt(c.revenue),
            }))} />
          </div>
        </div>
      </div>
    </>
  );
}
