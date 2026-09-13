import { getChatGPTUser } from '../../chatgpt-auth';
import { decodeHtmlEntities } from '@/lib/html-entities';

function safeRemoteUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      host === 'localhost' || host.endsWith('.local') || host === '::1' ||
      /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^(fc|fd|fe8|fe9|fea|feb)/i.test(host)
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function meta(html: string, names: string[]) {
  for (const name of names) {
    const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${name.replace(':', '\\:')}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name.replace(':', '\\:')}["'][^>]*>`, 'i');
    const match = html.match(pattern);
    const value = match?.[1] ?? match?.[2];
    if (value) return decodeHtmlEntities(value).trim();
  }
  return '';
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  let target = safeRemoteUrl(new URL(request.url).searchParams.get('url') ?? '');
  if (!target) return Response.json({ error: 'A public URL is required.' }, { status: 400 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let response: Response | null = null;
    for (let redirect = 0; redirect < 4; redirect += 1) {
      response = await fetch(target.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.2', 'user-agent': 'ZeusTek-Dive-Preview/1.0' },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const locationHeader: string | null = response.headers.get('location');
      target = locationHeader ? safeRemoteUrl(new URL(locationHeader, target).toString()) : null;
      if (!target) return Response.json({ error: 'The page redirected to an unsafe address.' }, { status: 400 });
    }
    if (!response?.ok) return Response.json({ error: 'The page could not be loaded.' }, { status: 502 });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('html')) return Response.json({ title: '', imageUrl: '' });
    const html = (await response.text()).slice(0, 500_000);
    const image = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
    const title = meta(html, ['og:title', 'twitter:title']) || decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
    const imageUrl = image ? safeRemoteUrl(new URL(image, target).toString())?.toString() ?? '' : '';
    return Response.json({ title, imageUrl }, { headers: { 'cache-control': 'private, max-age=3600' } });
  } catch {
    return Response.json({ error: 'Preview unavailable.' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
