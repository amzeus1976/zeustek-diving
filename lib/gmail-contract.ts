export const GMAIL_READ_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly';
// Owner-approved release isolation. Keep the connection and cached stories;
// only the live mailbox-sync action is unavailable until separately repaired.
export const GMAIL_SYNC_RELEASE_DISABLED = true;
export const GMAIL_SYNC_DISABLED_MESSAGE =
  'Gmail sync temporarily unavailable — repair deferred.';
export type GmailDiagnosticCode =
  | 'missing_configuration'
  | 'callback_mismatch'
  | 'consent_denied'
  | 'wrong_account'
  | 'reconnect_required'
  | 'insufficient_scope'
  | 'rate_limited'
  | 'request_timeout'
  | 'upstream_failure'
  | 'invalid_request'
  | 'sync_in_progress'
  | 'uncertain_outcome';
export type GmailDiagnosticPhase='token_exchange'|'token_refresh'|'account_verification'|'message_listing'|'metadata_retrieval'|'parsing'|'persistence';
export type GmailRequestStage = 'request_setup' | 'fetch' | 'response_body';
type GmailEvidenceFields = {phase:GmailDiagnosticPhase;kind:'http'|'transport'|'parsing'|'validation'|'storage';httpStatus?:number};
export type GmailDiagnosticEvidence = GmailEvidenceFields & (
  {version:1} | {version:2;requestStage:GmailRequestStage}
);
export type GmailDiagnostic = {
  evidence?:GmailDiagnosticEvidence;
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
  syncMode: 'manual' | 'disabled';
  reconnectRequired: boolean;
  diagnostic: GmailDiagnostic | null;
  lastRun: GmailSyncRun | null;
  acceptanceRunId?: string | null;
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
    'Reconnect using the dedicated newsletter account shown in connection settings. No messages from the other account were imported.',
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
  request_timeout: [
    'The mailbox request exceeded its time limit.',
    'Refresh connection status and inspect the recorded result. Cached stories remain available.',
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
export function gmailDiagnostic(code: GmailDiagnosticCode,evidence?:GmailDiagnosticEvidence): GmailDiagnostic {
  const [message, remedy, reconnect] = details[code];
  return { code, message, remedy, reconnect,...(safeGmailEvidence(evidence)?{evidence:safeGmailEvidence(evidence)!}:{}) };
}

const phases=['token_exchange','token_refresh','account_verification','message_listing','metadata_retrieval','parsing','persistence'] as const;
const requestStages = ['request_setup', 'fetch', 'response_body'] as const;
function safeGmailEvidence(value:unknown):GmailDiagnosticEvidence|null {
 if(!value||typeof value!=='object')return null;
 const row=value as Record<string,unknown>;
 if(row.version!==1&&row.version!==2||!phases.includes(row.phase as GmailDiagnosticPhase)||!['http','transport','parsing','validation','storage'].includes(String(row.kind)))return null;
 const fields:GmailEvidenceFields = {phase:row.phase as GmailDiagnosticPhase,kind:row.kind as GmailDiagnosticEvidence['kind'],...(typeof row.httpStatus==='number'&&Number.isInteger(row.httpStatus)&&row.httpStatus>=100&&row.httpStatus<=599?{httpStatus:row.httpStatus}:{})};
 if(row.version===1)return {version:1,...fields};
 if(row.version!==2||!requestStages.includes(row.requestStage as GmailRequestStage))return null;
 return {version:2,...fields,requestStage:row.requestStage as GmailRequestStage};
}
export function isGmailDiagnosticCode(value:unknown):value is GmailDiagnosticCode {
 return typeof value==='string'&&Object.prototype.hasOwnProperty.call(details,value);
}
export function normaliseGmailDiagnosticCode(value:unknown):GmailDiagnosticCode {
 return isGmailDiagnosticCode(value)?value:'upstream_failure';
}
/** Rebuild from the allowlist: never echo stored/provider messages or unknown keys. */
export function normaliseGmailDiagnostic(value:unknown):GmailDiagnostic|null {
 if(!value||typeof value!=='object')return null;
 const row=value as Record<string,unknown>;
 if(!isGmailDiagnosticCode(row.code))return gmailDiagnostic('upstream_failure');
 return gmailDiagnostic(row.code,safeGmailEvidence(row.evidence)??undefined);
}
export function gmailDiagnosticEvidenceLabel(diagnostic:GmailDiagnostic|null|undefined) {
 const evidence=safeGmailEvidence(diagnostic?.evidence);
 if(!evidence)return 'Failure stage was not recorded for this result.';
 const labels:Record<GmailDiagnosticPhase,string>={token_exchange:'OAuth token exchange',token_refresh:'Token refresh',account_verification:'Account verification',message_listing:'Message listing',metadata_retrieval:'Metadata retrieval',parsing:'Message parsing',persistence:'Application persistence'};
 const kinds={http:'Provider response',transport:'Transport failure',parsing:'Response parsing',validation:'Invalid response or credential',storage:'Storage failure'};
 const stages:Record<GmailRequestStage,string>={request_setup:'Request setup',fetch:'Fetch',response_body:'Response body'};
 return `${labels[evidence.phase]} · ${kinds[evidence.kind]}${evidence.version===2?` · ${stages[evidence.requestStage]}`:''}${evidence.httpStatus?` · HTTP ${evidence.httpStatus}`:''}`;
}

export function normaliseGmailSyncRun(value:unknown):GmailSyncRun|null {
 if(!value||typeof value!=='object')return null;const row=value as Record<string,unknown>;
 if(typeof row.runId!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(row.runId)||!['running','completed','failed','uncertain'].includes(String(row.status)))return null;
 const date=(value:unknown)=>typeof value==='string'&&value.length<=40&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
 const count=(value:unknown)=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=100?value:0;
 const diagnostic=normaliseGmailDiagnostic(row.diagnostic),completedAt=date(row.completedAt);
 return {runId:row.runId,status:row.status as GmailSyncRun['status'],startedAt:date(row.startedAt),...(completedAt?{completedAt}:{}),count:count(row.count),imported:count(row.imported),updated:count(row.updated),unchanged:count(row.unchanged),failed:count(row.failed),hasMore:row.hasMore===true,...(diagnostic?{diagnostic}:{})};
}
