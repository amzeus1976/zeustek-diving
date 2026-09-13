import { listLocalDiveRecords, saveLocalRecord, deleteLocalRecord, diveOperation } from './dive-store';



export interface DiveCylinder {

  id: string;

  name: string;

  gasType: 'Air' | 'Nitrox' | 'Trimix' | 'Oxygen' | 'Other';

  oxygenPercent: number | null;

  heliumPercent: number | null;

  nitrogenPercent?: number | null;

  configuration: string;

  material: string;

  size: string;

  internalVolumeLiters?: number | null;

  startPressureBar: number | null;

  endPressureBar: number | null;

  switchDepthM: number | null;

  switchRuntimeMin: number | null;

  wasSwitchedTo?: boolean;

  sacPressureBarMin?: number | null;
  sacRate?: number | null;

  rmvRate?: number | null;

}

export interface DecoStop {

  depthM: number | null;

  durationMin: number | null;

  actualDurationMin: number | null;

  ceilingViolated?: boolean;

}

export interface DiveDebrief {
  wentWell?: string;
  improve?: string;
  unexpectedEvents?: string;
  decisionsAndAdaptations?: string;
  humanFactorsOutcome?: {
    taskLoading?: string;
    communication?: string;
    teamwork?: string;
    situationalAwareness?: string;
    pressure?: string;
    decisionMaking?: string;
    stopAbortOutcome?: string;
    equipmentInteraction?: string;
    notes?: string;
  };
  confidenceLevel?: number | null;
  lessonsLearned?: string;
  nextDiveActions?: string;
  skillEvidenceIds?: string[];
}

export interface DiveStory {
  narrative?: string;
  standoutMoment?: string;
  challengingMoment?: string;
  surprises?: string;
  memorableMoments?: string;
  personalReflection?: string;
  featuredAttachmentIds?: string[];
  timelineNotes?: Array<{ timeOffsetMin?: number | null; depthM?: number | null; text: string }>;
}

export interface DiveRecord {
  /** Optional presentations on this Dive; never separate entities or histories. */
  debrief?: DiveDebrief;
  story?: DiveStory;
  originatingPlanId?: string;
  originatingPlanRevision?: { eventId: string; recordHash: string; modifiedAt: string };
  weatherProvider?: string; weatherResolution?: string; weatherAttribution?: string;

  schemaVersion?: 'zeustek-universal-dive-log/1.0';

  site: string; siteId?: string; streetAddress?: string; postcode?: string; hiredEquipment?: Array<{ name: string; category: string }>; diveNumber?: number; date: string; timeIn?: string; timeOut?: string;

  country?: string; region?: string; town?: string; latitude?: number | null; longitude?: number | null; operator?: string; vessel?: string;

  siteSource?: 'manual' | 'Finstrokes_DB' | 'Divemap_UK' | 'Custom_API';

  diveMode?: 'recreational' | 'recreational-training' | 'technical' | 'technical-training'; isTechnicalDive?: boolean; diveTypes?: string[]; waterType?: 'Saltwater' | 'Freshwater' | 'Brackish' | 'Other' | '';

  maxDepthM: number | null; averageDepthM?: number | null; bottomTimeMin: number | null; totalElapsedMin?: number | null;

  surfaceIntervalMin?: number | null; prePressureGroup?: string; postPressureGroup?: string;

  pressureGroupMode?: 'AUTO' | 'MANUAL'; pressureGroupValidation?: 'MATCHED' | 'MANUAL_MORE_CONSERVATIVE' | 'SYSTEM_MORE_CONSERVATIVE' | 'VIOLATION_DANGER' | 'INSUFFICIENT_DATA' | 'NO_DECOMPRESSION_LIMIT_EXCEEDED'; systemCalculatedPostDivePG?: string; pressureGroupDataset?: string;

  previousPostPressureGroup?: string; residualNitrogenTimeMin?: number | null; adjustedNoDecompressionLimitMin?: number | null; totalBottomTimeWithRntMin?: number | null; roundedTableDepthFt?: number | null;

