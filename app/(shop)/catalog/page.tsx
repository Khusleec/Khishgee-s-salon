import { Suspense } from 'react';
import CatalogClient from './catalog-client';

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogClient />
    </Suspense>
  );
}
