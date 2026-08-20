'use client';

import { useEffect } from 'react';

/** Service worker бүртгэгч — PWA-гийн offline кэш */
export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* PWA сонголттой */ });
    }
  }, []);
  return null;
}