  safetyStopExecuted?: boolean; safetyStopDepthM?: number | null; safetyStopDurationMin?: number | null; ascentWarnings?: string[];

  weather?: string; airTemperatureC?: number | null; surfaceTemperatureC?: number | null; minimumTemperatureC?: number | null;

  windSpeedKnots?: number | null; windDirectionDegrees?: number | null; waveHeightM?: number | null; surge?: string; visibilityM?: number | null;

  currentStrength?: string; currentDirectionDegrees?: number | null; thermoclines?: string[];

  decoDive?: boolean; decoAlgorithm?: string; gradientFactorLow?: number | null; gradientFactorHigh?: number | null;

  cnsPercent?: number | null; otu?: number | null; plannedRuntimeMin?: number | null; deepStopsExecuted?: boolean; decoStops?: DecoStop[];

  cylinders?: DiveCylinder[]; sacRate?: number | null; rmvRate?: number | null;

  exposureSuit?: string; wetsuitThicknessMm?: number | null; undergarment?: string; ballastKg?: number | null;

  weightDistribution?: string; weightBeltKg?: number | null; integratedWeightKg?: number | null; weightHarnessKg?: number | null; trimPocketKg?: number | null; otherWeightKg?: number | null; backplateWeightKg?: number | null; trimAssessment?: 'Heavy' | 'Ideal' | 'Light' | ''; buoyancyNotes?: string; bcdConfiguration?: string; wingLiftCapacityLbs?: number | null; backplateMaterial?: string; singleTankAdapterUsed?: boolean; specialistEquipment?: string[]; backupLightsCount?: number | null; technicalRedundancies?: string[];

  hydrationScore?: number | null; sleepHours?: number | null; thermalComfort?: string; fatigue?: string;

  equipmentNotes?: string; personalNotes?: string;

  aquaticLife?: string[]; aquaticLifeNotes?: string;

  diveTeamIds?: string[]; buddyIds?: string[]; diveLeaderId?: string; supportCrew?: string; isVerified?: boolean; verificationHashLink?: string;

  verifierAgency?: string; verifierCertificationNumber?: string;

  preDiveTotalTimeMin?: number; currentTotalTimeMin?: number;

  gas: string; notes: string; source: 'manual' | 'oceanic-plus' | 'padi' | 'image-import';

  equipmentIds?: string[]; equipmentSetId?: string; equipmentSetIds?: string[]; hireGear?: boolean;

  createdAt: string; modifiedAt: string;

}



export async function listDives(): Promise<Array<DiveRecord & { entityId: string }>> {

  return (await listLocalDiveRecords<DiveRecord>('dive')).sort((a, b) => b.date.localeCompare(a.date));

}

export async function saveDive(input: Omit<DiveRecord, 'source' | 'createdAt' | 'modifiedAt'> & {entityId?:string;source?:DiveRecord['source']}) {
  return diveOperation(`save:dive:${JSON.stringify(input)}`, 'Saving dive locally…', () => saveLocalRecord('dive',{...input,source:input.source ?? 'manual'}));
}
export async function deleteDive(entityId:string) {
  return diveOperation(`delete:${entityId}`, 'Deleting dive locally…', () => deleteLocalRecord(entityId));
}

export async function renumberDivesByChronology(startAt = 1) {

  const dives = await listDives();

  const ordered = [...dives].sort((a, b) => {

    const byTime = `${a.date}T${a.timeIn || '23:59'}`.localeCompare(

      `${b.date}T${b.timeIn || '23:59'}`,

    );

    return byTime || a.entityId.localeCompare(b.entityId);

  });

  for (const [index, dive] of ordered.entries()) {

    const number = Math.max(1, startAt) + index;

    if (dive.diveNumber === number) continue;

    const { createdAt: _createdAt, modifiedAt: _modifiedAt, ...editable } = dive;

    await saveDive({ ...editable, diveNumber: number });

  }

}


