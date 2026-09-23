import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import {
  createOAuthState,
  gmailAuthorizationUrl,
  gmailConfiguration,
  gmailCallbackUri,
} from '@/lib/server/gmail-news';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  const runtime = env as unknown as Parameters<typeof gmailConfiguration>[0];
  const configuration = gmailConfiguration(runtime);
  const redirectUri = gmailCallbackUri(request.url);
  if (!configuration.configured)
    return Response.json(
      { configured: false, missing: configuration.missing, redirectUri },
      { status: 503 },
    );
  const state = await createOAuthState(
    runtime.GMAIL_TOKEN_ENCRYPTION_KEY ?? '',
    user.userId,
  );
  return Response.json(
    {
      configured: true,
      authorizationUrl: gmailAuthorizationUrl(
        runtime,
        redirectUri,
        state,
        'zeustekdivenews@gmail.com',
      ),
      redirectUri,
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
