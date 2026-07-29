/* eslint-disable react-refresh/only-export-components --
   This module's export is the router itself, not a component. The lazy() calls
   below are route definitions rather than components to hot-reload, so the rule
   has nothing useful to enforce here. */
import { lazy, type ReactNode, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { NotFound, PageFallback } from '@/components/common/NotFound';
import { RootLayout } from '@/components/layout/RootLayout';

/**
 * Routes are lazy so each page ships its own chunk — including the RTK Query
 * endpoints it injects. A shopper who only browses never downloads the checkout
 * form or, later, the admin panel.
 */
const HomePage = lazy(() => import('@/features/home/HomePage'));
const CatalogPage = lazy(() => import('@/features/catalog/CatalogPage'));
const ProductPage = lazy(() => import('@/features/product/ProductPage'));
const CartPage = lazy(() => import('@/features/cart/CartPage'));

function suspended(element: ReactNode): ReactNode {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: suspended(<HomePage />) },
      { path: '/shoes', element: suspended(<CatalogPage />) },
      { path: '/shoes/:slug', element: suspended(<ProductPage />) },
      { path: '/cart', element: suspended(<CartPage />) },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
