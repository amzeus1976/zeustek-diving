export type CourseCategory = 'experience' | 'core' | 'specialty' | 'first-aid' | 'technical' | 'professional';
export type TrainingRequirement =
  | { id: string; label: string; type: 'certification'; courses: string[]; targetCourseId?: string }
  | { id: string; label: string; type: 'recent-certification'; courses: string[]; withinMonths: number; targetCourseId?: string }
  | { id: string; label: string; type: 'dives'; count: number }
  | { id: string; label: string; type: 'specialties'; count: number; agency: string }
  | { id: string; label: string; type: 'manual' };
export interface TrainingCourse { id: string; agency: 'PADI' | 'TDI'; title: string; aliases?: string[]; stage: string; category: CourseCategory; isSpecialty?: boolean; countsTowardMasterScubaDiver?: boolean; summary: string; requirements: TrainingRequirement[]; sourceUrl: string }
export interface CourseProgressLike { courseId: string; status: 'planned' | 'in-progress' | 'completed' | 'ignored'; metRequirementIds?: string[] }
export interface CertificationLike { agency?: string; certification: string; issuedAt?: string; courseType?: string }

const PADI = 'https://www.padi.com/education/continue-learning';
const PADI_SPECIALTIES = 'https://www.padi.com/education/specialty-courses';
const PADI_TEC = 'https://www.padi.com/education/technical-diving';
const TDI = 'https://www.tdisdi.com/tdi/get-certified/';
const ow = (): TrainingRequirement => ({ id: 'ow', label: 'Open Water Diver or qualifying certification', type: 'certification', courses: ['Open Water Diver'], targetCourseId: 'padi-open-water' });
const aow = (): TrainingRequirement => ({ id: 'aow', label: 'Adventure Diver or Advanced Open Water Diver', type: 'certification', courses: ['Adventure Diver', 'Advanced Open Water Diver'], targetCourseId: 'padi-aow' });
const manual = (id = 'self-medical', label = 'Diver Medical Participant Questionnaire completed; physician approval obtained if the answers require it'): TrainingRequirement => ({ id, label, type: 'manual' });
const divemasterMedical = (): TrainingRequirement => manual('divemaster-medical', 'Physician-signed medical clearance for Divemaster training is current (normally within the previous 12 months)');
const technicalMedical = (): TrainingRequirement => manual('technical-medical', 'Physician-signed medical clearance for technical-diving training is current (within the previous 12 months)');
const cert = (id: string, label: string, courses: string[], targetCourseId?: string): TrainingRequirement => ({ id, label, type: 'certification', courses, ...(targetCourseId ? { targetCourseId } : {}) });
const dives = (count: number): TrainingRequirement => ({ id: `dives-${count}`, label: `${count} logged dives`, type: 'dives', count });
const padi = (id: string, title: string, stage: string, category: CourseCategory, summary: string, requirements: TrainingRequirement[] = [], sourceUrl = PADI, extra: Partial<TrainingCourse> = {}): TrainingCourse => {
  let courseRequirements = stage.startsWith('Tec')
    ? requirements.map((requirement) => requirement.type === 'manual' && requirement.id === 'self-medical' ? technicalMedical() : requirement)
    : requirements;
  if (!stage.startsWith('Tec') && stage !== 'Recognition' && ['experience', 'core', 'specialty'].includes(category) && !courseRequirements.some((requirement) => requirement.type === 'manual')) {
    courseRequirements = [...courseRequirements, manual()];
  }
  return { id: `padi-${id}`, agency: 'PADI', title, stage, category, summary, requirements: courseRequirements, sourceUrl, ...extra };
};
const specialty = (id: string, title: string, req: 'ow' | 'aow' | 'manual' = 'ow', sourceUrl = PADI_SPECIALTIES, extra: Partial<TrainingCourse> = {}) => padi(id, title, 'Specialties', 'specialty', `${title} knowledge and practical training.`, req === 'ow' ? [ow()] : req === 'aow' ? [aow()] : [manual()], sourceUrl, { isSpecialty: true, countsTowardMasterScubaDiver: true, ...extra });
const tdi = (id: string, title: string, stage: string, requirements: TrainingRequirement[] = [], sourceUrl = TDI): TrainingCourse => ({ id: `tdi-${id}`, agency: 'TDI', title, stage, category: stage === 'Professional' ? 'professional' : 'technical', summary: `${title} training within current TDI standards.`, requirements, sourceUrl });

