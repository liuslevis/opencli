import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { baiduFetchJson, buildBaiduSuggestUrl, parseBaiduSuggest } from './utils.js';

cli({
  site: 'baidu',
  name: 'suggest',
  description: 'Get Baidu search suggestions',
  domain: 'www.baidu.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'query', positional: true, required: true, help: 'Suggestion keyword' },
    { name: 'limit', type: 'int', default: 10, help: 'Max suggestions' },
  ],
  columns: ['rank', 'suggestion', 'type'],
  func: async (_page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'Suggestion keyword is required');
    }

    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 50));
    const payload = await baiduFetchJson<any>(buildBaiduSuggestUrl(query));
    const suggestions = parseBaiduSuggest(payload);

    if (!suggestions.length) {
      throw new CliError('NOT_FOUND', 'No Baidu suggestions found', 'Try a different keyword');
    }

    return suggestions.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      suggestion: item.suggestion,
      type: item.type,
    }));
  },
});
