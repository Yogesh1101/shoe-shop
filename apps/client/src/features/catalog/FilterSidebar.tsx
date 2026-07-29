import { CATEGORIES, CATEGORY_LABELS, type ProductFacets } from '@shoe-shop/shared';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/primitives';
import type { CatalogFilters } from '@/features/catalog/useCatalogParams';
import { cn } from '@/lib/utils';

export interface FilterSidebarProps {
  facets?: ProductFacets;
  filters: CatalogFilters;
  activeFilterCount: number;
  onToggle: (key: 'brand' | 'color' | 'size', value: string) => void;
  onSet: (key: string, value: string | undefined) => void;
  onClear: () => void;
}

export function FilterSidebar({
  facets,
  filters,
  activeFilterCount,
  onToggle,
  onSet,
  onClear,
}: FilterSidebarProps) {
  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-sm font-semibold">Filters</h2>
        {activeFilterCount > 0 && (
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onClear}>
            Clear all
          </Button>
        )}
      </div>

      <Accordion type="multiple" defaultValue={['category', 'brand', 'size']} className="w-full">
        <AccordionItem value="category">
          <AccordionTrigger>Category</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map((category) => {
                const selected = filters.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    // Categories are single-select: clicking the active one
                    // clears it, which is how a shopper "goes back to all".
                    onClick={() => onSet('category', selected ? undefined : category)}
                    className={cn(
                      'rounded-md px-2 py-2 text-left text-sm',
                      selected ? 'bg-accent font-medium' : 'hover:bg-accent',
                    )}
                    aria-pressed={selected}
                  >
                    {CATEGORY_LABELS[category]}
                  </button>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {facets && facets.brands.length > 0 && (
          <AccordionItem value="brand">
            <AccordionTrigger>Brand</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-3">
                {facets.brands.map((brand) => (
                  <div key={brand} className="flex items-center gap-3">
                    <Checkbox
                      id={`brand-${brand}`}
                      checked={filters.brand.includes(brand)}
                      onCheckedChange={() => onToggle('brand', brand)}
                    />
                    <Label htmlFor={`brand-${brand}`} className="cursor-pointer font-normal">
                      {brand}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {facets && facets.sizes.length > 0 && (
          <AccordionItem value="size">
            <AccordionTrigger>Size (UK)</AccordionTrigger>
            <AccordionContent>
              {/* Only sizes with stock somewhere in the catalog are offered,
                  so a filter can never lead to an empty grid. */}
              <div className="grid grid-cols-4 gap-2">
                {facets.sizes.map((size) => {
                  const selected = filters.size.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onToggle('size', String(size))}
                      aria-pressed={selected}
                      className={cn(
                        'h-10 rounded-md border text-sm',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input hover:bg-accent',
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {facets && facets.colors.length > 0 && (
          <AccordionItem value="color">
            <AccordionTrigger>Colour</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-2">
                {facets.colors.map(({ color, colorHex }) => {
                  const selected = filters.color.includes(color);
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onToggle('color', color)}
                      aria-pressed={selected}
                      title={color}
                      className={cn(
                        'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs',
                        selected ? 'border-primary bg-accent' : 'border-input hover:bg-accent',
                      )}
                    >
                      <span
                        className="size-5 rounded-full border border-border"
                        style={{ backgroundColor: colorHex }}
                      />
                      {color}
                    </button>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