const padiSpecialties: Array<[string, string, ('ow' | 'aow' | 'manual')?, string?, Partial<TrainingCourse>?]> = [
  ['adaptive-support','Adaptive Support Diver'], ['altitude','Altitude Diver'], ['aware-shark','AWARE Shark Conservation Diver','ow',PADI_SPECIALTIES,{ aliases: ['Shark Conservation Diver'] }], ['aware-sea-turtle','AWARE Sea Turtle Awareness'], ['boat','Boat Diver'], ['cavern','Cavern Diver','aow'],
  ['coral-conservation','AWARE Coral Reef Conservation','manual',PADI_SPECIALTIES,{ aliases: ['Coral Reef Conservation'] }], ['deep','Deep Diver','aow','https://www.padi.com/courses/deep-diver'], ['digital-photographer','Digital Underwater Photographer'],
  ['dive-against-debris','Dive Against Debris Specialty'], ['dpv','Diver Propulsion Vehicle Diver'], ['drift','Drift Diver'], ['dry-suit','Dry Suit Diver','ow','https://www.padi.com/courses/dry-suit-diver'],
  ['emergency-oxygen','Emergency Oxygen Provider','manual'], ['enriched-air','Enriched Air (Nitrox) Diver','ow','https://www.padi.com/courses/enriched-air-nitrox'], ['equipment','Equipment Specialist','manual'],
  ['fish-identification','AWARE Fish Identification','ow',PADI_SPECIALTIES,{ aliases: ['Fish Identification Diver'] }], ['full-face-mask','Full Face Mask Diver'], ['gas-blender','Gas Blender','manual'], ['ice','Ice Diver','aow'], ['multilevel','Multilevel Diver','ow','https://store.padi.com/en-us/ns/courses/multilevel-diver/p/multilevel-diver/'], ['night','Night Diver'], ['peak-buoyancy','Peak Performance Buoyancy'],
  ['padi-aware','PADI AWARE Specialist','manual','https://store.padi.com/en-gb/courses/padi-aware-specialist/p/70552-1B2C/st/',{ aliases: ['PADI AWARE Specialty','Project AWARE','Project AWARE Specialty','Project AWARE Specialist'] }],
  ['public-safety','Public Safety Diver','aow'], ['search-recovery','Search and Recovery Diver','aow'], ['self-reliant','Self-Reliant Diver','aow'],
  ['sidemount','Sidemount Diver','ow',PADI_SPECIALTIES,{ aliases: ['Sidemount Rec Diver'] }], ['dsmb','DSMB (Surface Marker Buoy) Diver'], ['twinset','Twinset Diver','aow'], ['underwater-naturalist','Underwater Naturalist'], ['navigator','Underwater Navigator','ow','https://www.padi.com/courses/underwater-navigator'],
  ['photographer','Underwater Photographer'], ['videographer','Underwater Videographer'], ['wreck','Wreck Diver','aow','https://www.padi.com/courses/wreck-diver'],
  ['distinctive','Distinctive Specialty Diver','manual','https://www.padi.com/courses/distinctive-specialty-diver'],
];

