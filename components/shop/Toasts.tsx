'use client';
import { Icon } from './Icon';
import { useShop } from './store';

export function Toasts() {
  const { toasts } = useShop();
  return (
    <div className="toasts" id="toasts">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type}`}
          style={t.hiding ? { transition: 'opacity .3s, transform .3s', opacity: 0, transform: 'translateX(20px)' } : undefined}
        >
          {t.type === 'ok' ? <Icon name="check" size={18} /> : t.type === 'err' ? <Icon name="x" size={18} /> : <Icon name="spark" size={18} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
