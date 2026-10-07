import { zeustekDb } from '../offline/db';
import { currentDiveAccount, saveLocalRecord } from '../offline/dive-store';
import type { JsonValue } from '../offline/types';
import { recordIdentity } from '../record-identity';
import { listLocalDiveRecords } from '../offline/dive-store';
import { preparePhoneRecord } from './planning';

export type PhoneDraftKind =
  | 'dive'
  | 'person'
  | 'operator'
  | 'trip'
  | 'gas-plan';
export interface PhoneDraft {
  id: string;
  account: string;
  kind: PhoneDraftKind;
  entityId?: string;
  record: Record<string, JsonValue>;
  baseRecord?: Record<string, JsonValue>;
  baseModifiedAt: string | null;
  savedAt: string;
}
export const phoneDraftKey = (account: string, id: string) =>
  `phone:draft:${account}:${id}`;
const assertOwner = (draft: PhoneDraft) => {
  if (currentDiveAccount() !== draft.account)
    throw new Error(
      'The account changed. Your draft remains with its original account.',
    );
};
export async function savePhoneDraft(draft: PhoneDraft) {
  assertOwner(draft);
  await zeustekDb.settings.put({
    key: phoneDraftKey(draft.account, draft.id),
    value: JSON.parse(JSON.stringify(draft)),
  });
}
export async function readPhoneDraft(id: string) {
  return (await zeustekDb.settings.get(phoneDraftKey(currentDiveAccount(), id)))
    ?.value as unknown as PhoneDraft | undefined;
}
export async function removePhoneDraft(id: string) {
  await zeustekDb.settings.delete(phoneDraftKey(currentDiveAccount(), id));
}
export async function listPhoneDrafts() {
  return (
    await zeustekDb.settings
      .where('key')
      .startsWith(`phone:draft:${currentDiveAccount()}:`)
      .toArray()
  ).map((row) => row.value as unknown as PhoneDraft);
}
export interface PhoneDraftReview {
  latest: Record<string, JsonValue>;
  merged: Record<string, JsonValue>;
  conflicts: string[];
  modifiedAt: string;
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const object = (value: unknown): value is Record<string, JsonValue> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export function mergePhoneDraft(
  base: Record<string, JsonValue>,
  draft: Record<string, JsonValue>,
  latest: Record<string, JsonValue>,
) {
  const conflicts: string[] = [];
  function merge(
    a: JsonValue | undefined,
    b: JsonValue | undefined,
    c: JsonValue | undefined,
    path: string,
  ): JsonValue | undefined {
    if (same(a, b)) return c;
    if (same(a, c) || same(b, c)) return b;
    if (object(a) && object(b) && object(c)) {
      const result: Record<string, JsonValue> = {};
      for (const key of new Set([
        ...Object.keys(a),
        ...Object.keys(b),
        ...Object.keys(c),
      ])) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
        const value = merge(
          a[key],
          b[key],
          c[key],
          path ? path + '.' + key : key,
        );
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    conflicts.push(path);
    return b;
  }
  const merged = merge(base, draft, latest, '') as Record<string, JsonValue>;
  return {
    merged,
    conflicts: conflicts.filter(
      (path) => !['entityId', 'createdAt', 'modifiedAt'].includes(path),
    ),
  };
}
export async function reviewPhoneDraft(
  draft: PhoneDraft,
): Promise<PhoneDraftReview> {
  assertOwner(draft);
  const row = await zeustekDb.entities.get(
    `dive:${draft.account}:${draft.entityId}`,
  );
  const latest = row?.record as Record<string, JsonValue> | undefined;
  if (!row || row.deleted || !latest)
    throw new Error(
      'This record was deleted. Your draft is retained for export; it cannot update the deleted record.',
    );
  if (!draft.baseRecord)
    throw new Error(
      'This older draft has no starting snapshot. Export it and compare it with the latest record before recreating your changes.',
    );
  if (typeof latest.modifiedAt !== 'string')
    throw new Error(
      'The saved revision is unavailable. Your draft is retained.',
    );
  return {
    latest,
    ...mergePhoneDraft(draft.baseRecord, draft.record, latest),
    modifiedAt: latest.modifiedAt,
  };
}
export async function applyPhoneDraftReview(
  draft: PhoneDraft,
  review: PhoneDraftReview,
) {
  assertOwner(draft);
  const updated: PhoneDraft = {
    ...draft,
    record: {
      ...review.merged,
      entityId: review.latest.entityId!,
      createdAt: review.latest.createdAt!,
      modifiedAt: review.latest.modifiedAt!,
    },
    baseRecord: review.latest,
    baseModifiedAt: review.modifiedAt,
    savedAt: new Date().toISOString(),
  };
  await zeustekDb.transaction('rw', zeustekDb.settings, async () => {
    await zeustekDb.settings.put({
      key: `phone:review:${draft.account}:${crypto.randomUUID()}`,
      value: JSON.parse(
        JSON.stringify({
          draft,
          latest: review.latest,
          reviewedAt: updated.savedAt,
        }),
      ),
    });
    await savePhoneDraft(updated);
  });
  return updated;
}
export async function listPhoneDraftReviews() {
  return (
    await zeustekDb.settings
      .where('key')
      .startsWith(`phone:review:${currentDiveAccount()}:`)
      .toArray()
  ).map((row) => row.value);
}
export async function commitPhoneDraft(draft: PhoneDraft) {
  assertOwner(draft);
  const record = preparePhoneRecord(draft.kind, draft.record);
  if (draft.entityId) {
    const row = await zeustekDb.entities.get(
      `dive:${currentDiveAccount()}:${draft.entityId}`,
    );
    const value = row?.record as Record<string, JsonValue> | null | undefined;
    if (!row || row.deleted || value?.modifiedAt !== draft.baseModifiedAt)
      throw new Error(
        'This record changed since you started writing. Your draft is retained. Review the latest record before saving.',
      );
  }
  if (!draft.entityId) {
    const identity = recordIdentity(draft.kind, record);
    const existing = await listLocalDiveRecords<Record<string, unknown>>(
      draft.kind,
      { includeSuppressed: true },
    );
    if (
      identity &&
      existing.some(
        (item) =>
          item.entityId !== draft.id &&
          recordIdentity(draft.kind, item) === identity,
      )
    )
      throw new Error(
        'A matching record already exists. Open it to review or edit. Your draft is retained.',
      );
  }
  assertOwner(draft);
  const result = await saveLocalRecord(
    draft.kind,
    { ...record, entityId: draft.entityId ?? draft.id },
    { expectedLocalModifiedAt: draft.baseModifiedAt },
  );
  assertOwner(draft);
  await removePhoneDraft(draft.id);
  return result;
}
