import { describe, expect, it } from 'vitest';
import { buildBingNewsPath, buildBingSearchPath, parseBingRss } from './utils.js';

describe('buildBingSearchPath', () => {
  it('encodes the query and keeps rss params', () => {
    expect(buildBingSearchPath('open ai', { market: 'en-US', count: 7 })).toBe(
      '/search?q=open+ai&format=rss&mkt=en-US&count=7',
    );
  });
});

describe('buildBingNewsPath', () => {
  it('builds a Bing News RSS path', () => {
    expect(buildBingNewsPath('OpenAI', { count: 12 })).toBe(
      '/news/search?q=OpenAI&format=rss&count=12',
    );
  });
});

describe('parseBingRss', () => {
  it('parses web search RSS items', () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
      <rss version="2.0">
        <channel>
          <item>
            <title><![CDATA[OpenCLI - GitHub]]></title>
            <link>https://github.com/jackwener/opencli</link>
            <description><![CDATA[Turn any website into a CLI &amp; agent tool.]]></description>
            <pubDate>Sat, 21 Mar 2026 07:04:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    expect(parseBingRss(xml)).toEqual([
      {
        title: 'OpenCLI - GitHub',
        description: 'Turn any website into a CLI & agent tool.',
        link: 'https://github.com/jackwener/opencli',
        published: '2026-03-21',
        source: 'github.com',
        image: undefined,
      },
    ]);
  });

  it('parses Bing News metadata and unwraps apiclick links', () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
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
      </rss>`;

    expect(parseBingRss(xml)).toEqual([
      {
        title: 'OpenAI to nearly double workforce',
        description: 'Reuters report summary.',
        link: 'https://example.com/story',
        published: '2026-03-21',
        source: 'Reuters on MSN',
        image: 'http://www.bing.com/th?id=ORMS.demo&pid=News',
      },
    ]);
  });

  it('keeps the raw pubDate when Date.parse cannot normalize it', () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
      <rss version="2.0">
        <channel>
          <item>
            <title>OpenCLI raw date</title>
            <link>https://example.com/opencli</link>
            <description>Raw date sample</description>
            <pubDate>Weekday, 19 Foo 2026 03:32:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    expect(parseBingRss(xml)[0]?.published).toBe('Weekday, 19 Foo 2026 03:32:00 GMT');
  });
});
