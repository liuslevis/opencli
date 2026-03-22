import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import {
  buildDuckDuckGoSuggestUrl,
  duckDuckGoFetchJson,
  parseDuckDuckGoSuggest,
} from './utils.js';

cli({
  site: 'duckduckgo',
  name: 'suggest',
  description: 'Get DuckDuckGo autocomplete suggestions',
  domain: 'duckduckgo.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'query', positional: true, required: true, help: 'Suggestion query' },
    { name: 'limit', type: 'int', default: 10, help: 'Max suggestions' },
  ],
  columns: ['rank', 'suggestion'],
  func: async (_page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'Suggestion query is required');
    }

    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 50));
    const payload = await duckDuckGoFetchJson<unknown>(buildDuckDuckGoSuggestUrl(query));
    const suggestions = parseDuckDuckGoSuggest(payload);

    if (!suggestions.length) {
      throw new CliError('NOT_FOUND', 'No DuckDuckGo suggestions found', 'Try a different keyword');
    }

    return suggestions.slice(0, limit).map((suggestion, index) => ({
      rank: index + 1,
      suggestion,
    }));
  },
});
