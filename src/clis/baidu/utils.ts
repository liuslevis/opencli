import { CliError } from '../../errors.js';

const BAIDU_BASE = 'https://www.baidu.com';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; opencli)';

export interface BaiduSuggestionItem {
  suggestion: string;
  type: string;
}

export interface BaiduSearchOptions {
  offset?: number;
}

export async function baiduFetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
    },
  });

  if (!resp.ok) {
    throw new CliError(
      'FETCH_ERROR',
      `Baidu HTTP ${resp.status}`,
      'Baidu may be temporarily unavailable. Try again later.',
    );
  }

  return resp.json() as Promise<T>;
}

export function buildBaiduSuggestUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('prod', 'pc');
  params.set('wd', query);
  return `${BAIDU_BASE}/sugrec?${params.toString()}`;
}

export function buildBaiduSearchUrl(query: string, options: BaiduSearchOptions = {}): string {
  const params = new URLSearchParams();
  params.set('wd', query);
  const offset = Math.max(Number(options.offset) || 0, 0);
  if (offset > 0) {
    params.set('pn', String(offset));
  }
  return `${BAIDU_BASE}/s?${params.toString()}`;
}

export function parseBaiduSuggest(payload: any): BaiduSuggestionItem[] {
  if (!Array.isArray(payload?.g)) return [];

  return payload.g
    .map((item: any) => ({
      suggestion: String(item?.q || '').trim(),
      type: String(item?.type || 'sug').trim() || 'sug',
    }))
    .filter((item: BaiduSuggestionItem) => item.suggestion);
}
