import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../../styles/admin.css';
import '../../styles/admin-mobile.css';
import AdminChrome from '../../components/admin/chrome';

export const metadata: Metadata = {
  title: "Админ · Khishgee's Salon",
  robots: { index: false },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='12' fill='%23241726'/%3E%3Ctext x='20' y='27' font-family='Georgia,serif' font-size='18' fill='%23e0a75e' text-anchor='middle'%3EA%3C/text%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#241726',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
