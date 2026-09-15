export const ZEUSTEK_ICON_IDS = [
  'saltwater', 'freshwater', 'brackish', 'unknown-water', 'other', 'shore', 'boat', 'pier', 'liveaboard', 'training',
  'recreational-diving', 'technical-diving', 'daytime', 'nighttime', 'weather', 'equipment', 'dive-cylinder', 'sac-rmv',
  'dive-computer', 'dive-site', 'dive-plan', 'dive-photos', 'dive-skills', 'pool-confined-water', 'quarry-inland-site',
  'wreck', 'reef-scenic-dive', 'wall-drop-off', 'drift-current', 'tide-slack-water', 'surge-swell', 'visibility',
  'water-temperature', 'gas-mix', 'start-end-pressure', 'buddy-team', 'instructor-guide', 'operator-dive-centre', 'dive-flag',
  'compass-navigation', 'timed-dive', 'deep-dive', 'bailout-stage-cylinder', 'exposure-suit', 'ccr-rebreather', 'marine-life',
  'photos', 'video', 'favourite-dive', 'needs-review', 'imported-log', 'manual-log', 'verified-log', 'incident-near-miss',
  'kit-issue', 'bailout-stage-cylinder-alt', 'sidemount', 'twinset', 'ccr-rebreather-alt', 'cavern', 'cave-overhead',
  'night-specialty', 'deep-dive-alt', 'rescue-scenario', 'discover-scuba-diving', 'scuba-diver', 'open-water-diver',
  'advanced-open-water', 'rescue-diver', 'divemaster', 'emergency-first-response', 'enriched-air-nitrox', 'drysuit-diver',
  'deep-diver', 'night-diver', 'wreck-diver', 'peak-performance-buoyancy', 'underwater-navigator', 'boat-diver',
  'drift-diver', 'search-and-recovery', 'equipment-specialist', 'fish-identification', 'underwater-naturalist',
  'underwater-photographer', 'coral-reef-conservation', 'self-reliant-diver', 'sidemount-diver', 'adaptive-support-diver',
  'emergency-oxygen-provider', 'full-face-mask-diver', 'aware-shark-conservation', 'divemaster-pro',
  'discover-scuba-diving-leader', 'assistant-instructor', 'open-water-scuba-instructor', 'emergency-first-response-instructor',
  'specialty-instructor', 'master-scuba-diver-trainer', 'idc-staff-instructor', 'master-instructor', 'course-director',
  'adaptive-techniques-specialty-instructor', 'mermaid-instructor', 'discover-tec', 'tec-basics', 'tec-40', 'tec-45',
  'tec-50', 'tec-sidemount', 'tec-gas-blender', 'tec-trimix-65', 'tec-trimix-diver', 'tec-40-ccr', 'tec-60-ccr',
  'tec-100-ccr', 'altitude-diver', 'ice-diver', 'multilevel-diver', 'diver-propulsion-vehicle',
  'project-aware-specialist', 'dive-against-debris', 'public-safety-diver', 'cavern-diver', 'rebreather-diver',
  'advanced-rebreather-diver', 'freediver', 'advanced-freediver', 'rescue-mermaid', 'mermaid', 'basic-mermaid',
] as const;

export type ZeusTekIconId = (typeof ZEUSTEK_ICON_IDS)[number];

export type ZeusTekIconAsset = {
  id: ZeusTekIconId;
  label: string;
  src: string;
};

const labelOverrides: Partial<Record<ZeusTekIconId, string>> = {
  'sac-rmv': 'SAC / RMV',
  'ccr-rebreather': 'CCR rebreather',
  'ccr-rebreather-alt': 'CCR rebreather',
  'emergency-first-response': 'Emergency First Response',
  'emergency-first-response-instructor': 'Emergency First Response Instructor',
  'idc-staff-instructor': 'IDC Staff Instructor',
  'tec-40-ccr': 'Tec 40 CCR',
  'tec-60-ccr': 'Tec 60 CCR',
  'tec-100-ccr': 'Tec 100 CCR',
};

