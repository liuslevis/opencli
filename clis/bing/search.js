/**
 * Bing Web Search via browser DOM extraction.
 * Uses browser mode to navigate bing.com and extract results from the DOM.
 */
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

cli({
  site: 'bing',
  name: 'search',
  access: 'read',
  description: 'Search Bing',
  domain: 'bing.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'keyword', positional: true, required: true, help: 'Search query' },
    { name: 'limit', type: 'int', default: 10, help: 'Number of results (1-50)' },
    { name: 'lang', default: 'en-US', help: 'Language code (e.g. en-US, zh-CN)' },
  ],
  columns: ['type', 'title', 'url', 'snippet'],
  func: async (page, args) => {
    const limit = Math.max(1, Math.min(Number(args.limit), 50));
    const keyword = encodeURIComponent(args.keyword);
    const lang = encodeURIComponent(args.lang);
    const url = `https://www.bing.com/search?q=${keyword}&setlang=${lang}&count=${limit}`;

    await page.goto(url);

    // Wait for search results to load
    try {
      await page.wait({ selector: '#b_results', timeout: 5 });
    } catch {
      await page.wait(2);
    }

    const wrapper = await page.evaluate(`
      (function() {
        var results = [];
        var seenUrls = {};
        var resultsContainer = document.querySelector('#b_results');
        if (!resultsContainer) return {items: results};

        // Find all result items
        var items = resultsContainer.querySelectorAll('.b_algo, .b_ans');

        for (var i = 0; i < items.length; i++) {
          var item = items[i];

          // Determine result type
          var type = 'result';
          if (item.classList.contains('b_ans')) {
            type = 'answer';
          }

          // Find title link
          var titleLink = item.querySelector('h2 a, h3 a');
          if (!titleLink) continue;

          var href = titleLink.href || '';
          var title = titleLink.textContent.trim();

          // Skip invalid URLs and duplicates
          if (!(href.startsWith('http://') || href.startsWith('https://'))) continue;
          if (seenUrls[href]) continue;
          seenUrls[href] = true;

          // Find snippet/description
          var snippetText = '';
          var snippetEl = item.querySelector('.b_caption p, .b_algoSlug');
          if (snippetEl) {
            snippetText = snippetEl.textContent.trim();
          }

          results.push({
            type: type,
            title: title,
            url: href,
            snippet: snippetText.slice(0, 300),
          });
        }

        // Also check for instant answers
        var instantAnswer = resultsContainer.querySelector('.b_xlText, .b_focusTextLarge');
        if (instantAnswer && !seenUrls['instant-answer']) {
          seenUrls['instant-answer'] = true;
          results.unshift({
            type: 'instant',
            title: instantAnswer.textContent.trim().slice(0, 200),
            url: '',
            snippet: '',
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
        'Try a different keyword or check for CAPTCHA'
      );
    }

    return results;
  },
});
