import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { bingFetch, buildBingNewsPath, parseBingRss } from './utils.js';

cli({
  site: 'bing',
  name: 'news',
  description: 'Search Bing News results (RSS)',
  domain: 'www.bing.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'query', positional: true, required: true, help: 'News search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results' },
    { name: 'market', help: 'Optional market, e.g. en-US' },
  ],
  columns: ['rank', 'title', 'source', 'published', 'url'],
  func: async (_page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'News search query is required');
    }

    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 50));
    const xml = await bingFetch(buildBingNewsPath(query, {
      market: args.market,
      count: limit,
    }));
    const items = parseBingRss(xml);

    if (!items.length) {
      throw new CliError('NOT_FOUND', 'No Bing News results found', 'Try a different keyword');
    }

    return items.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      title: item.title,
      source: item.source || '-',
      published: item.published,
      summary: item.description,
      image: item.image || '',
      url: item.link,
    }));
  },
});
