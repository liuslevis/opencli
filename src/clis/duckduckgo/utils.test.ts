import { describe, expect, it } from 'vitest';
import { buildDuckDuckGoSuggestUrl, parseDuckDuckGoSuggest } from './utils.js';

describe('buildDuckDuckGoSuggestUrl', () => {
  it('builds the autocomplete endpoint URL', () => {
    expect(buildDuckDuckGoSuggestUrl('open ai')).toBe(
      'https://duckduckgo.com/ac/?q=open+ai&type=list',
    );
  });
});

describe('parseDuckDuckGoSuggest', () => {
  it('extracts suggestion strings from the list response format', () => {
    expect(parseDuckDuckGoSuggest([
      'OpenAI',
      ['openai', 'openai api', 'openai login'],
    ])).toEqual(['openai', 'openai api', 'openai login']);
  });
});
