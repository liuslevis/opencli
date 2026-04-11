import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { buildBingSearchUrl } from './utils.js';
import {
  SEARCH_PAGE_SIZE,
  appendUniqueSearchResults,
  emitPartialSearchWarning,
  getAutoPaginationMaxPages,
  getPaginationFooterExtra,
  pauseBeforeSearchPageHop,
  resolveAutoPaginatedLimit,
} from '../search-pagination.js';

type BingSearchResult = {
  title: string;
  snippet: string;
  source: string;
  published: string;
  url: string;
};

type BingSearchPageData = {
  results: BingSearchResult[];
  nextUrl: string | null;
};

function isBingSearchPageData(value: unknown): value is BingSearchPageData {
  return !!value
    && typeof value === 'object'
    && 'results' in value
    && Array.isArray((value as BingSearchPageData).results)
    && 'nextUrl' in value
    && (((value as BingSearchPageData).nextUrl === null) || typeof (value as BingSearchPageData).nextUrl === 'string');
}

function buildBingSearchExtractScript(limit: number): string {
  return `
    (() => {
      const limit = ${limit};
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const normalizeDate = (value) => {
        const raw = normalize(value);
        if (!raw) return '';
        const parsed = Date.parse(raw);
        return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
      };
      const decodeUrl = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
          const url = new URL(raw, location.origin);
          if (/(?:^|\\.)bing\\.com$/i.test(url.hostname) && /^\\/ck\\/a$/i.test(url.pathname)) {
            const encoded = url.searchParams.get('u') || '';
            const payload = encoded.startsWith('a1') ? encoded.slice(2) : encoded;
            if (payload) {
              try {
                return atob(payload);
              } catch {}
            }
          }
          return url.toString();
        } catch {
          return raw;
        }
      };
      const deriveSource = (value) => {
        try {
          return new URL(value).hostname.replace(/^www\\./i, '');
        } catch {
          return '';
        }
      };
      const bodyText = normalize(document.body?.innerText || '');
      if (/unusual traffic|verify you are human|solve the challenge/i.test(bodyText)) {
        return { error: 'Bing returned an anti-bot interstitial. Open the query in Chrome once and retry.' };
      }

      const results = [];
      const nodes = Array.from(document.querySelectorAll('#b_results > li.b_algo, #b_results .b_algo'));

      for (const node of nodes) {
        const title = normalize(node.querySelector('h2')?.textContent || '');
        const url = decodeUrl(node.querySelector('h2 a')?.href || '');
        if (!title || !url) continue;

        const snippet = normalize(
          node.querySelector('.b_caption p, .b_snippet, p.b_lineclamp2, p.b_paractl')?.textContent || ''
        );
        const citeText = normalize(node.querySelector('.b_attribution cite')?.textContent || '');
        const source = normalize(node.querySelector('.b_tpcn .tptt')?.textContent || '')
          || citeText.replace(/^https?:\\/\\/(www\\.)?/i, '').split(/[\\s/]+/)[0]
          || deriveSource(url);
        const published = normalizeDate(
          node.querySelector('time')?.getAttribute('datetime')
          || node.querySelector('time')?.textContent
          || node.querySelector('.news_dt')?.textContent
          || ''
        );

        results.push({ title, snippet, source, published, url });
        if (results.length >= limit) break;
      }

      const nextUrl = document.querySelector('a.sb_pagN[aria-label="Next page"], a[title="Next page"], nav[aria-label^="More results"] a[aria-label="Next page"]')?.href || null;
      return { results, nextUrl };
    })()
  `;
}

cli({
  site: 'bing',
  name: 'search',
  description: 'Search Bing web results via browser-rendered DOM',
  domain: 'www.bing.com',
  strategy: Strategy.UI,
  browser: true,
  timeoutSeconds: 120,
  footerExtra: getPaginationFooterExtra,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results to collect across pages (max 100)' },
    { name: 'market', help: 'Optional market, e.g. en-US or zh-CN' },
  ],
  columns: ['rank', 'title', 'snippet', 'url'],
  func: async (page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'Search query is required');
    }

    const limit = resolveAutoPaginatedLimit(args.limit);
    const seen = new Set<string>();
    const results: BingSearchResult[] = [];
    const visitedPageUrls = new Set<string>();
    const maxPages = getAutoPaginationMaxPages(limit);
    let currentPageUrl = buildBingSearchUrl(query, { market: args.market });
    let stopReason = '';

    for (let pageIndex = 0; pageIndex < maxPages && results.length < limit; pageIndex++) {
      if (!currentPageUrl) {
        stopReason = 'Bing did not expose another results page';
        break;
      }
      if (visitedPageUrls.has(currentPageUrl)) {
        stopReason = 'Bing repeated the same results page';
        break;
      }
      if (pageIndex > 0) {
        await pauseBeforeSearchPageHop(page);
      }

      visitedPageUrls.add(currentPageUrl);
      await page.goto(currentPageUrl);
      await page.wait(2);

      const data = await page.evaluate(buildBingSearchExtractScript(SEARCH_PAGE_SIZE)) as BingSearchPageData | { error?: string } | undefined;
      if (!isBingSearchPageData(data)) {
        if (results.length > 0) {
          stopReason = data?.error || 'Bing blocked pagination';
          break;
        }
        throw new CliError('FETCH_ERROR', data?.error || 'Bing search page did not return parseable results');
      }

      if (!data.results.length) {
        stopReason = 'Bing returned a page with no parseable results';
        break;
      }

      const added = appendUniqueSearchResults(results, data.results, seen, limit);
      if (results.length >= limit) break;
      if (added === 0) {
        stopReason = 'Bing returned only duplicate results on another page';
        break;
      }
      if (!data.nextUrl) {
        stopReason = 'Bing did not expose another results page';
        break;
      }

      currentPageUrl = data.nextUrl;
    }

    if (!results.length) {
      throw new CliError('NOT_FOUND', 'No Bing results found', 'Try a different keyword');
    }

    emitPartialSearchWarning(
      args,
      'bing',
      limit,
      results.length,
      stopReason || 'Bing stopped returning new results',
    );

    return results.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      title: item.title,
      snippet: item.snippet,
      source: item.source,
      published: item.published,
      url: item.url,
    }));
  },
});
