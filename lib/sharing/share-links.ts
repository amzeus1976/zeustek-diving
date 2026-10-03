import {
  opaqueId,
  strictObject,
  validatePublicationInput,
  validatePublicationSnapshot,
  type PublicationInput,
  type PublicationSnapshot,
} from './public-profile';
export type ShareProfileInput = PublicationInput & {
  certificationIds: string[];
  trainingIds: string[];
};
export type ShareInput = {
  version: 1;
  kind: 'profile' | 'gas-plan';
  label: string;
  expiresAt: string | null;
  attachmentIds: string[];
  profile?: ShareProfileInput;
  gasPlan?: {
    recordId: string;
    inputs: boolean;
    supplies: boolean;
    outputs: boolean;
  };
};
export const SHARE_GAS_FIELDS = {
  plannedDepthM: ['Planned maximum depth', 'metres'],
  plannedWorkingTimeMin: ['Planned working time', 'minutes'],
  waterType: ['Water type', 'salt / fresh'],
  ownRmvLMin: ['Own RMV', 'L/min'],
  buddyRmvLMin: ['Buddy RMV', 'L/min'],
  maxPpo2: ['Selected PPO₂ limit', 'bar'],
  reserveStrategy: ['Reserve strategy', 'saved strategy'],
  ascentRateMMin: ['Ascent rate', 'm/min'],
  gfLow: ['Gradient factor low', '%'],
  gfHigh: ['Gradient factor high', '%'],
  startPressureBar: ['Reference start pressure', 'bar'],
  cylinderWaterVolumeL: ['Reference cylinder water volume', 'litres'],
  surfacePressureBar: ['Surface pressure', 'bar'],
  conservatismM: ['Conservatism depth', 'metres'],
  selectedOxygenFraction: ['Selected gas O₂ fraction', 'fraction'],
  ndlMinutes: ['Saved selected-gas NDL', 'minutes'],
  modM: ['Saved selected-gas MOD ceiling', 'metres'],
  ppo2AtPlannedDepth: ['Saved PPO₂ at planned depth', 'bar'],
  gasLimitedTimeMin: ['Saved gas-limited time', 'minutes'],
  totalGasLitres: ['Saved reference supply gas', 'litres'],
  reserveLitres: ['Saved selected reserve', 'litres'],
  reservePressureBar: ['Saved selected reserve pressure', 'bar'],
  availableWorkingTimeMin: ['Saved available working time', 'minutes'],
} as const;
export type ShareGasKey = keyof typeof SHARE_GAS_FIELDS;
export type ShareDatum = {
  key: ShareGasKey;
  label: string;
  unit: string;
  value: number | string | null;
};
export type SharedSupply = {
  label: string;
  role: string;
  accessibility: string;
  oxygenFraction: number | null;
  heliumFraction: number | null;
  waterVolumeL: number | null;
  currentPressureBar: number | null;
  plannedStartPressureBar: number | null;
  availableFrom: string;
  availableLitres: number | null;
  requiredLitres: number | null;
  reserveLitres: number | null;
  contingencyRequiredLitres: number | null;
  status: 'PASS' | 'CAUTION' | 'BLOCKED' | 'Not recorded';
};
export type ShareAttachment = {
  id: string;
  label: string;
  contentType: 'image/png' | 'image/jpeg' | 'application/pdf';
  bytes: number;
};
export const SHARE_SCENARIO_BASIS =
  'Remaining route consumption, including its explicit segment stress/buddy inputs, plus separately assigned unchanged frozen-engine reserve.';
