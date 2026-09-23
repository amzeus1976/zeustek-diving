'use client';
import {
  Anchor,
  Clock,
  Thermometer,
  Hash,
  Archive,
  BarChart3,
  ArrowDown,
  ArrowUp,
  BookOpen,
  BookMarked,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Compass,
  Copy,
  Cylinder,
  Database,
  Download,
  FileImage,
  ExternalLink,
  Gauge,
  GraduationCap,
  House,
  ImagePlus,
  Images,
  ListChecks,
  Leaf,
  MapPin,
  Menu,
  Newspaper,
  Pencil,
  Plus,
  Settings2,
  Share2,
  ShieldCheck,
  ShipWheel,
  Star,
  Sun,
  Snowflake,
  ShoppingBag,
  Trash2,
  Upload,
  Users,
  Waves,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScreenTiming } from '@/components/screen-timing';
import { ZeusTekIcon } from '@/components/zeustek-icon';
import { ZeusTekAssetIcon } from '@/components/brand/zeustek-asset-icon';
import { AppChangelog, AppVersionLink } from '@/components/app-changelog';
import { listOperators, saveOperator, deleteOperator, type OperatorRecord } from '@/lib/offline/dive-planning';
import { groupNewsStories, canonicalUrl, recordIdentity } from '@/lib/record-identity';
import { resolveDiveIconId, resolvePageIconId, resolveZeusTekIconId } from '@/lib/zeustek-icons';
import {fillMissingGasRates} from '@/lib/gas-rates';
import { diveHeat } from '@/lib/dive-heat';
import { logTimeRange } from '@/lib/log-time';
import { EditorSections } from '@/components/editor-sections';
import { SiteCoordinateAudit } from '@/components/site-coordinate-audit';
import { DiveSettingActivity } from '@/components/dive-setting-activity';
import { summedRuntime, DIVE_ACTIVITIES, diveCompleteness, normaliseMyMaps } from '@/lib/dive-record-details';
import { equipmentRecentDates } from '@/lib/offline/equipment-usage';
import { parseMediaRecommendations } from '@/lib/media-import';
import { configureDiveStore,currentDiveAccount,refreshDiveRecords,hasCloudSnapshot,diveOperation } from '@/lib/offline/dive-store';
import { zeustekDb } from '@/lib/offline/db';
import { RecordOperationStatus, useRecordRefresh } from '@/components/record-status';
import { CertificationImages, CardImageView } from '@/components/certification-images';
import { imageSource, storeDiveImage, type CardImage } from '@/lib/offline/dive-images';
import { InteractiveDiveSiteMap } from '@/components/dive-site-map';
import { AccessibleDialog } from '@/components/accessible-dialog';
import { ConservationPage } from '@/components/conservation-page';
import { SiteOverheadSection } from '@/components/site-overhead-profile';
import { ProfilePicture } from '@/components/profile-picture';
import { PeopleOperators } from '@/components/people-operators';
import { findOwnerProfile, hasPersonRole, personDisplayName, sourceLabel } from '@/lib/offline/people-profiles';
import { DiveSyncStatus } from '@/components/dive-sync-status';
import { EquipmentMaintenanceLog } from '@/components/equipment-maintenance-log';
import equipmentEditorStyles from '@/components/equipment-editor.module.css';
import { SkillCatalogue } from '@/components/skill-catalogue';
import { TripsExpeditions } from '@/components/trips-expeditions';
import { CylindersGas, Loadouts } from '@/components/loadouts-gas';
import { isCylinderEquipment } from '@/lib/offline/loadouts-gas';
import { SkillsCurrency } from '@/components/skills-currency';
import { TechnicalWorkspace } from '@/components/technical-workspace';
import { ProfessionalDevelopment } from '@/components/professional-development';
import { DivePlanningCentre } from '@/components/dive-planning-centre';
import { ExperienceAnalytics } from '@/components/experience-analytics';
import { KnowledgeCentre } from '@/components/knowledge-centre';
import { DiveComputerData } from '@/components/dive-computer-data';
import { DivingCalendarBookings } from '@/components/planning/diving-calendar-bookings';
import { GasPlanning } from '@/components/planning/gas-planning';
import { CollapsibleWorkCard } from '@/components/workflow/collapsible-work-card';
import { SyntheticFixtureReview } from '@/components/workflow/synthetic-fixture-review';
import { WorkflowContextStrip } from '@/components/workflow/workflow-context-strip';
import { WORKFLOW_ROUTES, WORKFLOW_SECTIONS, workflowRoutesForSection } from '@/lib/workflow/workflow-model';
import { useWorkflowNavigation } from '@/components/shared/use-workflow-navigation';
import { workflowDestinationUrl } from '@/lib/workflow/workflow-destination';
import { TechnicalPlanFields } from '@/components/technical-plan-fields';
import { uploadMediaBatch } from '@/lib/media-batch';
import {
  BackupsScreen,
  PlatformHeaderStatus,
  PlatformSettings,
  SyncCentre,
} from '@/components/offline-platform';
import {
  deleteDive,
  listDives,
  renumberDivesByChronology,
  saveDive,
  type DecoStop,
  type DiveCylinder,
  type DiveRecord,
} from '@/lib/offline/dives';
import {
  deleteAlbum,
  deleteBucketList,
  deleteCertification,
  deleteDiveSite,
  deleteDiveMedia,
  deleteDiveTrip,
  deleteEquipment,
  deleteEquipmentSet,
  deleteGearWishlist,
  deleteGearWishlistGroup,
  deleteNewsSource,
  deletePerson,
  deleteTrainingProgress,
  listAlbums,
  listBucketList,
  listCatalogOptions,
  listCertifications,
  listDiveSites,
  listDiveMedia,
  listDiveTrips,
  listDashboardSettings,
  listEquipment,
  listEquipmentSets,
  listGearWishlist,
  listGearWishlistGroups,
  listNewsSources,
  listNewsArticles,
  listNewsPreferences,
  listGmailNews,
  listPeople,
  listTrainingProgress,
  saveAlbum,
  saveBucketList,
  saveCertification,
  saveDiveSite,
  saveDiveMedia,
  saveDiveTrip,
  saveDashboardSettings,
  saveEquipment,
  saveEquipmentSet,
  saveGearWishlist,
  saveGearWishlistGroup,
  saveNewsSource,
  saveNewsArticle,
  saveNewsPreferences,
  savePerson,
  saveTrainingProgress,
  type AlbumRecord,
  type BucketListRecord,
  type CertificationRecord,
  type DiveSiteRecord,
  type DiveMediaRecord,
  type DiveTripRecord,
  type DashboardSettingsRecord,
  type CatalogOptionRecord,
  type EquipmentRecord,
  type EquipmentSetRecord,
  type GearWishlistRecord,
  type GearWishlistGroupRecord,
  type NewsSourceRecord,
  type NewsArticleRecord,
  type NewsPreferencesRecord,
  type PersonRecord,
  type TrainingProgressRecord,
  type Stored,
  DEFAULT_GEAR_CATEGORIES,
  agencyLogoSource,
  equipmentIconSource,
  DEFAULT_GEAR_MANUFACTURERS,
  DEFAULT_DIVE_QUALIFICATIONS,
  DEFAULT_TRAINING_AGENCIES,
} from '@/lib/offline/dive-planning';
import { learnedNewsProfile, normaliseNewsKeywords, priorityForArticle, sortNewsByPriority } from '@/lib/news-priority';
import {
  calculateDivePressureGroupProfile,
  PRESSURE_GROUP_DATASET_NAME,
  verifyManualPressureGroup,
  type PressureGroupValidation,
} from '@/lib/pressure-group-engine';
import {
  equipmentDiveCount,
  equipmentServiceStatus,
  overviewServiceItems,
} from '@/lib/offline/equipment-usage';
import { MediaGallery } from '@/components/media-gallery';
import { DiveRecordDetail } from '@/components/dive-record-detail';
import { createDiveDraftFromPlan } from '@/lib/offline/dive-context';
import { parseDiveView, type DiveView } from '@/lib/offline/dive-perspectives';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  TRAINING_COURSES,
  OFFICIAL_TRAINING_OPTIONS,
  courseState,
  requirementMet,
  qualifyingPadiSpecialties,
  type TrainingCourse,
} from '@/lib/training-course-maps';
import { MANUAL_SITE_CATALOG, manualSiteRecord } from '@/lib/manual-site-catalog';
import { INSIGHT_AWARD_COUNTS, INSIGHT_AWARD_DEFINITIONS, normaliseInsightAwardCount } from '@/lib/insights/insight-awards';

const workflowIcons: Record<string, LucideIcon> = {
  Overview: House, Insights: BarChart3, Equipment: Wrench, 'Loadouts & Gas': Wrench, 'Cylinders & Gas': Cylinder,
  'Gear Wishlist': ShoppingBag, Logbook: BookOpen, 'Dive Computer Imports': Download,
  Sites: MapPin, 'Dive Site Map': Compass, People: Users, Albums: Images,
  'Diving Calendar & Bookings': CalendarDays, Trips: ShipWheel, 'Dive Plans': CalendarDays,
  'Technical Diving': Gauge, 'Gas Planning': Cylinder, 'Dive Bucket List': Star,
  Training: ShieldCheck, 'Course Map': GraduationCap, 'Skills & Currency': ListChecks,
  'Conservation & AWARE': Leaf, 'Dive Knowledge': BookOpen, 'Dive Media': BookMarked,
  'Dive News': Newspaper, 'Professional Development': GraduationCap, Admin: ListChecks,
  Settings: Settings2, 'Data & Backups': Database, 'Diver Summary Export': Download,
};
const domainIconNames: Record<string,string> = {Overview:'overview',Insights:'insights',Logbook:'logbook','Dive Computer Imports':'dive-computer-imports',Sites:'sites','Dive Site Map':'dive-location-map',People:'people','Dive Centres':'dive-centres','Diving Calendar & Bookings':'calendar',Trips:'trips','Dive Plans':'dive-planning','Gas Planning':'gas-planning',Equipment:'equipment','Loadouts & Gas':'equipment','Cylinders & Gas':'cylinders','Dive Bucket List':'bucket-list',Training:'certifications','Skills & Currency':'dive-skills','Technical Diving':'technical-diving'};
const quickNavigation = ['Overview', 'Logbook', 'Dive Plans', 'Equipment', 'Data & Backups']
  .map((route) => WORKFLOW_ROUTES.find((item) => item.route === route))
  .filter((item): item is (typeof WORKFLOW_ROUTES)[number] => Boolean(item));
type AdminLogEntry = { timestamp: string; category: string; status: 'updated' | 'skipped' | 'info'; subject: string; detail: string };
const ADMIN_LOG_KEY = 'zeustek-admin-diagnostics';
function appendAdminLogs(entries: AdminLogEntry[]) {
  if (typeof window === 'undefined' || !entries.length) return;
  try {
    const current = JSON.parse(localStorage.getItem(ADMIN_LOG_KEY) || '[]') as AdminLogEntry[];
    localStorage.setItem(ADMIN_LOG_KEY, JSON.stringify([...entries, ...current].slice(0, 2000)));
  } catch { /* diagnostics must never interrupt the main operation */ }
}
function WorkflowNavigation({ active, go }: { active: string; go: (route: string) => void }) {
  const [navigationState, setNavigationState] = useState(() => ({
    active,
    openSections: new Set(['overview', WORKFLOW_ROUTES.find((route) => route.route === active)?.section].filter((value): value is string => Boolean(value))),
  }));
  if (navigationState.active !== active) {
    const activeSection = WORKFLOW_ROUTES.find((route) => route.route === active)?.section;
    setNavigationState({
      active,
      openSections: activeSection ? new Set([...navigationState.openSections, activeSection]) : navigationState.openSections,
    });
  }
  const openSections = navigationState.openSections;
  return <nav aria-label="ZeusTek workflow navigation">
    {WORKFLOW_SECTIONS.map((section) => {
      const routes = workflowRoutesForSection(section.key);
      return <details className="workflow-nav-group" key={section.key} open={openSections.has(section.key)} onToggle={(event) => { const isOpen = event.currentTarget.open; setNavigationState((current) => { const next = new Set(current.openSections); if (isOpen) next.add(section.key); else next.delete(section.key); return { ...current, openSections: next }; }); }}>
        <summary>{section.label}<ChevronDown size={15}/></summary>
        <div>{routes.map((route) => { const Icon = workflowIcons[route.route] ?? ChevronRight; return <button type="button" key={route.route} className={active === route.route ? 'active' : ''} onClick={() => go(route.route)} aria-current={active === route.route ? 'page' : undefined}><ZeusTekAssetIcon name={domainIconNames[route.route] ?? null} decorative size={26} fallback={<Icon size={18}/>}/><span>{route.label}</span>{!route.implemented && <small>{route.futureTask}</small>}</button>; })}</div>
      </details>;
    })}
  </nav>;
}

function Heading({
  eyebrow,
  title,
  copy,
  action,
  icon,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
  icon?: string;
}) {
  const iconId = icon ?? resolvePageIconId(title);
  return (
    <header className="focus-heading">
      <div className="focus-heading-title">
        <ZeusTekIcon id={iconId} size="heading" />
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{copy}</p>
        </div>
      </div>
      {action}
    </header>
  );
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`focus-card ${className}`}>{children}</section>;
}

function RevealOnMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  return <div ref={ref} className="reveal-editor">{children}</div>;
}

function externalUrl(value?: string | null) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

async function mediaPreviewImage(url: string) {
  const safeUrl = externalUrl(url);
  if (!safeUrl) return '';
  try {
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(safeUrl)}`);
    if (!response.ok) return '';
    const preview = await response.json() as { imageUrl?: string };
    return externalUrl(preview.imageUrl);
  } catch {
    return '';
  }
}

function certificationAwardPriority(certification: CertificationRecord) {
  if (certification.awardPriority != null && Number.isFinite(certification.awardPriority)) return certification.awardPriority;
  const title = (certification.certification || certification.level).toLowerCase();
  const explicit: Array<[RegExp, number]> = [
    [/course director|instructor trainer/, 1000], [/master instructor/, 950], [/staff instructor/, 900],
    [/master scuba diver trainer|specialty instructor/, 850], [/open water scuba instructor|\binstructor\b/, 800],
    [/assistant instructor/, 750], [/divemaster|dive master/, 700], [/advanced trimix|tec 60|mixed gas ccr/, 650],
    [/trimix|tec 50|extended range/, 620], [/tec 45|decompression procedures|advanced nitrox/, 590],
    [/tec 40|intro to tech/, 560], [/master scuba diver/, 520], [/rescue diver/, 480],
    [/advanced open water|advanced diver/, 400], [/open water|ocean diver|sports diver/, 300],
    [/specialty|deep diver|night diver|wreck diver|nitrox|enriched air/, 220], [/emergency first response|\befr\b|first aid/, 100],
  ];
  return explicit.find(([pattern]) => pattern.test(title))?.[1] ?? 0;
}

function ListToolbar({
  search,
  setSearch,
  filter,
  setFilter,
  filterLabel,
  filterOptions,
  sort,
  setSort,
  sortOptions,
}: {
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  filterLabel: string;
  filterOptions: Array<[string, string]>;
  sort: string;
  setSort: (value: string) => void;
  sortOptions: Array<[string, string]>;
}) {
  const [filtersOpen,setFiltersOpen]=useState(false);
  return (
    <Card className="list-toolbar compact-list-toolbar">
      <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" /></label>
      <button className="focus-secondary list-filter-toggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}>Filters{filter !== filterOptions[0]?.[0] ? " · 1" : ""}<ChevronDown size={16}/></button><div className="list-extra-filters" hidden={!filtersOpen}><label>{filterLabel}<select value={filter} onChange={(event) => setFilter(event.target.value)}>{filterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}>{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    </Card>
  );
}

function RecordDetail({
  title,
  eyebrow,
  rows,
  ownerKind,
  ownerId,
  close,
  edit,
  remove,
  links = [],
  children,
}: {
  children?: React.ReactNode;
  title: string;
  eyebrow: string;
  rows: Array<[string, string | number | null | undefined]>;
  ownerKind: string;
  ownerId: string;
  close: () => void;
  edit?: () => void;
  remove?: () => void;
  links?: Array<[string, string | null | undefined]>;
}) {
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog label={title} close={close} className="focus-modal record-detail">
        <header>
          <div>
            <span className="focus-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button className="focus-icon" aria-label="Close editor" onClick={close}>
            <X />
          </button>
        </header>
        <div className="detail-grid">
          {rows
            .filter(([, value]) => value !== '' && value != null)
            .map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <span>{String(value)}</span>
              </div>
            ))}
        </div>
        {links.some(([, value]) => externalUrl(value)) && (
          <div className="detail-links">
            {links.map(([label, value]) => externalUrl(value) && (
              <a key={label} className="focus-link" href={externalUrl(value)} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> {label}
              </a>
            ))}
          </div>
        )}
        {children}
        <MediaGallery ownerKind={ownerKind} ownerId={ownerId} accessibleViewer />
        <footer>
          {remove && (
            <button className="focus-secondary danger" onClick={remove}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <span />
          <button className="focus-secondary" onClick={close}>
            Close
          </button>
          {edit && (
            <button className="focus-primary" onClick={edit}>
              <Pencil size={15} /> Edit
            </button>
          )}
        </footer>
      </AccessibleDialog>
    </div>
  );
}

export default function DiveApp({ userId }: { userId: string }) {
  configureDiveStore(userId);
  const [active, setActive] = useState('Overview');
  const [destinationTab,setDestinationTab]=useState('');
  const [destinationKey,setDestinationKey]=useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [draftDive, setDraftDive] = useState<(Partial<DiveRecord> & { entityId?: string }) | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const go = useWorkflowNavigation((destination) => {
    const resolved = destination.route;
    setDestinationTab(resolved === 'Diver Summary Export' ? 'Diver summary' : destination.params?.tab ?? resolved);
    setActive(resolved === 'Diver Summary Export' ? 'Data & Backups' : resolved);
    setDestinationKey(workflowDestinationUrl(destination));
    setMenuOpen(false);
  });
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[active]);
  useEffect(() => {
    const root = document.querySelector('.focus-content');
    if (!root) return;
    const reveal = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      const editor = node.matches('.record-form,.kit-set-form') ? node : node.querySelector<HTMLElement>('.record-form,.kit-set-form');
      if (!editor || editor.closest('.focus-modal')) return;
      requestAnimationFrame(() => requestAnimationFrame(() => editor.scrollIntoView({ behavior: 'smooth', block: 'start' })));
    };
    const observer = new MutationObserver((changes) => changes.forEach((change) => change.addedNodes.forEach(reveal)));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return (
    <main className={`focus-app ${['Logbook','Overview'].includes(active)?'page-has-primary':''}`}>
      {menuOpen && (
        <button
          className="menu-scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`focus-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="focus-brand">
          <img src="/zeustek-wordmark.png" alt="ZeusTek Diving" />
          <button
            className="focus-icon menu-close"
            onClick={() => setMenuOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
        <WorkflowNavigation active={active} go={go}/>
        <div className="focus-private">
          <ShieldCheck size={16} />
          <div>
            <strong>Household cloud</strong>
            <small>Private profiles · shared gear</small>
            <AppVersionLink open={() => go('Changelog')} />
          </div>
        </div>
      </aside>
      <section className="focus-shell">
        <header className="focus-topbar">
          <button
            className="focus-icon mobile-menu"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="topbar-brand">
            <img
              className="topbar-wordmark"
              src="/zeustek-wordmark.png"
              alt="ZeusTek Diving"
            />
          </div>
          <PlatformHeaderStatus />
          <DiveSyncStatus />
          <button className="focus-primary" onClick={() => { setDraftDive(null); setShowAdd(true); }}>
            <Plus size={16} /> Log dive
          </button>
        </header>
        <RecordOperationStatus />
        <div className="focus-content"><ScreenTiming key={destinationKey} screen={active}>
          {active === 'Overview' && (
            <Overview openLog={() => { setDraftDive(null); setShowAdd(true); }} go={go} />
          )}
          {active === 'Changelog' && <AppChangelog />}
          {active === 'Logbook' && <Logbook openLog={() => { setDraftDive(null); setShowAdd(true); }} go={go} />}
          {active === 'Equipment' && <Equipment />}{' '}
          {active === 'Loadouts & Gas' && <Loadouts />}{' '}
          {active === 'Cylinders & Gas' && <CylindersGas />}{' '}
          {active === 'Gear Wishlist' && <GearWishlist />}{' '}
          {active === 'Sites' && <SitesV2 go={go} />}{' '}
          {active === 'Dive Site Map' && <SiteMapPage go={go} />}{' '}
          {active === 'Diving Calendar & Bookings' && <DivingCalendarBookings go={go} />}{' '}
          {active === 'Dive Plans' && <><WorkflowContextStrip from={[{label:'Trips & Expeditions',route:'Trips'},{label:'Diving Calendar & Bookings',route:'Diving Calendar & Bookings'}]} current="Dive Planning Centre" next={[{label:'Sites',route:'Sites'},{label:'People & Operators',route:'People'},{label:'Loadouts',route:'Loadouts & Gas'},{label:'Cylinders & Gas',route:'Cylinders & Gas'},{label:'Dive Skills',route:'Skills & Currency'},{label:'Technical Diving',route:'Technical Diving'},{label:'Gas Planning',route:'Gas Planning'}]} go={go}/><DivePlanningCentre go={go} convertToDive={(draft) => { setDraftDive(draft); setShowAdd(true); }} /></>}{' '}
          {active === 'Gas Planning' && <GasPlanning go={go} />}{' '}
          {active === 'Insights' && <ExperienceAnalytics go={go} />}{' '}
          {active === 'Trips' && <TripsExpeditions go={go} />}{' '}
          {active === 'Dive Bucket List' && <DiveBucketList />}{' '}
          {active === 'People' && <PeopleOperators />}{' '}
          {active === 'Albums' && <Albums />}{' '}
          {active === 'Conservation & AWARE' && <ConservationPage go={go} />}{' '}
          {active === 'Training' && <TrainingV2 go={go} />}{' '}
          {active === 'Skills & Currency' && <CollapsibleWorkCard id="dive-skills-workspace" title="Dive Skills workspace" eyebrow="DIVING CPD" status="Evidence, competence and currency"><SkillsCurrency go={go} /></CollapsibleWorkCard>}{' '}
          {active === 'Technical Diving' && <TechnicalWorkspace go={go} />}{' '}
          {active === 'Professional Development' && <ProfessionalDevelopment go={go} />}{' '}
          {active === 'Course Map' && <CollapsibleWorkCard id="planned-training-workspace" title="Planned Training workspace" eyebrow="DIVING CPD" status="Pathways and course planning"><CourseMapPage go={go} /></CollapsibleWorkCard>}{' '}
          {active === 'Dive News' && <DiveNewsV2 />}{' '}
          {active === 'Dive Media' && <DiveMediaLibrary go={go} />}{' '}
          {active === 'Dive Knowledge' && <KnowledgeCentre go={go} />}{' '}
          {active === 'Dive Computer Imports' && <DiveComputerData go={go} />}{' '}
          {active === 'Admin' && <AdminPanel />}{' '}
          {active === 'Data & Backups' && <DataCentre initialTab={destinationTab} />}
          {active === 'Imports' && <Imports />}
          {active === 'Sync' && <SyncCentre />}{' '}
          {active === 'Backups' && <BackupsScreen />}{' '}
          {active === 'Settings' && <SiteConfiguration go={go} />}
        </ScreenTiming></div>
      </section>
      <nav className="focus-mobile-nav">
        {quickNavigation.map((item) => { const Icon = workflowIcons[item.route] ?? ChevronRight; return (
          <button
            key={item.route}
            className={active === item.route ? 'active' : ''}
            onClick={() => go(item.route)}
            aria-label={item.route === 'Dive Plans' ? 'Dive Preparation — Dive Planning Centre' : item.label}
          >
            <Icon size={19} />
            <span>{item.route === 'Dive Plans' ? 'Dive Prep' : item.label}</span>
          </button>
        );})}
      </nav>
      {showAdd && <DiveModal item={draftDive} close={() => { setShowAdd(false); setDraftDive(null); }} />}
    </main>
  );
}

const configurationLinks = [
  ['settings-overview', 'Settings overview'],
  ['household-setup', 'Household setup and configuration'],
  ['skill-catalogue', 'Skill Catalogue'],
  ['equipment-training-lists', 'Equipment & training lists'],
  ['equipment-category-icons', 'Equipment category icons'],
  ['training-agency-logos', 'Training agency logos'],
  ['overview-layout-awards', 'Insights layout / awards'],
  ['dive-news-settings', 'Dive News settings'],
  ['acceptance-fixture-review', 'Synthetic data & record controls'],
  ['other-site-data-tools', 'Other site data tools'],
] as const;

function SiteConfiguration({ go }: { go: (next: string) => void }) {
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('config');
    if (!target) return;
    const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <>
    <Heading eyebrow="ADMIN · CONFIGURATION" title="Site Configuration" copy="Manage ZeusTek in compact sections; minimise anything you do not need today." action={<button className="focus-secondary" onClick={() => go('Data & Backups')}><Database size={15}/>Data & Backups</button>}/>
    <nav className="site-configuration-directory" aria-label="Site Configuration sections">{configurationLinks.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
    <div className="site-configuration-grid">
      <CollapsibleWorkCard id="settings-overview" defaultMinimized className="site-configuration-card site-configuration-core" title="Settings overview" eyebrow="SITE CONFIGURATION" status="Cloud storage, controlled lists, equipment icons and agency logos"><PlatformSettings /></CollapsibleWorkCard>
      <CollapsibleWorkCard id="household-setup" defaultMinimized className="site-configuration-card" title="Household setup and configuration" eyebrow="SHARING" status="Private profiles and shared gear"><HouseholdSettings /></CollapsibleWorkCard>
      <CollapsibleWorkCard id="skill-catalogue" defaultMinimized className="site-configuration-card" title="Skill Catalogue" eyebrow="DIVING CPD" status="Canonical groups, CSV and evidence definitions"><SkillCatalogue /></CollapsibleWorkCard>
      <CollapsibleWorkCard id="overview-layout-awards" defaultMinimized className="site-configuration-card" title="Insights layout / awards" eyebrow="INSIGHTS" status="Choose 4, 8, 12, 16 or 20 analytics awards"><DashboardAwardsSettings /></CollapsibleWorkCard>
      <CollapsibleWorkCard id="dive-news-settings" defaultMinimized className="site-configuration-card" title="Dive News settings" eyebrow="NEWS" status="Sources, inbox and ranking preferences"><NewsSourceSettings /></CollapsibleWorkCard>
      <CollapsibleWorkCard id="acceptance-fixture-review" defaultMinimized className="site-configuration-card" title="Synthetic data & record controls" eyebrow="OWNER CONFIRMATION" status="All canonical kinds, dependencies and safe actions" alert="No automatic deletion"><SyntheticFixtureReview go={go}/></CollapsibleWorkCard>
      <CollapsibleWorkCard id="other-site-data-tools" defaultMinimized className="site-configuration-card" title="Other site data tools" eyebrow="ADMIN" status="Diagnostics and records needing attention"><AdminPanel /></CollapsibleWorkCard>
    </div>
  </>;
}

type HouseholdState = {
  current: { userId: string; email: string; displayName: string };
  partner: { userId?: string; email?: string; displayName?: string } | null;
  shares: Array<{ area: string; canView: number; canEdit: number }>;
  shared: Array<Record<string, unknown> & { id: string; kind: string }>;
};

const HOUSEHOLD_AREAS = [
  ['dives', 'Dive logs'], ['training', 'Training & course plan'], ['plans', 'Dive plans'],
  ['bucket-list', 'Dive bucket list'], ['wishlist', 'Gear wishlist'], ['news', 'News priorities & reactions'],
  ['albums', 'Albums & dive media'], ['people', 'People'],
] as const;

function HouseholdSettings() {
  const [state, setState] = useState<HouseholdState | null>(null);
  const [message, setMessage] = useState('Loading household access…');
  const [copiedIds,setCopiedIds]=useState<string[]>([]);
  const load = useCallback(async () => {
    const response = await fetch('/api/household', { cache: 'no-store' });
    if (!response.ok) { setMessage('Household access is unavailable.'); return; }
    const next = await response.json() as HouseholdState; setState(next);
    setMessage(next.partner?.userId ? `${next.partner.displayName ?? 'Your partner'} is connected.` : 'Gemma can connect using her invited account after this update is published.');
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function change(area: string, canView: boolean) {
    setState((current) => current ? { ...current, shares: current.shares.map((share) => share.area === area ? { ...share, canView: canView ? 1 : 0 } : share) } : current);
    const response = await fetch('/api/household', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({area,canView}) });
    if (!response.ok) { setMessage('That sharing preference could not be saved.'); await load(); return; }
    setMessage('Sharing preference saved.');
  }
  async function copyShared(item: HouseholdState['shared'][number]) {
    const response=await fetch('/api/household',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'copy-record',id:item.id})});
    const result=await response.json() as {error?:string};
    if (!response.ok) { setMessage(result.error ?? 'That record could not be copied.'); return; }
    setCopiedIds((ids)=>[...ids,item.id]); setMessage(`${itemTitle(item)} copied to your profile.`);
  }
  const sharedByKind = new Map<string, Array<HouseholdState['shared'][number]>>();
  for (const item of state?.shared ?? []) sharedByKind.set(item.kind, [...(sharedByKind.get(item.kind) ?? []), item]);
  const itemTitle = (item: Record<string,unknown>) => String(item.title ?? item.name ?? item.site ?? item.certification ?? item.model ?? item.subject ?? 'Record');
  return <Card className="household-settings">
    <span className="focus-eyebrow">TWO-PERSON HOUSEHOLD</span><h2>Zeus &amp; Gemma</h2>
    <p className="focus-copy">Each person edits only their own personal records. Turn on an area to let the other person view it read-only.</p>
    <div className="household-member-strip"><div><Users size={20}/><span><b>{state?.current.displayName ?? 'Your profile'}</b><small>{state?.current.email}</small></span></div><div><Users size={20}/><span><b>Gemma</b><small>gemmalouisebrown1983@gmail.com · {state?.partner?.userId ? 'connected' : 'invited'}</small></span></div></div>
    <div className="household-shared-gear"><Wrench size={19}/><span><b>Shared gear</b><small>Both people can view, add, edit and service the same equipment records.</small></span><Check size={18}/></div>
    <h3>Allow {state?.partner?.displayName ?? 'the other person'} to view</h3>
    <div className="household-permissions">{HOUSEHOLD_AREAS.map(([area,label]) => { const enabled = Boolean(state?.shares.find((share) => share.area === area)?.canView); return <label key={area}><input type="checkbox" checked={enabled} disabled={!state} onChange={(event) => void change(area,event.target.checked)}/><span><b>{label}</b><small>{enabled ? (area==='albums'?'Shared editing & uploads':'Shared read-only · copying allowed') : 'Private'}</small></span></label>; })}</div>
    <p className="focus-notice" aria-live="polite"><ShieldCheck size={15}/>{message}</p>
    {state?.partner?.userId && <details className="household-partner-view"><summary>View {state.partner.displayName ?? 'partner'}’s shared records ({state.shared.length})</summary>{state.shared.length ? <div>{[...sharedByKind].map(([kind,items]) => <section key={kind}><b>{kind.replaceAll('-',' ')}</b>{items.slice(0,12).map((item) => <span className="household-shared-record" key={item.id}><span>{itemTitle(item)}</span>{['dive','trip','bucket-list','gear-wishlist','news-article','person'].includes(kind) && <button className="focus-secondary" disabled={copiedIds.includes(item.id)} onClick={()=>void copyShared(item)}>{copiedIds.includes(item.id)?<Check size={13}/>:<Copy size={13}/>} {copiedIds.includes(item.id)?'Copied':'Copy to mine'}</button>}</span>)}</section>)}</div> : <p>No personal areas have been shared with you yet.</p>}</details>}
  </Card>;
}

const DASHBOARD_AWARDS = INSIGHT_AWARD_DEFINITIONS.map(([id, label]) => [id, label] as const);
const DEFAULT_DASHBOARD_AWARDS = [
  'divesLogged',
  'maxDepth',
  'averageDepth',
  'longestDive',
  'bestSac',
  'highestCert',
  'nightDives',
  'boatDives',
];
const DEFAULT_NEWSLETTER_EMAIL = 'zeustekdivenews@gmail.com';

function DashboardAwardsSettings() {
  const [record, setRecord] = useState<Stored<DashboardSettingsRecord> | null>(null);
  const [selected, setSelected] = useState<string[]>(DEFAULT_DASHBOARD_AWARDS);
  const [maximum, setMaximum] = useState(8);
  const [diveNumberStart, setDiveNumberStart] = useState(1);
  const [customGoogleMapEmbedUrl, setCustomGoogleMapEmbedUrl] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState(DEFAULT_NEWSLETTER_EMAIL);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void listDashboardSettings().then((records) => {
      const current = records[0] ?? null;
      setRecord(current);
      if (current) {
        setMaximum(normaliseInsightAwardCount(current.maxAwards));
        setDiveNumberStart(Math.max(1, current.diveNumberStart || 1));
        setSelected(current.selectedAwards ?? DEFAULT_DASHBOARD_AWARDS);
        setCustomGoogleMapEmbedUrl(current.customGoogleMapEmbedUrl ?? '');
        setNewsletterEmail(current.newsletterEmail ?? DEFAULT_NEWSLETTER_EMAIL);
      }
    });
  }, []);
  function toggleAward(id: string, checked: boolean) {
    setMessage('');
    setSelected((current) => checked ? [...current, id] : current.filter((value) => value !== id));
  }
  async function save() {
    setSaving(true);
    setMessage('Saving…');
    try {
      const nextSelected = selected;
      const result = await saveDashboardSettings({
        ...(record ? { entityId: record.entityId } : {}),
        selectedAwards: nextSelected,
        maxAwards: maximum,
        diveNumberStart,
        customGoogleMapEmbedUrl: normaliseMyMaps(customGoogleMapEmbedUrl),
        newsletterEmail: newsletterEmail.trim(),
        homeWeatherSiteIds: record?.homeWeatherSiteIds ?? [],
      });
      setSelected(nextSelected);
      if (!record) setRecord({ entityId: result.id, selectedAwards: nextSelected, maxAwards: maximum, diveNumberStart, customGoogleMapEmbedUrl: customGoogleMapEmbedUrl.trim(), newsletterEmail: newsletterEmail.trim(), homeWeatherSiteIds: [], createdAt: '', modifiedAt: '' });
      setMessage('Saved. Dive numbers were recalculated by date and time.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card className="dashboard-award-settings">
      <span className="focus-eyebrow">INSIGHTS LAYOUT</span>
      <h2>Insights awards</h2>
      <p className="focus-copy">Choose the achievements and statistics shown in Experience &amp; Analytics. Overview remains an at-a-glance status page.</p>
      <label className="award-limit">Maximum shown<select value={maximum} onChange={(event) => {
        const next = Number(event.target.value);
        setMaximum(next);
      }}>{INSIGHT_AWARD_COUNTS.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="award-limit">First lifetime dive number<input type="number" min="1" value={diveNumberStart} onChange={(event) => setDiveNumberStart(Math.max(1, Number(event.target.value) || 1))} /></label>
      <label className="record-wide">Google My Maps share URL or map ID<input type="text" value={customGoogleMapEmbedUrl} onChange={(event) => setCustomGoogleMapEmbedUrl(event.target.value)} placeholder="https://www.google.com/maps/d/viewer?mid=YOUR_MAP_ID" /><small>Paste a My Maps viewer, share or embed link, or its map ID. This opens your custom map in the Google Maps view. Export KML to update its pins; changes are not automatic.</small></label>
      <label className="record-wide">Dive newsletter inbox<input type="email" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} placeholder={DEFAULT_NEWSLETTER_EMAIL} /><small>This address is shown on Dive News for newsletter signups and can be connected through the read-only Google mailbox panel there.</small></label>
      <div className="award-choice-grid">
        {DASHBOARD_AWARDS.map(([id, label]) => <label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={(event) => toggleAward(id, event.target.checked)} />{label}</label>)}
      </div>
      <div className="award-settings-footer"><span>{message}</span><button className="focus-primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Insights awards'}</button></div>
    </Card>
  );
}

type ForecastPayload = {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
  daily_units?: Record<string, string>;
};

function weatherIcon(code = 3, size = 18) {
  if (code === 0) return <Sun size={size} />;
  if ([1, 2].includes(code)) return <CloudSun size={size} />;
  if ([45, 48].includes(code)) return <CloudFog size={size} />;
  if (code >= 71 && code <= 77) return <Snowflake size={size} />;
  if (code >= 95) return <CloudLightning size={size} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain size={size} />;
  return <Cloud size={size} />;
}

function forecastDescription(code = 3) {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Fog';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 95) return 'Thunderstorms';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'Rain';
  return 'Mixed conditions';
}

function useSiteForecasts(sites: Array<Stored<DiveSiteRecord>>) {
  const [forecasts, setForecasts] = useState<Record<string, ForecastPayload>>({});
  const [error, setError] = useState('');
  const signature = sites.map((site) => `${site.entityId}:${site.latitude}:${site.longitude}`).join('|');
  useEffect(() => {
    const located = sites.filter((site) => site.latitude != null && site.longitude != null).slice(0, 8);
    if (!located.length) { setForecasts({}); setError(''); return; }
    let cancelled = false;
    async function load() {
      const points = located.map((site) => `${site.latitude},${site.longitude}`).join('|');
      let locations: Array<{ weather?: ForecastPayload | null }> = [];
      try {
        const response = await fetch(`/api/site-weather?${new URLSearchParams({ points })}`, { cache: 'no-store' });
        const result = await response.json() as { locations?: Array<{ weather?: ForecastPayload | null }>; error?: string };
        if (!response.ok || !result.locations) throw new Error(result.error || 'Shared forecast unavailable');
        locations = result.locations;
      } catch {
        const direct = new URL('https://api.open-meteo.com/v1/forecast');
        direct.search = new URLSearchParams({
          latitude: located.map((site) => String(site.latitude)).join(','),
          longitude: located.map((site) => String(site.longitude)).join(','),
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
          timezone: 'auto', forecast_days: '7', wind_speed_unit: 'mph',
        }).toString();
        const response = await fetch(direct);
        if (!response.ok) throw new Error('Forecast service unavailable');
        const result = await response.json() as ForecastPayload | ForecastPayload[];
        locations = (Array.isArray(result) ? result : [result]).map((weather) => ({ weather }));
      }
      if (cancelled) return;
      setForecasts(Object.fromEntries(located.flatMap((site, index) => locations[index]?.weather ? [[site.entityId, locations[index].weather as ForecastPayload]] : [])));
      setError('');
    }
    void load().catch(() => { if (!cancelled) { setForecasts({}); setError('Forecast temporarily unavailable.'); } });
    return () => { cancelled = true; };
  }, [signature]);
  return { forecasts, error };
}

function SevenDayForecastCard({ site, forecast, compact = false }: { site: Pick<DiveSiteRecord, 'name' | 'location'>; forecast?: ForecastPayload | undefined; compact?: boolean }) {
  const daily = forecast?.daily;
  const days = daily?.time?.slice(0, compact ? 4 : 7) ?? [];
  return <Card className={`mini-forecast-card ${compact ? 'compact' : ''}`}>
    <div className="mini-forecast-head"><div><span className="focus-eyebrow">{compact ? 'FORECAST' : '7-DAY DIVE WEATHER'}</span><h3>{site.name}</h3><small>{site.location}</small></div><CloudSun /></div>
    {days.length ? <div className="forecast-days">{days.map((date, index) => {
      const code = daily?.weather_code?.[index] ?? 3;
      return <div key={date} title={forecastDescription(code)}><b>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</b>{weatherIcon(code, compact ? 17 : 20)}<span>{Math.round(daily?.temperature_2m_max?.[index] ?? 0)}°</span><small>{Math.round(daily?.wind_speed_10m_max?.[index] ?? 0)} mph</small></div>;
    })}</div> : <p className="focus-copy">Loading seven-day forecast…</p>}
  </Card>;
}

function Overview({
  openLog,
  go,
}: {
  openLog: () => void;
  go: (value: string) => void;
}) {
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>(
    [],
  );
  const [equipment, setEquipment] = useState<Array<Stored<EquipmentRecord>>>(
    [],
  );
  const [trips, setTrips] = useState<Array<Stored<DiveTripRecord>>>([]);
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [certifications, setCertifications] = useState<Array<Stored<CertificationRecord>>>([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [awardSettings, setAwardSettings] = useState<DashboardSettingsRecord | null>(null);
  const [weatherPickerOpen, setWeatherPickerOpen] = useState(false);
  const [weatherSelectionSaving, setWeatherSelectionSaving] = useState(false);
  const refreshOverview=useCallback(() => {
    void listDives().then(setDives);
    void listEquipment().then(setEquipment);
    void listDiveTrips().then(setTrips);
    void listDiveSites().then(setSites);
    void listCertifications().then(setCertifications);
    void listPeople().then(setPeople);
    void listDashboardSettings()
      .then((nextAwardSettings) => setAwardSettings(nextAwardSettings[0] ?? null))
      .catch(() => setAwardSettings(null));
  }, []);
  useRecordRefresh(refreshOverview);
  const certificationByTrack = (track: 'rec' | 'tec' | 'pro') => certifications
    .filter((certification) => {
      const title = `${certification.certification} ${certification.level}`.toLowerCase();
      if (track === 'pro') return /divemaster|dive master|instructor|course director/.test(title);
      if (track === 'tec') return /tec|technical|trimix|decompression|extended range|ccr|rebreather/.test(title);
      return !/divemaster|dive master|instructor|course director|tec|technical|trimix|decompression|extended range|ccr|rebreather/.test(title);
    })
    .sort((a, b) => certificationAwardPriority(b) - certificationAwardPriority(a))[0];
  const buddyCounts = new Map<string, number>();
  dives.forEach((dive) => (dive.buddyIds ?? []).forEach((id) => buddyCounts.set(id, (buddyCounts.get(id) ?? 0) + 1)));
  const ownerProfile = findOwnerProfile(people);
  const derivedTopBuddy = [...people]
    .filter((person) => hasPersonRole(person, 'buddy') && buddyCounts.has(person.entityId))
    .sort((a, b) => (buddyCounts.get(b.entityId) ?? 0) - (buddyCounts.get(a.entityId) ?? 0) || a.name.localeCompare(b.name))[0] ?? null;
  const topBuddy = people.find((person) => person.entityId === ownerProfile?.preferredTopBuddyPersonId) ?? derivedTopBuddy;
  const nextTrip = [...trips]
    .filter((trip) => trip.status !== 'completed')
    .sort((a, b) =>
      (a.startDate || '9999').localeCompare(b.startDate || '9999'),
    )[0];
  const nextSite = nextTrip
    ? sites.find((site) => site.entityId === nextTrip.siteId) ??
      sites.find(
        (site) =>
          site.name.trim().toLowerCase() ===
          nextTrip.siteName.trim().toLowerCase(),
      )
    : undefined;
  const weatherCandidateSites = sites
    .filter((site) => site.latitude != null && site.longitude != null)
    .sort((a, b) => Number(Boolean(b.favourite)) - Number(Boolean(a.favourite)) || a.name.localeCompare(b.name));
  const defaultHomeWeatherSiteIds = weatherCandidateSites
    .filter((site) => ['capernwray diving centre', 'ellerton water park'].includes(site.name.trim().toLowerCase()))
    .map((site) => site.entityId);
  const selectedHomeWeatherSiteIds = awardSettings?.homeWeatherSiteIds ?? defaultHomeWeatherSiteIds;
  const featuredSites = selectedHomeWeatherSiteIds
    .flatMap((siteId) => { const site = weatherCandidateSites.find((candidate) => candidate.entityId === siteId); return site ? [site] : []; })
    .slice(0, 6);
  const forecastSites = [...featuredSites, ...(nextSite && !featuredSites.some((site) => site.entityId === nextSite.entityId) ? [nextSite] : [])].slice(0, 8);
  const { forecasts, error: forecastError } = useSiteForecasts(forecastSites);
  const nextDaily = nextSite ? forecasts[nextSite.entityId]?.daily : undefined;
  const nextDateIndex = nextTrip?.startDate && nextDaily?.time ? nextDaily.time.indexOf(nextTrip.startDate) : -1;
  const nextWeatherIndex = nextDateIndex != null && nextDateIndex >= 0 ? nextDateIndex : 0;
  const serviceOverviewItems = overviewServiceItems(equipment, dives, 8);
  const serviceWarningCount = serviceOverviewItems.filter((item) => equipmentServiceStatus(item, dives).state !== 'current').length;
  async function saveHomeWeatherSelection(nextIds: string[]) {
    if (nextIds.length > 6 || weatherSelectionSaving) return;
    const current = awardSettings;
    const optimistic: DashboardSettingsRecord = {
      selectedAwards: current?.selectedAwards ?? DEFAULT_DASHBOARD_AWARDS,
      maxAwards: current?.maxAwards || 8,
      diveNumberStart: current?.diveNumberStart || 1,
      customGoogleMapEmbedUrl: current?.customGoogleMapEmbedUrl ?? '',
      newsletterEmail: current?.newsletterEmail ?? DEFAULT_NEWSLETTER_EMAIL,
      homeWeatherSiteIds: nextIds,
      createdAt: current?.createdAt ?? '',
      modifiedAt: current?.modifiedAt ?? '',
    };
    setAwardSettings(optimistic);
    setWeatherSelectionSaving(true);
    try {
      const result = await saveDashboardSettings({
        ...(current && 'entityId' in current ? { entityId: (current as Stored<DashboardSettingsRecord>).entityId } : {}),
        selectedAwards: optimistic.selectedAwards,
        maxAwards: optimistic.maxAwards,
        diveNumberStart: optimistic.diveNumberStart ?? 1,
        customGoogleMapEmbedUrl: optimistic.customGoogleMapEmbedUrl ?? '',
        newsletterEmail: optimistic.newsletterEmail ?? '',
        homeWeatherSiteIds: nextIds,
      });
      setAwardSettings({ ...optimistic, entityId: result.id } as Stored<DashboardSettingsRecord>);
    } catch {
      setAwardSettings(current);
    } finally {
      setWeatherSelectionSaving(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="DIVE CONTROL"
        title="Ready for the next descent."
        copy="Live logs, kit and plans from your account — available on all your devices."
        action={
          <button className="focus-primary" onClick={openLog}>
            <Plus size={16} /> Log a dive
          </button>
        }
      />
      <div className="overview-dashboard-layout">
      <div className="overview-dashboard-main">
      <div className="overview-glance-grid">
        <div className="next-dive-card overview-next-dive">
          <span className="focus-eyebrow">NEXT DIVE</span>
          <h2>{nextTrip?.name || 'No upcoming trip yet'}</h2>
          <p>
            {nextTrip
              ? [
                  nextTrip.startDate &&
                    new Date(
                      `${nextTrip.startDate}T12:00:00`,
                    ).toLocaleDateString(),
                  nextTrip.siteName,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Add a trip when the plan is confirmed and it will appear here.'}
          </p>
          {nextSite && nextDaily?.time?.length ? <div className="next-dive-weather">
            {weatherIcon(nextDaily.weather_code?.[nextWeatherIndex] ?? 3, 24)}
            <div><b>{forecastDescription(nextDaily.weather_code?.[nextWeatherIndex] ?? 3)}</b><span>{Math.round(nextDaily.temperature_2m_min?.[nextWeatherIndex] ?? 0)}–{Math.round(nextDaily.temperature_2m_max?.[nextWeatherIndex] ?? 0)}°C · wind to {Math.round(nextDaily.wind_speed_10m_max?.[nextWeatherIndex] ?? 0)} mph</span></div>
          </div> : nextTrip && <small className="next-weather-note">{nextSite ? 'Loading forecast…' : 'Link this plan to a saved site to show its weather.'}</small>}
          <button onClick={() => go('Dive Plans')}>
            Open dive plans <ChevronRight size={15} />
          </button>
        </div>
        <Card className="overview-profile-card"><span className="focus-eyebrow">MY PROFILE</span><h2>{ownerProfile ? personDisplayName(ownerProfile) : 'Set up My Profile'}</h2>{ownerProfile ? <dl><div><dt>Highest recreational</dt><dd>{ownerProfile.highestRecreationalCertification || certificationByTrack('rec')?.certification || certificationByTrack('rec')?.level || 'Unknown'}</dd></div><div><dt>Highest technical</dt><dd>{ownerProfile.highestTechnicalCertification || certificationByTrack('tec')?.certification || certificationByTrack('tec')?.level || 'Unknown'}</dd></div><div><dt>Highest professional</dt><dd>{ownerProfile.highestProfessionalCertification || certificationByTrack('pro')?.certification || certificationByTrack('pro')?.level || 'Unknown'}</dd></div><div><dt>Profile source</dt><dd>{sourceLabel(ownerProfile.profileValueSources?.highestRecreationalCertification, ownerProfile.manualOverrideFields?.includes('highestRecreationalCertification'))}</dd></div></dl> : <p className="focus-copy">Create one owner Person profile to power Overview, planning and summaries. Nothing is created automatically.</p>}<button className="focus-link" onClick={() => go('People')}>{ownerProfile ? 'Open My Profile' : 'Create My Profile'}</button></Card>
        <Card className="overview-buddy-card"><span className="focus-eyebrow">TOP DIVE BUDDY</span><h2>{topBuddy ? personDisplayName(topBuddy) : 'No buddy evidence yet'}</h2>{topBuddy ? <dl><div><dt>Dives together</dt><dd>{buddyCounts.get(topBuddy.entityId) ?? topBuddy.totalLinkedDives ?? 0}</dd></div><div><dt>Highest qualification</dt><dd>{topBuddy.highestRecreationalCertification || topBuddy.highestTechnicalCertification || topBuddy.highestProfessionalCertification || topBuddy.highestQualification || 'Unknown'}</dd></div><div><dt>Last dived together</dt><dd>{topBuddy.lastDivedTogether || 'Unknown'}</dd></div>{Boolean(topBuddy.contactVisibility && topBuddy.contactVisibility !== 'private') && <div><dt>Contact</dt><dd>{topBuddy.email || topBuddy.phone || 'Not recorded'}</dd></div>}</dl> : <p className="focus-copy">Buddy rankings are derived from canonical Dive links, unless My Profile chooses a preferred buddy.</p>}<button className="focus-link" onClick={() => go('People')}>Open people</button></Card>
      </div>
      <div className="focus-grid">
        <CollapsibleWorkCard id="overview-equipment-status" title="Equipment status" eyebrow="KIT STATUS" status={`${serviceWarningCount} item${serviceWarningCount===1?'':'s'} need attention`} alert={serviceWarningCount?'Service review required':undefined} rowCount={serviceOverviewItems.length} previewLimit={5} onOpenDetail={()=>go('Equipment')}>
          {({expanded,previewLimit}) => <><div className="focus-card-head"><Wrench /><span className="focus-copy">Service schedule</span></div>{serviceOverviewItems.slice(0,expanded?undefined:previewLimit).map((item) => (
            <StatusRow
              key={item.entityId}
              title={item.name}
              meta={
                equipmentServiceStatus(item, dives).dateDue
                  ? `Next service ${new Date(`${equipmentServiceStatus(item, dives).dateDue}T12:00:00`).toLocaleDateString()}`
                  : ''
              }
              warn={equipmentServiceStatus(item, dives).state !== 'current'}
            />
          ))}
          {!serviceOverviewItems.length && (
            <p className="focus-copy">No scheduled-service items with a due date.</p>
          )}
          <button className="focus-link" onClick={() => go('Equipment')}>
            View equipment
          </button></>}
        </CollapsibleWorkCard>
      </div>
      </div>
      <section className="home-weather-section">
        <div className="focus-card-head"><div><span className="focus-eyebrow">HOME DIVE FORECASTS</span><h2>Seven-day conditions</h2><p className="focus-copy">Choose up to six saved sites, or show no forecast cards.</p></div><button className="focus-secondary" aria-expanded={weatherPickerOpen} onClick={() => setWeatherPickerOpen((current) => !current)}>{weatherPickerOpen ? 'Close selector' : 'Choose sites'}</button></div>
        {weatherPickerOpen && <Card className="home-weather-picker"><div className="home-weather-picker-head"><div><h3>Forecast sites</h3><p className="focus-copy">Selections save automatically and sync across devices.</p></div><label><input type="checkbox" checked={selectedHomeWeatherSiteIds.length === 0} disabled={weatherSelectionSaving} onChange={(event) => { if (event.target.checked) void saveHomeWeatherSelection([]); }} /> Don’t show any</label></div><div className="home-weather-options">{weatherCandidateSites.map((site) => { const checked = selectedHomeWeatherSiteIds.includes(site.entityId); return <label key={site.entityId}><input type="checkbox" checked={checked} disabled={weatherSelectionSaving || (!checked && selectedHomeWeatherSiteIds.length >= 6)} onChange={(event) => void saveHomeWeatherSelection(event.target.checked ? [...selectedHomeWeatherSiteIds, site.entityId] : selectedHomeWeatherSiteIds.filter((siteId) => siteId !== site.entityId))} /><span><b>{site.name}</b><small>{site.location || site.country || 'Location not recorded'}</small></span></label>; })}</div><small className="home-weather-picker-status">{weatherSelectionSaving ? 'Saving selection…' : `${selectedHomeWeatherSiteIds.length} of 6 selected`}</small></Card>}
        {featuredSites.length ? <div className="home-weather-grid">{featuredSites.map((site) => <SevenDayForecastCard key={site.entityId} site={site} forecast={forecasts[site.entityId]} compact />)}</div> : <Card className="focus-empty"><CloudSun size={30}/><h2>No forecast sites selected</h2><p>Open the selector and tick up to six sites whenever you want forecasts here.</p><button className="focus-primary" onClick={() => setWeatherPickerOpen(true)}>Choose forecast sites</button></Card>}
        {forecastError && <div className="focus-notice"><CloudRain size={15}/>{forecastError}</div>}
      </section>
      </div>
    </>
  );
}

function StatusRow({
  title,
  meta,
  warn = false,
}: {
  title: string;
  meta: string;
  warn?: boolean;
}) {
  return (
    <div className="focus-row">
      <i className={warn ? 'warn' : ''} />
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      <ChevronRight size={15} />
    </div>
  );
}

function AdminPanel() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>([]);
  useEffect(() => {
    try { setLogs(JSON.parse(localStorage.getItem(ADMIN_LOG_KEY) || '[]') as AdminLogEntry[]); } catch { setLogs([]); }
    void Promise.all([listDiveSites(), listDives()]).then(([nextSites, nextDives]) => { setSites(nextSites); setDives(nextDives); });
  }, []);
  const sitesWithoutCoordinates = sites.filter((site) => site.latitude == null || site.longitude == null);
  const divesMissingTemperatures = dives.filter((dive) => dive.airTemperatureC == null || dive.surfaceTemperatureC == null);
  function downloadLogs() {
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [['Timestamp','Category','Status','Dive / site','Detail'], ...logs.map((entry) => [entry.timestamp,entry.category,entry.status,entry.subject,entry.detail])].map((row) => row.map(escape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `zeustek-admin-log-${new Date().toISOString().slice(0,10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <>
    <Heading eyebrow="DIAGNOSTICS · IMPORTS · WEATHER" title="Admin" copy="See which records need attention and review detailed results from background data operations." action={<button className="focus-secondary" disabled={!logs.length} onClick={downloadLogs}><Upload size={15}/> Download log CSV</button>} />
    <div className="course-summary-strip"><span><b>{logs.length}</b> diagnostic entries</span><span><b>{divesMissingTemperatures.length}</b> dives missing temperatures</span><span><b>{sitesWithoutCoordinates.length}</b> sites missing coordinates</span></div>
    <Card><div className="focus-card-head"><div><span className="focus-eyebrow">LATEST OPERATIONS</span><h2>Site, weather and price-check logs</h2></div>{logs.length > 0 && <button className="focus-secondary" onClick={() => { localStorage.removeItem(ADMIN_LOG_KEY); setLogs([]); }}>Clear logs</button>}</div>
      {logs.length ? <div className="admin-log-table">{logs.map((entry, index) => <div key={`${entry.timestamp}-${index}`} className={entry.status}><time>{new Date(entry.timestamp).toLocaleString()}</time><strong>{entry.subject}</strong><span>{entry.detail}</span><b>{entry.status}</b></div>)}</div> : <p className="focus-copy">No diagnostic operations have been recorded yet. Weather backfills and wishlist price checks will add detailed results here.</p>}
    </Card>
    <Card><span className="focus-eyebrow">SITE READINESS</span><h2>Sites preventing weather lookup</h2>{sitesWithoutCoordinates.length ? <div className="admin-site-list">{sitesWithoutCoordinates.slice(0,100).map((site) => <span key={site.entityId}>{site.name}<small>{site.location || 'Location not recorded'}</small></span>)}</div> : <p className="focus-copy">Every site has coordinates.</p>}</Card>
  </>;
}

function Logbook({ openLog, go }: { openLog: () => void; go: (next: string) => void }) {
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>(
    [],
  );
  const [equipment, setEquipment] = useState<Array<Stored<EquipmentRecord>>>(
    [],
  );
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [weatherBackfillStatus, setWeatherBackfillStatus] = useState('');
  const [search, setSearch] = useState(() => typeof window === 'undefined' ? '' : sessionStorage.getItem('zeustek-logbook-site-filter') ?? '');
  const [modeFilter, setModeFilter] = useState('all');
  const [toolsOpen,setToolsOpen]=useState(false);
  const [sort, setSort] = useState('newest');
  const refresh = useCallback(() => {
    void Promise.all([listDives(), listEquipment(), listPeople(), listDiveSites()]).then(
      ([nextDives, nextEquipment, nextPeople, nextSites]) => {
        setDives(nextDives);
        setEquipment(nextEquipment);
        setPeople(nextPeople);
        setSites(nextSites);
      },
    );
  }, []);
  useRecordRefresh(refresh);
  useEffect(() => { sessionStorage.removeItem('zeustek-logbook-site-filter'); }, []);
  const [viewing, setViewing] = useState<
    (DiveRecord & { entityId: string }) | null
  >(null);
  const [editing, setEditing] = useState<
    (DiveRecord & { entityId: string }) | null
  >(null);
  const [initialDiveView, setInitialDiveView] = useState<DiveView>('overview');
  const openedDiveLink = useRef(false);
  useEffect(() => {
    if (openedDiveLink.current) return;
    const query = new URLSearchParams(window.location.search);
    const id = query.get('diveId');
    if (!id) { openedDiveLink.current = true; return; }
    const dive = dives.find(candidate => candidate.entityId === id);
    if (!dive) return;
    openedDiveLink.current = true;
    setInitialDiveView(parseDiveView(query.get('view')));
    setViewing(dive);
  }, [dives]);
  async function remove(item: DiveRecord & { entityId: string }) {
    if (!confirm(`Delete the dive at ${item.site}?`)) return;
    await deleteDive(item.entityId);
    setViewing(null);
    refresh();
  }
  const [gasStatus,setGasStatus]=useState('');const [gasBusy,setGasBusy]=useState(false);
  async function fillMissingGas() {
   setGasBusy(true);let updated=0,skipped=0;
   try {for(const dive of dives){const result=fillMissingGasRates({...dive,totalElapsedMin:summedRuntime(dive.bottomTimeMin,dive.decoStops??[],dive.safetyStopExecuted?dive.safetyStopDurationMin??null:0)});if(result.changed){await saveDive({...dive,cylinders:result.cylinders});updated++;}else if(result.error)skipped++;}setGasStatus(`${updated} logs updated; ${skipped} need more data or measured gas segments. Existing values were kept.`);refresh();}catch(error){setGasStatus(`${updated} logs updated before an error: ${String(error)}`);}finally{setGasBusy(false);}
  }
  async function fillMissingTemperatures() {
    const candidates = dives.filter((dive) => dive.airTemperatureC == null || dive.surfaceTemperatureC == null);
    if (!candidates.length) {
      setWeatherBackfillStatus('All dive logs already have air and surface temperatures.');
      return;
    }
    if (!window.confirm(`Look up historical weather for ${candidates.length} dive log${candidates.length === 1 ? '' : 's'}? Existing temperatures will not be changed.`)) return;
    let updated = 0;
    let skipped = 0;
    const report: AdminLogEntry[] = [];
    for (const dive of candidates) {
      const matchedSite = sites.find((site) => site.entityId === dive.siteId) ?? sites.find((site) => site.name.trim().toLowerCase() === dive.site.trim().toLowerCase());
      const latitude = dive.latitude ?? matchedSite?.latitude;
      const longitude = dive.longitude ?? matchedSite?.longitude;
      if (latitude == null || longitude == null || !dive.date) {
        skipped += 1;
        report.push({ timestamp: new Date().toISOString(), category: 'Weather backfill', status: 'skipped', subject: `${dive.site} · ${dive.date || 'date missing'}`, detail: latitude == null || longitude == null ? 'No coordinates on the dive or matching site.' : 'Dive date is missing.' });
        continue;
      }
      setWeatherBackfillStatus(`Checking ${updated + skipped + 1} of ${candidates.length}: ${dive.site}`);
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          date: dive.date,
          time: dive.timeIn || '12:00',
          marine: String(['shore', 'boat', 'wreck', 'sea'].includes(matchedSite?.siteType ?? '')),
        });
        const response = await fetch(`/api/site-weather?${params}`, { cache: 'no-store' });
        const result = await response.json() as { logConditions?: Partial<DiveRecord> & { weatherSummary?: string }; provider?:string;resolution?:string;attribution?:string };
        if (!response.ok || !result.logConditions) throw new Error('No history');
        const nextAir = dive.airTemperatureC ?? result.logConditions.airTemperatureC;
        const nextSurface = dive.surfaceTemperatureC ?? result.logConditions.surfaceTemperatureC;
        if (nextAir == null && nextSurface == null) {
          skipped += 1;
          report.push({ timestamp: new Date().toISOString(), category: 'Weather backfill', status: 'skipped', subject: `${dive.site} · ${dive.date}`, detail: 'Historical service returned no usable air or surface temperature.' });
          continue;
        }
        await saveDive({
          ...dive,
          entityId: dive.entityId,
          airTemperatureC: nextAir ?? null,
          surfaceTemperatureC: nextSurface ?? null,
          weather: dive.weather || result.logConditions.weatherSummary || '',
          weatherProvider: result.provider??'Open-Meteo',weatherResolution:result.resolution??'hourly',weatherAttribution:result.attribution??'',
        });
        updated += 1;
        report.push({ timestamp: new Date().toISOString(), category: 'Weather backfill', status: 'updated', subject: `${dive.site} · ${dive.date}`, detail: `Air ${nextAir ?? 'unchanged'}°C; surface ${nextSurface ?? 'unchanged'}°C.` });
      } catch (reason) {
        skipped += 1;
        report.push({ timestamp: new Date().toISOString(), category: 'Weather backfill', status: 'skipped', subject: `${dive.site} · ${dive.date}`, detail: reason instanceof Error ? reason.message : 'Historical weather request failed.' });
      }
    }
    appendAdminLogs(report);
    setWeatherBackfillStatus(`${updated} dive log${updated === 1 ? '' : 's'} updated; ${skipped} skipped because coordinates or historical data were unavailable.`);
    refresh();
  }
  const visibleDives = dives
    .filter((dive) => {
      const term = search.trim().toLowerCase();
      const textMatch = !term || [dive.site, dive.country, dive.region, dive.notes, dive.diveNumber].join(' ').toLowerCase().includes(term);
      const technical = dive.isTechnicalDive || dive.diveMode === 'technical' || dive.diveMode === 'technical-training';
      const modeMatch = modeFilter === 'all' || (modeFilter === 'technical' ? technical && dive.diveMode !== 'technical-training' : modeFilter === 'technical-training' ? dive.diveMode === 'technical-training' : modeFilter === 'recreational-training' ? dive.diveMode === 'recreational-training' : !technical && dive.diveMode !== 'recreational-training');
      return textMatch && modeMatch;
    })
    .sort((a, b) => {
      if (sort === 'oldest') return `${a.date}T${a.timeIn || ''}`.localeCompare(`${b.date}T${b.timeIn || ''}`);
      if (sort === 'deepest') return (b.maxDepthM ?? 0) - (a.maxDepthM ?? 0);
      if (sort === 'number') return (a.diveNumber ?? Number.MAX_SAFE_INTEGER) - (b.diveNumber ?? Number.MAX_SAFE_INTEGER);
      return `${b.date}T${b.timeIn || ''}`.localeCompare(`${a.date}T${a.timeIn || ''}`);
    });
  return (
    <>
      <Heading
        eyebrow="PRIVATE CLOUD · ALL DEVICES"
        title="Dive logbook"
        copy="Every dive saves to your private account with its source preserved."
        action={<div className="record-actions logbook-actions"><button className="focus-secondary" aria-expanded={toolsOpen} onClick={()=>setToolsOpen(!toolsOpen)}><Settings2 size={16}/>Tools</button><button className="focus-primary" onClick={openLog}><Plus size={16}/>Log dive</button></div>}
      />
      <WorkflowContextStrip from={[{label:'Dive Planning Centre',route:'Dive Plans'},{label:'Dive Computer Imports',route:'Dive Computer Imports'}]} current="Logbook" next={[{label:'Dive Skills',route:'Skills & Currency'},{label:'Albums',route:'Albums'},{label:'Insights',route:'Insights'}]} go={go}/>
      <div className="logbook-tools" hidden={!toolsOpen}><button className="focus-secondary" disabled={gasBusy} onClick={()=>void fillMissingGas()}><Gauge size={16}/>{gasBusy?'Calculating…':'Calculate missing SAC / RMV'}</button>
          <button className="focus-secondary" onClick={() => void fillMissingTemperatures()}>
            <CloudRain size={16} /> Fill missing temperatures
          </button>
      </div>
      {gasStatus && <p role="status" className="focus-notice">{gasStatus}</p>}
      {weatherBackfillStatus && <div className="focus-notice"><CloudRain size={15} /> {weatherBackfillStatus}</div>}
      <ListToolbar search={search} setSearch={setSearch} filter={modeFilter} setFilter={setModeFilter} filterLabel="Dive mode" filterOptions={[[ 'all', 'All dives' ], [ 'recreational', 'Recreational' ], [ 'recreational-training', 'Recreational training' ], [ 'technical', 'Technical' ], [ 'technical-training', 'Technical training' ]]} sort={sort} setSort={setSort} sortOptions={[[ 'newest', 'Newest first' ], [ 'oldest', 'Oldest first' ], [ 'number', 'Dive number' ], [ 'deepest', 'Deepest first' ]]} />
      {dives.length ? (
        <div className="log-list">
          {visibleDives.map((dive) => (
            <Card key={dive.entityId} className="log-card clickable-card">
              <button
                className="card-hit"
                onClick={() => { setInitialDiveView('overview'); setViewing(dive); }}
                aria-label={`View dive at ${dive.site}`}
              />
              <div className="log-date">
                <strong>{new Date(`${dive.date}T12:00:00`).getDate()}</strong>
                <span>
                  {new Date(`${dive.date}T12:00:00`)
                    .toLocaleDateString(undefined, { month: 'short' })
                    .toUpperCase()}
                </span>
                <small className="log-time" aria-label={`Time in ${dive.timeIn || 'not recorded'}, time out ${dive.timeOut || 'not recorded'}`}>{logTimeRange(dive.timeIn,dive.timeOut)}</small>
              </div>
              <div>
                <h3 className="icon-title"><ZeusTekIcon id={resolveDiveIconId(dive)} size={28}/><span>{dive.site}</span></h3>
                <p>{dive.notes || 'Manual dive log'}</p>
                <div className="log-metrics">
                  <span className="log-metric" title="Dive number"><Hash size={17}/>{dive.diveNumber ?? '—'}</span>
                  <span className="log-metric" title="Maximum depth"><Waves size={18}/>{dive.maxDepthM ?? '—'} m</span>
                  <span className="log-metric" title="Bottom time"><Clock size={18}/>{dive.bottomTimeMin ?? '—'} min</span>
                  <span className="log-metric" title="Breathing gas"><Cylinder size={18}/>{dive.gas || '—'}</span><span className="log-metric" title="Surface water temperature"><Thermometer size={18}/>{dive.surfaceTemperatureC ?? '—'}°C</span><span className="log-metric" title="Visibility"><Waves size={18}/>{dive.visibilityM ?? '—'} m vis</span>
                  <span className="log-metric"><ZeusTekIcon id={resolveDiveIconId(dive)} size="chip"/>{dive.diveMode === 'technical-training' ? 'TEC TRAINING' : dive.diveMode === 'recreational-training' ? 'REC TRAINING' : dive.isTechnicalDive || dive.diveMode === 'technical' ? 'TEC' : 'REC'}</span>
                  <div className="completeness">{Object.entries(diveCompleteness(dive)).map(([label, status]) => {const Icon = label === 'Weather' ? CloudSun : label === 'Gear' ? Wrench : Cylinder; const text = `${label}: ${status === 'missing' ? 'not recorded' : status === 'partial' ? 'partial data' : 'recorded'}`;return <span key={label} className={`data-status ${status}`} title={text} aria-label={text} role="img"><Icon size={19} aria-hidden="true"/></span>;})}</div>
                </div>
              </div>
            </Card>
          ))}
          {!visibleDives.length && <Card className="focus-empty"><Anchor size={28} /><h2>No matching dives</h2><p>Try a different search or filter.</p></Card>}
        </div>
      ) : (
        <Card className="focus-empty">
          <Anchor size={32} />
          <h2>No dives logged yet</h2>
          <p>Start manually or import Oceanic+, PADI files and screenshots.</p>
          <button className="focus-primary" onClick={openLog}>
            Log first dive
          </button>
        </Card>
      )}
      {viewing && (
        <DiveRecordDetail
          key={viewing.entityId}
          dive={viewing}
          initialView={initialDiveView}
          title={viewing.site}
          eyebrow={`${viewing.source} dive`}
          ownerKind="dive"
          ownerId={viewing.entityId}
          close={() => { setViewing(null); refresh(); }}
          edit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
          remove={() => void remove(viewing)}
          rows={[
            ['Dive number', viewing.diveNumber ? `#${viewing.diveNumber}` : 'Not recorded'],
            ['Mode', viewing.diveMode === 'technical-training' ? 'Technical training' : viewing.diveMode === 'recreational-training' ? 'Recreational training' : viewing.isTechnicalDive || viewing.diveMode === 'technical' ? 'Technical' : 'Recreational'],
            ['Date', viewing.date],
            ['Time in / out', [viewing.timeIn, viewing.timeOut].filter(Boolean).join(' – ') || 'Not recorded'],
            ['Site location', [viewing.region, viewing.country].filter(Boolean).join(', ') || 'Not recorded'],
            ['GPS', viewing.latitude != null && viewing.longitude != null ? `${viewing.latitude}, ${viewing.longitude}` : 'Not recorded'],
            ['Operator / vessel', [viewing.operator, viewing.vessel].filter(Boolean).join(' · ') || 'Not recorded'],
            ['Dive type', viewing.diveTypes?.join(', ') || 'Not recorded'],
            [
              'Maximum depth',
              viewing.maxDepthM != null
                ? `${viewing.maxDepthM} m`
                : 'Not recorded',
            ],
            [
              'Bottom time',
              viewing.bottomTimeMin != null
                ? `${viewing.bottomTimeMin} min`
                : 'Not recorded',
            ],
            ['Average depth', viewing.averageDepthM != null ? `${viewing.averageDepthM} m` : 'Not recorded'],
            ['Total runtime', viewing.totalElapsedMin != null ? `${viewing.totalElapsedMin} min` : 'Not recorded'],
            ['Surface interval', viewing.surfaceIntervalMin != null ? `${viewing.surfaceIntervalMin} min` : 'Not recorded'],
            ['Pressure groups', [viewing.prePressureGroup && `Pre ${viewing.prePressureGroup}`, viewing.postPressureGroup && `Post ${viewing.postPressureGroup}`, viewing.pressureGroupMode, viewing.pressureGroupValidation?.replaceAll('_', ' ')].filter(Boolean).join(' · ') || 'Not recorded'],
            ['Gas', viewing.gas],
            ['Cylinders', viewing.cylinders?.map((cylinder) => `${cylinder.name}: ${cylinder.gasType}${cylinder.oxygenPercent != null ? ` ${cylinder.oxygenPercent}% O₂` : ''}, ${cylinder.startPressureBar ?? '—'}→${cylinder.endPressureBar ?? '—'} bar`).join('\n') || 'Not recorded'],
            ['Environment', [viewing.waterType, viewing.weather, viewing.visibilityM != null ? `${viewing.visibilityM} m visibility` : '', viewing.currentStrength ? `${viewing.currentStrength} current` : ''].filter(Boolean).join(' · ') || 'Not recorded'],
            ['Weather data source', [viewing.weatherProvider,viewing.weatherResolution,viewing.weatherAttribution].filter(Boolean).join(' · ')],
            ['SAC / RMV',viewing.cylinders?.map(c=>`${c.name || 'Cylinder'}: ${c.sacPressureBarMin ?? '—'} bar/min SAC · ${c.rmvRate ?? '—'} L/min RMV`).join('; ')],
            ['Temperatures', [viewing.airTemperatureC != null ? `${viewing.airTemperatureC}°C air` : '', viewing.surfaceTemperatureC != null ? `${viewing.surfaceTemperatureC}°C surface` : '', viewing.minimumTemperatureC != null ? `${viewing.minimumTemperatureC}°C minimum` : ''].filter(Boolean).join(' · ') || 'Not recorded'],
            ['Decompression', viewing.isTechnicalDive || viewing.diveMode === 'technical' || viewing.diveMode === 'technical-training' ? [viewing.decoAlgorithm, viewing.gradientFactorLow != null && viewing.gradientFactorHigh != null ? `GF ${viewing.gradientFactorLow}/${viewing.gradientFactorHigh}` : '', `${viewing.decoStops?.length ?? 0} staged stops`].filter(Boolean).join(' · ') : viewing.safetyStopExecuted ? `${viewing.safetyStopDurationMin ?? '—'} min at ${viewing.safetyStopDepthM ?? '—'} m safety stop` : 'No technical decompression recorded'],
            [
              'Equipment used',
              viewing.hireGear
                ? `Hired gear${viewing.equipmentIds?.length ? ' plus selected owned equipment' : ' only'}`
                : viewing.equipmentIds?.length
                  ? viewing.equipmentIds
                      .map(
                        (id) =>
                          equipment.find((item) => item.entityId === id)?.name,
                      )
                      .filter(Boolean)
                      .join(', ')
                  : 'Automatic fallback: all equipment owned on this dive date',
            ],
            ['Dive team', (viewing.diveTeamIds ?? viewing.buddyIds)?.map((id) => id === 'self' ? 'Me' : people.find((person) => person.entityId === id)?.name).filter(Boolean).join(', ') || 'Not recorded'],
            ['Buddies', viewing.buddyIds?.map((id) => people.find((person) => person.entityId === id)?.name).filter(Boolean).join(', ') || 'Not recorded'],
            ['Dive leader', viewing.diveLeaderId === 'self' ? 'Me' : people.find((person) => person.entityId === viewing.diveLeaderId)?.name || 'Not recorded'],
            ['Cumulative time', viewing.currentTotalTimeMin != null ? `${viewing.preDiveTotalTimeMin ?? 0} min before · ${viewing.currentTotalTimeMin} min after` : 'Not recorded'],
            ['Equipment notes', viewing.equipmentNotes || 'Not recorded'],
            ['Weighting', viewing.ballastKg != null ? `${viewing.ballastKg} kg total${viewing.weightDistribution ? ` · ${viewing.weightDistribution}` : ''}${viewing.trimAssessment ? ` · ${viewing.trimAssessment}` : ''}` : 'Not recorded'],
            ['Aquatic life', viewing.aquaticLife?.join(', ') || 'Not recorded'],
            ['Sightings notes', viewing.aquaticLifeNotes || 'Not recorded'],
            ['Personal reflections', viewing.personalNotes || 'Not recorded'],
            ['Notes', viewing.notes],
          ]}
        />
      )}{' '}
      {editing && (
        <DiveModal
          item={editing}
          close={() => setEditing(null)}
          saved={refresh}
        />
      )}
    </>
  );
}

function Equipment() {
  const [items, setItems] = useState<Array<Stored<EquipmentRecord>>>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>(
    [],
  );
  const [sets, setSets] = useState<Array<Stored<EquipmentSetRecord>>>([]);
  const [catalogOptions, setCatalogOptions] = useState<
    Array<Stored<CatalogOptionRecord>>
  >([]);
  const [editing, setEditing] = useState<Stored<EquipmentRecord> | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Stored<EquipmentRecord> | null>(null);
  const refresh = useCallback(() => {
    void Promise.all([
      listEquipment(),
      listDives(),
      listEquipmentSets(),
      listCatalogOptions(),
    ]).then(
      ([nextItems, nextDives, nextSets, nextCatalogOptions]) => {
        setItems(nextItems);
        setDives(nextDives);
        setSets(nextSets);
        setCatalogOptions(nextCatalogOptions);
        setViewing(current => current ? nextItems.find(item => item.entityId === current.entityId) ?? current : null);
      },
    );
  }, []);
  useRecordRefresh(refresh);
  const equipmentItems = useMemo(() => items.filter((item) => !isCylinderEquipment(item)), [items]);
  async function remove(item: Stored<EquipmentRecord>) {
    if (
      !window.confirm(`Delete ${item.name}? Its history remains recoverable.`)
    )
      return;
    await deleteEquipment(item.entityId);
    refresh();
  }
  const visibleItems = equipmentItems
    .filter((item) => {
      const term = search.trim().toLowerCase();
      const textMatch = !term || [item.name, item.category, item.manufacturer, item.model, item.serialNumber].join(' ').toLowerCase().includes(term);
      const service = equipmentServiceStatus(item, dives).state;
      const statusMatch = statusFilter === 'all'
        || (statusFilter === 'retired' ? item.retired : statusFilter === 'current' ? !item.retired : service === statusFilter);
      return textMatch && statusMatch;
    })
    .sort((a, b) => {
      if (sort === 'manufacturer') return `${a.manufacturer} ${a.name}`.localeCompare(`${b.manufacturer} ${b.name}`);
      if (sort === 'service') return (equipmentServiceStatus(a, dives).dateDue || '9999').localeCompare(equipmentServiceStatus(b, dives).dateDue || '9999');
      if (sort === 'dives') return equipmentDiveCount(b, dives) - equipmentDiveCount(a, dives);
      return a.name.localeCompare(b.name);
    });
  return (
    <>
      <Heading
        eyebrow="SERVICE · OWNERSHIP · HISTORY"
        title="Equipment"
        copy="Track non-cylinder kit, actual use per dive, saved loadouts and whichever service limit comes first. Cylinders are managed in Cylinders & Gas."
        action={
          <button
            className="focus-primary"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus size={16} /> Add equipment
          </button>
        }
      />
      <ListToolbar search={search} setSearch={setSearch} filter={statusFilter} setFilter={setStatusFilter} filterLabel="Status" filterOptions={[[ 'all', 'All equipment' ], [ 'current', 'Current' ], [ 'due', 'Due soon' ], [ 'overdue', 'Overdue' ], [ 'retired', 'Retired' ]]} sort={sort} setSort={setSort} sortOptions={[[ 'name', 'Name' ], [ 'manufacturer', 'Manufacturer' ], [ 'service', 'Next service' ], [ 'dives', 'Most dives' ]]} />
      {adding && (
        <RevealOnMount><EquipmentForm
            item={editing}
            dives={dives}
            close={() => {
              setAdding(false);
              setEditing(null);
            }}
            saved={refresh}
          /></RevealOnMount>
      )}
      <div className="record-summary">
        <span>
          <strong>{equipmentItems.length}</strong> items
        </span>
        <span>
          <strong>
            {
              equipmentItems.filter(
                (item) =>
                  equipmentServiceStatus(item, dives).state === 'overdue',
              ).length
            }
          </strong>{' '}
          overdue
        </span>
        <span>
          <strong>
            {
              equipmentItems.filter(
                (item) => equipmentServiceStatus(item, dives).state === 'due',
              ).length
            }
          </strong>{' '}
          due soon
        </span>
      </div>
      {equipmentItems.length ? (
        <div className="focus-grid">
          {visibleItems.map((item) => {
            const service = equipmentServiceStatus(item, dives);
            const state = service.state;
            return (
              <Card key={item.entityId} className="clickable-card">
                <button
                  className="card-hit"
                  onClick={() => setViewing(item)}
                  aria-label={`View ${item.name}`}
                />
                <div className="focus-card-head">
                  <div className="equipment-icon">
                    <img
                      src={equipmentIconSource(item.category, catalogOptions)}
                      alt=""
                      aria-hidden="true"
                    />
                  </div>
                  <div className="record-actions">
                    <button
                      onClick={() => {
                        setEditing(item);
                        setAdding(true);
                      }}
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => void remove(item)}
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <span className="focus-eyebrow">
                  {item.category || 'EQUIPMENT'}
                </span>
                <h3>{item.name}</h3>
                <p className="focus-copy">
                  {[
                    item.manufacturer,
                    item.model,
                    item.serialNumber && `S/N ${item.serialNumber}`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No make or model recorded'}
                </p>
                <p className="record-date">
                  Next service:{' '}
                  {service.dateDue
                    ? new Date(
                        `${service.dateDue}T12:00:00`,
                      ).toLocaleDateString()
                    : 'Not set'}
                </p>
                <p className="record-date">
                  {service.uses} tracked uses
                  {service.dueAt != null
                    ? ` · service at ${service.dueAt}`
                    : ''}
                </p>
                <div className="recent-usage"><b>Dates last used:</b>{equipmentRecentDates(item, dives).length ? equipmentRecentDates(item, dives).map(date => <time key={date} dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString()}</time>) : <span>No recorded use</span>}</div>
                <span
                  className={`focus-badge ${state !== 'current' ? 'warn' : ''}`}
                >
                  {item.retired
                    ? 'RETIRED'
                    : state === 'overdue'
                      ? 'OVERDUE'
                      : state === 'due'
                        ? 'DUE SOON'
                        : 'CURRENT'}
                </span>
              </Card>
            );
          })}
          {!visibleItems.length && <Card className="focus-empty"><Wrench size={28} /><h2>No matching equipment</h2><p>Try a different search or filter.</p></Card>}
        </div>
      ) : (
        <Card className="focus-empty">
          <Wrench size={32} />
          <h2>No equipment added</h2>
          <p>
            Add regulators, BCDs, computers and exposure protection. Add cylinders in Cylinders &amp; Gas.
          </p>
          <button className="focus-primary" onClick={() => setAdding(true)}>
            Add first item
          </button>
        </Card>
      )}
      {viewing && (
        <RecordDetail
          title={viewing.name}
          eyebrow={viewing.category || 'Equipment'}
          ownerKind="equipment"
          ownerId={viewing.entityId}
          close={() => setViewing(null)}
          edit={() => {
            setEditing(viewing);
            setViewing(null);
            setAdding(true);
          }}
          rows={[
            ['Manufacturer', viewing.manufacturer],
            ['Model', viewing.model],
            ['Serial number', viewing.serialNumber],
            ['Purchased', viewing.purchasedAt],
            ['Last service', viewing.lastServiceAt || (viewing.purchasedAt ? 'Not serviced yet — purchase date used as baseline' : '')],
            [
              'Calendar interval',
              viewing.serviceIntervalMonths
                ? `${viewing.serviceIntervalMonths} months`
                : '',
            ],
            [
              'Dive interval',
              viewing.serviceIntervalDives
                ? `${viewing.serviceIntervalDives} uses (due at ${equipmentServiceStatus(viewing, dives).dueAt}; ${equipmentServiceStatus(viewing, dives).remaining} remaining)`
                : '',
            ],
            ['Next service', equipmentServiceStatus(viewing, dives).dateDue],
            ['Notes', viewing.notes],
          ]}
        >
          <EquipmentMaintenanceLog equipment={viewing} onEquipmentChanged={refresh} />
        </RecordDetail>
      )}
      <EquipmentSets items={equipmentItems} sets={sets} saved={refresh} />
    </>
  );
}

function EquipmentForm({
  item,
  dives,
  close,
  saved,
}: {
  item: Stored<EquipmentRecord> | null;
  dives: Array<DiveRecord & { entityId: string }>;
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [manufacturer, setManufacturer] = useState(item?.manufacturer ?? '');
  const [model, setModel] = useState(item?.model ?? '');
  const [serial, setSerial] = useState(item?.serialNumber ?? '');
  const [purchased, setPurchased] = useState(item?.purchasedAt ?? '');
  const [lastService, setLastService] = useState(item?.lastServiceAt ?? '');
  const [nextService, setNextService] = useState(item?.nextServiceAt ?? '');
  const [serviceRequired, setServiceRequired] = useState(item?.serviceRequired ?? true);
  const [intervalMonths, setIntervalMonths] = useState(
    item?.serviceIntervalMonths?.toString() ?? '24',
  );
  const [intervalDives, setIntervalDives] = useState(
    item?.serviceIntervalDives?.toString() ?? '',
  );
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [retired, setRetired] = useState(item?.retired ?? false);
  const [busy, setBusy] = useState(false);
  const [customOptions, setCustomOptions] = useState<
    Array<Stored<CatalogOptionRecord>>
  >([]);
  useEffect(() => {
    void listCatalogOptions().then(setCustomOptions);
  }, []);
  const categories = [
    ...new Set([
      ...DEFAULT_GEAR_CATEGORIES,
      ...customOptions
        .filter((option) => option.group === 'category')
        .map((option) => option.value),
      ...(category ? [category] : []),
    ]),
  ].filter((value) => !/\b(cylinder|tank)\b/i.test(value)).sort();
  const manufacturers = [
    ...new Set([
      ...DEFAULT_GEAR_MANUFACTURERS,
      ...customOptions
        .filter((option) => option.group === 'manufacturer')
        .map((option) => option.value),
      ...(manufacturer ? [manufacturer] : []),
    ]),
  ].sort();
  const serviceBaseline = lastService || purchased;
  const automaticDivesAtService =
    item && serviceBaseline ? equipmentDiveCount(item, dives, serviceBaseline) : 0;
  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    const calculated =
      serviceRequired && serviceBaseline && intervalMonths
        ? addMonths(serviceBaseline, Number(intervalMonths))
        : serviceRequired ? nextService : '';
    await saveEquipment({
      ...(item ? { entityId: item.entityId } : {}),
      name: name.trim(),
      category: category.trim() || 'Equipment',
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      serialNumber: serial.trim(),
      purchasedAt: purchased,
      lastServiceAt: lastService,
      nextServiceAt: calculated,
      serviceRequired,
      serviceIntervalMonths: serviceRequired && intervalMonths ? Number(intervalMonths) : null,
      serviceIntervalDives: serviceRequired && intervalDives ? Number(intervalDives) : null,
      divesAtLastService: serviceRequired && intervalDives ? automaticDivesAtService : null,
      notes: notes.trim(),
      retired,
    });
    saved();
    close();
  }
  return (
    <Card className="record-form">
      <div className="record-form-head">
        <div>
          <span className="focus-eyebrow">
            {item ? 'EDIT EQUIPMENT' : 'NEW EQUIPMENT'}
          </span>
          <h3>{item ? 'Update item' : 'Track a new item'}</h3>
        </div>
        <button className="focus-icon" aria-label="Close editor" onClick={close}>
          <X size={17} />
        </button>
      </div>
      <div className={`record-fields equipment-form-fields ${equipmentEditorStyles.fields}`}>
        <div className="record-wide"><h3>Identity & item details</h3></div>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Primary regulator"
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Choose category</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Manufacturer
          <select
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          >
            <option value="">Choose manufacturer</option>
            {manufacturers.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </label>
        <label>
          Serial number
          <input value={serial} onChange={(e) => setSerial(e.target.value)} />
        </label>
        <label>
          Purchased
          <input
            type="date"
            value={purchased}
            onChange={(e) => setPurchased(e.target.value)}
          />
        </label>
        <div className="record-wide"><h3>Servicing</h3></div>
        <label className={`record-check record-wide equipment-toggle ${equipmentEditorStyles.toggle}`}>
          <input type="checkbox" checked={serviceRequired} onChange={(e) => setServiceRequired(e.target.checked)} />
          <span>This item requires scheduled servicing</span>
        </label>
        {serviceRequired && <>
        <label>
          Last service
          <input
            type="date"
            value={lastService}
            onChange={(e) => setLastService(e.target.value)}
          />
        </label>
        <label>
          Service interval (months)
          <input
            type="number"
            min="0"
            value={intervalMonths}
            onChange={(e) => setIntervalMonths(e.target.value)}
          />
        </label>
        <label>
          Service interval (dives)
          <input
            type="number"
            min="0"
            value={intervalDives}
            onChange={(e) => setIntervalDives(e.target.value)}
          />
        </label>
        <div className="service-preview">
          <strong>{automaticDivesAtService}</strong> equipment uses found
          through the {lastService ? 'last service' : purchased ? 'purchase' : 'baseline'} date. This is calculated from the logbook.
        </div>
        <p className="service-preview">
          Due{' '}
          {serviceBaseline && intervalMonths
            ? addMonths(serviceBaseline, Number(intervalMonths))
            : 'when calendar interval is reached'}
          {intervalDives &&
            ` or after equipment use ${automaticDivesAtService + Number(intervalDives)}`}{' '}
          — whichever comes first.
        </p>
        </>}
        <div className="record-wide"><h3>Status</h3></div>
        <label className={`record-check record-wide equipment-toggle ${equipmentEditorStyles.toggle}`}>
          <input
            type="checkbox"
            checked={retired}
            onChange={(e) => setRetired(e.target.checked)}
          />{' '}
          <span>Retired / no longer in use</span>
        </label>
        <div className="record-wide"><h3>Notes</h3></div>
        <label className="record-wide">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <footer>
        <button className="focus-secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="focus-primary"
          disabled={!name.trim() || busy}
          onClick={() => void submit()}
        >
          {busy ? 'Saving…' : 'Save equipment'}
        </button>
      </footer>
    </Card>
  );
}

function EquipmentSets({
  items,
  sets,
  saved,
}: {
  items: Array<Stored<EquipmentRecord>>;
  sets: Array<Stored<EquipmentSetRecord>>;
  saved: () => void;
}) {
  const [editing, setEditing] = useState<Stored<EquipmentSetRecord> | null>(
    null,
  );
  const [composing, setComposing] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [icon, setIcon] = useState<File | null>(null);
  function begin(set?: Stored<EquipmentSetRecord>) {
    setComposing(true);
    setEditing(set ?? null);
    setName(set?.name ?? '');
    setSelected(set?.equipmentIds ?? []);
    setIcon(null);
  }
  async function submit() {
    if (!name.trim() || !selected.length) return;
    let iconMediaId = editing?.iconMediaId ?? '';
    if (icon) {
      const form = new FormData();
      form.append('file', icon); form.append('ownerKind', 'equipment-set-icon'); form.append('ownerId', editing?.entityId ?? crypto.randomUUID()); form.append('caption', `${name.trim()} equipment set icon`);
      const response = await fetch('/api/media', { method: 'POST', body: form });
      if (!response.ok) return;
      const uploaded = await response.json() as { id: string };
      if (iconMediaId) await fetch(`/api/media?id=${encodeURIComponent(iconMediaId)}`, { method: 'DELETE' });
      iconMediaId = uploaded.id;
    }
    await saveEquipmentSet({
      ...(editing ? { entityId: editing.entityId } : {}),
      name: name.trim(),
      equipmentIds: selected,
      notes: '',
      iconMediaId,
    });
    setEditing(null);
    setComposing(false);
    setName('');
    setSelected([]);
    setIcon(null);
    saved();
  }
  async function remove(set: Stored<EquipmentSetRecord>) {
    if (!confirm(`Delete the equipment set ${set.name}?`)) return;
    await deleteEquipmentSet(set.entityId);
    if (set.iconMediaId) await fetch(`/api/media?id=${encodeURIComponent(set.iconMediaId)}`, { method: 'DELETE' });
    saved();
  }
  return (
    <Card className="equipment-sets">
      <div className="focus-card-head">
        <div>
          <span className="focus-eyebrow">REUSABLE LOADOUTS</span>
          <h3>Equipment sets</h3>
          <p className="focus-copy">
            Save complete regulator, cold-water, travel or training kits and
            apply one to a dive.
          </p>
        </div>
        <button className="focus-secondary" onClick={() => begin()}>
          <Plus size={15} /> New set
        </button>
      </div>
      {sets.map((set) => (
        <div className="focus-row" key={set.entityId}>
          {set.iconMediaId ? <img className="equipment-set-icon" src={`/api/media?id=${encodeURIComponent(set.iconMediaId)}`} alt="" /> : <Wrench size={16} />}
          <div>
            <strong>{set.name}</strong>
            <span>
              {set.equipmentIds
                .map((id) => items.find((item) => item.entityId === id)?.name)
                .filter(Boolean)
                .join(', ') || 'No matching equipment'}
            </span>
          </div>
          <div className="record-actions">
            <button onClick={() => begin(set)} aria-label={`Edit ${set.name}`}>
              <Pencil size={15} />
            </button>
            <button
              onClick={() => void remove(set)}
              aria-label={`Delete ${set.name}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
      {composing && (
        <div className="kit-set-form">
          <label>
            Set name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cold-water twinset"
            />
          </label>
          <label>
            Set icon (optional)
            <span className="file-field"><ImagePlus size={16}/>{icon?.name || (editing?.iconMediaId ? 'Replace current icon' : 'Choose image')}<input type="file" accept="image/*" onChange={(event) => setIcon(event.target.files?.[0] ?? null)} /></span>
          </label>
          <div className="equipment-picker">
            {items
              .filter((item) => !item.retired)
              .map((item) => (
                <label key={item.entityId}>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.entityId)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, item.entityId]
                          : current.filter((id) => id !== item.entityId),
                      )
                    }
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {[item.manufacturer, item.model]
                        .filter(Boolean)
                        .join(' ')}
                    </small>
                  </span>
                </label>
              ))}
          </div>
          <div className="record-actions">
            <button
              className="focus-secondary"
              onClick={() => {
                setEditing(null);
                setComposing(false);
                setName('');
                setSelected([]);
              }}
            >
              Cancel
            </button>
            <button
              className="focus-primary"
              disabled={!name.trim() || !selected.length}
              onClick={() => void submit()}
            >
              Save set
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Sites() {
  const [items, setItems] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [editing, setEditing] = useState<Stored<DiveSiteRecord> | null>(null);
  const [adding, setAdding] = useState(false);
  const refresh = useCallback(() => {
    void listDiveSites().then(setItems);
  }, []);
  useRecordRefresh(refresh);
  async function remove(item: Stored<DiveSiteRecord>) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    await deleteDiveSite(item.entityId);
    refresh();
  }
  return (
    <>
      <Heading
        eyebrow="PRIVATE SITE LIBRARY"
        title="Dive sites"
        copy="Add and edit access notes, hazards, depth and your own observations."
        action={
          <button
            className="focus-primary"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus size={16} /> Add site
          </button>
        }
      />
      {adding && (
        <SiteForm
          item={editing}
          close={() => {
            setAdding(false);
            setEditing(null);
          }}
          saved={refresh}
        />
      )}{' '}
      {items.length ? (
        <div className="focus-grid">
          {items.map((item) => (
            <Card key={item.entityId}>
              <div className="focus-card-head">
                <MapPin className="focus-accent" />
                <div className="record-actions">
                  <button
                    onClick={() => {
                      setEditing(item);
                      setAdding(true);
                    }}
                    aria-label={`Edit ${item.name}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => void remove(item)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <h3>{item.name}</h3>
              <p className="focus-copy">
                {item.location || 'Location not recorded'}
                {item.maxDepthM != null ? ` · ${item.maxDepthM}m max` : ''}
              </p>
              <p className="record-date">
                {item.access || 'Access notes not recorded'}
              </p>
              {item.hazards && (
                <span className="focus-badge warn">HAZARDS RECORDED</span>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="focus-empty">
          <Compass size={32} />
          <h2>No dive sites yet</h2>
          <p>Add entry points, parking, depth, access and hazards.</p>
          <button className="focus-primary" onClick={() => setAdding(true)}>
            Add first site
          </button>
        </Card>
      )}
    </>
  );
}
function SiteForm({
  item,
  close,
  saved,
}: {
  item: Stored<DiveSiteRecord> | null;
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [location, setLocation] = useState(item?.location ?? '');
  const [access, setAccess] = useState(item?.access ?? '');
  const [depth, setDepth] = useState(item?.maxDepthM?.toString() ?? '');
  const [hazards, setHazards] = useState(item?.hazards ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  async function submit() {
    if (!name.trim()) return;
    await saveDiveSite({
      ...(item ? { entityId: item.entityId } : {}),
      name: name.trim(),
      location: location.trim(),
      access: access.trim(),
      maxDepthM: depth ? Number(depth) : null,
      hazards: hazards.trim(),
      notes: notes.trim(),
    });
    saved();
    close();
  }
  return (
    <Card className="record-form">
      <div className="record-form-head">
        <div>
          <span className="focus-eyebrow">
            {item ? 'EDIT SITE' : 'NEW SITE'}
          </span>
          <h3>{item ? 'Update dive site' : 'Add dive site'}</h3>
        </div>
        <button className="focus-icon" aria-label="Close editor" onClick={close}>
          <X size={17} />
        </button>
      </div>
      <div className="record-fields">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>
        <label>
          Maximum depth (m)
          <input
            type="number"
            min="0"
            step="0.1"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
          />
        </label>
        <label>
          Access notes
          <input value={access} onChange={(e) => setAccess(e.target.value)} />
        </label>
        <label className="record-wide">
          Hazards
          <textarea
            value={hazards}
            onChange={(e) => setHazards(e.target.value)}
          />
        </label>
        <label className="record-wide">
          Personal notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <footer>
        <button className="focus-secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="focus-primary"
          disabled={!name.trim()}
          onClick={() => void submit()}
        >
          Save site
        </button>
      </footer>
    </Card>
  );
}

function PlanningCentre({ convertToDive,initialTab }: { initialTab:string;convertToDive: (draft: Partial<DiveRecord>) => void }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(()=>setTab(initialTab),[initialTab]);
  return <><div className="section-tabs" role="tablist" aria-label="Dive planning">{['Plans','Bucket list'].map(name => <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div><div role="tabpanel">{tab === 'Plans' ? <Trips convertToDive={convertToDive} /> : <DiveBucketList />}</div></>;
}

function Trips({ convertToDive }: { convertToDive: (draft: Partial<DiveRecord>) => void }) {
  const [sites,setSites]=useState<Array<Stored<DiveSiteRecord>>>([]);
  const [people,setPeople]=useState<Array<Stored<PersonRecord>>>([]);
  const [items, setItems] = useState<Array<Stored<DiveTripRecord>>>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('soonest');
  const [editing, setEditing] = useState<Stored<DiveTripRecord> | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Stored<DiveTripRecord> | null>(null);
  const openedPlanLink = useRef(false);
  useEffect(() => {
    if (openedPlanLink.current) return;
    if (new URLSearchParams(window.location.search).get('newPlan') === 'technical') { openedPlanLink.current = true;setAdding(true);return; }
    const id = new URLSearchParams(window.location.search).get('planId');
    if (!id) { openedPlanLink.current = true; return; }
    const plan = items.find(candidate => candidate.entityId === id);
    if (plan) { openedPlanLink.current = true; setViewing(plan); }
  }, [items]);
  const refresh = useCallback(() => {
    void Promise.all([listDiveTrips(),listDiveSites(),listPeople()]).then(([trips,sites,people])=>{setItems(trips);setSites(sites);setPeople(people);});
  }, []);
  useRecordRefresh(refresh);
  async function remove(item: Stored<DiveTripRecord>) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    await deleteDiveTrip(item.entityId);
    refresh();
  }
  const visibleItems = items
    .filter((item) => {
      const term = search.trim().toLowerCase();
      const textMatch = !term || [item.name, item.siteName, item.buddy, item.notes, item.planType].join(' ').toLowerCase().includes(term);
      return textMatch && (statusFilter === 'all' || item.status === statusFilter);
    })
    .sort((a, b) => {
      if (sort === 'latest') return (b.startAt || b.startDate || '').localeCompare(a.startAt || a.startDate || '');
      if (sort === 'name') return a.name.localeCompare(b.name);
      return (a.startAt || a.startDate || '9999').localeCompare(b.startAt || b.startDate || '9999');
    });
  return (
    <>
      <Heading
        eyebrow="PLAN · PACK · REMEMBER"
        title="Dive plans"
        copy="Plan anything from a one-day course or club meet to a three-week holiday or DMT internship."
        action={
          <button
            className="focus-primary"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus size={16} /> Add plan
          </button>
        }
      />
      <ListToolbar search={search} setSearch={setSearch} filter={statusFilter} setFilter={setStatusFilter} filterLabel="Status" filterOptions={[[ 'all', 'All plans' ], [ 'planned', 'Planned' ], [ 'confirmed', 'Confirmed' ], [ 'completed', 'Completed' ]]} sort={sort} setSort={setSort} sortOptions={[[ 'soonest', 'Soonest first' ], [ 'latest', 'Latest first' ], [ 'name', 'Name' ]]} />
      {adding && (
        <RevealOnMount>
          <TripForm
            item={editing}
            close={() => {
              setAdding(false);
              setEditing(null);
            }}
            saved={refresh}
          />
        </RevealOnMount>
      )}
      <div className="import-grid">
        {visibleItems.map((item) => (
          <Card className="trip-card clickable-card" key={item.entityId}>
            <button
              className="card-hit"
              onClick={() => setViewing(item)}
              aria-label={`View ${item.name}`}
            />
            <ShipWheel size={30} />
            <div>
              <span className="focus-eyebrow">{item.status.toUpperCase()}</span>
              <h2>{item.name}</h2>
              <p>
                {item.startAt || item.startDate
                  ? new Date(
                      item.startAt || `${item.startDate}T12:00:00`,
                    ).toLocaleString()
                  : 'Date not set'}
                {item.siteName ? ` · ${item.siteName}` : ''}
                {item.buddy ? ` · with ${item.buddy}` : ''}
              </p>
            </div>
            <div className="record-actions">
              <button
                onClick={() => {
                  if (!window.confirm(`Create a new log entry from ${item.name}? You will review it before anything is saved.`)) return;
                  void diveOperation(`plan-draft:${item.entityId}`, 'Preparing Dive from Plan…', async () => convertToDive(await createDiveDraftFromPlan(item.entityId))).catch(() => {});
                }}
                aria-label={`Create dive log from ${item.name}`}
                title="Create a draft dive log"
              >
                <BookOpen size={15} />
              </button>
              <button
                onClick={() => {
                  setEditing(item);
                  setAdding(true);
                }}
                aria-label={`Edit ${item.name}`}
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => void remove(item)}
                aria-label={`Delete ${item.name}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </Card>
        ))}
        {items.length > 0 && !visibleItems.length && <Card className="focus-empty"><ShipWheel size={28} /><h2>No matching plans</h2><p>Try a different search or filter.</p></Card>}
        {!items.length && (
          <Card className="focus-empty">
            <ShipWheel size={32} />
            <h2>No trips planned</h2>
            <p>
              Add a day dive, weekend or holiday and update it as plans firm up.
            </p>
            <button className="focus-primary" onClick={() => setAdding(true)}>
              Plan first trip
            </button>
          </Card>
        )}
      </div>
      {viewing && (
        <RecordDetail
          title={viewing.name}
          eyebrow={`${viewing.planType ?? 'dive plan'} · ${viewing.status}`}
          ownerKind="trip"
          ownerId={viewing.entityId}
          close={() => setViewing(null)}
          edit={() => {
            setEditing(viewing);
            setViewing(null);
            setAdding(true);
          }}
          rows={[
            ['Starts', viewing.startAt || viewing.startDate],
            ['Ends', viewing.endAt || viewing.endDate],
            ['Site', viewing.siteId ? '' : viewing.siteName],
            ['People', viewing.buddy],
            ['Notes', viewing.notes],
          ]}
        >
          {sites.filter(site=>site.entityId===viewing.siteId).map(site=><SiteOverheadSection key={site.entityId} site={site} readOnly summaryOnly/>)}
          <details className="plan-more"><summary>More… {sites.find(site=>site.entityId===viewing.siteId)?.name || viewing.siteName || 'site'}, people and notes</summary>{sites.filter(site=>site.entityId===viewing.siteId).map(site=><section key={site.entityId}><h3>{site.name}</h3><p>{[site.address,site.location,site.postcode,site.country].filter(Boolean).join(', ')}</p><div className="detail-grid"><SiteDetail label="Access" value={site.access}/><SiteDetail label="Entry / exit" value={site.entryExit}/><SiteDetail label="Hazards" value={site.hazards}/><SiteDetail label="Facilities" value={site.amenities}/></div>{site.latitude!=null&&site.longitude!=null&&<a className="focus-link" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${site.latitude},${site.longitude}`}>Open site in Google Maps</a>}</section>)}<div>{people.filter(person=>viewing.personIds?.includes(person.entityId)||viewing.buddy?.split(',').map(name=>name.trim()).includes(person.name)).map(person=><p key={person.entityId}>{person.name} · {person.role} · {person.email}</p>)}</div><p>{viewing.notes||'No additional notes recorded.'}</p></details></RecordDetail>
      )}
    </>
  );
}
function DiveSitePicker({
  sites,
  siteId,
  legacySiteName,
  onChange,
}: {
  sites: Array<Stored<DiveSiteRecord>>;
  siteId: string;
  legacySiteName: string;
  onChange: (site: Stored<DiveSiteRecord> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    sites.find((site) => site.entityId === siteId) ??
    sites.find(
      (site) =>
        site.name.trim().toLowerCase() ===
        legacySiteName.trim().toLowerCase(),
    );
  const selectedLabel = selected?.name || legacySiteName;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="focus-site-picker"
            aria-label="Choose a saved dive site"
          />
        }
      >
        <span>
          <b>{selectedLabel || 'Choose a saved dive site'}</b>
          <small>
            {selected
              ? [selected.location, selected.country].filter(Boolean).join(' · ') ||
                'Saved in Dive Sites'
              : selectedLabel
                ? 'Previously saved on this plan'
                : 'Type to search your Dive Sites'}
          </small>
        </span>
        <ChevronsUpDown size={16} />
      </PopoverTrigger>
      <PopoverContent align="start" className="site-picker-popover">
        <Command>
          <CommandInput placeholder="Search site, town, country or postcode…" />
          <CommandList>
            <CommandEmpty>
              No saved dive site matches that search.
            </CommandEmpty>
            <CommandGroup heading={`${sites.length} saved dive sites`}>
              {(selectedLabel || siteId) && (
                <CommandItem
                  value="clear no dive site"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <X size={16} />
                  <span>Clear site selection</span>
                </CommandItem>
              )}
              {sites
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((site) => (
                  <CommandItem
                    key={site.entityId}
                    value={[
                      site.name,
                      site.alternativeNames,
                      site.location,
                      site.country,
                      site.postcode,
                      site.siteType,
                      site.entityId,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onSelect={() => {
                      onChange(site);
                      setOpen(false);
                    }}
                    className="site-picker-option"
                    data-checked={site.entityId === siteId}
                  >
                    <MapPin size={16} />
                    <span>
                      <b>{site.name}</b>
                      <small>
                        {[site.location, site.country, site.siteType]
                          .filter(Boolean)
                          .join(' · ') || 'Location not recorded'}
                      </small>
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TripForm({
  item,
  close,
  saved,
}: {
  item: Stored<DiveTripRecord> | null;
  close: () => void;
  saved: () => void;
}) {
  const [technical,setTechnical] = useState<import('@/lib/offline/technical-workspace').TechnicalPlanExtension>(() => ({technicalMode:item?.technicalMode ?? new URLSearchParams(window.location.search).get('newPlan') === 'technical',maxDepthM:item?.maxDepthM ?? null,bottomTimeMin:item?.bottomTimeMin ?? null,plannedRuntimeMin:item?.plannedRuntimeMin ?? null,cylinderAssignments:item?.cylinderAssignments ?? [],decoSchedule:item?.decoSchedule ?? []}));
  const [name, setName] = useState(item?.name ?? '');
  const [start, setStart] = useState(item?.startAt ?? item?.startDate ?? '');
  const [end, setEnd] = useState(item?.endAt ?? item?.endDate ?? '');
  const [planType, setPlanType] = useState<
    NonNullable<DiveTripRecord['planType']>
  >(item?.planType ?? 'day-dive');
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  useEffect(() => {
    void listPeople().then(setPeople);
    void listDiveSites().then((savedSites) => {
      setSites(savedSites);
      if (item?.siteId || !item?.siteName) return;
      const matchingSite = savedSites.find(
        (site) =>
          site.name.trim().toLowerCase() ===
          item.siteName.trim().toLowerCase(),
      );
      if (matchingSite) setSiteId(matchingSite.entityId);
    });
  }, []);
  const [siteId, setSiteId] = useState(item?.siteId ?? '');
  const [siteName, setSiteName] = useState(item?.siteName ?? '');
  const [buddy, setBuddy] = useState(item?.buddy ?? '');
  const [status, setStatus] = useState<DiveTripRecord['status']>(
    item?.status ?? 'planned',
  );
  const [notes, setNotes] = useState(item?.notes ?? '');
  async function submit() {
    if (!name.trim()) return;
    await saveDiveTrip({
      ...technical,
      ...(item ? { entityId: item.entityId } : {}),
      name: name.trim(),
      planType,
      startDate: start.slice(0, 10),
      endDate: end.slice(0, 10),
      startAt: start,
      endAt: end,
      siteId,
      siteName: siteName.trim(),
      buddy: buddy.trim(),
      status,
      notes: notes.trim(),
    });
    saved();
    close();
  }
  return (
    <Card className="record-form">
      <div className="record-form-head">
        <div>
          <span className="focus-eyebrow">
            {item ? 'EDIT TRIP' : 'NEW TRIP'}
          </span>
          <h3>{item ? 'Update trip' : 'Plan a dive trip'}</h3>
        </div>
        <button className="focus-icon" aria-label="Close editor" onClick={close}>
          <X size={17} />
        </button>
      </div>
      <div className="record-fields">
        <label>
          Plan type
          <select
            value={planType}
            onChange={(e) =>
              setPlanType(
                e.target.value as NonNullable<DiveTripRecord['planType']>,
              )
            }
          >
            <option value="day-dive">Day dive</option>
            <option value="club-meet">Club meet</option>
            <option value="course">Training course</option>
            <option value="holiday">Dive holiday</option>
            <option value="internship">DMT internship</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as DiveTripRecord['status'])
            }
          >
            <option value="planned">Planned</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label>
          Starts
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Ends
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className="site-picker-field">
          Dive site
          <DiveSitePicker
            sites={sites}
            siteId={siteId}
            legacySiteName={siteName}
            onChange={(selectedSite) => {
              setSiteId(selectedSite?.entityId ?? '');
              setSiteName(selectedSite?.name ?? '');
            }}
          />
          {!sites.length && (
            <small className="site-picker-help">
              Add a site on the Dive Sites page first, then return here to select it.
            </small>
          )}
        </label>
        {sites.filter(site=>site.entityId===siteId).map(site=><SiteOverheadSection key={site.entityId} site={site} readOnly summaryOnly/>)}
        <label>
          Buddy
          <select value={buddy} onChange={(e) => setBuddy(e.target.value)}>
            <option value="">Choose saved person</option>
            {people.map((person) => (
              <option key={person.entityId} value={person.name}>
                {person.name} · {person.role}
              </option>
            ))}
          </select>
        </label>
        <label className="record-wide">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <TechnicalPlanFields value={technical} change={setTechnical}/>
      </div>
      <footer>
        <button className="focus-secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="focus-primary"
          disabled={!name.trim()}
          onClick={() => void submit()}
        >
          Save plan
        </button>
      </footer>
    </Card>
  );
}
function serviceState(value: string) {
  if (!value) return 'current';
  const due = new Date(`${value}T23:59:59`).getTime();
  const now = Date.now();
  if (due < now) return 'overdue';
  return due - now <= 1000 * 60 * 60 * 24 * 30 ? 'due' : 'current';
}
function addMonths(value: string, months: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLng = radians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function SiteMap({ sites, onAdd }: { sites: Array<Stored<DiveSiteRecord>>; onAdd: (latitude: number, longitude: number) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const siteSignature = sites.map((site) => `${site.entityId}:${site.latitude}:${site.longitude}:${site.name}`).join('|');
  useEffect(() => {
    let disposed = false;
    let map: any;
    async function start() {
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.dataset.leaflet = 'true';
        document.head.appendChild(link);
      }
      let leaflet = (window as any).L;
      if (!leaflet) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[data-leaflet]') as HTMLScriptElement | null;
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Map unavailable')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.dataset.leaflet = 'true';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Map unavailable'));
          document.head.appendChild(script);
        });
        leaflet = (window as any).L;
      }
      if (disposed || !mapRef.current || !leaflet) return;
      const located = sites.filter((site) => site.latitude != null && site.longitude != null).slice(0, 600);
      map = leaflet.map(mapRef.current, { scrollWheelZoom: false }).setView([54.5, -3], 5);
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
      const bounds: Array<[number, number]> = [];
      located.forEach((site) => {
        const coordinates: [number, number] = [site.latitude as number, site.longitude as number];
        bounds.push(coordinates);
        const marker = leaflet.marker(coordinates).addTo(map).bindTooltip(site.name);
        marker.on('click', () => document.getElementById(`site-card-${site.entityId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      });
      if (bounds.length) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 });
      map.on('click', (event: { latlng: { lat: number; lng: number } }) => {
        if (window.confirm('Add a new dive site at this map location?')) onAdd(event.latlng.lat, event.latlng.lng);
      });
    }
    void start().catch(() => { if (mapRef.current) mapRef.current.textContent = 'Map tiles are temporarily unavailable.'; });
    return () => { disposed = true; map?.remove(); };
  }, [siteSignature, onAdd]);
  return <Card className="site-map-card"><div className="site-map-head"><div><span className="focus-eyebrow">INTERACTIVE DIVE SITE MAP</span><h2>Explore dive sites</h2></div><small>Click a marker to find its card. Click the map to add a site.</small></div><div ref={mapRef} className="site-map" /></Card>;
}

function SiteMapPage({ go }: { go: (next: string) => void }) {
  const [bucketItems,setBucketItems]=useState<Array<Stored<BucketListRecord>>>([]);
  const [showBucket,setShowBucket]=useState(false);
  const bucketIds=useMemo(()=>new Set(showBucket?bucketItems.map(item=>item.siteId).filter((id):id is string=>Boolean(id)):[]),[showBucket,bucketItems]);
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [reliability, setReliability] = useState('hide-unconfirmed');
  const [visitFilter,setVisitFilter]=useState<'all'|'dived'|'undived'>('all');
  const [selected, setSelected] = useState<Stored<DiveSiteRecord> | null>(null);
  const [customMapUrl, setCustomMapUrl] = useState('');
  const [mapMode, setMapMode] = useState<'markers' | 'google' | 'heat'>('markers');
  const [heatDives,setHeatDives]=useState<Array<Stored<DiveRecord>>>([]);
  const heat=useMemo(()=>diveHeat(heatDives,sites),[heatDives,sites]);
  const visitedSiteIds=useMemo(()=>{const ids=new Set<string>();const byName=new Map(sites.map(site=>[site.name.trim().toLowerCase(),site.entityId]));for(const dive of heatDives){if(dive.siteId&&sites.some(site=>site.entityId===dive.siteId))ids.add(dive.siteId);else{const id=byName.get(dive.site.trim().toLowerCase());if(id)ids.add(id);}}return ids;},[heatDives,sites]);
  const [mapToolsOpen,setMapToolsOpen]=useState(false);
  const [mapOverlaySite, setMapOverlaySite] = useState<Stored<DiveSiteRecord> | null>(null);
  const selectMapMarker = useCallback((site: Stored<DiveSiteRecord>) => { setSelected(site); setMapOverlaySite(site); }, []);
  const refresh=useCallback(() => {
    void Promise.all([listDiveSites(), listDashboardSettings(), listBucketList(),listDives()]).then(([nextSites, settings, buckets,dives]) => {
      setBucketItems(buckets);setHeatDives(dives);
      setSites(nextSites);
      setCustomMapUrl(settings[0]?.customGoogleMapEmbedUrl ?? '');
    });
  }, []);
  useRecordRefresh(refresh);
  const located = useMemo(()=>sites.filter((site) => site.latitude != null && site.longitude != null).filter((site) => {
    const term = search.trim().toLowerCase();
    const textMatch = !term || [site.name, site.location, site.sourceName].join(' ').toLowerCase().includes(term);
    const broadType = ['lake','quarry','river','pool','inland'].includes(site.siteType ?? '') ? 'inland' : site.siteType ?? 'other';
    const typeMatch = typeFilter === 'all' || broadType === typeFilter;
    const unconfirmed = site.unconfirmed === true || (site.sourceName === 'DiveMap' && site.positionConfidence != null && site.positionConfidence < 0.5);
    const reliabilityMatch = reliability === 'all' || (reliability === 'unconfirmed' ? unconfirmed : !unconfirmed);
    const visited=visitedSiteIds.has(site.entityId);
    const visitMatch=visitFilter==='all'||(visitFilter==='dived'?visited:!visited);
    return (textMatch && typeMatch && reliabilityMatch && visitMatch) || (bucketIds.has(site.entityId) && visitMatch);
  }),[sites,search,typeFilter,reliability,visitFilter,visitedSiteIds,bucketIds]);
  useEffect(() => {
    if (!selected || !located.some((site) => site.entityId === selected.entityId)) setSelected(located[0] ?? null);
  }, [located.map((site) => site.entityId).join('|')]);
  useEffect(() => {
    if (!mapOverlaySite) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMapOverlaySite(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mapOverlaySite]);
  const customGoogleMap = (() => {
    const value = externalUrl(customMapUrl);
    if (!value) return '';
    try { return normaliseMyMaps(value); } catch { return ''; }
  })();
  const mapUrl = customGoogleMap || (selected ? `https://www.google.com/maps?q=${selected.latitude},${selected.longitude}&z=12&output=embed` : 'https://www.google.com/maps?q=United+Kingdom&z=5&output=embed');
  function exportKml() {
    const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const placemarks = located.map((site) => `<Placemark><name>${escape(site.name)}</name><description>${escape([site.location, site.maxDepthM != null ? `${site.maxDepthM}m maximum` : ''].filter(Boolean).join(' · '))}</description><Point><coordinates>${site.longitude},${site.latitude},0</coordinates></Point></Placemark>`).join('');
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>ZeusTek dive sites</name>${placemarks}</Document></kml>`], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'zeustek-dive-sites.kml'; anchor.click(); URL.revokeObjectURL(url);
  }
  return <div className="dive-site-map-page">
    <Heading eyebrow="DIVE SITE MAP" title="Dive site map" copy="" action={<button className="focus-secondary" aria-expanded={mapToolsOpen} onClick={()=>setMapToolsOpen(!mapToolsOpen)}><Settings2 size={16}/>Map tools<ChevronDown size={16}/></button>}/>
    <div className="map-tools-panel" hidden={!mapToolsOpen}><div className="record-actions"><button className="focus-secondary" onClick={exportKml}><Upload size={15}/>Export to Google My Maps</button><button className="focus-secondary" onClick={()=>go('Sites')}><Plus size={16}/>Add or edit sites</button></div></div>
    {mapMode!=='heat'&&<Card className="map-toolbar"><label>Find a site<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or location" /></label><label>Site type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option><option value="inland">Inland</option><option value="shore">Shore</option><option value="boat">Boat</option><option value="wreck">Wreck</option><option value="sea">Open sea</option><option value="other">Other</option></select></label><label>Dive history<select value={visitFilter} onChange={(event)=>setVisitFilter(event.target.value as typeof visitFilter)}><option value="all">All sites</option><option value="dived">Dived sites</option><option value="undived">Not dived</option></select></label><label>Reliability<select value={reliability} onChange={(event) => setReliability(event.target.value)}><option value="hide-unconfirmed">Hide unconfirmed</option><option value="all">Show all</option><option value="unconfirmed">Unconfirmed only</option></select></label><span>{located.length.toLocaleString()} mapped sites</span></Card>}
    {mapMode==='google'&&customGoogleMap&&<p>If Google cannot display this map, <a className="focus-link" href={customGoogleMap.replace('/embed?','/viewer?')} target="_blank" rel="noreferrer">open your map in Google My Maps</a> to check its sharing settings.</p>}
    <div className="map-access-controls"><label><input type="checkbox" checked={showBucket} onChange={event=>setShowBucket(event.target.checked)}/> Show bucket-list sites ★</label><label>Open site details<select value="" onChange={event=>{const site=located.find(site=>site.entityId===event.target.value);if(site)selectMapMarker(site);}}><option value="">Choose a mapped site</option>{located.map(site=><option key={site.entityId} value={site.entityId}>{bucketIds.has(site.entityId)?'★ ':''}{site.name}</option>)}</select></label></div>
    <div className="google-map-layout">
      <Card className="google-map-card"><div className="site-map-head"><div><span className="focus-eyebrow">{mapMode === 'heat' ? 'YOUR LOGGED DIVE LOCATIONS' : mapMode === 'markers' ? 'ALL FILTERED MARKERS' : customGoogleMap ? 'CUSTOM GOOGLE MY MAP' : 'GOOGLE MAPS VIEW'}</span><h2>{mapMode === 'heat' ? `${heat.mapped} dives · ${heat.points.length} locations` : mapMode === 'markers' ? `${located.length.toLocaleString()} dive sites` : selected?.name ?? 'Dive sites'}</h2></div><div className="map-view-actions"><small>{mapMode === 'heat' ? 'Each coloured disc marks one location and shows exactly how many dives were logged there.' : mapMode === 'markers' ? 'Click any marker to open its ZeusTek site card in an overlay.' : customGoogleMap ? 'Google My Maps opens marker information inside the map.' : 'Google Maps follows the site selected in ZeusTek.'}</small><div><button className={mapMode === 'markers' ? 'active' : ''} onClick={() => setMapMode('markers')}>All markers</button><button className={mapMode === 'google' ? 'active' : ''} onClick={() => setMapMode('google')}>Google Maps</button><button className={mapMode === 'heat' ? 'active' : ''} aria-pressed={mapMode==='heat'} onClick={() => setMapMode('heat')}>Dive history</button></div></div></div>{mapMode === 'heat' ? <><div className="dive-heat-legend"><span>1 dive</span><i aria-hidden="true"/><span>10+ dives</span></div>{!heat.mapped&&<p className="heat-map-note">No logged dives with usable locations yet. Add a site or coordinates to a dive to see it here.</p>}{heat.skipped>0&&<p className="heat-map-note">{heat.skipped} {heat.skipped===1?'dive needs':'dives need'} a usable location before appearing here.</p>}<InteractiveDiveSiteMap key="heat" sites={sites} bucketIds={bucketIds} onSelect={selectMapMarker} heatPoints={heat.points}/></> : mapMode === 'markers' ? <InteractiveDiveSiteMap key="markers" sites={located} bucketIds={bucketIds} onSelect={selectMapMarker} /> : <iframe key={mapUrl} title="Dive site Google Map" src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}</Card>

    </div>
    {mapOverlaySite && <AccessibleDialog className="map-site-overlay-dialog" label={`${mapOverlaySite.name} site details`} close={()=>setMapOverlaySite(null)}><button className="focus-icon map-site-overlay-close" aria-label="Close site details" onClick={() => setMapOverlaySite(null)}><X size={18}/></button><Card><span className="focus-eyebrow">SELECTED MAP SITE</span><h2>{mapOverlaySite.name}</h2><p>{mapOverlaySite.location || mapOverlaySite.country || 'Location not recorded'}</p><div className="site-metrics"><span><Waves size={14}/><b>{mapOverlaySite.maxDepthM ?? '—'}m</b> maximum</span><span><MapPin size={14}/><b>{mapOverlaySite.latitude?.toFixed(4)}, {mapOverlaySite.longitude?.toFixed(4)}</b></span></div><div className="course-actions"><button className="focus-primary" onClick={() => { sessionStorage.setItem('zeustek-edit-site-id',mapOverlaySite.entityId); setMapOverlaySite(null); go('Sites'); }}><Pencil size={15}/>Edit site</button>{externalUrl(mapOverlaySite.sourceUrl || mapOverlaySite.website) && <a className="focus-link" href={externalUrl(mapOverlaySite.sourceUrl || mapOverlaySite.website)} target="_blank" rel="noreferrer">Open source</a>}<a className="focus-link" href={`https://www.google.com/maps/search/?api=1&query=${mapOverlaySite.latitude},${mapOverlaySite.longitude}`} target="_blank" rel="noreferrer">Open in Google Maps</a></div></Card><Card><div className="detail-grid">{[['Access', mapOverlaySite.access], ['Entry and exit', mapOverlaySite.entryExit], ['Hazards', mapOverlaySite.hazards], ['Facilities', mapOverlaySite.amenities], ['Tides', mapOverlaySite.tides], ['Description', mapOverlaySite.description], ['Notes', mapOverlaySite.notes]].map(([label, value]) => <SiteDetail key={label} label={label ?? ''} value={value} />)}</div><a className="focus-link" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${mapOverlaySite.latitude},${mapOverlaySite.longitude}`}>Street View</a></Card><SiteWeather item={mapOverlaySite}/></AccessibleDialog>}
  </div>;
}

function SitesV2({ go }: { go: (next: string) => void }) {
  const [items, setItems] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>(
    [],
  );
  const [editing, setEditing] = useState<Stored<DiveSiteRecord> | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Stored<DiveSiteRecord> | null>(null);
  const [catalogStatus, setCatalogStatus] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [siteSource, setSiteSource] = useState('all');
  const [siteDepth, setSiteDepth] = useState('all');
  const [siteTypeFilter, setSiteTypeFilter] = useState('all');
  const [reliabilityFilter, setReliabilityFilter] = useState('hide-unconfirmed');
  const [siteLimit, setSiteLimit] = useState(80);
  const [siteSort,setSiteSort]=useState('favourite');
  const [siteFiltersOpen,setSiteFiltersOpen]=useState(false);
  const [mapCoordinates, setMapCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const catalogStarted = useRef(false);
  const refresh = useCallback(() => {
    void Promise.all([listDiveSites(), listDives()]).then(
      ([nextSites, nextDives]) => {
        setItems(nextSites);
        setViewing(current=>current ? nextSites.find(site=>site.entityId===current.entityId) ?? null : null);
        setDives(nextDives);
      },
    );
  }, []);
  useRecordRefresh(refresh);
  useEffect(()=>{const targetId=sessionStorage.getItem('zeustek-edit-site-id');if(!targetId||!items.length)return;const target=items.find(site=>site.entityId===targetId);sessionStorage.removeItem('zeustek-edit-site-id');if(target){setEditing(target);setViewing(null);setAdding(true);setSiteSearch(target.name);}},[items]);
  const linkedSiteOpened=useRef(false);
  useEffect(()=>{if(linkedSiteOpened.current)return;const id=new URLSearchParams(window.location.search).get('siteId');const target=items.find(site=>site.entityId===id);if(target){setViewing(target);linkedSiteOpened.current=true;}},[items]);
  const importCatalog = useCallback(async () => {
    if (catalogStarted.current) return;
    catalogStarted.current = true;
    setCatalogStatus('Reading Finstrokes and DiveMap catalogue… your saved edits will be kept.');
    try {
      const catalog = (await fetch('/site-catalog.json', {
        cache: 'no-store',
      }).then((response) => response.json())) as {
        sites: Array<Record<string, unknown>>;
        sources: Array<{ name: string; count: number }>;
      };
      catalog.sites.push(...MANUAL_SITE_CATALOG.map(site=>({catalogId:`manual-data-html:${site.name.toLowerCase()}`,...manualSiteRecord(site)})));
      let imported = 0; let skipped=0;
      for (let index = 0; index < catalog.sites.length; index += 100) {
        const batch = catalog.sites.slice(index, index + 100);
        const result = await fetch('/api/site-import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sites: batch }),
        }).then(async (response) => {
          const body = (await response.json()) as {
            imported?: number;
            error?: string;
          };
          if (!response.ok)
            throw new Error(body.error || 'Catalogue import failed');
          return body;
        });
        imported += result.imported ?? 0;
        setCatalogStatus(
          `Merging site catalogue without replacing your edits… ${Math.min(index + batch.length, catalog.sites.length)} / ${catalog.sites.length}`,
        );
      }
      setCatalogStatus(
        `${imported} source-backed sites merged from ${catalog.sources.map((source) => `${source.name} (${source.count})`).join(' and ')}. Your edits were kept and blank fields were filled.`,
      );
      await refreshDiveRecords('site',true);
      refresh();
    } catch (reason) {
      catalogStarted.current = false;
      setCatalogStatus(
        reason instanceof Error ? reason.message : 'Catalogue import failed',
      );
    }
  }, [refresh]);
  async function remove(item: Stored<DiveSiteRecord>) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    await deleteDiveSite(item.entityId);
    refresh();
  }
  async function toggleFavourite(item: Stored<DiveSiteRecord>) {
    const { entityId, createdAt: _, modifiedAt: __, ...record } = item;
    await saveDiveSite({ ...record, entityId, favourite: !item.favourite });
    refresh();
  }
  function diveCount(item: DiveSiteRecord) {
    const names = [item.name, item.location, item.alternativeNames ?? '']
      .flatMap((value) => value.toLowerCase().split(','))
      .map((value) => value.trim())
      .filter((value) => value.length > 2);
    return dives.filter((dive) =>
      names.some(
        (name) =>
          dive.site.toLowerCase().includes(name) ||
          name.includes(dive.site.toLowerCase()),
      ),
    ).length;
  }
  const matchingSites = items.filter((item) => {
    const textMatch = [
      item.name,
      item.alternativeNames,
      item.location,
      item.country,
      item.postcode,
      item.sourceName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(siteSearch.trim().toLowerCase());
    const source = item.sourceName || 'Manual';
    const sourceMatch = siteSource === 'all' || source === siteSource;
    const depth = item.maxDepthM;
    const depthMatch =
      siteDepth === 'all' ||
      (siteDepth === 'shallow' && depth != null && depth < 18) ||
      (siteDepth === 'deep' && depth != null && depth >= 18 && depth <= 40) ||
      (siteDepth === 'technical' && depth != null && depth > 40) ||
      (siteDepth === 'unknown' && depth == null);
    const broadType = ['lake','quarry','river','pool','inland'].includes(item.siteType ?? '') ? 'inland' : item.siteType ?? 'other';
    const typeMatch = siteTypeFilter === 'all' || broadType === siteTypeFilter;
    const unconfirmed = item.unconfirmed === true || (item.sourceName === 'DiveMap' && item.positionConfidence != null && item.positionConfidence < 0.5);
    const reliabilityMatch = reliabilityFilter === 'all' || (reliabilityFilter === 'unconfirmed' ? unconfirmed : !unconfirmed);
    return textMatch && sourceMatch && depthMatch && typeMatch && reliabilityMatch;
  }).sort((a, b) => (siteSort === 'dives' ? diveCount(b)-diveCount(a) : siteSort === 'location' ? a.location.localeCompare(b.location) : siteSort === 'depth' ? (b.maxDepthM ?? -1)-(a.maxDepthM ?? -1) : siteSort === 'favourite' ? Number(Boolean(b.favourite))-Number(Boolean(a.favourite)) : 0) || a.name.localeCompare(b.name));
  const addFromMap = useCallback((latitude: number, longitude: number) => {
    setEditing(null);
    setMapCoordinates({ latitude, longitude });
    setAdding(true);
  }, []);
  return (
    <>
      <Heading
        eyebrow="SITE INTELLIGENCE · WEATHER · HISTORY"
        title="Dive sites"
        copy="Keep practical site knowledge, see how often you have dived there, and choose which locations get forecast cards."
        action={
          <div className="record-actions">
            <button
              className="focus-secondary"
              onClick={() => {
                catalogStarted.current = false;
                void importCatalog();
              }}
            >
              <Cloud size={16} /> Sync site catalogue
            </button>
            <button
              className="focus-primary"
              onClick={() => {
                setEditing(null);
                setAdding(true);
              }}
            >
              <Plus size={16} /> Add site
            </button>
          </div>
        }
      />
      {catalogStatus && (
        <div className="focus-notice">
          <ShieldCheck size={15} /> {catalogStatus}
        </div>
      )}
      <Card className="site-catalog-tools"><label>Sort by<select value={siteSort} onChange={e=>setSiteSort(e.target.value)}><option value="favourite">Favourites first</option><option value="name">Name A–Z</option><option value="dives">Most logged dives</option><option value="location">Location A–Z</option><option value="depth">Deepest first</option></select></label>
        <label>
          Location, site, country, region or postcode
          <input
            value={siteSearch}
            onChange={(event) => {
              setSiteSearch(event.target.value);
              setSiteLimit(80);
            }}
            placeholder="Name, county, region or source"
          />
        </label>
        <button className="focus-secondary" aria-expanded={siteFiltersOpen} onClick={()=>setSiteFiltersOpen(!siteFiltersOpen)}>Filters · {[siteDepth!=='all',siteSource!=='all',siteTypeFilter!=='all',reliabilityFilter!=='hide-unconfirmed'].filter(Boolean).length}<ChevronDown size={16}/></button><div className="site-extra-filters" hidden={!siteFiltersOpen}>
        <label>
          Depth
          <select value={siteDepth} onChange={(event) => setSiteDepth(event.target.value)}>
            <option value="all">All depths</option>
            <option value="shallow">Shallow · under 18m</option>
            <option value="deep">Deep · 18–40m</option>
            <option value="technical">Technical · over 40m</option>
            <option value="unknown">Depth not recorded</option>
          </select>
        </label>
        <label>
          Data source
          <select value={siteSource} onChange={(event) => setSiteSource(event.target.value)}>
            <option value="all">All sources</option>
            <option value="Manual">Manual</option>
            <option value="Finstrokes">Finstrokes</option>
            <option value="DiveMap">DiveMap</option>
          </select>
        </label>
        <label>Site type<select value={siteTypeFilter} onChange={(event) => setSiteTypeFilter(event.target.value)}><option value="all">All site types</option><option value="inland">Inland</option><option value="shore">Shore</option><option value="boat">Boat</option><option value="wreck">Wreck</option><option value="sea">Open sea</option><option value="other">Other</option></select></label>
        <label>Reliability<select value={reliabilityFilter} onChange={(event) => setReliabilityFilter(event.target.value)}><option value="hide-unconfirmed">Hide unconfirmed marks</option><option value="all">Show all marks</option><option value="unconfirmed">Unconfirmed only</option></select></label>
        </div><span>
          {matchingSites.length.toLocaleString()} matches · every imported fact
          keeps its source link
        </span>
      </Card>
      {adding && (
        <RevealOnMount>
          <SiteV2Form
            item={editing}
            initialCoordinates={mapCoordinates}
            close={() => {
              setAdding(false);
              setEditing(null);
              setMapCoordinates(null);
            }}
            saved={refresh}
          />
        </RevealOnMount>
      )}
      <div className="site-list">
        {matchingSites.slice(0, siteLimit).map((item) => (
          <Card key={item.entityId} className="site-card clickable-card">
            <span id={`site-card-${item.entityId}`} className="card-scroll-anchor" />
            <button
              className="card-hit"
              onClick={() => setViewing(item)}
              aria-label={`View ${item.name}`}
            />
            <div className="site-card-main">
              <div className="focus-card-head">
                <div>
                  <span className="focus-eyebrow">
                    {(item.siteType ?? 'other').toUpperCase()} ·{' '}
                    {(item.difficulty ?? 'intermediate').toUpperCase()} ·{' '}
                    {(item.sourceName || 'Manual').toUpperCase()}
                  </span>
                  {(item.unconfirmed === true || (item.sourceName === 'DiveMap' && item.positionConfidence != null && item.positionConfidence < 0.5)) && <span className="site-unconfirmed">UNCONFIRMED MARK</span>}
                  <h2 className="icon-title"><ZeusTekIcon id={resolveZeusTekIconId(item.siteType ?? item.waterType ?? item.location, 'dive-site')} size={30}/><span>{item.name}</span></h2>
                </div>
                <div className="record-actions">
                  <button className={item.favourite ? 'active' : ''} onClick={() => void toggleFavourite(item)} aria-label={`${item.favourite ? 'Remove' : 'Add'} ${item.name} ${item.favourite ? 'from' : 'to'} favourites`}><Star size={15} fill={item.favourite ? 'currentColor' : 'none'} /></button>
                  <button
                    onClick={() => {
                      setEditing(item);
                      setAdding(true);
                    }}
                    aria-label={`Edit ${item.name}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => void remove(item)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="site-location">
                <MapPin size={14} />
                {[item.location, item.country, item.postcode].filter(Boolean).join(' · ') ||
                  'Location not recorded'}
              </p>
              <div className="site-metrics">
                <span>
                  <Waves size={14} />
                  <b>{item.maxDepthM ?? '—'}m</b> maximum
                </span>
                <span>
                  <BookOpen size={14} />
                  <button className="site-dive-link" onClick={() => { sessionStorage.setItem('zeustek-logbook-site-filter', item.name); go('Logbook'); }}><b>{diveCount(item)}</b> logged dives</button>
                </span>
                <span>
                  <Car size={14} />
                  <b>{item.parking ? 'Recorded' : 'Not set'}</b> parking
                </span>
              </div>
              <div className="site-detail-grid">
                <SiteDetail
                  label="Access / entry"
                  value={[item.access, item.entryExit]
                    .filter(Boolean)
                    .join(' · ')}
                />
                <SiteDetail label="Parking" value={item.parking} />
                <SiteDetail label="Amenities" value={item.amenities} />
                <SiteDetail label="Air & Nitrox" value={item.airFill} />
                <SiteDetail label="Hazards" value={item.hazards} />
                <SiteDetail label="Description" value={item.description} />
                <SiteDetail label="Diving" value={item.diving} />
                <SiteDetail label="Biodiversity" value={item.biodiversity} />
                <SiteDetail
                  label="Food / accommodation"
                  value={[item.nearbyFood, item.accommodation]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </div>
              {item.website && (
                <a
                  className="focus-link"
                  href={item.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open site information
                </a>
              )}
              {item.latitude != null && item.longitude != null && (
                <>
                  <a className="focus-link" href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer"><MapPin size={14} /> Open Google Maps</a>
                  <a className="focus-link" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open Street View</a>
                </>
              )}
            </div>
          </Card>
        ))}
        {matchingSites.length > siteLimit && (
          <button
            className="focus-secondary"
            onClick={() => setSiteLimit((value) => value + 80)}
          >
            Show 80 more sites
          </button>
        )}
        {!items.length && (
          <Card className="focus-empty">
            <Compass size={32} />
            <h2>No dive sites yet</h2>
            <p>
              Add coordinates, parking, amenities, access, hazards and
              difficulty.
            </p>
            <button className="focus-primary" onClick={() => setAdding(true)}>
              Add first site
            </button>
          </Card>
        )}
      </div>
      {viewing && (
        <RecordDetail
          title={viewing.name}
          eyebrow={`${viewing.siteType ?? 'Dive site'} · ${viewing.difficulty ?? 'difficulty not set'}`}
          ownerKind="site"
          ownerId={viewing.entityId}
          close={() => setViewing(null)}
          edit={() => {
            setEditing(viewing);
            setViewing(null);
            setAdding(true);
          }}
          rows={[
            [
              'Location',
              [viewing.location, viewing.country, viewing.postcode].filter(Boolean).join(' · '),
            ],
            ['Street address', viewing.address],
            ['Water type', viewing.waterType ? `${viewing.waterType} water` : ''],
            ['Telephone', viewing.telephone],
            ['Email', viewing.email],
            ['Opening times', viewing.openingTimes],
            [
              'Maximum depth',
              viewing.maxDepthM != null ? `${viewing.maxDepthM} m` : '',
            ],
            ['Bathymetric depth', viewing.bathymetricDepthM != null ? `${viewing.bathymetricDepthM} m` : ''],
            ['Position confidence', viewing.positionConfidence != null ? `${Math.round(viewing.positionConfidence * 100)}%` : ''],
            ['Plus code', viewing.plusCode],
            ['Description', viewing.description],
            ['Diving', viewing.diving],
            ['Biodiversity', viewing.biodiversity],
            ['Tides', viewing.tides],
            ['History', viewing.history],
            ['Access', viewing.access],
            ['Entry / exit', viewing.entryExit],
            ['Parking', viewing.parking],
            ['Amenities', viewing.amenities],
            ['Air / Nitrox', viewing.airFill],
            ['Mobile signal', viewing.mobileSignal],
            ['Accommodation', viewing.accommodation],
            ['Food nearby', viewing.nearbyFood],
            ['Hazards', viewing.hazards],
            ['Notes', viewing.notes],
            ['Source', viewing.sourceName],
          ]}
          links={[
            ['Open source information', viewing.sourceUrl || viewing.website],
            ['Open Google Maps', viewing.latitude != null && viewing.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${viewing.latitude},${viewing.longitude}` : ''],
            ['Open Street View', viewing.latitude != null && viewing.longitude != null ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${viewing.latitude},${viewing.longitude}` : ''],
          ]}
        >
          {viewing.diveMapImage && <section className="site-map-image"><h3>Dive map</h3><CardImageView image={viewing.diveMapImage} label={`${viewing.name} dive map`}/></section>}
          <SiteAlbums site={viewing}/>
          <SiteOverheadSection key={viewing.entityId} site={viewing}/>
        </RecordDetail>
      )}
    </>
  );
}
function SiteDetail({
  label,
  value,
}: {
  label: string;
  value?: string | undefined;
}) {
  return (
    <div>
      <small>{label}</small>
      <span>{value || 'Not recorded'}</span>
    </div>
  );
}
function SiteWeather({ item }: { item: DiveSiteRecord }) {
  const [data, setData] = useState<{
    weather?: {
      current?: Record<string, number>;
      current_units?: Record<string, string>;
      daily?: Record<string, unknown[]>;
    };
    marine?: {
      current?: Record<string, number>;
      current_units?: Record<string, string>;
    };
    attribution?: string;
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null);
    setError('');
    const params = new URLSearchParams({
      latitude: String(item.latitude),
      longitude: String(item.longitude),
      marine: String(
        ['shore', 'boat', 'wreck', 'sea'].includes(item.siteType ?? ''),
      ),
    });
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/site-weather?${params}`, { cache: 'no-store' });
        const result = (await response.json()) as {
          weather?: {
            current?: Record<string, number>;
            current_units?: Record<string, string>;
            daily?: Record<string, unknown[]>;
          };
          marine?: {
            current?: Record<string, number>;
            current_units?: Record<string, string>;
          };
          attribution?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || 'Shared forecast unavailable');
        if (!cancelled) setData(result);
      } catch {
        const direct = new URL('https://api.open-meteo.com/v1/forecast');
        direct.search = new URLSearchParams({ latitude: String(item.latitude), longitude: String(item.longitude), current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max', timezone: 'auto', forecast_days: '7', wind_speed_unit: 'mph' }).toString();
        const response = await fetch(direct);
        if (!response.ok) throw new Error('Forecast temporarily unavailable.');
        const weather = await response.json() as NonNullable<NonNullable<typeof data>['weather']>;
        if (!cancelled) setData({ weather, attribution: 'Weather data by Open-Meteo. Forecasts are guidance only and are not dive-safety advice.' });
      }
    }
    void load().catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Forecast temporarily unavailable.'); });
    return () => { cancelled = true; };
  }, [item.latitude, item.longitude, item.siteType]);
  const current = data?.weather?.current;
  const units = data?.weather?.current_units;
  const marine = data?.marine?.current;
  return (
    <aside className="weather-card">
      <div className="weather-title">
        <CloudRain />
        <div>
          <span>SELECTED SITE WEATHER</span>
          <strong>{item.name}</strong>
        </div>
      </div>
      {error ? (
        <p>{error}</p>
      ) : !current ? (
        <p>Loading forecast…</p>
      ) : (
        <>
          <div className="weather-now">
            <strong>
              {current.temperature_2m}
              {units?.temperature_2m}
            </strong>
            <span>
              Feels {current.apparent_temperature}
              {units?.apparent_temperature}
            </span>
          </div>
          <div className="weather-metrics">
            <span>
              Wind{' '}
              <b>
                {current.wind_speed_10m} {units?.wind_speed_10m}
              </b>
            </span>
            <span>
              Gusts{' '}
              <b>
                {current.wind_gusts_10m} {units?.wind_gusts_10m}
              </b>
            </span>
            <span>
              Rain{' '}
              <b>
                {current.precipitation} {units?.precipitation}
              </b>
            </span>
            {marine && (
              <>
                <span>
                  Wave <b>{marine.wave_height ?? '—'}m</b>
                </span>
                <span>
                  Water <b>{marine.sea_surface_temperature ?? '—'}°C</b>
                </span>
                <span>
                  Current <b>{marine.ocean_current_velocity ?? '—'} kn</b>
                </span>
              </>
            )}
          </div>
          <div className="weather-week">{data?.weather?.daily?.time?.slice(0, 7).map((date, index) => {
            const daily = data.weather?.daily;
            const code = Number(daily?.weather_code?.[index] ?? 3);
            return <div key={String(date)} title={forecastDescription(code)}><b>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</b>{weatherIcon(code, 18)}<span>{Math.round(Number(daily?.temperature_2m_max?.[index] ?? 0))}°</span><small>{Math.round(Number(daily?.wind_speed_10m_max?.[index] ?? 0))} mph</small></div>;
          })}</div>
          <small>{data?.attribution}</small>
        </>
      )}
    </aside>
  );
}
function SiteV2Form({
  item,
  initialCoordinates,
  close,
  saved,
}: {
  item: Stored<DiveSiteRecord> | null;
  initialCoordinates?: { latitude: number; longitude: number } | null;
  close: () => void;
  saved: () => void;
}) {
  const [value, setValue] = useState(() => ({
    name: item?.name ?? '',
    alternativeNames: item?.alternativeNames ?? '',
    location: item?.location ?? '',
    country: item?.country ?? '',
    region: item?.region ?? '',
    waterType: item?.waterType ?? '',
    favourite: item?.favourite ?? false,
    postcode: item?.postcode ?? '',
    address: item?.address ?? '',
    telephone: item?.telephone ?? '',
    email: item?.email ?? '',
    openingTimes: item?.openingTimes ?? '',
    latitude: item?.latitude?.toString() ?? initialCoordinates?.latitude.toFixed(6) ?? '',
    longitude: item?.longitude?.toString() ?? initialCoordinates?.longitude.toFixed(6) ?? '',
    siteType: item?.siteType ?? 'lake',
    difficulty: item?.difficulty ?? 'intermediate',
    maxDepth: item?.maxDepthM?.toString() ?? '',
    access: item?.access ?? '',
    parking: item?.parking ?? '',
    amenities: item?.amenities ?? '',
    entryExit: item?.entryExit ?? '',
    airFill: item?.airFill ?? '',
    mobileSignal: item?.mobileSignal ?? '',
    accommodation: item?.accommodation ?? '',
    nearbyFood: item?.nearbyFood ?? '',
    website: item?.website ?? '',
    hazards: item?.hazards ?? '',
    description: item?.description ?? '',
    diving: item?.diving ?? '',
    biodiversity: item?.biodiversity ?? '',
    tides: item?.tides ?? '',
    history: item?.history ?? '',
    notes: item?.notes ?? '',
    showWeather: item?.showWeather ?? false,
  }));
  const [siteActivities,setSiteActivities]=useState<string[]>(item?.diveTypes ?? []);
  const [diveMapImage,setDiveMapImage]=useState<CardImage|null>(item?.diveMapImage ?? null);
  const [mapUrl,setMapUrl]=useState('');
  const [mapMessage,setMapMessage]=useState('');
  const [mapBusy,setMapBusy]=useState(false);
  async function importMap(file:File) {setMapBusy(true);try{setDiveMapImage(await storeDiveImage(file,currentDiveAccount()));setMapMessage('Map attached. Save the site to keep it.');}catch(error){setMapMessage(String(error));}finally{setMapBusy(false);}}
  function field(name: keyof typeof value, next: string | boolean) {
    setValue((current) => ({ ...current, [name]: next }));
  }
  async function submit() {
    if (!value.name.trim()) return;
    await saveDiveSite({
      ...(item ? { entityId: item.entityId } : {}),
      name: value.name.trim(),
      alternativeNames: value.alternativeNames.trim(),
      location: value.location.trim(),
      country: value.country.trim(),
      region: value.region.trim(),
      diveTypes: siteActivities,
      diveMapImage,
      waterType: value.waterType,
      favourite: value.favourite,
      postcode: value.postcode.trim(),
      address: value.address.trim(),
      telephone: value.telephone.trim(),
      email: value.email.trim(),
      openingTimes: value.openingTimes.trim(),
      latitude: value.latitude ? Number(value.latitude) : null,
      longitude: value.longitude ? Number(value.longitude) : null,
      siteType: value.siteType,
      difficulty: value.difficulty,
      maxDepthM: value.maxDepth ? Number(value.maxDepth) : null,
      access: value.access.trim(),
      parking: value.parking.trim(),
      amenities: value.amenities.trim(),
      entryExit: value.entryExit.trim(),
      airFill: value.airFill.trim(),
      mobileSignal: value.mobileSignal.trim(),
      accommodation: value.accommodation.trim(),
      nearbyFood: value.nearbyFood.trim(),
      website: value.website.trim(),
      hazards: value.hazards.trim(),
      description: value.description.trim(),
      diving: value.diving.trim(),
      biodiversity: value.biodiversity.trim(),
      tides: value.tides.trim(),
      history: value.history.trim(),
      notes: value.notes.trim(),
      showWeather: value.showWeather,
      ...(item?.sourceName != null ? { sourceName: item.sourceName } : {}),
      ...(item?.sourceUrl != null ? { sourceUrl: item.sourceUrl } : {}),
      ...(item?.plusCode != null ? { plusCode: item.plusCode } : {}),
      ...(item?.positionConfidence != null ? { positionConfidence: item.positionConfidence } : {}),
      ...(item?.depthConfidence != null ? { depthConfidence: item.depthConfidence } : {}),
      ...(item?.bathymetricDepthM != null ? { bathymetricDepthM: item.bathymetricDepthM } : {}),
    });
    saved();
    close();
  }
  return (
    <div className="focus-modal-bg"><AccessibleDialog editable label={item ? "Edit site" : "New site"} close={close} className="focus-modal record-form site-form">
      <div className="record-form-head">
        <div>
          <span className="focus-eyebrow">
            {item ? 'EDIT SITE' : 'NEW SITE'}
          </span>
          <h3>Site knowledge</h3>
        </div>
        <button className="focus-icon" aria-label="Close editor" data-dialog-close onClick={close}>
          <X size={17} />
        </button>
      </div>
<EditorSections selector=".site-entry-section"/><div className="site-entry-sections"><section className="site-entry-section"><h3>1 · Name and location</h3><div className="site-entry-grid"><label className="">Name<input type="text" value={value.name} onChange={e=>field('name',e.target.value)}/></label><label className="">Alternative names<input type="text" value={value.alternativeNames} onChange={e=>field('alternativeNames',e.target.value)}/></label><label className="">Town / location<input type="text" value={value.location} onChange={e=>field('location',e.target.value)}/></label><label className="">Region / county<input type="text" value={value.region} onChange={e=>field('region',e.target.value)}/></label><label className="">Country<input type="text" value={value.country} onChange={e=>field('country',e.target.value)}/></label><label className="">Postcode<input type="text" value={value.postcode} onChange={e=>field('postcode',e.target.value)}/></label><label className="site-field-wide">Street address<textarea value={value.address} onChange={e=>field('address',e.target.value)}/></label><label className="">Latitude<input type="number" value={value.latitude} onChange={e=>field('latitude',e.target.value)}/></label><label className="">Longitude<input type="number" value={value.longitude} onChange={e=>field('longitude',e.target.value)}/></label></div></section><section className="site-entry-section"><h3>2 · Dive characteristics</h3><div className="site-entry-grid"><label>
          Site type
          <select
            value={value.siteType}
            onChange={(e) => field('siteType', e.target.value)}
          >
            <option value="lake">Lake</option>
            <option value="quarry">Quarry</option>
            <option value="river">River</option>
            <option value="pool">Pool / training tank</option>
            <option value="shore">Shore</option>
            <option value="boat">Boat</option>
            <option value="wreck">Wreck</option>
            <option value="sea">Open sea</option>
            <option value="inland">Other inland</option>
            <option value="other">Other</option>
          </select>
        </label><label>Water type<select value={value.waterType} onChange={(e) => field('waterType', e.target.value)}><option value="">Not recorded</option><option value="fresh">Fresh water</option><option value="salt">Salt water</option><option value="brackish">Brackish water</option></select></label><label>
          Difficulty
          <select
            value={value.difficulty}
            onChange={(e) => field('difficulty', e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="technical">Technical</option>
          </select>
        </label><label className="">Maximum depth (m)<input type="number" value={value.maxDepth} onChange={e=>field('maxDepth',e.target.value)}/></label><fieldset className="record-wide"><legend>DIVE SETTING & ACTIVITY</legend><DiveSettingActivity values={siteActivities} onChange={setSiteActivities}/></fieldset></div></section><section className="site-entry-section"><h3>3 · Access and facilities</h3><div className="site-entry-grid"><label className="">Access and directions<textarea value={value.access} onChange={e=>field('access',e.target.value)}/></label><label className="">Entry and exit<textarea value={value.entryExit} onChange={e=>field('entryExit',e.target.value)}/></label><label className="">Parking<input type="text" value={value.parking} onChange={e=>field('parking',e.target.value)}/></label><label className="">Amenities<input type="text" value={value.amenities} onChange={e=>field('amenities',e.target.value)}/></label><label className="">Air / Nitrox<input type="text" value={value.airFill} onChange={e=>field('airFill',e.target.value)}/></label><label className="">Mobile signal<input type="text" value={value.mobileSignal} onChange={e=>field('mobileSignal',e.target.value)}/></label><label className="">Accommodation<input type="text" value={value.accommodation} onChange={e=>field('accommodation',e.target.value)}/></label><label className="">Nearby food / cafe / pub<input type="text" value={value.nearbyFood} onChange={e=>field('nearbyFood',e.target.value)}/></label><label className="site-field-wide">Hazards<textarea value={value.hazards} onChange={e=>field('hazards',e.target.value)}/></label></div></section><section className="site-entry-section"><h3>4 · Contact and opening times</h3><div className="site-entry-grid"><label className="">Website<input type="url" value={value.website} onChange={e=>field('website',e.target.value)}/></label><label className="">Telephone<input type="tel" value={value.telephone} onChange={e=>field('telephone',e.target.value)}/></label><label className="">Email<input type="email" value={value.email} onChange={e=>field('email',e.target.value)}/></label><label className="site-field-wide">Opening times<textarea value={value.openingTimes} onChange={e=>field('openingTimes',e.target.value)}/></label></div></section><section className="site-entry-section"><h3>5 · Site knowledge and notes</h3><div className="site-entry-grid"><label className="site-field-wide">Description<textarea value={value.description} onChange={e=>field('description',e.target.value)}/></label><label className="">Diving notes / profile<textarea value={value.diving} onChange={e=>field('diving',e.target.value)}/></label><label className="">Biodiversity<textarea value={value.biodiversity} onChange={e=>field('biodiversity',e.target.value)}/></label><label className="">Tides and currents<textarea value={value.tides} onChange={e=>field('tides',e.target.value)}/></label><label className="">History<textarea value={value.history} onChange={e=>field('history',e.target.value)}/></label><label className="site-field-wide">Personal notes<textarea value={value.notes} onChange={e=>field('notes',e.target.value)}/></label></div></section><section className="site-entry-section"><h3>6 · Dive map</h3><div className="site-entry-grid"><section className="record-wide site-map-image"><h3>Dive map image</h3>{diveMapImage && <><CardImageView image={diveMapImage} label="Dive site map"/><button className="focus-secondary" onClick={()=>setDiveMapImage(null)}>Remove map</button></>}<label>Upload map<input type="file" accept="image/jpeg,image/png,image/webp" disabled={mapBusy} onChange={e=>{const file=e.target.files?.[0];if(file)void importMap(file);}}/></label><label>Map image URL<input type="url" value={mapUrl} onChange={e=>setMapUrl(e.target.value)}/></label><button className="focus-secondary" disabled={mapBusy || !mapUrl} onClick={async()=>{setMapBusy(true);try{const url=new URL(mapUrl);if(url.protocol!=='https:')throw new Error('Use an HTTPS image URL.');const response=await fetch(`/api/image-proxy?url=${encodeURIComponent(url.href)}`);if(!response.ok)throw new Error('Image import failed. Upload the image file instead.');const blob=await response.blob();await importMap(new File([blob],'dive-map',{type:blob.type}));}catch(error){setMapMessage(String(error));}finally{setMapBusy(false);}}}>Import map URL</button>{mapMessage&&<p role="status">{mapMessage}</p>}</section></div></section><section className="site-entry-section"><h3>7 · Preferences</h3><div className="site-entry-grid"><label className="record-check"><input type="checkbox" checked={value.showWeather} onChange={e=>field('showWeather',e.target.checked)}/>Show a weather card for this site</label><label className="record-check"><input type="checkbox" checked={value.favourite} onChange={e=>field('favourite',e.target.checked)}/>Favourite site</label></div></section></div>
      <footer>
        <button className="focus-secondary" data-dialog-close onClick={close}>
          Cancel
        </button>
        <button
          className="focus-primary"
          disabled={!value.name.trim() || mapBusy}
          onClick={() => void submit()}
        >
          Save site
        </button>
      </footer>
    </AccessibleDialog></div>
  );
}

function AgencyMark({
  agency,
  options,
}: {
  agency: string;
  options: Array<Stored<CatalogOptionRecord>>;
}) {
  const source = agencyLogoSource(agency, options);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  const initials = (agency || 'Other')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 4)
    .toUpperCase();
  return (
    <span className="agency-mark" title={agency || 'Other agency'}>
      {source && !failed ? (
        <img src={source} alt={`${agency} logo`} onError={() => setFailed(true)} />
      ) : (
        <b>{initials || '—'}</b>
      )}
    </span>
  );
}

function CoursePlanner({ certifications, progress, diveCount, refresh, go }: {
  certifications: Array<Stored<CertificationRecord>>;
  progress: Array<Stored<TrainingProgressRecord>>;
  diveCount: number;
  refresh: () => Promise<void>;
  go: (next: string) => void;
}) {
  const [agency, setAgency] = useState<'PADI' | 'TDI'>('PADI');
  const [coursePanel,setCoursePanel]=useState('map');
  const [courseCategory,setCourseCategory]=useState('all');
  const [courseLayout,setCourseLayout]=useState('grid');
  const laneRef=useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState('padi-open-water');
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const courses = TRAINING_COURSES.filter((course) => course.agency === agency);
  const selected = TRAINING_COURSES.find((course) => course.id === selectedId && course.agency === agency) ?? courses[0];
  const progressFor = (course: TrainingCourse) => progress.find((item) => item.courseId === course.id);
  const sharedMedicalProgress = progress.find((item) => item.courseId === 'shared-medical-declarations');
  const sharedMetRequirementIds = sharedMedicalProgress?.metRequirementIds ?? [];
  const selfMedicalConfirmed = sharedMetRequirementIds.includes('self-medical');
  const [sharedMedicalExpanded, setSharedMedicalExpanded] = useState(!selfMedicalConfirmed);
  const [developmentPlanMinimised, setDevelopmentPlanMinimised] = useState(false);
  const [planMessage, setPlanMessage] = useState('');
  useEffect(() => {
    setSharedMedicalExpanded(!selfMedicalConfirmed);
  }, [selfMedicalConfirmed]);
  const neededCourseIds = new Set(progress.filter((item) => item.status === 'planned' || item.status === 'in-progress').flatMap((item) => {
    const course = TRAINING_COURSES.find((candidate) => candidate.id === item.courseId);
    return course?.requirements.flatMap((requirement) => 'targetCourseId' in requirement && requirement.targetCourseId ? [requirement.targetCourseId] : []) ?? [];
  }));
  const plannedCourses = progress
    .filter((item) => item.agency === agency && (item.status === 'planned' || item.status === 'in-progress'))
    .flatMap((item) => { const course = TRAINING_COURSES.find((candidate) => candidate.id === item.courseId); return course ? [{ course, progress: item }] : []; })
    .filter((item) => !['completed', 'superseded'].includes(courseState(item.course, certifications, diveCount, item.progress, sharedMetRequirementIds)))
    .sort((a, b) => (a.progress.planOrder ?? 9999) - (b.progress.planOrder ?? 9999) || a.course.title.localeCompare(b.course.title));
  async function setProgress(course: TrainingCourse, status: TrainingProgressRecord['status'], metRequirementIds?: string[]) {
    const current = progressFor(course);
    const nextPlanOrder = status === 'planned' || status === 'in-progress'
      ? current?.planOrder ?? Math.max(0, ...progress.map((item) => item.planOrder ?? 0)) + 1
      : current?.planOrder;
    await saveTrainingProgress({
      ...(current ? { entityId: current.entityId } : {}),
      agency: course.agency,
      courseId: course.id,
      courseTitle: course.title,
      status,
      metRequirementIds: metRequirementIds ?? current?.metRequirementIds ?? [],
      ...(nextPlanOrder !== undefined ? { planOrder: nextPlanOrder } : {}),
    });
    await refresh();
  }
  async function clearCourseProgress(course: TrainingCourse) {
    const current = progressFor(course);
    if (!current) return;
    await deleteTrainingProgress(current.entityId);
    await refresh();
  }
  async function setSharedSelfMedical(confirmed: boolean) {
    const ids = new Set(sharedMetRequirementIds);
    confirmed ? ids.add('self-medical') : ids.delete('self-medical');
    await saveTrainingProgress({
      ...(sharedMedicalProgress ? { entityId: sharedMedicalProgress.entityId } : {}),
      agency: 'PADI',
      courseId: 'shared-medical-declarations',
      courseTitle: 'Shared medical declarations',
      status: 'in-progress',
      metRequirementIds: [...ids],
      ...(sharedMedicalProgress?.planOrder !== undefined ? { planOrder: sharedMedicalProgress.planOrder } : {}),
    });
    if (confirmed) setSharedMedicalExpanded(false);
    await refresh();
  }
  async function generateDevelopmentPlan() {
    const targets = plannedCourses.length ? plannedCourses.map((item) => item.course) : selected ? [selected] : [];
    if (!targets.length) return;
    const ordered: TrainingCourse[] = [];
    const visiting = new Set<string>();
    const added = new Set<string>();
    const add = (course: TrainingCourse) => {
      if (added.has(course.id) || visiting.has(course.id)) return;
      visiting.add(course.id);
      course.requirements.forEach((requirement) => {
        const targetId = 'targetCourseId' in requirement ? requirement.targetCourseId : undefined;
        const target = targetId ? TRAINING_COURSES.find((candidate) => candidate.id === targetId) : undefined;
        if (target && target.agency === course.agency && !['completed','superseded'].includes(courseState(target, certifications, diveCount, progressFor(target), sharedMetRequirementIds))) add(target);
      });
      visiting.delete(course.id);
      if (!['completed','superseded'].includes(courseState(course, certifications, diveCount, progressFor(course), sharedMetRequirementIds))) { added.add(course.id); ordered.push(course); }
    };
    targets.forEach(add);
    for (let index = 0; index < ordered.length; index += 1) {
      const course = ordered[index]; if (!course) continue; const current = progressFor(course);
      await saveTrainingProgress({ ...(current ? { entityId: current.entityId } : {}), agency: course.agency, courseId: course.id, courseTitle: course.title, status: current?.status === 'in-progress' ? 'in-progress' : 'planned', metRequirementIds: current?.metRequirementIds ?? [], planOrder: index + 1 });
    }
    setPlanMessage(`${ordered.length} course${ordered.length === 1 ? '' : 's'} ordered with prerequisites first.`);
    await refresh();
  }
  async function movePlannedCourse(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= plannedCourses.length) return;
    const next = [...plannedCourses];
    const from = next[index]; const to = next[target];
    if (!from || !to) return;
    next[index] = to; next[target] = from;
    const positions = new Map(next.map((item, position) => [item.course.id, position]));
    const valid = next.every((item, position) => item.course.requirements.every((requirement) => {
      const targetId = 'targetCourseId' in requirement ? requirement.targetCourseId : undefined;
      return !targetId || !positions.has(targetId) || (positions.get(targetId) as number) < position;
    }));
    if (!valid) { setPlanMessage('That move would place a course before one of its prerequisites.'); return; }
    await Promise.all(next.map((item, position) => saveTrainingProgress({ entityId: item.progress.entityId, agency: item.progress.agency, courseId: item.progress.courseId, courseTitle: item.progress.courseTitle, status: item.progress.status, metRequirementIds: item.progress.metRequirementIds ?? [], planOrder: position + 1 })));
    setPlanMessage('Development plan order saved.');
    await refresh();
  }
  async function markCompleted(course: TrainingCourse) {
    if (!window.confirm(`Mark ${course.title} as completed and add it to your certifications?`)) return;
    await saveCertification({
      agency: course.agency,
      certification: course.title,
      level: course.stage,
      certificationNumber: '',
      issuedAt: new Date().toISOString().slice(0, 10),
      expiresAt: '',
      instructor: '',
      notes: 'Added from the interactive course planner. Edit this certification to add the official details.',
      certificateUrl: '',
      courseType: course.category,
      awardPriority: null,
      imageKey: '',
      imageName: '',
    });
    await setProgress(course, 'completed');
  }
  const selectedDetail = selected && <div className="course-detail course-detail-priority">
    <div><span className="focus-eyebrow">SELECTED COURSE · {selected.agency} · {selected.stage}</span><div className="selected-course-heading"><img src={courseArtwork(selected.title,selected.stage)} alt="" width={56} height={56}/><h3>{selected.title}</h3></div><p>{selected.summary}</p></div>
    <div className="course-requirements">
      {selected.requirements.length ? selected.requirements.map((requirement) => {
        const current = progressFor(selected);
        const met = requirementMet(requirement, certifications, diveCount, current, sharedMetRequirementIds);
        const target = 'targetCourseId' in requirement ? requirement.targetCourseId : undefined;
        if (requirement.type === 'manual') return <label key={requirement.id} className={`course-check ${met ? 'met' : 'unmet'}`}>
          <input type="checkbox" checked={met} onChange={() => { if (requirement.id === 'self-medical') { void setSharedSelfMedical(!met); return; } const ids = new Set(current?.metRequirementIds ?? []); met ? ids.delete(requirement.id) : ids.add(requirement.id); void setProgress(selected, current?.status ?? 'planned', [...ids]); }} />
          <span>{requirement.label}</span><b>{met ? 'Confirmed' : 'Tick when complete'}</b>
        </label>;
        return <button key={requirement.id} className={met ? 'met' : 'unmet'} onClick={() => {
          if (requirement.type === 'dives') go('Logbook');
          else if (target) { setSelectedId(target); setTimeout(() => document.getElementById(`course-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }
        }}><i /> <span>{requirement.label}</span><b>{met ? 'Met' : 'View'}</b></button>;
      }) : <p className="focus-copy">No prerequisite certification is listed for this course.</p>}
    </div>
    <div className="course-actions">
      <a className="focus-link" href={selected.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Official course information</a>
      {!['completed','superseded'].includes(courseState(selected, certifications, diveCount, progressFor(selected), sharedMetRequirementIds)) && <>
        {progressFor(selected)?.status === 'ignored'
          ? <button className="focus-secondary" onClick={() => void clearCourseProgress(selected)}>Restore option</button>
          : <button className="focus-secondary" onClick={() => void setProgress(selected, 'ignored')}>Ignore option</button>}
        {progressFor(selected)?.status === 'planned'
          ? <button className="focus-secondary" onClick={() => void clearCourseProgress(selected)}>Remove from plan</button>
          : <button className="focus-secondary" onClick={() => void setProgress(selected, 'planned')}>Plan for future</button>}
        <button className="focus-secondary" onClick={() => void setProgress(selected, 'in-progress')}>Mark in progress</button>
        <button className="focus-primary" onClick={() => void markCompleted(selected)}>Mark completed</button>
      </>}
    </div>
    <small className="course-caution">Course standards can change. Confirm current prerequisites, age, medical and experience rules with the agency and instructor before enrolling.</small>
  </div>;
  return (
    <Card className={`course-planner audit-course-planner panel-${coursePanel} layout-${courseLayout}`}>
      <div className="course-panel-tabs" aria-label="Course planner view"><button className={coursePanel==='map'?'active':''} aria-pressed={coursePanel==='map'} onClick={()=>setCoursePanel('map')}>Map</button><button className={coursePanel==='plan'?'active':''} aria-pressed={coursePanel==='plan'} onClick={()=>setCoursePanel('plan')}>Development plan</button></div>
      <aside className="course-side-panel">
      {sharedMedicalExpanded ? <div className="course-shared-medical">
        <div className="course-medical-head"><div><span className="focus-eyebrow">SHARED RECREATIONAL MEDICAL DECLARATION</span><p>Confirm this once and it applies to every standard self-certified medical requirement in the course map.</p></div>{selfMedicalConfirmed && <button className="focus-icon" aria-label="Collapse medical declaration" onClick={() => setSharedMedicalExpanded(false)}><X size={17} /></button>}</div>
        <label className={`course-check ${selfMedicalConfirmed ? 'met' : 'unmet'}`}>
          <input type="checkbox" checked={selfMedicalConfirmed} onChange={(event) => void setSharedSelfMedical(event.target.checked)} />
          <span>Diver Medical Participant Questionnaire completed; physician approval obtained if the answers require it</span>
          <b>{selfMedicalConfirmed ? 'Confirmed for all' : 'Tick when complete'}</b>
        </label>
        <small>Divemaster and technical-training physician-signed medical clearances remain separate because they have their own requirements and validity periods.</small>
      </div> : <button className="course-medical-summary" aria-expanded="false" onClick={() => setSharedMedicalExpanded(true)}><ShieldCheck size={18} /><span><b>Medical declaration confirmed</b><small>Applies to all standard self-certified course requirements</small></span><ChevronRight size={18} /></button>}
      <section className={`course-development-plan ${developmentPlanMinimised ? 'minimised' : ''}`}>
        <div className="focus-card-head"><div><span className="focus-eyebrow">ORDERED DEVELOPMENT PLAN</span><h3>Your route through training</h3>{!developmentPlanMinimised && <p>Generate an order from the courses you have planned. Missing certification prerequisites are inserted before the courses that need them.</p>}{developmentPlanMinimised && <p>{plannedCourses.length} course{plannedCourses.length === 1 ? '' : 's'} in your current plan.</p>}</div><div className="development-plan-actions"><button className="focus-secondary density-symbol" aria-expanded={!developmentPlanMinimised} aria-label={`${developmentPlanMinimised ? 'Expand' : 'Collapse'} training development plan`} title={`${developmentPlanMinimised ? 'Expand' : 'Collapse'} training development plan`} onClick={() => setDevelopmentPlanMinimised((current) => !current)}><span aria-hidden="true">{developmentPlanMinimised ? '+' : '−'}</span></button>{!developmentPlanMinimised && <button className="focus-primary" onClick={() => void generateDevelopmentPlan()}><ListChecks size={16}/> Generate plan</button>}</div></div>
        {!developmentPlanMinimised && <>{plannedCourses.length ? <ol>{plannedCourses.map((item, index) => <li key={item.course.id}><b>{index + 1}</b><span><strong>{item.course.title}</strong><small>{item.course.stage} · {item.progress.status}</small></span><div><button className="focus-icon" disabled={index === 0} aria-label={`Move ${item.course.title} earlier`} onClick={() => void movePlannedCourse(index, -1)}><ArrowUp size={15}/></button><button className="focus-icon" disabled={index === plannedCourses.length - 1} aria-label={`Move ${item.course.title} later`} onClick={() => void movePlannedCourse(index, 1)}><ArrowDown size={15}/></button></div></li>)}</ol> : <p className="focus-copy">Choose “Plan for future” on a course, then generate your development plan. If nothing is planned yet, the currently selected course becomes the target.</p>}
        {planMessage && <small className="plan-message">{planMessage}</small>}</>}
      </section>
      </aside>
      <div className="course-board-main">
      <div className="course-planner-sticky">
        <div className="course-sticky-toolbar">
          <div className="course-tabs">
            {(['PADI', 'TDI'] as const).map((value) => <button key={value} className={agency === value ? 'active' : ''} onClick={() => { setAgency(value); setCourseCategory('all'); setSelectedId(TRAINING_COURSES.find((course) => course.agency === value)?.id ?? ''); }}>{value}</button>)}
          </div>
          <small className="course-sync-note"><Cloud size={14} /> Synced across devices</small>
        </div>
        {selectedDetail}
      </div>
      <div className="course-legend"><span className="completed">Completed</span><span className="superseded">Included in a higher course</span><span className="ready">Requirements met</span><span className="planned">Planned</span><span className="needed">Needed for a plan</span><span className="in-progress">In progress</span><span className="blocked">Not yet met</span><span className="ignored">Ignored</span></div>
      <div className="course-view-toolbar"><label>Category<select value={courseCategory} onChange={event=>setCourseCategory(event.target.value)}><option value="all">All courses</option><option value="core">Core courses</option>{[...new Set(courses.map(course=>['Safety','Refresh'].includes(course.stage)?'Specialties':course.stage))].filter(stage=>!['Start','Continue','Recognition'].includes(stage)).map(stage=><option key={stage}>{stage}</option>)}</select></label><div className="course-tabs"><button aria-pressed={courseLayout==='grid'} className={courseLayout==='grid'?'active':''} onClick={()=>setCourseLayout('grid')}>Grid</button><button aria-pressed={courseLayout==='list'} className={courseLayout==='list'?'active':''} onClick={()=>setCourseLayout('list')}>List</button></div><div className="course-scroll-controls"><button className="focus-icon" aria-label="Scroll courses left" onClick={()=>laneRef.current?.scrollBy({left:-400,behavior:'smooth'})}><ChevronLeft/></button><button className="focus-icon" aria-label="Scroll courses right" onClick={()=>laneRef.current?.scrollBy({left:400,behavior:'smooth'})}><ChevronRight/></button></div></div>
      <div className="course-lanes" ref={laneRef}>
        {[['Start','Continue','Recognition'].filter(stage=>courses.some(course=>course.stage===stage)), ...[...new Set(courses.map(course=>['Safety','Refresh'].includes(course.stage)?'Specialties':course.stage))].filter(stage=>!['Start','Continue','Recognition'].includes(stage)).map(stage=>[stage])].filter(group=>group.length && (courseCategory==='all' || courseCategory==='core' ? (courseCategory==='all' || group.some(stage=>['Start','Continue','Recognition'].includes(stage))) : group.includes(courseCategory))).map(group=><div className={group.length>1?'course-core-column':'course-stage-column'} key={group[0]}>{group.map((stage) => <section className="course-lane" data-stage={stage} key={stage}>
          <button className="course-lane-toggle" aria-expanded={!collapsedStages.has(stage)} onClick={() => setCollapsedStages((current) => { const next = new Set(current); next.has(stage) ? next.delete(stage) : next.add(stage); return next; })}><span><ChevronRight size={17}/>{stage}</span><b>{courses.filter((course) => (['Safety','Refresh'].includes(course.stage) ? 'Specialties' : course.stage) === stage).length}</b></button>
          {!collapsedStages.has(stage) && <div className="course-map">{courses.filter((course) => (['Safety','Refresh'].includes(course.stage) ? 'Specialties' : course.stage) === stage).sort((a,b)=>Number(['Safety','Refresh'].includes(a.stage) || a.id==='padi-emergency-oxygen')-Number(['Safety','Refresh'].includes(b.stage) || b.id==='padi-emergency-oxygen')).map((course) => {
            const state = courseState(course, certifications, diveCount, progressFor(course), sharedMetRequirementIds);
            const needed = neededCourseIds.has(course.id) && !['completed','superseded','planned','in-progress'].includes(state);
            return <button id={`course-${course.id}`} key={course.id} className={`course-node ${state} ${needed ? 'needed' : ''} ${selected?.id === course.id ? 'selected' : ''}`} onClick={() => setSelectedId(course.id)}>
              <img className="course-art" src={courseArtwork(course.title,course.stage)} alt="" loading="lazy" width={64} height={64}/><span className="course-card-copy"><span>{course.category}</span><strong>{course.title}</strong><small>{state==='completed' ? <Check size={13} aria-hidden="true"/> : state==='in-progress' ? <Clock size={13} aria-hidden="true"/> : <span aria-hidden="true"/>}{state.replace('-', ' ')}</small></span>
            </button>;
          })}</div>}
        </section>)}</div>)}
      </div>
      </div>
    </Card>
  );
}

function courseArtwork(title:string,stage:string) {
  const iconId = resolveZeusTekIconId(`${title} ${stage}`);
  if (iconId) return `/zeustek-icons/transparent/${iconId}.png`;
  const name=title.toLowerCase();
  if(/nitrox|gas|trimix|rebreather/.test(name)) return '/course-art/enriched-air-cylinder.webp';
  if(/navigation|navigator|search/.test(name)) return '/course-art/underwater-compass.webp';
  if(/wreck/.test(name)) return '/course-art/wreck-diver.webp';
  if(/rescue/.test(name)) return '/course-art/rescue-diver.webp';
  if(stage==='Safety' || /first|oxygen|efr/.test(name)) return '/course-art/first-aid-oxygen.webp';
  return '/course-art/open-water-diver.webp';
}

function CourseMapPage({ go }: { go: (next: string) => void }) {
  const [certifications, setCertifications] = useState<Array<Stored<CertificationRecord>>>([]);
  const [progress, setProgress] = useState<Array<Stored<TrainingProgressRecord>>>([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>([]);
  const refresh = useCallback(async () => {
    const [nextCertifications, rawProgress, nextDives] = await Promise.all([listCertifications(), listTrainingProgress(), listDives()]);
    const statusPriority: Record<TrainingProgressRecord['status'], number> = { completed: 4, 'in-progress': 3, planned: 2, ignored: 1 };
    const groups = new Map<string, Array<Stored<TrainingProgressRecord>>>();
    rawProgress.forEach((item) => groups.set(item.courseId, [...(groups.get(item.courseId) ?? []), item]));
    const nextProgress = [...groups.values()].map((items) => {
      const sorted = [...items].sort((a, b) => statusPriority[b.status] - statusPriority[a.status] || b.modifiedAt.localeCompare(a.modifiedAt));
      const canonical = sorted[0]!; // Each group is created from at least one record.
      const orders = items.map((item) => item.planOrder).filter((value): value is number => typeof value === 'number');
      return {
        ...canonical,
        metRequirementIds: [...new Set(items.flatMap((item) => item.metRequirementIds ?? []))],
        ...(orders.length ? { planOrder: Math.min(...orders) } : {}),
      };
    });
    setCertifications(nextCertifications); setProgress(nextProgress); setDives(nextDives);
    // Deduplicate the view only. Reading a course map must never delete source history.

  }, []);
  useRecordRefresh(refresh);
  return <>
    <div className="course-map-page-head">
      <div><span className="focus-eyebrow">PADI · TDI · PREREQUISITES</span><h1>Interactive course maps</h1></div>
      <div className="course-summary-strip"><span><b>{certifications.length}</b> recorded qualifications</span><span><b>{qualifyingPadiSpecialties(certifications)}</b> qualifying PADI specialties</span><span><b>{dives.length}</b> logged dives</span></div>
    </div>
    <CoursePlanner certifications={certifications} progress={progress} diveCount={dives.length} refresh={refresh} go={go} />
  </>;
}

function TrainingV2({ go }: { go: (next: string) => void }) {
  const [items, setItems] = useState<Array<Stored<CertificationRecord>>>([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [catalogOptions, setCatalogOptions] = useState<
    Array<Stored<CatalogOptionRecord>>
  >([]);
  const [search, setSearch] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [editing, setEditing] = useState<Stored<CertificationRecord> | null>(
    null,
  );
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Stored<CertificationRecord> | null>(null);
  const certificationLinkOpened = useRef(false);
  useEffect(() => { if(certificationLinkOpened.current)return;const id=new URLSearchParams(window.location.search).get('certificationId');if(!id){certificationLinkOpened.current=true;return;}const record=items.find(item=>item.entityId===id);if(record){certificationLinkOpened.current=true;setViewing(record);}},[items]);
  const refresh = useCallback(() => {
    void Promise.all([listCertifications(), listCatalogOptions(), listPeople()]).then(
      ([nextItems, nextOptions, nextPeople]) => {
        setItems(nextItems);
        setCatalogOptions(nextOptions);
        setPeople(nextPeople);
        setViewing((current) => current ? nextItems.find((candidate) => candidate.entityId === current.entityId) ?? null : null);
      },
    );
  }, []);
  useRecordRefresh(refresh);
  async function remove(item: Stored<CertificationRecord>) {
    if (!window.confirm(`Delete ${item.certification}?`)) return;
    await deleteCertification(item.entityId);
    refresh();
  }
  const agencies = [...new Set(items.map((item) => item.agency).filter(Boolean))].sort();
  const visibleItems = items
    .filter((item) => {
      const term = search.trim().toLowerCase();
      const textMatch = !term || [item.agency, item.certification, item.level, item.certificationNumber, item.instructor].join(' ').toLowerCase().includes(term);
      return textMatch && (agencyFilter === 'all' || item.agency === agencyFilter);
    })
    .sort((a, b) => {
      if (sort === 'name') return a.certification.localeCompare(b.certification);
      if (sort === 'expiry') return (a.expiresAt || '9999').localeCompare(b.expiresAt || '9999');
      return (b.issuedAt || '').localeCompare(a.issuedAt || '');
    });
  return (
    <>
      <Heading
        eyebrow="ANY AGENCY · CERTIFICATES · EXPIRY"
        title="Certifications"
        copy="Record qualifications from any training agency, including numbers, dates, instructors and certificate images."
        action={
          <button
            className="focus-primary"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus size={16} /> Add certification
          </button>
        }
      />
      <ListToolbar search={search} setSearch={setSearch} filter={agencyFilter} setFilter={setAgencyFilter} filterLabel="Agency" filterOptions={[[ 'all', 'All agencies' ], ...agencies.map((agency) => [agency, agency] as [string, string])]} sort={sort} setSort={setSort} sortOptions={[[ 'newest', 'Newest issued' ], [ 'expiry', 'Expiry date' ], [ 'name', 'Qualification' ]]} />
      {adding && (
        <RevealOnMount><CertificationForm
            item={editing}
            close={() => {
              setAdding(false);
              setEditing(null);
            }}
            saved={refresh}
          /></RevealOnMount>
      )}
      <div className="cert-grid">
        {visibleItems.map((item) => (
          <Card className={`cert-card cert-card-thumb clickable-card ${item.cardFront || item.imageKey ? 'has-image' : 'no-image'}`} key={item.entityId}>
            <button className="card-hit" onClick={() => setViewing(item)} aria-label={`View ${item.certification} details`} />
            {item.cardFront && <CardImageView image={item.cardFront} label={`${item.certification} front`} />}
            {!item.cardFront && item.imageKey &&
              (item.imageName.toLowerCase().endsWith('.pdf') ? (
                <a
                  className="cert-image cert-pdf"
                  href={`/api/cert-image?key=${encodeURIComponent(item.imageKey)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileImage />
                  Open certificate PDF
                </a>
              ) : (
                <img
                  className="cert-image"
                  src={`/api/cert-image?key=${encodeURIComponent(item.imageKey)}`}
                  alt={`${item.agency} ${item.certification} certificate`}
                />
              ))}
            <div className="cert-body">
              <div className="focus-card-head">
                <AgencyMark agency={item.agency} options={catalogOptions} />
                <div className="record-actions">
                  <button
                    onClick={() => {
                      setEditing(item);
                      setAdding(true);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => void remove(item)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <span className="focus-eyebrow">
                {item.agency || 'OTHER AGENCY'}
              </span>
              <h2 className="icon-title"><ZeusTekIcon id={resolveZeusTekIconId(item.certification, 'training')} size={30}/><span>{item.certification}</span></h2>
              <p>
                {[
                  item.level,
                  item.certificationNumber && `No. ${item.certificationNumber}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="cert-dates">
                <span>
                  Issued <b>{item.issuedAt || 'Not recorded'}</b>
                </span>
                <span>
                  Expires <b>{item.expiresAt || 'No expiry'}</b>
                </span>
              </div>
              {item.instructor && <small>Instructor: {people.find((person) => person.entityId === item.instructorId)?.name ?? item.instructor}</small>}
              {externalUrl(item.certificateUrl) && <a className="focus-link" href={externalUrl(item.certificateUrl)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open digital certification</a>}
            </div>
          </Card>
        ))}
        {items.length > 0 && !visibleItems.length && <Card className="focus-empty"><GraduationCap size={28} /><h2>No matching certifications</h2><p>Try a different search or agency.</p></Card>}
        {!items.length && (
          <Card className="focus-empty">
            <GraduationCap size={34} />
            <h2>No certifications yet</h2>
            <p>
              Add PADI, BSAC, SSI, RAID, SDI/TDI, CMAS, IANTD, GUE or any other
              agency.
            </p>
            <button className="focus-primary" onClick={() => setAdding(true)}>
              Add first certification
            </button>
          </Card>
        )}
      </div>
      {viewing && <AccessibleDialog className="cert-detail-dialog" label={`${viewing.certification} certification details`} close={() => setViewing(null)}>
        <button className="focus-icon cert-detail-close" aria-label="Close certification details" onClick={() => setViewing(null)}><X size={18}/></button>
        <Card>
          <div className="focus-card-head"><div><span className="focus-eyebrow">{viewing.agency || 'OTHER AGENCY'}</span><h2>{viewing.certification}</h2></div><AgencyMark agency={viewing.agency} options={catalogOptions}/></div>
          <div className="cert-detail-images">{viewing.cardFront && <section><h3>Front</h3><CardImageView image={viewing.cardFront} label={`${viewing.certification} front`}/></section>}{viewing.cardBack && <section><h3>Back</h3><CardImageView image={viewing.cardBack} label={`${viewing.certification} back`}/></section>}</div>
          {!viewing.cardFront && !viewing.cardBack && viewing.imageKey && (viewing.imageName.toLowerCase().endsWith('.pdf') ? <a className="focus-link" href={`/api/cert-image?key=${encodeURIComponent(viewing.imageKey)}`} target="_blank" rel="noreferrer"><FileImage size={18}/>Open certificate PDF</a> : <img className="cert-detail-legacy" src={`/api/cert-image?key=${encodeURIComponent(viewing.imageKey)}`} alt={`${viewing.agency} ${viewing.certification} certificate`}/>)}
          <div className="detail-grid"><SiteDetail label="Level / grade" value={viewing.level}/><SiteDetail label="Certificate number" value={viewing.certificationNumber}/><SiteDetail label="Issued" value={viewing.issuedAt}/><SiteDetail label="Expires" value={viewing.expiresAt || 'No expiry'}/><SiteDetail label="Course category" value={viewing.courseType}/><SiteDetail label="Notes" value={viewing.notes}/></div>
          {viewing.instructor && <div className="cert-detail-instructor"><span>Instructor</span><strong>{people.find((person) => person.entityId === viewing.instructorId)?.name ?? viewing.instructor}</strong>{viewing.instructorId && <button className="focus-link" onClick={() => { setViewing(null); go('People'); }}>Open in People</button>}</div>}
          <div className="record-actions"><button className="focus-secondary" onClick={() => { setEditing(viewing); setViewing(null); setAdding(true); }}><Pencil size={15}/>Edit certification</button>{externalUrl(viewing.certificateUrl) && <a className="focus-link" href={externalUrl(viewing.certificateUrl)} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Open digital certification</a>}</div>
        </Card>
      </AccessibleDialog>}
    </>
  );
}
function CertificationForm({
  item,
  close,
  saved,
}: {
  item: Stored<CertificationRecord> | null;
  close: () => void;
  saved: () => void;
}) {
  const [agency, setAgency] = useState(item?.agency ?? '');
  const [certification, setCertification] = useState(item?.certification ?? '');
  const [level, setLevel] = useState(item?.level ?? '');
  const [number, setNumber] = useState(item?.certificationNumber ?? '');
  const [issued, setIssued] = useState(item?.issuedAt ?? '');
  const [expires, setExpires] = useState(item?.expiresAt ?? '');
  const [instructor, setInstructor] = useState(item?.instructor ?? '');
  const [instructorId, setInstructorId] = useState(item?.instructorId ?? '');
  const [instructors, setInstructors] = useState<Array<Stored<PersonRecord>>>([]);
  const [instructorFocused, setInstructorFocused] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState(item?.certificateUrl ?? '');
  const [cardFront,setCardFront]=useState<CardImage|null>(item?.cardFront??null);
  const [cardBack,setCardBack]=useState<CardImage|null>(item?.cardBack??null);
  const inferredCourse = TRAINING_COURSES.find((course) => course.agency === item?.agency && course.title.toLowerCase() === item?.certification.toLowerCase());
  const [courseType, setCourseType] = useState<NonNullable<CertificationRecord['courseType']>>(item?.courseType ?? inferredCourse?.category ?? 'other');
  const [awardPriority, setAwardPriority] = useState(item?.awardPriority?.toString() ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [agencyOptions, setAgencyOptions] = useState<string[]>([]);
  const [qualificationOptions, setQualificationOptions] = useState<string[]>(
    [],
  );
  useEffect(() => {
    void Promise.all([listCatalogOptions(), listPeople()]).then(([options, people]) => {
      setAgencyOptions(
        options
          .filter((option) => option.group === 'agency')
          .map((option) => option.value),
      );
      setQualificationOptions(
        options
          .filter((option) => option.group === 'qualification')
          .map((option) => option.value),
      );
      const available = people.filter((person) => person.role === 'instructor' || person.role === 'both');
      setInstructors(available);
      if (item?.instructorId) {
        const linked = available.find((person) => person.entityId === item.instructorId);
        if (linked) setInstructor(linked.name);
      }
    });
  }, [item?.instructorId]);
  const agencies = [
    ...new Set([
      ...DEFAULT_TRAINING_AGENCIES,
      ...agencyOptions,
      ...(agency ? [agency] : []),
    ]),
  ].sort();
  const qualifications = [
    ...new Set([
      ...(agency === 'PADI' || agency === 'TDI'
        ? TRAINING_COURSES.filter((course) => course.agency === agency).map((course) => course.title)
        : [...DEFAULT_DIVE_QUALIFICATIONS, ...OFFICIAL_TRAINING_OPTIONS]),
      ...qualificationOptions,
      ...(certification ? [certification] : []),
    ]),
  ];
  async function submit() {
    if (!agency.trim() || !certification.trim()) return;
    setBusy(true);
    const linkedInstructor = instructors.find((person) => person.entityId === instructorId) ?? instructors.find((person) => person.name.toLowerCase() === instructor.trim().toLowerCase() || person.membershipNumber.toLowerCase() === instructor.trim().toLowerCase());
    await saveCertification({
      ...(item?.entityId ? { entityId: item.entityId } : {}),
      agency: agency.trim(),
      certification: certification.trim(),
      level: level.trim(),
      certificationNumber: number.trim(),
      issuedAt: issued,
      expiresAt: expires,
      instructor: linkedInstructor?.name ?? instructor.trim(),
      instructorId: linkedInstructor?.entityId ?? '',
      certificateUrl: certificateUrl.trim(),
      cardFront,cardBack,
      courseType,
      awardPriority: awardPriority === '' ? null : Number(awardPriority),
      notes: notes.trim(),
      ...(item?.imageKey ? { imageKey: item.imageKey } : {}),
      ...(item?.imageName ? { imageName: item.imageName } : {}),
      image,
    });
    saved();
    close();
  }
  return (
    <Card className="record-form">
      <div className="record-form-head">
        <div>
          <span className="focus-eyebrow">
            {item ? 'EDIT CERTIFICATION' : 'NEW CERTIFICATION'}
          </span>
          <h3>Qualification details</h3>
        </div>
        <button className="focus-icon" aria-label="Close editor" onClick={close}>
          <X size={17} />
        </button>
      </div>
      <div className="record-fields">
        <label>
          Training agency
          <select value={agency} onChange={(e) => setAgency(e.target.value)}>
            <option value="">Choose agency</option>
            {agencies.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Certification
          <select
            value={certification}
            onChange={(e) => {
              const next = e.target.value;
              setCertification(next);
              const matched = TRAINING_COURSES.find((course) => course.agency === agency && course.title === next);
              if (matched) setCourseType(matched.category);
            }}
          >
            <option value="">Choose qualification</option>
            {qualifications.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Level / grade
          <input value={level} onChange={(e) => setLevel(e.target.value)} />
        </label>
        <label>
          Course category
          <select value={courseType} onChange={(e) => setCourseType(e.target.value as NonNullable<CertificationRecord['courseType']>)}>
            <option value="core">Core diver course</option><option value="specialty">Specialty course</option><option value="technical">Technical course</option><option value="professional">Professional course</option><option value="first-aid">First aid / EFR</option><option value="experience">Experience programme</option><option value="other">Other</option>
          </select>
        </label>
        <label>
          Award priority (optional)
          <input type="number" value={awardPriority} onChange={(e) => setAwardPriority(e.target.value)} placeholder="Higher number wins" />
        </label>
        <label>
          Certificate number
          <input value={number} onChange={(e) => setNumber(e.target.value)} />
        </label>
        <label>
          Issued date
          <input
            type="date"
            value={issued}
            onChange={(e) => setIssued(e.target.value)}
          />
        </label>
        <label>
          Expiry / renewal date (optional)
          <input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </label>
        <label>
          Instructor / verifier
          <input role="combobox" aria-expanded={instructorFocused && Boolean(instructor.trim())} aria-controls="cert-instructor-results" autoComplete="off" placeholder="Type a name or instructor ID" value={instructor} onFocus={() => setInstructorFocused(true)} onBlur={() => window.setTimeout(() => setInstructorFocused(false), 120)} onChange={(e) => { const value=e.target.value; setInstructor(value); const exact=instructors.find((person) => person.name.toLowerCase()===value.trim().toLowerCase() || person.membershipNumber.toLowerCase()===value.trim().toLowerCase()); setInstructorId(exact?.entityId ?? ''); }}/>
          {instructorFocused && instructor.trim() && <div id="cert-instructor-results" className="instructor-results" role="listbox">{instructors.filter((person) => `${person.name} ${person.membershipNumber} ${person.agency}`.toLowerCase().includes(instructor.trim().toLowerCase())).slice(0,6).map((person) => <button type="button" role="option" aria-selected={person.entityId===instructorId} key={person.entityId} onMouseDown={(event) => event.preventDefault()} onClick={() => { setInstructor(person.name); setInstructorId(person.entityId); setInstructorFocused(false); }}><strong>{person.name}</strong><span>{[person.agency,person.membershipNumber].filter(Boolean).join(' · ') || 'Instructor record'}</span></button>)}</div>}
          {instructorId && <small>Linked to the People database.</small>}
        </label>
        <label>
          Digital certificate URL
          <input type="url" value={certificateUrl} onChange={(e) => setCertificateUrl(e.target.value)} placeholder="https://" />
        </label>
        <CertificationImages front={cardFront} back={cardBack} change={(side,image) => side === 'front' ? setCardFront(image) : setCardBack(image)} />
        {item?.imageKey && <div className="record-wide"><a className="focus-link" href={`/api/cert-image?key=${encodeURIComponent(item.imageKey)}`} target="_blank" rel="noreferrer">Open legacy certificate attachment</a><p>The original attachment is retained until you choose to remove its reference.</p><button type="button" className="focus-secondary" onClick={async () => {if(confirm('Remove the legacy image reference? The file and record history remain recoverable.')){await saveCertification({...item,imageKey:'',imageName:''});saved();close();}}}>Remove legacy image</button></div>}
        <label className="record-wide">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <footer>
        <button className="focus-secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="focus-primary"
          disabled={busy || !agency.trim() || !certification.trim()}
          onClick={() => void submit()}
        >
          {busy ? 'Saving…' : 'Save certification'}
        </button>
      </footer>
    </Card>
  );
}
function Training() {
  return (
    <>
      <Heading
        eyebrow="QUALIFICATIONS & READINESS"
        title="Planned Training"
        copy="Certifications, medical dates and practice goals with private reminders."
      />
      <div className="focus-grid">
        <Card>
          <ShieldCheck className="focus-accent" />
          <h3>PADI records</h3>
          <p className="focus-copy">
            Import certification cards, logbook evidence or photographed pages.
          </p>
          <button className="focus-secondary">Add training record</button>
        </Card>
        <Card>
          <CalendarDays className="focus-accent" />
          <h3>Readiness reminders</h3>
          <p className="focus-copy">
            Medical, refresher and equipment dates will appear here.
          </p>
        </Card>
      </div>
    </>
  );
}

function Operators() {
  const [items, setItems] = useState<Array<Stored<OperatorRecord>>>([]);
  const [draft, setDraft] = useState({name:'', location:'', website:'', notes:'', entityId:''});
  const refresh = useCallback(() => { void listOperators().then(setItems); }, []); useRecordRefresh(refresh);
  return <details className="focus-card"><summary>Dive operators and centres ({items.length})</summary><div className="record-fields">{(['name','location','website','notes'] as const).map(field => <label key={field}>{field}<input value={draft[field]} onChange={event => setDraft({...draft,[field]:event.target.value})}/></label>)}</div><button className="focus-primary" disabled={!draft.name.trim()} onClick={async () => {await saveOperator({...draft, website:externalUrl(draft.website)});setDraft({name:'', location:'', website:'', notes:'', entityId:''});refresh();}}>Save operator</button>{items.map(item => <div className="focus-card-head" key={item.entityId}><span>{item.name} · {item.location}</span><div className="record-actions"><button onClick={() => setDraft(item)}>Edit operator</button><button onClick={async () => {const people=await listPeople();if(people.some(person => person.operatorId===item.entityId)){alert('Reassign people linked to this operator before deleting it.');return;}if(confirm(`Delete ${item.name}?`)){await deleteOperator(item.entityId);refresh();}}}>Delete operator</button></div></div>)}</details>;
}

function People() {
  const [items, setItems] = useState<Array<Stored<PersonRecord>>>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [operators, setOperators] = useState<Array<Stored<OperatorRecord>>>([]);
  const [operatorFilter, setOperatorFilter] = useState('all');
  useRecordRefresh(useCallback(() => {void listOperators().then(setOperators);}, []));
  const [sort, setSort] = useState('name');
  const [editing, setEditing] = useState<Stored<PersonRecord> | null>(null);
  const [viewing, setViewing] = useState<Stored<PersonRecord> | null>(null);
  const [adding, setAdding] = useState(false);
  const refresh = useCallback(() => {
    void listPeople().then(setItems);
  }, []);
  useRecordRefresh(refresh);
  const linkedPersonOpened=useRef(false);
  useEffect(()=>{if(linkedPersonOpened.current)return;const id=new URLSearchParams(window.location.search).get('personId');const target=items.find(person=>person.entityId===id);if(target){setViewing(target);linkedPersonOpened.current=true;}},[items]);
  async function remove(item: Stored<PersonRecord>) {
    if (!confirm(`Delete ${item.name}?`)) return;
    await deletePerson(item.entityId);
    refresh();
  }
  const roles = [...new Set(items.map((item) => item.role).filter(Boolean))].sort();
  const visibleItems = items
    .filter((item) => {
      const term = search.trim().toLowerCase();
      const textMatch = !term || [item.name, item.role, item.highestQualification, item.agency, item.membershipNumber].join(' ').toLowerCase().includes(term);
      return textMatch && (roleFilter === 'all' || item.role === roleFilter) && (operatorFilter === 'all' || item.operatorId === operatorFilter);
    })
    .sort((a, b) => sort === 'qualification'
      ? (a.highestQualification || 'zzz').localeCompare(b.highestQualification || 'zzz')
      : sort === 'agency'
        ? (a.agency || 'zzz').localeCompare(b.agency || 'zzz')
        : a.name.localeCompare(b.name));
  return (
    <>
      <Heading
        eyebrow="BUDDIES · INSTRUCTORS · CONTACTS"
        title="Dive people"
        copy="Keep each person once, then select them in logs, training records and dive plans."
        action={
          <button
            className="focus-primary"
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus size={16} /> Add person
          </button>
        }
      />
      <Operators /><label className="operator-filter">Dive operator<select value={operatorFilter} onChange={event => setOperatorFilter(event.target.value)}><option value="all">All operators</option>{operators.map(operator => <option key={operator.entityId} value={operator.entityId}>{operator.name}</option>)}</select></label>
      <ListToolbar search={search} setSearch={setSearch} filter={roleFilter} setFilter={setRoleFilter} filterLabel="Role" filterOptions={[[ 'all', 'All people' ], ...roles.map((role) => [role, role] as [string, string])]} sort={sort} setSort={setSort} sortOptions={[[ 'name', 'Name' ], [ 'qualification', 'Qualification' ], [ 'agency', 'Agency' ]]} />
      {adding && (
        <RevealOnMount>
          <PersonForm
            item={editing}
            close={() => {
              setAdding(false);
              setEditing(null);
            }}
            saved={refresh}
          />
        </RevealOnMount>
      )}
      <div className="focus-grid">
        {visibleItems.map((item) => (
          <Card key={item.entityId} className="clickable-card">
            <button
              className="card-hit"
              onClick={() => setViewing(item)}
              aria-label={`View ${item.name}`}
            />
            <div className="focus-card-head">
              {item.profileImage ? <div className="person-image"><CardImageView image={item.profileImage} label={`${item.name} profile`}/></div> : item.profileImageId ? <img className="person-avatar" loading="lazy" src={`/api/media?id=${encodeURIComponent(item.profileImageId)}`} alt={`${item.name} profile`} /> : <Users className="focus-accent" />}
              <div className="record-actions">
                <button
                  onClick={() => {
                    setEditing(item);
                    setAdding(true);
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button onClick={() => void remove(item)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <span className="focus-eyebrow">{item.role.toUpperCase()}</span>{item.operatorId && <p>{operators.find(operator => operator.entityId === item.operatorId)?.name ?? 'Operator unavailable'}</p>}
            <h3>{item.name}</h3>
            <p className="focus-copy">
              {[item.highestQualification, item.agency, item.membershipNumber]
                .filter(Boolean)
                .join(' · ') || 'Personal dive contact'}
            </p>
          </Card>
        ))}
        {items.length > 0 && !visibleItems.length && <Card className="focus-empty"><Users size={28} /><h2>No matching people</h2><p>Try a different search or role.</p></Card>}
      </div>
      {!items.length && (
        <Card className="focus-empty">
          <Users />
          <h2>No dive people yet</h2>
          <p>
            Add buddies and instructors once, then reuse their details
            everywhere.
          </p>
        </Card>
      )}
      {viewing && (
        <RecordDetail
          title={viewing.name}
          eyebrow={viewing.role}
          ownerKind="person"
          ownerId={viewing.entityId}
          close={() => setViewing(null)}
          edit={() => {
            setEditing(viewing);
            setViewing(null);
            setAdding(true);
          }}
          rows={[
            ['Agency', viewing.agency],
            ['Highest known qualification', viewing.highestQualification],
            ['Membership / professional number', viewing.membershipNumber],
            ['Email', viewing.email],
            ['Phone', viewing.phone],
            ['Emergency contact', viewing.emergencyContact],
            ['Notes', viewing.notes],
          ]}
          links={[["Open buddy profile", viewing.profileUrl]]}
        />
      )}
    </>
  );
}
function PersonForm({
  item,
  close,
  saved,
}: {
  item: Stored<PersonRecord> | null;
  close: () => void;
  saved: () => void;
}) {
  const [v, setV] = useState(() => ({
    name: item?.name ?? '',
    role: item?.role ?? 'buddy',
    agency: item?.agency ?? '',
    highestQualification: item?.highestQualification ?? '',
    membershipNumber: item?.membershipNumber ?? '',
    email: item?.email ?? '',
    phone: item?.phone ?? '',
    emergencyContact: item?.emergencyContact ?? '',
    profileUrl: item?.profileUrl ?? '',
    operatorId: item?.operatorId ?? '',
    profileImageId: item?.profileImageId ?? '',
    profileImage: item?.profileImage ?? null,
    notes: item?.notes ?? '',
  }));
  const [operators, setOperators] = useState<Array<Stored<OperatorRecord>>>([]);
  useRecordRefresh(useCallback(() => { void listOperators().then(setOperators); }, []));
  const [customAgencies, setCustomAgencies] = useState<string[]>([]);
  const [customQualifications, setCustomQualifications] = useState<string[]>(
    [],
  );
  useEffect(() => {
    void listCatalogOptions().then((options) => {
      setCustomAgencies(
        options
          .filter((option) => option.group === 'agency')
          .map((option) => option.value),
      );
      setCustomQualifications(
        options
          .filter((option) => option.group === 'qualification')
          .map((option) => option.value),
      );
    });
  }, []);
  const personAgencies = [
    ...new Set([
      ...DEFAULT_TRAINING_AGENCIES,
      ...customAgencies,
      ...(v.agency ? [v.agency] : []),
    ]),
  ].sort();
  const personQualifications = [
    ...new Set([
      ...DEFAULT_DIVE_QUALIFICATIONS,
      ...customQualifications,
      ...(v.highestQualification ? [v.highestQualification] : []),
    ]),
  ].sort();
  const field = <K extends keyof typeof v>(name: K, value: typeof v[K]) =>
    setV((c) => ({ ...c, [name]: value }));
  async function submit() {
    if (!v.name.trim()) return;
    await savePerson({
      ...v,
      ...(item ? { entityId: item.entityId } : {}),
      name: v.name.trim(),
      role: v.role as PersonRecord['role'],
    });
    saved();
    close();
  }
  return (
    <Card className="record-form">
      <div className="record-form-head">
        <h3>{item ? 'Edit person' : 'Add buddy or instructor'}</h3>
        <button className="focus-icon" aria-label="Close editor" onClick={close}>
          <X />
        </button>
      </div>
      <div className="record-fields"><label>Current dive operator<select value={v.operatorId} onChange={event => field('operatorId',event.target.value)}><option value="">No operator assigned</option>{operators.map(operator => <option key={operator.entityId} value={operator.entityId}>{operator.name}</option>)}</select></label><ProfilePicture value={v.profileImage} legacyId={v.profileImageId} change={value => field('profileImage',value)} removeLegacy={() => field('profileImageId','')} />

        <label>
          Name
          <input
            value={v.name}
            onChange={(e) => field('name', e.target.value)}
          />
        </label>
        <label>
          Role
          <select
            value={v.role}
            onChange={(e) => field('role', e.target.value as PersonRecord['role'])}
          >
            <option value="buddy">Buddy</option>
            <option value="instructor">Instructor</option>
            <option value="both">Buddy & instructor</option>
          </select>
        </label>
        <label>
          Agency
          <select
            value={v.agency}
            onChange={(e) => field('agency', e.target.value)}
          >
            <option value="">Unknown / not recorded</option>
            {personAgencies.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Highest known qualification
          <select
            value={v.highestQualification}
            onChange={(e) => field('highestQualification', e.target.value)}
          >
            <option value="">Unknown / not recorded</option>
            {personQualifications.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Membership / professional no.
          <input
            value={v.membershipNumber}
            onChange={(e) => field('membershipNumber', e.target.value)}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={v.email}
            onChange={(e) => field('email', e.target.value)}
          />
        </label>
        <label>
          Phone
          <input
            value={v.phone}
            onChange={(e) => field('phone', e.target.value)}
          />
        </label>
        <label>
          Emergency contact
          <input
            value={v.emergencyContact}
            onChange={(e) => field('emergencyContact', e.target.value)}
          />
        </label>
        <label>
          Profile or membership URL
          <input type="url" value={v.profileUrl} onChange={(e) => field('profileUrl', e.target.value)} placeholder="https://" />
        </label>
        <label className="record-wide">
          Notes
          <textarea
            value={v.notes}
            onChange={(e) => field('notes', e.target.value)}
          />
        </label>
      </div>
      <footer>
        <button className="focus-secondary" onClick={close}>
          Cancel
        </button>
        <button className="focus-primary" onClick={() => void submit()}>
          Save person
        </button>
      </footer>
    </Card>
  );
}

function SiteAlbums({site}:{site:Stored<DiveSiteRecord>}) {
 const [albums,setAlbums]=useState<Array<Stored<AlbumRecord>>>([]); const [opened,setOpened]=useState<Stored<AlbumRecord>|null>(null);
 const refresh=useCallback(()=>{void listAlbums().then(setAlbums);},[]);useRecordRefresh(refresh);
 return <section><h3>Linked albums</h3>{albums.filter(a=>a.siteId===site.entityId || (!a.siteId && a.siteName===site.name)).map(a=><button className="focus-secondary" key={a.entityId} onClick={()=>setOpened(a)}>{a.title}</button>)}<label>Tag an album to this site<select value="" onChange={async e=>{const album=albums.find(a=>a.entityId===e.target.value);if(album){await saveAlbum({...album,siteId:site.entityId,siteName:site.name});refresh();}}}><option value="">Choose an album</option>{albums.map(a=><option key={a.entityId} value={a.entityId}>{a.title}</option>)}</select></label>{opened&&<RecordDetail title={opened.title} eyebrow="DIVE ALBUM" ownerKind="album" ownerId={opened.entityId} close={()=>setOpened(null)} rows={[["Site",site.name]]}/>}</section>;
}
function AlbumSiteTag({album,changed}:{album:Stored<AlbumRecord>;changed:(value:Stored<AlbumRecord>)=>void}) {
 const [sites,setSites]=useState<Array<Stored<DiveSiteRecord>>>([]);useEffect(()=>{void listDiveSites().then(setSites);},[]);
 return <label>Tagged dive site<select value={album.siteId ?? sites.find(s=>s.name===album.siteName)?.entityId ?? ''} onChange={async e=>{const site=sites.find(s=>s.entityId===e.target.value);const next={...album,siteId:site?.entityId??'',siteName:site?.name??''};await saveAlbum(next);changed(next);}}><option value="">No site tag</option>{sites.map(s=><option key={s.entityId} value={s.entityId}>{s.name}</option>)}</select></label>;
}
function Albums() {
  const [items, setItems] = useState<Array<Stored<AlbumRecord>>>([]);
  const [viewing, setViewing] = useState<Stored<AlbumRecord> | null>(null);
  const [title, setTitle] = useState('');
  const [slideAlbumIds, setSlideAlbumIds] = useState<string[]>([]);
  const [slideInterval, setSlideInterval] = useState(10);
  const [slideshow, setSlideshow] = useState(false);
  const refresh = useCallback(() => {
    void listAlbums().then(setItems);
  }, []);
  useRecordRefresh(refresh);
  async function add() {
    if (!title.trim()) return;
    await saveAlbum({
      title: title.trim(),
      date: new Date().toISOString().slice(0, 10),
      siteName: '',
      planId: '',
      notes: '',
    });
    setTitle('');
    refresh();
  }
  async function remove(item: Stored<AlbumRecord>) {
    if (
      !confirm(
        `Delete album ${item.title}? Attached media must be removed separately.`,
      )
    )
      return;
    await deleteAlbum(item.entityId);
    refresh();
  }
  return (
    <>
      <Heading
        eyebrow="PHOTOS · VIDEOS · NOTES"
        title="Dive albums"
        copy="Private cloud albums for trips, sites, courses and individual dives."
      />
      <Card className="album-create">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New album name"
        />
        <button className="focus-primary" onClick={() => void add()}>
          <Plus size={15} /> Create album
        </button>
      </Card>
      <Card className="album-slideshow-setup">
        <div><span className="focus-eyebrow">FULL-SCREEN SLIDESHOW</span><h2>Screen saver mode</h2><p className="focus-copy">Choose one or more albums and automatically loop through their full-resolution photos.</p></div>
        <div className="album-picks">{items.map((item) => <label key={item.entityId}><input type="checkbox" checked={slideAlbumIds.includes(item.entityId)} onChange={(event) => setSlideAlbumIds((current) => event.target.checked ? [...current, item.entityId] : current.filter((id) => id !== item.entityId))} />{item.title}</label>)}</div>
        <div className="record-actions"><button className="focus-secondary" onClick={() => setSlideAlbumIds(items.map((item) => item.entityId))}>Select all</button><label>Change image every <select value={slideInterval} onChange={(event) => setSlideInterval(Number(event.target.value))}><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></label><button className="focus-primary" disabled={!slideAlbumIds.length} onClick={() => { setSlideshow(true); void document.documentElement.requestFullscreen?.(); }}>Start slideshow</button></div>
      </Card>
      <div className="focus-grid">
        {items.map((item) => (
          <Card key={item.entityId} className="clickable-card">
            <button className="card-hit" onClick={() => setViewing(item)} />
            <div className="focus-card-head">
              <Images className="focus-accent" />
              <button className="focus-icon" onClick={() => void remove(item)}>
                <Trash2 size={15} />
              </button>
            </div>
            <h3>{item.title}</h3>
            <p className="focus-copy">
              {item.notes || 'Open to add photos, videos and notes.'}
            </p>
          </Card>
        ))}
      </div>
      {viewing && (
        <RecordDetail
          title={viewing.title}
          eyebrow="DIVE ALBUM"
          ownerKind="album"
          ownerId={viewing.entityId}
          close={() => setViewing(null)}
          rows={[
            ['Date', viewing.date],
            ['Site', viewing.siteName],
            ['Notes', viewing.notes],
          ]}
        ><AlbumSiteTag album={viewing} changed={setViewing}/></RecordDetail>
      )}
      {slideshow && <AlbumSlideshow albumIds={slideAlbumIds} intervalSeconds={slideInterval} close={() => { setSlideshow(false); if (document.fullscreenElement) void document.exitFullscreen(); }} />}
    </>
  );
}

function AlbumSlideshow({ albumIds, intervalSeconds, close }: { albumIds: string[]; intervalSeconds: number; close: () => void }) {
  const [photos, setPhotos] = useState<Array<{ id: string; caption: string; fileName: string }>>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    void Promise.all(albumIds.map((ownerId) => fetch(`/api/media?kind=album&ownerId=${encodeURIComponent(ownerId)}`, { cache: 'no-store' }).then((response) => response.json() as Promise<{ items?: Array<{ id: string; caption: string; fileName: string; contentType: string }> }>))).then((results) => setPhotos(results.flatMap((result) => result.items ?? []).filter((item) => item.contentType.startsWith('image/'))));
  }, [albumIds]);
  useEffect(() => {
    if (!playing || photos.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % photos.length), intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [playing, photos.length, intervalSeconds]);
  useEffect(() => { if (index >= photos.length) setIndex(0); }, [index, photos.length]);
  const photo = photos[index];
  return <div className="album-slideshow" role="dialog" aria-modal="true" aria-label="Album slideshow">
    <button className="slideshow-close" onClick={close} aria-label="Close slideshow"><X /></button>
    {!photo ? <div className="focus-empty"><Images size={42}/><h2>{photos.length ? 'Preparing slideshow…' : 'No photos found in the selected albums'}</h2></div> : <><img src={`/api/media?id=${photo.id}`} alt={photo.caption || photo.fileName}/><div className="slideshow-caption"><strong>{photo.caption || photo.fileName}</strong><span>{index + 1} of {photos.length}</span></div></>}
    {photos.length > 1 && <div className="slideshow-controls"><button onClick={() => setIndex((index - 1 + photos.length) % photos.length)} aria-label="Previous"><ChevronLeft /></button><button onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Resume'}</button><button onClick={() => setIndex((index + 1) % photos.length)} aria-label="Next"><ChevronRight /></button></div>}
  </div>;
}

function DiveBucketList() {
  const [items, setItems] = useState<Array<Stored<BucketListRecord>>>([]);
  const [editing, setEditing] = useState<Stored<BucketListRecord> | null>(null);
  const [adding, setAdding] = useState(false);
  const refresh = useCallback(() => { void listBucketList().then(setItems); }, []);
  useRecordRefresh(refresh);
  return <>
    <Heading eyebrow="DREAM · RESEARCH · PLAN" title="Bucket List" copy="Keep future dive locations, liveaboards and dive safaris together until they become real plans." action={<button className="focus-primary" onClick={() => { setEditing(null); setAdding(true); }}><Plus size={16}/> Add bucket-list dive</button>} />
    {adding && <RevealOnMount><BucketListForm item={editing} close={() => { setAdding(false); setEditing(null); }} saved={refresh}/></RevealOnMount>}
    <div className="wishlist-grid">{items.sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name)).map((item) => <Card key={item.entityId} className="wish-card"><div className="focus-card-head"><div><span className="focus-eyebrow">{item.kind.replaceAll('-', ' ')} · {item.status}</span><h2>{item.name}</h2></div><div className="record-actions"><button onClick={() => { setEditing(item); setAdding(true); }}><Pencil size={15}/></button><button onClick={() => { if (confirm(`Delete ${item.name}?`)) void deleteBucketList(item.entityId).then(refresh); }}><Trash2 size={15}/></button></div></div><p>{item.country}</p><p className="focus-copy">{item.description || item.why}</p><div className="wish-meta">{item.targetDate && <span>Target {item.targetDate}</span>}{item.approximateCost && <span>{item.approximateCost}</span>}</div>{externalUrl(item.url) && <a className="focus-link" href={externalUrl(item.url)} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open research link</a>}</Card>)}</div>
    {!items.length && !adding && <Card className="focus-empty"><ListChecks size={32}/><h2>Your bucket list is empty</h2><p>Add the wreck, reef, liveaboard or safari you keep thinking about.</p></Card>}
  </>;
}

function BucketListForm({ item, close, saved }: { item: Stored<BucketListRecord> | null; close: () => void; saved: () => void }) {
  const [sites,setSites]=useState<Array<Stored<DiveSiteRecord>>>([]);
  useEffect(()=>{void listDiveSites().then(setSites);},[]);
  const [value, setValue] = useState({siteId:item?.siteId??'', name: item?.name ?? '', kind: item?.kind ?? 'dive-location' as BucketListRecord['kind'], country: item?.country ?? '', url: item?.url ?? '', targetDate: item?.targetDate ?? '', approximateCost: item?.approximateCost ?? '', description: item?.description ?? '', why: item?.why ?? '', status: item?.status ?? 'dreaming' as BucketListRecord['status'] });
  const field = <K extends keyof typeof value>(key: K, next: typeof value[K]) => setValue((current) => ({ ...current, [key]: next }));
  async function submit() { if (!value.name.trim()) return; await saveBucketList({ ...(item ? { entityId: item.entityId } : {}), ...value, name: value.name.trim() }); saved(); close(); }
  return <Card className="record-form"><div className="record-form-head"><div><span className="focus-eyebrow">{item ? 'EDIT BUCKET LIST' : 'NEW BUCKET LIST IDEA'}</span><h3>{item ? 'Update future dive' : 'Add a future dive'}</h3></div><button className="focus-icon" aria-label="Close editor" onClick={close}><X size={17}/></button></div><div className="record-fields">
    <label>Linked dive site (optional)<select value={value.siteId} onChange={event=>field('siteId',event.target.value)}><option value="">Not linked to a site</option>{sites.map(site=><option key={site.entityId} value={site.entityId}>{site.name}</option>)}</select><small>Sites with coordinates appear in the optional map layer.</small></label><label>Type<select value={value.kind} onChange={(event) => field('kind', event.target.value as BucketListRecord['kind'])}><option value="dive-location">Dive location</option><option value="liveaboard">Liveaboard</option><option value="dive-safari">Dive safari</option></select></label><label>Name<input value={value.name} onChange={(event) => field('name', event.target.value)}/></label><label>Country / region<input value={value.country} onChange={(event) => field('country', event.target.value)}/></label><label>Status<select value={value.status} onChange={(event) => field('status', event.target.value as BucketListRecord['status'])}><option value="dreaming">Dreaming</option><option value="researching">Researching</option><option value="planned">Planned</option><option value="completed">Completed</option></select></label><label>Target date<input type="date" value={value.targetDate} onChange={(event) => field('targetDate', event.target.value)}/></label><label>Approximate cost<input value={value.approximateCost} onChange={(event) => field('approximateCost', event.target.value)} placeholder="e.g. £2,500"/></label><label className="record-wide">Research URL<input type="url" value={value.url} onChange={(event) => field('url', event.target.value)}/></label><label className="record-wide">Description<textarea value={value.description} onChange={(event) => field('description', event.target.value)}/></label><label className="record-wide">Why I want to do it<textarea value={value.why} onChange={(event) => field('why', event.target.value)}/></label>
  </div><footer><button className="focus-secondary" onClick={close}>Cancel</button><button className="focus-primary" disabled={!value.name.trim()} onClick={() => void submit()}>Save bucket-list dive</button></footer></Card>;
}

function wishlistCostValue(value: string) {
  const cleaned = value.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function normaliseWishlistCost(value: string) {
  const original = value.trim();
  if (!original) return { approximateCost: '', originalApproximateCost: '', exchangeRateDate: '' };
  const codeMatch = original.toUpperCase().match(/\b(GBP|USD|EUR|CAD|AUD|NZD|JPY|CHF|SEK|NOK|DKK|ZAR)\b/);
  const currency = codeMatch?.[1] ?? (original.includes('£') ? 'GBP' : original.includes('€') ? 'EUR' : original.includes('$') ? 'USD' : 'GBP');
  const amount = wishlistCostValue(original);
  if (!amount && amount !== 0) return { approximateCost: original, originalApproximateCost: '', exchangeRateDate: '' };
  const pounds = (gbp: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(gbp);
  if (currency === 'GBP') return { approximateCost: pounds(amount), originalApproximateCost: '', exchangeRateDate: '' };
  const response = await fetch(`/api/currency?from=${currency}&amount=${encodeURIComponent(amount)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Currency conversion is temporarily unavailable');
  const result = await response.json() as { gbp: number; date?: string };
  return { approximateCost: pounds(result.gbp), originalApproximateCost: original, exchangeRateDate: result.date ?? '' };
}

function wishlistGroupPath(group: Stored<GearWishlistGroupRecord>, groups: Array<Stored<GearWishlistGroupRecord>>) {
  const names = [group.name];
  let parentId = group.parentId;
  const visited = new Set([group.entityId]);
  while (parentId) {
    const parent = groups.find((candidate) => candidate.entityId === parentId);
    if (!parent || visited.has(parent.entityId)) break;
    names.unshift(parent.name);
    visited.add(parent.entityId);
    parentId = parent.parentId;
  }
  return names.join(' › ');
}

function GearWishlist() {
  const [items, setItems] = useState<Array<Stored<GearWishlistRecord>>>([]);
  const [editing, setEditing] = useState<Stored<GearWishlistRecord> | null>(null);
  const [adding, setAdding] = useState(false);
  const [groups, setGroups] = useState<Array<Stored<GearWishlistGroupRecord>>>([]); const [groupName, setGroupName] = useState((DEFAULT_GEAR_CATEGORIES[0] ?? 'Other')); const [groupParent, setGroupParent] = useState(''); const [addingGroup, setAddingGroup] = useState(false); const [catalogOptions, setCatalogOptions] = useState<Array<Stored<CatalogOptionRecord>>>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const refresh = useCallback(() => { void Promise.all([listGearWishlist(), listGearWishlistGroups(), listCatalogOptions()]).then(([nextItems, nextGroups, options]) => { setItems(nextItems); setGroups(nextGroups); setCatalogOptions(options); }); }, []);
  useRecordRefresh(refresh);
  const savingsItems = items.filter((item) => item.includeInSavings);
  const savingsTotal = savingsItems.reduce((total, item) => total + wishlistCostValue(item.approximateCost), 0);
  async function toggleSavings(item: Stored<GearWishlistRecord>) { await saveGearWishlist({ ...item, includeInSavings: !item.includeInSavings }); refresh(); }
  async function moveItem(entityId: string, wishlistGroupId: string) { const item = items.find((entry) => entry.entityId === entityId); if (!item) return; await saveGearWishlist({ ...item, wishlistGroupId }); refresh(); }
  async function addGroup() { if (!groupName.trim()) return; await saveGearWishlistGroup({ name: groupName.trim(), parentId: groupParent }); setGroupName((DEFAULT_GEAR_CATEGORIES[0] ?? 'Other')); setGroupParent(''); setAddingGroup(false); refresh(); }
  async function removeGroup(group: Stored<GearWishlistGroupRecord>) { if (!confirm(`Remove ${group.name}? Items will move ${group.parentId ? 'to its parent group' : 'to Unsorted'}.`)) return; await Promise.all([...items.filter((item) => item.wishlistGroupId === group.entityId).map((item) => saveGearWishlist({ ...item, wishlistGroupId: group.parentId })), ...groups.filter((child) => child.parentId === group.entityId).map((child) => saveGearWishlistGroup({ ...child, parentId: group.parentId }))]); await deleteGearWishlistGroup(group.entityId); refresh(); }
  const groupPriceRange = (rootId: string) => {
    const groupIds = new Set([rootId]);
    let changed = true;
    while (changed) { changed = false; for (const group of groups) if (group.parentId && groupIds.has(group.parentId) && !groupIds.has(group.entityId)) { groupIds.add(group.entityId); changed = true; } }
    const prices = items.filter((item) => groupIds.has(item.wishlistGroupId || '')).map((item) => wishlistCostValue(item.approximateCost)).filter((price) => price > 0);
    if (!prices.length) return 'No prices saved';
    const format = (price: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(price);
    const minimum = Math.min(...prices); const maximum = Math.max(...prices);
    return minimum === maximum ? format(minimum) : `${format(minimum)}–${format(maximum)}`;
  };
  const toggleGroup = (groupId: string) => setCollapsedGroups((current) => { const next = new Set(current); if (next.has(groupId)) next.delete(groupId); else next.add(groupId); return next; });
  const itemCard = (item: Stored<GearWishlistRecord>) => <div className="wishlist-drag-item" draggable onDragStart={(event) => { event.dataTransfer.setData('text/wishlist-item', item.entityId); event.dataTransfer.effectAllowed = 'move'; }}><GearWishlistCard item={item} refresh={refresh} edit={() => { setEditing(item); setAdding(true); }} toggleSavings={() => void toggleSavings(item)}/><WishlistGroupControls item={item} groups={groups} moveItem={moveItem}/></div>;
  const groupSection = (group: Stored<GearWishlistGroupRecord>, depth = 0): React.ReactNode => {
    const collapsed = collapsedGroups.has(group.entityId);
    return <section key={group.entityId} className={`wishlist-group${collapsed ? ' is-collapsed' : ''}`} style={{ '--group-depth': depth } as React.CSSProperties} onDragOver={(event) => { if (event.dataTransfer.types.includes('text/wishlist-item')) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); void moveItem(event.dataTransfer.getData('text/wishlist-item'), group.entityId); }}><header><div className="wishlist-group-title">{depth === 0 && <img src={equipmentIconSource(group.name, catalogOptions)} alt=""/>}<span><span className="focus-eyebrow">{depth ? 'CUSTOM SUBGROUP' : 'EQUIPMENT GROUP'}</span><h2>{group.name}</h2><small>{items.filter((item) => item.wishlistGroupId === group.entityId).length} direct items{depth === 0 && <> · <strong>{groupPriceRange(group.entityId)}</strong></>}</small></span></div><div><button className="focus-icon wishlist-collapse density-symbol" onClick={() => toggleGroup(group.entityId)} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.name}`} title={collapsed ? 'Expand group' : 'Collapse group'}><span aria-hidden="true">{collapsed ? '+' : '−'}</span></button><button className="focus-secondary" onClick={() => { setGroupName(''); setGroupParent(group.entityId); setAddingGroup(true); }}><Plus size={14}/> Subgroup</button><button className="focus-icon" aria-label={`Remove group ${group.name}`} onClick={() => void removeGroup(group)}><Trash2 size={14}/></button></div></header>{!collapsed && <><div className="wishlist-grid">{items.filter((item) => item.wishlistGroupId === group.entityId).map(itemCard)}</div>{groups.filter((child) => child.parentId === group.entityId).map((child) => groupSection(child, depth + 1))}</>}</section>;
  };
  return <>
    <Heading eyebrow="RESEARCH · SHORTLIST · BUY" title="Gear wishlist" copy="Save equipment ideas and drag items into your own nested groups." action={<div className="wishlist-heading-actions"><button className="focus-secondary" onClick={() => { setGroupName((DEFAULT_GEAR_CATEGORIES[0] ?? 'Other')); setGroupParent(''); setAddingGroup((value) => !value); }}><Plus size={16}/> Add group</button><button className="focus-primary" onClick={() => { setEditing(null); setAdding(true); }}><Plus size={16}/> Add wishlist item</button></div>} />
    <Card className="wishlist-savings-total"><div><span className="focus-eyebrow">SHOPPING TOTAL</span><strong>{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(savingsTotal)}</strong><small>{savingsItems.length} {savingsItems.length === 1 ? 'item' : 'items'} selected to save for</small></div><ZeusTekAssetIcon name="core-logbook-icons-equipment" label="Equipment wishlist" size={42} fallback={<ShoppingBag size={30}/>}/></Card>
    {addingGroup && <Card className="wishlist-group-form"><label>{groupParent ? 'Custom subgroup name' : 'Equipment group'}{groupParent ? <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. XDeep Stealth Tec"/> : <select value={groupName} onChange={(event) => setGroupName(event.target.value)}>{[...new Set([...DEFAULT_GEAR_CATEGORIES, ...catalogOptions.filter((option) => option.group === 'category').map((option) => option.value)])].sort().map((value) => <option key={value} value={value}>{value}</option>)}</select>}</label><label>Inside<select value={groupParent} onChange={(event) => { setGroupParent(event.target.value); setGroupName(event.target.value ? '' : (DEFAULT_GEAR_CATEGORIES[0] ?? 'Other')); }}><option value="">Top level</option>{groups.map((group) => <option key={group.entityId} value={group.entityId}>{group.name}</option>)}</select></label><button className="focus-secondary" onClick={() => setAddingGroup(false)}>Cancel</button><button className="focus-primary" disabled={!groupName.trim()} onClick={() => void addGroup()}>Save group</button></Card>}
    {adding && <RevealOnMount><GearWishlistForm item={editing} groups={groups} close={() => { setAdding(false); setEditing(null); }} saved={refresh}/></RevealOnMount>}
    {groups.filter((group) => !group.parentId).map((group) => groupSection(group))}
    <section className="wishlist-group wishlist-unsorted" onDragOver={(event) => { if (event.dataTransfer.types.includes('text/wishlist-item')) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); void moveItem(event.dataTransfer.getData('text/wishlist-item'), ''); }}><header><div><span className="focus-eyebrow">DROP HERE TO REMOVE FROM A GROUP</span><h2>Unsorted</h2></div></header><div className="wishlist-grid">{items.filter((item) => !item.wishlistGroupId || !groups.some((group) => group.entityId === item.wishlistGroupId)).map(itemCard)}</div></section>
    {!items.length && !adding && <Card className="focus-empty"><ShoppingBag size={32}/><h2>No gear ideas saved</h2><p>Add regulators, computers, suits or any other kit you want to compare.</p></Card>}
  </>;
}

function WishlistGroupControls({ item, groups, moveItem }: { item: Stored<GearWishlistRecord>; groups: Array<Stored<GearWishlistGroupRecord>>; moveItem: (entityId: string, wishlistGroupId: string) => Promise<void> }) {
  const [selectedGroupId, setSelectedGroupId] = useState(item.wishlistGroupId || '');
  useEffect(() => setSelectedGroupId(item.wishlistGroupId || ''), [item.wishlistGroupId]);
  return <div className="wishlist-group-controls" onDragStart={(event) => event.preventDefault()}>
    <label><span>Assign to group</span><select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}><option value="">Unsorted</option>{groups.map((group) => <option key={group.entityId} value={group.entityId}>{wishlistGroupPath(group, groups)}</option>)}</select></label>
    <button className="focus-secondary" disabled={selectedGroupId === (item.wishlistGroupId || '')} onClick={() => void moveItem(item.entityId, selectedGroupId)}>Assign</button>
    <button className="focus-secondary" disabled={!item.wishlistGroupId} onClick={() => { setSelectedGroupId(''); void moveItem(item.entityId, ''); }}>Remove from group</button>
  </div>;
}

function GearWishlistCard({ item, refresh, edit, toggleSavings }: { item: Stored<GearWishlistRecord>; refresh: () => void; edit: () => void; toggleSavings: () => void }) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false); const [descriptionOverflows, setDescriptionOverflows] = useState(false); const descriptionRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { const measure = () => { const element = descriptionRef.current; if (element && !descriptionExpanded) setDescriptionOverflows(element.scrollHeight > element.clientHeight + 1); }; measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, [item.description, descriptionExpanded]);
  return <Card className="wish-card">{item.coverImage && <img className="wishlist-card-image" src={item.coverImage.startsWith('media:') ? `/api/media?id=${encodeURIComponent(item.coverImage.slice(6))}` : item.coverImage} alt={`${[item.brand, item.model].filter(Boolean).join(' ') || item.itemType} wishlist item`}/>}<div className="focus-card-head"><div><span className="focus-eyebrow">{item.itemType} · {item.status}</span><h2>{[item.brand, item.model].filter(Boolean).join(' ') || item.itemType}</h2></div><div className="record-actions"><button aria-label={`Edit ${item.brand} ${item.model}`} onClick={edit}><Pencil size={15}/></button><button aria-label={`Delete ${item.brand} ${item.model}`} onClick={() => { if (confirm(`Delete ${item.brand} ${item.model}?`)) void deleteGearWishlist(item.entityId).then(refresh); }}><Trash2 size={15}/></button></div></div><label className="wishlist-saving-toggle"><input type="checkbox" checked={item.includeInSavings ?? false} onChange={toggleSavings}/><span>Count toward savings total</span></label>{item.approximateCost && <div className="wish-cost"><strong className="wish-price">{item.approximateCost}</strong>{item.originalApproximateCost && <small>Converted from {item.originalApproximateCost}{item.exchangeRateDate ? ` · rate ${item.exchangeRateDate}` : ''}</small>}</div>}{item.description && <div className="wishlist-description"><p ref={descriptionRef} className={`focus-copy${descriptionExpanded ? ' is-expanded' : ''}`}>{item.description}</p>{(descriptionOverflows || descriptionExpanded) && <button type="button" onClick={() => setDescriptionExpanded((value) => !value)}>{descriptionExpanded ? 'Show less' : '… more'}</button>}</div>}{item.why && <details className="wishlist-notes"><summary>My notes</summary><blockquote>{item.why}</blockquote></details>}<div className="wish-links">{item.links.filter((link) => externalUrl(link.url)).map((link, index) => <a className="focus-link" key={`${link.url}-${index}`} href={externalUrl(link.url)} target="_blank" rel="noreferrer"><ExternalLink size={14}/>{link.description || `Link ${index + 1}`}</a>)}</div></Card>;
}

function GearWishlistForm({ item, groups, close, saved }: { item: Stored<GearWishlistRecord> | null; groups: Array<Stored<GearWishlistGroupRecord>>; close: () => void; saved: () => void }) {
  const draftEntityId = useRef(item?.entityId ?? '');const uploadIds = useRef(new WeakMap<File,string>());const [uploadMessage,setUploadMessage] = useState('');
  useEffect(()=>{if(uploadMessage)window.dispatchEvent(new CustomEvent('zeustek-operation',{detail:{state:'error',message:uploadMessage}}));},[uploadMessage]);
  const [itemType, setItemType] = useState(item?.itemType ?? (DEFAULT_GEAR_CATEGORIES[0] ?? 'Other')); const [model, setModel] = useState(item?.model ?? ''); const [brand, setBrand] = useState(item?.brand ?? ''); const [links, setLinks] = useState(item?.links?.length ? item.links : [{ url: '', description: '' }]); const [approximateCost, setApproximateCost] = useState(item?.originalApproximateCost || item?.approximateCost || ''); const [description, setDescription] = useState(item?.description ?? ''); const [why, setWhy] = useState(item?.why ?? ''); const [status, setStatus] = useState<GearWishlistRecord['status']>(item?.status ?? 'researching');
  const [includeInSavings, setIncludeInSavings] = useState(item?.includeInSavings ?? false); const [wishlistGroupId, setWishlistGroupId] = useState(item?.wishlistGroupId ?? ''); const [catalogOptions, setCatalogOptions] = useState<Array<Stored<CatalogOptionRecord>>>([]);
  const [imageUrls, setImageUrls] = useState<string[]>(item?.imageUrls ?? []); const [imageUrlDraft, setImageUrlDraft] = useState(''); const [existingUploads, setExistingUploads] = useState<Array<{ id: string; fileName: string }>>([]); const [newImages, setNewImages] = useState<File[]>([]); const [coverImage, setCoverImage] = useState(item?.coverImage ?? ''); const [saving, setSaving] = useState(false);
  useEffect(() => { void listCatalogOptions().then(setCatalogOptions); if (!item) return; void fetch(`/api/media?kind=gear-wishlist&ownerId=${encodeURIComponent(item.entityId)}`, { cache: 'no-store' }).then((response) => response.json() as Promise<{ items?: Array<{ id: string; fileName: string; contentType: string }> }>).then((result) => setExistingUploads((result.items ?? []).filter((media) => media.contentType.startsWith('image/')))); }, [item]);
  const itemTypes = [...new Set([...DEFAULT_GEAR_CATEGORIES, ...catalogOptions.filter((option) => option.group === 'category').map((option) => option.value), ...(itemType ? [itemType] : [])])].sort();
  const data = (cover: string, cost: Awaited<ReturnType<typeof normaliseWishlistCost>>) => ({ itemType: itemType.trim(), model: model.trim(), brand: brand.trim(), links: links.filter((link) => link.url.trim()).map((link) => ({ url: link.url.trim(), description: link.description.trim() })), ...cost, description: description.trim(), why: why.trim(), status, imageUrls, includeInSavings, wishlistGroupId, ...(cover ? { coverImage: cover } : {}) });
  async function submit() {
    if (!itemType.trim() || (!model.trim() && !brand.trim()) || saving) return;
    setSaving(true);setUploadMessage('');
    try {
      const cost = await normaliseWishlistCost(approximateCost);const initial = await saveGearWishlist({ ...(draftEntityId.current ? {entityId:draftEntityId.current}:{}), ...data(coverImage.startsWith('new:') ? '' : coverImage,cost) });
      const entityId = draftEntityId.current || initial.id;draftEntityId.current = entityId;
      const selected = newImages.map(file=>{let id=uploadIds.current.get(file);if(!id){id=crypto.randomUUID();uploadIds.current.set(file,id);}return {id,file};});
      const result = await uploadMediaBatch(selected,'gear-wishlist',entityId);
      const desired = coverImage.startsWith('new:') ? selected[Number(coverImage.slice(4))] : undefined;
      const selectedCover = desired && result.uploaded.find(asset=>asset.id===desired.id);
      const finalCover = selectedCover ? `media:${selectedCover.id}` : coverImage.startsWith('new:') ? '' : coverImage;
      setExistingUploads(current=>[...current,...result.uploaded.filter(asset=>!current.some(item=>item.id===asset.id))]);
      setNewImages(result.failed.map(item=>item.file));
      if(selectedCover)setCoverImage(finalCover);else if(desired)setCoverImage(`new:${result.failed.findIndex(item=>item.id===desired.id)}`);
      await saveGearWishlist({entityId,...data(finalCover,cost)});saved();
      if(result.failed.length){setUploadMessage(result.failed.map(item=>`${item.file.name}: ${item.error}`).join(' '));return;}
      close();
    } catch(error){setUploadMessage(error instanceof Error?error.message:'Save failed; files and existing references are retained.');}finally{setSaving(false);}
  }
  async function removeUpload(id: string) { if (!confirm('Remove this wishlist image?')) return; const response = await fetch(`/api/media?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); if (response.ok) { setExistingUploads((current) => current.filter((image) => image.id !== id)); if (coverImage === `media:${id}`) setCoverImage(''); } }
  useEffect(()=>{if(!newImages.length)return;const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[newImages.length]);
  const addImageUrl = () => { const url = externalUrl(imageUrlDraft); if (!url || imageUrls.includes(url)) return; setImageUrls((current) => [...current, url]); if (!coverImage) setCoverImage(url); setImageUrlDraft(''); };
  const imageEditor = <div className="record-wide wishlist-image-editor"><div className="wishlist-image-editor-head"><span>Images (optional)</span><label className="focus-secondary file-action"><ImagePlus size={15}/> Upload images<input type="file" accept="image/*" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); setNewImages((current) => [...current, ...files]); if (!coverImage && files.length) setCoverImage(`new:${newImages.length}`); event.target.value = ''; }}/></label></div><div className="wishlist-url-add"><input type="url" value={imageUrlDraft} onChange={(event) => setImageUrlDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addImageUrl(); } }} placeholder="Paste an image URL…"/><button type="button" className="focus-secondary" onClick={addImageUrl}><Plus size={14}/> Add URL</button></div>{(imageUrls.length > 0 || existingUploads.length > 0 || newImages.length > 0) && <div className="wishlist-image-options">{imageUrls.map((url) => <label key={url}><img src={url} alt="Wishlist reference"/><span><input type="radio" name="wishlist-cover" checked={coverImage === url} onChange={() => setCoverImage(url)}/> Show on card</span><button type="button" className="focus-icon" onClick={() => { setImageUrls((current) => current.filter((value) => value !== url)); if (coverImage === url) setCoverImage(''); }} aria-label="Remove image URL"><X size={14}/></button></label>)}{existingUploads.map((image) => <label key={image.id}><img src={`/api/media?id=${encodeURIComponent(image.id)}`} alt={image.fileName}/><span><input type="radio" name="wishlist-cover" checked={coverImage === `media:${image.id}`} onChange={() => setCoverImage(`media:${image.id}`)}/> Show on card</span><button type="button" className="focus-icon" onClick={() => void removeUpload(image.id)} aria-label={`Remove ${image.fileName}`}><Trash2 size={14}/></button></label>)}{newImages.map((file, index) => <label key={`${file.name}-${file.lastModified}-${index}`}><span className="wishlist-new-image"><FileImage size={22}/>{file.name}</span><span><input type="radio" name="wishlist-cover" checked={coverImage === `new:${index}`} onChange={() => setCoverImage(`new:${index}`)}/> Show on card</span><button type="button" className="focus-icon" onClick={() => { setNewImages((current) => current.filter((_, position) => position !== index)); if (coverImage === `new:${index}`) setCoverImage(''); }} aria-label={`Remove ${file.name}`}><X size={14}/></button></label>)}</div>}<small>Choose one image to display on the wishlist card. Other images stay attached to this item.</small></div>;
  return <Card className="record-form"><div className="record-form-head"><div><span className="focus-eyebrow">{item ? 'EDIT GEAR IDEA' : 'NEW GEAR IDEA'}</span><h3>{item ? 'Update wishlist item' : 'Add to gear wishlist'}</h3></div><button className="focus-icon" aria-label="Close editor" onClick={close}><X size={17}/></button></div><div className="record-fields"><label>Item type<select value={itemType} onChange={(event) => setItemType(event.target.value)}>{itemTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Group / subgroup<select value={wishlistGroupId} onChange={(event) => setWishlistGroupId(event.target.value)}><option value="">Unsorted</option>{groups.map((group) => <option key={group.entityId} value={group.entityId}>{wishlistGroupPath(group, groups)}</option>)}</select></label><label>Brand<input value={brand} onChange={(event) => setBrand(event.target.value)}/></label><label>Model<input value={model} onChange={(event) => setModel(event.target.value)}/></label><label>Approximate cost<input value={approximateCost} onChange={(event) => setApproximateCost(event.target.value)} placeholder="e.g. £650"/></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as GearWishlistRecord['status'])}><option value="researching">Researching</option><option value="shortlisted">Shortlisted</option><option value="purchased">Purchased</option></select></label><label className="wishlist-saving-toggle form-toggle"><input type="checkbox" checked={includeInSavings} onChange={(event) => setIncludeInSavings(event.target.checked)}/><span>Count toward savings total</span></label><label className="record-wide">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)}/></label><label className="record-wide">Why I want it<textarea value={why} onChange={(event) => setWhy(event.target.value)}/></label><div className="record-wide wishlist-links-editor"><span>Links</span>{links.map((link, index) => <div key={index}><input type="url" value={link.url} onChange={(event) => setLinks((current) => current.map((value, position) => position === index ? { ...value, url: event.target.value } : value))} placeholder="https://…"/><input value={link.description} onChange={(event) => setLinks((current) => current.map((value, position) => position === index ? { ...value, description: event.target.value } : value))} placeholder="Shop, review or manufacturer"/><button className="focus-icon" onClick={() => setLinks((current) => current.filter((_, position) => position !== index))}><X size={14}/></button></div>)}<button className="focus-secondary" onClick={() => setLinks((current) => [...current, { url: '', description: '' }])}><Plus size={14}/> Add another link</button></div>{imageEditor}</div><footer><button className="focus-secondary" onClick={close}>Cancel</button><button className="focus-primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Saving…' : 'Save wishlist item'}</button></footer></Card>;
}

const DEFAULT_NEWS_SOURCES: Array<Omit<NewsSourceRecord, keyof { createdAt: string; modifiedAt: string }>> = [
  { name: 'PADI Blog', url: 'https://blog.padi.com/feed/', type: 'rss', enabled: true, description: 'Training, travel, conservation and PADI community stories.' },
  { name: 'DIVE Magazine', url: 'https://divemagazine.com/feed', type: 'site-review', enabled: true, description: 'Independent dive news, destinations, equipment and underwater photography.' },
  { name: 'DeeperBlue', url: 'https://www.deeperblue.com/feed/', type: 'rss', enabled: true, description: 'Scuba, freediving, ocean and travel coverage.' },
  { name: 'The Scuba News', url: 'https://www.thescubanews.com/feed/', type: 'rss', enabled: true, description: 'International diving and marine-environment news.' },
  { name: 'DIVE weekly newsletter', url: 'https://divemagazine.com/about-us', type: 'newsletter', enabled: true, description: 'Weekly editorial newsletter signup from DIVE Magazine.' },
  { name: 'DeeperBlue newsletter', url: 'https://www.deeperblue.com/about-us/', type: 'newsletter', enabled: true, description: 'Scuba and freediving updates delivered by email.' },
];

async function ensureNewsSources() {
  const sources = await listNewsSources();
  if (!sources.length && await hasCloudSnapshot('news-source')) {
    void diveOperation('seed-news-sources','Preparing news sources…',async()=>{
      for(const [index,source] of DEFAULT_NEWS_SOURCES.entries())await saveNewsSource({...source,entityId:`${currentDiveAccount()}-default-news-${index}`});
    });
  }
  return sources;
}

function DiveNews() {
  type Article = { title: string; link: string; summary: string; publishedAt: string; source: string; sources?: Array<{source:string;link:string}> };
  const [sources, setSources] = useState<Array<Stored<NewsSourceRecord>>>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleRecords, setArticleRecords] = useState<Array<Stored<NewsArticleRecord>>>([]);
  const [view, setView] = useState<'current' | 'saved' | 'archived'>('current');
  const [status, setStatus] = useState('Loading dive news…');
  const [newsletterEmail, setNewsletterEmail] = useState(DEFAULT_NEWSLETTER_EMAIL);
  const refresh = useCallback(async () => {
    const [nextSources, nextArticleRecords] = await Promise.all([ensureNewsSources(), listNewsArticles()]);
    setSources(nextSources);
    setArticleRecords(nextArticleRecords);
    const feeds = nextSources.filter((source) => source.enabled && source.type !== 'newsletter');
    const response = await fetch('/api/dive-news', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sources: feeds.map(({ name, url, type }) => ({ name, url, type })) }) });
    const result = await response.json() as { articles?: typeof articles; failures?: Array<{ source: string }> };
    setArticles(result.articles ?? []); setStatus(result.articles?.length ? `${result.articles.length} recent stories${result.failures?.length ? ` · ${result.failures.length} source unavailable` : ''}` : 'No feed stories are available just now.');
  }, []);
  useEffect(() => {
    void refresh().catch(() => setStatus('Dive news is temporarily unavailable.'));
    void listDashboardSettings().then((records) =>
      setNewsletterEmail(records[0]?.newsletterEmail ?? DEFAULT_NEWSLETTER_EMAIL),
    );
  }, [refresh]);
  const newsletters = sources.filter((source) => source.enabled && source.type === 'newsletter');
  const recordByLink = new Map(articleRecords.map((record) => [record.link, record]));
  const visibleArticles: Article[] = view === 'current'
    ? articles.filter((article) => !['archived', 'deleted'].includes(recordByLink.get(article.link)?.state ?? ''))
    : articleRecords.filter((record) => record.state === view).map(({ source, title, link, summary, publishedAt }) => ({ source, title, link, summary, publishedAt }));
  async function setArticleState(article: Article, state: NewsArticleRecord['state']) {
    const current = recordByLink.get(article.link);
    if (state === 'saved') { const media=await listDiveMedia(); const match=media.find(item => canonicalUrl(item.url) === canonicalUrl(article.link)); await saveDiveMedia({...match, ...(match ? {entityId:match.entityId}:{}),title:article.title,format:'article',creator:article.source,url:article.link,status:'consumed',rating:match?.rating ?? null,topics:match?.topics ?? [],notes:match?.notes || article.summary,recommendedFor:match?.recommendedFor ?? '',sources:article.sources ?? [{source:article.source,link:article.link}]}); }
    await saveNewsArticle({ ...(current ? { entityId: current.entityId } : {}), ...article, state });
    setArticleRecords(await listNewsArticles());
    setStatus(state === 'saved' ? 'Story saved to Dive Media as consumed.' : state === 'archived' ? 'Story archived.' : 'Story deleted from your news views.');
  }
  async function shareArticle(article: Article) {
    try {
      if (navigator.share) await navigator.share({ title: article.title, text: article.summary, url: article.link });
      else { await navigator.clipboard.writeText(article.link); setStatus('Story link copied to the clipboard.'); }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') setStatus('Could not share this story on this device.');
    }
  }
  return <>
    <Heading eyebrow="NEWS · DESTINATIONS · EQUIPMENT" title="Dive news" copy="A private reading dashboard for selected dive publications, destination reviews and future newsletter monitoring." action={<button className="focus-secondary" onClick={() => void refresh()}><Cloud size={15}/> Refresh feeds</button>}/>
    <div className="focus-notice"><Newspaper size={15}/>{status}</div>
    <div className="news-view-tabs"><button className={view === 'current' ? 'active' : ''} onClick={() => setView('current')}>Current <b>{articles.filter((article) => !['archived', 'deleted'].includes(recordByLink.get(article.link)?.state ?? '')).length}</b></button><button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}>Saved <b>{articleRecords.filter((record) => record.state === 'saved').length}</b></button><button className={view === 'archived' ? 'active' : ''} onClick={() => setView('archived')}>Archived <b>{articleRecords.filter((record) => record.state === 'archived').length}</b></button></div>
    <div className="news-layout"><div>{visibleArticles.length ? <div className="news-grid">{visibleArticles.map((article) => { const savedState = recordByLink.get(article.link)?.state; return <Card key={`${article.source}-${article.link}`} className="news-card"><span className="focus-eyebrow">{article.source}</span><h2>{article.title}</h2>{article.publishedAt && <time>{new Date(article.publishedAt).toLocaleDateString()}</time>}<p>{article.summary || 'Open the original story to read more.'}</p>{article.sources && article.sources.length > 1 && <div className="topic-list">{article.sources.map(source => <a key={source.link} className="focus-link" href={externalUrl(source.link)} target="_blank" rel="noreferrer">{source.source}</a>)}</div>}<div className="news-card-actions"><a className="focus-link" href={article.link} target="_blank" rel="noreferrer">Read <ExternalLink size={14}/></a>{savedState !== 'saved' && <button onClick={() => void setArticleState(article, 'saved')}><BookMarked size={14}/> Save</button>}{savedState !== 'archived' && <button onClick={() => void setArticleState(article, 'archived')}><Archive size={14}/> Archive</button>}{savedState === 'archived' && <button onClick={() => void setArticleState(article, 'saved')}><BookMarked size={14}/> Restore to saved</button>}<button onClick={() => void shareArticle(article)}><Share2 size={14}/> Share</button><button onClick={() => { if (window.confirm(`Delete “${article.title}” from your news views?`)) void setArticleState(article, 'deleted'); }}><Trash2 size={14}/> Delete</button></div></Card>; })}</div> : <Card className="focus-empty"><Newspaper size={30}/><h2>No {view} stories</h2><p>{view === 'current' ? 'Refresh the feeds or restore a story from the archive.' : `Stories you mark as ${view} will appear here.`}</p></Card>}</div><aside><Card><span className="focus-eyebrow">NEWSLETTERS</span><h2>Email reading list</h2><a className="newsletter-inbox" href={`mailto:${newsletterEmail}`}><Newspaper size={18}/><span><small>Dedicated newsletter inbox</small><b>{newsletterEmail}</b></span></a><p className="focus-copy">Use this address when subscribing to the newsletters below.</p><div className="newsletter-connection-note"><b>Automatic inbox reading is not connected</b><p>The dashboard still needs a Google sign-in screen, read-only Gmail permission and a scheduled mailbox sync. Until that connection is built and authorised, newsletters remain safely in Gmail and will not appear on this page; the public RSS feeds on the left continue to work normally.</p></div>{newsletters.map((source) => <a key={source.entityId} className="newsletter-link" href={source.url} target="_blank" rel="noreferrer"><b>{source.name}</b><small>{source.description}</small><ExternalLink size={14}/></a>)}</Card></aside></div>
  </>;
}

type DiveNewsArticle = { sources?: Array<{source:string;link:string}>; title: string; link: string; summary: string; publishedAt: string; source: string };
type GmailConnectionStatus = {
  configured: boolean; missing: string[]; redirectUri: string; connected: boolean; email: string;
  connectedAt: string; lastSyncAt: string; lastSyncCount: number; lastError: string; syncMode: 'when-open';
};
const EMPTY_NEWS_PREFERENCES: Omit<NewsPreferencesRecord, 'createdAt' | 'modifiedAt'> = { interestedKeywords: [], mutedKeywords: [], mutedMode: 'hide' };

function DiveNewsV2() {
  const [sources, setSources] = useState<Array<Stored<NewsSourceRecord>>>([]);
  const [articles, setArticles] = useState<DiveNewsArticle[]>([]);
  const [articleRecords, setArticleRecords] = useState<Array<Stored<NewsArticleRecord>>>([]);
  const [preferences, setPreferences] = useState<Array<Stored<NewsPreferencesRecord>>>([]);
  const [interestedText, setInterestedText] = useState('');
  const [mutedText, setMutedText] = useState('');
  const [mutedMode, setMutedMode] = useState<NewsPreferencesRecord['mutedMode']>('hide');
  const [gmail, setGmail] = useState<GmailConnectionStatus | null>(null);
  const [view, setView] = useState<'current' | 'saved' | 'archived'>('current');
  const [status, setStatus] = useState('Loading dive news…');
  const [newsletterEmail, setNewsletterEmail] = useState(DEFAULT_NEWSLETTER_EMAIL);
  const [copied, setCopied] = useState(false);
  const activePreferences = preferences[0] ?? EMPTY_NEWS_PREFERENCES;

  const refreshLocalNews=useCallback(async()=>{
    const [nextSources, nextArticleRecords, nextPreferences, gmailArticles] = await Promise.all([
      ensureNewsSources(), listNewsArticles(), listNewsPreferences(), listGmailNews(),
    ]);
    setSources(nextSources); setArticleRecords(nextArticleRecords); setPreferences(nextPreferences);
    const savedPreferences = nextPreferences[0];
    setInterestedText(savedPreferences?.interestedKeywords.join(', ') ?? '');
    setMutedText(savedPreferences?.mutedKeywords.join(', ') ?? '');
    setMutedMode(savedPreferences?.mutedMode ?? 'hide');
    const cache=await zeustekDb.settings.get(`news-cache:${currentDiveAccount()}`);
    const cached=Array.isArray(cache?.value)?cache.value as unknown as DiveNewsArticle[]:[];
    setArticles(groupNewsStories([...gmailArticles,...cached]));
    return {nextSources,gmailArticles};
  },[]);
  const localNewsChanged=useCallback(()=>{void refreshLocalNews();},[refreshLocalNews]); useRecordRefresh(localNewsChanged);
  const refresh = useCallback(async (forceMailboxSync = false) => {
    const {nextSources,gmailArticles}=await refreshLocalNews();
    if(!navigator.onLine){setStatus('Offline — showing cached stories.');return;}

    const statusResponse = await fetch('/api/gmail/status', { cache: 'no-store' });
    let gmailStatus = statusResponse.ok ? await statusResponse.json() as GmailConnectionStatus : null;
    if (gmailStatus?.connected) {
      const due = !gmailStatus.lastSyncAt || Date.now() - Date.parse(gmailStatus.lastSyncAt) > 15 * 60_000;
      if (forceMailboxSync || due) {
        const syncResponse = await fetch('/api/gmail/sync', { method: 'POST' });
        const syncResult = await syncResponse.json() as { count?: number; error?: string };
        if (!syncResponse.ok) setStatus(syncResult.error || 'The newsletter mailbox could not be refreshed.');
        else setStatus(`${syncResult.count ?? 0} newsletter emails checked.`);
        const updatedStatus = await fetch('/api/gmail/status', { cache: 'no-store' });
        if (updatedStatus.ok) gmailStatus = await updatedStatus.json() as GmailConnectionStatus;
      }
    }
    setGmail(gmailStatus);
    const feeds = nextSources.filter((source) => source.enabled && source.type !== 'newsletter');
    const response = await fetch('/api/dive-news', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sources: feeds.map(({ name, url, type }) => ({ name, url, type })) }) });
    const result = await response.json() as { articles?: DiveNewsArticle[]; failures?: Array<{ source: string }> };
    const combined = [...gmailArticles.map(({ source, title, link, summary, publishedAt }) => ({ source, title, link, summary, publishedAt })), ...(result.articles ?? [])];
    const unique = groupNewsStories(combined);
    setArticles(unique);
    await zeustekDb.settings.put({key:`news-cache:${currentDiveAccount()}`,value:JSON.parse(JSON.stringify(unique))});
    if (!gmailStatus?.connected || !forceMailboxSync) setStatus(unique.length ? `${unique.length} recent stories${gmailArticles.length ? ` · ${gmailArticles.length} from Gmail` : ''}${result.failures?.length ? ` · ${result.failures.length} source unavailable` : ''}` : 'No news stories are available just now.');
  }, [refreshLocalNews]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('gmailError')) setStatus(query.get('gmailError') ?? 'Gmail connection failed.');
    else if (query.get('gmail') === 'connected') setStatus('Gmail connected. Checking the newsletter inbox…');
    void refresh().catch(() => setStatus('News refresh is unavailable — saved and cached stories remain available.'));
    void listDashboardSettings().then((records) => setNewsletterEmail(records[0]?.newsletterEmail ?? DEFAULT_NEWSLETTER_EMAIL));
    const timer = window.setInterval(() => void refresh(), 15 * 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const newsletters = sources.filter((source) => source.enabled && source.type === 'newsletter');
  const recordByLink = new Map(articleRecords.map((record) => [record.link, record]));
  const currentArticles = articles.filter((article) => !['archived', 'deleted'].includes(recordByLink.get(article.link)?.state ?? ''));
  const learnedProfile = learnedNewsProfile(articleRecords);
  const visibleArticles: DiveNewsArticle[] = view === 'current'
    ? sortNewsByPriority(currentArticles, activePreferences, articleRecords)
    : articleRecords.filter((record) => record.state === view).map(({ source, title, link, summary, publishedAt }) => ({ source, title, link, summary, publishedAt })).sort((a, b) => Date.parse(b.publishedAt || '0') - Date.parse(a.publishedAt || '0'));

  async function setArticleState(article: DiveNewsArticle, state: NewsArticleRecord['state']) {
    const current = recordByLink.get(article.link);
    if (state === 'saved') { const media=await listDiveMedia(); const match=media.find(item => canonicalUrl(item.url) === canonicalUrl(article.link)); await saveDiveMedia({...match, ...(match ? {entityId:match.entityId}:{}),title:article.title,format:'article',creator:article.source,url:article.link,status:'consumed',rating:match?.rating ?? null,topics:match?.topics ?? [],notes:match?.notes || article.summary,recommendedFor:match?.recommendedFor ?? '',sources:article.sources ?? [{source:article.source,link:article.link}]}); }
    await saveNewsArticle({ ...(current ? { entityId: current.entityId } : {}), ...article, state, ...(current?.reaction ? { reaction: current.reaction, ...(current.reactionAt ? { reactionAt: current.reactionAt } : {}) } : {}) });
    setArticleRecords(await listNewsArticles());
    setStatus(state === 'saved' ? 'Story saved to Dive Media as consumed.' : state === 'archived' ? 'Story archived.' : 'Story deleted from your news views.');
  }
  async function setArticleReaction(article: DiveNewsArticle, reaction: NonNullable<NewsArticleRecord['reaction']>) {
    const current = recordByLink.get(article.link);
    const nextReaction = current?.reaction === reaction ? undefined : reaction;
    await saveNewsArticle({
      ...(current ? { entityId: current.entityId } : {}), ...article,
      state: current?.state ?? 'rated',
      ...(nextReaction ? { reaction: nextReaction, reactionAt: new Date().toISOString() } : {}),
    });
    setArticleRecords(await listNewsArticles());
    setStatus(nextReaction === 'shaka' ? '🤙 Marked very good — the priority system is learning.' : nextReaction === 'okay' ? '🤚 Marked okay — saved as a mild positive signal.' : nextReaction === 'not-interested' ? '🙅 Marked not interested — similar stories will move down.' : 'Reaction removed.');
  }
  async function shareArticle(article: DiveNewsArticle) {
    try {
      if (navigator.share) await navigator.share({ title: article.title, text: article.summary, url: article.link });
      else { await navigator.clipboard.writeText(article.link); setStatus('Story link copied to the clipboard.'); }
    } catch (error) { if ((error as DOMException).name !== 'AbortError') setStatus('Could not share this story on this device.'); }
  }
  async function copyText(value: string, message: string) {
    await navigator.clipboard.writeText(value); setStatus(message); setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }
  async function connectGmail() {
    const response = await fetch('/api/gmail/connect', { method: 'POST' });
    const result = await response.json() as { authorizationUrl?: string; error?: string };
    if (response.ok && result.authorizationUrl) window.location.assign(result.authorizationUrl);
    else setStatus(result.error || 'Google mailbox access still needs its OAuth client details.');
  }
  async function disconnectGmail() {
    if (!window.confirm('Disconnect Gmail from Dive News? Saved and archived stories will be kept.')) return;
    await fetch('/api/gmail/disconnect', { method: 'POST' });
    await refresh(); setStatus('Gmail disconnected.');
  }
  async function savePrioritySettings() {
    const current = preferences[0];
    await saveNewsPreferences({ ...(current ? { entityId: current.entityId } : {}), interestedKeywords: normaliseNewsKeywords(interestedText), mutedKeywords: normaliseNewsKeywords(mutedText), mutedMode });
    const next = await listNewsPreferences(); setPreferences(next); setStatus('News priorities saved to your private account.');
  }

  return <>
    <Heading eyebrow="NEWS · DESTINATIONS · EQUIPMENT" title="Dive news" copy="Public dive feeds and your private newsletter inbox, ranked around the subjects you care about." action={<button className="focus-secondary" onClick={() => void refresh(true)}><Cloud size={15}/> Refresh news</button>}/>
    <div className="focus-notice" aria-live="polite"><Newspaper size={15}/>{status}</div>
    <div className="news-view-tabs"><button className={view === 'current' ? 'active' : ''} onClick={() => setView('current')}>Current <b>{currentArticles.length}</b></button><button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}>Saved <b>{articleRecords.filter((record) => record.state === 'saved').length}</b></button><button className={view === 'archived' ? 'active' : ''} onClick={() => setView('archived')}>Archived <b>{articleRecords.filter((record) => record.state === 'archived').length}</b></button></div>
    <div className="news-layout"><div>{visibleArticles.length ? <div className="news-grid">{visibleArticles.map((article) => { const savedRecord = recordByLink.get(article.link); const savedState = savedRecord?.state; const priority = priorityForArticle(article, activePreferences); return <Card key={`${article.source}-${article.link}`} className="news-card"><div className="news-card-kicker"><span className="focus-eyebrow">{article.source}</span>{view === 'current' && priority.interestedMatches.length > 0 && <span className="news-priority-badge">Priority · {priority.interestedMatches.slice(0, 2).join(', ')}</span>}{view === 'current' && priority.mutedMatches.length > 0 && activePreferences.mutedMode === 'deprioritize' && <span className="news-muted-badge">Low priority</span>}</div><h2>{article.title}</h2>{article.publishedAt && <time>{new Date(article.publishedAt).toLocaleDateString()}</time>}<p>{article.summary || 'Open the original story to read more.'}</p>{article.sources && article.sources.length > 1 && <div className="topic-list">{article.sources.map(source => <a key={source.link} className="focus-link" href={externalUrl(source.link)} target="_blank" rel="noreferrer">{source.source}</a>)}</div>}<div className="news-reactions" role="group" aria-label={`Rate ${article.title}`}><span>Teach priorities</span><button className={savedRecord?.reaction === 'shaka' ? 'active' : ''} title="Shaka — very good" aria-label="Very good" onClick={() => void setArticleReaction(article, 'shaka')}>🤙</button><button className={savedRecord?.reaction === 'okay' ? 'active' : ''} title="Flat hand — okay" aria-label="Okay" onClick={() => void setArticleReaction(article, 'okay')}>🤚</button><button className={savedRecord?.reaction === 'not-interested' ? 'active' : ''} title="Crossed arms — not interested" aria-label="Not interested" onClick={() => void setArticleReaction(article, 'not-interested')}>🙅</button></div><div className="news-card-actions"><a className="focus-link" href={article.link} target="_blank" rel="noreferrer">Read <ExternalLink size={14}/></a>{savedState !== 'saved' && <button onClick={() => void setArticleState(article, 'saved')}><BookMarked size={14}/> Save</button>}{savedState !== 'archived' && <button onClick={() => void setArticleState(article, 'archived')}><Archive size={14}/> Archive</button>}{savedState === 'archived' && <button onClick={() => void setArticleState(article, 'saved')}><BookMarked size={14}/> Restore</button>}<button onClick={() => void shareArticle(article)}><Share2 size={14}/> Share</button><button onClick={() => { if (window.confirm(`Delete “${article.title}” from your news views?`)) void setArticleState(article, 'deleted'); }}><Trash2 size={14}/> Delete</button></div></Card>; })}</div> : <Card className="focus-empty"><Newspaper size={30}/><h2>No {view} stories</h2><p>{view === 'current' ? 'No stories match the current priority filters.' : `Stories you mark as ${view} will appear here.`}</p></Card>}</div>
      <aside className="news-sidebar"><Card><span className="focus-eyebrow">NEWSLETTERS</span><h2>Email reading list</h2><button type="button" className="newsletter-inbox" onClick={() => void copyText(newsletterEmail, 'Newsletter email copied to the clipboard.')}><Newspaper size={18}/><span><small>Dedicated newsletter inbox · click to copy</small><b>{newsletterEmail}</b></span>{copied ? <Check size={18}/> : <Copy size={18}/>}</button><p className="focus-copy">Use this address when subscribing to the newsletters below.</p>
        {!gmail?.configured && <div className="newsletter-connection-note"><b>Google connection needs one setup step</b><p>Create a Google Web OAuth client with the Gmail API enabled, add this authorised redirect URI, then supply its client ID and client secret to the site.</p><button className="copy-value" onClick={() => gmail?.redirectUri && void copyText(gmail.redirectUri, 'Google redirect URI copied.')}><span>{gmail?.redirectUri || 'Loading redirect URI…'}</span><Copy size={14}/></button><small>The dashboard requests read-only Gmail access. It cannot send, change or delete email.</small></div>}
        {gmail?.configured && !gmail.connected && <div className="gmail-connect-panel"><b>Newsletter Gmail is ready to connect</b><p>Google will show exactly which account and read-only permission the dashboard is requesting.</p><button className="focus-primary" onClick={() => void connectGmail()}>Connect Gmail</button></div>}
        {gmail?.connected && <div className="gmail-connected-panel"><div><Check size={16}/><span><b>{gmail.email}</b><small>{gmail.lastSyncAt ? `Last checked ${new Date(gmail.lastSyncAt).toLocaleString()} · ${gmail.lastSyncCount} emails` : 'Ready for its first check'}</small></span></div>{gmail.lastError && <p>{gmail.lastError}</p>}<p>Checks when Dive News opens and every 15 minutes while this page is open.</p><div><button className="focus-secondary" onClick={() => void refresh(true)}>Check now</button><button className="focus-secondary danger" onClick={() => void disconnectGmail()}>Disconnect</button></div></div>}
        {newsletters.map((source) => <a key={source.entityId} className="newsletter-link" href={source.url} target="_blank" rel="noreferrer"><b>{source.name}</b><small>{source.description}</small><ExternalLink size={14}/></a>)}</Card>
        <Card className="news-priority-settings"><span className="focus-eyebrow">NEWS PRIORITY</span><h2>What matters to you</h2><p className="focus-copy">Use commas between words or phrases. Matches in headlines rank highest.</p>{learnedProfile.ratingCount > 0 && <div className="learned-news-profile"><b>Learning from {learnedProfile.ratingCount} rating{learnedProfile.ratingCount === 1 ? '' : 's'}</b>{learnedProfile.liked.length > 0 && <small>More: {learnedProfile.liked.join(', ')}</small>}{learnedProfile.avoided.length > 0 && <small>Less: {learnedProfile.avoided.join(', ')}</small>}</div>}<label>Interested in<textarea value={interestedText} onChange={(event) => setInterestedText(event.target.value)} placeholder="wrecks, technical diving, Red Sea, equipment reviews"/></label><label>Not interested in<textarea value={mutedText} onChange={(event) => setMutedText(event.target.value)} placeholder="competitions, freediving"/></label><label>When a muted keyword matches<select value={mutedMode} onChange={(event) => setMutedMode(event.target.value as NewsPreferencesRecord['mutedMode'])}><option value="hide">Hide the story</option><option value="deprioritize">Move it to the bottom</option></select></label><button className="focus-primary" onClick={() => void savePrioritySettings()}>Save priorities</button></Card>
      </aside></div>
  </>;
}

function NewsSourceSettings() {
  const [items, setItems] = useState<Array<Stored<NewsSourceRecord>>>([]); const [name, setName] = useState(''); const [url, setUrl] = useState(''); const [type, setType] = useState<NewsSourceRecord['type']>('rss'); const [description, setDescription] = useState('');
  const refresh = useCallback(() => { void ensureNewsSources().then(setItems); }, []); useRecordRefresh(refresh);
  async function add() { if (!name.trim() || !externalUrl(url)) return; await saveNewsSource({ name: name.trim(), url: externalUrl(url), type, enabled: true, description: description.trim() }); setName(''); setUrl(''); setDescription(''); refresh(); }
  return <Card className="news-source-settings"><span className="focus-eyebrow">DIVE NEWS SETTINGS</span><h2>Feeds and newsletters</h2><p className="focus-copy">Disable sources you do not want, restore them later, or add another public HTTPS RSS/Atom feed or newsletter signup page.</p><div className="news-source-list">{items.map((item) => <div key={item.entityId}><span><b>{item.name}</b><small>{item.type} · {item.url}</small></span><button className={item.enabled ? 'focus-secondary' : 'focus-primary'} onClick={() => void saveNewsSource({ entityId: item.entityId, name: item.name, url: item.url, type: item.type, enabled: !item.enabled, description: item.description }).then(refresh)}>{item.enabled ? 'Remove' : 'Restore'}</button>{!DEFAULT_NEWS_SOURCES.some((source) => source.url === item.url) && <button className="focus-icon" onClick={() => void deleteNewsSource(item.entityId).then(refresh)}><Trash2 size={15}/></button>}</div>)}</div><div className="news-source-add"><label>Name<input value={name} onChange={(event) => setName(event.target.value)}/></label><label>Type<select value={type} onChange={(event) => setType(event.target.value as NewsSourceRecord['type'])}><option value="rss">RSS / Atom feed</option><option value="site-review">Dive-site reviews</option><option value="newsletter">Newsletter signup</option></select></label><label className="record-wide">HTTPS URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} /></label><label className="record-wide">Description<input value={description} onChange={(event) => setDescription(event.target.value)}/></label><button className="focus-primary" disabled={!name.trim() || !externalUrl(url)} onClick={() => void add()}><Plus size={15}/> Add source</button></div></Card>;
}

function DiveMediaLibrary({ go }: { go: (next: string) => void }) {
  const [viewing, setViewing] = useState<Stored<DiveMediaRecord> | null>(null);
  const [author, setAuthor] = useState(''); const [topic, setTopic] = useState('');
  const [items, setItems] = useState<Array<Stored<DiveMediaRecord>>>([]); const [editing, setEditing] = useState<Stored<DiveMediaRecord> | null>(null); const [adding, setAdding] = useState(false); const [status, setStatus] = useState('all'); const [message, setMessage] = useState('');
  const refresh = useCallback(() => { void listDiveMedia().then(setItems); }, []); useRecordRefresh(refresh);
  async function exportAiContext() {
    const [certifications, equipment, dives, trips, training, media] = await Promise.all([listCertifications(), listEquipment(), listDives(), listDiveTrips(), listTrainingProgress(), listDiveMedia()]);
    const context = {
      format: 'zeustek-ai-media-context', version: 1, exportedAt: new Date().toISOString(),
      diver: {
        certifications: certifications.map(({ agency, certification, level, issuedAt, courseType }) => ({ agency, certification, level, issuedAt, courseType })),
        gear: equipment.filter((item) => !item.retired).map(({ category, manufacturer, model, name }) => ({ category, manufacturer, model, name })),
        condensedLogbook: dives.map(({ date, site, country, region, maxDepthM, averageDepthM, bottomTimeMin, totalElapsedMin, diveMode, diveTypes, waterType, gas }) => ({ date, site, country, region, maxDepthM, averageDepthM, durationMin: totalElapsedMin ?? bottomTimeMin, diveMode, diveTypes, waterType, gas })),
      },
      plans: {
        dives: trips.filter((trip) => trip.status !== 'completed').map(({ name, planType, startDate, siteName, status, notes }) => ({ name, planType, startDate, siteName, status, notes })),
        courses: training.filter((course) => course.status === 'planned' || course.status === 'in-progress').sort((a, b) => (a.planOrder ?? 9999) - (b.planOrder ?? 9999)).map(({ agency, courseTitle, status, planOrder }) => ({ agency, courseTitle, status, planOrder })),
      },
      media: {
        consumed: media.filter((item) => item.status === 'consumed').map(({ title, format, creator, rating, topics, notes, priority, knowledgeGrowth, interestScore }) => ({ title, format, creator, rating, topics, notes, priority, knowledgeGrowth, interestScore })),
        planned: media.filter((item) => item.status !== 'consumed').map(({ title, format, creator, status, topics, recommendedFor }) => ({ title, format, creator, status, topics, recommendedFor })),
      },
      recommendationRequest: 'Recommend diving books, articles, documentaries, videos and podcasts that fill knowledge gaps, support planned dives and prepare for planned or current courses. Avoid duplicating consumed or planned media.',
      importSchema: { mediaRecommendations: [{ title: 'Required', format: 'book | video | podcast | article | documentary | course | other', creator: '', url: 'https://…', topics: ['topic'], notes: '', recommendedFor: 'knowledge gap, planned dive or course' }] },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(context, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `zeustek-ai-media-context-${new Date().toISOString().slice(0,10)}.json`; anchor.click(); URL.revokeObjectURL(url); setMessage('AI recommendation context exported.');
  }
  async function importRecommendations(file: File) {
    try {
      await diveOperation('import-media','Importing media recommendations…',async()=>{
        if(file.size>2_000_000)throw new Error('The recommendations file must be under 2 MB.');
        const recommendations=parseMediaRecommendations(JSON.parse(await file.text()));
        const latest=await listDiveMedia();const existing=new Set(latest.map(item=>recordIdentity('dive-media',item)));
        let added=0,skipped=0;
        for(const recommendation of recommendations){
          const identity=recordIdentity('dive-media',recommendation);
          if(identity&&existing.has(identity)){skipped++;continue;}
          await saveDiveMedia(recommendation);existing.add(identity);added++;
          setMessage(`Importing… ${added+skipped} of ${recommendations.length} reviewed.`);
        }
        setMessage(`${added} recommendations imported; ${skipped} duplicates skipped. Existing notes and scores are unchanged.`);refresh();
      });
    }catch(error){setMessage(error instanceof Error?error.message:'Media import failed.');}
  }
  const visible = items.filter((item) => (status === 'all' || item.status === status) && (!author || item.creator === author) && (!topic || item.topics.includes(topic)));
  return <><Heading eyebrow="READ · WATCH · LISTEN · LEARN" title="Dive Bibliography" copy="Track diving books, videos, podcasts, articles, courses and documentaries you have consumed or want to explore." action={<div className="record-actions"><button className="focus-secondary" onClick={() => go('Dive Knowledge')}>Dive Knowledge</button><button className="focus-secondary" onClick={() => void diveOperation('export-media','Exporting media context…',exportAiContext)}><Download size={15}/> Export for AI</button><label className="focus-secondary file-action"><Upload size={15}/> Import recommendations<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importRecommendations(file); event.target.value = ''; }}/></label><button className="focus-primary" onClick={() => { setEditing(null); setAdding(true); }}><Plus size={16}/> Add media</button></div>}/>{message && <div className="focus-notice"><BookMarked size={15}/>{message}</div>}<Card className="media-status-filter"><button className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>All <b>{items.length}</b></button><button className={status === 'planned' ? 'active' : ''} onClick={() => setStatus('planned')}>Want to consume <b>{items.filter((item) => item.status === 'planned').length}</b></button><button className={status === 'in-progress' ? 'active' : ''} onClick={() => setStatus('in-progress')}>In progress <b>{items.filter((item) => item.status === 'in-progress').length}</b></button><button className={status === 'consumed' ? 'active' : ''} onClick={() => setStatus('consumed')}>Consumed <b>{items.filter((item) => item.status === 'consumed').length}</b></button></Card>{adding && <RevealOnMount><DiveMediaForm item={editing} close={() => { setAdding(false); setEditing(null); }} saved={refresh}/></RevealOnMount>}{(author || topic) && <div className="focus-notice">{author && `Author: ${author}`} {topic && `Topic: ${topic}`}<button className="focus-secondary" onClick={() => {setAuthor('');setTopic('');}}>Clear filters</button></div>}{viewing && <RecordDetail title={viewing.title} eyebrow={`${viewing.format} · ${viewing.status}`} ownerKind="dive-media" ownerId={viewing.entityId} close={() => setViewing(null)} edit={() => {setEditing(viewing);setViewing(null);setAdding(true);}} rows={[["Author",viewing.creator],["Status",viewing.status],["Priority",viewing.priority ?? 'normal'],["Knowledge growth / 10",viewing.knowledgeGrowth ?? 'Not rated'],["Interest / 10",viewing.interestScore ?? 'Not rated'],["Topics",viewing.topics.join(', ')],["Notes",viewing.notes],["Recommended for",viewing.recommendedFor]]} links={[["Open media",viewing.url],...(viewing.sources ?? []).map(source => [source.source,source.link] as [string,string])]} />}<div className="media-library-grid">{visible.map((item) => <MediaLibraryCard key={item.entityId} item={item} setViewing={setViewing} setEditing={setEditing} setAdding={setAdding} setAuthor={setAuthor} setTopic={setTopic} refresh={refresh}/>)}</div>{!visible.length && <Card className="focus-empty"><BookMarked size={32}/><h2>No media in this list</h2><p>Add something you want to read, watch or listen to—or import AI recommendations.</p></Card>}</>;
}

function MediaLibraryCard({item,setViewing,setEditing,setAdding,setAuthor,setTopic,refresh}:{item:Stored<DiveMediaRecord>;setViewing:(item:Stored<DiveMediaRecord>)=>void;setEditing:(item:Stored<DiveMediaRecord>)=>void;setAdding:(value:boolean)=>void;setAuthor:(value:string)=>void;setTopic:(value:string)=>void;refresh:()=>void}) {
  const [expanded,setExpanded]=useState(false);
  const visibleTopics=expanded ? item.topics : item.topics.slice(0,4);
  const hiddenCount=Math.max(0,item.topics.length-visibleTopics.length);
  return <Card className={`media-library-card${expanded?' expanded':''}`}>{externalUrl(item.thumbnailUrl) && <img className="media-card-thumbnail" src={`/api/image-proxy?url=${encodeURIComponent(externalUrl(item.thumbnailUrl))}`} alt="" loading="lazy"/>}<div className="focus-card-head"><div className="media-card-heading"><span className="focus-eyebrow media-card-meta">{item.format} · {item.status}</span><button className="media-title" onClick={() => setViewing(item)}>{item.title}</button>{item.creator && <button className="focus-link media-card-creator" onClick={() => setAuthor(item.creator)}>{item.creator}</button>}</div><div className="record-actions"><button aria-label={`Edit ${item.title}`} onClick={() => { setEditing(item); setAdding(true); }}><Pencil size={15}/></button><button aria-label={`Delete ${item.title}`} onClick={() => { if (confirm(`Delete ${item.title}?`)) void deleteDiveMedia(item.entityId).then(refresh); }}><Trash2 size={15}/></button></div></div>{item.rating != null && <div className="media-rating">{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</div>}<small>Priority: {item.priority ?? 'normal'}</small><div className="topic-list media-topic-list">{visibleTopics.map((topic) => <button key={topic} onClick={() => setTopic(topic)}>{topic}</button>)}{hiddenCount>0 && <button className="topic-more" onClick={() => setExpanded(true)}>...more {hiddenCount}</button>}{expanded && item.topics.length>4 && <button className="topic-more" onClick={() => setExpanded(false)}>show less</button>}</div>{externalUrl(item.url) && <a className="focus-link" href={externalUrl(item.url)} target="_blank" rel="noreferrer">Open media <ExternalLink size={14}/></a>}</Card>;
}

function DiveMediaForm({ item, close, saved }: { item: Stored<DiveMediaRecord> | null; close: () => void; saved: () => void }) {
  const [priority,setPriority]=useState<NonNullable<DiveMediaRecord['priority']>>(item?.priority ?? 'normal');
  const [knowledgeGrowth,setKnowledgeGrowth]=useState(item?.knowledgeGrowth?.toString() ?? '');
  const [interestScore,setInterestScore]=useState(item?.interestScore?.toString() ?? '');
  const [title, setTitle] = useState(item?.title ?? ''); const [format, setFormat] = useState<DiveMediaRecord['format']>(item?.format ?? 'book'); const [creator, setCreator] = useState(item?.creator ?? ''); const [url, setUrl] = useState(item?.url ?? ''); const [status, setStatus] = useState<DiveMediaRecord['status']>(item?.status ?? 'planned'); const [rating, setRating] = useState(item?.rating?.toString() ?? ''); const [topics, setTopics] = useState(item?.topics.join(', ') ?? ''); const [notes, setNotes] = useState(item?.notes ?? ''); const [recommendedFor, setRecommendedFor] = useState(item?.recommendedFor ?? '');
  async function submit() { if (!title.trim()) return; const cleanUrl=externalUrl(url); const thumbnailUrl=item?.url===cleanUrl ? item?.thumbnailUrl ?? '' : await mediaPreviewImage(cleanUrl); await saveDiveMedia({ ...(item ? { entityId: item.entityId } : {}), ...item, title: title.trim(), thumbnailUrl, format, priority, knowledgeGrowth: knowledgeGrowth === '' ? null : Number(knowledgeGrowth), interestScore: interestScore === '' ? null : Number(interestScore), creator: creator.trim(), url: cleanUrl, status, rating: rating ? Math.min(5, Math.max(1, Number(rating))) : null, topics: topics.split(',').map((topic) => topic.trim()).filter(Boolean), notes: notes.trim(), recommendedFor: recommendedFor.trim() }); saved(); close(); }
  return <Card className="record-form"><div className="record-form-head"><div><span className="focus-eyebrow">{item ? 'EDIT DIVE MEDIA' : 'NEW DIVE MEDIA'}</span><h3>{item ? 'Update media item' : 'Add something to consume'}</h3></div><button className="focus-icon" aria-label="Close editor" onClick={close}><X size={17}/></button></div><div className="record-fields"><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>Format<select value={format} onChange={(event) => setFormat(event.target.value as DiveMediaRecord['format'])}><option value="book">Book</option><option value="video">Video</option><option value="podcast">Podcast</option><option value="article">Article</option><option value="documentary">Documentary</option><option value="course">Online course</option><option value="other">Other</option></select></label><label>Reading priority<select value={priority} onChange={event => setPriority(event.target.value as NonNullable<DiveMediaRecord['priority']>)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label>Knowledge growth / 10<select value={knowledgeGrowth} onChange={event => setKnowledgeGrowth(event.target.value)}><option value="">Not rated</option>{Array.from({length:11},(_,i)=><option key={i} value={i}>{i} / 10</option>)}</select></label><label>Interest / 10<select value={interestScore} onChange={event => setInterestScore(event.target.value)}><option value="">Not rated</option>{Array.from({length:11},(_,i)=><option key={i} value={i}>{i} / 10</option>)}</select></label><label>Creator / publisher<input value={creator} onChange={(event) => setCreator(event.target.value)}/></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as DiveMediaRecord['status'])}><option value="planned">Want to consume</option><option value="in-progress">In progress</option><option value="consumed">Consumed</option></select></label><label>Rating<select value={rating} onChange={(event) => setRating(event.target.value)}><option value="">Not rated</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><label className="record-wide">URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)}/></label><label className="record-wide">Topics (comma separated)<input value={topics} onChange={(event) => setTopics(event.target.value)} placeholder="decompression, wrecks, buoyancy"/></label><label className="record-wide">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)}/></label><label className="record-wide">Recommended for / knowledge gap<textarea value={recommendedFor} onChange={(event) => setRecommendedFor(event.target.value)}/></label></div><footer><button className="focus-secondary" onClick={close}>Cancel</button><button className="focus-primary" disabled={!title.trim()} onClick={() => void submit()}>Save media</button></footer></Card>;
}

function DiverSummaryExport() {
  const [dives,setDives]=useState<Array<DiveRecord & {entityId:string}>>([]);
  const [certifications,setCertifications]=useState<Array<Stored<CertificationRecord>>>([]);
  const [diverName,setDiverName]=useState('');
  const [selectedCertIds,setSelectedCertIds]=useState<Set<string>>(new Set());
  const [selectedDiveIds,setSelectedDiveIds]=useState<Set<string>>(new Set());
  const [sections,setSections]=useState({certifications:true,cards:true,summary:true,types:true,deep:true,logs:true});
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const initialised=useRef(false);
  const refresh=useCallback(()=>{void Promise.all([listDives(),listCertifications()]).then(([nextDives,nextCertifications])=>{setDives(nextDives);setCertifications(nextCertifications);if(!initialised.current){setSelectedDiveIds(new Set(nextDives.map(dive=>dive.entityId)));setSelectedCertIds(new Set(nextCertifications.map(cert=>cert.entityId)));initialised.current=true;}});},[]);
  useRecordRefresh(refresh);
  const chosenDives=dives.filter(dive=>selectedDiveIds.has(dive.entityId)).sort((a,b)=>(a.diveNumber??0)-(b.diveNumber??0));
  const chosenCertifications=certifications.filter(cert=>selectedCertIds.has(cert.entityId));
  const totalMinutes=chosenDives.reduce((sum,dive)=>sum+(dive.totalElapsedMin??dive.bottomTimeMin??0),0);
  const diveMode=(dive:DiveRecord)=>dive.diveMode==='technical-training'?'Technical training':dive.diveMode==='technical'||dive.isTechnicalDive?'Technical':dive.diveMode==='recreational-training'?'Training':'Recreational';
  const typeCounts=useMemo(()=>{const counts=new Map<string,number>();for(const dive of chosenDives){for(const type of new Set([diveMode(dive),...(dive.diveTypes??[])])){counts.set(type,(counts.get(type)??0)+1);}}return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));},[chosenDives]);
  const toggleSection=(key:keyof typeof sections)=>setSections(current=>({...current,[key]:!current[key]}));
  const toggleId=(setter:React.Dispatch<React.SetStateAction<Set<string>>>,id:string,checked:boolean)=>setter(current=>{const next=new Set(current);if(checked)next.add(id);else next.delete(id);return next;});
  function saveBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function renderedCard(image:CardImage){const source=await imageSource(image,currentDiveAccount());if(!source)return null;try{const response=await fetch(source);if(!response.ok)return null;const blob=await response.blob();const bitmap=await createImageBitmap(blob);const width=952,height=600;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)return null;context.fillStyle='#111';context.fillRect(0,0,width,height);const scale=Math.max(width/bitmap.width,height/bitmap.height)*image.zoom;const drawWidth=bitmap.width*scale,drawHeight=bitmap.height*scale;context.drawImage(bitmap,(width-drawWidth)*(image.x/100),(height-drawHeight)*(image.y/100),drawWidth,drawHeight);bitmap.close();const output=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!output)return null;const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(output);});return {dataUrl,bytes:new Uint8Array(await output.arrayBuffer())};}finally{if(source.startsWith('blob:'))URL.revokeObjectURL(source);}}
  async function exportPdf(){setBusy('PDF');setMessage('Preparing PDF…');try{const {jsPDF}=await import('jspdf');const pdf=new jsPDF({unit:'mm',format:'a4'});let y=18;const addPage=(needed=10)=>{if(y+needed>282){pdf.addPage();y=18;}};const heading=(text:string)=>{addPage(14);pdf.setTextColor(230,105,10);pdf.setFontSize(14);pdf.setFont('helvetica','bold');pdf.text(text,16,y);y+=8;};const line=(text:string,bold=false)=>{const wrapped=pdf.splitTextToSize(text,178) as string[];addPage(wrapped.length*5+2);pdf.setTextColor(35,35,35);pdf.setFontSize(10);pdf.setFont('helvetica',bold?'bold':'normal');pdf.text(wrapped,16,y);y+=wrapped.length*5+2;};pdf.setFillColor(10,24,31);pdf.rect(0,0,210,30,'F');pdf.setTextColor(255,122,0);pdf.setFontSize(19);pdf.setFont('helvetica','bold');pdf.text(diverName.trim()||'Diver summary',16,14);pdf.setTextColor(255,255,255);pdf.setFontSize(10);pdf.setFont('helvetica','normal');pdf.text(`Prepared ${new Date().toLocaleDateString('en-GB')}`,16,22);y=40;
      if(sections.summary){heading('Dive summary');line(`${chosenDives.length} dives`);line(`${Math.floor(totalMinutes/60)} hours ${totalMinutes%60} minutes underwater`);}
      if(sections.deep){heading('Depth experience');line(`${chosenDives.filter(dive=>(dive.maxDepthM??0)>20).length} dives deeper than 20 m`);line(`${chosenDives.filter(dive=>(dive.maxDepthM??0)>30).length} dives deeper than 30 m`);}
      if(sections.types){heading('Dive types and activities');for(const [type,count] of typeCounts)line(`${type}: ${count}`);}
      if(sections.certifications){heading('Certifications');for(const cert of chosenCertifications){addPage(sections.cards?72:24);line(`${cert.agency} — ${cert.certification}`,true);line([cert.certificationNumber&&`No. ${cert.certificationNumber}`,cert.issuedAt&&`Issued ${cert.issuedAt}`,cert.expiresAt?`Expires ${cert.expiresAt}`:'No expiry',cert.instructor&&`Instructor ${cert.instructor}`].filter(Boolean).join(' | '));if(sections.cards){for(const [side,image] of [['Front',cert.cardFront],['Back',cert.cardBack]] as const){if(!image)continue;const rendered=await renderedCard(image);if(rendered){addPage(58);pdf.setTextColor(90,90,90);pdf.setFontSize(8);pdf.text(side,16,y);y+=3;pdf.addImage(rendered.dataUrl,'JPEG',16,y,80,50);y+=56;}}}}}
      if(sections.logs){heading('Minimal dive log');for(const dive of chosenDives){line(`#${dive.diveNumber??'—'} | ${dive.date||'Date not recorded'} | ${dive.maxDepthM??'—'} m | ${dive.totalElapsedMin??dive.bottomTimeMin??'—'} min | ${dive.site||'Location not recorded'} | ${diveMode(dive)}`);}}
      pdf.save(`zeustek-diver-summary-${new Date().toISOString().slice(0,10)}.pdf`);setMessage('PDF downloaded.');}catch(error){setMessage(error instanceof Error?error.message:'PDF export failed.');}finally{setBusy('');}}
  async function exportWord(){setBusy('Word');setMessage('Preparing Word document…');try{const docx=await import('docx');const children:any[]=[new docx.Paragraph({text:diverName.trim()||'Diver summary',heading:docx.HeadingLevel.TITLE}),new docx.Paragraph({text:`Prepared ${new Date().toLocaleDateString('en-GB')}`})];const heading=(text:string)=>children.push(new docx.Paragraph({text,heading:docx.HeadingLevel.HEADING_1}));const line=(text:string,bold=false)=>children.push(new docx.Paragraph({children:[new docx.TextRun({text,bold})]}));if(sections.summary){heading('Dive summary');line(`${chosenDives.length} dives`);line(`${Math.floor(totalMinutes/60)} hours ${totalMinutes%60} minutes underwater`);}if(sections.deep){heading('Depth experience');line(`${chosenDives.filter(dive=>(dive.maxDepthM??0)>20).length} dives deeper than 20 m`);line(`${chosenDives.filter(dive=>(dive.maxDepthM??0)>30).length} dives deeper than 30 m`);}if(sections.types){heading('Dive types and activities');typeCounts.forEach(([type,count])=>line(`${type}: ${count}`));}if(sections.certifications){heading('Certifications');for(const cert of chosenCertifications){line(`${cert.agency} — ${cert.certification}`,true);line([cert.certificationNumber&&`No. ${cert.certificationNumber}`,cert.issuedAt&&`Issued ${cert.issuedAt}`,cert.expiresAt?`Expires ${cert.expiresAt}`:'No expiry',cert.instructor&&`Instructor ${cert.instructor}`].filter(Boolean).join(' | '));if(sections.cards){for(const [side,image] of [['Front',cert.cardFront],['Back',cert.cardBack]] as const){if(!image)continue;const rendered=await renderedCard(image);if(rendered){line(side);children.push(new docx.Paragraph({children:[new docx.ImageRun({data:rendered.bytes,transformation:{width:420,height:265},type:'jpg'})]}));}}}}}if(sections.logs){heading('Minimal dive log');children.push(new docx.Table({width:{size:100,type:docx.WidthType.PERCENTAGE},rows:[new docx.TableRow({children:['Dive','Date','Depth','Duration','Location','Type'].map(value=>new docx.TableCell({children:[new docx.Paragraph({children:[new docx.TextRun({text:value,bold:true})]})]}))}),...chosenDives.map(dive=>new docx.TableRow({children:[`#${dive.diveNumber??'—'}`,dive.date||'—',`${dive.maxDepthM??'—'} m`,`${dive.totalElapsedMin??dive.bottomTimeMin??'—'} min`,dive.site||'—',diveMode(dive)].map(value=>new docx.TableCell({children:[new docx.Paragraph(String(value))]}))}))]}));}const document=new docx.Document({sections:[{properties:{},children}]});saveBlob(await docx.Packer.toBlob(document),`zeustek-diver-summary-${new Date().toISOString().slice(0,10)}.docx`);setMessage('Word document downloaded.');}catch(error){setMessage(error instanceof Error?error.message:'Word export failed.');}finally{setBusy('');}}
  return <div className="diver-summary"><Card><span className="focus-eyebrow">SHAREABLE DIVER RECORD</span><h2>Diver summary export</h2><p className="focus-copy">Choose exactly what a dive centre or training agency may see, then download a real PDF or Word document.</p><label>Diver name<input value={diverName} onChange={event=>setDiverName(event.target.value)} placeholder="Name shown on the document"/></label><fieldset><legend>Include sections</legend>{Object.entries({summary:'Dive totals',types:'Dive types and activities',deep:'Deep-dive counts',certifications:'Certification details',cards:'Certification card images',logs:'Minimal dive log'}).map(([key,label])=><label key={key}><input type="checkbox" checked={sections[key as keyof typeof sections]} disabled={key==='cards'&&!sections.certifications} onChange={()=>toggleSection(key as keyof typeof sections)}/>{label}</label>)}</fieldset><div className="record-actions"><button className="focus-primary" disabled={Boolean(busy)} onClick={()=>void exportPdf()}><Download size={16}/>{busy==='PDF'?'Preparing PDF…':'Download PDF'}</button><button className="focus-secondary" disabled={Boolean(busy)} onClick={()=>void exportWord()}><Download size={16}/>{busy==='Word'?'Preparing Word…':'Download Word'}</button></div>{message&&<p role="status" className="focus-notice">{message}</p>}</Card>
    <div className="diver-summary-selectors"><Card><div className="focus-card-head"><div><span className="focus-eyebrow">CERTIFICATIONS</span><h3>{selectedCertIds.size} selected</h3></div><div className="record-actions"><button onClick={()=>setSelectedCertIds(new Set(certifications.map(cert=>cert.entityId)))}>All</button><button onClick={()=>setSelectedCertIds(new Set())}>None</button></div></div><div className="summary-check-list">{certifications.map(cert=><label key={cert.entityId}><input type="checkbox" checked={selectedCertIds.has(cert.entityId)} onChange={event=>toggleId(setSelectedCertIds,cert.entityId,event.target.checked)}/><span><b>{cert.certification}</b><small>{cert.agency}{cert.certificationNumber?` · ${cert.certificationNumber}`:''}</small></span></label>)}</div></Card>
    <Card><div className="focus-card-head"><div><span className="focus-eyebrow">DIVES</span><h3>{selectedDiveIds.size} selected</h3></div><div className="record-actions"><button onClick={()=>setSelectedDiveIds(new Set(dives.map(dive=>dive.entityId)))}>All</button><button onClick={()=>setSelectedDiveIds(new Set())}>None</button></div></div><div className="summary-check-list dive-list">{dives.map(dive=><label key={dive.entityId}><input type="checkbox" checked={selectedDiveIds.has(dive.entityId)} onChange={event=>toggleId(setSelectedDiveIds,dive.entityId,event.target.checked)}/><span><b>#{dive.diveNumber??'—'} · {dive.site}</b><small>{dive.date} · {dive.maxDepthM??'—'} m · {dive.totalElapsedMin??dive.bottomTimeMin??'—'} min</small></span></label>)}</div></Card></div></div>;
}

function DataCentre({initialTab}:{initialTab:string}) {
  const tabs=['Imports','Sync','Backups','Diver summary','Site coordinates'];
  const [tab, setTab] = useState(tabs.includes(initialTab)?initialTab:'Imports');
  useEffect(()=>{if(tabs.includes(initialTab))setTab(initialTab);},[initialTab]);
  return <><Heading eyebrow="YOUR DATA" title="Data & backups" copy="Import records, check synchronisation and protect your data." /><div className="section-tabs" role="tablist" aria-label="Data tools">{tabs.map(name => <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div><CollapsibleWorkCard id={`data-tools-${tab.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`} title={tab} eyebrow="DATA TOOL" status="Local-first data remains available while this card is minimised"><div role="tabpanel">{tab === 'Imports' ? <Imports /> : tab === 'Sync' ? <SyncCentre /> : tab === 'Diver summary' ? <DiverSummaryExport/> : tab === 'Site coordinates' ? <SiteCoordinateAudit onUpdated={()=>void refreshDiveRecords('site',true)}/> : <BackupsScreen />}</div></CollapsibleWorkCard></>;
}

function Imports() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState({processed:0,total:0});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [source, setSource] = useState<'padi' | 'other'>('other');
  function choose(next: 'padi' | 'other') {
    if(busy)return;
    setSource(next);
    setNotice('');
    setError('');
    fileRef.current?.click();
  }
  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true);setProgress({processed:0,total:files.length});
    try {
    setError('');
    setNotice('');
    let imported = 0; let skipped=0;
    let preserved = 0;
    for (const [index,file] of Array.from(files).entries()) {
      setProgress({processed:index,total:files.length});
      const form = new FormData();
      form.append('file', file);
      if (source === 'padi') {
        const response = await fetch('/api/padi-sync', {
          method: 'POST',
          body: form,
        });
        const result = (await response.json()) as {
          total?: number;
          added?: number;
          updated?: number; skipped?:number;
          error?: string;
        };
        if (!response.ok) {
          setError(result.error || 'PADI import failed.');
          continue;
        }
        imported += result.added ?? 0; skipped += result.skipped ?? 0;
      } else {
        form.append('category', 'dive');
        const response = await fetch('/api/import', {
          method: 'POST',
          body: form,
        });
        if (response.ok) preserved++;
        else setError('One or more files could not be uploaded.');
      }
    }
    if (imported || skipped)
      setNotice(
        `${imported} PADI dives added; ${skipped} existing or duplicate dives skipped. Existing edits are preserved.`,
      );
    else if (preserved)
      setNotice(
        `${preserved} original file${preserved === 1 ? '' : 's'} preserved for review`,
      );
    await refreshDiveRecords('dive',true);
    }catch(reason){setError(reason instanceof Error?reason.message:'Import failed. Your saved records remain available.');}finally{setBusy(false);if(fileRef.current)fileRef.current.value='';}
  }
  return (
    <>
      <Heading
        eyebrow="SOURCE-FIRST IMPORT"
        title="Import dive history"
        copy="PADI JSON becomes real logbook entries; other originals remain preserved for review."
      />
      <div className="import-grid">
        <Card className="import-source">
          <Waves />
          <div>
            <h3>Oceanic+</h3>
            <p>Exports, PDFs and screenshots</p>
          </div>
          <button className="focus-secondary" disabled={busy} onClick={() => choose('other')}>
            Choose files
          </button>
        </Card>
        <Card className="import-source">
          <BookOpen />
          <div>
            <h3>PADI web log</h3>
            <p>
              Import the JSON you already exported, or use PADI Sync on the Sync
              screen.
            </p>
          </div>
          <button className="focus-secondary" disabled={busy} onClick={() => choose('padi')}>
            Import PADI JSON
          </button>
        </Card>
        <Card className="import-source">
          <FileImage />
          <div>
            <h3>Images & screenshots</h3>
            <p>Preserve originals for later extraction and review</p>
          </div>
          <button className="focus-secondary" disabled={busy} onClick={() => choose('other')}>
            Choose files
          </button>
        </Card>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        multiple={source !== 'padi'}
        accept={
          source === 'padi'
            ? '.json,.har,application/json'
            : '.zip,.json,.csv,.xml,.pdf,image/*'
        }
        onChange={(event) => void upload(event.target.files)}
      />
      {busy&&<div role="status" aria-live="polite"><p>Importing… {progress.processed} of {progress.total} files processed</p><progress value={progress.processed} max={progress.total} aria-label="Importing files"/></div>}
      {notice && (
        <p className="focus-notice">
          <ShieldCheck size={15} />
          {notice}
        </p>
      )}
      {error && (
        <p className="focus-notice error">
          <X size={15} />
          {error}
        </p>
      )}
    </>
  );
}

function optionalNumber(value: string) {
  return value.trim() === '' ? null : Number(value);
}

function emptyCylinder(gasType: DiveCylinder['gasType'] = 'Air'): DiveCylinder {
  return {
    id: crypto.randomUUID(),
    name: 'Back gas',
    gasType,
    oxygenPercent: gasType === 'Air' ? 21 : null,
    heliumPercent: 0,
    nitrogenPercent: gasType === 'Air' ? 79 : null,
    configuration: 'Single Tank',
    material: 'Steel',
    size: '',
    internalVolumeLiters: null,
    startPressureBar: null,
    endPressureBar: null,
    switchDepthM: null,
    switchRuntimeMin: null,
    wasSwitchedTo: false,
    sacRate: null,
    rmvRate: null,
  };
}

function DiveModal({
  close,
  item = null,
  saved,
}: {
  close: () => void;
  item?: (Partial<DiveRecord> & { entityId?: string }) | null;
  saved?: () => void;
}) {
  const [site, setSite] = useState(item?.site ?? '');
  const [siteId, setSiteId] = useState(item?.siteId ?? '');
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [diveNumber, setDiveNumber] = useState(item?.diveNumber?.toString() ?? '');
  const [diveNumberStart, setDiveNumberStart] = useState(1);
  const [date, setDate] = useState(
    item?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [timeIn, setTimeIn] = useState(item?.timeIn ?? '');
  const [timeOut, setTimeOut] = useState(item?.timeOut ?? '');
  const [diveMode, setDiveMode] = useState<
    'recreational' | 'recreational-training' | 'technical' | 'technical-training'
  >(item?.diveMode ?? (item?.isTechnicalDive ? 'technical' : 'recreational'));
  const technicalMode = diveMode === 'technical' || diveMode === 'technical-training';
  const [country, setCountry] = useState(item?.country ?? '');
  const [region, setRegion] = useState(item?.region ?? '');
  const [latitude, setLatitude] = useState(item?.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(item?.longitude?.toString() ?? '');
  const [operator, setOperator] = useState(item?.operator ?? '');
  const [vessel, setVessel] = useState(item?.vessel ?? '');
  const [diveTypes, setDiveTypes] = useState<string[]>(item?.diveTypes ?? []);
  const [waterType, setWaterType] = useState<NonNullable<DiveRecord['waterType']>>(
    item?.waterType ?? '',
  );
  const [depth, setDepth] = useState(item?.maxDepthM?.toString() ?? '');
  const [time, setTime] = useState(item?.bottomTimeMin?.toString() ?? '');
  const [averageDepth, setAverageDepth] = useState(item?.averageDepthM?.toString() ?? '');
  const [streetAddress, setStreetAddress] = useState(item?.streetAddress ?? '');
  const [town, setTown] = useState(item?.town ?? '');
  const [postcode, setPostcode] = useState(item?.postcode ?? '');
  const [hiredEquipment, setHiredEquipment] = useState(item?.hiredEquipment ?? []);
  const [surfaceInterval, setSurfaceInterval] = useState(item?.surfaceIntervalMin?.toString() ?? '');
  const [preGroup, setPreGroup] = useState(item?.prePressureGroup ?? 'A');
  const [postGroup, setPostGroup] = useState(item?.postPressureGroup ?? '');
  const [pressureGroupMode, setPressureGroupMode] = useState<'AUTO' | 'MANUAL'>(item?.pressureGroupMode ?? 'AUTO');
  const [systemPressureGroup, setSystemPressureGroup] = useState(item?.systemCalculatedPostDivePG ?? '');
  const [pressureGroupValidation, setPressureGroupValidation] = useState<PressureGroupValidation>(item?.pressureGroupValidation ?? 'INSUFFICIENT_DATA');
  const [pressureGroupMessage, setPressureGroupMessage] = useState('');
  const [pressureProfile, setPressureProfile] = useState<ReturnType<typeof calculateDivePressureGroupProfile> | null>(null);
  const [safetyStop, setSafetyStop] = useState(item?.safetyStopExecuted ?? false);
  const [safetyDepth, setSafetyDepth] = useState(item?.safetyStopDepthM?.toString() ?? '5');
  const [safetyDuration, setSafetyDuration] = useState(item?.safetyStopDurationMin?.toString() ?? '3');
  const [ascentWarnings, setAscentWarnings] = useState(
    Array.isArray(item?.ascentWarnings)
      ? item.ascentWarnings.join('\n')
      : String(item?.ascentWarnings ?? ''),
  );
  const [weather, setWeather] = useState(item?.weather ?? '');
  const [airTemp, setAirTemp] = useState(item?.airTemperatureC?.toString() ?? '');
  const [surfaceTemp, setSurfaceTemp] = useState(item?.surfaceTemperatureC?.toString() ?? '');
  const [minimumTemp, setMinimumTemp] = useState(item?.minimumTemperatureC?.toString() ?? '');
  const [visibility, setVisibility] = useState(item?.visibilityM?.toString() ?? '');
  const [windSpeed, setWindSpeed] = useState(item?.windSpeedKnots?.toString() ?? '');
  const [windDirection, setWindDirection] = useState(item?.windDirectionDegrees?.toString() ?? '');
  const [waveHeight, setWaveHeight] = useState(item?.waveHeightM?.toString() ?? '');
  const [surge, setSurge] = useState(item?.surge ?? '');
  const [currentStrength, setCurrentStrength] = useState(item?.currentStrength ?? '');
  const [currentDirection, setCurrentDirection] = useState(item?.currentDirectionDegrees?.toString() ?? '');
  const [thermoclines, setThermoclines] = useState(
    Array.isArray(item?.thermoclines)
      ? item.thermoclines.join('\n')
      : String(item?.thermoclines ?? ''),
  );
  const [weatherProvider,setWeatherProvider]=useState(item?.weatherProvider??'');
  const [weatherResolution,setWeatherResolution]=useState(item?.weatherResolution??'');
  const [weatherAttribution,setWeatherAttribution]=useState(item?.weatherAttribution??'');
  const [weatherStatus, setWeatherStatus] = useState('');
  const initialGas = ['Air', 'Nitrox', 'Trimix', 'Oxygen', 'Other'].includes(item?.gas ?? '')
    ? (item?.gas as DiveCylinder['gasType'])
    : 'Air';
  const [cylinders, setCylinders] = useState<DiveCylinder[]>(
    item?.cylinders?.length ? item.cylinders : [emptyCylinder(initialGas)],
  );
  const [decoAlgorithm, setDecoAlgorithm] = useState(item?.decoAlgorithm ?? 'Bühlmann ZHL-16C');
  const [gfLow, setGfLow] = useState(item?.gradientFactorLow?.toString() ?? '');
  const [gfHigh, setGfHigh] = useState(item?.gradientFactorHigh?.toString() ?? '');
  const [plannedRuntime, setPlannedRuntime] = useState(item?.plannedRuntimeMin?.toString() ?? '');
  const [cns, setCns] = useState(item?.cnsPercent?.toString() ?? '');
  const [otu, setOtu] = useState(item?.otu?.toString() ?? '');
  const [deepStops, setDeepStops] = useState(item?.deepStopsExecuted ?? false);
  const [decoStops, setDecoStops] = useState<DecoStop[]>(item?.decoStops ?? []);
  const elapsedTime = summedRuntime(optionalNumber(time), technicalMode ? decoStops : [], safetyStop ? optionalNumber(safetyDuration) : 0)?.toString() ?? '';
  const [exposureSuit, setExposureSuit] = useState(item?.exposureSuit ?? '');
  const [suitThickness, setSuitThickness] = useState(item?.wetsuitThicknessMm?.toString() ?? '');
  const [undergarment, setUndergarment] = useState(item?.undergarment ?? '');
  const [weightBelt, setWeightBelt] = useState(item?.weightBeltKg?.toString() ?? (item?.ballastKg && !item?.integratedWeightKg ? item.ballastKg.toString() : ''));
  const [integratedWeight, setIntegratedWeight] = useState(item?.integratedWeightKg?.toString() ?? '');
  const [weightHarness, setWeightHarness] = useState(item?.weightHarnessKg?.toString() ?? '');
  const [trimPocketWeight, setTrimPocketWeight] = useState(item?.trimPocketKg?.toString() ?? '');
  const [otherWeight, setOtherWeight] = useState(item?.otherWeightKg?.toString() ?? '');
  const [trimAssessment, setTrimAssessment] = useState<NonNullable<DiveRecord['trimAssessment']>>(item?.trimAssessment ?? '');
  const [buoyancyNotes, setBuoyancyNotes] = useState(item?.buoyancyNotes ?? '');
  const [bcdConfiguration, setBcdConfiguration] = useState(item?.bcdConfiguration ?? '');
  const [wingLift, setWingLift] = useState(item?.wingLiftCapacityLbs?.toString() ?? '');
  const [backplate, setBackplate] = useState(item?.backplateMaterial ?? '');
  const [backplateWeight, setBackplateWeight] = useState(item?.backplateWeightKg?.toString() ?? '');
  const [singleTankAdapter, setSingleTankAdapter] = useState(item?.singleTankAdapterUsed ?? false);
  const [specialistEquipment, setSpecialistEquipment] = useState<string[]>(item?.specialistEquipment ?? []);
  const [backupLights, setBackupLights] = useState(item?.backupLightsCount?.toString() ?? '');
  const [technicalRedundancies, setTechnicalRedundancies] = useState<string[]>(item?.technicalRedundancies ?? []);
  const [hydration, setHydration] = useState(item?.hydrationScore?.toString() ?? '');
  const [sleepHours, setSleepHours] = useState(item?.sleepHours?.toString() ?? '');
  const [thermalComfort, setThermalComfort] = useState(item?.thermalComfort ?? '');
  const [fatigue, setFatigue] = useState(item?.fatigue ?? '');
  const [equipmentNotes, setEquipmentNotes] = useState(item?.equipmentNotes ?? '');
  const [personalNotes, setPersonalNotes] = useState(item?.personalNotes ?? '');
  const [aquaticLife, setAquaticLife] = useState((item?.aquaticLife ?? []).join('\n'));
  const [aquaticLifeNotes, setAquaticLifeNotes] = useState(item?.aquaticLifeNotes ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [diveTeamIds, setDiveTeamIds] = useState<string[]>(item?.diveTeamIds ?? item?.buddyIds ?? []);
  const [buddyIds, setBuddyIds] = useState<string[]>(item?.buddyIds ?? []);
  const [diveLeaderId, setDiveLeaderId] = useState(item?.diveLeaderId ?? '');
  const [supportCrew, setSupportCrew] = useState(item?.supportCrew ?? '');
  const [isVerified, setIsVerified] = useState(item?.isVerified ?? false);
  const [verifierAgency, setVerifierAgency] = useState(item?.verifierAgency ?? '');
  const [verifierNumber, setVerifierNumber] = useState(item?.verifierCertificationNumber ?? '');
  const [verificationLink, setVerificationLink] = useState(item?.verificationHashLink ?? '');
  const [equipment, setEquipment] = useState<Array<Stored<EquipmentRecord>>>(
    [],
  );
  const [sets, setSets] = useState<Array<Stored<EquipmentSetRecord>>>([]);
  const [equipmentIds, setEquipmentIds] = useState<string[]>(
    item?.equipmentIds ?? [],
  );
  const [equipmentSetIds, setEquipmentSetIds] = useState<string[]>(
    item?.equipmentSetIds ?? (item?.equipmentSetId ? [item.equipmentSetId] : []),
  );
  const [hireGear, setHireGear] = useState(item?.hireGear ?? false);
  const [ownGear, setOwnGear] = useState(!item?.hireGear || Boolean(item?.equipmentIds?.length));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void listEquipment().then(setEquipment);
    void listEquipmentSets().then(setSets);
    void listDiveSites().then(setSites);
    void listPeople().then(setPeople);
    void listDives().then(setDives);
    void listDashboardSettings().then((records) =>
      setDiveNumberStart(Math.max(1, records[0]?.diveNumberStart || 1)),
    );
  }, [item]);
  useEffect(() => {
    const key = `${date}T${timeIn || '23:59'}`;
    const earlier = dives.filter(
      (dive) =>
        dive.entityId !== item?.entityId &&
        `${dive.date}T${dive.timeIn || '23:59'}` <= key,
    ).length;
    setDiveNumber(String(diveNumberStart + earlier));
  }, [date, diveNumberStart, dives, item?.entityId, timeIn]);

  const previousTotal = dives
    .filter((dive) => dive.entityId !== item?.entityId && dive.date <= date)
    .reduce((total, dive) => total + (dive.totalElapsedMin ?? dive.bottomTimeMin ?? 0), 0);
  const thisDiveTime = optionalNumber(elapsedTime) ?? optionalNumber(time) ?? 0;
  const currentDiveKey = `${date}T${timeIn || '23:59'}`;
  const previousDive = [...dives]
    .filter(
      (dive) =>
        dive.entityId !== item?.entityId &&
        dive.date === date &&
        `${dive.date}T${dive.timeIn || '23:59'}` < currentDiveKey,
    )
    .sort((a, b) =>
      `${b.date}T${b.timeIn || '23:59'}`.localeCompare(
        `${a.date}T${a.timeIn || '23:59'}`,
      ),
    )[0];
  const previousPostGroup = previousDive?.postPressureGroup ?? '';
  const totalBallast = [weightBelt, integratedWeight, weightHarness, trimPocketWeight, otherWeight, backplateWeight]
    .reduce((total, value) => total + (optionalNumber(value) ?? 0), 0);

  function toggleValue(setter: React.Dispatch<React.SetStateAction<string[]>>, value: string, checked: boolean) {
    setter((current) =>
      checked ? Array.from(new Set([...current, value])) : current.filter((entry) => entry !== value),
    );
  }

  function toggleTeamMember(value: string, checked: boolean) {
    toggleValue(setDiveTeamIds, value, checked);
    if (!checked) {
      setBuddyIds((current) => current.filter((id) => id !== value));
      if (diveLeaderId === value) setDiveLeaderId('');
    }
  }

  function selectSite(value: string) {
    setSite(value);
    const match = sites.find((candidate) => candidate.name.toLowerCase() === value.trim().toLowerCase());
    setSiteId(match?.entityId ?? '');
    if (match) {
      setTown(match.location ?? '');
      setRegion(match.region ?? '');
      setWaterType(match.waterType === 'fresh' ? 'Freshwater' : match.waterType === 'salt' ? 'Saltwater' : match.waterType === 'brackish' ? 'Brackish' : '');
      setDiveTypes(match.diveTypes ?? (DIVE_ACTIVITIES.filter(activity => activity.toLowerCase() === match.siteType)));
      setCountry(match.country ?? '');
      setStreetAddress(match.address ?? '');
      setPostcode(match.postcode ?? '');
      setLatitude(match.latitude?.toString() ?? '');
      setLongitude(match.longitude?.toString() ?? '');
    }
  }

  const [gasRateStatus,setGasRateStatus]=useState('');
  function calculateFormGasRates(){const result=fillMissingGasRates({cylinders,averageDepthM:optionalNumber(averageDepth),totalElapsedMin:optionalNumber(elapsedTime)});setCylinders(result.cylinders);setGasRateStatus(result.error??(result.changed?'Missing SAC and RMV values calculated. Save the dive to keep them.':'SAC and RMV are already recorded; existing values kept.'));}
  function updateCylinder(index: number, patch: Partial<DiveCylinder>) {
    setCylinders((current) =>
      current.map((cylinder, position) =>
        position === index ? { ...cylinder, ...patch } : cylinder,
      ),
    );
  }

  function runPressureGroupCheck(verifyManual = false) {
    if (previousDive && !previousPostGroup && pressureGroupMode === 'AUTO') {
      setPressureGroupValidation('INSUFFICIENT_DATA');
      setPressureGroupMessage('The previous dive has no ending pressure group. Enter the pre-dive group in Manual mode or update the earlier dive first.');
      setPressureProfile(null);
      return;
    }
    const result = calculateDivePressureGroupProfile({
      depthM: optionalNumber(averageDepth) ?? optionalNumber(depth),
      bottomTimeMin: optionalNumber(time),
      previousPostDiveGroup: previousPostGroup,
      surfaceIntervalMin: optionalNumber(surfaceInterval),
    });
    setPressureProfile(result);
    setSystemPressureGroup(result.pressureGroup);
    if (verifyManual && result.pressureGroup) {
      const preAudit = result.preDivePressureGroup
        ? verifyManualPressureGroup(preGroup, result.preDivePressureGroup)
        : { validation: 'MATCHED' as PressureGroupValidation, message: 'No residual group was required.' };
      const postAudit = verifyManualPressureGroup(postGroup, result.pressureGroup);
      const audit = [preAudit, postAudit].find((entry) => entry.validation === 'VIOLATION_DANGER')
        ?? [preAudit, postAudit].find((entry) => entry.validation === 'INSUFFICIENT_DATA')
        ?? [preAudit, postAudit].find((entry) => entry.validation === 'MANUAL_MORE_CONSERVATIVE')
        ?? postAudit;
      setPressureGroupValidation(audit.validation);
      setPressureGroupMessage(`Pre-dive: ${preAudit.message} Post-dive: ${postAudit.message}`);
      return;
    }
    setPressureGroupValidation(result.validation);
    setPressureGroupMessage(result.message);
    if (pressureGroupMode === 'AUTO') {
      setPreGroup(result.preDivePressureGroup);
      if (result.pressureGroup) setPostGroup(result.pressureGroup);
    }
  }

  async function pullWeatherForDive() {
    const siteRecord = sites.find((candidate) => candidate.entityId === siteId);
    const lat = optionalNumber(latitude) ?? siteRecord?.latitude ?? null;
    const lng = optionalNumber(longitude) ?? siteRecord?.longitude ?? null;
    if (lat == null || lng == null || !date) {
      setWeatherStatus('Select a site with coordinates and a dive date first.');
      return;
    }
    setWeatherStatus('Finding recorded conditions…');
    try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      date,
      time: timeIn || '12:00',
      marine: String(['shore', 'boat', 'wreck', 'sea'].includes(siteRecord?.siteType ?? '')),
    });
    const response = await fetch(`/api/site-weather?${params}`, { cache: 'no-store' });
    const result = (await response.json()) as {
      error?: string;
      logConditions?: {
        weatherSummary?: string;
        airTemperatureC?: number | null;
        windSpeedKnots?: number | null;
        windDirectionDegrees?: number | null;
        waveHeightM?: number | null;
        surfaceTemperatureC?: number | null;
        currentDirectionDegrees?: number | null;
      };
      attribution?: string; provider?:string;resolution?:string;
    };
    if (!response.ok || !result.logConditions) {
      setWeatherStatus(result.error || 'Weather conditions are unavailable for that date.');
      return;
    }
    const conditions = result.logConditions;
    setWeatherProvider(result.provider??'Open-Meteo');setWeatherResolution(result.resolution??'hourly');setWeatherAttribution(result.attribution??'');
    if(!conditions.weatherSummary && conditions.airTemperatureC == null && conditions.surfaceTemperatureC == null){setWeatherStatus('No weather data are available for that date and time. Existing entries were kept.');return;}
    setWeather(conditions.weatherSummary || weather);
    if (conditions.airTemperatureC != null) setAirTemp(String(conditions.airTemperatureC));
    if (conditions.windSpeedKnots != null) setWindSpeed(String(conditions.windSpeedKnots));
    if (conditions.windDirectionDegrees != null) setWindDirection(String(conditions.windDirectionDegrees));
    if (conditions.waveHeightM != null) setWaveHeight(String(conditions.waveHeightM));
    if (conditions.surfaceTemperatureC != null) setSurfaceTemp(String(conditions.surfaceTemperatureC));
    if (conditions.currentDirectionDegrees != null) setCurrentDirection(String(conditions.currentDirectionDegrees));
    setWeatherStatus(`Conditions added. ${result.attribution ?? ''}`);
    } catch {setWeatherStatus('Weather could not be reached. Your existing entries were kept. Please try again later.');}
  }

  async function submit() {
    if (!site.trim() || !diveNumber || !timeIn || !timeOut) return;
    setSaving(true);
    let resolvedSiteId = siteId;
    let siteSource: DiveRecord['siteSource'] = 'manual';
    const selectedSite = sites.find((candidate) => candidate.entityId === siteId);
    if (selectedSite?.sourceName === 'Finstrokes') siteSource = 'Finstrokes_DB';
    if (selectedSite?.sourceName === 'DiveMap') siteSource = 'Divemap_UK';
    if (!resolvedSiteId) {
      const created = await saveDiveSite({
        name: site.trim(),
        location: town, region, country, address: streetAddress, postcode, diveTypes,
        waterType: waterType === 'Freshwater' ? 'fresh' : waterType === 'Saltwater' ? 'salt' : waterType === 'Brackish' ? 'brackish' : '',
        latitude: optionalNumber(latitude),
        longitude: optionalNumber(longitude),
        siteType: 'other',
        difficulty: 'intermediate',
        access: '',
        parking: '',
        amenities: '',
        entryExit: '',
        airFill: '',
        mobileSignal: '',
        accommodation: '',
        nearbyFood: '',
        website: '',
        sourceName: 'Manual',
        sourceUrl: '',
        showWeather: false,
        maxDepthM: optionalNumber(depth),
        hazards: '',
        notes: 'Created while logging a dive.',
      });
      resolvedSiteId = created.id;
    }
    const rateResult=fillMissingGasRates({cylinders,averageDepthM:optionalNumber(averageDepth),totalElapsedMin:optionalNumber(elapsedTime)});
    const calculatedCylinders = rateResult.cylinders.map(cylinder=>({...cylinder,nitrogenPercent:Math.max(0,100-(cylinder.oxygenPercent ?? (cylinder.gasType==='Air'?21:0))-(cylinder.heliumPercent??0))}));
    const pressureResult = calculateDivePressureGroupProfile({
      depthM: optionalNumber(depth),
      bottomTimeMin: optionalNumber(time),
      previousPostDiveGroup: previousPostGroup,
      surfaceIntervalMin: optionalNumber(surfaceInterval),
    });
    const pressureAudit =
      pressureGroupMode === 'MANUAL' && pressureResult.pressureGroup
        ? verifyManualPressureGroup(postGroup, pressureResult.pressureGroup)
        : { validation: pressureResult.validation, message: pressureResult.message };
    await saveDive({
      ...(item?.entityId ? { entityId: item.entityId } : {}),
      ...(item?.originatingPlanId ? { originatingPlanId: item.originatingPlanId } : {}),
      ...(item?.originatingPlanRevision ? { originatingPlanRevision: item.originatingPlanRevision } : {}),
      schemaVersion: 'zeustek-universal-dive-log/1.0',
      site: site.trim(),
      siteId: resolvedSiteId,
      siteSource,
      diveNumber: Number(diveNumber),
      date,
      timeIn,
      timeOut,
      diveMode,
      isTechnicalDive: technicalMode,
      country,
      region,
      latitude: optionalNumber(latitude),
      longitude: optionalNumber(longitude),
      operator,
      vessel,
      diveTypes,
      waterType,
      maxDepthM: depth ? Number(depth) : null,
      averageDepthM: optionalNumber(averageDepth),
      bottomTimeMin: time ? Number(time) : null,
      totalElapsedMin: optionalNumber(elapsedTime),
      streetAddress, postcode, town, hiredEquipment: hireGear ? hiredEquipment : [],
      surfaceIntervalMin: optionalNumber(surfaceInterval),
      prePressureGroup:
        pressureGroupMode === 'AUTO'
          ? pressureResult.preDivePressureGroup
          : preGroup,
      postPressureGroup:
        pressureGroupMode === 'AUTO' && pressureResult.pressureGroup
          ? pressureResult.pressureGroup
          : postGroup,
      pressureGroupMode,
      pressureGroupValidation: pressureAudit.validation,
      systemCalculatedPostDivePG: pressureResult.pressureGroup,
      pressureGroupDataset: PRESSURE_GROUP_DATASET_NAME,
      previousPostPressureGroup: previousPostGroup,
      residualNitrogenTimeMin: pressureResult.residualNitrogenTimeMin,
      adjustedNoDecompressionLimitMin: pressureResult.adjustedNoDecompressionLimitMin,
      totalBottomTimeWithRntMin: pressureResult.totalBottomTimeMin,
      roundedTableDepthFt: pressureResult.roundedDepthFt,
      safetyStopExecuted: safetyStop,
      safetyStopDepthM: safetyStop ? optionalNumber(safetyDepth) : null,
      safetyStopDurationMin: safetyStop ? optionalNumber(safetyDuration) : null,
      ascentWarnings: ascentWarnings.split('\n').map((value) => value.trim()).filter(Boolean),
      weather, weatherProvider, weatherResolution, weatherAttribution,
      airTemperatureC: optionalNumber(airTemp),
      surfaceTemperatureC: optionalNumber(surfaceTemp),
      minimumTemperatureC: optionalNumber(minimumTemp),
      visibilityM: optionalNumber(visibility),
      windSpeedKnots: optionalNumber(windSpeed),
      windDirectionDegrees: optionalNumber(windDirection),
      waveHeightM: optionalNumber(waveHeight),
      surge,
      currentStrength,
      currentDirectionDegrees: optionalNumber(currentDirection),
      thermoclines: thermoclines.split('\n').map((value) => value.trim()).filter(Boolean),
      cylinders: calculatedCylinders,
      gas: calculatedCylinders[0]?.gasType ?? 'Air',
      decoDive: technicalMode,
      decoAlgorithm: technicalMode ? decoAlgorithm : '',
      gradientFactorLow: technicalMode ? optionalNumber(gfLow) : null,
      gradientFactorHigh: technicalMode ? optionalNumber(gfHigh) : null,
      plannedRuntimeMin: technicalMode ? optionalNumber(plannedRuntime) : null,
      cnsPercent: technicalMode ? optionalNumber(cns) : null,
      otu: technicalMode ? optionalNumber(otu) : null,
      deepStopsExecuted: technicalMode && deepStops,
      decoStops: technicalMode ? decoStops : [],
      exposureSuit,
      wetsuitThicknessMm: optionalNumber(suitThickness),
      undergarment,
      ballastKg: totalBallast,
      weightBeltKg: optionalNumber(weightBelt),
      integratedWeightKg: optionalNumber(integratedWeight),
      weightHarnessKg: optionalNumber(weightHarness),
      trimPocketKg: optionalNumber(trimPocketWeight),
      otherWeightKg: optionalNumber(otherWeight),
      backplateWeightKg: backplate && backplate !== 'None' ? optionalNumber(backplateWeight) : null,
      trimAssessment,
      weightDistribution: [
        weightBelt && `Belt ${weightBelt}kg`,
        integratedWeight && `Integrated ${integratedWeight}kg`,
        weightHarness && `Harness ${weightHarness}kg`,
        trimPocketWeight && `Trim pockets ${trimPocketWeight}kg`,
        otherWeight && `Other ${otherWeight}kg`,
        backplate && backplate !== 'None' && backplateWeight && `Backplate ${backplateWeight}kg`,
      ].filter(Boolean).join(', '),
      buoyancyNotes,
      bcdConfiguration,
      wingLiftCapacityLbs: optionalNumber(wingLift),
      backplateMaterial: backplate,
      singleTankAdapterUsed: singleTankAdapter,
      specialistEquipment,
      backupLightsCount: optionalNumber(backupLights),
      technicalRedundancies,
      hydrationScore: optionalNumber(hydration),
      sleepHours: optionalNumber(sleepHours),
      thermalComfort,
      fatigue,
      equipmentNotes,
      personalNotes,
      aquaticLife: aquaticLife.split('\n').flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean),
      aquaticLifeNotes,
      notes,
      diveTeamIds,
      buddyIds,
      diveLeaderId,
      supportCrew,
      isVerified,
      verifierAgency,
      verifierCertificationNumber: verifierNumber,
      verificationHashLink: verificationLink,
      preDiveTotalTimeMin: previousTotal,
      currentTotalTimeMin: previousTotal + thisDiveTime,
      ...(item?.source ? { source: item.source } : {}),
      equipmentIds: ownGear ? equipmentIds : [],
      equipmentSetId: ownGear ? equipmentSetIds[0] ?? '' : '',
      equipmentSetIds: ownGear ? equipmentSetIds : [],
      hireGear,
    });
    await renumberDivesByChronology(diveNumberStart);
    setSaving(false);
    saved?.();
    close();
  }
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog editable label={item ? "Edit dive" : "Log a dive"} close={close} className="focus-modal dive-log-modal">
        <header>
          <div>
            <span className="focus-eyebrow">PRIVATE CLOUD ENTRY</span>
            <h2 id="dive-title">Log a dive</h2>
          </div>
          <button className="focus-icon" aria-label="Close editor" data-dialog-close onClick={close}>
            <X size={18} />
          </button>
        </header>
        <EditorSections selector=".dive-form-section"/>
        <section className="dive-form-section">
          <span className="focus-eyebrow">DIVE IDENTITY & SITE</span>
          <div className="field-grid field-grid-four">
            <label>
              Dive number · automatic
              <input type="number" min="1" value={diveNumber} readOnly />
            </label>
            <label>
              Mode
              <select value={diveMode} onChange={(event) => setDiveMode(event.target.value as typeof diveMode)}>
                <option value="recreational">Recreational</option>
                <option value="recreational-training">Recreational training</option>
                <option value="technical">Technical</option>
                <option value="technical-training">Technical training</option>
              </select>
            </label>
            <label>
              Date
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              Time in
              <input type="time" value={timeIn} onChange={(event) => setTimeIn(event.target.value)} />
            </label>
            <label>
              Time out
              <input type="time" value={timeOut} onChange={(event) => setTimeOut(event.target.value)} />
            </label>
            <label className="record-wide">
              Dive site
              <input list="dive-site-options" value={site} onChange={(event) => selectSite(event.target.value)} placeholder="Search saved sites or type a new one" />
              <datalist id="dive-site-options">
                {sites.map((candidate) => <option key={candidate.entityId} value={candidate.name}>{candidate.location}</option>)}
              </datalist>
            </label>
            <label>Town / location<input value={town} onChange={event=>setTown(event.target.value)}/></label><label>Country<input value={country} onChange={(event) => setCountry(event.target.value)} /></label>
            <label>Street address<input value={streetAddress} onChange={(event) => setStreetAddress(event.target.value)} /></label><label>Zip / postal code<input value={postcode} onChange={(event) => setPostcode(event.target.value)} /></label><label>Region / county<input value={region} onChange={(event) => setRegion(event.target.value)} /></label>
            <label>Latitude<input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
            <label>Longitude<input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
            <label>Dive operator<input value={operator} onChange={(event) => setOperator(event.target.value)} /></label>
            <label>Vessel<input value={vessel} onChange={(event) => setVessel(event.target.value)} /></label>
          </div>
          {site.trim() && !siteId && <p className="inline-create-notice"><Plus size={14} /> “{site.trim()}” will be added to your master Sites list when this dive is saved.</p>}
          <span className="field-subheading">DIVE SETTING & ACTIVITY</span>
          <DiveSettingActivity values={diveTypes} onChange={setDiveTypes}/>
        </section>

        <section className="dive-form-section">
          <span className="focus-eyebrow">DEPTH, TIME & TOTALS</span>
          <div className="field-grid field-grid-four">
          <label>
            Max depth (m)
            <input type="number" min="0" step="0.1" value={depth} onChange={(event) => setDepth(event.target.value)} />
          </label>
          <label>
            Average depth (m)
            <input type="number" min="0" step="0.1" value={averageDepth} onChange={(event) => setAverageDepth(event.target.value)} />
          </label>
          <label>
            Bottom time (min)
            <input type="number" min="0" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
          <label>
            Total elapsed runtime (min)
            <input type="number" min="0" value={elapsedTime} readOnly aria-label="Elapsed runtime: bottom time plus decompression and safety stop" />
          </label>
          <label>Surface interval (min)<input type="number" min="0" value={surfaceInterval} onChange={(event) => setSurfaceInterval(event.target.value)} /></label>
          <label>Pressure-group mode<select value={pressureGroupMode} onChange={(event) => setPressureGroupMode(event.target.value as 'AUTO' | 'MANUAL')}><option value="AUTO">Automatic table lookup</option><option value="MANUAL">Manual entry / audit</option></select></label>
          <label>Pre-dive pressure group<input maxLength={1} value={preGroup} readOnly={pressureGroupMode === 'AUTO'} onChange={(event) => setPreGroup(event.target.value.toUpperCase())} placeholder={previousDive ? 'Calculated from interval' : 'First dive starts at A'} /></label>
          <label>Post-dive pressure group<input maxLength={2} value={postGroup} readOnly={pressureGroupMode === 'AUTO'} onChange={(event) => setPostGroup(event.target.value.toUpperCase())} /></label>
          <label className="record-check"><input type="checkbox" checked={safetyStop} onChange={(event) => setSafetyStop(event.target.checked)} />Safety stop completed</label>
          {safetyStop && <><label>Stop depth (m)<input type="number" min="0" step="0.1" value={safetyDepth} onChange={(event) => setSafetyDepth(event.target.value)} /></label><label>Stop duration (min)<input type="number" min="0" value={safetyDuration} onChange={(event) => setSafetyDuration(event.target.value)} /></label></>}
          <label className="record-wide">Ascent-rate warnings<textarea value={ascentWarnings} onChange={(event) => setAscentWarnings(event.target.value)} placeholder="One warning per line" /></label>
          </div>
          <div className={`pressure-group-tool ${pressureGroupValidation.toLowerCase()}`}>
            <div><strong>PADI RDP reference-table check</strong><span>{pressureGroupMessage || 'Training and log verification only. This calculator does not replace a dive computer, qualified instruction, or formal dive planning.'}</span>{systemPressureGroup && <small>Calculated ending group: {systemPressureGroup}</small>}</div>
            <button className="focus-secondary" onClick={() => runPressureGroupCheck(false)}>Calculate PG</button>
            {pressureGroupMode === 'MANUAL' && <button className="focus-secondary" onClick={() => runPressureGroupCheck(true)}>Verify manual entry</button>}
          </div>
          {pressureProfile && pressureProfile.roundedDepthFt && (
            <div className="pressure-result-grid" aria-live="polite">
              <span><small>Table depth</small><strong>{pressureProfile.roundedDepthFt} ft</strong></span>
              <span><small>Previous PG</small><strong>{pressureProfile.previousPostDiveGroup || 'None'}</strong></span>
              <span><small>Pre-dive PG</small><strong>{pressureProfile.preDivePressureGroup || 'None'}</strong></span>
              <span><small>RNT</small><strong>{pressureProfile.residualNitrogenTimeMin} min</strong></span>
              <span><small>Adjusted NDL</small><strong>{pressureProfile.adjustedNoDecompressionLimitMin ?? '—'} min</strong></span>
              <span><small>Total bottom time</small><strong>{pressureProfile.totalBottomTimeMin ?? '—'} min</strong></span>
              <span><small>Post-dive PG</small><strong>{pressureProfile.pressureGroup || '—'}</strong></span>
            </div>
          )}
          <p className="pressure-safety-note">Do not use this feature to conduct or plan a dive. Follow your training, current dive computer, and the original table instructions.</p>
          <div className="dive-total-strip"><span>Before <strong>{previousTotal} min</strong></span><span>This dive <strong>{thisDiveTime} min</strong></span><span>New total <strong>{previousTotal + thisDiveTime} min</strong></span></div>
        </section>

        <details className="dive-form-section">
          <summary>Environmental conditions</summary>
          <div className="field-grid field-grid-four">
            <label>Water type<select value={waterType} onChange={(event) => setWaterType(event.target.value as NonNullable<DiveRecord['waterType']>)}><option value="">Not recorded</option><option>Saltwater</option><option>Freshwater</option><option>Other</option></select></label>
            <label>Weather<input value={weather} onChange={(event) => setWeather(event.target.value)} /></label>
            <label>Air temp (°C)<input type="number" step="0.1" value={airTemp} onChange={(event) => setAirTemp(event.target.value)} /></label>
            <label>Surface water (°C)<input type="number" step="0.1" value={surfaceTemp} onChange={(event) => setSurfaceTemp(event.target.value)} /></label>
            <label>Minimum water (°C)<input type="number" step="0.1" value={minimumTemp} onChange={(event) => setMinimumTemp(event.target.value)} /></label>
            <label>Visibility (m)<input type="number" min="0" step="0.1" value={visibility} onChange={(event) => setVisibility(event.target.value)} /></label>
            <label>Wind (knots)<input type="number" min="0" value={windSpeed} onChange={(event) => setWindSpeed(event.target.value)} /></label>
            <label>Wind direction (°)<input type="number" min="0" max="359" value={windDirection} onChange={(event) => setWindDirection(event.target.value)} /></label>
            <label>Wave height (m)<input type="number" min="0" step="0.1" value={waveHeight} onChange={(event) => setWaveHeight(event.target.value)} /></label>
            <label>Surge<select value={surge} onChange={(event) => setSurge(event.target.value)}><option value="">Not recorded</option><option>None</option><option>Light</option><option>Moderate</option><option>Heavy</option></select></label>
            <label>Current<select value={currentStrength} onChange={(event) => setCurrentStrength(event.target.value)}><option value="">Not recorded</option><option>None</option><option>Mild</option><option>Strong</option></select></label>
            <label>Current direction (°)<input type="number" min="0" max="359" value={currentDirection} onChange={(event) => setCurrentDirection(event.target.value)} /></label>
            <label className="record-wide">Thermoclines<textarea value={thermoclines} onChange={(event) => setThermoclines(event.target.value)} placeholder="One depth or observation per line" /></label>
          </div>
          <div className="weather-pull"><button className="focus-secondary" onClick={() => void pullWeatherForDive()}><CloudRain size={15} /> Pull local weather for this date and time</button><span>{weatherStatus}</span></div>
        </details>

        <details className="dive-form-section">
          <summary>Gas & cylinders ({cylinders.length})</summary><button className="focus-secondary" type="button" onClick={calculateFormGasRates}><Gauge size={16}/>Calculate SAC / RMV</button><p className="focus-copy">Estimated from recorded gas use, average depth and elapsed runtime. SAC is bar/min; RMV is L/min. Single-tank open-circuit dives only.</p>{gasRateStatus&&<p role="status">{gasRateStatus}</p>}
          <p className="section-help">Record one to four independent cylinders, including switch events and consumption.</p>
          {cylinders.map((cylinder, index) => (
            <div className="cylinder-row" key={cylinder.id}>
              <div className="field-grid field-grid-four">
                <label>Label<input value={cylinder.name} onChange={(event) => updateCylinder(index, { name: event.target.value })} /></label>
                <label>Configuration<select value={cylinder.configuration} onChange={(event) => updateCylinder(index, { configuration: event.target.value })}><option>Single Tank</option><option>Doubles Manifold</option><option>Independent Doubles</option><option>Sidemount</option><option>CCR Oxygen</option><option>CCR Diluent</option></select></label>
                <label>Gas<select value={cylinder.gasType} onChange={(event) => updateCylinder(index, { gasType: event.target.value as DiveCylinder['gasType'] })}><option>Air</option><option>Nitrox</option><option>Trimix</option><option>Oxygen</option><option>Other</option></select></label>
                <label>Material<select value={cylinder.material} onChange={(event) => updateCylinder(index, { material: event.target.value })}><option>Steel</option><option>Aluminum</option></select></label>
                <label>O₂ %<input type="number" min="0" max="100" value={cylinder.oxygenPercent ?? ''} onChange={(event) => updateCylinder(index, { oxygenPercent: optionalNumber(event.target.value) })} /></label>
                <label>He %<input type="number" min="0" max="100" value={cylinder.heliumPercent ?? ''} onChange={(event) => updateCylinder(index, { heliumPercent: optionalNumber(event.target.value) })} /></label>
                <label>Internal volume (L)<input type="number" min="0" step="0.1" value={cylinder.internalVolumeLiters ?? ''} onChange={(event) => updateCylinder(index, { internalVolumeLiters: optionalNumber(event.target.value) })} /></label>
                <label>Known size / model<input value={cylinder.size} onChange={(event) => updateCylinder(index, { size: event.target.value })} placeholder="12L, AL80, HP100…" /></label>
                <label>Start pressure (bar)<input type="number" min="0" value={cylinder.startPressureBar ?? ''} onChange={(event) => updateCylinder(index, { startPressureBar: optionalNumber(event.target.value) })} /></label>
                <label>End pressure (bar)<input type="number" min="0" value={cylinder.endPressureBar ?? ''} onChange={(event) => updateCylinder(index, { endPressureBar: optionalNumber(event.target.value) })} /></label>
                <label>SAC (bar/min)<input type="number" min="0" step="0.1" value={cylinder.sacPressureBarMin ?? ''} onChange={(event) => updateCylinder(index, { sacPressureBarMin: optionalNumber(event.target.value) })} /></label>
                <label>RMV (L/min, auto or override)<input type="number" min="0" step="0.1" value={cylinder.rmvRate ?? ''} onChange={(event) => updateCylinder(index, { rmvRate: optionalNumber(event.target.value) })} /></label>
                <label className="record-check"><input type="checkbox" checked={cylinder.wasSwitchedTo ?? false} onChange={(event) => updateCylinder(index, { wasSwitchedTo: event.target.checked })} />Gas switch used</label>
                {cylinder.wasSwitchedTo && <><label>Switch depth (m)<input type="number" min="0" step="0.1" value={cylinder.switchDepthM ?? ''} onChange={(event) => updateCylinder(index, { switchDepthM: optionalNumber(event.target.value) })} /></label><label>Switch runtime (min)<input type="number" min="0" value={cylinder.switchRuntimeMin ?? ''} onChange={(event) => updateCylinder(index, { switchRuntimeMin: optionalNumber(event.target.value) })} /></label></>}
              </div>
              {cylinders.length > 1 && <button className="focus-secondary compact-button" onClick={() => setCylinders((current) => current.filter((_, position) => position !== index))}><Trash2 size={14} /> Remove cylinder</button>}
            </div>
          ))}
          {cylinders.length < 4 && <button className="focus-secondary" onClick={() => setCylinders((current) => [...current, { ...emptyCylinder('Nitrox'), name: `Cylinder ${current.length + 1}` }])}><Plus size={15} /> Add cylinder</button>}
        </details>

        {technicalMode && (
          <details className="dive-form-section technical-section">
            <summary>Technical decompression profile</summary>
            <div className="field-grid field-grid-four">
              <label>Algorithm<select value={decoAlgorithm} onChange={(event) => setDecoAlgorithm(event.target.value)}><option>Bühlmann ZHL-16C</option><option>VPM-B</option><option>Other</option></select></label>
              <label>GF low<input type="number" min="0" max="100" value={gfLow} onChange={(event) => setGfLow(event.target.value)} /></label>
              <label>GF high<input type="number" min="0" max="100" value={gfHigh} onChange={(event) => setGfHigh(event.target.value)} /></label>
              <label>Planned runtime (min)<input type="number" min="0" value={plannedRuntime} onChange={(event) => setPlannedRuntime(event.target.value)} /></label>
              <label>End CNS %<input type="number" min="0" value={cns} onChange={(event) => setCns(event.target.value)} /></label>
              <label>OTU accrued<input type="number" min="0" value={otu} onChange={(event) => setOtu(event.target.value)} /></label>
              <label className="record-check"><input type="checkbox" checked={deepStops} onChange={(event) => setDeepStops(event.target.checked)} />Deep stops executed</label>
            </div>
            {decoStops.map((stop, index) => <div className="deco-stop" key={index}><label>Depth (m)<input type="number" value={stop.depthM ?? ''} onChange={(event) => setDecoStops((current) => current.map((value, position) => position === index ? { ...value, depthM: optionalNumber(event.target.value) } : value))} /></label><label>Planned (min)<input type="number" value={stop.durationMin ?? ''} onChange={(event) => setDecoStops((current) => current.map((value, position) => position === index ? { ...value, durationMin: optionalNumber(event.target.value) } : value))} /></label><label>Actual (min)<input type="number" value={stop.actualDurationMin ?? ''} onChange={(event) => setDecoStops((current) => current.map((value, position) => position === index ? { ...value, actualDurationMin: optionalNumber(event.target.value) } : value))} /></label><label className="record-check"><input type="checkbox" checked={stop.ceilingViolated ?? false} onChange={(event) => setDecoStops((current) => current.map((value, position) => position === index ? { ...value, ceilingViolated: event.target.checked } : value))} />Ceiling violation</label><button className="focus-icon" onClick={() => setDecoStops((current) => current.filter((_, position) => position !== index))}><Trash2 size={14} /></button></div>)}
            <button className="focus-secondary" onClick={() => setDecoStops((current) => [...current, { depthM: null, durationMin: null, actualDurationMin: null, ceilingViolated: false }])}><Plus size={15} /> Add deco stop</button>
          </details>
        )}

        <details className="dive-form-section" open>
          <summary>Equipment configuration</summary>
          <div className="dive-equipment">
            <label className="record-check">
              <input
                type="checkbox"
                checked={hireGear}
                onChange={(event) => {
                  setHireGear(event.target.checked);

                }}
              />
              Hire gear
            </label>
            <label className="record-check"><input type="checkbox" checked={ownGear} onChange={event=>setOwnGear(event.target.checked)}/>Own gear</label>
            {ownGear && <>
              <span className="focus-eyebrow">SAVED SETS — SELECT ONE OR MORE</span>
              <div className="choice-grid">
                {sets.map((set) => <label key={set.entityId}><input type="checkbox" checked={equipmentSetIds.includes(set.entityId)} onChange={(event) => {
                  const checked = event.target.checked;
                  toggleValue(setEquipmentSetIds, set.entityId, checked);
                  if (checked) setEquipmentIds((current) => Array.from(new Set([...current, ...set.equipmentIds])));
                  else {
                    const otherSetItems = new Set(sets.filter((candidate) => candidate.entityId !== set.entityId && equipmentSetIds.includes(candidate.entityId)).flatMap((candidate) => candidate.equipmentIds));
                    setEquipmentIds((current) => current.filter((id) => !set.equipmentIds.includes(id) || otherSetItems.has(id)));
                  }
                }} />{set.name}</label>)}
              </div>
              <span className="focus-eyebrow">INDIVIDUAL ITEMS</span>
              <div className="equipment-picker">
                {equipment.filter((record) => !record.retired).map((record) => <label key={record.entityId}><input type="checkbox" checked={equipmentIds.includes(record.entityId)} onChange={(event) => toggleValue(setEquipmentIds, record.entityId, event.target.checked)} /><span><strong>{record.name}</strong><small>{[record.manufacturer, record.model].filter(Boolean).join(' ')}</small></span></label>)}
              </div>
              {!equipmentIds.length && <p className="service-preview">No owned kit selected. Only explicitly selected owned items count towards equipment use.</p>}
            </>}
          </div>
          {hireGear && <div className="hired-equipment"><h3>Hired equipment</h3><p>Record hired items alongside your owned kit. They do not count towards owned equipment use.</p>{hiredEquipment.map((gear, index) => <div className="record-fields" key={index}><label>Category<input value={gear.category} onChange={event => setHiredEquipment(current => current.map((entry, i) => i === index ? {...entry, category: event.target.value} : entry))} /></label><label>Hired item<input value={gear.name} onChange={event => setHiredEquipment(current => current.map((entry, i) => i === index ? {...entry, name: event.target.value} : entry))} /></label><button type="button" className="focus-secondary" onClick={() => setHiredEquipment(current => current.filter((_, i) => i !== index))}>Remove hired item</button></div>)}<button type="button" className="focus-secondary" onClick={() => setHiredEquipment(current => [...current, {name:'', category:''}])}>Add hired item</button></div>}
          <div className="field-grid field-grid-four">
            <label>Exposure suit<select value={exposureSuit} onChange={(event) => setExposureSuit(event.target.value)}><option value="">Not recorded</option><option>Drysuit</option><option>Full Wetsuit</option><option>Shorty</option><option>Two-Piece Wetsuit</option><option>Rash Guard</option></select></label>
            <label>Thickness (mm)<input type="number" min="0" step="0.5" value={suitThickness} onChange={(event) => setSuitThickness(event.target.value)} /></label>
            <label>Undergarment / layers<input value={undergarment} onChange={(event) => setUndergarment(event.target.value)} /></label>
            <label>Total ballast (calculated)<input type="number" value={totalBallast} readOnly /></label>
            <label>Weight belt (kg)<input type="number" min="0" step="0.1" value={weightBelt} onChange={(event) => setWeightBelt(event.target.value)} /></label>
            <label>Integrated weights (kg)<input type="number" min="0" step="0.1" value={integratedWeight} onChange={(event) => setIntegratedWeight(event.target.value)} /></label>
            <label>Weight harness / system (kg)<input type="number" min="0" step="0.1" value={weightHarness} onChange={(event) => setWeightHarness(event.target.value)} /></label>
            <label>Trim pockets (kg)<input type="number" min="0" step="0.1" value={trimPocketWeight} onChange={(event) => setTrimPocketWeight(event.target.value)} /></label>
            <label>Other weight (kg)<input type="number" min="0" step="0.1" value={otherWeight} onChange={(event) => setOtherWeight(event.target.value)} /></label>
            <label>Weighting result<select value={trimAssessment} onChange={(event) => setTrimAssessment(event.target.value as NonNullable<DiveRecord['trimAssessment']>)}><option value="">Not recorded</option><option>Heavy</option><option>Ideal</option><option>Light</option></select></label>
            <label className="record-wide">Buoyancy at stops<textarea value={buoyancyNotes} onChange={(event) => setBuoyancyNotes(event.target.value)} /></label>
            <label>BCD / harness<select value={bcdConfiguration} onChange={(event) => setBcdConfiguration(event.target.value)}><option value="">Not recorded</option><option>Jacket BCD</option><option>Wing and Backplate</option><option>Sidemount Harness</option></select></label>
            <label>Wing lift (lb)<input type="number" min="0" value={wingLift} onChange={(event) => setWingLift(event.target.value)} /></label>
            <label>Backplate<select value={backplate} onChange={(event) => setBackplate(event.target.value)}><option value="">Not recorded</option><option>Steel</option><option>Aluminum</option><option>Carbon Fiber</option><option>None</option></select></label>
            {backplate && backplate !== 'None' && <label>Backplate weight (kg)<input type="number" min="0" step="0.1" value={backplateWeight} onChange={(event) => setBackplateWeight(event.target.value)} /></label>}
            <label className="record-check"><input type="checkbox" checked={singleTankAdapter} onChange={(event) => setSingleTankAdapter(event.target.checked)} />Single tank adapter</label>
          </div>
          <span className="field-subheading">SPECIALIST GEAR</span>
          <div className="specialist-controls"><label>Backup lights<input type="number" min="0" value={backupLights} onChange={(event) => setBackupLights(event.target.value)} /></label></div>
          <div className="choice-grid">
            {['DPV / Scooter', 'Lift bag', 'Reels / Spools', 'Primary light'].map((value) => <label key={value}><input type="checkbox" checked={specialistEquipment.includes(value)} onChange={(event) => toggleValue(setSpecialistEquipment, value, event.target.checked)} />{value}</label>)}
          </div>
          {technicalMode && <div className="choice-grid">{['Primary regulator', 'Backup regulator', 'Stage regulators', 'Primary computer', 'Backup computer', 'Bottom timer', 'SMB', 'Lift bag', 'Spools / reels', 'Cutting tools', 'Backup mask'].map((value) => <label key={value}><input type="checkbox" checked={technicalRedundancies.includes(value)} onChange={(event) => toggleValue(setTechnicalRedundancies, value, event.target.checked)} />{value}</label>)}</div>}
        </details>

        <details className="dive-form-section">
          <summary>Health, notes & diagnostics</summary>
          <div className="field-grid field-grid-four">
            <label>Hydration (1 = poor, 5 = well hydrated)<small>Personal self-assessment; existing scores are unchanged.</small><input type="number" min="1" max="5" value={hydration} onChange={(event) => setHydration(event.target.value)} /></label>
            <label>Sleep (hours)<input type="number" min="0" step="0.5" value={sleepHours} onChange={(event) => setSleepHours(event.target.value)} /></label>
            <label>Thermal comfort<select value={thermalComfort} onChange={(event) => setThermalComfort(event.target.value)}><option value="">Not recorded</option><option>Freezing</option><option>Very cold</option><option>Cold</option><option>Chilly</option><option>Cool</option><option>Comfortable</option><option>Warm</option><option>Hot</option><option>Overheated</option></select></label>
            <label>Post-dive fatigue<select value={fatigue} onChange={(event) => setFatigue(event.target.value)}><option value="">Not recorded</option><option>Normal</option><option>Elevated</option><option>Exhausted</option></select></label>
            <label className="record-wide">Dive narrative<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Marine life, navigation, incidents and observations…" /></label>
            <label className="record-wide">Personal performance reflections<textarea value={personalNotes} onChange={(event) => setPersonalNotes(event.target.value)} /></label>
            <label className="record-wide">Equipment notes / maintenance reminders<textarea value={equipmentNotes} onChange={(event) => setEquipmentNotes(event.target.value)} /></label>
          </div>
          <p className="section-help">Photos, videos and sketches can be added from the dive’s detail view immediately after saving.</p>
        </details>

        <details className="dive-form-section">
          <summary>Aquatic life</summary>
          <div className="field-grid">
            <label className="record-wide">Species and sightings<textarea value={aquaticLife} onChange={(event) => setAquaticLife(event.target.value)} placeholder="One species per line, or separate with commas" /></label>
            <label className="record-wide">Sightings notes<textarea value={aquaticLifeNotes} onChange={(event) => setAquaticLifeNotes(event.target.value)} placeholder="Quantity, behaviour, habitat, photographs or unusual observations…" /></label>
          </div>
        </details>

        <details className="dive-form-section">
          <summary>Team & verification</summary>
          <span className="field-subheading">DIVE TEAM · SELECT ONE OR MORE</span>
          <div className="choice-grid">
            <label><input type="checkbox" checked={diveTeamIds.includes('self')} onChange={(event) => toggleTeamMember('self', event.target.checked)} />Me</label>
            {people.map((person) => <label key={person.entityId}><input type="checkbox" checked={diveTeamIds.includes(person.entityId)} onChange={(event) => toggleTeamMember(person.entityId, event.target.checked)} />{person.name} · {person.highestQualification || person.role}</label>)}
          </div>
          <span className="field-subheading">BUDDIES · SELECT FROM THE DIVE TEAM</span>
          <div className="choice-grid">
            {diveTeamIds.filter((id) => id !== 'self').map((id) => {
              const person = people.find((candidate) => candidate.entityId === id);
              if (!person) return null;
              return <label key={id}><input type="checkbox" checked={buddyIds.includes(id)} onChange={(event) => toggleValue(setBuddyIds, id, event.target.checked)} />{person.name}</label>;
            })}
            {!diveTeamIds.some((id) => id !== 'self') && <p className="section-help">Add people to the dive team first, then mark only the people who were your buddies.</p>}
          </div>
          <div className="field-grid field-grid-four">
            <label>Dive leader<select value={diveLeaderId} onChange={(event) => setDiveLeaderId(event.target.value)}><option value="">Not recorded</option><option value="self">Me</option>{diveTeamIds.filter((id) => id !== 'self').map((id) => { const person = people.find((candidate) => candidate.entityId === id); return person ? <option key={id} value={id}>{person.name}</option> : null; })}</select></label>
            <label>Support crew<input value={supportCrew} onChange={(event) => setSupportCrew(event.target.value)} /></label>
            <label className="record-check"><input type="checkbox" checked={isVerified} onChange={(event) => setIsVerified(event.target.checked)} />Digitally verified</label>
            <label>Professional agency<input value={verifierAgency} onChange={(event) => setVerifierAgency(event.target.value)} /></label>
            <label>Certification number<input value={verifierNumber} onChange={(event) => setVerifierNumber(event.target.value)} /></label>
            <label className="record-wide">Verification link / hash<input value={verificationLink} onChange={(event) => setVerificationLink(event.target.value)} /></label>
          </div>
        </details>
        <footer>
          <button className="focus-secondary" data-dialog-close onClick={close}>Cancel</button>
          <button
            className="focus-primary"
            disabled={!site.trim() || !diveNumber || !timeIn || !timeOut || saving}
            onClick={() => void submit()}
          >
            {saving ? 'Saving…' : 'Save dive'}
          </button>
        </footer>
      </AccessibleDialog>
    </div>
  );
}