export const TRAINING_COURSES: TrainingCourse[] = [
  padi('discover','Discover Scuba Diving','Start','experience','A supervised first scuba experience.',[manual()]),
  padi('scuba-diver','Scuba Diver','Start','core','A limited certification leading toward Open Water Diver.',[manual()]),
  padi('open-water','Open Water Diver','Start','core','Entry-level autonomous diver certification.',[manual()],'https://www.padi.com/courses/open-water-diver'),
  padi('adventure','Adventure Diver','Continue','core','Three Adventure Dives toward Advanced Open Water.',[ow()]),
  padi('aow','Advanced Open Water Diver','Continue','core','Five Adventure Dives including Deep and Underwater Navigation.',[ow()],'https://www.padi.com/courses/advanced-open-water',{ aliases: ['Junior Advanced Open Water Diver'] }),
  padi('efr-children','Emergency First Response – Care for Children','Safety','first-aid','CPR and first aid for infants and children.',[manual()],'https://www.emergencyfirstresponse.com/courses/care-for-children/'),
  padi('efr','EFR Primary & Secondary Care','Safety','first-aid','CPR and first-aid training.',[],'https://www.padi.com/education/emergency-first-response',{ aliases: ['Emergency First Response','Primary Care (CPR) & Secondary Care'] }),
  padi('rescue','Rescue Diver','Continue','core','Problem prevention and diving-emergency management.',[aow(),{ id:'recent-efr',label:'CPR and first aid within the previous 24 months',type:'recent-certification',courses:['EFR Primary & Secondary Care','Emergency First Response','CPR','First Aid'],withinMonths:24,targetCourseId:'padi-efr' }],'https://www.padi.com/courses/rescue-diver'),
  ...padiSpecialties.map(([id,title,req = 'ow',url,extra]) => specialty(id,title,req,url,extra)),
  padi('advanced-public-safety','Advanced Public Safety Diver','Specialties','specialty','Advanced public-safety diving operations and evidence recovery.',[cert('public-safety','Public Safety Diver',['Public Safety Diver'],'padi-public-safety')],'https://store.padi.com/en-us/ns/courses/advanced-public-safety-diver/p/advanced-public-safety-diver/',{ isSpecialty: true, countsTowardMasterScubaDiver: true }),
  padi('adaptive-techniques','Adaptive Techniques','Specialties','specialty','A pro-level specialty for adapting diver training and supervision.',[cert('divemaster','PADI Divemaster or PADI Master Freediver',['Divemaster','Master Freediver'],'padi-divemaster'),{ id:'recent-efr',label:'EFR Primary and Secondary Care within the previous 24 months',type:'recent-certification',courses:['EFR Primary & Secondary Care','Emergency First Response'],withinMonths:24,targetCourseId:'padi-efr' }],'https://store.padi.com/en-us/ns/courses/adaptive-techniques/p/adaptive-techniques/',{ isSpecialty: true, countsTowardMasterScubaDiver: false }),
  padi('reactivate','ReActivate','Refresh','core','A scuba knowledge and skills refresher for certified divers.',[ow()],'https://www.padi.com/courses/reactivate',{ countsTowardMasterScubaDiver: false }),
  padi('msd','Master Scuba Diver','Recognition','core','Recognition based on Rescue, five qualifying PADI specialties and 50 dives.',[cert('rescue','Rescue Diver',['Rescue Diver'],'padi-rescue'),{ id:'specialties',label:'Five distinct PADI Specialty Diver certifications (EFR does not count)',type:'specialties',count:5,agency:'PADI' },dives(50)],'https://www.padi.com/courses/master-scuba-diver'),
  padi('divemaster','Divemaster','Professional','professional','First PADI professional rating.',[aow(),cert('rescue','Rescue Diver',['Rescue Diver'],'padi-rescue'),dives(40),divemasterMedical()],'https://www.padi.com/courses/divemaster'),
  padi('assistant-instructor','Assistant Instructor','Professional','professional','First part of the Instructor Development Course.',[cert('dm','Divemaster',['Divemaster'],'padi-divemaster'),manual()]),
  padi('owsi','Open Water Scuba Instructor','Professional','professional','PADI instructor rating.',[cert('dm','Divemaster',['Divemaster'],'padi-divemaster'),manual()],'https://www.padi.com/courses/open-water-scuba-instructor'),
  padi('specialty-instructor','Specialty Instructor','Professional','professional','Instructor rating for a PADI specialty.',[cert('owsi','Open Water Scuba Instructor',['Open Water Scuba Instructor'],'padi-owsi'),manual()]),
  padi('msdt','Master Scuba Diver Trainer','Professional','professional','Experienced instructor recognition.',[cert('owsi','Open Water Scuba Instructor',['Open Water Scuba Instructor'],'padi-owsi'),manual()]),
  padi('idc-staff','IDC Staff Instructor','Professional','professional','Instructor-development staff rating.',[cert('msdt','Master Scuba Diver Trainer',['Master Scuba Diver Trainer'],'padi-msdt'),manual()]),
  padi('master-instructor','Master Instructor','Professional','professional','Senior PADI instructor rating.',[cert('staff','IDC Staff Instructor',['IDC Staff Instructor'],'padi-idc-staff'),manual()]),
  padi('course-director','Course Director','Professional','professional','PADI instructor trainer rating.',[cert('mi','Master Instructor',['Master Instructor'],'padi-master-instructor'),manual()]),
  padi('discover-tec','Discover Tec','Tec · Start','experience','A confined-water technical-diving introduction.',[aow(),manual()],PADI_TEC),
  padi('discover-rebreather','Discover Rebreather','Tec · Rebreather','experience','A supervised introduction to rebreather diving.',[ow(),manual()],PADI_TEC),
  padi('tec-basics','Tec Basics','Tec · Open circuit','technical','Foundational technical-diving skills.',[aow(),manual()],PADI_TEC),
  padi('tec-sidemount','Tec Sidemount Diver','Tec · Open circuit','technical','Technical sidemount configuration and procedures.',[aow(),manual()],PADI_TEC),
  padi('tec-40','Tec 40 Diver','Tec · Open circuit','technical','Limited decompression diving to 40 metres.',[cert('aow','Advanced Open Water Diver',['Advanced Open Water Diver'],'padi-aow'),cert('eanx','Enriched Air Diver',['Enriched Air (Nitrox) Diver'],'padi-enriched-air'),cert('deep','Deep Diver or qualifying experience',['Deep Diver'],'padi-deep'),dives(30),manual()],'https://store.padi.com/en-gb/tec-40-and-tec-40-trimix/p/tec-40-and-tec-40-trimix/'),
  padi('tec-40-trimix','Tec 40 Trimix Diver','Tec · Trimix','technical','Tec 40 training using trimix within the course depth limit.',[cert('aow','Advanced Open Water Diver',['Advanced Open Water Diver'],'padi-aow'),cert('eanx','Enriched Air Diver',['Enriched Air (Nitrox) Diver'],'padi-enriched-air'),cert('deep','Deep Diver or qualifying experience',['Deep Diver'],'padi-deep'),dives(30),manual()],'https://store.padi.com/en-gb/tec-40-and-tec-40-trimix/p/tec-40-and-tec-40-trimix/'),
  padi('tec-45','Tec 45 Diver','Tec · Open circuit','technical','Staged decompression diving to 45 metres.',[cert('tec40','Tec 40 Diver',['Tec 40 Diver'],'padi-tec-40'),cert('rescue','Rescue Diver',['Rescue Diver'],'padi-rescue'),dives(50),manual()],'https://store.padi.com/en-us/ns/courses/tec-45-and-tec-45-trimix/p/tec-45-and-tec-45-trimix/'),
  padi('tec-45-trimix','Tec 45 Trimix Diver','Tec · Trimix','technical','Staged decompression diving to 45 metres using trimix.',[cert('tec40','Tec 40 or Tec 40 Trimix Diver',['Tec 40 Diver','Tec 40 Trimix Diver'],'padi-tec-40-trimix'),cert('rescue','Rescue Diver',['Rescue Diver'],'padi-rescue'),dives(50),manual()],'https://store.padi.com/en-us/ns/courses/tec-45-and-tec-45-trimix/p/tec-45-and-tec-45-trimix/'),
  padi('tec-50','Tec 50 Diver','Tec · Open circuit','technical','Extended-range decompression diving to 50 metres.',[cert('tec45','Tec 45 Diver',['Tec 45 Diver'],'padi-tec-45'),dives(100),manual()],'https://store.padi.com/en-us/tec-50-and-tec-50-trimix/p/tec-50-and-tec-50-trimix/'),
  padi('tec-50-trimix','Tec 50 Trimix Diver','Tec · Trimix','technical','Extended-range decompression diving to 50 metres using trimix.',[cert('tec45','Tec 45 or Tec 45 Trimix Diver',['Tec 45 Diver','Tec 45 Trimix Diver'],'padi-tec-45-trimix'),dives(100),manual()],'https://store.padi.com/en-us/tec-50-and-tec-50-trimix/p/tec-50-and-tec-50-trimix/'),
  padi('tec-trimix-65','Tec Trimix 65 Diver','Tec · Trimix','technical','Normoxic trimix diving to 65 metres.',[cert('tec50','Tec 50 or Tec 50 Trimix Diver',['Tec 50 Diver','Tec 50 Trimix Diver'],'padi-tec-50-trimix'),manual()],PADI_TEC),
  padi('tec-trimix','Tec Trimix Diver','Tec · Trimix','technical','Full PADI Tec Trimix training for hypoxic trimix dives.',[cert('trimix65','Tec Trimix 65 Diver',['Tec Trimix 65 Diver'],'padi-tec-trimix-65'),manual()],PADI_TEC),
  padi('rebreather','Rebreather Diver','Tec · Rebreather','technical','Unit-specific recreational rebreather training.',[aow(),manual()],PADI_TEC),
  padi('advanced-rebreather','Advanced Rebreather Diver','Tec · Rebreather','technical','Advanced unit-specific rebreather training.',[cert('rb','Rebreather Diver on the unit',['Rebreather Diver'],'padi-rebreather'),manual()],PADI_TEC),
  padi('tec-40-ccr','Tec 40 CCR Diver','Tec · CCR','technical','Technical CCR diving to 40 metres.',[cert('aow','Advanced Open Water Diver',['Advanced Open Water Diver'],'padi-aow'),cert('eanx','Enriched Air Diver',['Enriched Air (Nitrox) Diver'],'padi-enriched-air'),dives(30),manual()],'https://store.padi.com/en-us/ns/courses/tec-40-ccr/p/tec-40-ccr/'),
  padi('tec-60-ccr','Tec 60 CCR Diver','Tec · CCR','technical','Multiple-stop CCR trimix/heliox diving to 60 metres.',[cert('tec40ccr','Tec 40 CCR Diver on the unit',['Tec 40 CCR Diver'],'padi-tec-40-ccr'),cert('rescue','Rescue Diver',['Rescue Diver'],'padi-rescue'),manual()],PADI_TEC),

  tdi('nitrox','Nitrox Diver','Foundation',[ow()]), tdi('sidemount','Sidemount Diver','Foundation',[ow()]), tdi('intro-tech','Intro to Tech Diver','Foundation',[ow(),dives(25),manual()]),
  tdi('advanced-nitrox','Advanced Nitrox Diver','Open circuit',[cert('nitrox','Nitrox Diver',['Nitrox Diver','Enriched Air'],'tdi-nitrox'),dives(25),manual()],'https://www.tdisdi.com/tdi/get-certified/advanced-nitrox-diver/'),
  tdi('deco','Decompression Procedures Diver','Open circuit',[aow(),dives(25),manual()],'https://www.tdisdi.com/tdi/get-certified/decompression-procedures-diver/'),
  tdi('extended-range','Extended Range Diver','Open circuit',[cert('an','Advanced Nitrox Diver',['Advanced Nitrox Diver'],'tdi-advanced-nitrox'),cert('deco','Decompression Procedures Diver',['Decompression Procedures Diver'],'tdi-deco'),dives(100)]),
  tdi('helitrox','Helitrox Diver','Open circuit',[cert('an','Advanced Nitrox Diver',['Advanced Nitrox Diver'],'tdi-advanced-nitrox'),cert('deco','Decompression Procedures Diver',['Decompression Procedures Diver'],'tdi-deco'),manual()]),
  tdi('trimix','Trimix Diver','Open circuit',[cert('an','Advanced Nitrox Diver',['Advanced Nitrox Diver'],'tdi-advanced-nitrox'),cert('deco','Decompression Procedures Diver',['Decompression Procedures Diver'],'tdi-deco'),dives(100),manual()]),
  tdi('advanced-trimix','Advanced Trimix Diver','Open circuit',[cert('er','Extended Range or Trimix Diver',['Extended Range Diver','Trimix Diver'],'tdi-extended-range'),manual()]),
  tdi('cavern','Cavern Diver','Overhead',[ow(),dives(25)]), tdi('intro-cave','Intro to Cave Diver','Overhead',[cert('cavern','Cavern Diver',['Cavern Diver'],'tdi-cavern')]),
  tdi('full-cave','Full Cave Diver','Overhead',[cert('intro','Intro to Cave Diver',['Intro to Cave Diver'],'tdi-intro-cave')]), tdi('advanced-wreck','Advanced Wreck Diver','Overhead',[cert('deco','Decompression Procedures or equivalent',['Decompression Procedures Diver'],'tdi-deco'),manual()]),
  tdi('cavern-discovery','Cavern Discovery','Overhead',[manual()]), tdi('cave-dpv','Cave DPV Diver','Overhead',[cert('full-cave','Full Cave Diver',['Full Cave Diver'],'tdi-full-cave'),manual()]), tdi('stage-cave','Stage Cave Diver','Overhead',[cert('full-cave','Full Cave Diver',['Full Cave Diver'],'tdi-full-cave'),manual()]), tdi('cave-survey','Cave Survey Diver','Overhead',[cert('full-cave','Full Cave Diver',['Full Cave Diver'],'tdi-full-cave'),manual()]), tdi('mine','Mine Diver','Overhead',[manual()]), tdi('dpv','Diver Propulsion Vehicle Diver','Open circuit',[manual()]),
  tdi('air-diluent-ccr','Air Diluent CCR Diver','Rebreather',[cert('nitrox','Nitrox Diver',['Nitrox Diver'],'tdi-nitrox'),dives(20),manual()]),
  tdi('air-diluent-deco-ccr','Air Diluent Decompression CCR Diver','Rebreather',[cert('ccr','Air Diluent CCR Diver on the unit',['Air Diluent CCR Diver'],'tdi-air-diluent-ccr'),manual()]),
  tdi('mixed-gas-ccr','Mixed Gas CCR Diver','Rebreather',[cert('ccr','Air Diluent Decompression CCR Diver',['Air Diluent Decompression CCR Diver'],'tdi-air-diluent-deco-ccr'),manual()]),
  tdi('advanced-mixed-gas-ccr','Advanced Mixed Gas CCR Diver','Rebreather',[cert('mixed','Mixed Gas CCR Diver',['Mixed Gas CCR Diver'],'tdi-mixed-gas-ccr'),manual()]),
  tdi('semi-closed-rebreather','Semi-Closed Rebreather Diver','Rebreather',[cert('nitrox','Nitrox Diver',['Nitrox Diver'],'tdi-nitrox'),manual()]), tdi('helitrox-ccr','Helitrox CCR Diver','Rebreather',[cert('ccr','Air Diluent Decompression CCR Diver',['Air Diluent Decompression CCR Diver'],'tdi-air-diluent-deco-ccr'),manual()]),
  tdi('nitrox-blender','Nitrox Gas Blender','Service',[manual()]), tdi('advanced-blender','Advanced Gas Blender','Service',[cert('blender','Nitrox Gas Blender',['Nitrox Gas Blender'],'tdi-nitrox-blender')]), tdi('o2-service','Oxygen Equipment Service Technician','Service',[manual()]),
  tdi('non-diving-specialty-instructor','TDI Non-Diving Specialty Instructor','Professional',[manual()]), tdi('divemaster','TDI Divemaster','Professional',[manual()]), tdi('instructor','TDI Instructor','Professional',[manual()]), tdi('instructor-trainer','TDI Instructor Trainer','Professional',[manual()]),
];

