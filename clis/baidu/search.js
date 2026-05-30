/**
 * Baidu Web Search via browser DOM extraction.
 * Uses browser mode to navigate baidu.com and extract results from the DOM.
 */
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

cli({
  site: 'baidu',
  name: 'search',
  access: 'read',
  description: 'Search Baidu',
  domain: 'baidu.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'keyword', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Number of results (1-50)' },
  ],
  columns: ['type', 'title', 'url', 'snippet'],
  func: async (page, args) => {
    const limit = Math.max(1, Math.min(Number(args.limit), 50));
    const keyword = encodeURIComponent(args.keyword);
    const url = `https://www.baidu.com/s?wd=${keyword}&rn=${limit}`;

    await page.goto(url);

    // Wait for search results to load
    try {
      await page.wait({ selector: '#content_left', timeout: 5 });
    } catch {
      await page.wait(2);
    }

    const wrapper = await page.evaluate(`
      (function() {
        var results = [];
        var seenUrls = {};
        var contentLeft = document.querySelector('#content_left');
        if (!contentLeft) return {items: results};

        // Find all result containers
        var containers = contentLeft.querySelectorAll('.result, .c-container');

        for (var i = 0; i < containers.length; i++) {
          var container = containers[i];

          // Find title link
          var titleLink = container.querySelector('h3 a, .t a');
          if (!titleLink) continue;

          var href = titleLink.href || '';
          var title = titleLink.textContent.trim();

          // Skip invalid URLs and duplicates
          if (!(href.startsWith('http://') || href.startsWith('https://'))) continue;
          if (seenUrls[href]) continue;
          seenUrls[href] = true;

          // Find snippet/abstract
          var snippetText = '';
          var snippetEl = container.querySelector('.c-abstract, .c-span9, .c-span-last');
          if (snippetEl) {
            snippetText = snippetEl.textContent.trim();
          }

          // Determine result type
          var type = 'result';
          if (container.className.indexOf('c-recomm-wrap') !== -1) {
            type = 'recommendation';
          }

          results.push({
            type: type,
            title: title,
            url: href,
            snippet: snippetText.slice(0, 300),
          });
        }

        return {items: results};
      })()
    `);

    const results = (wrapper && wrapper.items) || [];

    if (results.length === 0) {
      throw new CliError(
        'NOT_FOUND',
        'No search results found',
        'Try a different keyword or check for verification page'
      );
    }

    return results;
  },
});
