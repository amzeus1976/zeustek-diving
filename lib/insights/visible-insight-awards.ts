export type InsightAwardDefinition = readonly [id: string, label: string, ...metadata: unknown[]];

export function buildVisibleInsightAwards(args: {
  definitions: readonly InsightAwardDefinition[];
  selectedAwardIds: readonly string[] | null | undefined;
  maxAwards: number;
  values: Record<string, string | null | undefined>;
}) {
  const byId = new Map(args.definitions.map((definition) => [definition[0], definition[1]] as const));
  const limit = Number.isFinite(args.maxAwards) ? Math.max(0, Math.floor(args.maxAwards)) : 8;
  return [...new Set(args.selectedAwardIds ?? [])]
    .flatMap((id) => {
      const label = byId.get(id);
      return label ? [{ id, label, value: args.values[id] ?? '—' }] : [];
    })
    .slice(0, limit);
}

export const insightAwardsEmptyState = 'No Insights awards selected. Choose awards in Site Configuration.';
