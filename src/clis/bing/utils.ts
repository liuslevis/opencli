import { CliError } from '../../errors.js';

const BING_BASE = 'https://www.bing.com';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; opencli)';

export interface BingRssItem {
  title: string;
  description: string;
  link: string;
  published: string;
  source: string;
  image?: string;
}

export interface BingFetchOptions {
  market?: string;
  count?: number;
}

export async function bingFetch(path: string): Promise<string> {
  const resp = await fetch(`${BING_BASE}${path}`, {
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
    },
  });

  if (!resp.ok) {
    throw new CliError(
      'FETCH_ERROR',
      `Bing RSS HTTP ${resp.status}`,
      'Bing may be temporarily unavailable. Try again later.',
    );
  }

  const xml = await resp.text();
  if (!/<rss\b/i.test(xml) || !/<item\b/i.test(xml)) {
    throw new CliError(
      'FETCH_ERROR',
      'Bing did not return an RSS feed',
      'Try a different query, or remove locale-specific parameters like --market.',
    );
  }

  return xml;
}

export function buildBingSearchPath(query: string, options: BingFetchOptions = {}): string {
  return buildBingPath('/search', query, options);
}

export function buildBingNewsPath(query: string, options: BingFetchOptions = {}): string {
  return buildBingPath('/news/search', query, options);
}

export function parseBingRss(xml: string): BingRssItem[] {
  const items: BingRssItem[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTagText(block, 'title');
    const description = extractTagText(block, 'description');
    const link = unwrapBingLink(extractTagText(block, 'link') || extractTagText(block, 'guid'));
    const published = normalizePubDate(extractTagText(block, 'pubDate'));
    const source = extractTagText(block, 'News:Source') || deriveSourceFromUrl(link);
    const image = extractTagText(block, 'News:Image') || undefined;

    if (!title || !link) continue;

    items.push({
      title,
      description,
      link,
      published,
      source,
      image,
    });
  }

  return items;
}

function buildBingPath(basePath: string, query: string, options: BingFetchOptions): string {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('format', 'rss');

  if (options.market) params.set('mkt', String(options.market));
  if (options.count != null && Number(options.count) > 0) {
    params.set('count', String(Math.min(Math.max(Number(options.count), 1), 50)));
  }

  return `${basePath}?${params.toString()}`;
}

function extractTagText(block: string, tag: string): string {
  const safeTag = escapeRegExp(tag);
  const match = block.match(new RegExp(`<${safeTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${safeTag}>`, 'i'));
  if (!match) return '';

  return normalizeWhitespace(stripHtml(decodeXmlEntities(stripCdata(match[1]))));
}

function normalizePubDate(value: string): string {
  const text = normalizeWhitespace(decodeXmlEntities(stripCdata(value)));
  if (!text) return '-';

  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toISOString().slice(0, 10);
}

function unwrapBingLink(rawLink: string): string {
  const value = String(rawLink || '').trim();
  if (!value) return '';

  try {
    const url = new URL(value);
    if (/(?:^|\.)bing\.com$/i.test(url.hostname) && /\/news\/apiclick\.aspx$/i.test(url.pathname)) {
      const target = url.searchParams.get('url');
      if (target) return target;
    }
    return url.toString();
  } catch {
    return value;
  }
}

function deriveSourceFromUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function stripCdata(value: string): string {
  const match = String(value || '').match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return match ? match[1] : String(value || '');
}

function stripHtml(value: string): string {
  return String(value || '').replace(/<[^>]+>/g, ' ');
}

function decodeXmlEntities(value: string): string {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function normalizeWhitespace(value: string): string {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
