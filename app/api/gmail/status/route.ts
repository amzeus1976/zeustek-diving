import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { gmailDiagnostic } from '@/lib/gmail-contract';
import { GmailError, gmailConnectionStatus } from '@/lib/server/gmail-news';
export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  try { return Response.json(
    await gmailConnectionStatus(
      env as unknown as Parameters<typeof gmailConnectionStatus>[0],
      user.userId,
      request.url,
    ),
    { headers: { 'cache-control': 'private, no-store' } },
  ); } catch(error) { const diagnostic=error instanceof GmailError?error.diagnostic:gmailDiagnostic('upstream_failure');return Response.json({error:diagnostic.message,diagnostic},{status:502,headers:{'cache-control':'private, no-store'}}); }
}
