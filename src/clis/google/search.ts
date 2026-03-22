import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { buildGoogleSearchUrl } from './utils.js';

cli({
  site: 'google',
  name: 'search',
  description: 'Search Google web results via browser-rendered DOM',
  domain: 'www.google.com',
  strategy: Strategy.UI,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results (max 20)' },
    { name: 'hl', default: 'en-US', help: 'Language/locale, e.g. en-US or zh-CN' },
  ],
  columns: ['rank', 'title', 'snippet', 'url'],
  func: async (page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'Search query is required');
    }

    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 20));
    await page.goto(buildGoogleSearchUrl(query, {
      hl: args.hl,
      count: limit,
    }));
    await page.wait(2);

    const data = await page.evaluate(`
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

        const seen = new Set();
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
          const key = title + '|' + url;
          if (seen.has(key)) continue;
          seen.add(key);

          results.push({ title, snippet, url });
          if (results.length >= limit) break;
        }

        return results;
      })()
    `);

    if (!Array.isArray(data)) {
      throw new CliError('FETCH_ERROR', data?.error || 'Google search page did not return parseable results');
    }
    if (!data.length) {
      throw new CliError('NOT_FOUND', 'No Google search results found', 'Try another query, or open the query in Chrome once and retry.');
    }

    return data.map((item: any, index: number) => ({
      rank: index + 1,
      title: item.title,
      snippet: item.snippet,
      url: item.url,
    }));
  },
});