function defaultLabel(id: ZeusTekIconId) {
  return id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export const ZEUSTEK_TRANSPARENT_ICONS = Object.fromEntries(
  ZEUSTEK_ICON_IDS.map((id) => [id, {
    id,
    label: labelOverrides[id] ?? defaultLabel(id),
    src: `/zeustek-icons/transparent/${id}.png`,
  }]),
) as Record<ZeusTekIconId, ZeusTekIconAsset>;

export function getZeusTekIcon(id: string | null | undefined) {
  if (!id || !ZEUSTEK_ICON_IDS.includes(id as ZeusTekIconId)) return undefined;
  return ZEUSTEK_TRANSPARENT_ICONS[id as ZeusTekIconId];
}

function normalise(value: string | null | undefined) {
  return (value ?? '').toLocaleLowerCase('en-GB').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

const semanticMatchers: ReadonlyArray<readonly [RegExp, ZeusTekIconId]> = [
  [/\btec 100\b.*\bccr\b|\bccr\b.*\btec 100\b/, 'tec-100-ccr'],
  [/\btec 60\b.*\bccr\b|\bccr\b.*\btec 60\b/, 'tec-60-ccr'],
  [/\btec 40\b.*\bccr\b|\bccr\b.*\btec 40\b/, 'tec-40-ccr'],
  [/\btrimix\b.*\b65\b/, 'tec-trimix-65'],
  [/\btrimix\b/, 'tec-trimix-diver'],
  [/\btec\b.*\b50\b/, 'tec-50'],
  [/\btec\b.*\b45\b/, 'tec-45'],
  [/\btec\b.*\b40\b/, 'tec-40'],
  [/\btec basics?\b/, 'tec-basics'],
  [/\bdiscover tec\b/, 'discover-tec'],
  [/\btec\b.*\bgas blender\b|\bgas blender\b/, 'tec-gas-blender'],
  [/\btec\b.*\bsidemount\b/, 'tec-sidemount'],
  [/\bdive against debris\b/, 'dive-against-debris'],
  [/\baware\b.*\bshark\b/, 'aware-shark-conservation'],
  [/\bcoral reef conservation\b/, 'coral-reef-conservation'],
  [/\bproject aware\b|\bpadi aware\b|\bsea turtle awareness\b/, 'project-aware-specialist'],
  [/\bdiver propulsion vehicle\b|\bdpv\b/, 'diver-propulsion-vehicle'],
  [/\bpublic safety\b/, 'public-safety-diver'],
  [/\baltitude\b/, 'altitude-diver'],
  [/\bice\b/, 'ice-diver'],
  [/\bmultilevel\b/, 'multilevel-diver'],
  [/\badvanced rebreather\b/, 'advanced-rebreather-diver'],
  [/\badvanced freediver\b/, 'advanced-freediver'],
  [/\bfreediver\b/, 'freediver'],
  [/\brescue mermaid\b/, 'rescue-mermaid'],
  [/\bbasic mermaid\b/, 'basic-mermaid'],
  [/\bmermaid instructor\b/, 'mermaid-instructor'],
  [/\bmermaid\b/, 'mermaid'],
  [/\badaptive techniques\b.*\binstructor\b/, 'adaptive-techniques-specialty-instructor'],
  [/\bcourse director\b/, 'course-director'],
  [/\bmaster instructor\b/, 'master-instructor'],
  [/\bidc staff instructor\b/, 'idc-staff-instructor'],
  [/\bmaster scuba diver trainer\b|\bmsdt\b/, 'master-scuba-diver-trainer'],
  [/\bspecialty instructor\b/, 'specialty-instructor'],
  [/\bassistant instructor\b/, 'assistant-instructor'],
  [/\badvanced open water\b/, 'advanced-open-water'],
  [/\bdiscover scuba diving leader\b/, 'discover-scuba-diving-leader'],
  [/\bdiscover scuba diving\b/, 'discover-scuba-diving'],
  [/\bopen water scuba instructor\b|\bow(?:si)?\b.*\binstructor\b/, 'open-water-scuba-instructor'],
  [/\bopen water\b/, 'open-water-diver'],
  [/\bscuba diver\b/, 'scuba-diver'],
  [/\bdivemaster\b.*\bpro/, 'divemaster-pro'],
  [/\bdivemaster\b/, 'divemaster'],
  [/\bemergency first response\b.*\binstructor\b|\befr\b.*\binstructor\b/, 'emergency-first-response-instructor'],
  [/\bemergency first response\b|\befr\b/, 'emergency-first-response'],
  [/\bemergency oxygen\b/, 'emergency-oxygen-provider'],
  [/\bnitrox\b|\benriched air\b/, 'enriched-air-nitrox'],
  [/\bsearch and recovery\b/, 'search-and-recovery'],
  [/\bpeak performance buoyancy\b|\bperfect buoyancy\b/, 'peak-performance-buoyancy'],
  [/\bunderwater navigation\b|\bunderwater navigator\b/, 'underwater-navigator'],
  [/\bunderwater photograph/, 'underwater-photographer'],
  [/\bunderwater video/, 'video'],
  [/\bunderwater naturalist\b/, 'underwater-naturalist'],
  [/\bfish identification\b/, 'fish-identification'],
  [/\bequipment specialist\b/, 'equipment-specialist'],
  [/\bfull face mask\b/, 'full-face-mask-diver'],
  [/\bself reliant\b/, 'self-reliant-diver'],
  [/\badaptive\b/, 'adaptive-support-diver'],
  [/\brebreather\b|\bccr\b/, 'rebreather-diver'],
  [/\btwin ?set\b/, 'twinset'],
  [/\bsidemount\b/, 'sidemount-diver'],
  [/\bdrysuit\b|\bdry suit\b/, 'drysuit-diver'],
  [/\bwreck\b/, 'wreck-diver'],
  [/\brescue\b/, 'rescue-diver'],
  [/\bnight\b/, 'night-diver'],
  [/\bdeep\b/, 'deep-diver'],
  [/\bboat\b/, 'boat-diver'],
  [/\bdrift\b/, 'drift-diver'],
  [/\bcavern\b/, 'cavern-diver'],
  [/\bpool\b|\bconfined water\b/, 'pool-confined-water'],
  [/\bquarry\b|\binland\b/, 'quarry-inland-site'],
  [/\breef\b/, 'reef-scenic-dive'],
  [/\bwall\b|\bdrop off\b/, 'wall-drop-off'],
  [/\bshore\b/, 'shore'],
  [/\bpier\b/, 'pier'],
  [/\bliveaboard\b/, 'liveaboard'],
  [/\bfresh ?water\b/, 'freshwater'],
  [/\bsalt ?water\b|\bsea\b/, 'saltwater'],
  [/\bbrackish\b/, 'brackish'],
  [/\bdive computer\b|\buddf\b|\bcomputer profile\b/, 'dive-computer'],
  [/\bdive plan\b|\bplanning centre\b/, 'dive-plan'],
  [/\bdive site\b|\bsites\b/, 'dive-site'],
  [/\bdive skill\b|\bcurrency\b/, 'dive-skills'],
  [/\bphoto\b|\balbum\b/, 'dive-photos'],
  [/\bcylinder\b|\btank\b/, 'dive-cylinder'],
  [/\bgas\b|\bfill\b|\banalysis\b/, 'gas-mix'],
  [/\bloadout\b|\bequipment\b|\bgear\b/, 'equipment'],
  [/\btechnical\b/, 'technical-diving'],
  [/\btraining\b|\bcertification\b|\bcourse\b/, 'training'],
];

export function resolveZeusTekIconId(value: string | null | undefined, fallback?: ZeusTekIconId) {
  const text = normalise(value);
  if (!text) return fallback;
  const direct = text.replace(/\s+/g, '-') as ZeusTekIconId;
  if (ZEUSTEK_ICON_IDS.includes(direct)) return direct;
  return semanticMatchers.find(([pattern]) => pattern.test(text))?.[1] ?? fallback;
}

export function resolveDiveIconId(dive: {
  source?: string | null;
  diveMode?: string | null;
  diveTypes?: string[] | null;
  waterType?: string | null;
}) {
  const source = normalise(dive.source);
  if (/import|computer|uddf/.test(source)) return 'imported-log' as const;
  const context = [dive.diveMode, ...(dive.diveTypes ?? []), dive.waterType].filter(Boolean).join(' ');
  return resolveZeusTekIconId(context, 'manual-log');
}

const pageIconIds: Record<string, ZeusTekIconId> = {
  'ready for the next descent': 'dive-flag',
  logbook: 'manual-log',
  equipment: 'equipment',
  'equipment sets': 'equipment',
  'dive site map': 'dive-site',
  sites: 'dive-site',
  'dive plans': 'dive-plan',
  'dive planning centre': 'dive-plan',
  certifications: 'training',
  'interactive course maps': 'training',
  'planned training': 'training',
  'gear wishlist': 'equipment',
  'bucket list': 'dive-flag',
  'dive bibliography': 'dive-photos',
  'data and backups': 'verified-log',
  'data backups': 'verified-log',
  'dive computer imports': 'dive-computer',
  'reusable loadouts and gas': 'equipment',
  'dive skills': 'dive-skills',
  'skills and currency': 'dive-skills',
  'technical diving': 'technical-diving',
  'professional development': 'divemaster-pro',
  'dive knowledge': 'needs-review',
  'conservation and aware': 'project-aware-specialist',
};

export function resolvePageIconId(title: string | null | undefined) {
  return pageIconIds[normalise(title)] ?? resolveZeusTekIconId(title);
}
