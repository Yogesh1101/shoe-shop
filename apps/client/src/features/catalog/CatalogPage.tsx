import { PRODUCT_SORT_LABELS, PRODUCT_SORT_OPTIONS, type ProductSort } from '@shoe-shop/shared';
import { SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useGetFacetsQuery, useGetProductsQuery } from '@/app/api/productApi';
import { EmptyState, ErrorState, ProductGridSkeleton } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { FilterSidebar } from '@/features/catalog/FilterSidebar';
import { ProductCard } from '@/features/catalog/ProductCard';
import { useCatalogParams } from '@/features/catalog/useCatalogParams';

export default function CatalogPage() {
  const { filters, queryParams, setFilter, toggleFilter, clearFilters, activeFilterCount } =
    useCatalogParams();

  const productsQuery = useGetProductsQuery(queryParams);
  const { data: facets } = useGetFacetsQuery();

  const filterProps = {
    facets,
    filters,
    activeFilterCount,
    onToggle: toggleFilter,
    onSet: setFilter,
    onClear: clearFilters,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {filters.q ? `Results for “${filters.q}”` : 'All shoes'}
          </h1>
          {productsQuery.data && (
            <p className="mt-1 text-sm text-muted-foreground">
              {productsQuery.data.total} {productsQuery.data.total === 1 ? 'shoe' : 'shoes'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* On phones the filters live in a bottom sheet, within thumb reach,
              rather than in a sidebar that would push the grid off screen. */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="outline" size="sm">
                <SlidersHorizontal />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="ml-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" title="Filters">
              <FilterSidebar {...filterProps} />
            </SheetContent>
          </Sheet>

          <Select
            value={filters.sort}
            onValueChange={(value: ProductSort) => setFilter('sort', value)}
          >
            <SelectTrigger className="h-9 w-[180px] text-sm" aria-label="Sort products">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_SORT_OPTIONS.filter(
                // "Best match" only means anything alongside a search term.
                (option) => option !== 'relevance' || filters.q,
              ).map((option) => (
                <SelectItem key={option} value={option}>
                  {PRODUCT_SORT_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-8 flex gap-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <FilterSidebar {...filterProps} />
        </aside>

        <div className="min-w-0 flex-1">
          {productsQuery.isLoading ? (
            <ProductGridSkeleton />
          ) : productsQuery.isError ? (
            <ErrorState error={productsQuery.error} onRetry={() => void productsQuery.refetch()} />
          ) : productsQuery.data && productsQuery.data.items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {productsQuery.data.items.map((product, index) => (
                  <ProductCard key={product._id} product={product} priority={index < 4} />
                ))}
              </div>

              {productsQuery.data.totalPages > 1 && (
                <nav
                  className="mt-12 flex items-center justify-center gap-4"
                  aria-label="Pagination"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.page <= 1}
                    onClick={() => setFilter('page', filters.page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {productsQuery.data.page} of {productsQuery.data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.page >= productsQuery.data.totalPages}
                    onClick={() => setFilter('page', filters.page + 1)}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          ) : (
            <EmptyState
              icon="search"
              title="No shoes match those filters"
              description={
                activeFilterCount > 0
                  ? 'Try removing a filter or two.'
                  : 'Nothing has been added to the shop yet.'
              }
              action={
                activeFilterCount > 0 ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link to="/">Back to home</Link>
                  </Button>
                )
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
