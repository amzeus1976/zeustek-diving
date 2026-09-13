import { describe, expect, it } from 'vitest';
import { courseState, qualifyingPadiSpecialties, requirementMet, TRAINING_COURSES } from '../lib/training-course-maps';

describe('training course maps', () => {
  it('does not count EFR or core courses as PADI specialties', () => {
    const records = [
      { agency: 'PADI', certification: 'EFR Primary & Secondary Care' },
      { agency: 'PADI', certification: 'Rescue Diver' },
      { agency: 'PADI', certification: 'Night Diver' },
      { agency: 'PADI', certification: 'Deep Diver' },
    ];
    expect(qualifyingPadiSpecialties(records)).toBe(2);
  });

  it('recognises the two specialty names used by existing certification cards', () => {
    const records = [
      { agency: ' PADI ', certification: 'Night diver' },
      { agency: 'PADI', certification: 'Deep Diver (40 meters)' },
      { agency: 'PADI', certification: 'EFR Primary & Secondary Care' },
    ];
    expect(qualifyingPadiSpecialties(records)).toBe(2);
  });

  it('does not complete a PADI course from another agency or orphaned planner progress', () => {
    const wreck = TRAINING_COURSES.find((course) => course.id === 'padi-wreck')!;
    expect(courseState(wreck, [{ agency: 'TDI', certification: 'Advanced Wreck Diver' }], 0)).not.toBe('completed');
    expect(courseState(wreck, [], 0, { courseId: wreck.id, status: 'completed' })).not.toBe('completed');
  });

  it('greys introductory experiences superseded by higher certifications', () => {
    const discover = TRAINING_COURSES.find((course) => course.id === 'padi-discover')!;
    const adventure = TRAINING_COURSES.find((course) => course.id === 'padi-adventure')!;
    expect(courseState(discover, [{ agency: 'PADI', certification: 'Open Water Diver' }], 0)).toBe('superseded');
    expect(courseState(adventure, [{ agency: 'PADI', certification: 'Advanced Open Water Diver' }], 0)).toBe('superseded');
  });

  it('requires five distinct qualifying specialties for Master Scuba Diver', () => {
    const requirement = TRAINING_COURSES.find((course) => course.id === 'padi-msd')!.requirements.find((item) => item.type === 'specialties')!;
    const records = ['Night Diver','Deep Diver','Wreck Diver','Dry Suit Diver','Enriched Air (Nitrox) Diver'].map((certification) => ({ agency: 'PADI', certification }));
    expect(requirementMet(requirement, records, 50)).toBe(true);
    expect(requirementMet(requirement, [...records.slice(0, 4), { agency: 'PADI', certification: 'EFR Primary & Secondary Care' }], 50)).toBe(false);
  });

  it('includes the requested PADI specialty catalogue and rebreather introductions', () => {
    const titles = new Set(TRAINING_COURSES.filter((course) => course.agency === 'PADI').map((course) => course.title));
    [
      'PADI AWARE Specialist',
      'AWARE Fish Identification',
      'AWARE Coral Reef Conservation',
      'AWARE Sea Turtle Awareness',
      'Gas Blender',
      'DSMB (Surface Marker Buoy) Diver',
      'Twinset Diver',
      'Multilevel Diver',
      'Advanced Public Safety Diver',
      'Adaptive Techniques',
      'ReActivate',
      'Discover Rebreather',
    ].forEach((title) => expect(titles.has(title), title).toBe(true));
  });

  it('does not count the pro-level Adaptive Techniques specialty toward recreational MSD', () => {
    expect(qualifyingPadiSpecialties([
      { agency: 'PADI', certification: 'PADI AWARE Specialist' },
      { agency: 'PADI', certification: 'Adaptive Techniques' },
    ])).toBe(1);
  });

  it('matches legacy Project AWARE and Sidemount certificate names without counting ReActivate', () => {
    expect(qualifyingPadiSpecialties([
      { agency: 'PADI', certification: 'Project AWARE' },
      { agency: 'PADI', certification: 'Sidemount Rec Diver' },
      { agency: 'PADI', certification: 'ReActivate' },
    ])).toBe(2);
  });

  it('keeps planned courses visibly planned', () => {
    const course = TRAINING_COURSES.find((item) => item.id === 'padi-tec-40')!;
    expect(courseState(course, [], 0, { courseId: course.id, status: 'planned' })).toBe('planned');
  });

  it('uses separate medical confirmations for recreational, Divemaster and technical training', () => {
    const openWater = TRAINING_COURSES.find((item) => item.id === 'padi-open-water')!;
    const divemaster = TRAINING_COURSES.find((item) => item.id === 'padi-divemaster')!;
    const tec40 = TRAINING_COURSES.find((item) => item.id === 'padi-tec-40')!;
    expect(openWater.requirements.some((item) => item.id === 'self-medical')).toBe(true);
    expect(divemaster.requirements.some((item) => item.id === 'divemaster-medical')).toBe(true);
    expect(tec40.requirements.some((item) => item.id === 'technical-medical')).toBe(true);
  });

  it('applies one shared self-medical confirmation to recreational courses only', () => {
    const openWater = TRAINING_COURSES.find((item) => item.id === 'padi-open-water')!;
    const equipment = TRAINING_COURSES.find((item) => item.id === 'padi-equipment')!;
    const divemaster = TRAINING_COURSES.find((item) => item.id === 'padi-divemaster')!;
    const shared = ['self-medical'];
    expect(courseState(openWater, [], 0, undefined, shared)).toBe('ready');
    expect(courseState(equipment, [], 0, undefined, shared)).toBe('ready');
    expect(courseState(divemaster, [], 40, undefined, shared)).toBe('blocked');
  });
});
