import type { ReactNode } from 'react';

export interface PolicyLayoutProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/** Shared shell for the Terms, Privacy, Refund, Shipping and Contact pages. */
export function PolicyLayout({ title, updated, children }: PolicyLayoutProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      <div className="mt-10 space-y-8">{children}</div>
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
