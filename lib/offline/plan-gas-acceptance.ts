import type { DiveSiteRecord, Stored } from './dive-planning';
import { teamDepthAssessment, type EnrichedDivePlan } from './dive-planning-centre';
import type { CylinderEquipmentRecord, CylinderFillRecord, GasAnalysisRecord } from './loadouts-gas';
import { fractionLabel, projectGasCylinder, warnGasPlan, type GasPlanRecord } from './planning-pages';

/** A datalist value must be unique: a name alone can select the wrong canonical Site. */
export function siteChoiceLabel(site: Stored<DiveSiteRecord>): string {
  const context = [site.location, site.region, site.country, site.waterType, site.siteType, site.maxDepthM == null ? null : `${site.maxDepthM} m`]
    .map((value) => String(value ?? '').trim()).filter(Boolean).join(' · ');
  return `${site.name}${context ? ` · ${context}` : ''} · ID ${site.entityId.slice(-8)}`;
}

export function matchSiteChoice(sites: Array<Stored<DiveSiteRecord>>, value: string): Stored<DiveSiteRecord> | null {
  const query = value.trim().toLocaleLowerCase('en-GB');
  if (!query) return null;
  const labelled = sites.find((site) => siteChoiceLabel(site).toLocaleLowerCase('en-GB') === query);
  if (labelled) return labelled;
  const named = sites.filter((site) => site.name.trim().toLocaleLowerCase('en-GB') === query);
  return named.length === 1 ? named[0] ?? null : null;
}

/** Reject invalid coordinates; never create an empty Google Maps query. */
export function siteMapQuery(site?: DiveSiteRecord | null): string | null {
  if (!site) return null;
  const lat = site.latitude;
  const lon = site.longitude;
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
    return `${lat},${lon}`;
  const address = [site.address, site.postcode, site.location].map((value) => value?.trim()).filter(Boolean).join(' ');
  return address || null;
}

export const MULTI_CYLINDER_NEEDED_UNAVAILABLE = 'Total gas needed unavailable until depth/time segments are assigned';

/** Shared live assessment for Gas Planning and its Plan-side read-only summary. */
export function assessLinkedGasPlan(
  gas: GasPlanRecord,
  context: {
    divePlan?: EnrichedDivePlan | null | undefined;
    site?: DiveSiteRecord | null | undefined;
    people?: Array<{ entityId: string; name: string }>;
    fills: Array<Stored<CylinderFillRecord>>;
    analyses: Array<Stored<GasAnalysisRecord>>;
    equipment: Array<Stored<CylinderEquipmentRecord>>;
  },
) {
  const { divePlan, site, people = [], fills, analyses, equipment } = context;
  const projections = gas.cylinders.map((cylinder) => projectGasCylinder(cylinder, gas, fills, analyses, equipment));
  const depth = gas.plannedDepthM ?? divePlan?.plannedMaxDepthM ?? null;
  const team = teamDepthAssessment(divePlan?.planTeam, people);
  const warnings = [...warnGasPlan(gas, fills, equipment), ...projections.flatMap((projection) => projection.warnings)];
  if (!divePlan) warnings.push('No linked Dive Plan; Site and team limits cannot be checked.');
  if (!site) warnings.push('No linked Site; Site maximum depth cannot be checked.');
  if (depth != null && site?.maxDepthM != null && depth > site.maxDepthM)
    warnings.push(`Planned ${depth} m exceeds Site maximum ${site.maxDepthM} m.`);
  if (depth != null && gas.userMaxDepthM != null && depth > gas.userMaxDepthM)
    warnings.push(`Planned ${depth} m exceeds owner-entered user maximum ${gas.userMaxDepthM} m (unverified).`);
  if (depth != null && team.limitM != null && depth > team.limitM)
    warnings.push(`Planned ${depth} m exceeds limiting diver ${team.limitingDivers.map((row) => row.name).join(', ')}: recorded ${team.limitM} m (owner-entered, unverified).`);
  if (divePlan && team.unknownDivers.length)
    warnings.push(`Unknown depth capability: ${team.unknownDivers.join(', ')}. Do not treat this as a pass.`);
  if (gas.cylinders.some((_, index) => projections[index]?.analysisState !== 'current'))
    warnings.push('One or more cylinders have no current gas analysis; manual mixes are unverified.');
  const multi = gas.cylinders.length > 1;
  const allSegmentsAssigned = Boolean(gas.depthSegments?.length) && gas.depthSegments!.every((segment) => segment.gasCylinderId && gas.cylinders.some((cylinder) => cylinder.id === segment.gasCylinderId));
  const multiCylinderReason = multi
    ? allSegmentsAssigned
      ? 'Overall gas-needed total is not aggregated across independent cylinders; review the per-cylinder assigned-segment estimates and contingency plan.'
      : `${MULTI_CYLINDER_NEEDED_UNAVAILABLE}; a total cannot be inferred from unassigned or independently used cylinders.`
    : null;
  if (multiCylinderReason) warnings.push(multiCylinderReason);
  const primaryIndex = Math.max(0, gas.cylinders.findIndex((cylinder) => cylinder.role === 'primary' || cylinder.role === 'bottom'));
  const primary = projections[primaryIndex];
  const volumes = projections.map((projection) => projection.volume);
  const allVolumesKnown = Boolean(volumes.length) && volumes.every((volume) => volume != null);
  return {
    warnings: [...new Set(warnings)],
    projections,
    team,
    primaryMix: primary?.mix ? fractionLabel(primary.mix.oxygenFraction, primary.mix.heliumFraction) : 'Unknown',
    gasNeededLitres: multi ? null : projections[0]?.requiredLitres ?? null,
    usableLitres: allVolumesKnown ? volumes.reduce((sum, volume) => sum + volume!.usableLitres, 0) : null,
    reserveLitres: allVolumesKnown ? volumes.reduce((sum, volume) => sum + volume!.reserveLitres, 0) : null,
    modStatus: projections.length && projections.every((projection) => projection.modM != null && depth != null) ? projections.some((projection) => depth! > projection.modM!) ? 'Exceeds calculated MOD' : 'Within calculated MOD at recorded target' : 'Unknown',
    ppo2Status: projections.length && projections.every((projection) => projection.ppo2AtDepth != null) ? projections.some((projection, index) => projection.ppo2AtDepth! > (gas.cylinders[index]?.targetPpo2 ?? 1.4)) ? 'Over configured target' : 'Within configured target' : 'Unknown',
    multiCylinder: multi,
    multiCylinderReason,
  };
}
