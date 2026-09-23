import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import {
  finishGmailConnection,
  gmailConfiguration,
  consumeOAuthState,
  gmailCallbackUri,
  GmailError,
} from '@/lib/server/gmail-news';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const url = new URL(request.url);
  const destination = new URL('/', gmailCallbackUri(request.url));
  destination.searchParams.set('section', 'Dive News');
  if (!user) return Response.redirect(destination, 302);
  const runtime = env as unknown as Parameters<typeof gmailConfiguration>[0];
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const error = url.searchParams.get('error');
  try {
    if (error)
      throw new GmailError(
        error === 'access_denied' ? 'consent_denied' : 'upstream_failure',
      );
    if (!gmailConfiguration(runtime).configured || !code || !state)
      throw new GmailError('missing_configuration');
    if (!(await consumeOAuthState(runtime, state, user.userId)))
      throw new GmailError('invalid_request');
    await finishGmailConnection(
      runtime,
      user.userId,
      code,
      gmailCallbackUri(request.url),
    );
    destination.searchParams.set('gmail', 'connected');
  } catch (connectionError) {
    destination.searchParams.set(
      'gmailError',
      connectionError instanceof GmailError
        ? connectionError.diagnostic.code
        : 'upstream_failure',
    );
  }
  return Response.redirect(destination, 302);
}
