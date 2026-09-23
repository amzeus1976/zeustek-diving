import { listLocalDiveRecords, saveLocalRecord, deleteLocalRecord, diveOperation } from './dive-store';



interface BaseRecord {

  createdAt: string;

  modifiedAt: string;

}

export interface EquipmentRecord extends BaseRecord {

  name: string;

  category: string;

  manufacturer: string;

  model: string;

  serialNumber: string;

  purchasedAt: string;

  lastServiceAt: string;

  nextServiceAt: string;

  serviceRequired?: boolean;

  serviceIntervalMonths?: number | null;

  serviceIntervalDives?: number | null;

  divesAtLastService?: number | null;

  notes: string;

  retired: boolean;

}

export interface EquipmentSetRecord extends BaseRecord {

  name: string;

  equipmentIds: string[];

  notes: string;

  iconMediaId?: string;

}

export interface DiveSiteRecord extends BaseRecord {
  coordinateAudit?: {version:string;source:string;checkedAt:string;previous:{latitude?:number|null|undefined;longitude?:number|null|undefined}};
  diveTypes?: string[];
  diveMapImage?: import('./dive-images').CardImage | null;
  diveMapUrl?: string;

  name: string;

  alternativeNames?: string;

  location: string;

  postcode?: string; region?: string;

  address?: string;

  telephone?: string;

  email?: string;

  openingTimes?: string;

  latitude?: number | null;

  longitude?: number | null;

  siteType?:

    | 'lake'

    | 'quarry'

    | 'river'

    | 'pool'

    | 'shore'

    | 'boat'

    | 'wreck'

    | 'sea'

    | 'inland'

    | 'other';

  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'technical';

  access: string;

  parking?: string;

  amenities?: string;

  entryExit?: string;

  airFill?: string;

  mobileSignal?: string;

  accommodation?: string;

  nearbyFood?: string;

  website?: string;

  sourceName?: string;

  sourceUrl?: string;

  plusCode?: string;

  positionConfidence?: number | null;

  unconfirmed?: boolean;

  depthConfidence?: number | null;

  bathymetricDepthM?: number | null;

  description?: string;

  diving?: string;

  biodiversity?: string;

  tides?: string;

  history?: string;

  country?: string;

  waterType?: 'fresh' | 'salt' | 'brackish' | '';

  favourite?: boolean;

  showWeather?: boolean;

  maxDepthM: number | null;

  hazards: string;

  notes: string;

}

export interface DiveTripRecord extends BaseRecord {
  technicalMode?: boolean;
  maxDepthM?: number | null;
  bottomTimeMin?: number | null;
  plannedRuntimeMin?: number | null;
  cylinderAssignments?: import('./technical-workspace').PlannedCylinderAssignment[] | undefined;
  decoSchedule?: Array<{depthM:number|null;durationMin:number|null;gas?:string}> | undefined;

  name: string;

  planType?:

    | 'day-dive'

    | 'club-meet'

    | 'course'

    | 'holiday'

    | 'internship'

    | 'other';

  startDate: string;

  endDate: string;

  startAt?: string;

  endAt?: string;

  siteId?: string;

  siteName: string;

  buddy: string;

  personIds?: string[];

  status: 'planned' | 'confirmed' | 'completed';

  notes: string;

}

export type Stored<T> = T & { entityId: string };



async function request<T>(path: string, init?: RequestInit): Promise<T> {

  const response = await fetch(path, init);

  if (!response.ok)

    throw new Error(

      response.status === 401

        ? 'Sign in again to access your dive data.'

        : 'Cloud dive data is unavailable.',

    );

  return response.json() as Promise<T>;

}

export async function listRecords<T>(kind: string): Promise<Array<Stored<T>>> {

  return listLocalDiveRecords<T>(kind);

}

export async function saveRecord<T>(kind: string, input: T & { entityId?: string }) {
  return diveOperation(`save:${kind}:${JSON.stringify(input)}`, 'Saving locally…', () => saveLocalRecord(kind, input));
}
export async function removeRecord(entityId: string) {
  return diveOperation(`delete:${entityId}`, 'Deleting locally…', () => deleteLocalRecord(entityId));
}

