'use client';
import Link from 'next/link';
import { Icon } from './Icon';
import { mnt } from './lib';
import { useShop } from './store';

export function CartDrawer() {
  const {
    cart, cartQty, cartSubtotal, incCart, decCart, removeCart,
    deliveryFee, settings, drawerOpen, closeCart,
  } = useShop();

  const sub = cartSubtotal;
  const fee = deliveryFee(sub);
  const remain = Number(settings.free_delivery_from || 150000) - sub;

  return (
    <>
      <div className={`overlay${drawerOpen ? ' on' : ''}`} id="overlay" onClick={closeCart} />
      <aside className={`drawer${drawerOpen ? ' on' : ''}`} id="cartDrawer" aria-label="Сагс">
        <div className="drawer-head">
          <h3 style={{ fontSize: '1.1rem' }}>Миний сагс <span className="muted" id="cartQty" style={{ fontWeight: 400 }}>{cartQty ? `(${cartQty} бараа)` : ''}</span></h3>
          <button type="button" className="iconbtn" id="cartClose" aria-label="Хаах" onClick={closeCart}><svg width={20} height={20}><use href="#i-x" /></svg></button>
        </div>
        <div className="drawer-body" id="cartBody">
          {cart.length === 0 ? (
            <div className="empty">
              <div className="empty-ico"><Icon name="cart" size={30} /></div>
              <h3 style={{ fontSize: '1.05rem' }}>Сагс хоосон</h3>
              <p style={{ fontSize: '.9rem' }}>Бүтээгдэхүүн нэмээд захиалгаа өгөөрэй.</p>
            </div>
          ) : cart.map((i) => (
            <div className="cart-item" key={i.id}>
              <img src={i.image} alt={i.name} />
              <div>
                <div className="name">{i.name}</div>
                <div className="muted" style={{ fontSize: '.82rem', margin: '3px 0 7px' }}>{mnt(i.price)}</div>
                <div className="qty-mini">
                  <button type="button" onClick={() => decCart(i.id)}>−</button>
                  <span>{i.qty}</span>
                  <button type="button" onClick={() => incCart(i.id)}>+</button>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <b style={{ fontSize: '.92rem' }}>{mnt(i.price * i.qty)}</b>
                <button type="button" className="iconbtn" style={{ width: 28, height: 28, color: 'var(--muted)' }} aria-label="Хасах" onClick={() => removeCart(i.id)}>
                  <Icon name="x" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="drawer-foot" id="cartFoot">
          {cart.length === 0 ? (
            <Link className="btn btn-block" href="/catalog" onClick={closeCart}>Дэлгүүр хэсэх</Link>
          ) : (
            <>
              {remain > 0 ? (
                <div className="chip chip-gold" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
                  {mnt(remain)} нэмбэл хүргэлт үнэгүй
                </div>
              ) : null}
              <div className="sum-row"><span>Барааны дүн</span><b>{mnt(sub)}</b></div>
              <div className="sum-row"><span>Хүргэлт</span><b>{fee === 0 ? <span style={{ color: 'var(--ok)' }}>Үнэгүй</span> : mnt(fee)}</b></div>
              <div className="sum-row total"><span>Нийт</span><span className="price">{mnt(sub + fee)}</span></div>
              <Link className="btn btn-lg btn-block" href="/checkout" id="drawerCheckout" style={{ marginTop: 12 }} onClick={closeCart}>Захиалах</Link>
              <Link className="btn btn-ghost btn-block" href="/cart" id="drawerCart" style={{ marginTop: 6 }} onClick={closeCart}>Сагс харах</Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
