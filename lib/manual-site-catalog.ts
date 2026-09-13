import type { DiveSiteRecord } from './offline/dive-planning';

type ManualSiteSeed = Pick<DiveSiteRecord, 'name' | 'location' | 'latitude' | 'longitude' | 'siteType' | 'difficulty' | 'maxDepthM' | 'description'>;

const rawManualSites: Array<[string, string, number, number, NonNullable<DiveSiteRecord['siteType']>, NonNullable<DiveSiteRecord['difficulty']>, number, string]> = [
  ['Shark & Yolanda Reef','Ras Mohammed NP',27.7252,34.2589,'boat','advanced',40,'Walls and Yolanda cargo'],
  ['Anemone City','Ras Mohammed NP',27.725,34.2517,'boat','intermediate',30,'Dense anemones'],
  ['Jackfish Alley','Ras Mohammed NP',27.7717,34.2567,'boat','intermediate',20,'Swim-throughs'],
  ['Eel Garden (RM)','Ras Mohammed NP',27.765,34.2531,'boat','intermediate',35,'Garden eels'],
  ['Ras Ghozlani','Ras Mohammed NP',27.7921,34.2625,'boat','intermediate',30,'Coral and macro'],
  ['Marsa Bareika','Ras Mohammed NP',27.7831,34.2166,'boat','beginner',20,'Sheltered bay'],
  ['Ras Za’atar','Ras Mohammed NP',27.7643,34.2561,'boat','intermediate',30,'Wall scenery'],
  ['Ras Umm El-Sid (RM)','Ras Mohammed NP',27.847,34.2442,'boat','intermediate',30,'Quiet wall'],
  ['Dunraven','Ras Mohammed NP',27.7031,34.1217,'wreck','intermediate',30,'Historic wreck'],
  ['Jackson Reef','Straits of Tiran',28.0058,34.4711,'boat','advanced',45,'Sharks and exposure'],
  ['Woodhouse Reef','Straits of Tiran',28.0019,34.4661,'boat','intermediate',40,'Long drift'],
  ['Thomas Reef','Straits of Tiran',27.9906,34.4606,'boat','advanced',50,'Canyon and depth'],
  ['Gordon Reef','Straits of Tiran',27.9847,34.4525,'boat','intermediate',30,'Accessible reef'],
  ['Enterprise Passage','Straits of Tiran',27.9643746,34.3611474,'boat','advanced',40,'High-energy drift'],
  ['Grafton Passage','Straits of Tiran',28.0167,34.4833,'boat','advanced',40,'Advanced drift'],
  ['Ras Um Sid (Sharm)','Sharm Local',27.8469,34.3136,'shore','intermediate',30,'Wall and turtles'],
  ['Ras Nasrani','Nabq',27.9633,34.4156,'boat','intermediate',30,'Pelagics'],
  ['White Knight','Nabq',27.9603,34.3981,'boat','intermediate',25,'Gentle reef'],
  ['Ras Ghamila','Nabq',27.9722,34.4281,'boat','beginner',20,'Sheltered reef'],
  ['Ras Bob','Nabq',27.9631,34.4108,'boat','beginner',20,'Shakedown reef'],
  ['Middle Garden','Sharm Local',27.9147,34.3111,'boat','intermediate',25,'Balanced reef'],
  ['Near Garden','Sharm Local',27.9072,34.3081,'boat','intermediate',25,'Gorgonians'],
  ['Far Garden','Sharm Local',27.9181,34.3142,'boat','intermediate',30,'Bigger fish'],
  ['Temple','Sharm Local',27.85,34.31,'shore','beginner',15,'Calm coral'],
  ['Shark’s Bay','Sharm Local',27.9506,34.3669,'shore','beginner',15,'Easy access'],
  ['Na’ama Bay','Sharm Local',27.8533,34.3075,'shore','beginner',12,'Lagoon'],
  ['Tower','Sharm Local',27.8828,34.3194,'shore','beginner',20,'Easy reef'],
  ['Ras Katy','Sharm Local',27.8472,34.3022,'shore','beginner',15,'Hotel reef'],
  ['Fanar','Sharm Local',27.8611,34.3153,'shore','beginner',20,'Easy access'],
  ['Paradise','Sharm Local',27.8533,34.3075,'shore','beginner',20,'Calm reef'],
  ['Amphoras','Sharm Local',27.8658,34.3236,'shore','beginner',20,'Entry reef'],
  ['SS Thistlegorm','Gulf of Suez',27.8131,33.9194,'wreck','advanced',30,'Second World War wreck'],
  ['Blue Hole','Dahab',28.5725,34.535,'shore','advanced',100,'The Arch and deep sinkhole'],
  ['The Bells','Dahab',28.571,34.537,'shore','advanced',40,'Precision entry and wall'],
  ['Canyon','Dahab',28.582,34.515,'shore','intermediate',30,'Geological canyon'],
  ['Islands','Dahab',28.478,34.511,'shore','intermediate',25,'Soft corals'],
  ['Lighthouse','Dahab',28.4956,34.5131,'shore','beginner',20,'Easy social and night dive'],
  ['Eel Garden (Dahab)','Dahab',28.5003,34.5197,'shore','intermediate',25,'Sandy garden eels'],
  ['Mashraba','Dahab',28.495,34.512,'shore','beginner',20,'Calm entry'],
  ['Triple Pools','Dahab',28.435,34.474,'shore','intermediate',30,'Step-down reef'],
  ['Moray Garden','Dahab',28.437,34.476,'shore','intermediate',25,'Macro life'],
  ['Abu Helal','Dahab',28.495,34.512,'shore','advanced',60,'Technical wall'],
  ['Gabr El Bint','Dahab',28.353,34.433,'shore','intermediate',35,'Remote pristine walls'],
];

export const MANUAL_SITE_CATALOG: ManualSiteSeed[] = rawManualSites.map(([name, location, latitude, longitude, siteType, difficulty, maxDepthM, description]) => ({
  name, location, latitude, longitude, siteType, difficulty, maxDepthM, description,
}));

export function manualSiteRecord(seed: ManualSiteSeed): Omit<DiveSiteRecord, 'createdAt' | 'modifiedAt'> {
  return {
    ...seed,
    country: 'Egypt',
    waterType: 'salt',
    access: seed.siteType === 'shore' ? 'Shore' : 'Boat',
    parking: '', amenities: '', entryExit: '', airFill: '', mobileSignal: '', accommodation: '', nearbyFood: '',
    website: '', sourceName: 'Manual', sourceUrl: '', plusCode: '', positionConfidence: 1,
    unconfirmed: false, depthConfidence: 1, bathymetricDepthM: null, diving: '', biodiversity: '', tides: '', history: '',
    showWeather: true, favourite: false, hazards: '', notes: 'Imported from the supplied Data.html dive-site list.',
  };
}
