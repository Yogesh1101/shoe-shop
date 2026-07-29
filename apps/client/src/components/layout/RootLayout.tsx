import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Toaster } from 'sonner';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Keyboard users should be able to jump the nav on every page. */}
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>

      <Header />

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <Footer />

      {/* Restores scroll on back/forward, and starts new pages at the top —
          without it, navigating from a scrolled catalog lands mid-product-page. */}
      <ScrollRestoration />
      <Toaster position="bottom-center" richColors closeButton />
    </div>
  );
}
