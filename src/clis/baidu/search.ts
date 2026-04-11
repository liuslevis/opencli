import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { buildBaiduSearchUrl } from './utils.js';
import {
  SEARCH_PAGE_SIZE,
  appendUniqueSearchResults,
  emitPartialSearchWarning,
  getAutoPaginationMaxPages,
  getPaginationFooterExtra,
  pauseBeforeSearchPageHop,
  resolveAutoPaginatedLimit,
} from '../search-pagination.js';

type BaiduSearchResult = {
  title: string;
  snippet: string;
  url: string;
};

type BaiduSearchPageData = {
  results: BaiduSearchResult[];
  hasNext: boolean;
};

function isBaiduSearchPageData(value: unknown): value is BaiduSearchPageData {
  return !!value
    && typeof value === 'object'
    && 'results' in value
    && Array.isArray((value as BaiduSearchPageData).results)
    && 'hasNext' in value
    && typeof (value as BaiduSearchPageData).hasNext === 'boolean';
}

function buildBaiduSearchExtractScript(limit: number): string {
  return `
    (() => {
      const limit = ${limit};
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const bodyText = normalize(document.body?.innerText || '');
      const titleText = normalize(document.title || '');
      if (/\\u5b89\\u5168\\u9a8c\\u8bc1/.test(bodyText) || /\\u5b89\\u5168\\u9a8c\\u8bc1/.test(titleText)) {
        return { error: 'Baidu returned a security verification page. Open the query in Chrome once and retry.' };
      }

      const results = [];
      const containers = Array.from(document.querySelectorAll('.result, .result-op, .c-container, .c-result'));

      for (const node of containers) {
        const titleNode = node.querySelector('h3');
        const anchors = Array.from(node.querySelectorAll('a'));
        const anchor = anchors.find((item) => normalize(item.textContent) === normalize(titleNode?.textContent || '')) || anchors[0];
        const title = normalize(titleNode?.textContent || anchor?.textContent || '');
        const url = String(anchor?.href || '').trim();
        if (!title || !url) continue;

        const text = normalize(node.innerText || '');
        const lines = text.split(/\\n+/).map(normalize).filter(Boolean);
        const snippet = (lines.find((line) => line !== title && line.length > 12) || text.replace(title, '').trim()).slice(0, 220);

        results.push({ title, snippet, url });
        if (results.length >= limit) break;
      }

      const hasNext = Array.from(document.querySelectorAll('a')).some((item) => {
        const text = normalize(item.textContent || item.getAttribute('aria-label') || item.getAttribute('title') || '');
        return /\\u4e0b\\u4e00\\u9875|\\u4e0b\\u9875|\\u540e\\u4e00\\u9875/.test(text) && /(wd=|pn=)/.test(String(item.getAttribute('href') || ''));
      });

      return { results, hasNext };
    })()
  `;
}

cli({
  site: 'baidu',
  name: 'search',
  description: 'Search Baidu web results via browser-rendered DOM',
  domain: 'www.baidu.com',
  strategy: Strategy.UI,
  footerExtra: getPaginationFooterExtra,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results to collect across pages (max 100)' },
  ],
  columns: ['rank', 'title', 'snippet', 'url'],
  func: async (page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'Search query is required');
    }

    const limit = resolveAutoPaginatedLimit(args.limit);
    const seen = new Set<string>();
    const results: BaiduSearchResult[] = [];
    const maxPages = getAutoPaginationMaxPages(limit);
    let stopReason = '';

    for (let pageIndex = 0; pageIndex < maxPages && results.length < limit; pageIndex++) {
      if (pageIndex > 0) {
        await pauseBeforeSearchPageHop(page);
      }

      await page.goto(buildBaiduSearchUrl(query, { offset: pageIndex * SEARCH_PAGE_SIZE }));
      await page.wait(2);

      const data = await page.evaluate(buildBaiduSearchExtractScript(SEARCH_PAGE_SIZE)) as BaiduSearchPageData | { error?: string } | undefined;
      if (!isBaiduSearchPageData(data)) {
        if (results.length > 0) {
          stopReason = data?.error || 'Baidu blocked pagination';
          break;
        }
        throw new CliError('FETCH_ERROR', data?.error || 'Baidu search page did not return parseable results');
      }

      if (!data.results.length) {
        stopReason = 'Baidu returned a page with no parseable results';
        break;
      }

      const added = appendUniqueSearchResults(results, data.results, seen, limit);
      if (results.length >= limit) break;
      if (added === 0) {
        stopReason = 'Baidu returned only duplicate results on another page';
        break;
      }
      if (!data.hasNext) {
        stopReason = 'Baidu did not expose another results page';
        break;
      }
    }

    if (!results.length) {
      throw new CliError('NOT_FOUND', 'No Baidu search results found', 'Try another query, or open the query in Chrome once and retry.');
    }

    emitPartialSearchWarning(
      args,
      'baidu',
      limit,
      results.length,
      stopReason || 'Baidu stopped returning new results',
    );

    return results.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      title: item.title,
      snippet: item.snippet,
      url: item.url,
    }));
  },
});
