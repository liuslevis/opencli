import { describe, expect, it } from 'vitest';
import {
  buildGoogleNewsPath,
  buildGoogleSearchUrl,
  buildGoogleSuggestUrl,
  parseGoogleNewsRss,
  parseGoogleSuggest,
} from './utils.js';

describe('buildGoogleNewsPath', () => {
  it('builds a Google News RSS path with derived locale params', () => {
    expect(buildGoogleNewsPath('open ai', { hl: 'en-US' })).toBe(
      '/rss/search?q=open+ai&hl=en-US&gl=US&ceid=US%3Aen',
    );
  });

  it('allows explicit region and edition overrides', () => {
    expect(buildGoogleNewsPath('OpenAI', { hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-CN' })).toBe(
      '/rss/search?q=OpenAI&hl=zh-CN&gl=CN&ceid=CN%3Azh-CN',
    );
  });
});

describe('buildGoogleSuggestUrl', () => {
  it('builds the firefox suggest endpoint URL', () => {
    expect(buildGoogleSuggestUrl('open ai')).toBe(
      'https://suggestqueries.google.com/complete/search?client=firefox&q=open+ai',
    );
  });
});

describe('buildGoogleSearchUrl', () => {
  it('builds a Google browser search URL', () => {
    expect(buildGoogleSearchUrl('open ai', { hl: 'en-US', count: 7 })).toBe(
      'https://www.google.com/search?q=open+ai&hl=en-US&num=7',
    );
  });

  it('includes a pagination offset when provided', () => {
    expect(buildGoogleSearchUrl('open ai', { hl: 'en-US', count: 10, start: 20 })).toBe(
      'https://www.google.com/search?q=open+ai&hl=en-US&num=10&start=20',
    );
  });
});

describe('parseGoogleNewsRss', () => {
  it('parses Google News RSS items with source metadata', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>OpenAI launches new model - MIT Technology Review</title>
            <link>https://news.google.com/rss/articles/CBMiExample?oc=5</link>
            <guid isPermaLink="false">CBMiExample</guid>
            <pubDate>Fri, 20 Mar 2026 11:57:16 GMT</pubDate>
            <description>&lt;a href="https://news.google.com/rss/articles/CBMiExample?oc=5"&gt;OpenAI launches new model&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;MIT Technology Review&lt;/font&gt;</description>
            <source url="https://www.technologyreview.com">MIT Technology Review</source>
          </item>
        </channel>
      </rss>`;

    expect(parseGoogleNewsRss(xml)).toEqual([
      {
        title: 'OpenAI launches new model - MIT Technology Review',
        link: 'https://news.google.com/rss/articles/CBMiExample?oc=5',
        published: '2026-03-20',
        source: 'MIT Technology Review',
        sourceUrl: 'https://www.technologyreview.com',
      },
    ]);
  });

  it('falls back to the raw pubDate when it cannot normalize it', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>OpenAI title</title>
            <link>https://news.google.com/rss/articles/CBMiExample?oc=5</link>
            <pubDate>Weekday, 19 Foo 2026 03:32:00 GMT</pubDate>
            <source>Google News</source>
          </item>
        </channel>
      </rss>`;

    expect(parseGoogleNewsRss(xml)[0]?.published).toBe('Weekday, 19 Foo 2026 03:32:00 GMT');
  });
});

describe('parseGoogleSuggest', () => {
  it('extracts suggestion strings from the firefox response format', () => {
    expect(parseGoogleSuggest([
      'openai',
      ['openai', 'openai api', 'openai login'],
      [],
      {},
    ])).toEqual(['openai', 'openai api', 'openai login']);
  });
});
