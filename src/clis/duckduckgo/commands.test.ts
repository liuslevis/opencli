import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegistry } from '../../registry.js';
import './suggest.js';

describe('duckduckgo suggest command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps suggestions into ranked output', async () => {
    const cmd = getRegistry().get('duckduckgo/suggest');
    expect(cmd?.func).toBeTypeOf('function');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        'OpenAI',
        ['openai', 'openai api', 'openai login'],
      ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await cmd!.func!(null as any, {
      query: 'openai',
      limit: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://duckduckgo.com/ac/?q=openai&type=list',
    );
    expect(result).toEqual([
      { rank: 1, suggestion: 'openai' },
      { rank: 2, suggestion: 'openai api' },
      { rank: 3, suggestion: 'openai login' },
    ]);
  });
});
