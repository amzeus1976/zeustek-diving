import type { GmailSyncRun } from '../gmail-contract';

/** Server-only controls. Configuration must follow a separate owner grant. */
export type GmailReleaseEnv = {
  GMAIL_ACCEPTANCE_ENABLED?: string;
  GMAIL_ACCEPTANCE_OWNER_ID?: string;
  GMAIL_ACCEPTANCE_RUN_ID?: string;
  GMAIL_ACCEPTANCE_ISSUED_AT?: string;
  GMAIL_ACCEPTANCE_EXPIRES_AT?: string;
  GMAIL_MANUAL_SYNC_ENABLED?: string;
  GMAIL_MANUAL_SYNC_VERIFIED_RUN_ID?: string;
};

const consumedRun = 'fdeda6a4-5504-49d0-881d-d1795839955b';
const maximumGrantMs = 24 * 60 * 60_000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const utcDate = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? time : null;
};

function grantMetadata(env: GmailReleaseEnv, ownerId: string) {
  const runId = env.GMAIL_ACCEPTANCE_RUN_ID;
  const issued = utcDate(env.GMAIL_ACCEPTANCE_ISSUED_AT);
  const expires = utcDate(env.GMAIL_ACCEPTANCE_EXPIRES_AT);
  if (!ownerId || env.GMAIL_ACCEPTANCE_OWNER_ID !== ownerId || typeof runId !== 'string' ||
    !uuid.test(runId) || runId === consumedRun || issued === null || expires === null ||
    expires <= issued || expires - issued > maximumGrantMs) return null;
  return { runId, issued, expires };
}

export function hasGmailAcceptanceGrant(env: GmailReleaseEnv, ownerId: string, now = Date.now()) {
  const grant = grantMetadata(env, ownerId);
  return env.GMAIL_ACCEPTANCE_ENABLED === 'true' && Boolean(grant && grant.issued <= now && now < grant.expires);
}

export function isGmailAcceptanceRunAllowed(env: GmailReleaseEnv, ownerId: string, runId: string, now = Date.now()) {
  return hasGmailAcceptanceGrant(env, ownerId, now) && env.GMAIL_ACCEPTANCE_RUN_ID === runId;
}

export function hasGmailManualReleaseConfiguration(env: GmailReleaseEnv, ownerId: string) {
  const grant = grantMetadata(env, ownerId);
  return env.GMAIL_MANUAL_SYNC_ENABLED === 'true' && Boolean(grant && env.GMAIL_MANUAL_SYNC_VERIFIED_RUN_ID === grant.runId);
}

/** A feature flag cannot substitute for successful, owner-scoped acceptance. */
export async function verifiedGmailManualRelease(
  env: GmailReleaseEnv,
  ownerId: string,
  readRun: (ownerId: string, runId: string) => Promise<GmailSyncRun | null>,
) {
  if (!hasGmailManualReleaseConfiguration(env, ownerId)) return false;
  const grant = grantMetadata(env, ownerId)!;
  const result = await readRun(ownerId, grant.runId);
  if (!result || result.runId !== grant.runId || result.status !== 'completed' || result.failed !== 0 || result.diagnostic) return false;
  const started = utcDate(result.startedAt), completed = utcDate(result.completedAt);
  return started !== null && completed !== null && started >= grant.issued &&
    completed >= started && completed <= grant.expires && completed <= Date.now();
}
