import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * Without `twMerge`, `cn('px-4', 'px-6')` emits both and the winner depends on
 * CSS source order — so a component's prop could not reliably override its own
 * default padding.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
