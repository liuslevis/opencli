import { cli, Strategy } from '../../registry.js';
import { CliError } from '../../errors.js';
import { buildGoogleSuggestUrl, googleFetchJson, parseGoogleSuggest } from './utils.js';

cli({
  site: 'google',
  name: 'suggest',
  description: 'Get Google autocomplete suggestions',
  domain: 'suggestqueries.google.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'query', positional: true, required: true, help: 'Suggestion keyword' },
    { name: 'limit', type: 'int', default: 10, help: 'Max suggestions' },
  ],
  columns: ['rank', 'suggestion'],
  func: async (_page, args) => {
    const query = String(args.query || '').trim();
    if (!query) {
      throw new CliError('INVALID_ARG', 'Suggestion keyword is required');
    }

    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 50));
    const payload = await googleFetchJson<unknown>(buildGoogleSuggestUrl(query));
    const suggestions = parseGoogleSuggest(payload);

    if (!suggestions.length) {
      throw new CliError('NOT_FOUND', 'No Google suggestions found', 'Try a different keyword');
    }

    return suggestions.slice(0, limit).map((suggestion, index) => ({
      rank: index + 1,
      suggestion,
    }));
  },
});
