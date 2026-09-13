import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { gmailConfiguration, readGmailConnection } from '@/lib/server/gmail-news';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const runtime = env as unknown as Parameters<typeof gmailConfiguration>[0];
  const configuration = gmailConfiguration(runtime);
  const connection = configuration.configured ? await readGmailConnection(runtime, user.userId) : null;
  return Response.json({
    configured: configuration.configured,
    missing: configuration.missing,
    redirectUri: `${new URL(request.url).origin}/api/gmail/callback`,
    connected: Boolean(connection),
    email: connection?.email ?? '',
    connectedAt: connection?.connectedAt ?? '',
    lastSyncAt: connection?.lastSyncAt ?? '',
    lastSyncCount: connection?.lastSyncCount ?? 0,
    lastError: connection?.lastError ?? '',
    syncMode: 'when-open',
  });
}
