import { CliError } from '../errors.js';
import type { IPage } from '../types.js';

export const SEARCH_PAGE_SIZE = 10;
export const SEARCH_LIMIT_DEFAULT = 10;
export const SEARCH_LIMIT_MAX = 100;

const PAGE_HOP_MIN_SECONDS = 1.2;
const PAGE_HOP_JITTER_SECONDS = 1.2;

type SearchResultLike = {
  title?: string;
  url?: string;
};

export function resolveAutoPaginatedLimit(value: unknown, defaultValue: number = SEARCH_LIMIT_DEFAULT): number {
  const raw = value == null ? defaultValue : Number(value);
  if (!Number.isInteger(raw)) {
    throw new CliError('INVALID_ARG', 'Search limit must be an integer', `Use --limit 1 to ${SEARCH_LIMIT_MAX}`);
  }
  if (raw < 1 || raw > SEARCH_LIMIT_MAX) {
    throw new CliError('INVALID_ARG', `Search limit must be between 1 and ${SEARCH_LIMIT_MAX}`, `Use --limit 1 to ${SEARCH_LIMIT_MAX}`);
  }
  return raw;
}

export function getAutoPaginationMaxPages(limit: number): number {
  void limit;
  return Math.max(1, Math.ceil(SEARCH_LIMIT_MAX / SEARCH_PAGE_SIZE));
}

export function defaultSearchResultKey(item: SearchResultLike): string {
  return `${String(item.title || '').trim()}|${String(item.url || '').trim()}`;
}

export function appendUniqueSearchResults<T extends SearchResultLike>(
  target: T[],
  items: T[],
  seen: Set<string>,
  limit: number,
  keyFn: (item: T) => string = defaultSearchResultKey,
): number {
  let added = 0;
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    target.push(item);
    added++;
    if (target.length >= limit) break;
  }
  return added;
}

export async function pauseBeforeSearchPageHop(page: IPage): Promise<void> {
  const seconds = Number((PAGE_HOP_MIN_SECONDS + Math.random() * PAGE_HOP_JITTER_SECONDS).toFixed(2));
  await page.wait(seconds);
}

export function emitPartialSearchWarning(
  kwargs: Record<string, any>,
  site: string,
  requested: number,
  actual: number,
  reason: string,
): void {
  if (actual <= 0 || actual >= requested || kwargs._paginationWarning) return;

  const normalizedReason = String(reason || 'the search engine stopped returning new results')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '');
  const message = `Partial results: returned ${actual}/${requested} because ${normalizedReason}.`;

  kwargs._paginationWarning = message;
  console.error(`[opencli:${site}] Warning: ${message}`);
}

export function getPaginationFooterExtra(kwargs: Record<string, any>): string | undefined {
  return typeof kwargs?._paginationWarning === 'string' ? kwargs._paginationWarning : undefined;
}