export type ShareStatus = 'PASS' | 'CAUTION' | 'BLOCKED' | 'Not recorded';
export type SharedScenario = {
  label: string;
  kind: 'contingency/bailout';
  status: ShareStatus;
  factor: number | null;
  basis: typeof SHARE_SCENARIO_BASIS | 'Not recorded';
  at: string;
  failedSupplies: string[];
  cylinders: Array<{
    label: string;
    availableLitres: number | null;
    requiredLitres: number | null;
    reserveLitres: number | null;
    status: ShareStatus;
  }>;
};
export const SHARE_SAFE_WARNINGS = new Set([
  'MOD is shallower than planned depth.',
  'PPO₂ exceeds the selected limit at planned depth.',
  'PPO₂ exceeds the selected limit at conservative depth.',
  'Gas-limited time unavailable until cylinder and RMV are complete.',
  'Selected nitrox has no current gas analysis evidence.',
  'Complete every multilevel segment to calculate carried-tissue NDL.',
  'Buddy RMV unknown — using owner RMV fallback for emergency reserve.',
  'Select a gas candidate.',
  'Selected gas has no available Bühlmann NDL.',
  'Selected gas exceeds MOD or PPO₂ limits.',
  'Available cylinder gas or reserve is incomplete.',
  'Reserve meets or exceeds total available gas.',
  'Planned working time is missing.',
  'Planned working time exceeds the selected gas NDL.',
  'Planned working time exceeds gas-limited time after reserve.',
  'Planned working time exceeds the owner maximum duration.',
  'Route checkpoint reserve is unavailable.',
  'Route checkpoint reserve has an insufficient-gas warning.',
  'Residual nitrogen is unknown for this repetitive plan.',
]);
export type SharedSnapshot = {
  version: 1;
  kind: 'profile' | 'gas-plan';
  label: string;
  asOf: string;
  source: 'Owner-selected canonical evidence';
  expiresAt: string | null;
  attachments: ShareAttachment[];
  profile?: Omit<
    PublicationSnapshot,
    'version' | 'photoUrl' | 'asOf' | 'source'
  > & {
    photoId?: string;
    certifications: Array<{ title: string; agency: string; date?: string }>;
    training: Array<{ title: string; agency: string; status: string }>;
  };
  gasPlan?: {
    modelVersion: string | null;
    allocationVersion: 'zeustek-allocation/1' | null;
    physiologicalStatus: ShareStatus;
    recordedAt: string | null;
    inputs: ShareDatum[];
    outputs: ShareDatum[];
    supplies: SharedSupply[];
    scenarios: SharedScenario[];
    reservePhases: Array<{
      label: string;
      depthM: number | null;
      minutes: number | null;
      multiplier: number | null;
      litres: number | null;
    }>;
    warnings: string[];
    omittedWarnings: number;
    notice: string;
  };
};
export const SHARE_NOTICE =
  'Owner-selected saved planning snapshot; not independent safety verification. Missing saved outputs are unavailable. MOD is a ceiling, not a switch instruction. Gas switching receives no NDL, decompression or physiological credit. No decompression schedule is provided.';
