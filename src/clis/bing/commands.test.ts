import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegistry } from '../../registry.js';
import './search.js';
import './news.js';

describe('bing search command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the positional query argument and maps web results', async () => {
    const cmd = getRegistry().get('bing/search');
    expect(cmd?.func).toBeTypeOf('function');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`<?xml version="1.0" encoding="utf-8" ?>
        <rss version="2.0">
          <channel>
            <item>
              <title>OpenCLI</title>
              <link>https://opencli.org/</link>
              <description>CLI for websites.</description>
              <pubDate>Sat, 21 Mar 2026 07:04:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`),
    }));

    const result = await cmd!.func!(null as any, {
      query: 'opencli',
      keyword: 'ignored',
      limit: 5,
    });

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
