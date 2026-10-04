import { publicationPreview, ensurePublicationSchema } from './public-profile';
import { sha256, tableExists } from './sharing-access';
import {
  SHARE_GAS_FIELDS,
  SHARE_NOTICE,
  SHARE_SAFE_WARNINGS,
  SHARE_SCENARIO_BASIS,
  shareNumber,
  shareText,
  validateShareInput,
  validateSharedSnapshot,
  type ShareInput,
  type SharedSnapshot,
  type ShareDatum,
  type SharedSupply,
  type ShareGasKey,
  type ShareAttachment,
} from '../sharing/share-links';
type Source = { id: string; data_json: string };
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const array = (value: unknown, max: number) => {
  if (!Array.isArray(value)) return [];
  if (value.length > max) throw new Error('Selected evidence is too large.');
  return value.map(object);
};
const recordedText = (value: unknown, max = 180) =>
  value == null ? '' : shareText(value, max);
const recordedStatus = (
  value: unknown,
): 'PASS' | 'CAUTION' | 'BLOCKED' | 'Not recorded' =>
  value === 'PASS' || value === 'CAUTION' || value === 'BLOCKED'
    ? value
    : 'Not recorded';
async function source(db: D1Database, owner: string, kind: string, id: string) {
  const row = await db
    .prepare(
      'SELECT id,data_json FROM dive_records WHERE user_id=? AND kind=? AND id=? AND deleted_at IS NULL',
    )
    .bind(owner, kind, id)
    .first<Source>();
  if (!row || row.data_json.length > 1024 * 1024)
    throw new Error('Selected source unavailable.');
  const value = JSON.parse(row.data_json),
    data = object(value);
  if (!Object.keys(data).length || data.suppressedFromUse)
    throw new Error('Selected source unavailable.');
  return data;
}
export type ShareAssetRow = {
  id: string;
  owner_user_id: string;
  object_key: string;
  content_type: ShareAttachment['contentType'];
  label: string;
  byte_length: number;
  content_hash: string;
};
export async function ownedShareAsset(
  db: D1Database,
  owner: string,
  id: string,
) {
  if (!(await tableExists(db, 'dive_share_assets'))) return null;
  return db
    .prepare(
      'SELECT id,owner_user_id,object_key,content_type,label,byte_length,content_hash FROM dive_share_assets WHERE id=? AND owner_user_id=?',
    )
    .bind(id, owner)
    .first<ShareAssetRow>();
}
export async function buildSharePreview(
  db: D1Database,
  owner: string,
  raw: ShareInput,
  asOf = new Date().toISOString(),
) {
  const input = validateShareInput(raw),
    snapshot: SharedSnapshot = {
      version: 1,
      kind: input.kind,
      label: input.label,
      asOf,
      source: 'Owner-selected canonical evidence',
      expiresAt: input.expiresAt,
      attachments: [],
    },
    assetEvidence: string[] = [];
  for (const id of input.attachmentIds) {
    const asset = await ownedShareAsset(db, owner, id);
    if (!asset) throw new Error('Selected attachment unavailable.');
    snapshot.attachments.push({
      id: asset.id,
      label: asset.label,
      contentType: asset.content_type,
      bytes: asset.byte_length,
    });
    assetEvidence.push(asset.content_hash);
  }
  if (input.kind === 'profile') {
    const { certificationIds, trainingIds, ...base } = input.profile!,
      { photoId, ...profileFields } = base,
      preview = await publicationPreview(db, owner, profileFields, asOf),
      {
        version: _version,
        asOf: _asOf,
        source: _source,
        photoUrl: _photoUrl,
        ...profile
      } = preview.snapshot;
    const people = await db
      .prepare(
        "SELECT id,data_json FROM dive_records WHERE user_id=? AND kind='person' AND deleted_at IS NULL AND COALESCE(json_extract(data_json,'$.suppressedFromUse'),0)=0 AND json_extract(data_json,'$.roles.ownerProfile')=1 ORDER BY id LIMIT 2",
      )
      .bind(owner)
      .all<Source>();
    if (people.results.some((row) => row.data_json.length > 1024 * 1024))
      throw new Error('Owner evidence too large.');
    if (photoId) {
      const asset = await ownedShareAsset(db, owner, photoId);
      if (!asset || !['image/png', 'image/jpeg'].includes(asset.content_type))
        throw new Error('Selected photograph unavailable.');
      assetEvidence.push(asset.content_hash);
    }
    const owners = people.results.filter((row) => {
      const person = object(JSON.parse(row.data_json));
      return (
        !person.suppressedFromUse && object(person.roles).ownerProfile === true
      );
    });
    if (owners.length !== 1 && (certificationIds.length || trainingIds.length))
      throw new Error('Owner evidence unavailable or ambiguous.');
    const certifications: NonNullable<
        SharedSnapshot['profile']
      >['certifications'] = [],
      training: NonNullable<SharedSnapshot['profile']>['training'] = [];
    for (const id of certificationIds) {
      const data = await source(db, owner, 'certification', id);
      if (data.personId && data.personId !== owners[0]?.id)
        throw new Error('Selected award is not owner evidence.');
      const issued =
        typeof data.issuedAt === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(data.issuedAt)
          ? data.issuedAt
          : undefined;
      certifications.push({
        title: recordedText(data.certification || data.level),
        agency: recordedText(data.agency, 100),
        ...(issued ? { date: issued } : {}),
      });
    }
    for (const id of trainingIds) {
      const data = await source(db, owner, 'training-progress', id);
      if (data.personId && data.personId !== owners[0]?.id)
        throw new Error('Selected training is not owner evidence.');
      training.push({
        title: recordedText(data.courseTitle),
        agency: recordedText(data.agency, 100),
        status: recordedText(data.status, 30),
      });
    }
    snapshot.profile = {
      ...profile,
      ...(base.photoId ? { photoId: base.photoId } : {}),
      certifications,
      training,
    };
  } else {
    const selection = input.gasPlan!,
      data = await source(db, owner, 'gas-plan', selection.recordId),
      saved = object(data.recGasPlan101),
      allocation = object(data.allocationV1),
      assessment = object(allocation.assessment),
      result = object(assessment.allocation),
      candidates = array(saved.gasCandidates, 30),
      selected = candidates.filter((row) => row.selected === true);
    if (selected.length > 1)
      throw new Error('Saved gas selection is ambiguous.');
    const gas = selected[0] ?? {},
      reserve = object(saved.reserve),
      inputs: ShareDatum[] = [],
      outputs: ShareDatum[] = [];
    const add = (rows: ShareDatum[], key: ShareGasKey, value: unknown) => {
      if (value === undefined) return;
      const definition = SHARE_GAS_FIELDS[key];
      rows.push({
        key,
        label: definition[0],
        unit: definition[1],
        value: typeof value === 'string' ? value : shareNumber(value),
      });
    };
    if (selection.inputs) {
      for (const key of [
        'plannedDepthM',
        'plannedWorkingTimeMin',
        'waterType',
        'ownRmvLMin',
        'buddyRmvLMin',
        'maxPpo2',
        'reserveStrategy',
        'ascentRateMMin',
        'gfLow',
        'gfHigh',
        'startPressureBar',
        'cylinderWaterVolumeL',
        'surfacePressureBar',
        'conservatismM',
      ] as ShareGasKey[])
        add(
          inputs,
          key,
          saved[key] ??
            (key === 'plannedWorkingTimeMin'
              ? data.plannedBottomTimeMin
              : key === 'ownRmvLMin'
                ? data.rmvRateLitresMin
                : data[key]),
        );
    }
    if (selection.outputs) {
      for (const [key, value] of [
        ['selectedOxygenFraction', gas.oxygenFraction],
        [
          'ndlMinutes',
          object(gas.ndl).state === 'available'
            ? object(gas.ndl).minutes
            : undefined,
        ],
        ['modM', gas.modM],
        ['ppo2AtPlannedDepth', gas.ppo2AtPlannedDepth],
        ['gasLimitedTimeMin', gas.gasLimitedTimeMin],
        ['totalGasLitres', saved.totalGasLitres],
        ['reserveLitres', reserve.selectedLitres],
        ['reservePressureBar', reserve.selectedBar],
        ['availableWorkingTimeMin', saved.availableWorkingTimeMin],
      ] as Array<[ShareGasKey, unknown]>)
        add(outputs, key, value);
    }
    const supplies: SharedSupply[] = [],
      phases: NonNullable<SharedSnapshot['gasPlan']>['reservePhases'] = [];
    if (selection.supplies) {
      const suppliesSource = Array.isArray(allocation.cylinders)
          ? array(allocation.cylinders, 16)
          : array(data.cylinders, 16),
        results = array(result.cylinders, 16),
        segments = array(saved.routeSegments, 200),
        manifolds = array(allocation.manifolds, 16);
      for (const [index, row] of suppliesSource.entries()) {
        const storedResults = results.filter((item) => item.id === row.id);
        if (storedResults.length > 1)
          throw new Error('Saved cylinder result is ambiguous.');
        const stored = storedResults[0] ?? {},
          manifold = manifolds.find(
            (group) =>
              Array.isArray(group.cylinderIds) &&
              group.cylinderIds.includes(row.id),
          ),
          fractions = object(row.gas),
          role = [
            'main',
            'sidemount-left',
            'sidemount-right',
            'pony',
            'stage',
            'primary',
            'bottom',
            'bailout',
          ].includes(String(row.role))
            ? String(row.role)
            : 'Not recorded',
          at = segments.findIndex(
            (segment) => segment.id === row.availableFrom,
          );
        supplies.push({
          label: `Supply ${index + 1}`,
          role,
          accessibility: manifold
            ? manifold.connected === true && manifold.operatingState === 'open'
              ? 'manifold open'
              : manifold.operatingState === 'closed'
                ? 'manifold closed'
                : 'manifold unknown'
            : 'independent',
          oxygenFraction: shareNumber(
            fractions.oxygen ?? row.manualOxygenFraction,
            1,
          ),
          heliumFraction: shareNumber(
            fractions.helium ?? row.manualHeliumFraction,
            1,
          ),
          waterVolumeL: shareNumber(
            row.waterVolumeL ?? row.waterVolumeOverrideL,
          ),
          currentPressureBar: shareNumber(row.currentPressureBar),
          plannedStartPressureBar: shareNumber(
            row.plannedStartPressureBar ?? row.startPressureBar,
          ),
          availableFrom:
            !row.availableFrom || row.availableFrom === 'start'
              ? 'Start'
              : at >= 0
                ? `Checkpoint ${at + 1}`
                : 'Unresolved saved checkpoint',
          availableLitres: shareNumber(stored.availableLitres),
          requiredLitres: shareNumber(stored.requiredLitres),
          reserveLitres: shareNumber(stored.reserveLitres),
          contingencyRequiredLitres: shareNumber(
            stored.contingencyRequiredLitres,
          ),
          status: ['PASS', 'CAUTION', 'BLOCKED'].includes(String(stored.status))
            ? (stored.status as SharedSupply['status'])
            : 'Not recorded',
        });
      }
    }
    if (selection.outputs)
      for (const [index, phase] of array(reserve.phases, 20).entries())
        phases.push({
          label: `Emergency phase ${index + 1}`,
          depthM: shareNumber(phase.depthM),
          minutes: shareNumber(phase.minutes),
          multiplier: shareNumber(phase.multiplier),
          litres: shareNumber(phase.litres),
        });
    const scenarios: NonNullable<SharedSnapshot['gasPlan']>['scenarios'] = [];
    if (selection.supplies) {
      const suppliesSource = Array.isArray(allocation.cylinders)
          ? array(allocation.cylinders, 16)
          : array(data.cylinders, 16),
        segments = array(saved.routeSegments, 200),
        manifolds = array(allocation.manifolds, 16),
        results = array(result.scenarios, 16);
      const supplyLabels = (id: unknown) => {
        const indices = suppliesSource.flatMap((row, index) =>
            row.id === id ? [index] : [],
          ),
          group = manifolds.find((row) => row.id === id);
        if (group && Array.isArray(group.cylinderIds))
          for (const member of group.cylinderIds) {
            const at = suppliesSource.findIndex((row) => row.id === member);
            if (at < 0) throw new Error('Saved scenario endpoint unavailable.');
            indices.push(at);
          }
        if (!indices.length)
          throw new Error('Saved scenario endpoint unavailable.');
        return [...new Set(indices)].map((index) => `Supply ${index + 1}`);
      };
      for (const [index, row] of array(allocation.scenarios, 16)
        .filter((row) => row.selected === true)
        .entries()) {
        const matches = results.filter(
          (item) => item.id === row.id && item.selected === true,
        );
        if (matches.length > 1)
          throw new Error('Saved scenario result is ambiguous.');
        const stored = matches[0] ?? {},
          at = segments.findIndex((segment) => segment.id === row.at);
        const members = array(stored.cylinders, 16).map((member) => {
          const labels = supplyLabels(member.id);
          if (labels.length !== 1)
            throw new Error('Saved scenario member unavailable.');
          return {
            label: labels[0]!,
            availableLitres: shareNumber(member.availableLitres),
            requiredLitres: shareNumber(member.requiredLitres),
            reserveLitres: shareNumber(member.reserveLitres),
            status: recordedStatus(member.status),
          };
        });
        scenarios.push({
          label: `Contingency ${index + 1}`,
          kind: 'contingency/bailout',
          status: recordedStatus(stored.status),
          factor: shareNumber(stored.factor, 100),
          basis:
            stored.basis === SHARE_SCENARIO_BASIS
              ? SHARE_SCENARIO_BASIS
              : 'Not recorded',
          at:
            row.at === 'start'
              ? 'Start'
              : at >= 0
                ? `Checkpoint ${at + 1}`
                : 'Unresolved saved checkpoint',
          failedSupplies: Array.isArray(row.failedSupplyIds)
            ? [...new Set(row.failedSupplyIds.flatMap(supplyLabels))]
            : [],
          cylinders: members,
        });
      }
    }
    const allWarnings = [
      ...new Set([
        ...(Array.isArray(saved.warnings) ? saved.warnings : []),
        ...(Array.isArray(saved.readinessReasons)
          ? saved.readinessReasons
          : []),
        ...(Array.isArray(gas.warnings) ? gas.warnings : []),
        ...(Array.isArray(assessment.physiologicalReasons)
          ? assessment.physiologicalReasons
          : []),
        ...(Array.isArray(result.reasons) ? result.reasons : []),
      ]),
    ];
    if (allWarnings.length > 10000)
      throw new Error('Saved warnings too large.');
    const warnings = allWarnings.filter(
      (warning): warning is string =>
        typeof warning === 'string' && SHARE_SAFE_WARNINGS.has(warning),
    );
    snapshot.gasPlan = {
      modelVersion:
        typeof saved.version === 'string' &&
        /^zeustek-rec-gas-\d+\/\d+(?:\.\d+)*$/.test(saved.version)
          ? saved.version
          : null,
      allocationVersion:
        allocation.version === 'zeustek-allocation/1'
          ? 'zeustek-allocation/1'
          : null,
      physiologicalStatus: recordedStatus(assessment.physiologicalStatus),
      recordedAt:
        typeof saved.createdAt === 'string' &&
        Number.isFinite(Date.parse(saved.createdAt))
          ? saved.createdAt
          : null,
      inputs,
      outputs,
      supplies,
      scenarios,
      reservePhases: phases,
      warnings,
      omittedWarnings: allWarnings.length - warnings.length,
      notice: SHARE_NOTICE,
    };
  }
  validateSharedSnapshot(snapshot);
  return {
    snapshot,
    previewHash: await sha256(JSON.stringify({ snapshot, assetEvidence })),
  };
}
export async function ensureShareSchema(db: D1Database) {
  await ensurePublicationSchema(db);
  await db.batch([
    db.prepare(
      'CREATE TABLE IF NOT EXISTS dive_share_links (id TEXT PRIMARY KEY,owner_user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER,enabled INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,selection_json TEXT NOT NULL,operation_id TEXT NOT NULL)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS dive_share_owner ON dive_share_links(owner_user_id,created_at DESC)',
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS dive_share_assets (id TEXT PRIMARY KEY,owner_user_id TEXT NOT NULL,object_key TEXT NOT NULL,content_type TEXT NOT NULL,label TEXT NOT NULL,byte_length INTEGER NOT NULL,content_hash TEXT NOT NULL,created_at INTEGER NOT NULL)',
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS dive_share_rate (share_id TEXT PRIMARY KEY,window_start INTEGER NOT NULL,hits INTEGER NOT NULL)',
    ),
  ]);
}
export function shareCapability() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
export type ShareLinkRow = {
  id: string;
  owner_user_id: string;
  expires_at: number | null;
  enabled: number;
  revision: number;
  created_at: number;
  updated_at: number;
};
export function readSharedArtifact(json: string) {
  if (json.length > 256 * 1024) throw new Error('Shared artifact unavailable.');
  return validateSharedSnapshot(JSON.parse(json));
}
export async function activeShare(
  db: D1Database,
  request: Request,
  rateLimit = true,
) {
  const auth = request.headers.get('authorization');
  if (
    !auth ||
    !/^Bearer [A-Za-z0-9_-]{43}$/.test(auth) ||
    !(await tableExists(db, 'dive_share_links'))
  )
    return null;
  const hash = await sha256(auth.slice(7)),
    link = await db
      .prepare(
        "SELECT l.id,l.owner_user_id,l.expires_at,l.enabled,l.revision,l.created_at,l.updated_at,p.snapshot_json FROM dive_share_links l JOIN dive_publications p ON p.slot='share:'||l.id AND p.owner_user_id=l.owner_user_id WHERE l.token_hash=? AND l.enabled=1 AND p.enabled=1",
      )
      .bind(hash)
      .first<ShareLinkRow & { snapshot_json: string }>();
  if (!link || (link.expires_at !== null && link.expires_at <= Date.now()))
    return null;
  const snapshot = readSharedArtifact(link.snapshot_json);
  if (
    snapshot.expiresAt !== null &&
    Date.parse(snapshot.expiresAt) <= Date.now()
  )
    return null;
  if (rateLimit) {
    const stamp = Math.floor(Date.now() / 60000) * 60000,
      result = await db
        .prepare(
          'INSERT INTO dive_share_rate (share_id,window_start,hits) VALUES (?,?,1) ON CONFLICT(share_id) DO UPDATE SET window_start=excluded.window_start,hits=CASE WHEN dive_share_rate.window_start<>excluded.window_start THEN 1 ELSE dive_share_rate.hits+1 END WHERE dive_share_rate.window_start<>excluded.window_start OR dive_share_rate.hits<50 RETURNING hits',
        )
        .bind(link.id, stamp)
        .first();
    if (!result) throw new Error('SHARE_RATE_LIMIT');
  }
  return { link, snapshot };
}
export { source as readShareSource };
