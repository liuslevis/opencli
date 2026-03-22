import { CliError } from '../../errors.js';

const GOOGLE_NEWS_BASE = 'https://news.google.com';
const GOOGLE_SUGGEST_URL = 'https://suggestqueries.google.com/complete/search';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; opencli)';

export interface GoogleNewsItem {
  title: string;
  link: string;
  published: string;
  source: string;
  sourceUrl?: string;
}

export interface GoogleNewsOptions {
  hl?: string;
  gl?: string;
  ceid?: string;
}

export interface GoogleSearchOptions {
  hl?: string;
  count?: number;
  start?: number;
}

export async function googleNewsFetch(path: string): Promise<string> {
  const xml = await googleFetchText(`${GOOGLE_NEWS_BASE}${path}`);

  if (!/<rss\b/i.test(xml) || !/<item\b/i.test(xml)) {
    throw new CliError(
      'FETCH_ERROR',
      'Google News did not return an RSS feed',
      'Try a different query, or adjust --hl/--gl/--ceid.',
    );
  }

  return xml;
}

export async function googleFetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
    },
  });

  if (!resp.ok) {
    throw new CliError(
      'FETCH_ERROR',
      `Google HTTP ${resp.status}`,
      'Google may be temporarily unavailable. Try again later.',
    );
  }

  return resp.json() as Promise<T>;
}

export function buildGoogleNewsPath(query: string, options: GoogleNewsOptions = {}): string {
  const hl = normalizeHl(options.hl);
  const gl = normalizeGl(options.gl, hl);
  const ceid = String(options.ceid || `${gl}:${languageFromHl(hl)}`).trim();

  const params = new URLSearchParams();
  params.set('q', query);
  params.set('hl', hl);
  params.set('gl', gl);
  params.set('ceid', ceid);

  return `/rss/search?${params.toString()}`;
}

export function buildGoogleSuggestUrl(query: string): string {
  const params = new URLSearchParams();
  params.set('client', 'firefox');
  params.set('q', query);
  return `${GOOGLE_SUGGEST_URL}?${params.toString()}`;
}

export function buildGoogleSearchUrl(query: string, options: GoogleSearchOptions = {}): string {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('hl', normalizeHl(options.hl));
  params.set('num', String(Math.min(Math.max(Number(options.count) || 10, 1), 100)));
  const start = Math.max(Number(options.start) || 0, 0);
  if (start > 0) {
    params.set('start', String(start));
  }
  return `https://www.google.com/search?${params.toString()}`;
}

export function parseGoogleNewsRss(xml: string): GoogleNewsItem[] {
  const items: GoogleNewsItem[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTagText(block, 'title');
    const link = extractTagText(block, 'link') || extractTagText(block, 'guid');
    const published = normalizePubDate(extractTagText(block, 'pubDate'));
    const source = extractSourceText(block) || deriveSourceFromUrl(link);
    const sourceUrl = extractSourceUrl(block);

    if (!title || !link) continue;

    items.push({
      title,
      link,
      published,
      source,
      sourceUrl: sourceUrl || undefined,
    });
  }

  return items;
}

export function parseGoogleSuggest(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  const values = Array.isArray(payload[1]) ? payload[1] : [];
  return values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean);
}

async function googleFetchText(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
    },
  });

  if (!resp.ok) {
    throw new CliError(
      'FETCH_ERROR',
      `Google HTTP ${resp.status}`,
      'Google may be temporarily unavailable. Try again later.',
    );
  }

  return resp.text();
}

function extractTagText(block: string, tag: string): string {
  const safeTag = escapeRegExp(tag);
  const match = block.match(new RegExp(`<${safeTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${safeTag}>`, 'i'));
  if (!match) return '';

  return normalizeWhitespace(stripHtml(decodeXmlEntities(stripCdata(match[1]))));
}

function extractSourceText(block: string): string {
  const match = block.match(/<source(?:\s+url=(['"])(.*?)\1)?>([\s\S]*?)<\/source>/i);
  if (!match) return '';
  return normalizeWhitespace(decodeXmlEntities(stripCdata(match[3])));
}

function extractSourceUrl(block: string): string {
  const match = block.match(/<source(?:\s+url=(['"])(.*?)\1)[^>]*>/i);
  if (!match) return '';
  return normalizeWhitespace(decodeXmlEntities(match[2]));
}

function normalizePubDate(value: string): string {
  const text = normalizeWhitespace(decodeXmlEntities(stripCdata(value)));
  if (!text) return '-';

  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toISOString().slice(0, 10);
}

function deriveSourceFromUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function normalizeHl(value: string | undefined): string {
  const normalized = String(value || 'en-US').trim();
  return normalized || 'en-US';
}

function normalizeGl(value: string | undefined, hl: string): string {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized) return normalized;

  const localeParts = hl.split(/[-_]/);
  if (localeParts[1]) return localeParts[1].toUpperCase();
  return 'US';
}

function languageFromHl(hl: string): string {
  return hl.split(/[-_]/)[0] || 'en';
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