export const shareText = (value: unknown, max: number) => {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    Array.from(value).some((char) => {
      const code = char.charCodeAt(0);
      return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
    })
  )
    throw new Error('Use supported bounded plain text.');
  return value;
};
export const shareRecordId = (value: unknown) => {
  const id = shareText(value, 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id))
    throw new Error('Select an exact saved record.');
  return id;
};
function ids(value: unknown, max: number, opaque = false) {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    new Set(value).size !== value.length
  )
    throw new Error('Select each item once.');
  return value.map((id) => {
    if (opaque) {
      if (!opaqueId(id)) throw new Error('Choose a prepared derivative.');
      return id;
    }
    return shareRecordId(id);
  });
}
function date(value: unknown, nullable = false) {
  if (nullable && value === null) return null;
  const result = shareText(value, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(result) ||
    !Number.isFinite(Date.parse(result))
  )
    throw new Error('Use a valid publication time.');
  return result;
}
export function validateShareInput(value: unknown): ShareInput {
  const input = strictObject(value, [
    'version',
    'kind',
    'label',
    'expiresAt',
    'attachmentIds',
    'profile',
    'gasPlan',
  ]);
  if (
    input.version !== 1 ||
    !['profile', 'gas-plan'].includes(String(input.kind))
  )
    throw new Error('Choose a supported snapshot.');
  const label = shareText(input.label, 120).trim();
  if (!label) throw new Error('Enter a visitor-facing title.');
  const result: ShareInput = {
    version: 1,
    kind: input.kind as ShareInput['kind'],
    label,
    expiresAt: date(input.expiresAt, true),
    attachmentIds: ids(input.attachmentIds, 5, true),
  };
  if (input.kind === 'profile') {
    if (input.gasPlan !== undefined) throw new Error('Choose one source type.');
    const profile = strictObject(input.profile, [
      'displayName',
      'biography',
      'insights',
      'photoId',
      'certificationIds',
      'trainingIds',
    ]);
    const { certificationIds, trainingIds, ...base } = profile;
    result.profile = {
      ...validatePublicationInput(base),
      certificationIds: ids(certificationIds, 100),
      trainingIds: ids(trainingIds, 100),
    };
  } else {
    if (input.profile !== undefined) throw new Error('Choose one source type.');
    const gas = strictObject(input.gasPlan, [
      'recordId',
      'inputs',
      'supplies',
      'outputs',
    ]);
    if (
      [gas.inputs, gas.supplies, gas.outputs].some(
        (value) => typeof value !== 'boolean',
      ) ||
      ![gas.inputs, gas.supplies, gas.outputs].some(Boolean)
    )
      throw new Error('Select the saved plan sections to share.');
    result.gasPlan = {
      recordId: shareRecordId(gas.recordId),
      inputs: gas.inputs as boolean,
      supplies: gas.supplies as boolean,
      outputs: gas.outputs as boolean,
    };
  }
  return result;
}
export function shareNumber(value: unknown, max = 10000000): number | null {
  if (value == null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    throw new Error('Saved evidence is unsupported.');
  return value;
}
function datums(value: unknown) {
  if (!Array.isArray(value) || value.length > 30)
    throw new Error('Invalid saved outputs.');
  const seen = new Set();
  for (const datum of value) {
    const row = strictObject(datum, ['key', 'label', 'unit', 'value']),
      definition = SHARE_GAS_FIELDS[row.key as ShareGasKey];
    if (
      !definition ||
      seen.has(row.key) ||
      row.label !== definition[0] ||
      row.unit !== definition[1]
    )
      throw new Error('Invalid saved output.');
    seen.add(row.key);
    if (typeof row.value === 'string') {
      const allowed =
        row.key === 'waterType'
          ? ['salt', 'fresh']
          : row.key === 'reserveStrategy'
            ? ['thirds', 'calculated', 'most-conservative']
            : [];
      if (!allowed.includes(row.value))
        throw new Error('Unsupported saved output.');
    } else shareNumber(row.value);
  }
}
/** Stored publications are validated independently of source records on every visitor request. */
export function validateSharedSnapshot(value: unknown): SharedSnapshot {
  const snapshot = strictObject(value, [
    'version',
    'kind',
    'label',
    'asOf',
    'source',
    'expiresAt',
    'attachments',
    'profile',
    'gasPlan',
  ]);
  if (
    snapshot.version !== 1 ||
    snapshot.source !== 'Owner-selected canonical evidence' ||
    !['profile', 'gas-plan'].includes(String(snapshot.kind))
  )
    throw new Error('Invalid shared snapshot.');
  shareText(snapshot.label, 120);
  date(snapshot.asOf);
  date(snapshot.expiresAt, true);
  if (!Array.isArray(snapshot.attachments) || snapshot.attachments.length > 5)
    throw new Error('Invalid attachments.');
  const assetIds = new Set();
  for (const item of snapshot.attachments) {
    const asset = strictObject(item, ['id', 'label', 'contentType', 'bytes']);
    if (
      !opaqueId(asset.id) ||
      assetIds.has(asset.id) ||
      !['image/png', 'image/jpeg', 'application/pdf'].includes(
        String(asset.contentType),
      )
    )
      throw new Error('Invalid attachment.');
    assetIds.add(asset.id);
    shareText(asset.label, 100);
    if (shareNumber(asset.bytes, 4 * 1024 * 1024) === null)
      throw new Error('Invalid attachment size.');
  }
  if (snapshot.kind === 'profile') {
    if (snapshot.gasPlan !== undefined)
      throw new Error('Invalid snapshot source.');
    const profile = strictObject(snapshot.profile, [
      'displayName',
      'biography',
      'insights',
      'photoId',
      'certifications',
      'training',
    ]);
    const { photoId, certifications, training, ...base } = profile;
    validatePublicationSnapshot({
      ...base,
      version: 1,
      source: snapshot.source,
      asOf: snapshot.asOf,
    });
    if (photoId !== undefined && !opaqueId(photoId))
      throw new Error('Invalid photograph.');
    if (
      !Array.isArray(certifications) ||
      !Array.isArray(training) ||
      certifications.length > 100 ||
      training.length > 100
    )
      throw new Error('Invalid selected evidence.');
    for (const item of certifications) {
      const record = strictObject(item, ['title', 'agency', 'date']);
      shareText(record.title, 180);
      shareText(record.agency, 100);
      if (
        record.date !== undefined &&
        !/^\d{4}-\d{2}-\d{2}$/.test(shareText(record.date, 10))
      )
        throw new Error('Invalid award date.');
    }
    for (const item of training) {
      const record = strictObject(item, ['title', 'agency', 'status']);
      shareText(record.title, 180);
      shareText(record.agency, 100);
      if (
        !['planned', 'in-progress', 'completed', 'ignored'].includes(
          String(record.status),
        )
      )
        throw new Error('Invalid saved training state.');
    }
  } else {
    if (snapshot.profile !== undefined)
      throw new Error('Invalid snapshot source.');
    const plan = strictObject(snapshot.gasPlan, [
      'modelVersion',
      'allocationVersion',
      'physiologicalStatus',
      'recordedAt',
      'inputs',
      'outputs',
      'supplies',
      'scenarios',
      'reservePhases',
      'warnings',
      'omittedWarnings',
      'notice',
    ]);
    if (
      (plan.allocationVersion !== null &&
        plan.allocationVersion !== 'zeustek-allocation/1') ||
      !['PASS', 'CAUTION', 'BLOCKED', 'Not recorded'].includes(
        String(plan.physiologicalStatus),
      )
    )
      throw new Error('Unsupported allocation provenance.');
    if (
      plan.modelVersion !== null &&
      !/^zeustek-rec-gas-\d+\/\d+(?:\.\d+)*$/.test(
        shareText(plan.modelVersion, 60),
      )
    )
      throw new Error('Unsupported model provenance.');
    date(plan.recordedAt, true);
    datums(plan.inputs);
    datums(plan.outputs);
    if (
      plan.notice !== SHARE_NOTICE ||
      !Array.isArray(plan.supplies) ||
      plan.supplies.length > 16 ||
      !Array.isArray(plan.reservePhases) ||
      plan.reservePhases.length > 20 ||
      !Array.isArray(plan.warnings) ||
      plan.warnings.length > 50
    )
      throw new Error('Invalid planning snapshot.');
    for (const [index, item] of plan.supplies.entries()) {
      const supply = strictObject(item, [
        'label',
        'role',
        'accessibility',
        'oxygenFraction',
        'heliumFraction',
        'waterVolumeL',
        'currentPressureBar',
        'plannedStartPressureBar',
        'availableFrom',
        'availableLitres',
        'requiredLitres',
        'reserveLitres',
        'contingencyRequiredLitres',
        'status',
      ]);
      if (
        supply.label !== `Supply ${index + 1}` ||
        ![
          'main',
          'sidemount-left',
          'sidemount-right',
          'pony',
          'stage',
          'primary',
          'bottom',
          'bailout',
          'Not recorded',
        ].includes(String(supply.role)) ||
        ![
          'independent',
          'manifold open',
          'manifold closed',
          'manifold unknown',
        ].includes(String(supply.accessibility)) ||
        !['PASS', 'CAUTION', 'BLOCKED', 'Not recorded'].includes(
          String(supply.status),
        )
      )
        throw new Error('Invalid supply.');
      if (
        !/^(Start|Checkpoint [1-9]\d{0,2}|Unresolved saved checkpoint)$/.test(
          String(supply.availableFrom),
        )
      )
        throw new Error('Invalid availability.');
      for (const key of ['oxygenFraction', 'heliumFraction'])
        shareNumber(supply[key], 1);
      for (const key of [
        'waterVolumeL',
        'currentPressureBar',
        'plannedStartPressureBar',
        'availableLitres',
        'requiredLitres',
        'reserveLitres',
        'contingencyRequiredLitres',
      ])
        shareNumber(supply[key]);
    }
    for (const [index, item] of plan.reservePhases.entries()) {
      const phase = strictObject(item, [
        'label',
        'depthM',
        'minutes',
        'multiplier',
        'litres',
      ]);
      if (phase.label !== `Emergency phase ${index + 1}`)
        throw new Error('Invalid phase.');
      for (const key of ['depthM', 'minutes', 'multiplier', 'litres'])
        shareNumber(phase[key]);
    }
    if (!Array.isArray(plan.scenarios) || plan.scenarios.length > 16)
      throw new Error('Invalid selected scenarios.');
    for (const [index, item] of plan.scenarios.entries()) {
      const scenario = strictObject(item, [
        'label',
        'kind',
        'status',
        'factor',
        'basis',
        'at',
        'failedSupplies',
        'cylinders',
      ]);
      if (
        scenario.label !== `Contingency ${index + 1}` ||
        scenario.kind !== 'contingency/bailout' ||
        !['PASS', 'CAUTION', 'BLOCKED', 'Not recorded'].includes(
          String(scenario.status),
        ) ||
        ![SHARE_SCENARIO_BASIS, 'Not recorded'].includes(
          String(scenario.basis),
        ) ||
        !/^(Start|Checkpoint [1-9]\d{0,2}|Unresolved saved checkpoint)$/.test(
          String(scenario.at),
        ) ||
        !Array.isArray(scenario.failedSupplies) ||
        scenario.failedSupplies.length > 16 ||
        !Array.isArray(scenario.cylinders) ||
        scenario.cylinders.length > 16
      )
        throw new Error('Invalid selected scenario.');
      shareNumber(scenario.factor, 100);
      for (const supply of scenario.failedSupplies)
        if (!/^Supply ([1-9]|1[0-6])$/.test(String(supply)))
          throw new Error('Invalid failed supply.');
      const members = new Set();
      for (const item of scenario.cylinders) {
        const member = strictObject(item, [
          'label',
          'availableLitres',
          'requiredLitres',
          'reserveLitres',
          'status',
        ]);
        if (
          !/^Supply ([1-9]|1[0-6])$/.test(String(member.label)) ||
          members.has(member.label) ||
          !['PASS', 'CAUTION', 'BLOCKED', 'Not recorded'].includes(
            String(member.status),
          )
        )
          throw new Error('Invalid scenario member.');
        members.add(member.label);
        for (const key of [
          'availableLitres',
          'requiredLitres',
          'reserveLitres',
        ])
          shareNumber(member[key]);
      }
    }
    for (const warning of plan.warnings)
      if (!SHARE_SAFE_WARNINGS.has(shareText(warning, 300)))
        throw new Error('Unsupported saved warning.');
    shareNumber(plan.omittedWarnings, 10000);
  }
  return snapshot as unknown as SharedSnapshot;
}
