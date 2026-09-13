import type { ChatGPTUser } from '@/app/chatgpt-auth';

export const HOUSEHOLD_ID = 'zeustek-household-v1';
export const OWNER_EMAIL = 'amzeusddo@googlemail.com';
export const PARTNER_EMAIL = 'gemmalouisebrown1983@gmail.com';

export type HouseholdEnv = { DB: D1Database };

export const SHARE_AREAS = [
  'dives', 'training', 'plans', 'bucket-list', 'wishlist', 'news', 'albums', 'people',
] as const;

export async function ensureHouseholdSchema(env: HouseholdEnv) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dive_households (id TEXT PRIMARY KEY,owner_user_id TEXT,created_at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dive_household_members (household_id TEXT NOT NULL,user_id TEXT,email TEXT NOT NULL COLLATE NOCASE,display_name TEXT NOT NULL,role TEXT NOT NULL,joined_at INTEGER,PRIMARY KEY(household_id,email))'),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_dive_household_members_user ON dive_household_members(user_id) WHERE user_id IS NOT NULL'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dive_household_shares (household_id TEXT NOT NULL,owner_user_id TEXT NOT NULL,area TEXT NOT NULL,can_view INTEGER NOT NULL DEFAULT 0,can_edit INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,PRIMARY KEY(household_id,owner_user_id,area))'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_dive_household_shares_owner ON dive_household_shares(owner_user_id,area)'),
  ]);
}

export function allowedHouseholdEmail(email: string) {
  return [OWNER_EMAIL, PARTNER_EMAIL].includes(email.toLowerCase());
}

export function isLocalPreviewUser(user: Pick<ChatGPTUser, 'userId' | 'email'>) {
  return process.env.NODE_ENV === 'development' && user.userId === 'local_seedy' && user.email === 'seedy@sites.test';
}

export function allowedHouseholdUser(user: Pick<ChatGPTUser, 'userId' | 'email'>) {
  return isLocalPreviewUser(user) || allowedHouseholdEmail(user.email);
}

export async function registerHouseholdUser(env: HouseholdEnv, user: ChatGPTUser) {
  if (!allowedHouseholdUser(user)) throw new Error('This account is not invited.');
  // The Sites development identity has its own records and never joins the real household.
  if (isLocalPreviewUser(user)) return { householdId: 'local-preview', role: 'owner', displayName: 'Preview' };
  await ensureHouseholdSchema(env);
  const now = Date.now();
  const email = user.email.toLowerCase();
  const role = email === OWNER_EMAIL ? 'owner' : 'member';
  const displayName = role === 'owner' ? 'Zeus' : 'Gemma';
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO dive_households (id,owner_user_id,created_at) VALUES (?,?,?)').bind(HOUSEHOLD_ID, role === 'owner' ? user.userId : null, now),
    env.DB.prepare("UPDATE dive_households SET owner_user_id=COALESCE(owner_user_id,?) WHERE id=?").bind(role === 'owner' ? user.userId : null, HOUSEHOLD_ID),
    env.DB.prepare('INSERT INTO dive_household_members (household_id,user_id,email,display_name,role,joined_at) VALUES (?,?,?,?,?,?) ON CONFLICT(household_id,email) DO UPDATE SET user_id=excluded.user_id,display_name=excluded.display_name,role=excluded.role,joined_at=COALESCE(dive_household_members.joined_at,excluded.joined_at)').bind(HOUSEHOLD_ID,user.userId,email,displayName,role,now),
    env.DB.prepare('INSERT OR IGNORE INTO dive_household_members (household_id,user_id,email,display_name,role,joined_at) VALUES (?,NULL,?,?,?,NULL)').bind(HOUSEHOLD_ID,OWNER_EMAIL,'Zeus','owner'),
    env.DB.prepare('INSERT OR IGNORE INTO dive_household_members (household_id,user_id,email,display_name,role,joined_at) VALUES (?,NULL,?,?,?,NULL)').bind(HOUSEHOLD_ID,PARTNER_EMAIL,'Gemma','member'),
  ]);
  for (const area of SHARE_AREAS) await env.DB.prepare('INSERT OR IGNORE INTO dive_household_shares (household_id,owner_user_id,area,can_view,can_edit,updated_at) VALUES (?,?,?,?,?,?)').bind(HOUSEHOLD_ID,user.userId,area,0,0,now).run();
  return { householdId: HOUSEHOLD_ID, role, displayName };
}

export async function householdUserIds(env: HouseholdEnv, user: ChatGPTUser) {
  await registerHouseholdUser(env, user);
  if (isLocalPreviewUser(user)) return [user.userId];
  const result = await env.DB.prepare('SELECT user_id AS userId FROM dive_household_members WHERE household_id=? AND user_id IS NOT NULL').bind(HOUSEHOLD_ID).all<{userId:string}>();
  return result.results.map((row) => row.userId);
}

export async function householdCanEditGear(env: HouseholdEnv, user: ChatGPTUser, ownerUserId: string) {
  const ids = await householdUserIds(env, user);
  return ids.includes(ownerUserId);
}

export async function householdAreaAccess(env: HouseholdEnv, user: ChatGPTUser, ownerUserId: string, area: string, edit = false) {
  const ids = await householdUserIds(env,user);
  if (!ids.includes(ownerUserId)) return false;
  if (ownerUserId === user.userId) return true;
  const row = await env.DB.prepare('SELECT can_view AS canView,can_edit AS canEdit FROM dive_household_shares WHERE household_id=? AND owner_user_id=? AND area=?').bind(HOUSEHOLD_ID,ownerUserId,area).first<{canView:number;canEdit:number}>();
  return edit ? Boolean(row?.canEdit) : Boolean(row?.canView);
}

export async function householdAreaUserIds(env: HouseholdEnv, user: ChatGPTUser, area: string, edit = false) {
  const ids = await householdUserIds(env,user);
  const allowed = [user.userId];
  for (const id of ids) if (id !== user.userId && await householdAreaAccess(env,user,id,area,edit)) allowed.push(id);
  return allowed;
}
