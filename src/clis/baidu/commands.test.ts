import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegistry } from '../../registry.js';
import './search.js';
import './suggest.js';

describe('baidu suggest command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps Baidu suggestions into ranked output', async () => {
    const cmd = getRegistry().get('baidu/suggest');
    expect(cmd?.func).toBeTypeOf('function');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        q: 'openai',
        g: [
          { type: 'sug', q: 'openai official site' },
          { type: 'direct_new', q: 'openai gdp policy' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cmd!.func!(null as any, {
      query: 'openai',
      limit: 2,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.baidu.com/sugrec?prod=pc&wd=openai',
      expect.any(Object),
    );
    expect(result).toEqual([
      { rank: 1, suggestion: 'openai official site', type: 'sug' },
      { rank: 2, suggestion: 'openai gdp policy', type: 'direct_new' },
    ]);
  });
});

describe('baidu search command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates to the browser search URL and maps rendered results', async () => {
    const cmd = getRegistry().get('baidu/search');
    expect(cmd?.func).toBeTypeOf('function');

    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue({
        results: [
          {
            title: '2026 China GDP goal - Example result',
            snippet: 'Example snippet from a rendered Baidu result page.',
            url: 'https://example.com/baidu-result',
          },
        ],
        hasNext: false,
      }),
    };

    const result = await cmd!.func!(page as any, {
      query: '2026 China GDP goal',
      limit: 5,
    });

    expect(page.goto).toHaveBeenCalledWith(
      'https://www.baidu.com/s?wd=2026+China+GDP+goal',
    );
    expect(result).toEqual([
      {
        rank: 1,
        title: '2026 China GDP goal - Example result',
        snippet: 'Example snippet from a rendered Baidu result page.',
        url: 'https://example.com/baidu-result',
      },
    ]);
  });

  it('paginates across Baidu result pages to satisfy larger limits', async () => {
    const cmd = getRegistry().get('baidu/search');
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
      query: 'opencli',
      limit: 25,
    }) as Array<{ rank: number; title: string }>;

    expect(page.goto).toHaveBeenNthCalledWith(
      1,
      'https://www.baidu.com/s?wd=opencli',
    );
    expect(page.goto).toHaveBeenNthCalledWith(
      2,
      'https://www.baidu.com/s?wd=opencli&pn=10',
    );
    expect(page.goto).toHaveBeenNthCalledWith(
      3,
      'https://www.baidu.com/s?wd=opencli&pn=20',
    );
    expect(result).toHaveLength(25);
    expect(result[24]).toEqual({
      rank: 25,
      title: 'Result 25',
      snippet: 'Snippet 25',
      url: 'https://example.com/25',
    });
  });

  it('returns partial results and emits a warning when later paging is blocked', async () => {
    const cmd = getRegistry().get('baidu/search');
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
            url: `https://example.com/${index + 1}`,
          })),
          hasNext: true,
        })
        .mockResolvedValueOnce({
          error: 'Baidu returned a security verification page. Open the query in Chrome once and retry.',
        }),
    };

    const result = await cmd!.func!(page as any, args) as Array<{ rank: number; title: string }>;

    expect(result).toHaveLength(10);
    expect(args._paginationWarning).toContain('returned 10/15');
    expect(cmd?.footerExtra?.(args)).toContain('returned 10/15');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[opencli:baidu] Warning: Partial results: returned 10/15'));
  });

  it('rejects limits outside 1..100', async () => {
    const cmd = getRegistry().get('baidu/search');
    expect(cmd?.func).toBeTypeOf('function');

    await expect(cmd!.func!({} as any, {
      query: 'opencli',
      limit: 0,
    })).rejects.toMatchObject({
      code: 'INVALID_ARG',
    });
  });
});
