import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegistry } from '../../registry.js';
import './news.js';
import './search.js';
import './suggest.js';

describe('google news command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps Google News RSS items into command output', async () => {
    const cmd = getRegistry().get('google/news');
    expect(cmd?.func).toBeTypeOf('function');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>OpenAI launches new model - MIT Technology Review</title>
              <link>https://news.google.com/rss/articles/CBMiExample?oc=5</link>
              <pubDate>Fri, 20 Mar 2026 11:57:16 GMT</pubDate>
              <source url="https://www.technologyreview.com">MIT Technology Review</source>
            </item>
          </channel>
        </rss>`),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cmd!.func!(null as any, {
      query: 'openai',
      limit: 5,
      hl: 'en-US',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://news.google.com/rss/search?q=openai&hl=en-US&gl=US&ceid=US%3Aen',
      expect.any(Object),
    );
    expect(result).toEqual([
      {
        rank: 1,
        title: 'OpenAI launches new model - MIT Technology Review',
        source: 'MIT Technology Review',
        published: '2026-03-20',
        url: 'https://news.google.com/rss/articles/CBMiExample?oc=5',
      },
    ]);
  });
});

describe('google suggest command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps autocomplete suggestions into ranked output', async () => {
    const cmd = getRegistry().get('google/suggest');
    expect(cmd?.func).toBeTypeOf('function');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        'openai',
        ['openai', 'openai api', 'openai login'],
        [],
        {},
      ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cmd!.func!(null as any, {
      query: 'openai',
      limit: 2,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://suggestqueries.google.com/complete/search?client=firefox&q=openai',
      expect.any(Object),
    );
    expect(result).toEqual([
      { rank: 1, suggestion: 'openai' },
      { rank: 2, suggestion: 'openai api' },
    ]);
  });
});

describe('google search command', () => {
  it('navigates to the browser search URL and maps rendered results', async () => {
    const cmd = getRegistry().get('google/search');
    expect(cmd?.func).toBeTypeOf('function');

    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue([
        {
          title: "China dials down growth ambitions with decades-low target. Here's why - CNBC",
          snippet: 'CNBC coverage of the 2026 China GDP goal announcement.',
          url: 'https://www.cnbc.com/example',
        },
      ]),
    };

    const result = await cmd!.func!(page as any, {
      query: '2026 China GDP goal',
      limit: 5,
      hl: 'en-US',
    });

    expect(page.goto).toHaveBeenCalledWith(
      'https://www.google.com/search?q=2026+China+GDP+goal&hl=en-US&num=5',
    );
    expect(result).toEqual([
      {
        rank: 1,
        title: "China dials down growth ambitions with decades-low target. Here's why - CNBC",
        snippet: 'CNBC coverage of the 2026 China GDP goal announcement.',
        url: 'https://www.cnbc.com/example',
      },
    ]);
  });
});
