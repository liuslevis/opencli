import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { bingFetch, buildBingSearchPath, parseBingRss } from './utils.js';

cli({
  site: 'bing',
  name: 'search',
  description: 'Search Bing web results (RSS)',
  domain: 'www.bing.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results (Bing RSS usually returns up to 10)' },
    { name: 'market', help: 'Optional market, e.g. en-US or zh-CN' },
  ],
  columns: ['rank', 'title', 'snippet', 'url'],
  func: async (_page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'Search query is required');
    }

    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 50));
    const xml = await bingFetch(buildBingSearchPath(query, {
      market: args.market,
      count: limit,
    }));
    const items = parseBingRss(xml);

    if (!items.length) {
      throw new CliError('NOT_FOUND', 'No Bing results found', 'Try a different keyword');
    }

    return items.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      title: item.title,
      snippet: item.description,
      source: item.source,
      published: item.published,
      url: item.link,
    }));
  },
});
