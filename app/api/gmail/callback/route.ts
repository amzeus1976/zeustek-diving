import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { finishGmailConnection, gmailConfiguration, verifyOAuthState } from '@/lib/server/gmail-news';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const url = new URL(request.url);
  const destination = new URL('/', url.origin);
  destination.searchParams.set('section', 'Dive News');
  if (!user) return Response.redirect(destination, 302);
  const runtime = env as unknown as Parameters<typeof gmailConfiguration>[0];
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const error = url.searchParams.get('error');
  try {
    if (error) throw new Error(error === 'access_denied' ? 'Google access was not approved.' : 'Google could not complete the connection.');
    if (!gmailConfiguration(runtime).configured || !code || !state) throw new Error('The Gmail connection is not configured.');
    if (!await verifyOAuthState(runtime.GMAIL_TOKEN_ENCRYPTION_KEY ?? '', state, user.userId)) throw new Error('The Google sign-in request expired. Please try again.');
    await finishGmailConnection(runtime, user.userId, code, `${url.origin}/api/gmail/callback`);
    destination.searchParams.set('gmail', 'connected');
  } catch (connectionError) {
    destination.searchParams.set('gmailError', connectionError instanceof Error ? connectionError.message : 'Gmail connection failed.');
  }
  return Response.redirect(destination, 302);
}
