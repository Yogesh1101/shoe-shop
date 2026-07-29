import { Link } from 'react-router-dom';

import { EmptyState, ProductGridSkeleton } from '@/components/common/States';
import { Button } from '@/components/ui/button';

/** Shown while a lazily-loaded route chunk is still downloading. */
export function PageFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <ProductGridSkeleton />
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4">
      <EmptyState
        icon="search"
        title="Page not found"
        description="That link may be out of date, or the shoe may have been taken down."
        action={
          <Button asChild>
            <Link to="/shoes">Browse all shoes</Link>
          </Button>
        }
      />
    </div>
  );
}
