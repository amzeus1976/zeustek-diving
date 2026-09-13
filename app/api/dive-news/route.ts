import { getChatGPTUser } from '../../chatgpt-auth';
import { decodeHtmlEntities } from '@/lib/html-entities';

type FeedSource = { name: string; url: string; type?: string };

function safeFeedUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.local')) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return null;
    const match = host.match(/^172\.(\d+)\./);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return null;
    return url;
  } catch { return null; }
}

function decode(value: string) {
  return decodeHtmlEntities(value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match?.[1]) return decode(match[1]);
  }
  return '';
}

function parseFeed(xml: string, source: FeedSource) {
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>|<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ?? [];
  return blocks.slice(0, 12).flatMap((block) => {
    const title = tag(block, ['title']);
    const href = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || tag(block, ['link', 'guid']);
    const link = safeFeedUrl(href)?.toString() ?? '';
    if (!title || !link) return [];
    return [{
      title,
      link,
      summary: tag(block, ['description', 'summary', 'content:encoded', 'content']).slice(0, 360),
      publishedAt: tag(block, ['pubDate', 'published', 'updated', 'dc:date']),
      source: source.name,
      sourceType: source.type ?? 'rss',
    }];
  });
}

async function loadFeed(source: FeedSource) {
  const url = safeFeedUrl(source.url);
  if (!url) throw new Error('Only public HTTPS feed URLs are supported.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.4', 'user-agent': 'ZeusTek-Dive-News/1.0' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Feed returned ${response.status}.`);
    return parseFeed(await response.text(), source);
  } finally { clearTimeout(timer); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { sources?: FeedSource[] };
  const sources = (body.sources ?? []).filter((source) => source && typeof source.name === 'string' && typeof source.url === 'string').slice(0, 12);
  const settled = await Promise.allSettled(sources.map(loadFeed));
  const articles = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []).sort((a, b) => {
    const aTime = Date.parse(a.publishedAt) || 0;
    const bTime = Date.parse(b.publishedAt) || 0;
    return bTime - aTime;
  }).slice(0, 60);
  const failures = settled.flatMap((result, index) => result.status === 'rejected' ? [{ source: sources[index]?.name ?? 'Feed', error: result.reason instanceof Error ? result.reason.message : 'Feed unavailable.' }] : []);
  return Response.json({ articles, failures, refreshedAt: new Date().toISOString() });
}
