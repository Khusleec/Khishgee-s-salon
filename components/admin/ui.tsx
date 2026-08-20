'use client';

import { useEffect, useState, type ReactNode } from 'react';

/* =========================================================================
   Нийтлэг UI хэсгүүд: дүрс, toast, sheet, алдааны хайрцаг
   ========================================================================= */

// ---------------------------------------------------------------------------
// SVG спрайтын дүрс
// ---------------------------------------------------------------------------
export function Icon({ n, s = 20 }: { n: string; s?: number }) {
  return <svg width={s} height={s} aria-hidden="true"><use href={`#i-${n}`} /></svg>;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
type ToastType = '' | 'ok' | 'err';
interface ToastItem { id: number; msg: string; type: ToastType; fading: boolean; }

let pushToast: ((msg: string, type: ToastType) => void) | null = null;

export function toast(msg: string, type: ToastType = ''): void {
  pushToast?.(msg, type);
}

export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 1;
    pushToast = (msg, type) => {
      const id = nextId++;
      setItems((xs) => [...xs, { id, msg, type, fading: false }]);
      setTimeout(() => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, fading: true } : x))), 3000);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3300);
    };
    return () => { pushToast = null; };
  }, []);

  return (
    <div className="toasts" id="toasts">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} style={t.fading ? { opacity: 0, transition: 'opacity .3s' } : undefined}>
          <Icon n={t.type === 'ok' ? 'check' : t.type === 'err' ? 'x' : 'spark'} s={18} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet — баруун талаас гарч ирэх хавтас
// ---------------------------------------------------------------------------
export function Sheet({ open, title, onClose, foot, children }: {
  open: boolean;
  title: string;
  onClose: () => void;
  foot?: ReactNode;
  children?: ReactNode;
}) {
  // Нээгдэх шилжилт хөдөлгөөн ажиллуулахын тулд 'on' классыг дараагийн frame-д нэмнэ
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!open) { setOn(false); return; }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setOn(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`overlay${open ? ' on' : ''}`} onClick={onClose} />
      <aside className={`sheet${open ? ' on' : ''}`}>
        <div className="sheet-head">
          <h3>{open ? title : '—'}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Хаах"><Icon n="x" s={20} /></button>
        </div>
        <div className="sheet-body">{open ? children : null}</div>
        <div className="sheet-foot">{open ? foot : null}</div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Алдааны хайрцаг (хуучин route()-ийн алдааны дэлгэцтэй ижил)
// ---------------------------------------------------------------------------
export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="box"><div className="box-body"><div className="empty">
      <h3>Алдаа гарлаа</h3><p>{msg}</p>
    </div></div></div>
  );
}

// ---------------------------------------------------------------------------
// Утасны өргөнтэй эсэх
// ---------------------------------------------------------------------------
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return mobile;
}
