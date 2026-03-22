import { describe, expect, it } from 'vitest';
import { buildBaiduSearchUrl, buildBaiduSuggestUrl, parseBaiduSuggest } from './utils.js';

describe('buildBaiduSuggestUrl', () => {
  it('builds the Baidu suggestion endpoint URL', () => {
    expect(buildBaiduSuggestUrl('open ai')).toBe(
      'https://www.baidu.com/sugrec?prod=pc&wd=open+ai',
    );
  });
});

describe('buildBaiduSearchUrl', () => {
  it('builds the Baidu browser search URL', () => {
    expect(buildBaiduSearchUrl('open ai')).toBe(
      'https://www.baidu.com/s?wd=open+ai',
    );
  });
});

describe('parseBaiduSuggest', () => {
  it('parses Baidu suggestion entries and keeps their types', () => {
    expect(parseBaiduSuggest({
      q: 'openai',
      g: [
        { type: 'sug', q: 'openai official site' },
        { type: 'direct_new', q: 'openai gdp policy' },
      ],
    })).toEqual([
      { suggestion: 'openai official site', type: 'sug' },
      { suggestion: 'openai gdp policy', type: 'direct_new' },
    ]);
  });
});
