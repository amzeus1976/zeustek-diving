export const DIVE_SETTING_GROUPS = [
  { title: 'Water body', options: ['Open sea', 'Sheltered bay', 'Lagoon', 'Channel / Strait', 'Headland', 'Reef flat', 'Pool (indoor)', 'Pool (outdoor)', 'Quarry', 'Lake', 'River', 'Canal', 'Reservoir', 'Cave (submerged)', 'Inland (freshwater)'] },
  { title: 'Entry method', options: ['Shore', 'Boat', 'Jetty / Pier', 'Liveaboard'] },
  { section: 'Structure', title: 'Primary bottom/feature', options: ['Wall', 'Reef', 'Coral reef (fringing)', 'Coral reef (wall)', 'Coral reef (pinnacle/erg)', 'Coral reef (coral garden)', 'Coral reef (plateau)', 'Wreck (ship)', 'Wreck (aircraft)', 'Wreck (tug/ferry)', 'Wreck (cargo/salvage)', 'Cave / Cavern', 'Canyon / Fissure', 'Overhang', 'Arch / Swim-through', 'Boulder field', 'Blue water (no bottom)', 'Sand / Seagrass', 'Kelp forest', 'Rock (bare)', 'Lighthouse (surface feature)', 'Anchor', 'Cargo (scattered)', 'Artificial reef (drums, containers)', 'Training platform / structure'] },
  { section: 'Activity', title: 'Diving discipline', options: ['Recreational', 'Technical (trimix / CCR / deep)', 'Freediving', 'Snorkelling'] },
  { section: 'Activity', title: 'Purpose', options: ['Sightseeing / Exploration', 'Photography', 'Videography', 'Macro', 'Pelagic / Big fish', 'Training (OW / AOW / checkout)', 'Course training', 'Navigation / blue water practice', 'Hard boat recovery (training)', 'Lining-out / guideline (training)', 'Conservation / Survey', 'Search / Recovery'] },
  { section: 'Activity', title: 'Conditions and profile', options: ['Night dive', 'Ice dive', 'Drift', 'Deep', 'Blue water', 'Muck'] },
  { section: 'Activity', title: 'Overhead and wreck activity', options: ['Wreck', 'Wreck penetration', 'Cave / Cavern', 'Cavern diving', 'Cave penetration'] },
  { section: 'Activity', title: 'Route and recovery', options: ['Mooring', 'Out-and-back', 'One-way drift', 'Shot line', 'Live boat pickup'] },
  { section: 'Activity', title: 'Wildlife and seasonal events', options: ['Bioluminescence', 'Spawning / seasonal aggregation', 'Manta / Whale shark (seasonal)', 'Spawning / seasonal events'] },
] as const;

// Qualify the repeated label so feature and activity remain independent.
// Keep readable values in the existing record format and preserve older tags.
export function diveSettingValue(group: string, option: string): string {
  return option === 'Cave / Cavern' ? `${group === 'Primary bottom/feature' ? group : 'Mode'}: ${option}` : option;
}
export const DIVE_SETTING_VALUES = DIVE_SETTING_GROUPS.flatMap(group => group.options.map(option => diveSettingValue(group.title, option)));
export function otherSavedDiveSettings(values: string[]): string[] {
  return [...new Set(values)].filter(value => !DIVE_SETTING_VALUES.includes(value));
}
