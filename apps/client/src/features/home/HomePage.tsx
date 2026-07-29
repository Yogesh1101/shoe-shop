import { CATEGORIES, CATEGORY_LABELS } from '@shoe-shop/shared';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useGetProductsQuery } from '@/app/api/productApi';
import { useGetPublicSettingsQuery } from '@/app/api/settingsApi';
import { ErrorState, ProductGridSkeleton } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/features/catalog/ProductCard';

export default function HomePage() {
  const { data: settings } = useGetPublicSettingsQuery();
  // Newest first: for a shop restocked from wholesale, "what just came in" is
  // the most useful thing to put in front of someone arriving from Instagram.
  const latestQuery = useGetProductsQuery({ sort: 'newest', limit: 8 });

  return (
    <>
      <section className="border-b">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {settings?.shopName ?? 'Shoe Shop'}
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            Handpicked sneakers, formals and sports shoes. Order online, pay how you like, delivered
            across India.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/shoes">
                Shop all shoes
                <ArrowRight />
              </Link>
            </Button>
            {settings?.instagramUrl && (
              <Button asChild size="lg" variant="outline">
                <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer">
                  See us on Instagram
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="sr-only">Shop by category</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              to={`/shoes?category=${category}`}
              className="group flex items-center justify-between rounded-lg border p-6 transition-colors hover:bg-accent"
            >
              <span className="text-lg font-medium">{CATEGORY_LABELS[category]}</span>
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight">New arrivals</h2>
          <Link to="/shoes" className="text-sm hover:underline">
            View all
          </Link>
        </div>

        <div className="mt-6">
          {latestQuery.isLoading ? (
            <ProductGridSkeleton count={8} />
          ) : latestQuery.isError ? (
            <ErrorState error={latestQuery.error} onRetry={() => void latestQuery.refetch()} />
          ) : latestQuery.data && latestQuery.data.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {latestQuery.data.items.map((product, index) => (
                <ProductCard key={product._id} product={product} priority={index < 4} />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No shoes have been added yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
