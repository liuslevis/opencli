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
  it('navigates to the browser search URL and maps rendered results', async () => {
    const cmd = getRegistry().get('baidu/search');
    expect(cmd?.func).toBeTypeOf('function');

    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue([
        {
          title: '2026 China GDP goal - Example result',
          snippet: 'Example snippet from a rendered Baidu result page.',
          url: 'https://example.com/baidu-result',
        },
      ]),
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
});