export const OFFICIAL_TRAINING_OPTIONS = [...new Set(TRAINING_COURSES.map((course) => course.title))];
export function normalizeCourseName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
export function certificationMatches(certification: CertificationLike, course: TrainingCourse | string[]) {
  if (!Array.isArray(course) && certification.agency && normalizeCourseName(certification.agency) !== normalizeCourseName(course.agency)) return false;
  const names = Array.isArray(course) ? course : [course.title, ...(course.aliases ?? [])];
  const actual = normalizeCourseName(certification.certification);
  return names.some((name) => {
    const expected = normalizeCourseName(name);
    return actual === expected || actual.startsWith(`${expected} `) || actual.endsWith(` ${expected}`);
  });
}
export function qualifyingPadiSpecialties(certifications: CertificationLike[]) { const unique = new Set<string>(); certifications.forEach((certification) => { if (normalizeCourseName(certification.agency ?? '') !== 'padi') return; const matched = TRAINING_COURSES.find((course) => course.agency === 'PADI' && course.isSpecialty && course.countsTowardMasterScubaDiver !== false && certificationMatches(certification, course)); if (matched) unique.add(matched.id); else if (certification.courseType === 'specialty') unique.add(normalizeCourseName(certification.certification)); }); return unique.size; }
export function requirementMet(requirement: TrainingRequirement, certifications: CertificationLike[], diveCount: number, progress?: CourseProgressLike, sharedMetRequirementIds: string[] = []) { if (progress?.metRequirementIds?.includes(requirement.id) || sharedMetRequirementIds.includes(requirement.id)) return true; if (requirement.type === 'manual') return false; if (requirement.type === 'dives') return diveCount >= requirement.count; if (requirement.type === 'specialties') return requirement.agency === 'PADI' ? qualifyingPadiSpecialties(certifications) >= requirement.count : false; const matches = certifications.filter((certification) => certificationMatches(certification, requirement.courses)); if (requirement.type === 'certification') return matches.length > 0; const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - requirement.withinMonths); return matches.some((certification) => certification.issuedAt && new Date(`${certification.issuedAt}T12:00:00`) >= cutoff); }
export function courseState(course: TrainingCourse, certifications: CertificationLike[], diveCount: number, progress?: CourseProgressLike, sharedMetRequirementIds: string[] = []) {
  if (certifications.some((certification) => certificationMatches(certification, course))) return 'completed' as const;
  const supersededBy = course.id === 'padi-discover'
    ? ['Scuba Diver', 'Open Water Diver']
    : course.id === 'padi-scuba-diver'
      ? ['Open Water Diver']
      : course.id === 'padi-adventure'
        ? ['Advanced Open Water Diver']
        : [];
  if (supersededBy.some((title) => certifications.some((certification) => certificationMatches(certification, [title])))) return 'superseded' as const;
  if (progress?.status === 'ignored') return 'ignored' as const;
  if (progress?.status === 'in-progress') return 'in-progress' as const;
  if (progress?.status === 'planned') return 'planned' as const;
  return course.requirements.every((requirement) => requirementMet(requirement, certifications, diveCount, progress, sharedMetRequirementIds)) ? 'ready' as const : 'blocked' as const;
}
