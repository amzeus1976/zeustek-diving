import { getChatGPTUser } from '../../chatgpt-auth';

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

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  let target = safeRemoteUrl(new URL(request.url).searchParams.get('url') ?? '');
  if (!target) return Response.json({ error: 'A public image URL is required.' }, { status: 400 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let response: Response | null = null;
    for (let redirect = 0; redirect < 4; redirect += 1) {
      response = await fetch(target.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: 'image/*', 'user-agent': 'ZeusTek-Dive-Dashboard/1.0' },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location: string | null = response.headers.get('location');
      target = location ? safeRemoteUrl(new URL(location, target).toString()) : null;
      if (!target) return Response.json({ error: 'The image redirected to an unsafe address.' }, { status: 400 });
    }
    if (!response?.ok) return Response.json({ error: 'The image could not be loaded.' }, { status: 502 });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('image/')) return Response.json({ error: 'The URL did not return an image.' }, { status: 415 });
    const body = await response.arrayBuffer();
    if (body.byteLength > 12 * 1024 * 1024) return Response.json({ error: 'The image is too large.' }, { status: 413 });
    return new Response(body, { headers: { 'content-type': contentType, 'cache-control': 'private, max-age=86400' } });
  } catch {
    return Response.json({ error: 'The image service did not respond.' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
