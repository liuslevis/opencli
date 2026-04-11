import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegistry } from '../../registry.js';
import './search.js';
import './news.js';

describe('bing search command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the positional query argument and maps rendered web results', async () => {
    const cmd = getRegistry().get('bing/search');
    expect(cmd?.func).toBeTypeOf('function');

    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue({
        results: [
          {
            title: 'OpenCLI',
            snippet: 'CLI for websites.',
            source: 'opencli.org',
            published: '2026-03-21',
            url: 'https://opencli.org/',
          },
        ],
        nextUrl: null,
      }),
    };

    const result = await cmd!.func!(page as any, {
      query: 'opencli',
      keyword: 'ignored',
      limit: 5,
    });

    expect(page.goto).toHaveBeenCalledWith('https://www.bing.com/search?q=opencli');
    expect(result).toEqual([
      {
        rank: 1,
        title: 'OpenCLI',
        snippet: 'CLI for websites.',
        source: 'opencli.org',
        published: '2026-03-21',
        url: 'https://opencli.org/',
      },
    ]);
  });

  it('paginates across Bing result pages until the limit is satisfied', async () => {
    const cmd = getRegistry().get('bing/search');
    expect(cmd?.func).toBeTypeOf('function');

    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn()
        .mockResolvedValueOnce({
          results: Array.from({ length: 10 }, (_v, index) => ({
            title: `Result ${index + 1}`,
            snippet: `Snippet ${index + 1}`,
            source: 'example.com',
            published: '',
            url: `https://example.com/${index + 1}`,
          })),
          nextUrl: 'https://www.bing.com/search?q=opencli&first=11',
        })
        .mockResolvedValueOnce({
          results: Array.from({ length: 10 }, (_v, index) => ({
            title: `Result ${index + 11}`,
            snippet: `Snippet ${index + 11}`,
            source: 'example.com',
            published: '',
            url: `https://example.com/${index + 11}`,
          })),
          nextUrl: null,
        }),
    };

    const result = await cmd!.func!(page as any, {
      query: 'opencli',
      limit: 20,
      market: 'en-US',
    }) as Array<{ rank: number; title: string }>;

    expect(page.goto).toHaveBeenNthCalledWith(
      1,
      'https://www.bing.com/search?q=opencli&mkt=en-US',
    );
    expect(page.goto).toHaveBeenNthCalledWith(
      2,
      'https://www.bing.com/search?q=opencli&first=11',
    );
    expect(result).toHaveLength(20);
    expect(result[19]).toEqual({
      rank: 20,
      title: 'Result 20',
      snippet: 'Snippet 20',
      source: 'example.com',
      published: '',
      url: 'https://example.com/20',
    });
  });

  it('returns partial results and emits a warning when later paging is blocked', async () => {
    const cmd = getRegistry().get('bing/search');
    expect(cmd?.func).toBeTypeOf('function');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const args: Record<string, any> = {
      query: 'opencli',
      limit: 15,
    };
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn()
        .mockResolvedValueOnce({
          results: Array.from({ length: 10 }, (_v, index) => ({
            title: `Result ${index + 1}`,
            snippet: `Snippet ${index + 1}`,
            source: 'example.com',
            published: '',
            url: `https://example.com/${index + 1}`,
          })),
          nextUrl: 'https://www.bing.com/search?q=opencli&first=11',
        })
        .mockResolvedValueOnce({
          error: 'Bing returned an anti-bot interstitial. Open the query in Chrome once and retry.',
        }),
    };

    const result = await cmd!.func!(page as any, args) as Array<{ rank: number; title: string }>;

    expect(result).toHaveLength(10);
    expect(args._paginationWarning).toContain('returned 10/15');
    expect(cmd?.footerExtra?.(args)).toContain('returned 10/15');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[opencli:bing] Warning: Partial results: returned 10/15'));
  });

  it('rejects limits outside 1..100', async () => {
    const cmd = getRegistry().get('bing/search');
    expect(cmd?.func).toBeTypeOf('function');

    await expect(cmd!.func!({} as any, {
      query: 'opencli',
      limit: 101,
    })).rejects.toMatchObject({
      code: 'INVALID_ARG',
    });
  });
});

describe('bing news command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps Bing News RSS metadata into command output', async () => {
    const cmd = getRegistry().get('bing/news');
    expect(cmd?.func).toBeTypeOf('function');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`<?xml version="1.0" encoding="utf-8" ?>
        <rss version="2.0" xmlns:News="https://www.bing.com/news/search?q=openai&amp;format=rss">
          <channel>
            <item>
              <title>OpenAI to nearly double workforce</title>
              <link>http://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.com%2Fstory&amp;c=123</link>
              <description>Reuters report summary.</description>
              <pubDate>Sat, 21 Mar 2026 05:24:42 GMT</pubDate>
              <News:Source>Reuters on MSN</News:Source>
              <News:Image>http://www.bing.com/th?id=ORMS.demo&amp;pid=News</News:Image>
            </item>
          </channel>
        </rss>`),
    }));

    const result = await cmd!.func!(null as any, {
      query: 'openai',
      limit: 3,
    });

    expect(result).toEqual([
      {
        rank: 1,
        title: 'OpenAI to nearly double workforce',
        source: 'Reuters on MSN',
        published: '2026-03-21',
        summary: 'Reuters report summary.',
        image: 'http://www.bing.com/th?id=ORMS.demo&pid=News',
        url: 'https://example.com/story',
      },
    ]);
  });
});
