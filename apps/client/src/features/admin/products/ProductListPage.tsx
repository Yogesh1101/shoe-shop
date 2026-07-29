import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Product,
  SHOE_TYPE_LABELS,
  SHOE_TYPES,
} from '@shoe-shop/shared';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useDeleteProductMutation, useGetAdminProductsQuery } from '@/app/api/adminProductApi';
import { CloudinaryImage } from '@/components/common/CloudinaryImage';
import { Money } from '@/components/common/Money';
import { ErrorState } from '@/components/common/States';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge, Input, Skeleton } from '@/components/ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

const PAGE_SIZE = 20;
const ALL = '__all__';

function totalStock(product: Product): number {
  return product.variants
    .flatMap((variant) => variant.sizes)
    .reduce((total, s) => total + s.stock, 0);
}

function DeleteProductButton({ product }: { product: Product }) {
  const [deleteProduct, deleteResult] = useDeleteProductMutation();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Delete ${product.name}`}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
        <AlertDialogDescription>
          This removes the listing and its photos permanently. Past orders that included this shoe
          are not affected — their details are stored independently. This cannot be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteResult.isLoading}
            onClick={() => void deleteProduct(product._id)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const columnHelper = createColumnHelper<Product>();

export default function ProductListPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useGetAdminProductsQuery({
    q: debouncedSearch || undefined,
    category: category === ALL ? undefined : category,
    type: type === ALL ? undefined : type,
    page,
    limit: PAGE_SIZE,
  });

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'photo',
        header: '',
        cell: ({ row }) => {
          const image = row.original.variants[0]?.images[0]?.url;
          return (
            <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
              {image && <CloudinaryImage src={image} alt="" width={96} sizes="48px" />}
            </div>
          );
        },
      }),
      columnHelper.accessor('name', {
        header: 'Product',
        cell: ({ row }) => (
          <div>
            <Link
              to={`/admin/products/${row.original._id}`}
              className="font-medium hover:underline"
            >
              {row.original.name}
            </Link>
            <p className="text-xs text-muted-foreground">{row.original.brand}</p>
          </div>
        ),
      }),
      columnHelper.display({
        id: 'category',
        header: 'Category',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {CATEGORY_LABELS[row.original.category]} · {SHOE_TYPE_LABELS[row.original.type]}
          </span>
        ),
      }),
      columnHelper.accessor('pricePaise', {
        header: 'Price',
        cell: ({ row }) => <Money paise={row.original.pricePaise} />,
      }),
      columnHelper.display({
        id: 'stock',
        header: 'Stock',
        cell: ({ row }) => {
          const stock = totalStock(row.original);
          return (
            <span className={stock === 0 ? 'text-destructive' : undefined}>{stock} pairs</span>
          );
        },
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'muted'}>
            {row.original.isActive ? 'Published' : 'Hidden'}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DeleteProductButton product={row.original} />
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: query.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <Button asChild>
          <Link to="/admin/products/new">
            <Plus />
            Add product
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={type}
          onValueChange={(value) => {
            setType(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {SHOE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {SHOE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-medium text-muted-foreground">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {query.isLoading &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td colSpan={columns.length} className="px-4 py-3">
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              ))}

            {!query.isLoading &&
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-accent/40">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}

            {!query.isLoading && query.data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No products match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}

      {query.data && query.data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {query.data.page} of {query.data.totalPages} · {query.data.total} products
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= query.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
