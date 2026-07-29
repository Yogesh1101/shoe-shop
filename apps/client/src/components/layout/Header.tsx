import { CATEGORIES, CATEGORY_LABELS } from '@shoe-shop/shared';
import { Menu, Search, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useGetPublicSettingsQuery } from '@/app/api/settingsApi';
import { useAppSelector } from '@/app/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export function Header() {
  const { data: settings } = useGetPublicSettingsQuery();
  const cartCount = useAppSelector((state) =>
    state.cart.items.reduce((total, item) => total + item.qty, 0),
  );
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    // navigate() returns a promise in react-router 7; nothing here needs to
    // await the transition.
    void navigate(trimmed ? `/shoes?q=${encodeURIComponent(trimmed)}` : '/shoes');
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        {/* Mobile navigation */}
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" title="Browse">
            <nav className="flex flex-col">
              <SheetClose asChild>
                <Link to="/shoes" className="rounded-md px-2 py-3 text-sm hover:bg-accent">
                  All shoes
                </Link>
              </SheetClose>
              {CATEGORIES.map((category) => (
                <SheetClose asChild key={category}>
                  <Link
                    to={`/shoes?category=${category}`}
                    className="rounded-md px-2 py-3 text-sm hover:bg-accent"
                  >
                    {CATEGORY_LABELS[category]}
                  </Link>
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/" className="text-base font-semibold tracking-tight whitespace-nowrap">
          {/* Falls back until settings load, so the header never renders blank. */}
          {settings?.shopName ?? 'Shoe Shop'}
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          <Link to="/shoes" className="rounded-md px-3 py-2 text-sm hover:bg-accent">
            All shoes
          </Link>
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              to={`/shoes?category=${category}`}
              className="rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              {CATEGORY_LABELS[category]}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden max-w-xs flex-1 sm:block">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shoes"
              aria-label="Search shoes"
              className="h-10 pl-9"
            />
          </div>
        </form>

        <Button asChild variant="ghost" size="icon" className="relative ml-auto sm:ml-0">
          <Link to="/cart" aria-label={`Cart, ${cartCount} items`}>
            <ShoppingBag />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground tabular-nums">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Link>
        </Button>
      </div>
    </header>
  );
}
