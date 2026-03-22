import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { buildGoogleNewsPath, googleNewsFetch, parseGoogleNewsRss } from './utils.js';

cli({
  site: 'google',
  name: 'news',
  description: 'Search Google News headlines (RSS)',
  domain: 'news.google.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'query', positional: true, required: true, help: 'News search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Max results' },
    { name: 'hl', default: 'en-US', help: 'Language/locale, e.g. en-US or zh-CN' },
    { name: 'gl', help: 'Optional country code, e.g. US or CN' },
    { name: 'ceid', help: 'Optional Google News edition id, e.g. US:en' },
  ],
  columns: ['rank', 'title', 'source', 'published', 'url'],
  func: async (_page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'News search query is required');
    }

    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 50));
    const xml = await googleNewsFetch(buildGoogleNewsPath(query, {
      hl: args.hl,
      gl: args.gl,
      ceid: args.ceid,
    }));
    const items = parseGoogleNewsRss(xml);

    if (!items.length) {
      throw new CliError('NOT_FOUND', 'No Google News results found', 'Try a different keyword');
    }

    return items.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      title: item.title,
      source: item.source || '-',
      published: item.published,
      url: item.link,
    }));
  },
});
