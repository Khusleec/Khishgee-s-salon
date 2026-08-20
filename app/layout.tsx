import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../styles/app.css';
import '../styles/mobile.css';
import SwRegister from './sw-register';

export const metadata: Metadata = {
  title: "Khishgee's Salon — Мэргэжлийн үс, хумсны бүтээгдэхүүн",
  description: 'Салоны чанартай үс, хумсны бүтээгдэхүүн. Улаанбаатар хотод 24 цагийн дотор хүргэнэ. Жинхэнэ бүтээгдэхүүний баталгаа.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7b2e52',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mn">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
