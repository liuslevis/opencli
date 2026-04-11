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
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a 10-result search page even when limit is smaller', async () => {
    const cmd = getRegistry().get('google/search');
    expect(cmd?.func).toBeTypeOf('function');

    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue({
        results: [
          {
            title: "China dials down growth ambitions with decades-low target. Here's why - CNBC",
            snippet: 'CNBC coverage of the 2026 China GDP goal announcement.',
            url: 'https://www.cnbc.com/example',
          },
        ],
        hasNext: false,
      }),
    };

    const result = await cmd!.func!(page as any, {
      query: '2026 China GDP goal',
      limit: 5,
      hl: 'en-US',
    });

    expect(page.goto).toHaveBeenCalledWith(
      'https://www.google.com/search?q=2026+China+GDP+goal&hl=en-US&num=10',
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

  it('paginates across multiple result pages to satisfy larger limits', async () => {
    const cmd = getRegistry().get('google/search');
    expect(cmd?.func).toBeTypeOf('function');

    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn()
        .mockResolvedValueOnce({
          results: Array.from({ length: 10 }, (_v, index) => ({
            title: `Result ${index + 1}`,
            snippet: `Snippet ${index + 1}`,
            url: `https://example.com/${index + 1}`,
          })),
          hasNext: true,
        })
        .mockResolvedValueOnce({
          results: Array.from({ length: 10 }, (_v, index) => ({
            title: `Result ${index + 11}`,
            snippet: `Snippet ${index + 11}`,
            url: `https://example.com/${index + 11}`,
          })),
          hasNext: true,
        })
        .mockResolvedValueOnce({
          results: Array.from({ length: 5 }, (_v, index) => ({
            title: `Result ${index + 21}`,
            snippet: `Snippet ${index + 21}`,
            url: `https://example.com/${index + 21}`,
          })),
          hasNext: false,
        }),
    };

    const result = await cmd!.func!(page as any, {
      query: '2026 China GDP forecast',
      limit: 25,
      hl: 'en-US',
    }) as Array<{ rank: number; title: string; snippet: string; url: string }>;

    expect(page.goto).toHaveBeenNthCalledWith(
      1,
      'https://www.google.com/search?q=2026+China+GDP+forecast&hl=en-US&num=10',
    );
    expect(page.goto).toHaveBeenNthCalledWith(
      2,
      'https://www.google.com/search?q=2026+China+GDP+forecast&hl=en-US&num=10&start=10',
    );
    expect(page.goto).toHaveBeenNthCalledWith(
      3,
      'https://www.google.com/search?q=2026+China+GDP+forecast&hl=en-US&num=10&start=20',
    );
    expect(result).toHaveLength(25);
    expect(result[24]).toEqual({
      rank: 25,
      title: 'Result 25',
      snippet: 'Snippet 25',
      url: 'https://example.com/25',
    });
  });

  it('keeps paging when duplicates leave room for more unique results', async () => {
    const cmd = getRegistry().get('google/search');
    expect(cmd?.func).toBeTypeOf('function');

    const pageResults = [
      Array.from({ length: 10 }, (_v, index) => ({
        title: `Result ${index + 1}`,
        snippet: `Snippet ${index + 1}`,
        url: `https://example.com/${index + 1}`,
      })),
      Array.from({ length: 10 }, (_v, index) => ({
        title: `Result ${index + 11}`,
        snippet: `Snippet ${index + 11}`,
        url: `https://example.com/${index + 11}`,
      })),
      Array.from({ length: 10 }, (_v, index) => ({
        title: `Result ${index + 21}`,
        snippet: `Snippet ${index + 21}`,
        url: `https://example.com/${index + 21}`,
      })),
      Array.from({ length: 10 }, (_v, index) => ({
        title: `Result ${index + 31}`,
        snippet: `Snippet ${index + 31}`,
        url: `https://example.com/${index + 31}`,
      })),
      [
        {
          title: 'Result 9',
          snippet: 'Snippet 9',
          url: 'https://example.com/9',
        },
        {
          title: 'Result 19',
          snippet: 'Snippet 19',
          url: 'https://example.com/19',
        },
        {
          title: 'Result 41',
          snippet: 'Snippet 41',
          url: 'https://example.com/41',
        },
        {
          title: 'Result 42',
          snippet: 'Snippet 42',
          url: 'https://example.com/42',
        },
        {
          title: 'Result 43',
          snippet: 'Snippet 43',
          url: 'https://example.com/43',
        },
        {
          title: 'Result 44',
          snippet: 'Snippet 44',
          url: 'https://example.com/44',
        },
        {
          title: 'Result 45',
          snippet: 'Snippet 45',
          url: 'https://example.com/45',
        },
        {
          title: 'Result 46',
          snippet: 'Snippet 46',
          url: 'https://example.com/46',
        },
        {
          title: 'Result 47',
          snippet: 'Snippet 47',
          url: 'https://example.com/47',
        },
        {
          title: 'Result 48',
          snippet: 'Snippet 48',
          url: 'https://example.com/48',
        },
      ],
      [
        {
          title: 'Result 49',
          snippet: 'Snippet 49',
          url: 'https://example.com/49',
        },
        {
          title: 'Result 50',
          snippet: 'Snippet 50',
          url: 'https://example.com/50',
        },
      ],
    ];

    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn()
        .mockResolvedValueOnce({ results: pageResults[0], hasNext: true })
        .mockResolvedValueOnce({ results: pageResults[1], hasNext: true })
        .mockResolvedValueOnce({ results: pageResults[2], hasNext: true })
        .mockResolvedValueOnce({ results: pageResults[3], hasNext: true })
        .mockResolvedValueOnce({ results: pageResults[4], hasNext: true })
        .mockResolvedValueOnce({ results: pageResults[5], hasNext: false }),
    };

    const result = await cmd!.func!(page as any, {
      query: '2026 China GDP forecast',
      limit: 50,
      hl: 'en-US',
    }) as Array<{ rank: number; title: string; snippet: string; url: string }>;

    expect(page.goto).toHaveBeenNthCalledWith(
      6,
      'https://www.google.com/search?q=2026+China+GDP+forecast&hl=en-US&num=10&start=50',
    );
    expect(result).toHaveLength(50);
    expect(result[49]).toEqual({
      rank: 50,
      title: 'Result 50',
      snippet: 'Snippet 50',
      url: 'https://example.com/50',
    });
  });

  it('returns partial results and emits a warning when later paging is blocked', async () => {
    const cmd = getRegistry().get('google/search');
    expect(cmd?.func).toBeTypeOf('function');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const args: Record<string, any> = {
      query: 'opencli',
      limit: 15,
      hl: 'en-US',
    };
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn()
        .mockResolvedValueOnce({
          results: Array.from({ length: 10 }, (_v, index) => ({
            title: `Result ${index + 1}`,
            snippet: `Snippet ${index + 1}`,
            url: `https://example.com/${index + 1}`,
          })),
          hasNext: true,
        })
        .mockResolvedValueOnce({
          error: 'Google returned an anti-bot interstitial.',
        }),
    };

    const result = await cmd!.func!(page as any, args) as Array<{ rank: number; title: string }>;

    expect(result).toHaveLength(10);
    expect(args._paginationWarning).toContain('returned 10/15');
    expect(cmd?.footerExtra?.(args)).toContain('returned 10/15');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[opencli:google] Warning: Partial results: returned 10/15'));
  });

  it('rejects limits outside 1..100', async () => {
    const cmd = getRegistry().get('google/search');
    expect(cmd?.func).toBeTypeOf('function');

    await expect(cmd!.func!({} as any, {
      query: 'opencli',
      limit: 101,
      hl: 'en-US',
    })).rejects.toMatchObject({
      code: 'INVALID_ARG',
    });
  });
});
