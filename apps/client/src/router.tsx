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
const CheckoutPage = lazy(() => import('@/features/checkout/CheckoutPage'));
const OrderStatusPage = lazy(() => import('@/features/order/OrderStatusPage'));
const TrackOrderPage = lazy(() => import('@/features/order/TrackOrderPage'));

const TermsPage = lazy(() => import('@/features/policies/TermsPage'));
const PrivacyPage = lazy(() => import('@/features/policies/PrivacyPage'));
const RefundPolicyPage = lazy(() => import('@/features/policies/RefundPolicyPage'));
const ShippingPolicyPage = lazy(() => import('@/features/policies/ShippingPolicyPage'));
const ContactPage = lazy(() => import('@/features/policies/ContactPage'));

const LoginPage = lazy(() => import('@/features/admin/auth/LoginPage'));
const RequireAdmin = lazy(() =>
  import('@/features/admin/auth/RequireAdmin').then((m) => ({ default: m.RequireAdmin })),
);
const AdminLayout = lazy(() =>
  import('@/features/admin/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const DashboardPage = lazy(() => import('@/features/admin/dashboard/DashboardPage'));
const ProductListPage = lazy(() => import('@/features/admin/products/ProductListPage'));
const ProductFormPage = lazy(() => import('@/features/admin/products/ProductFormPage'));
const OrderListPage = lazy(() => import('@/features/admin/orders/OrderListPage'));
const OrderDetailPage = lazy(() => import('@/features/admin/orders/OrderDetailPage'));
const SettingsPage = lazy(() => import('@/features/admin/settings/SettingsPage'));

function suspended(element: ReactNode): ReactNode {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

/**
 * One boundary for the whole admin subtree rather than one per route: React
 * Suspense catches a lazy load from any descendant, however deep, so
 * `RequireAdmin`, `AdminLayout` and the page itself can each ship their own
 * chunk while a visitor only ever sees a single loading flash.
 */
const ADMIN_FALLBACK = (
  <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
    Loading…
  </div>
);

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: suspended(<HomePage />) },
      { path: '/shoes', element: suspended(<CatalogPage />) },
      { path: '/shoes/:slug', element: suspended(<ProductPage />) },
      { path: '/cart', element: suspended(<CartPage />) },
      { path: '/checkout', element: suspended(<CheckoutPage />) },
      { path: '/order/:orderNumber', element: suspended(<OrderStatusPage />) },
      { path: '/track', element: suspended(<TrackOrderPage />) },
      { path: '/policies/terms', element: suspended(<TermsPage />) },
      { path: '/policies/privacy', element: suspended(<PrivacyPage />) },
      { path: '/policies/refund', element: suspended(<RefundPolicyPage />) },
      { path: '/policies/shipping', element: suspended(<ShippingPolicyPage />) },
      { path: '/contact', element: suspended(<ContactPage />) },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/admin/login', element: <Suspense fallback={ADMIN_FALLBACK}>{<LoginPage />}</Suspense> },
  {
    path: '/admin',
    element: <Suspense fallback={ADMIN_FALLBACK}>{<RequireAdmin />}</Suspense>,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'products', element: <ProductListPage /> },
          { path: 'products/new', element: <ProductFormPage /> },
          { path: 'products/:id', element: <ProductFormPage /> },
          { path: 'orders', element: <OrderListPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
]);
