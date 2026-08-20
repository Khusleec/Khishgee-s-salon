'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShop } from './store';

export function Fab() {
  const { settings: s } = useShop();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Хуудас солигдоход хаагдана (эх SPA render() бүрд хаадаг байсан)
  useEffect(() => { setOpen(false); }, [pathname]);

  const fbPage = (s.facebook || '').replace(/^https?:\/\//, '').replace(/^facebook\.com\//, '').replace(/\/$/, '');

  return (
    <div className="fab" id="fab">
      <div className="fab-actions" id="fabActions" hidden={!open}>
        <a className="fab-action" id="fabCall" href={`tel:${(s.phone || '').replace(/[^0-9+]/g, '')}`} onClick={() => setOpen(false)}>
          <svg width={17} height={17}><use href="#i-phone" /></svg> Утсаар залгах
        </a>
        <a
          className="fab-action"
          id="fabMsg"
          href={fbPage ? `https://m.me/${fbPage}` : 'https://facebook.com'}
          target="_blank"
          rel="noopener"
          onClick={() => setOpen(false)}
        >
          <svg width={17} height={17}><use href="#i-msg" /></svg> Messenger
        </a>
        <Link className="fab-action" href="/track" onClick={() => setOpen(false)}>
          <svg width={17} height={17}><use href="#i-box" /></svg> Захиалга шалгах
        </Link>
      </div>
      <button
        type="button"
        className={`fab-main${open ? ' on' : ''}`}
        id="fabBtn"
        aria-label="Тусламж, холбоо барих"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width={23} height={23}><use href="#i-headset" /></svg>
      </button>
    </div>
  );
}
