import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { gmailConfiguration, removeGmailConnection } from '@/lib/server/gmail-news';

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const runtime = env as unknown as Parameters<typeof gmailConfiguration>[0];
  await removeGmailConnection(runtime, user.userId);
  return Response.json({ disconnected: true });
}
