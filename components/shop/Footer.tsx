'use client';
import Link from 'next/link';
import { Icon } from './Icon';
import { useShop } from './store';

export function Footer() {
  const { settings: s, toast } = useShop();

  return (
    <footer className="site-footer">
      <div className="wrap footer-top">
        <div>
          <div className="logo" style={{ marginBottom: 14 }}>
            <span className="logo-mark">K</span>
            <span className="logo-text">
              <span className="logo-name" style={{ color: '#fff' }}>Khishgee&#39;s</span><br />
              <span className="logo-sub">Salon Supply</span>
            </span>
          </div>
          <p style={{ fontSize: '.9rem', maxWidth: '34ch' }}>Мэргэжлийн үсчин, маникюрчдод зориулсан жинхэнэ бүтээгдэхүүнийг 2018 оноос хойш Монголд нийлүүлж байна.</p>
          <div className="socials">
            <a href="#" aria-label="Facebook"><svg width={18} height={18}><use href="#i-fb" /></svg></a>
            <a href="#" aria-label="Instagram"><svg width={18} height={18}><use href="#i-ig" /></svg></a>
            <a href="#" aria-label="Имэйл"><svg width={18} height={18}><use href="#i-mail" /></svg></a>
          </div>
        </div>
        <div>
          <h4>Дэлгүүр</h4>
          <div className="footer-links">
            <Link href="/catalog?kind=hair">Үсний бүтээгдэхүүн</Link>
            <Link href="/catalog?kind=nail">Хумсны бүтээгдэхүүн</Link>
            <Link href="/catalog?sale=1">Хямдралтай</Link>
            <Link href="/catalog?sort=new">Шинэ бараа</Link>
            <Link href="/catalog?sort=popular">Эрэлттэй</Link>
          </div>
        </div>
        <div>
          <h4>Тусламж</h4>
          <div className="footer-links">
            <Link href="/track">Захиалга шалгах</Link>
            <Link href="/help">Хүргэлт ба төлбөр</Link>
            <Link href="/help">Буцаалтын нөхцөл</Link>
            <Link href="/about">Бидний тухай</Link>
            <a href="/admin">Ажилтны хэсэг</a>
          </div>
        </div>
        <div>
          <h4>Холбоо барих</h4>
          <div className="footer-links" id="footerContact">
            <span className="row" style={{ gap: 9, alignItems: 'flex-start' }}><Icon name="pin" size={17} /><span>{s.address || ''}</span></span>
            <a className="row" style={{ gap: 9 }} href={`tel:${s.phone || ''}`}><Icon name="phone" size={17} /><span>{s.phone || ''} · {s.phone2 || ''}</span></a>
            <a className="row" style={{ gap: 9 }} href={`mailto:${s.email || ''}`}><Icon name="mail" size={17} /><span>{s.email || ''}</span></a>
            <span className="row" style={{ gap: 9 }}><Icon name="clock" size={17} /><span>{s.work_hours || ''}</span></span>
          </div>
          <form
            className="newsletter"
            id="newsForm"
            onSubmit={(e) => {
              e.preventDefault();
              (e.target as HTMLFormElement).reset();
              toast('Бүртгэгдлээ! Хямдралын мэдээг хүргэх болно.', 'ok');
            }}
          >
            <input type="email" placeholder="Имэйл хаяг" aria-label="Имэйл" required />
            <button className="btn btn-gold btn-sm" type="submit">Илгээх</button>
          </form>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© <span id="year">{new Date().getFullYear()}</span> Khishgee&#39;s Salon Supply ХХК · Регистр 6xxxxxx</span>
        <span>Хаан банк · Голомт банк · QPay · Бэлнээр</span>
      </div>
    </footer>
  );
}
