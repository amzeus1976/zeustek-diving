import type { RouteSegment } from '../offline/recreational-gas-reserve';
export function newRouteLeg(
  segments: RouteSegment[],
  id = crypto.randomUUID(),
): RouteSegment {
  const start = segments.at(-1)?.endDepthM ?? 0;
  return {
    id,
    label: '',
    checkpointKind: 'custom',
    startDepthM: start,
    endDepthM: start,
    averageDepthM: start,
    depthM: null,
    minutes: null,
    durationMin: null,
    cylinderId: null,
    stressFactor: 1,
    buddySharing: false,
    directAscentPossible: true,
    notes: '',
  };
}
export function updateRouteLeg(
  segments: RouteSegment[],
  id: string,
  patch: Partial<RouteSegment>,
): RouteSegment[] {
  const position = segments.findIndex((row) => row.id === id);
  return segments.map((row, index) => {
    if (index !== position && !(index === position + 1 && 'endDepthM' in patch))
      return row;
    const next =
      index === position
        ? { ...row, ...patch }
        : { ...row, startDepthM: patch.endDepthM ?? null };
    if (
      ('startDepthM' in patch || 'endDepthM' in patch) &&
      next.startDepthM != null &&
      next.endDepthM != null
    )
      return {
        ...next,
        averageDepthM: (next.startDepthM + next.endDepthM) / 2,
        depthM: null,
      };
    return next;
  });
}
