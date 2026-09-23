import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { gmailConnectionStatus } from '@/lib/server/gmail-news';
export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  return Response.json(
    await gmailConnectionStatus(
      env as unknown as Parameters<typeof gmailConnectionStatus>[0],
      user.userId,
      request.url,
    ),
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
