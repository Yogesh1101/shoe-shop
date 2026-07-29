import { AlertCircle, PackageX, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';

import { normaliseError } from '@/app/api/baseApi';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Empty, error and loading states.
 *
 * Worth building properly rather than leaving as afterthoughts: on a free
 * Render instance the very first request after fifteen idle minutes can take
 * roughly fifty seconds while the service wakes. Whatever is on screen during
 * that wait is a real part of the shopping experience, not an edge case.
 */

export interface EmptyStateProps {
  icon?: 'search' | 'package';
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = 'package',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon = icon === 'search' ? SearchX : PackageX;

  return (
    <div className={cn('flex flex-col items-center py-16 text-center', className)}>
      <Icon className="size-10 text-muted-foreground/50" aria-hidden />
      <h2 className="mt-4 text-base font-medium">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const { message, code } = normaliseError(error);

  return (
    <div className={cn('flex flex-col items-center py-16 text-center', className)} role="alert">
      <AlertCircle className="size-10 text-destructive" aria-hidden />
      <h2 className="mt-4 text-base font-medium">Something went wrong</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {code === 'NETWORK_ERROR' && (
        <p className="mt-2 max-w-sm text-xs text-muted-foreground">
          If the shop has been quiet for a while, the server may be waking up. This can take up to a
          minute.
        </p>
      )}
      {onRetry && (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Placeholder matching a `ProductCard`, so the grid does not jump on load. */
export function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
