import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { gmailConfiguration, syncGmailNews } from '@/lib/server/gmail-news';

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const runtime = env as unknown as Parameters<typeof gmailConfiguration>[0];
  if (!gmailConfiguration(runtime).configured) return Response.json({ error: 'Google mailbox access is not configured.' }, { status: 503 });
  try { return Response.json(await syncGmailNews(runtime, user.userId)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Mailbox sync failed.' }, { status: 502 }); }
}
