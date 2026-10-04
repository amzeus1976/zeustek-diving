import { env } from 'cloudflare:workers';
import { activeShare } from '@/lib/server/share-links';
import { sharingJson, sharingHeaders } from '@/lib/server/sharing-access';
export async function GET(request: Request) {
  try {
    const result = await activeShare(env.DB, request);
    return result
      ? sharingJson(result.snapshot)
      : sharingJson({ error: 'This shared snapshot is unavailable.' }, 404);
  } catch (error) {
    return error instanceof Error && error.message === 'SHARE_RATE_LIMIT'
      ? Response.json(
          { error: 'Too many requests. Wait before refreshing this share.' },
          { status: 429, headers: { ...sharingHeaders, 'retry-after': '60' } },
        )
      : sharingJson({ error: 'This shared snapshot is unavailable.' }, 404);
  }
}
