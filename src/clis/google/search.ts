import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { buildGoogleSearchUrl } from './utils.js';
import {
  SEARCH_PAGE_SIZE,
  appendUniqueSearchResults,
  emitPartialSearchWarning,
  getAutoPaginationMaxPages,
  getPaginationFooterExtra,
  pauseBeforeSearchPageHop,
  resolveAutoPaginatedLimit,
} from '../search-pagination.js';

type GoogleSearchResult = {
  title: string;
  snippet: string;
  url: string;
};

type GoogleSearchPageData = {
  results: GoogleSearchResult[];
  hasNext: boolean;
};

function isGoogleSearchPageData(value: unknown): value is GoogleSearchPageData {
  return !!value
    && typeof value === 'object'
    && 'results' in value
    && Array.isArray((value as GoogleSearchPageData).results)
    && 'hasNext' in value
    && typeof (value as GoogleSearchPageData).hasNext === 'boolean';
}

function buildGoogleSearchExtractScript(limit: number): string {
  return `
    (() => {
      const limit = ${limit};
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const decodeUrl = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
          const url = new URL(raw, location.origin);
          if (/google\\./i.test(url.hostname) && url.pathname === '/url') {
            return url.searchParams.get('q') || url.searchParams.get('url') || '';
          }
          return url.toString();
        } catch {
          return raw;
        }
      };
      const bodyText = normalize(document.body?.innerText || '');
      if (/unusual traffic/i.test(bodyText) || /enablejs/i.test(bodyText)) {
        return { error: 'Google returned an anti-bot or enable-JavaScript interstitial. Open the query in Chrome once and retry.' };
      }

      const results = [];
      const containers = Array.from(document.querySelectorAll('#search .MjjYud, #search .g, #rso .MjjYud, #rso .g'));
      const nodes = containers.length ? containers : Array.from(document.querySelectorAll('#search div, #rso div'));

      for (const node of nodes) {
        const anchors = Array.from(node.querySelectorAll('a'));
        const anchor = anchors.find((item) => item.querySelector('h3')) || anchors[0];
        const title = normalize(node.querySelector('h3')?.textContent || anchor?.querySelector('h3')?.textContent || '');
        const url = decodeUrl(anchor?.href || '');
        if (!title || !url) continue;

        try {
          const parsed = new URL(url);
          if (/google\\./i.test(parsed.hostname)) continue;
        } catch {
          continue;
        }

        const text = normalize(node.innerText || '');
        const lines = text.split(/\\n+/).map(normalize).filter(Boolean);
        const snippet = (lines.find((line) => line !== title && line.length > 20) || text.replace(title, '').trim()).slice(0, 220);

        results.push({ title, snippet, url });
        if (results.length >= limit) break;
      }

      const hasNext = !!document.querySelector('#pnnext, a[aria-label="Next page"], a[aria-label="Next"]');
      return { results, hasNext };
    })()
  `;
}

cli({
  site: 'google',
  name: 'search',
  description: 'Search Google web results via browser-rendered DOM',
  domain: 'www.google.com',
  strategy: Strategy.UI,
  footerExtra: getPaginationFooterExtra,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results to collect across pages (max 100)' },
    { name: 'hl', default: 'en-US', help: 'Language/locale, e.g. en-US or zh-CN' },
  ],
  columns: ['rank', 'title', 'snippet', 'url'],
  func: async (page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'Search query is required');
    }

    const limit = resolveAutoPaginatedLimit(args.limit);
    const seen = new Set<string>();
    const results: GoogleSearchResult[] = [];
    const maxPages = getAutoPaginationMaxPages(limit);
    let stopReason = '';

    for (let pageIndex = 0; pageIndex < maxPages && results.length < limit; pageIndex++) {
      if (pageIndex > 0) {
        await pauseBeforeSearchPageHop(page);
      }

      await page.goto(buildGoogleSearchUrl(query, {
        hl: args.hl,
        count: SEARCH_PAGE_SIZE,
        start: pageIndex * SEARCH_PAGE_SIZE,
      }));
      await page.wait(2);

      const data = await page.evaluate(buildGoogleSearchExtractScript(SEARCH_PAGE_SIZE)) as GoogleSearchPageData | { error?: string } | undefined;
      if (!isGoogleSearchPageData(data)) {
        if (results.length > 0) {
          stopReason = data?.error || 'Google blocked pagination';
          break;
        }
        throw new CliError('FETCH_ERROR', data?.error || 'Google search page did not return parseable results');
      }

      if (!data.results.length) {
        stopReason = 'Google returned a page with no parseable results';
        break;
      }

      const added = appendUniqueSearchResults(results, data.results, seen, limit);
      if (results.length >= limit) break;
      if (added === 0) {
        stopReason = 'Google returned only duplicate results on another page';
        break;
      }
      if (!data.hasNext) {
        stopReason = 'Google did not expose another results page';
        break;
      }
    }

    if (!results.length) {
      throw new CliError('NOT_FOUND', 'No Google search results found', 'Try another query, or open the query in Chrome once and retry.');
    }

    emitPartialSearchWarning(
      args,
      'google',
      limit,
      results.length,
      stopReason || 'Google stopped returning new results',
    );

    return results.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      title: item.title,
      snippet: item.snippet,
      url: item.url,
    }));
  },
});
