import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SizeSelector } from './SizeSelector';

const SIZES = [
  { size: 9, stock: 0 },
  { size: 7, stock: 3 },
  { size: 8, stock: 0 },
  { size: 10, stock: 5 },
];

describe('SizeSelector', () => {
  it('shows out-of-stock sizes rather than hiding them', () => {
    // "They don't have my size" is information a shopper can act on. A missing
    // button just reads as a broken page.
    render(<SizeSelector sizes={SIZES} selectedSize={null} onSelect={vi.fn()} />);

    for (const { size } of SIZES) {
      expect(screen.getByRole('button', { name: new RegExp(`UK ${size}\\b`) })).toBeVisible();
    }
  });

  it('disables the sizes that are out of stock', () => {
    render(<SizeSelector sizes={SIZES} selectedSize={null} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: /UK 9, out of stock/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /UK 8, out of stock/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /UK 7$/ })).toBeEnabled();
  });

  it('announces unavailability to screen readers, not just visually', () => {
    render(<SizeSelector sizes={SIZES} selectedSize={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'UK 9, out of stock' })).toBeInTheDocument();
  });

  it('orders sizes ascending regardless of input order', () => {
    render(<SizeSelector sizes={SIZES} selectedSize={null} onSelect={vi.fn()} />);

    const labels = screen.getAllByRole('button').map((button) => button.textContent?.trim());
    expect(labels).toEqual(['7', '8', '9', '10']);
  });

  it('reports the chosen size', async () => {
    const onSelect = vi.fn();
    render(<SizeSelector sizes={SIZES} selectedSize={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /UK 10$/ }));
    expect(onSelect).toHaveBeenCalledWith(10);
  });

  it('does not fire for an out-of-stock size', async () => {
    const onSelect = vi.fn();
    render(<SizeSelector sizes={SIZES} selectedSize={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /UK 9, out of stock/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the selected size as pressed', () => {
    render(<SizeSelector sizes={SIZES} selectedSize={7} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /UK 7$/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
