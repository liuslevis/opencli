import { describe, expect, it, vi } from 'vitest';
import { emitPartialSearchWarning, resolveAutoPaginatedLimit } from './search-pagination.js';

describe('resolveAutoPaginatedLimit', () => {
  it('accepts limits within 1..100', () => {
    expect(resolveAutoPaginatedLimit(1)).toBe(1);
    expect(resolveAutoPaginatedLimit(100)).toBe(100);
  });

  it('rejects zero, negative, and over-cap limits', () => {
    expect(() => resolveAutoPaginatedLimit(0)).toThrowError(/between 1 and 100/i);
    expect(() => resolveAutoPaginatedLimit(-1)).toThrowError(/between 1 and 100/i);
    expect(() => resolveAutoPaginatedLimit(101)).toThrowError(/between 1 and 100/i);
  });
});

describe('emitPartialSearchWarning', () => {
  it('stores and prints a single partial-results warning', () => {
    const kwargs: Record<string, any> = {};
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    emitPartialSearchWarning(kwargs, 'google', 20, 13, 'Google did not expose another results page');
    emitPartialSearchWarning(kwargs, 'google', 20, 13, 'This should not be emitted twice');

    expect(kwargs._paginationWarning).toBe('Partial results: returned 13/20 because Google did not expose another results page.');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[opencli:google] Warning: Partial results: returned 13/20 because Google did not expose another results page.');
  });
});
