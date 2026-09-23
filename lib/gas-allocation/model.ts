import {
  ambientBar,
  type RouteSegment,
  type WaterType,
} from '../offline/recreational-gas-reserve';
import { ownedFullEligibility } from './supply';

export const ALLOCATION_VERSION = 'zeustek-allocation/1' as const;
export type AllocationStatus = 'PASS' | 'CAUTION' | 'BLOCKED';
export type SupplyMode = 'own-empty' | 'own-full' | 'hire' | 'temporary';
export type SupplyRole =
  | 'main'
  | 'sidemount-left'
  | 'sidemount-right'
  | 'pony'
  | 'stage';
export interface AllocationCylinder {
  id: string;
  snapshotId: string;
  capturedAt: string;
  canonicalId: string | null;
  label: string;
  mode: SupplyMode;
  role: SupplyRole;
  gas: { oxygen: number | null; helium: number | null };
  waterVolumeL: number | null;
  currentPressureBar: number | null;
  plannedStartPressureBar: number | null;
  ratedPressureBar: number | null;
  availableFrom: string;
  analysisConfirmed: boolean;
  conditionConfirmed: boolean;
  pressureToleranceBar?: number;
  fillId?: string | null;
  analysisId?: string | null;
  valve?: string | null;
  notes?: string;
  analysedAt?: string | null;
  analysisSource?:
    | 'analysed-by-me'
    | 'analysed-by-operator'
    | 'label-only'
    | 'unknown';
  blockedReasons?: string[];
  cylinderType?: 'aluminium' | 'steel' | 'unknown' | 'other';
  fillSource?: 'dive-centre' | 'day-boat' | 'liveaboard' | 'resort' | 'unknown';
  ownedCopyId?: string;
  reserveFloorBar?: number | null;
  endPressureBar?: number | null;
  turnPressureBar?: number | null;
}
export interface AllocationManifold {
  id: string;
  label: string;
  cylinderIds: string[];
  connected: boolean;
  operatingState: 'open' | 'closed' | 'unknown';
}
export interface ReserveAssignment {
  id: string;
  supplyId: string;
  litres: number;
  from: string;
  through: string;
}
export interface AllocationScenario {
  id: string;
  label: string;
  selected: boolean;
  at: string;
  failedSupplyIds: string[];
  assignments: Array<{ segmentId: string; supplyId: string }>;
  reserves: ReserveAssignment[];
  advanced?: {
    version: 1;
    enabled: boolean;
    factor: number;
    basis: 'route-consumption-excluding-reserve';
    ownerSelectedAt: string;
  };
}
export interface AllocationPlan {
  version: typeof ALLOCATION_VERSION;
  mode: 'requirements-only' | 'supplied';
  cylinders: AllocationCylinder[];
  manifolds: AllocationManifold[];
  reserves: ReserveAssignment[];
  scenarios: AllocationScenario[];
  switches?: Array<{ checkpointId: string; supplyId: string }>;
  sidemountBalanceToleranceBar?: number | null;
}
export interface AllocationContext {
  segments: RouteSegment[];
  ownRmvLMin: number | null;
  buddyRmvLMin: number | null;
  waterType: WaterType;
  surfacePressureBar: number;
  /** Authoritative selected requirement from the frozen reserve engine, never a second multiplier. */
  reserveMinimumL: number | null;
  maxPpo2: number;
  reserveFloors?: Array<{ supplyId: string; litres: number }>;
  plannedMaxDepthM?: number;
}
export interface CylinderCheckpoint {
  id: string;
  label: string;
  remainingLitres: number;
  requiredLitres: number;
  reserveLitres: number;
  remainingPressureBar: number | null;
  status: AllocationStatus;
}
export interface CylinderAllocationResult {
  id: string;
  label: string;
  snapshotId: string;
  canonicalId: string | null;
  role: SupplyRole;
  availableFrom: string;
  gas: AllocationCylinder['gas'];
  currentPressureBar: number | null;
  plannedStartPressureBar: number | null;
  availableLitres: number;
  requiredLitres: number;
  reserveLitres: number;
  contingencyRequiredLitres: number;
  status: AllocationStatus;
  reasons: string[];
  remedies: string[];
  checkpoints: CylinderCheckpoint[];
}
export interface ScenarioResult {
  id: string;
  label: string;
  kind: 'contingency/bailout';
  selected: boolean;
  status: AllocationStatus;
  reasons: string[];
  cylinders: CylinderAllocationResult[];
  factor: number;
  basis: string;
}
const valid = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const positive = (value: unknown): value is number => valid(value) && value > 0;
const worst = (...states: AllocationStatus[]): AllocationStatus =>
  states.includes('BLOCKED')
    ? 'BLOCKED'
    : states.includes('CAUTION')
      ? 'CAUTION'
      : 'PASS';
