export type WorkflowSectionKey = 'overview' | 'gear' | 'dive-data' | 'trip-event-planning' | 'dive-preparation' | 'diving-cpd' | 'admin';

export interface WorkflowRoute {
  route: string;
  label: string;
  legacyLabels: string[];
  section: WorkflowSectionKey;
  description: string;
  implemented: boolean;
  futureTask?: string;
}

export const WORKFLOW_SECTIONS: Array<{ key: WorkflowSectionKey; label: string; purpose: string }> = [
  { key: 'overview', label: 'Overview', purpose: 'At-a-glance diver state and holistic insight.' },
  { key: 'gear', label: 'Gear', purpose: 'Individual equipment, loadouts, cylinder gas and purchase research.' },
  { key: 'dive-data', label: 'Dive Data', purpose: 'What happened, where, who was involved and what evidence belongs to it.' },
  { key: 'trip-event-planning', label: 'Trip / Event Planning', purpose: 'Bookings, travel, expeditions and future diving aspirations.' },
  { key: 'dive-preparation', label: 'Dive Preparation', purpose: 'Prepare a specific dive, its team, conditions, equipment, emergency arrangements and gas.' },
  { key: 'diving-cpd', label: 'Diving CPD', purpose: 'Certifications, skills, knowledge, bibliography, news and professional development.' },
  { key: 'admin', label: 'Admin', purpose: 'Configuration, logs, backups, exports and system data tools.' },
];

// route is the existing internal section key. Labels may change without record or URL migration.
export const WORKFLOW_ROUTES: WorkflowRoute[] = [
  { route: 'Overview', label: 'Overview', legacyLabels: ['Home', 'Dashboard'], section: 'overview', implemented: true, description: 'At-a-glance diver dashboard.' },
  { route: 'Insights', label: 'Insights', legacyLabels: ['Experience & Analytics'], section: 'overview', implemented: true, description: 'Holistic analytics over canonical dive records.' },
  { route: 'Equipment', label: 'Equipment', legacyLabels: [], section: 'gear', implemented: true, description: 'Individual gear items and purchase/service/fault history.' },
  { route: 'Loadouts & Gas', label: 'Loadouts', legacyLabels: ['Reusable Loadouts', 'Loadouts & Cylinder Gas'], section: 'gear', implemented: true, description: 'Reusable equipment sets built from canonical Equipment references.' },
  { route: 'Cylinders & Gas', label: 'Cylinders & Gas', legacyLabels: ['Cylinders and Gas', 'Cylinder Gas'], section: 'gear', implemented: true, description: 'Physical cylinders with current fill, analysis, service and evidence history.' },
  { route: 'Gear Wishlist', label: 'Gear Wishlist', legacyLabels: [], section: 'gear', implemented: true, description: 'Gear options and research before purchase.' },
  { route: 'Logbook', label: 'Logbook', legacyLabels: ['Dive Logbook'], section: 'dive-data', implemented: true, description: 'Rich dive records, debrief, story and linked evidence.' },
  { route: 'Dive Computer Imports', label: 'Dive Computer Imports', legacyLabels: ['Dive Computer Data'], section: 'dive-data', implemented: true, description: 'Staged computer source evidence and profile import.' },
  { route: 'Sites', label: 'Sites', legacyLabels: [], section: 'dive-data', implemented: true, description: 'Detailed dive site records.' },
  { route: 'Dive Site Map', label: 'Dive Location Map', legacyLabels: ['Dive Site Map'], section: 'dive-data', implemented: true, description: 'Map of sites and where the diver has dived.' },
  { route: 'People', label: 'People & Operators', legacyLabels: ['People'], section: 'dive-data', implemented: true, description: 'Buddies, guides, instructors, centres and operators.' },
  { route:'Dive Centres',label:'Dive Centres',legacyLabels:['Operators','Dive Shops','Dive Centres & Operators'],section:'dive-data',implemented:true,description:'Canonical centres, operators, services and linked people.' },
  { route: 'Albums', label: 'Albums', legacyLabels: [], section: 'dive-data', implemented: true, description: 'Images and albums linkable to records.' },
  { route: 'Diving Calendar & Bookings', label: 'Diving Calendar & Bookings', legacyLabels: ['Bookings', 'Schedule'], section: 'trip-event-planning', implemented: true, description: 'Booked diving, courses, club events and service dates.' },
  { route: 'Trips', label: 'Trips & Expeditions', legacyLabels: ['Trips'], section: 'trip-event-planning', implemented: true, description: 'Travel and logistics containers linking people, sites, documents and plans.' },
  { route: 'Dive Bucket List', label: 'Bucket List', legacyLabels: ['Bucket list'], section: 'trip-event-planning', implemented: true, description: 'Future aspirations independent from operational Plans.' },
  { route: 'Dive Plans', label: 'Dive Planning Centre', legacyLabels: ['Dive Planning Centre', 'PlanningCentre'], section: 'dive-preparation', implemented: true, description: 'Operational single-dive plan and readiness workspace.' },
  { route: 'Gas Planning', label: 'Gas Planning', legacyLabels: [], section: 'dive-preparation', implemented: true, description: 'Gas plan linked to a current Dive Plan.' },
  { route: 'Training', label: 'Certifications', legacyLabels: ['Training completed', 'Certifications'], section: 'diving-cpd', implemented: true, description: 'Certification cards and completed training.' },
  { route: 'Course Map', label: 'Planned Training', legacyLabels: ['Planned Training'], section: 'diving-cpd', implemented: true, description: 'Training pathway and course planning view.' },
  { route: 'Skills & Currency', label: 'Dive Skills', legacyLabels: ['Skills and Currency', 'Dive Skills'], section: 'diving-cpd', implemented: true, description: 'Skill evidence, competence and currency.' },
  { route: 'Technical Diving', label: 'Technical Diving', legacyLabels: [], section: 'diving-cpd', implemented: true, description: 'Technical training, competence, reference requirements and progression.' },
  { route: 'Conservation & AWARE', label: 'Conservation & AWARE', legacyLabels: ['Conservation'], section: 'diving-cpd', implemented: true, description: 'Conservation activity and evidence.' },
  { route: 'Dive Knowledge', label: 'Dive Knowledge', legacyLabels: ['Diving Knowledge', 'Knowledge Centre', 'Dive knowledge quizzes'], section: 'diving-cpd', implemented: true, description: 'Question banks, diagnostics and AI study workflow.' },
  { route: 'Dive Media', label: 'Dive Bibliography', legacyLabels: ['Dive Bibliography'], section: 'diving-cpd', implemented: true, description: 'Books, articles, podcasts, videos and learning media.' },
  { route: 'Dive News', label: 'Dive News', legacyLabels: [], section: 'diving-cpd', implemented: true, description: 'News sources and archive.' },
  { route: 'Professional Development', label: 'Professional Development', legacyLabels: ['Dive Professional Development'], section: 'diving-cpd', implemented: true, description: 'Professional readiness and evidence.' },
  { route: 'Admin', label: 'Site Logs', legacyLabels: ['Admin', 'Logs'], section: 'admin', implemented: true, description: 'Application, release, sync and action diagnostics.' },
  { route: 'Settings', label: 'Site Configuration', legacyLabels: ['Configuration', 'Site Configuration'], section: 'admin', implemented: true, description: 'Grouped application settings and configuration cards.' },
  { route: 'Data & Backups', label: 'Data & Backups', legacyLabels: ['Backups', 'Sync', 'Imports'], section: 'admin', implemented: true, description: 'Import, export, backup, restore and sync tools.' },
  { route: 'Diver Summary Export', label: 'Diver Summary Export', legacyLabels: ['Diver summary'], section: 'admin', implemented: true, description: 'Choose what a dive centre or training agency may see.' },
];

