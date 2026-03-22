import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { buildBaiduSearchUrl } from './utils.js';

cli({
  site: 'baidu',
  name: 'search',
  description: 'Search Baidu web results via browser-rendered DOM',
  domain: 'www.baidu.com',
  strategy: Strategy.UI,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results' },
  ],
  columns: ['rank', 'title', 'snippet', 'url'],
  func: async (page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'Search query is required');
    }

    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 20));
    await page.goto(buildBaiduSearchUrl(query));
    await page.wait(2);

    const data = await page.evaluate(`
      (() => {
        const limit = ${limit};
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
        const bodyText = normalize(document.body?.innerText || '');
        const titleText = normalize(document.title || '');
        if (/安全验证/.test(bodyText) || /安全验证/.test(titleText)) {
          return { error: 'Baidu returned a security verification page. Open the query in Chrome once and retry.' };
        }

        const seen = new Set();
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
      throw new CliError('FETCH_ERROR', data?.error || 'Baidu search page did not return parseable results');
    }
    if (!data.length) {
      throw new CliError('NOT_FOUND', 'No Baidu search results found', 'Try another query, or open the query in Chrome once and retry.');
    }

    return data.map((item: any, index: number) => ({
      rank: index + 1,
      title: item.title,
      snippet: item.snippet,
      url: item.url,
    }));
  },
});
