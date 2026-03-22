import { CliError } from '../../errors.js';

const DUCKDUCKGO_SUGGEST_URL = 'https://duckduckgo.com/ac/';

export async function duckDuckGoFetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);

  if (!resp.ok) {
    throw new CliError(
      'FETCH_ERROR',
      `DuckDuckGo HTTP ${resp.status}`,
      'DuckDuckGo may be temporarily unavailable. Try again later.',
    );
  }

  return resp.json() as Promise<T>;
}

export function buildDuckDuckGoSuggestUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('type', 'list');
  return `${DUCKDUCKGO_SUGGEST_URL}?${params.toString()}`;
}

export function parseDuckDuckGoSuggest(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];

  if (Array.isArray(payload[1])) {
    return payload[1]
      .filter((value): value is string => typeof value === 'string')
      .map(value => value.trim())
      .filter(Boolean);
  }

  return payload
    .map((item: any) => String(item?.phrase || item?.value || '').trim())
    .filter(Boolean);
}
