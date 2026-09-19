export const INSIGHT_AWARD_COUNTS = [4, 8, 12, 16, 20] as const;
export type InsightAwardCount = (typeof INSIGHT_AWARD_COUNTS)[number];

export const INSIGHT_AWARD_DEFINITIONS = [
  ['divesLogged', 'Total dives logged', 'my-dives'],
  ['recreationalDives', 'Recreational dives', 'my-dives'],
  ['technicalDives', 'Technical dives', 'my-dives'],
  ['maxDepth', 'Maximum depth', 'depth'],
  ['averageDepth', 'Average depth', 'depth'],
  ['totalTime', 'Total dive time', 'time'],
  ['longestDive', 'Longest dive', 'time'],
  ['averageTime', 'Average dive time', 'time'],
  ['bestSac', 'Best SAC rate', 'breathing'],
  ['averageSac', 'Average SAC rate', 'breathing'],
  ['bestRmv', 'Best RMV', 'breathing'],
  ['averageRmv', 'Average RMV', 'breathing'],
  ['highestRecCert', 'Highest recreational certification', 'certification'],
  ['highestTecCert', 'Highest technical certification', 'certification'],
  ['highestProCert', 'Highest professional certification', 'certification'],
  ['saltwaterDives', 'Saltwater dives', 'water'],
  ['freshwaterDives', 'Freshwater dives', 'water'],
  ['otherWaterDives', 'Other water dives', 'water'],
  ['deep20', 'Dives 20m+', 'locations'],
  ['deep25', 'Dives 25m+', 'locations'],
  ['deep30', 'Dives 30m+', 'locations'],
  ['deep35', 'Dives 35m+', 'locations'],
  ['deep40', 'Dives 40m+', 'locations'],
  ['poolDives', 'Pool dives', 'locations'],
  ['shoreDives', 'Shore dives', 'locations'],
  ['boatDives', 'Boat dives', 'locations'],
  ['nightDives', 'Night dives', 'locations'],
  ['wreckDives', 'Wreck dives', 'locations'],
  ['wreckPenetrationDives', 'Wreck penetration dives', 'locations'],
  ['cavernDives', 'Cavern dives', 'locations'],
  ['caveDives', 'Cave dives', 'locations'],
  ['unknownOtherDives', 'Unknown / other dives', 'locations'],
] as const;

export function normaliseInsightAwardCount(value: number | null | undefined): InsightAwardCount {
  return INSIGHT_AWARD_COUNTS.includes(value as InsightAwardCount) ? value as InsightAwardCount : 8;
}