const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);
const sameGas = (a: AllocationCylinder, b: AllocationCylinder) =>
  a.gas.oxygen === b.gas.oxygen && a.gas.helium === b.gas.helium;
function remedy(reason: string) {
  if (/short by/i.test(reason))
    return 'Reduce this cylinder’s assigned route requirement or obtain sufficient verified gas for this cylinder. Any reassignment must explicitly identify an accessible supply.';
  if (/inspection|service|retired|condition/i.test(reason))
    return 'Verify the actual cylinder condition and current inspection/service evidence before use; select another serviceable supply when necessary.';
  if (/analysis|composition/i.test(reason))
    return 'Record a dated analysis for the actual gas. For owned cylinders, link the current fill and its valid analysis, then explicitly refresh this snapshot.';
  if (/PPO₂|MOD/i.test(reason))
    return 'Review the assigned gas and checkpoint depth against the displayed oxygen ceiling. An automatic switch at MOD is not assumed.';
  if (/pressure|rating/i.test(reason))
    return 'Verify actual pressure, the requested target and the cylinder rating. Complete the fill or revise the explicit request; another independent cylinder cannot cover this shortfall.';
  if (/availability|inaccessible|unavailable|switch/i.test(reason))
    return 'Review the availability and switch checkpoints. Assign the affected interval and reserve to a supply that is actually accessible in this scenario.';
  if (/fill required/i.test(reason))
    return 'Obtain the requested fill and its analysis, then choose Own full and capture the current canonical evidence explicitly.';
  return 'Review this cylinder’s identity, captured evidence and explicit route/reserve assignments. Refresh changed canonical evidence only after confirming the new configuration.';
}