export function normaliseRouteLabel(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ');
}

export const SECTION_ALIASES = new Map<string, string>(
  WORKFLOW_ROUTES.flatMap((route) => [
    [route.route, route.route] as const,
    [route.label, route.route] as const,
    ...route.legacyLabels.map((label) => [label, route.route] as const),
  ]).map(([label, route]) => [normaliseRouteLabel(label), route]),
);

export function resolveWorkflowRoute(input: string | null | undefined, fallback = 'Overview') {
  if (!input) return fallback;
  return SECTION_ALIASES.get(normaliseRouteLabel(input)) ?? input;
}

export function workflowRoutesForSection(section: WorkflowSectionKey) {
  return WORKFLOW_ROUTES.filter((route) => route.section === section);
}

export interface CardDensityState { minimized?: boolean; expanded?: boolean }

export function visibleRows<T>(rows: readonly T[], state: CardDensityState, limit = 5): readonly T[] {
  if (state.minimized) return [];
  if (state.expanded) return rows;
  return rows.slice(0, Math.max(0, limit));
}

export function hiddenRowCount<T>(rows: readonly T[], state: CardDensityState, limit = 5) {
  return Math.max(0, rows.length - visibleRows(rows, state, limit).length);
}

export const SITE_CONFIGURATION_SECTIONS = [
  'Settings overview',
  'Household setup and configuration',
  'Skill Catalogue',
  'Equipment & training lists',
  'Equipment category icons',
  'Training agency logos',
  'Overview layout / dashboard awards',
  'Dive News settings',
  'Wishlist price search',
  'Acceptance fixture review',
  'Other site data tools',
] as const;

export { looksLikeSyntheticFixture } from './synthetic-fixtures';