export const listEquipment = () => listRecords<EquipmentRecord>('equipment');

export const saveEquipment = (

  input: Omit<EquipmentRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('equipment', input);

export const deleteEquipment = removeRecord;

export const listEquipmentSets = () =>

  listRecords<EquipmentSetRecord>('equipment-set');

export const saveEquipmentSet = (

  input: Omit<EquipmentSetRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('equipment-set', input);

export const deleteEquipmentSet = removeRecord;

export const listDiveSites = () => listRecords<DiveSiteRecord>('site');

export const saveDiveSite = (

  input: Omit<DiveSiteRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('site', input);

export const deleteDiveSite = removeRecord;



export interface DashboardSettingsRecord extends BaseRecord {
  professionalGuides?:Record<string,import('../professional-guide').ProfessionalGuideProgress>;
  weatherConditions?:import('../weather/conditions-settings').WeatherConditionsSettings;
  analysisWorkbench?:{version:1;cards:import('../insights/analysis-card-registry').AnalysisCardConfig[]};

  selectedAwards: string[];

  maxAwards: number;

  diveNumberStart?: number;

  customGoogleMapEmbedUrl?: string;

  newsletterEmail?: string;

  homeWeatherSiteIds?: string[];

}

export const listDashboardSettings = () =>

  listRecords<DashboardSettingsRecord>('dashboard-settings');

export const saveDashboardSettings = (

  input: Omit<DashboardSettingsRecord, keyof BaseRecord> & {

    entityId?: string;

  },

) => saveRecord('dashboard-settings', input);

export const listDiveTrips = () => listRecords<DiveTripRecord>('trip');

export const saveDiveTrip = (

  input: Omit<DiveTripRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('trip', input);

export const deleteDiveTrip = removeRecord;



export interface CertificationRecord extends BaseRecord {
  /** Unassigned legacy certificates belong to My Profile. instructorId is not ownership. */
  personId?: string;
  /** Explicit recorded evidence only; never inferred from a course title. */
  certifiedDepthM?: number | null;
  qualificationRank?: number | null;
  cardFront?: import('./dive-images').CardImage | null;
  cardBack?: import('./dive-images').CardImage | null;

  agency: string;

  certification: string;

  level: string;

  certificationNumber: string;

  issuedAt: string;

  expiresAt: string;

  instructor: string;

  instructorId?: string;

  notes: string;

  imageKey: string;

  imageName: string;

  certificateUrl?: string;

  courseType?: 'core' | 'specialty' | 'technical' | 'professional' | 'first-aid' | 'experience' | 'other';

  awardPriority?: number | null;

}

export const listCertifications = () =>

  listRecords<CertificationRecord>('certification');

export async function saveCertification(

  input: Omit<

    CertificationRecord,

    keyof BaseRecord | 'imageKey' | 'imageName'

  > & {

    entityId?: string;

    imageKey?: string;

    imageName?: string;

    image?: File | null;

  },

) {

  let imageKey = input.imageKey ?? '';

  let imageName = input.imageName ?? '';

  if (input.image) {

    const form = new FormData();

    form.append('file', input.image);

    const uploaded = await request<{ imageKey: string; imageName: string }>(

      '/api/cert-image',

      { method: 'POST', body: form },

    );

    imageKey = uploaded.imageKey;

    imageName = uploaded.imageName;

  }

  const { image: _, ...rest } = input;

  return saveRecord('certification', { ...rest, imageKey, imageName });

}

export const deleteCertification = removeRecord;



export interface TrainingProgressRecord extends BaseRecord {

  agency: 'PADI' | 'TDI';

  courseId: string;

  courseTitle: string;

  status: 'planned' | 'in-progress' | 'completed' | 'ignored';

  metRequirementIds?: string[];

  planOrder?: number;

}

export const listTrainingProgress = () =>

  listRecords<TrainingProgressRecord>('training-progress');

export const saveTrainingProgress = (

  input: Omit<TrainingProgressRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('training-progress', input);

export const deleteTrainingProgress = removeRecord;



export interface NewsArticleRecord extends BaseRecord {
  sources?: import('../record-identity').NewsSource[];

  source: string;

  title: string;

  link: string;

  summary: string;

  publishedAt: string;

  state: 'saved' | 'archived' | 'deleted' | 'rated';

  reaction?: 'shaka' | 'okay' | 'not-interested';

  reactionAt?: string;

}

export const listNewsArticles = () => listRecords<NewsArticleRecord>('news-article');

export const saveNewsArticle = (

  input: Omit<NewsArticleRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('news-article', input);

export const deleteNewsArticle = removeRecord;



export interface NewsPreferencesRecord extends BaseRecord {

  interestedKeywords: string[];

  mutedKeywords: string[];

  mutedMode: 'hide' | 'deprioritize';

}

export const listNewsPreferences = () => listRecords<NewsPreferencesRecord>('news-preferences');

export const saveNewsPreferences = (

  input: Omit<NewsPreferencesRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('news-preferences', input);



export interface GmailNewsRecord extends BaseRecord {

  gmailMessageId: string;

  threadId: string;

  source: string;

  title: string;

  link: string;

  summary: string;

  publishedAt: string;

  from: string;

}

export const listGmailNews = () => listRecords<GmailNewsRecord>('gmail-news');



export interface BucketListRecord extends BaseRecord {
  siteId?: string;

  name: string;

  kind: 'dive-location' | 'liveaboard' | 'dive-safari';

  country: string;

  url: string;

  targetDate: string;

  approximateCost: string;

  description: string;

  why: string;

  status: 'dreaming' | 'researching' | 'planned' | 'completed';

}

export interface GearWishlistRecord extends BaseRecord {

  itemType: string;

  model: string;

  brand: string;

  links: Array<{ url: string; description: string }>;

  approximateCost: string;

  originalApproximateCost?: string;

  exchangeRateDate?: string;

  description: string;

  why: string;

  status: 'researching' | 'shortlisted' | 'purchased';

  imageUrls?: string[];

  coverImage?: string;

  includeInSavings?: boolean;

  priceChecks?: Array<{ url: string; description: string; price?: number; currency?: string; gbp?: number; available: boolean; error?: string; matchVerified?: boolean; productTitle?: string }>;

  pricesCheckedAt?: string;

  wishlistGroupId?: string;

}

export interface GearWishlistGroupRecord extends BaseRecord { name: string; parentId: string; }

export interface PriceStoreRecord extends BaseRecord { name: string; searchUrl: string; enabled: boolean; }

export interface PriceStoreSettingsRecord extends BaseRecord { seeded: boolean; }

export interface NewsSourceRecord extends BaseRecord {

  name: string;

  url: string;

  type: 'rss' | 'newsletter' | 'site-review';

  enabled: boolean;

  description: string;

}

export interface DiveMediaRecord extends BaseRecord {

  title: string;
  thumbnailUrl?: string;
  priority?: 'low' | 'normal' | 'high';
  knowledgeGrowth?: number | null;
  interestScore?: number | null;
  sources?: Array<{source: string; link: string}>;

  format: 'book' | 'video' | 'podcast' | 'article' | 'documentary' | 'course' | 'other';

  creator: string;

  url: string;

  status: 'planned' | 'in-progress' | 'consumed';

  rating: number | null;

  topics: string[];

  notes: string;

  recommendedFor: string;

}

export const listBucketList = () => listRecords<BucketListRecord>('bucket-list');

export const saveBucketList = (input: Omit<BucketListRecord, keyof BaseRecord> & { entityId?: string }) => saveRecord('bucket-list', input);

export const deleteBucketList = removeRecord;

export const listGearWishlist = () => listRecords<GearWishlistRecord>('gear-wishlist');

export const saveGearWishlist = (input: Omit<GearWishlistRecord, keyof BaseRecord> & { entityId?: string }) => saveRecord('gear-wishlist', input);

export const deleteGearWishlist = removeRecord;

export const listGearWishlistGroups = () => listRecords<GearWishlistGroupRecord>('gear-wishlist-group');

export const saveGearWishlistGroup = (input: Omit<GearWishlistGroupRecord, keyof BaseRecord> & { entityId?: string }) => saveRecord('gear-wishlist-group', input);

export const deleteGearWishlistGroup = removeRecord;

export const listPriceStores = () => listRecords<PriceStoreRecord>('price-store');

export const savePriceStore = (input: Omit<PriceStoreRecord, keyof BaseRecord> & { entityId?: string }) => saveRecord('price-store', input);

export const deletePriceStore = removeRecord;

export const listPriceStoreSettings = () => listRecords<PriceStoreSettingsRecord>('price-store-settings');

export const savePriceStoreSettings = (input: Omit<PriceStoreSettingsRecord, keyof BaseRecord> & { entityId?: string }) => saveRecord('price-store-settings', input);

export const listNewsSources = () => listRecords<NewsSourceRecord>('news-source');

export const saveNewsSource = (input: Omit<NewsSourceRecord, keyof BaseRecord> & { entityId?: string }) => saveRecord('news-source', input);

export const deleteNewsSource = removeRecord;

export const listDiveMedia = () => listRecords<DiveMediaRecord>('dive-media');

export const saveDiveMedia = (input: Omit<DiveMediaRecord, keyof BaseRecord> & { entityId?: string }) => saveRecord('dive-media', input);

export const deleteDiveMedia = removeRecord;



export type OperatorType = 'dive-centre'|'dive-shop'|'resort'|'liveaboard'|'charter-boat'|'club'|'independent-instructor'|'gas-fill-station'|'other';
export type OperatorService = 'training'|'equipmentRental'|'equipmentService'|'cylinderTesting'|'airFills'|'nitroxFills'|'trimixFills'|'oxygenFills'|'boatDiving'|'shoreDiving'|'accommodation';
export interface OperatorRecord extends BaseRecord {
  name:string;location:string;website:string;notes:string;
  tradingName?:string;operatorType?:OperatorType;phone?:string;email?:string;emergencyPhone?:string;bookingUrl?:string;
  streetAddress?:string;town?:string;region?:string;country?:string;postcode?:string;latitude?:number|null;longitude?:number|null;
  agencies?:string[];services?:Partial<Record<OperatorService,boolean>>;favourite?:boolean;active?:boolean;
  profileImage?:import('./dive-images').CardImage|null;
}
export const listOperators = () => listRecords<OperatorRecord>('operator');
export const saveOperator = (input: Omit<OperatorRecord, keyof BaseRecord> & {entityId?: string}) => saveRecord('operator', input);
export const deleteOperator = removeRecord;

export interface PersonRecord extends BaseRecord {

  name: string;

  role: 'buddy' | 'instructor' | 'both';

  agency: string;

  membershipId?: string;

  highestQualification: string;

  membershipNumber: string;

  email: string;

  phone: string;

  emergencyContact: string;

  profileUrl?: string;
  operatorId?: string;
  profileImageId?: string;
  profileImage?: import('./dive-images').CardImage | null;

  /** P01 additive profile fields. Legacy name/role fields remain canonical-compatible. */
  forename?: string;
  surname?: string;
  displayName?: string;
  roles?: {
    ownerProfile?: boolean;
    buddy?: boolean;
    instructor?: boolean;
    diveOperator?: boolean;
    diveCentre?: boolean;
    boatCharter?: boolean;
    guide?: boolean;
    emergencyContact?: boolean;
    other?: boolean;
  };
  preferredTopBuddyPersonId?: string;
  highestKnownQualification?: string;
  highestRecreationalCertification?: string;
  highestTechnicalCertification?: string;
  highestProfessionalCertification?: string;
  maxAllowedDepthM?: number | null;
  maxAllowedDepthSource?: 'auto' | 'owner-entered' | 'certification-derived' | 'unknown';
  certificationFlags?: {
    deep?: boolean; wreck?: boolean; wreckPenetration?: boolean; drysuit?: boolean;
    nitrox?: boolean; trimix?: boolean; cavern?: boolean; cave?: boolean;
    tec40?: boolean; tec45?: boolean; tec50?: boolean; tec65Plus?: boolean;
    rescue?: boolean; divemaster?: boolean; instructor?: boolean;
  };
  certificationEvidenceNotes?: string;
  totalLinkedDives?: number | null;
  maxDepthM?: number | null;
  averageSac?: number | null;
  averageRmv?: number | null;
  boatDives?: number | null;
  shoreDives?: number | null;
  nightDives?: number | null;
  wreckDives?: number | null;
  technicalDives?: number | null;
  lastDivedTogether?: string;
  topBuddyRank?: number | null;
  topBuddyCount?: number | null;
  derivedStatsUpdatedAt?: string;
  derivedStatsSource?: string;
  profileValueSources?: Record<string, 'auto-logbook' | 'auto-certifications' | 'owner-entered' | 'certification-derived' | 'unknown'>;
  manualOverrideFields?: string[];
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  address?: string;
  postcode?: string;
  location?: string;
  contactVisibility?: 'private' | 'household' | 'planning';
  currentDiveOperatorId?: string;
  instructorAgency?: string;
  instructorNumber?: string;
  instructorPhone?: string;
  instructorEmail?: string;
  instructorUrl?: string;
  instructorSpecialties?: string[];
  instructorActive?: boolean;
  instructorNotes?: string;
  operatorName?: string;
  operatorType?: 'dive-centre' | 'liveaboard' | 'charter-boat' | 'club' | 'independent-instructor' | 'resort' | 'other';
  website?: string;
  operatorPhone?: string;
  operatorEmail?: string;
  operatorAddress?: string;
  operatorPostcode?: string;
  operatorLocation?: string;
  bookingUrl?: string;
  operatorEmergencyContact?: string;
  linkedTripIds?: string[];
  linkedDivePlanIds?: string[];
  linkedDiveIds?: string[];
  operatorNotes?: string;

  notes: string;

}

export interface AlbumRecord extends BaseRecord {
  siteId?: string;

  title: string;

  date: string;

  siteName: string;

  planId: string;

  notes: string;

}

export interface CatalogOptionRecord extends BaseRecord {

  group:

    | 'category'

    | 'manufacturer'

    | 'agency'

    | 'qualification'

    | 'equipment-icon'

    | 'agency-logo';

  value: string;

  iconMediaId?: string;

  iconUrl?: string;

}

export const listPeople = () => listRecords<PersonRecord>('person');

export const savePerson = (

  input: Omit<PersonRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('person', input);

export const deletePerson = removeRecord;

export const listAlbums = () => listRecords<AlbumRecord>('album');

export const saveAlbum = (

  input: Omit<AlbumRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('album', input);

export const deleteAlbum = removeRecord;

export const listCatalogOptions = () =>

  listRecords<CatalogOptionRecord>('catalog-option');

export const saveCatalogOption = (

  input: Omit<CatalogOptionRecord, keyof BaseRecord> & { entityId?: string },

) => saveRecord('catalog-option', input);

export const deleteCatalogOption = removeRecord;



export const DEFAULT_GEAR_CATEGORIES = [

  'BCD / wing',

  'Boots',

  'Camera / housing',

  'Computer',

  'Cylinder',

  'Drysuit',

  'Fins',

  'First stage regulator',

  'Gloves / hood',

  'Knife / cutting tool',

  'Mask',

  'Rebreather',

  'Second stage regulator',

  'SMB / reel',

  'SPG',

  'Torch',

  'Weights',

  'Wetsuit',

  'Other',

];

export const DEFAULT_GEAR_CATEGORY_ICONS: Record<string, string> = {

  'BCD / wing': '/equipment-icons/bcd-wing.png',

  Boots: '/equipment-icons/boots.png',

  'Camera / housing': '/equipment-icons/blank.png',

  Computer: '/equipment-icons/computer.png',

  Cylinder: '/equipment-icons/cylinder.png',

  Drysuit: '/equipment-icons/drysuit.png',

  Fins: '/equipment-icons/fins.png',

  'First stage regulator': '/equipment-icons/first-stage-regulator.png',

  'Gloves / hood': '/equipment-icons/gloves-hood.png',

  'Knife / cutting tool': '/equipment-icons/dive-knife.png',

  Mask: '/equipment-icons/mask.png',

  Rebreather: '/equipment-icons/rebreather.png',

  'Second stage regulator': '/equipment-icons/second-stage-regulator.png',

  'SMB / reel': '/equipment-icons/dsmb.png',

  SPG: '/equipment-icons/spg.png',

  Torch: '/equipment-icons/torch.png',

  Weights: '/equipment-icons/weights.png',

  Wetsuit: '/equipment-icons/wetsuit.png',

  Other: '/brand/icons/zeustek-single/06_water_entry_and_dive_types/other.png',

};

export function equipmentIconSource(

  category: string,

  options: Array<Pick<CatalogOptionRecord, 'group' | 'value' | 'iconMediaId'>>,

) {

  const custom = options.find(

    (option) =>

      option.group === 'equipment-icon' &&

      option.value.toLowerCase() === category.toLowerCase() &&

      option.iconMediaId,

  );

  return custom?.iconMediaId

    ? `/api/media?id=${encodeURIComponent(custom.iconMediaId)}`

    : DEFAULT_GEAR_CATEGORY_ICONS[category] ?? DEFAULT_GEAR_CATEGORY_ICONS.Other!;

}

export function agencyLogoSource(

  agency: string,

  options: Array<

    Pick<CatalogOptionRecord, 'group' | 'value' | 'iconMediaId' | 'iconUrl'>

  >,

) {

  const custom = options.find(

    (option) =>

      option.group === 'agency-logo' &&

      option.value.toLowerCase() === agency.toLowerCase(),

  );

  if (custom?.iconMediaId)

    return `/api/media?id=${encodeURIComponent(custom.iconMediaId)}`;

  if (custom?.iconUrl && /^https?:\/\//i.test(custom.iconUrl))

    return `/api/image-proxy?url=${encodeURIComponent(custom.iconUrl)}`;

  return '';

}

export const DEFAULT_GEAR_MANUFACTURERS = [

  'Apeks',

  'Aqualung',

  'Atomic Aquatics',

  'Bare',

  'Beuchat',

  'Cressi',

  'Faber',

  'Fourth Element',

  'Garmin',

  'Halcyon',

  'Hollis',

  'Luxfer',

  'Mares',

  'Oceanic',

  'OMS',

  'Poseidon',

  'Scubapro',

  'Shearwater',

  'Suunto',

  'TUSA',

  'Waterproof',

  'XDEEP',

  'Other',

];

export const DEFAULT_TRAINING_AGENCIES = [

  'ANDI',

  'BSAC',

  'CMAS',

  'DAN',

  'GUE',

  'IANTD',

  'NAUI',

  'PADI',

  'RAID',

  'SAA',

  'SDI',

  'SSI',

  'TDI',

  'UTD',

  'Other',

];

export const DEFAULT_DIVE_QUALIFICATIONS = [

  'Try Dive / Discover Scuba',

  'Open Water Diver',

  'Advanced Open Water Diver',

  'Rescue Diver',

  'Master Scuba Diver',

  'Divemaster',

  'Assistant Instructor',

  'Open Water Instructor',

  'Specialty Instructor',

  'Master Scuba Diver Trainer',

  'Staff Instructor',

  'Master Instructor',

  'Course Director',

  'Ocean Diver',

  'Sports Diver',

  'Dive Leader',

  'Advanced Diver',

  'First Class Diver',

  'Technical Diver',

  'Trimix Diver',

  'CCR Diver',

  'Freediver',

  'Other',

];
