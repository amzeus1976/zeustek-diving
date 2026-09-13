import { matchedOffers } from '@/lib/product-match';
import { getChatGPTUser } from '../../chatgpt-auth';

const blockedHost = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?)/i;

async function toGbp(amount: number, currency: string) {
  if (currency === 'GBP') return amount;
  const response = await fetch(`https://api.frankfurter.dev/v2/rate/${currency}/GBP`, { headers: { accept: 'application/json' }, cf: { cacheTtl: 21600, cacheEverything: true } } as RequestInit);
  if (!response.ok) return null;
  const result = await response.json() as { rate?: number };
  return Number.isFinite(result.rate) ? amount * Number(result.rate) : null;
}

function checkedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || blockedHost.test(url.hostname) || !url.hostname.includes('.')) throw new Error('Unsupported URL');
  return url;
}

async function fetchHtml(url: URL) {
  const response = await fetch(url, { headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Mozilla/5.0 (compatible; ZeusTekDivePriceCheck/2.0)' }, signal: AbortSignal.timeout(10000), redirect: 'follow' });
  if (!response.ok) throw new Error(`Retailer returned HTTP ${response.status}`);
  return (await response.text()).slice(0, 2_000_000);
}

async function readProduct(urlValue: string, description: string, query: string) {
  const url = checkedUrl(urlValue);
  const html = await fetchHtml(url);
  const offers: ReturnType<typeof matchedOffers> = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { offers.push(...matchedOffers(JSON.parse((match[1] ?? '').trim()),query)); } catch { /* Malformed metadata is not a verified price. */ }
  }
  const parsed = offers.map(entry=>({...entry,numericPrice:Number(String(entry.price).replace(/,/g,'')),currency:entry.priceCurrency.toUpperCase()})).filter(entry=>Number.isFinite(entry.numericPrice)&&entry.numericPrice>0&&/^[A-Z]{3}$/.test(entry.currency)).sort((a,b)=>a.numericPrice-b.numericPrice)[0];
  if (!parsed) throw new Error('No verified product and variant price match');
  const gbp = await toGbp(parsed.numericPrice, parsed.currency);
  if (gbp === null) throw new Error(`No GBP exchange rate for ${parsed.currency}`);
  return { url: parsed.url ? checkedUrl(new URL(parsed.url,url).href).href : url.href, productTitle:parsed.productTitle, matchVerified:true, description, price: parsed.numericPrice, currency: parsed.currency, gbp, available: true as const };
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { query?: string; links?: Array<{ url: string; description?: string }>; stores?: Array<{ name: string; searchUrl: string }> };
  const direct = (body.links ?? []).slice(0, 8).map(async (link) => { try { return await readProduct(link.url, link.description || checkedUrl(link.url).hostname,body.query || ''); } catch (error) { return { url: link.url, description: link.description || link.url, available: false as const, error: error instanceof Error ? error.message : 'Unavailable' }; } });
  const searched = (body.stores ?? []).slice(0, 10).map(async (store) => {
    const searchValue = store.searchUrl.replaceAll('{query}', encodeURIComponent(String(body.query ?? '').trim()));
    try {
      if (!body.query?.trim() || !store.searchUrl.includes('{query}')) throw new Error('Search template must include {query}');
      const searchUrl = checkedUrl(searchValue);
      const html = await fetchHtml(searchUrl);
      const queryTokens = body.query.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
      const candidates = [...html.matchAll(/href=["']([^"']*(?:\/products\/|\/product\/|\/p\/)[^"'#?]+)[^"']*["']/gi)].map((match) => new URL((match[1] ?? '').replaceAll('&amp;', '&'), searchUrl).href).filter((value, index, all) => all.indexOf(value) === index).map((url) => ({ url, score: queryTokens.reduce((score, token) => score + (decodeURIComponent(url).toLowerCase().includes(token) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score).filter(entry=>entry.score>0).slice(0, 5).map((entry) => entry.url);
      if (!candidates.length) throw new Error('Store search returned no product pages');
      const attempts = await Promise.all(candidates.map(async (candidate) => { try { return await readProduct(candidate, store.name,body.query || ''); } catch { return null; } }));
      const best = attempts.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).sort((a, b) => a.gbp - b.gbp)[0];
      if (!best) throw new Error('Products found but their prices were unreadable');
      return best;
    } catch (error) { return { url: searchValue, description: store.name, available: false as const, error: error instanceof Error ? error.message : 'Unavailable' }; }
  });
  const results = await Promise.all([...direct, ...searched]);
  return Response.json({ checkedAt: new Date().toISOString(), results });
}
