import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { GmailError, syncGmailNews, gmailManualSyncAllowed } from '@/lib/server/gmail-news';
import { hasGmailAcceptanceGrant, hasGmailManualReleaseConfiguration, isGmailAcceptanceRunAllowed, type GmailReleaseEnv } from '@/lib/server/gmail-release-policy';
import { GMAIL_SYNC_DISABLED_MESSAGE, GMAIL_SYNC_RELEASE_DISABLED, gmailDiagnostic } from '@/lib/gmail-contract';
const privateHeaders = { 'cache-control': 'private, no-store' };
const disabled = () => Response.json(
  { code: 'gmail_sync_disabled', error: GMAIL_SYNC_DISABLED_MESSAGE },
  { status: 503, headers: privateHeaders },
);
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401, headers: privateHeaders });
  const releaseEnv = env as unknown as GmailReleaseEnv;
  const manualConfigured = hasGmailManualReleaseConfiguration(releaseEnv, user.userId);
  // Default isolation exits before parsing a body, opening storage or contacting Google.
  if (GMAIL_SYNC_RELEASE_DISABLED && !hasGmailAcceptanceGrant(releaseEnv, user.userId) && !manualConfigured)
    return disabled();
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Gmail sync requires a request from this application.' }, { status: 403, headers: privateHeaders });
  try {
    const body = (await request.json().catch(() => null)) as {
      runId?: unknown;
    } | null;
    if (typeof body?.runId !== 'string')
      throw new GmailError('invalid_request');
    if (GMAIL_SYNC_RELEASE_DISABLED && !isGmailAcceptanceRunAllowed(releaseEnv, user.userId, body.runId) &&
      !(manualConfigured && await gmailManualSyncAllowed(env as unknown as Parameters<typeof gmailManualSyncAllowed>[0], user.userId)))
      return disabled();
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
