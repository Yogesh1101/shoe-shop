import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Slide-over panel, built on Radix Dialog so focus trapping, scroll locking,
 * Escape handling and `aria-modal` come for free.
 *
 * Used for the mobile filter panel and the cart drawer. On a phone these open
 * from the bottom, which puts the controls within thumb reach rather than at
 * the top of the screen.
 */

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

type SheetSide = 'bottom' | 'right';

export interface SheetContentProps extends ComponentProps<typeof Dialog.Content> {
  side?: SheetSide;
  /** Required: Radix warns without it, and screen readers need the announcement. */
  title: string;
  description?: string;
}

export function SheetContent({
  className,
  children,
  side = 'right',
  title,
  description,
  ...props
}: SheetContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Content
        className={cn(
          'fixed z-50 flex flex-col gap-4 bg-background shadow-lg',
          side === 'right' && 'inset-y-0 right-0 h-full w-full max-w-sm border-l',
          side === 'bottom' && 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between border-b px-4 py-3">
          <div>
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            ) : (
              // Radix logs a warning without a description; hide it visually
              // rather than leaving the dialog unlabelled for screen readers.
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
          </div>
          <Dialog.Close className="-mr-1 rounded-md p-1.5 hover:bg-accent" aria-label="Close">
            <X className="size-5" />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
