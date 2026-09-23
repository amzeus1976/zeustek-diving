import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { GmailError, syncGmailNews } from '@/lib/server/gmail-news';
import { GMAIL_SYNC_DISABLED_MESSAGE, GMAIL_SYNC_RELEASE_DISABLED, gmailDiagnostic } from '@/lib/gmail-contract';
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (GMAIL_SYNC_RELEASE_DISABLED)
    return Response.json(
      { code: 'gmail_sync_disabled', error: GMAIL_SYNC_DISABLED_MESSAGE },
      { status: 503, headers: { 'cache-control': 'private, no-store' } },
    );
  try {
    const body = (await request.json().catch(() => null)) as {
      runId?: unknown;
    } | null;
    if (typeof body?.runId !== 'string')
      throw new GmailError('invalid_request');
    return Response.json(
      await syncGmailNews(
        env as unknown as Parameters<typeof syncGmailNews>[0],
        user.userId,
        body.runId,
      ),
      { headers: { 'cache-control': 'private, no-store' } },
    );
  } catch (error) {
    const diagnostic =
      error instanceof GmailError
        ? error.diagnostic
        : gmailDiagnostic('upstream_failure');
    return Response.json(
      { error: diagnostic.message, diagnostic },
      {
        status:
          diagnostic.code === 'invalid_request'
            ? 400
            : diagnostic.code === 'sync_in_progress'
              ? 409
              : 502,
        headers: { 'cache-control': 'private, no-store' },
      },
    );
  }
}
