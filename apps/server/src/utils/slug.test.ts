import { describe, expect, it } from 'vitest';

import { financialYear } from './sequence.js';
import { slugify } from './slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Nike Air Max 90')).toBe('nike-air-max-90');
  });

  it('collapses punctuation into single hyphens', () => {
    expect(slugify('Air Max 90 (Black/White)')).toBe('air-max-90-black-white');
    expect(slugify('Cloud   Step  --  Runner')).toBe('cloud-step-runner');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  ...Court Classic!  ')).toBe('court-classic');
  });

  it('strips diacritics so lookalike names produce one slug', () => {
    expect(slugify('Adidas Forum Ré')).toBe('adidas-forum-re');
  });

  it('caps length without leaving a trailing hyphen', () => {
    const slug = slugify('a'.repeat(60) + ' ' + 'b'.repeat(60));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns empty for input with nothing sluggable, so callers can fall back', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('financialYear', () => {
  it('runs April to March, as Indian financial years do', () => {
    // April 1st starts the new year...
    expect(financialYear(new Date('2026-04-01T00:00:00Z'))).toBe('2026-27');
    expect(financialYear(new Date('2026-07-29T00:00:00Z'))).toBe('2026-27');
    expect(financialYear(new Date('2027-03-31T00:00:00Z'))).toBe('2026-27');
    // ...and April 1st the following year rolls it over.
    expect(financialYear(new Date('2027-04-01T00:00:00Z'))).toBe('2027-28');
  });

  it('places January to March in the year that began the previous April', () => {
    expect(financialYear(new Date('2026-01-15T00:00:00Z'))).toBe('2025-26');
  });

  it('pads the second half of a century rollover', () => {
    expect(financialYear(new Date('2099-06-01T00:00:00Z'))).toBe('2099-00');
  });
});
