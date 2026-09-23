export const NEWS_MAILBOX = 'zeustekdivenews@gmail.com';
export const GMAIL_READ_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly';
export type GmailDiagnosticCode =
  | 'missing_configuration'
  | 'callback_mismatch'
  | 'consent_denied'
  | 'wrong_account'
  | 'reconnect_required'
  | 'insufficient_scope'
  | 'rate_limited'
  | 'upstream_failure'
  | 'invalid_request'
  | 'sync_in_progress'
  | 'uncertain_outcome';
export type GmailDiagnostic = {
  code: GmailDiagnosticCode;
  message: string;
  remedy: string;
  reconnect: boolean;
};
export type GmailSyncRun = {
  runId: string;
  status: 'running' | 'completed' | 'failed' | 'uncertain';
  startedAt: string;
  completedAt?: string;
  count: number;
  imported: number;
  updated: number;
  unchanged: number;
  failed: number;
  hasMore: boolean;
  diagnostic?: GmailDiagnostic;
};
export type GmailConnectionStatus = {
  configured: boolean;
  missing: string[];
  redirectUri: string;
  connected: boolean;
  email: string;
  expectedEmail: string;
  connectedAt: string;
  lastSyncAt: string;
  lastSyncCount: number;
  lastError: string;
  syncMode: 'manual';
  reconnectRequired: boolean;
  diagnostic: GmailDiagnostic | null;
  lastRun: GmailSyncRun | null;
};
const details: Record<GmailDiagnosticCode, [string, string, boolean]> = {
  missing_configuration: [
    'Gmail server configuration is incomplete.',
    'Configure the Google OAuth client and token encryption key on the server.',
    false,
  ],
  callback_mismatch: [
    'Google rejected the callback address.',
    'Register the exact callback shown in Newsletter settings in the Google OAuth client.',
    false,
  ],
  consent_denied: [
    'Read-only mailbox consent was not granted.',
    'Connect again and approve Gmail read-only access for the dedicated account.',
    true,
  ],
  wrong_account: [
    'The connected Google account is not the dedicated newsletter mailbox.',
    `Reconnect as ${NEWS_MAILBOX}. No messages from the other account were imported.`,
    true,
  ],
  reconnect_required: [
    'Stored Gmail access is unavailable, expired or revoked.',
    'Reconnect the dedicated mailbox to renew offline read-only access.',
    true,
  ],
  insufficient_scope: [
    'Gmail read-only access is missing.',
    'Reconnect and approve gmail.readonly. Check that the Gmail API is enabled.',
    true,
  ],
  rate_limited: [
    'Google temporarily limited mailbox requests.',
    'Wait before starting another manual sync. Cached stories remain available.',
    false,
  ],
  upstream_failure: [
    'The mailbox provider could not complete the request.',
    'Check connection status and the recorded sync result before retrying.',
    false,
  ],
  invalid_request: [
    'The mailbox request was invalid.',
    'Start a new manual sync from Dive News, or reconnect if the sign-in request expired.',
    false,
  ],
  sync_in_progress: [
    'A mailbox sync is already in progress.',
    'Refresh connection status to see its recorded result. Do not start a duplicate run.',
    false,
  ],
  uncertain_outcome: [
    'The last sync outcome has not been confirmed.',
    'Refresh status using the same run ID. Resolve the recorded outcome before starting another sync.',
    false,
  ],
};
export function gmailDiagnostic(code: GmailDiagnosticCode): GmailDiagnostic {
  const [message, remedy, reconnect] = details[code];
  return { code, message, remedy, reconnect };
}