/** Additive accessibility accounting. Frozen physiological/reserve models are not modified. */
export function assessGasAllocation(
  plan: AllocationPlan,
  context: AllocationContext,
) {
  const reasons: string[] = [];
  const points = ['start', ...context.segments.map((row) => row.id)];
  const index = (id: string) => points.indexOf(id);
  const cylinders = plan.cylinders;
  const byId = new Map(cylinders.map((row) => [row.id, row]));
  const segmentName = (id: string) =>
    context.segments.find((row) => row.id === id)?.label ||
    'Route interval ' +
      (context.segments.findIndex((row) => row.id === id) + 1);
  const checkpointName = (id: string | undefined) =>
    id === 'start' ? 'Start' : id ? segmentName(id) : 'unavailable checkpoint';
  const supplyName = (id: string) =>
    plan.manifolds.find((row) => row.id === id)?.label ||
    byId.get(id)?.label ||
    'unlabelled supply';
  if (plan.version !== ALLOCATION_VERSION)
    reasons.push('Unsupported allocation version.');
  if (plan.mode === 'requirements-only' || !cylinders.length)
    reasons.push(
      'Requirements only: allocate actual supplies before assessing readiness.',
    );
  if (!context.segments.length)
    reasons.push('Define the planned working interval or complete route.');
  if (new Set(points).size !== points.length)
    reasons.push('Checkpoint identities must be unique.');
  if (
    new Set(plan.scenarios.map((row) => row.id)).size !== plan.scenarios.length
  )
    reasons.push('Contingency scenario identities must be unique.');
  for (const role of ['sidemount-left', 'sidemount-right'])
    if (cylinders.filter((row) => row.role === role).length > 1)
      reasons.push(
        `Assign only one cylinder to ${role}; additional cylinders require their own role.`,
      );
  if (
    new Set(cylinders.map((row) => row.id)).size !== cylinders.length ||
    new Set(cylinders.map((row) => row.snapshotId)).size !== cylinders.length
  )
    reasons.push('Cylinder and immutable snapshot identities must be unique.');
  const canonical = cylinders.flatMap((row) =>
    row.canonicalId ? [row.canonicalId] : [],
  );
  if (new Set(canonical).size !== canonical.length)
    reasons.push(
      'A canonical cylinder cannot provide two independent supplies.',
    );
  if (
    !positive(context.ownRmvLMin) ||
    !positive(context.surfacePressureBar) ||
    !positive(context.maxPpo2) ||
    !valid(context.reserveMinimumL)
  )
    reasons.push(
      'RMV, surface pressure, PPO₂ ceiling and frozen-engine reserve must be available.',
    );
  const warnings = new Map<string, string[]>();
  const blockers = new Map<string, string[]>();
  const add = (id: string, message: string, blocked = true) => {
    const map = blocked ? blockers : warnings;
    map.set(id, [...(map.get(id) ?? []), message]);
  };
  const gasAvailable = new Map<string, number>();
  for (const row of cylinders) {
    if (!row.id || !row.snapshotId || !row.capturedAt)
      add(row.id, 'Canonical/snapshot identity and capture time are required.');
    if (
      (row.mode === 'own-full' || row.mode === 'own-empty') &&
      !row.canonicalId
    )
      add(row.id, 'Select the canonical owned cylinder.');
    if (
      !positive(row.waterVolumeL) ||
      !positive(row.plannedStartPressureBar) ||
      !positive(row.ratedPressureBar)
    )
      add(
        row.id,
        'Volume, requested pressure and rated pressure are required.',
      );
    if (
      positive(row.plannedStartPressureBar) &&
      positive(row.ratedPressureBar) &&
      row.plannedStartPressureBar > row.ratedPressureBar
    )
      add(row.id, 'Requested pressure exceeds the cylinder rating.');
    if (row.reserveFloorBar != null && !valid(row.reserveFloorBar))
      add(
        row.id,
        'Custom reserve pressure must be a non-negative finite value.',
      );
    if (
      !positive(row.gas.oxygen) ||
      row.gas.oxygen < 0.16 ||
      row.gas.oxygen >= 1 ||
      !valid(row.gas.helium) ||
      row.gas.oxygen + row.gas.helium > 1
    )
      add(row.id, 'Record a valid gas composition.');
    if (index(row.availableFrom) < 0)
      add(row.id, 'Choose a valid availability checkpoint.');
    if (!row.conditionConfirmed)
      add(
        row.id,
        'Cylinder condition/inspection or intended configuration is unconfirmed.',
        false,
      );
    if (!row.analysisConfirmed)
      add(row.id, 'Gas analysis is required before use.', false);
    if (row.mode === 'hire' || row.mode === 'temporary') {
      if (!valid(row.currentPressureBar))
        add(
          row.id,
          'Verify actual current pressure before a planned hire/manual supply can pass.',
          false,
        );
      else if (
        !ownedFullEligibility({
          currentPressureBar: row.currentPressureBar,
          requestedPressureBar: row.plannedStartPressureBar,
          toleranceBar: row.pressureToleranceBar ?? 5,
        })
      )
        add(
          row.id,
          'Verified pressure is below the requested start-pressure tolerance.',
        );
      if (
        row.analysisConfirmed &&
        (!['analysed-by-me', 'analysed-by-operator'].includes(
          row.analysisSource ?? '',
        ) ||
          !row.analysedAt ||
          !Number.isFinite(Date.parse(row.analysedAt)))
      )
        add(
          row.id,
          'Provide actual analysis source and observation time; a label alone is not analysed evidence.',
          false,
        );
    }
    if (
      row.mode === 'own-full' &&
      (!row.fillId || !row.analysisId || !row.analysisConfirmed)
    )
      add(
        row.id,
        'Own-full requires a current canonical fill and valid linked analysis.',
      );
    for (const reason of row.blockedReasons ?? []) add(row.id, reason);
    if (row.mode === 'own-empty')
      add(
        row.id,
        'Fill required: planned gas is a request, not current inventory.',
        false,
      );
    if (
      row.mode === 'own-full' &&
      !ownedFullEligibility({
        currentPressureBar: row.currentPressureBar,
        requestedPressureBar: row.plannedStartPressureBar,
        toleranceBar: row.pressureToleranceBar ?? 5,
      })
    )
      add(
        row.id,
        'Current pressure does not meet the requested start-pressure tolerance.',
      );
    const pressure =
      row.mode !== 'own-empty' && valid(row.currentPressureBar)
        ? Math.min(row.currentPressureBar, row.plannedStartPressureBar ?? 0)
        : row.plannedStartPressureBar;
    gasAvailable.set(
      row.id,
      positive(row.waterVolumeL) && positive(pressure)
        ? row.waterVolumeL * pressure
        : 0,
    );
  }
  const groups = new Map<string, AllocationCylinder[]>();
  const grouped = new Set<string>();
  for (const group of plan.manifolds) {
    const members = group.cylinderIds.flatMap((id) =>
      byId.has(id) ? [byId.get(id)!] : [],
    );
    const bad =
      !group.id ||
      byId.has(group.id) ||
      groups.has(group.id) ||
      !group.connected ||
      group.operatingState !== 'open' ||
      members.length !== 2 ||
      new Set(group.cylinderIds).size !== 2 ||
      members.some((row) => grouped.has(row.id) || row.role !== 'main') ||
      !sameGas(members[0]!, members[1]!) ||
      members[0]?.plannedStartPressureBar !==
        members[1]?.plannedStartPressureBar ||
      (members.every((row) => row.mode !== 'own-empty') &&
        members[0]?.currentPressureBar !== members[1]?.currentPressureBar) ||
      members[0]?.availableFrom !== members[1]?.availableFrom;
    if (bad) {
      reasons.push(
        `Manifold ${group.label || group.id}: establish two distinct, compatible, connected main cylinders at the same planned pressure and availability, with compatible actual pressure evidence before use.`,
      );
      for (const row of members)
        add(row.id, 'Manifold configuration is invalid.');
    }
    groups.set(group.id, members);
    for (const row of members) grouped.add(row.id);
  }
  const membersFor = (supplyId: string) =>
    groups.get(supplyId) ?? (byId.has(supplyId) ? [byId.get(supplyId)!] : []);
  const split = (supplyId: string, litres: number) => {
    const members = membersFor(supplyId),
      volume = sum(members.map((row) => row.waterVolumeL ?? 0));
    return members.map((row) => ({
      id: row.id,
      litres: volume > 0 ? (litres * (row.waterVolumeL ?? 0)) / volume : 0,
    }));
  };
  const usage = context.segments.map((leg, i) => {
    const depth =
        leg.averageDepthM ??
        leg.depthM ??
        (valid(leg.startDepthM) && valid(leg.endDepthM)
          ? (leg.startDepthM + leg.endDepthM) / 2
          : null),
      minutes = leg.durationMin ?? leg.minutes,
      stress = leg.stressFactor ?? 1;
    if (
      !valid(depth) ||
      !positive(minutes) ||
      !positive(stress) ||
      stress < 1 ||
      !valid(leg.startDepthM) ||
      !valid(leg.endDepthM)
    ) {
      reasons.push(
        `${segmentName(leg.id)}: record valid depths, duration and one explicit stress factor ≥1.`,
      );
      return 0;
    }
    if (i > 0 && context.segments[i - 1]?.endDepthM !== leg.startDepthM)
      reasons.push(
        `${segmentName(leg.id)}: start depth must continue from the previous checkpoint.`,
      );
    if (
      depth < Math.min(leg.startDepthM, leg.endDepthM) ||
      depth > Math.max(leg.startDepthM, leg.endDepthM)
    )
      reasons.push(
        `${segmentName(leg.id)}: average depth must lie between its start and end depths; split a level or excursion into explicit intervals.`,
      );
    if (
      context.plannedMaxDepthM != null &&
      Math.max(depth, leg.startDepthM, leg.endDepthM) > context.plannedMaxDepthM
    )
      reasons.push(
        `${segmentName(leg.id)}: route exceeds the planned maximum used by the frozen reserve engine.`,
      );
    const buddy = leg.buddySharing
      ? (context.buddyRmvLMin ?? context.ownRmvLMin)
      : 0;
    if (buddy == null || !valid(buddy)) {
      reasons.push(`${segmentName(leg.id)}: buddy RMV is unavailable.`);
      return 0;
    }
    return (
      ((context.ownRmvLMin ?? 0) + buddy) *
      stress *
      ambientBar(depth, context.waterType, context.surfacePressureBar) *
      minutes
    );
  });
  function distributeRoute(
    assignments: Array<{ segmentId: string; supplyId: string }>,
    from: number,
    failed: string[],
    factor: number,
    errors: string[],
    scenario = false,
    issues = blockers,
  ) {
    const allocated = context.segments.map(() => new Map<string, number>());
    let previous: AllocationCylinder | undefined;
    if (
      new Set(assignments.map((row) => row.segmentId)).size !==
      assignments.length
    )
      errors.push(
        'Each remaining interval must have exactly one explicit supply assignment.',
      );
    if (
      assignments.some(
        (row) =>
          !context.segments.some((segment) => segment.id === row.segmentId),
      )
    )
      errors.push('An assignment refers to an unavailable route interval.');
    for (let i = from; i < context.segments.length; i++) {
      const leg = context.segments[i]!,
        assignment = assignments.find((row) => row.segmentId === leg.id),
        supplyId = assignment?.supplyId ?? '',
        members = membersFor(supplyId);
      if (!members.length) {
        errors.push(
          `${segmentName(leg.id)}: select an accessible cylinder or configured manifold.`,
        );
        continue;
      }
      if (grouped.has(supplyId)) {
        errors.push(
          `${segmentName(leg.id)}: use the configured manifold identity, not a member as a second independent supply.`,
        );
      }
      for (const member of members) {
        if (
          index(member.availableFrom) > i ||
          index(member.availableFrom) < 0 ||
          failed.includes(member.id) ||
          failed.includes(supplyId)
        ) {
          errors.push(
            `${segmentName(leg.id)}: ${member.label} is unavailable in this scenario.`,
          );
          issues.set(member.id, [
            ...(issues.get(member.id) ?? []),
            'Supply is credited before availability or through an assumed failed switch.',
          ]);
        }
        const maxDepth = Math.max(
          leg.startDepthM ?? 0,
          leg.endDepthM ?? 0,
          leg.averageDepthM ?? leg.depthM ?? 0,
        );
        if (
          positive(member.gas.oxygen) &&
          member.gas.oxygen *
            ambientBar(
              maxDepth,
              context.waterType,
              context.surfacePressureBar,
            ) >
            context.maxPpo2 + 1e-9
        ) {
          errors.push(
            `${segmentName(leg.id)}: ${member.label} exceeds its PPO₂/MOD ceiling.`,
          );
          issues.set(member.id, [
            ...(issues.get(member.id) ?? []),
            'Assigned depth exceeds the selected gas ceiling.',
          ]);
        }
      }
      const current = members[0]!;
      if (
        !scenario &&
        ((previous && !sameGas(previous, current)) ||
          (current.role === 'stage' && previous?.id !== current.id)) &&
        !plan.switches?.some(
          (row) => row.checkpointId === points[i] && row.supplyId === supplyId,
        )
      )
        errors.push(
          `${segmentName(leg.id)}: an explicit switch at ${checkpointName(points[i])} is required; MOD is only a ceiling.`,
        );
      previous = current;
      for (const row of split(supplyId, usage[i]! * factor))
        allocated[i]!.set(row.id, row.litres);
    }
    return allocated;
  }
  function reserveAt(
    assignments: ReserveAssignment[],
    point: number,
    failed: string[],
    errors: string[],
    issues: Map<string, string[]>,
  ) {
    const values = new Map<string, number>();
    const used = new Set<string>();
    if (new Set(assignments.map((row) => row.id)).size !== assignments.length)
      errors.push('Reserve assignment identities must be unique.');
    for (const assignment of assignments) {
      const first = index(assignment.from),
        last = index(assignment.through);
      const key = `${assignment.supplyId}|${assignment.from}|${assignment.through}`;
      if (
        used.has(key) ||
        !valid(assignment.litres) ||
        first < 0 ||
        last < first
      ) {
        errors.push(
          'Reserve assignments have duplicates, invalid quantities or contradictory intervals.',
        );
        continue;
      }
      used.add(key);
      if (point < first || point > last) continue;
      if (
        values.has(assignment.supplyId) ||
        assignments.some(
          (other) =>
            other !== assignment &&
            other.supplyId === assignment.supplyId &&
            index(other.from) <= point &&
            index(other.through) >= point,
        )
      ) {
        errors.push(
          `Overlapping reserve assignments for ${supplyName(assignment.supplyId)} at ${checkpointName(points[point])}; combine the intended obligation into one explicit assignment.`,
        );
        continue;
      }
      const members = membersFor(assignment.supplyId);
      if (!members.length || grouped.has(assignment.supplyId)) {
        errors.push(
          'Reserve names an unavailable or independently counted manifold member.',
        );
        continue;
      }
      if (
        members.some(
          (row) =>
            index(row.availableFrom) > point ||
            index(row.availableFrom) < 0 ||
            failed.includes(row.id) ||
            failed.includes(assignment.supplyId),
        )
      ) {
        errors.push(
          `Reserve supply ${supplyName(assignment.supplyId)} is inaccessible at ${checkpointName(points[point])}.`,
        );
        continue;
      }
      const checkpointDepth =
        point === 0
          ? context.segments[0]?.startDepthM
          : context.segments[point - 1]?.endDepthM;
      if (valid(checkpointDepth))
        for (const member of members)
          if (
            positive(member.gas.oxygen) &&
            member.gas.oxygen *
              ambientBar(
                checkpointDepth,
                context.waterType,
                context.surfacePressureBar,
              ) >
              context.maxPpo2 + 1e-9
          ) {
            const message = `Reserve gas exceeds its PPO₂/MOD ceiling at ${checkpointName(points[point])}.`;
            errors.push(message);
            issues.set(member.id, [
              ...new Set([...(issues.get(member.id) ?? []), message]),
            ]);
          }
      for (const row of split(assignment.supplyId, assignment.litres))
        values.set(row.id, (values.get(row.id) ?? 0) + row.litres);
    }
    if (
      sum([...values.values()]) + 1e-7 <
      (context.reserveMinimumL ?? Infinity)
    )
      errors.push(
        `Assign the complete frozen-engine reserve at ${checkpointName(points[point])}; no automatic pooling or reduction is allowed.`,
      );
    for (const floor of context.reserveFloors ?? []) {
      const members = membersFor(floor.supplyId);
      if (!valid(floor.litres)) {
        errors.push('A frozen per-supply reserve requirement is unavailable.');
        continue;
      }
      if (
        members.length &&
        members.every(
          (row) =>
            index(row.availableFrom) <= point &&
            !failed.includes(row.id) &&
            !failed.includes(floor.supplyId),
        ) &&
        sum(members.map((row) => values.get(row.id) ?? 0)) + 1e-7 < floor.litres
      )
        errors.push(
          `Individual accessible supply ${supplyName(floor.supplyId)} does not meet its applicable reserve floor at ${checkpointName(points[point])}.`,
        );
    }
    return values;
  }
  const normalErrors: string[] = [];
  const normal = distributeRoute(
    context.segments.map((row) => ({
      segmentId: row.id,
      supplyId: row.cylinderId ?? '',
    })),
    0,
    [],
    1,
    normalErrors,
  );
  function evaluate(
    allocated: Map<string, number>[],
    reserves: ReserveAssignment[],
    from: number,
    failed: string[],
    errors: string[],
    issues = blockers,
  ): CylinderAllocationResult[] {
    const reservePoints = points.map((_, i) =>
      i < from
        ? new Map<string, number>()
        : reserveAt(reserves, i, failed, errors, issues),
    );
    return cylinders.map((row) => {
      const available = gasAvailable.get(row.id) ?? 0;
      const spentBefore = sum(
        normal.slice(0, from).map((map) => map.get(row.id) ?? 0),
      );
      const checkpoints = points
        .slice(from)
        .map((id, offset): CylinderCheckpoint => {
          const point = from + offset;
          const spent =
            spentBefore +
            sum(
              allocated.slice(from, point).map((map) => map.get(row.id) ?? 0),
            );
          const reserved = reservePoints[point]?.get(row.id) ?? 0;
          const required =
            sum(allocated.slice(point).map((map) => map.get(row.id) ?? 0)) +
            reserved;
          const remaining = available - spent;
          return {
            id,
            label: checkpointName(id),
            remainingLitres: remaining,
            requiredLitres: required,
            reserveLitres: reserved,
            remainingPressureBar: positive(row.waterVolumeL)
              ? remaining / row.waterVolumeL
              : null,
            status: remaining + 1e-7 < required ? 'BLOCKED' : 'PASS',
          };
        });
      const shortage = checkpoints.filter(
        (point) => point.status === 'BLOCKED',
      );
      const why = [
        ...(issues.get(row.id) ?? []),
        ...(warnings.get(row.id) ?? []),
        ...shortage.map(
          (point) =>
            `${point.label}: short by ${(point.requiredLitres - point.remainingLitres).toFixed(1)} L.`,
        ),
      ];
      return {
        id: row.id,
        label: row.label,
        snapshotId: row.snapshotId,
        canonicalId: row.canonicalId,
        role: row.role,
        availableFrom: row.availableFrom,
        gas: row.gas,
        currentPressureBar: row.currentPressureBar,
        plannedStartPressureBar: row.plannedStartPressureBar,
        availableLitres: available,
        requiredLitres: Math.max(
          0,
          ...checkpoints.map(
            (point) => available - point.remainingLitres + point.requiredLitres,
          ),
        ),
        reserveLitres: Math.max(
          0,
          ...checkpoints.map((point) => point.reserveLitres),
        ),
        contingencyRequiredLitres: 0,
        status:
          issues.get(row.id)?.length || shortage.length
            ? 'BLOCKED'
            : warnings.get(row.id)?.length
              ? 'CAUTION'
              : 'PASS',
        reasons: why,
        remedies: [...new Set(why.map(remedy))],
        checkpoints,
      };
    });
  }
  const normalResults = evaluate(normal, plan.reserves, 0, [], normalErrors);
  const scenarios = plan.scenarios.map((scenario): ScenarioResult => {
    const errors: string[] = [];
    const issues = new Map(blockers);
    const from = index(scenario.at);
    let factor = 1;
    if (from < 0) errors.push('Choose a valid contingency start checkpoint.');
    if (!scenario.label.trim())
      errors.push('Describe the contingency/bailout assumption.');
    if (scenario.failedSupplyIds.some((id) => !membersFor(id).length))
      errors.push('A failed-switch assumption refers to a missing supply.');
    if (scenario.advanced?.enabled) {
      const advanced = scenario.advanced;
      if (
        advanced.version !== 1 ||
        advanced.basis !== 'route-consumption-excluding-reserve' ||
        !positive(advanced.factor) ||
        advanced.factor < 1 ||
        !advanced.ownerSelectedAt
      )
        errors.push(
          'Advanced allowance must be versioned, explicitly selected and ≥1 on route consumption only.',
        );
      else factor = advanced.factor;
    }
    const route = distributeRoute(
      scenario.assignments,
      Math.max(0, from),
      scenario.failedSupplyIds,
      factor,
      errors,
      true,
      issues,
    );
    const results = evaluate(
      route,
      scenario.reserves,
      Math.max(0, from),
      scenario.failedSupplyIds,
      errors,
      issues,
    );
    return {
      id: scenario.id,
      label: scenario.label,
      kind: 'contingency/bailout',
      selected: scenario.selected,
      status: errors.length
        ? 'BLOCKED'
        : worst(...results.map((row) => row.status)),
      reasons: [...new Set(errors)],
      cylinders: results,
      factor,
      basis:
        'Remaining route consumption, including its explicit segment stress/buddy inputs, plus separately assigned unchanged frozen-engine reserve.',
    };
  });
  // Never sum alternatives or let a total override a member failure.
  for (const result of normalResults) {
    for (const scenario of scenarios.filter((row) => row.selected)) {
      const member = scenario.cylinders.find((row) => row.id === result.id);
      if (member) {
        result.contingencyRequiredLitres = Math.max(
          result.contingencyRequiredLitres,
          member.requiredLitres,
        );
        result.status = worst(result.status, member.status);
        if (member.status !== 'PASS') {
          result.reasons.push(
            `${scenario.label} contingency: ${member.reasons.join(' ')}`,
          );
          result.remedies.push(
            `Review ${scenario.label}: this cylinder must cover its assigned remaining route and reserve without borrowing inaccessible gas.`,
          );
        }
      }
    }
  }
  const left = normalResults.find((row) => row.role === 'sidemount-left'),
    right = normalResults.find((row) => row.role === 'sidemount-right');
  const tolerance = plan.sidemountBalanceToleranceBar;
  const balance =
    left && right
      ? left.checkpoints.flatMap((point, i) => {
          const other = right.checkpoints[i];
          if (
            point.remainingPressureBar == null ||
            other?.remainingPressureBar == null
          )
            return [];
          const differenceBar = Math.abs(
            point.remainingPressureBar - other.remainingPressureBar,
          );
          return [
            {
              checkpointId: point.id,
              differenceBar,
              status:
                positive(tolerance) && differenceBar > tolerance
                  ? ('BLOCKED' as const)
                  : ('PASS' as const),
            },
          ];
        })
      : [];
  if (tolerance != null && !positive(tolerance))
    reasons.push('A selected sidemount balance tolerance must be positive.');
  if (balance.some((row) => row.status === 'BLOCKED')) {
    reasons.push(
      'Independent sidemount pressure balance exceeds the owner-selected tolerance.',
    );
    if (left) left.status = 'BLOCKED';
    if (right) right.status = 'BLOCKED';
  }
  reasons.push(
    ...normalErrors,
    ...scenarios
      .filter((row) => row.selected && row.status === 'BLOCKED')
      .map(
        (row) =>
          `${row.label}: selected contingency/bailout scenario is blocked. ${row.reasons.join(' ')}`,
      ),
  );
  return {
    version: ALLOCATION_VERSION,
    status: reasons.length
      ? ('BLOCKED' as const)
      : worst(
          ...normalResults.map((row) => row.status),
          ...scenarios.filter((row) => row.selected).map((row) => row.status),
        ),
    reasons: [...new Set(reasons)],
    cylinders: normalResults,
    scenarios,
    balance,
    informationalTotalLitres: sum([...gasAvailable.values()]),
  };
}
