'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Download,
  Gauge,
  Settings2,
  Waves,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AccessibleDialog } from './accessible-dialog';
import { ZeusTekIcon } from './zeustek-icon';
import { ZeusTekAssetIcon } from './brand/zeustek-asset-icon';
import { buildVisibleInsightAwards, insightAwardsEmptyState } from '../lib/insights/visible-insight-awards';
import { useRecordRefresh } from './record-status';
import { listDives } from '../lib/offline/dives';
import {
  listCertifications,
  listDashboardSettings,
  listDiveSites,
  listPeople,
  type CertificationRecord,
  type DashboardSettingsRecord,
  type DiveSiteRecord,
  type PersonRecord,
  type Stored,
} from '../lib/offline/dive-planning';
import {
  listReusableLoadouts,
  type ReusableLoadoutRecord,
} from '../lib/offline/loadouts-gas';
import {
  listCanonicalSkills,
  listSkillEvidence,
  skillRecordName,
  type CanonicalSkillRecord,
  type SkillEvidenceRecord,
} from '../lib/offline/dive-context';
import {
  buildSkillsCurrencyProjection,
  listCurrencyPolicies,
  type CurrencyPolicyRecord,
} from '../lib/offline/skills-currency';
import {
  evaluatePathwayReadiness,
  isTechnicalDive,
  listReferenceRequirementSets,
  type ReferenceRequirementSetRecord,
} from '../lib/offline/technical-workspace';
import {
  evaluateProfessionalReadiness,
  listProfessionalEvidence,
  listProfessionalPathways,
  listProfessionalRequirementSets,
  requirementSetForPathway,
  type ProfessionalEvidenceRecord,
  type ProfessionalPathwayRecord,
  type ProfessionalReferenceRequirementSetRecord,
} from '../lib/offline/professional-development';
import {
  DEFAULT_ANALYSIS_SCOPE,
  buildExperienceAnalyticsProjection,
  compareDepthBandsByWater,
  insightsExportEnvelope,
  type AnalysisScope,
  type DiveWithId,
  type ExperienceAnalyticsProjection,
} from '../lib/offline/experience-analytics';
import styles from './experience-analytics.module.css';
import { INSIGHT_AWARD_DEFINITIONS, normaliseInsightAwardCount, type InsightAwardCount } from '../lib/insights/insight-awards';
import {AnalysisScopePanel,AnalysisScopeChips} from './insights/analysis-scope-panel';
import {AnalysisWorkbench} from './insights/analysis-workbench';
import {AnalysisSourceRecords} from './insights/analysis-source-records';
import {normaliseAnalysisCards,DEFAULT_ANALYSIS_CARDS,type AnalysisCardConfig} from '../lib/insights/analysis-card-registry';
import {saveWorkbenchSettings} from '../lib/insights/workbench-settings';

type DetailKind =
  | 'total-dives'
  | 'total-time'
  | 'max-depth'
  | 'average-depth'
  | 'average-sac'
  | 'best-sac'
  | 'average-rmv'
  | 'recent-dives'
  | 'depth-bands'
  | 'environment'
  | 'sac-trend'
  | 'rmv-trend'
  | 'equipment'
  | 'sites'
  | 'qualifying'
  | 'readiness'
  | 'filters';

type Props = { go?: (next: string) => void };

type ReadinessCard = {
  key: string;
  label: string;
  percent: number | null;
  valueLabel: string;
  detail: string;
  state: string;
  sourceIds: string[];
};

type CountProgress = {
  key: string;
  label: string;
  pathwayLabel: string;
  versionLabel: string;
  current: number;
  target: number;
  percent: number;
  state: string;
  detail: string;
  diveIds: string[];
  sourceIds: string[];
};

const round = (value: number | null, digits = 1) =>
  value == null ? '—' : value.toFixed(digits).replace(/\.0$/, '');
const formatMinutes = (minutes: number | null) => {
  if (minutes == null) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
};
const normal = (value: string | null | undefined) =>
  (value ?? '').toLocaleLowerCase('en-GB').replace(/\s+/g, '');
const recordHref = (section: string, parameter: string, id: string) =>
  `/?section=${encodeURIComponent(section)}&${parameter}=${encodeURIComponent(id)}`;

function analysisScopeSummary(scope: AnalysisScope) {
  const parts: string[] = [];
  if (scope.dateFrom || scope.dateTo)
    parts.push(
      `${scope.dateFrom || 'earliest'} to ${scope.dateTo || 'latest'}`,
    );
  if (!scope.includePool) parts.push('Pool excluded');
  if (!scope.includeTraining) parts.push('Training excluded');
  if (scope.diveModes.length) parts.push(scope.diveModes.join(', '));
  if (scope.waterTypes.length) parts.push(scope.waterTypes.join(', '));
  if (scope.siteIds.length) parts.push(`${scope.siteIds.length} Site filter`);
  if (scope.equipmentSetIds.length)
    parts.push(`${scope.equipmentSetIds.length} Equipment Set filter`);
  if(scope.advancedFilter)parts.push('Advanced AND / OR / NOT');
  if(scope.environmentFocus)parts.push('Environment: '+scope.environmentFocus);
  if (scope.excludedDiveIds.length) parts.push(`${scope.excludedDiveIds.length} data point${scope.excludedDiveIds.length === 1 ? '' : 's'} excluded`);
  return parts.length
    ? parts.join(' · ')
    : 'All dates and all recorded Dive types';
}

export function ExperienceAnalytics({ go }: Props) {
  const [dives, setDives] = useState<DiveWithId[]>([]);
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [loadouts, setLoadouts] = useState<
    Array<Stored<ReusableLoadoutRecord>>
  >([]);
  const [certifications, setCertifications] = useState<
    Array<Stored<CertificationRecord>>
  >([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [skills, setSkills] = useState<CanonicalSkillRecord[]>([]);
  const [skillEvidence, setSkillEvidence] = useState<SkillEvidenceRecord[]>([]);
  const [currencyPolicies, setCurrencyPolicies] = useState<
    Array<Stored<CurrencyPolicyRecord>>
  >([]);
  const [requirementSets, setRequirementSets] = useState<
    Array<Stored<ReferenceRequirementSetRecord>>
  >([]);
  const [professionalPathways, setProfessionalPathways] = useState<
    Array<Stored<ProfessionalPathwayRecord>>
  >([]);
  const [professionalEvidence, setProfessionalEvidence] = useState<
    Array<Stored<ProfessionalEvidenceRecord>>
  >([]);
  const [professionalRequirementSets, setProfessionalRequirementSets] =
    useState<Array<Stored<ProfessionalReferenceRequirementSetRecord>>>([]);
  const [scope, setScope] = useState<AnalysisScope>(DEFAULT_ANALYSIS_SCOPE);
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const [awardCount, setAwardCount] = useState<InsightAwardCount>(8);
  const [awardIds, setAwardIds] = useState<string[]>([]);
  const [workbenchCards,setWorkbenchCards]=useState<AnalysisCardConfig[]>(DEFAULT_ANALYSIS_CARDS);

  const refresh = useCallback(async () => {
    const [
      nextDives,
      nextSites,
      nextLoadouts,
      nextCerts,
      nextPeople,
      nextSkills,
      nextEvidence,
      nextPolicies,
      nextRequirementSets,
      nextProPathways,
      nextProEvidence,
      nextProSets,
      nextDashboardSettings,
    ] = await Promise.all([
      listDives(),
      listDiveSites(),
      listReusableLoadouts(),
      listCertifications(),
      listPeople(),
      listCanonicalSkills(),
      listSkillEvidence(),
      listCurrencyPolicies(),
      listReferenceRequirementSets(),
      listProfessionalPathways(),
      listProfessionalEvidence(),
      listProfessionalRequirementSets(),
      listDashboardSettings(),
    ]);
    setDives(nextDives);
    setSites(nextSites);
    setLoadouts(nextLoadouts);
    setCertifications(nextCerts);
    setPeople(nextPeople);
    setSkills(nextSkills);
    setSkillEvidence(nextEvidence);
    setCurrencyPolicies(nextPolicies);
    setRequirementSets(nextRequirementSets);
    setProfessionalPathways(nextProPathways);
    setProfessionalEvidence(nextProEvidence);
    setProfessionalRequirementSets(nextProSets);
    const dashboardSettings = nextDashboardSettings[0] as DashboardSettingsRecord | undefined;
    setAwardCount(normaliseInsightAwardCount(dashboardSettings?.maxAwards));
    setAwardIds(dashboardSettings?.selectedAwards ?? []);
    setWorkbenchCards(normaliseAnalysisCards(dashboardSettings?.analysisWorkbench?.cards));
  }, []);
  useRecordRefresh(refresh);

  const projection = useMemo(
    () => buildExperienceAnalyticsProjection(dives, sites, loadouts, scope),
    [dives, sites, loadouts, scope],
  );
  const waterDepth = useMemo(
    () =>
      compareDepthBandsByWater(
        dives.filter((dive) =>
          projection.includedDiveIds.includes(dive.entityId),
        ),
      ),
    [dives, projection.includedDiveIds],
  );
  const scopedDives = useMemo(
    () =>
      dives.filter((dive) =>
        projection.includedDiveIds.includes(dive.entityId),
      ),
    [dives, projection.includedDiveIds],
  );
  const currencyRows = useMemo(
    () =>
      buildSkillsCurrencyProjection(skills, skillEvidence, currencyPolicies),
    [skills, skillEvidence, currencyPolicies],
  );
  const technicalContext = useMemo(
    () => ({
      dives: scopedDives,
      certifications,
      skills,
      evidence: skillEvidence,
      equipmentSets: loadouts,
    }),
    [scopedDives, certifications, skills, skillEvidence, loadouts],
  );
  const latestRequirementSets = useMemo(() => {
    const latest = new Map<string, Stored<ReferenceRequirementSetRecord>>();
    for (const set of requirementSets) {
      const key = normal(`${set.agency}:${set.pathwayKey}`);
      const previous = latest.get(key);
      if (!previous || set.capturedAt.localeCompare(previous.capturedAt) > 0)
        latest.set(key, set);
    }
    return [...latest.values()];
  }, [requirementSets]);
  const readinessCards = useMemo(() => {
    const technical = ['tec40', 'tec45'].map((needle) => {
      const set = [...latestRequirementSets]
        .filter((item) =>
          normal(`${item.pathwayKey} ${item.pathwayLabel}`)?.includes(needle),
        )
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
      if (!set)
        return {
          key: needle,
          label: needle === 'tec40' ? 'Tec 40' : 'Tec 45',
          percent: null,
          valueLabel: 'Not configured',
          detail: 'No captured requirement version',
          state: 'unknown',
          sourceIds: [],
        } satisfies ReadinessCard;
      const result = evaluatePathwayReadiness(set, technicalContext);
      return {
        key: needle,
        label: set.pathwayLabel || (needle === 'tec40' ? 'Tec 40' : 'Tec 45'),
        percent: result.percent,
        valueLabel: `${result.percent}%`,
        detail: `${result.satisfied} / ${result.total} captured requirements · ${set.versionLabel}`,
        state: result.state,
        sourceIds: [
          set.entityId,
          ...result.requirements.flatMap((item) =>
            item.evidence.flatMap((evidence) =>
              evidence.id ? [evidence.id] : [],
            ),
          ),
        ],
      } satisfies ReadinessCard;
    });
    const pathway =
      professionalPathways.find((item) =>
        /dive\s*master|divemaster/i.test(
          `${item.pathwayKey} ${item.displayName}`,
        ),
      ) ?? professionalPathways[0];
    let professional: ReadinessCard = {
      key: 'professional',
      label: 'Divemaster',
      percent: null,
      valueLabel: 'Not configured',
      detail: 'No Professional pathway configured',
      state: 'unknown',
      sourceIds: [],
    };
    if (pathway) {
      const set = requirementSetForPathway(
        pathway,
        professionalRequirementSets,
      );
      if (set) {
        const result = evaluateProfessionalReadiness(set, {
          dives: scopedDives,
          certifications,
          skills,
          skillEvidence,
          professionalEvidence: professionalEvidence.filter(
            (item) => item.pathwayId === pathway.entityId,
          ),
          sites,
          people,
        });
        professional = {
          key: 'professional',
          label: pathway.displayName,
          percent: result.percent,
          valueLabel: `${result.percent}%`,
          detail: `${result.satisfied} / ${result.total} captured requirements · ${set.versionLabel}`,
          state: result.state,
          sourceIds: [
            pathway.entityId,
            set.entityId,
            ...result.requirements.flatMap((item) =>
              item.evidence.map((evidence) => evidence.id),
            ),
          ],
        };
      }
    }
    const rescue = currencyRows
      .filter((row) =>
        /rescue|tow|unresponsive|airway|oxygen/i.test(
          skillRecordName(row.skill),
        ),
      )
      .sort((a, b) => {
        const priority = {
          'needs-practice': 0,
          'due-soon': 1,
          'not-assessed': 2,
          current: 3,
        } as const;
        return priority[a.projection.status] - priority[b.projection.status];
      })[0];
    const rescueCard = rescue
      ? ({
          key: 'rescue',
          label: 'Rescue currency',
          percent: null,
          valueLabel: rescue.projection.status.replace('-', ' '),
          detail: rescue.projection.reason,
          state: rescue.projection.status,
          sourceIds: [
            rescue.skill.entityId,
            ...(rescue.projection.latestEvidenceId
              ? [rescue.projection.latestEvidenceId]
              : []),
          ],
        } satisfies ReadinessCard)
      : ({
          key: 'rescue',
          label: 'Rescue currency',
          percent: null,
          valueLabel: 'Not configured',
          detail: 'No Rescue currency policy/evidence found',
          state: 'unknown',
          sourceIds: [],
        } satisfies ReadinessCard);
    return [...technical, professional, rescueCard];
  }, [
    latestRequirementSets,
    technicalContext,
    professionalPathways,
    professionalRequirementSets,
    professionalEvidence,
    scopedDives,
    certifications,
    skills,
    skillEvidence,
    sites,
    people,
    currencyRows,
  ]);

  const countProgress = useMemo(() => {
    const rows: CountProgress[] = [];
    for (const set of latestRequirementSets) {
      const result = evaluatePathwayReadiness(set, technicalContext);
      for (const item of result.requirements) {
        if (item.requirement.kind !== 'count') continue;
        const target =
          typeof item.requirement.rule.min === 'number'
            ? item.requirement.rule.min
            : null;
        const current = Number(item.detail.match(/^([0-9]+)/)?.[1]);
        if (target == null || !Number.isFinite(current)) continue;
        const metric = item.requirement.rule.metric;
        const depthM = item.requirement.rule.depthM;
        const matchingDives = scopedDives.filter(
          (dive) =>
            metric === 'logged-dives' ||
            (metric === 'technical-dives' && isTechnicalDive(dive)) ||
            (metric === 'deco-dives' &&
              Boolean(dive.decoDive || (dive.decoStops?.length ?? 0) > 0)) ||
            (metric === 'dives-depth-at-least' &&
              typeof depthM === 'number' &&
              dive.maxDepthM != null &&
              dive.maxDepthM >= depthM),
        );
        rows.push({
          key: `${set.entityId}:${item.requirement.key}`,
          label: item.requirement.label,
          pathwayLabel: set.pathwayLabel || set.pathwayKey,
          versionLabel: set.versionLabel,
          current,
          target,
          percent: target
            ? Math.min(100, Math.round((current / target) * 100))
            : 0,
          state: item.state,
          detail: item.detail,
          diveIds: matchingDives.map((dive) => dive.entityId),
          sourceIds: [
            set.entityId,
            ...item.evidence.flatMap((evidence) =>
              evidence.id ? [evidence.id] : [],
            ),
          ],
        });
      }
    }
    return rows.slice(0, 5);
  }, [latestRequirementSets, technicalContext, scopedDives]);

  function exportInsights() {
    const envelope = insightsExportEnvelope(projection);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(envelope, null, 2)], {
        type: 'application/json',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `zeustek-insights-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const h = projection.headlines;
  const diveTypeCount = (pattern: RegExp) => scopedDives.filter((dive) => (dive.diveTypes ?? []).some((value) => pattern.test(value.toLowerCase()))).length;
  const depths = scopedDives.map((dive) => dive.maxDepthM).filter((value): value is number => value != null);
  const durations = scopedDives.map((dive) => dive.totalElapsedMin ?? dive.bottomTimeMin).filter((value): value is number => value != null);
  const certificationFor = (pattern: RegExp) => certifications.find((item) => pattern.test(`${item.certification} ${item.level}`.toLowerCase()));
  const labelCertification = (item: Stored<CertificationRecord> | undefined) => item ? item.certification || item.level : 'Not recorded';
  const awardValues: Record<string, string> = {
    divesLogged: String(scopedDives.length), recreationalDives: String(scopedDives.filter((dive)=>!dive.diveMode?.startsWith('technical')).length), technicalDives: String(scopedDives.filter((dive)=>dive.diveMode?.startsWith('technical')).length),
    maxDepth: depths.length ? `${round(Math.max(...depths))} m` : '—', averageDepth: h.averageDepthM.value == null ? '—' : `${round(h.averageDepthM.value)} m`, totalTime: formatMinutes(h.totalDiveTimeMin.value), longestDive: durations.length ? `${Math.max(...durations)} min` : '—', averageTime: durations.length ? `${round(durations.reduce((sum,value)=>sum+value,0)/durations.length)} min` : '—',
    bestSac: h.bestSacBarMin.value == null ? '—' : `${round(h.bestSacBarMin.value)} bar/min`, averageSac: h.averageSacBarMin.value == null ? '—' : `${round(h.averageSacBarMin.value)} bar/min`, bestRmv: h.bestRmvLMin.value == null ? '—' : `${round(h.bestRmvLMin.value)} L/min`, averageRmv: h.averageRmvLMin.value == null ? '—' : `${round(h.averageRmvLMin.value)} L/min`,
    highestRecCert: labelCertification(certificationFor(/open water|advanced|rescue|master scuba/)), highestTecCert: labelCertification(certificationFor(/tec|technical|trimix|decompression|extended range|ccr/)), highestProCert: labelCertification(certificationFor(/divemaster|dive master|instructor|course director/)),
    saltwaterDives: String(scopedDives.filter((dive)=>dive.waterType==='Saltwater').length), freshwaterDives: String(scopedDives.filter((dive)=>dive.waterType==='Freshwater').length), otherWaterDives: String(scopedDives.filter((dive)=>!['Saltwater','Freshwater'].includes(dive.waterType ?? '')).length),
    deep20: String(depths.filter((value)=>value>=20).length), deep25: String(depths.filter((value)=>value>=25).length), deep30: String(depths.filter((value)=>value>=30).length), deep35: String(depths.filter((value)=>value>=35).length), deep40: String(depths.filter((value)=>value>=40).length), poolDives: String(diveTypeCount(/pool/)), shoreDives: String(diveTypeCount(/shore/)), boatDives: String(diveTypeCount(/boat/)), nightDives: String(diveTypeCount(/night/)), wreckDives: String(diveTypeCount(/^wreck$/)), wreckPenetrationDives: String(diveTypeCount(/wreck penetration/)), cavernDives: String(diveTypeCount(/cavern/)), caveDives: String(diveTypeCount(/^cave$/)), unknownOtherDives: String(scopedDives.filter((dive)=>!(dive.diveTypes?.length)).length),
  };
  const orderedAwards = buildVisibleInsightAwards({
    definitions: INSIGHT_AWARD_DEFINITIONS,
    selectedAwardIds: awardIds,
    maxAwards: awardCount,
    values: awardValues,
  });
  const headlineCards = [
    [
      'total-dives',
      Gauge,
      'Total dives',
      h.totalDives.value == null ? '—' : String(h.totalDives.value),
      h.totalDives,
    ],
    [
      'total-time',
      Clock3,
      'Total dive time',
      formatMinutes(h.totalDiveTimeMin.value),
      h.totalDiveTimeMin,
    ],
    [
      'max-depth',
      BarChart3,
      'Max depth',
      h.maxDepthM.value == null ? '—' : `${round(h.maxDepthM.value)} m`,
      h.maxDepthM,
    ],
    [
      'average-depth',
      Waves,
      'Average depth',
      h.averageDepthM.value == null ? '—' : `${round(h.averageDepthM.value)} m`,
      h.averageDepthM,
    ],
    [
      'average-sac',
      Gauge,
      'Average SAC',
      h.averageSacBarMin.value == null
        ? '—'
        : `${round(h.averageSacBarMin.value)} bar/min`,
      h.averageSacBarMin,
    ],
    [
      'best-sac',
      BarChart3,
      'Best SAC',
      h.bestSacBarMin.value == null ? '—' : `${round(h.bestSacBarMin.value)} bar/min`,
      h.bestSacBarMin,
    ],
    [
      'recent-dives',
      CalendarDays,
      'Dives (last 90 days)',
      h.divesLast90Days.value == null ? '—' : String(h.divesLast90Days.value),
      h.divesLast90Days,
    ],
    ['average-rmv', Waves, 'Average RMV', h.averageRmvLMin.value == null ? '—' : `${round(h.averageRmvLMin.value)} L/min`, h.averageRmvLMin],
  ] as const;

  if(detail==='filters')return <AnalysisScopePanel value={scope} sites={sites} loadouts={loadouts} close={()=>setDetail(null)} apply={next=>{setScope(next);setDetail(null);}}/>;
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className="focus-heading-title">
          <ZeusTekAssetIcon name="core-logbook-icons-sac-rmv" size={64} fallback={<ZeusTekIcon id="sac-rmv" size="hero" />}/>
          <div>
          <span className="focus-eyebrow">ANALYTICS &amp; PROGRESS</span>
          <h1>Experience &amp; Analytics</h1>
          <p>
            See how your diving is evolving across depth, time, gas,
            environments and skills.
          </p>
          {projection.includedDiveIds.length !==
            projection.totalAvailableDives && (
            <button
              className={styles.scopeNotice}
              onClick={() => setDetail('filters')}
            >
              Analysing {projection.includedDiveIds.length} of{' '}
              {projection.totalAvailableDives} dives · review filters
            </button>
          )}
          </div>
        </div>
        <div className={styles.heroQuote}>
          Better divers through
          <br />
          better data.
          <i />
        </div>
      </header>

      <div className={styles.toolbar}>
        <button
          className="focus-secondary"
          onClick={() => setDetail('filters')}
        >
          <Settings2 size={16} />
          Analysis Scope
        </button>
        <button className="focus-secondary" onClick={()=>setScope(structuredClone(DEFAULT_ANALYSIS_SCOPE))}>Show all data</button>
        <button className="focus-primary" onClick={exportInsights}>
          <Download size={16} />
          Export insights
        </button>
      </div>

      <AnalysisScopeChips value={scope} change={setScope} sites={sites} loadouts={loadouts}/>
      <section className={styles.kpis} aria-label="Headline analytics">
        {!orderedAwards.length && <p className={styles.awardEmpty}>{insightAwardsEmptyState}</p>}
        {orderedAwards.map(({ id, label, value }) => {
          const headline = headlineCards.find(([kind]) => kind === id);
          const Icon = headline?.[1] ?? BarChart3;
          const observation = headline?.[4] ?? h.totalDives;
          const kind = headline?.[0] ?? 'total-dives';
          return (
          <button
            key={id}
            className={styles.kpi}
            onClick={() => setDetail(kind)}
            aria-label={`${label}: ${value}. Open analysis details.`}
          >
            <Icon />
            <span>{label}</span>
            <b>{value}</b>
            <small>
              {observation.denominator} source dive
              {observation.denominator === 1 ? '' : 's'}
            </small>
          </button>
        );})}
      </section>

      <AnalysisWorkbench cards={workbenchCards} saveCards={async cards=>{await saveWorkbenchSettings(cards);setWorkbenchCards(cards);}} scope={scope} changeScope={setScope} projection={projection} dives={dives} sites={sites} loadouts={loadouts} go={go}/>

      {detail && (
        <AnalyticsDetailDialog
          kind={detail}
          close={() => setDetail(null)}
          projection={projection}
          scope={scope}
          setScope={setScope}
          dives={dives}
          sites={sites}
          loadouts={loadouts}
          waterDepth={waterDepth}
          readinessCards={readinessCards}
          countProgress={countProgress}
          {...(go ? { go } : {})}
        />
      )}
    </main>
  );
}

function AnalyticsDetailDialog({
  kind,
  close,
  projection,
  scope,
  setScope,
  dives,
  sites,
  loadouts,
  waterDepth,
  readinessCards,
  countProgress,
  go,
}: {
  kind: DetailKind;
  close: () => void;
  projection: ExperienceAnalyticsProjection;
  scope: AnalysisScope;
  setScope: (scope: AnalysisScope) => void;
  dives: DiveWithId[];
  sites: Array<Stored<DiveSiteRecord>>;
  loadouts: Array<Stored<ReusableLoadoutRecord>>;
  waterDepth: ReturnType<typeof compareDepthBandsByWater>;
  readinessCards: ReadinessCard[];
  countProgress: CountProgress[];
  go?: (next: string) => void;
}) {
  if (kind === 'filters')
    return (
      <AnalysisScopePanel
        close={close}
        value={scope}
        apply={(next) => {
          setScope(next);
          close();
        }}
        sites={sites}
        loadouts={loadouts}
      />
    );
  const titles: Record<Exclude<DetailKind, 'filters'>, string> = {
    'total-dives': 'Total dives analysis',
    'total-time': 'Dive-time analysis',
    'max-depth': 'Maximum-depth analysis',
    'average-depth': 'Average-depth analysis',
    'average-sac': 'Average SAC analysis',
    'best-sac': 'Best SAC analysis',
    'average-rmv': 'Average RMV analysis',
    'recent-dives': 'Recent diving analysis',
    'depth-bands': 'Depth bands analysis',
    environment: 'Environment analysis',
    'sac-trend': 'SAC trend analysis',
    'rmv-trend': 'RMV trend analysis',
    equipment: 'Equipment-set usage',
    sites: 'Site frequency',
    qualifying: 'Qualifying-dive progress',
    readiness: 'Readiness & currency',
  };
  const sourceIds =
    kind === 'qualifying'
      ? [...new Set(countProgress.flatMap((row) => row.diveIds))]
      : detailSourceIds(kind, buildExperienceAnalyticsProjection(dives,sites,loadouts,{...scope,excludedDiveIds:[]}));
  const sourceDives = dives.filter((dive) => sourceIds.includes(dive.entityId));
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        label={titles[kind]}
        close={close}
        className={`focus-modal ${styles.detailDialog}`}
      >
        <header>
          <div>
            <span className="focus-eyebrow">ANALYTICS DETAIL</span>
            <h2>{titles[kind]}</h2>
            <p>
              {projection.includedDiveIds.length} of{' '}
              {projection.totalAvailableDives} dives in the active scope.
            </p>
            <small className={styles.scopeSummary}>
              Active scope: {analysisScopeSummary(scope)}
            </small>
          </div>
          <button
            className="focus-icon"
            onClick={close}
            aria-label="Close analysis"
          >
            <X />
          </button>
        </header>
        {kind === 'depth-bands' && (
          <section className={styles.detailPanel}>
            <h3>Saltwater vs freshwater</h3>
            <p>
              Depth is compared only where max depth is recorded. Missing depths
              are unknown, never zero.
            </p>
            <div aria-hidden="true">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={waterDepth}>
                  <CartesianGrid
                    stroke="rgba(255,255,255,.08)"
                    vertical={false}
                  />
                  <XAxis dataKey="label" tick={{ fill: '#a7b2bc' }} />
                  <YAxis tick={{ fill: '#a7b2bc' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#0a1115',
                      border: '1px solid #16435a',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="saltwater" name="Saltwater" fill="#08baf2" />
                  <Bar dataKey="freshwater" name="Freshwater" fill="#31d27c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <AccessibleDepthTable rows={waterDepth} />
            <div className={styles.applyRow}>
              <button
                className="focus-secondary"
                onClick={() => {
                  setScope({ ...scope, waterTypes: ['Saltwater'] });
                  close();
                }}
              >
                Apply Saltwater to dashboard
              </button>
              <button
                className="focus-secondary"
                onClick={() => {
                  setScope({ ...scope, waterTypes: ['Freshwater'] });
                  close();
                }}
              >
                Apply Freshwater to dashboard
              </button>
            </div>
          </section>
        )}
        {kind === 'sac-trend' && (
          <section className={styles.detailPanel}>
            <h3>Pressure SAC observations</h3>
            <p>
              {projection.headlines.averageSacBarMin.denominator} valid dive
              {projection.headlines.averageSacBarMin.denominator === 1 ? '' : 's'}
              ; {projection.headlines.averageSacBarMin.missingCount} scoped dive
              {projection.headlines.averageSacBarMin.missingCount === 1
                ? ''
                : 's'}{' '}
              excluded because pressure SAC evidence is missing.
            </p>
            <p>SAC is shown in bar/min and remains cylinder-specific. It is never relabelled as L/min.</p>
            <div className={styles.bigChart} aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid stroke="rgba(255,255,255,.08)" />
                  <XAxis dataKey="date" tick={{ fill: '#a7b2bc' }} />
                  <YAxis dataKey="sacBarMin" tick={{ fill: '#a7b2bc' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#0a1115',
                      border: '1px solid #16435a',
                    }}
                  />
                  <Scatter data={projection.sacTrend} fill="#08baf2" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <AccessibleRows
              rows={projection.sacTrend.map((row) => [
                `${row.date} · ${row.site}`,
                `${round(row.sacBarMin)} bar/min`,
                `${row.waterType} · ${row.training ? 'training' : 'non-training'} · ${row.depthM == null ? 'depth unknown' : `${row.depthM} m`}`,
              ])}
            />
          </section>
        )}
        {kind === 'rmv-trend' && (
          <section className={styles.detailPanel}>
            <h3>Surface-volume RMV observations</h3>
            <p>{projection.headlines.averageRmvLMin.denominator} valid dives; {projection.headlines.averageRmvLMin.missingCount} missing or non-qualifying. RMV is tank-independent L/min.</p>
            <div className={styles.bigChart} aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid stroke="rgba(255,255,255,.08)"/><XAxis dataKey="date" tick={{fill:'#a7b2bc'}}/><YAxis dataKey="rmvLMin" tick={{fill:'#a7b2bc'}}/><Tooltip contentStyle={{background:'#0a1115',border:'1px solid #16435a'}}/><Scatter data={projection.rmvTrend} fill="#ff8b1f"/></ScatterChart></ResponsiveContainer></div>
            <AccessibleRows rows={projection.rmvTrend.map((row)=>[`${row.date} · ${row.site}`,`${round(row.rmvLMin)} L/min`,`${row.waterType} · ${row.training?'training':'non-training'}`])}/>
          </section>
        )}
        {kind === 'environment' && (
          <>
            <section className={styles.detailPanel}>
              <h3>Water type</h3>
              <p>Salinity is kept separate from Dive activity.</p>
              <AccessibleRows
                rows={projection.waterTypeSplit.map((row) => [
                  row.label,
                  `${row.count} dives`,
                  `${row.percent}%`,
                ])}
              />
            </section>
            <section className={styles.detailPanel}>
              <h3>Dive environment / activity</h3>
              <p>
                Pool, quarry, boat, shore and similar activity labels come from
                each canonical Dive. Unrecorded activity remains unknown.
              </p>
              <AccessibleRows
                rows={projection.environmentSplit.map((row) => [
                  row.label,
                  `${row.count} dives`,
                  `${row.percent}%`,
                ])}
              />
            </section>
          </>
        )}
        {kind === 'equipment' && (
          <section className={styles.detailPanel}>
            <h3>Loadout usage</h3>
            <AccessibleRows
              rows={projection.equipmentSetUsage.map((row) => [
                row.name,
                `${row.dives} dives`,
                `${row.percent}%`,
              ])}
            />
            <button
              className="focus-secondary"
              onClick={() => go?.('Loadouts & Gas')}
            >
              Open Loadouts &amp; Gas
            </button>
          </section>
        )}
        {kind === 'sites' && (
          <section className={styles.detailPanel}>
            <h3>Site frequency</h3>
            <AccessibleRows
              rows={projection.siteUsage.map((row) => [
                row.name,
                `${row.dives} dives`,
                `${row.percent}%`,
              ])}
            />
            <div className={styles.recordLinks}>
              {projection.siteUsage
                .filter((row) => row.siteId)
                .map((row) => (
                  <a
                    className="focus-secondary"
                    href={recordHref('Sites', 'siteId', row.siteId!)}
                    key={row.siteId}
                  >
                    Open {row.name}
                  </a>
                ))}
            </div>
          </section>
        )}
        {kind === 'qualifying' && (
          <section className={styles.detailPanel}>
            <h3>Captured count requirements</h3>
            {countProgress.length ? (
              <div className={styles.qualifyingList}>
                {countProgress.map((row) => (
                  <article key={row.key}>
                    <h4>
                      {row.pathwayLabel} · {row.label}
                    </h4>
                    <p>
                      {row.current} / {row.target} ({row.percent}%) ·{' '}
                      {row.state.replace('_', ' ')}
                    </p>
                    <small>
                      Captured version: {row.versionLabel}. {row.detail}
                    </small>
                    {row.diveIds.length ? (
                      <div className={styles.recordLinks}>
                        {row.diveIds.map((id) => (
                          <a
                            className="focus-secondary"
                            href={recordHref('Logbook', 'diveId', id)}
                            key={id}
                          >
                            Open qualifying Dive
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p>No canonical Dives qualify in this scope.</p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p>
                No count-based requirements are configured. ZeusTek does not
                invent agency thresholds.
              </p>
            )}
          </section>
        )}
        {kind === 'readiness' && (
          <section className={styles.detailPanel}>
            <h3>Readiness / currency sources</h3>
            <AccessibleRows
              rows={readinessCards.map((row) => [
                row.label,
                row.valueLabel,
                row.detail,
              ])}
            />
            <p>
              Readiness is advisory and derived from captured requirement
              versions, Skill Evidence and Professional Evidence. Skill currency
              reflects its current recorded policy/evidence and is not rewritten
              by Dive-only dashboard filters. Readiness is not certification or
              medical clearance.
            </p>
            <p>
              Source IDs are retained in Export Insights for rebuildable
              provenance.
            </p>
          </section>
        )}
        {![
          'depth-bands',
          'sac-trend',
          'environment',
          'equipment',
          'sites',
          'qualifying',
          'readiness',
        ].includes(kind) && (
          <MetricDetail kind={kind} projection={projection} />
        )}
        {sourceDives.length > 0 && (
          <section className={styles.detailPanel}>
            <h3>Source dives</h3>
            <AnalysisSourceRecords dives={sourceDives} excludedIds={scope.excludedDiveIds} changeExcluded={excludedDiveIds=>setScope({...scope,excludedDiveIds})} go={go?route=>{close();go(route);}:undefined}/>
          </section>
        )}
        <footer>
          <button className="focus-secondary" onClick={close}>
            Close
          </button>
        </footer>
      </AccessibleDialog>
    </div>
  );
}

function MetricDetail({
  kind,
  projection,
}: {
  kind: Exclude<DetailKind, 'filters'>;
  projection: ExperienceAnalyticsProjection;
}) {
  const map = {
    'total-dives': projection.headlines.totalDives,
    'total-time': projection.headlines.totalDiveTimeMin,
    'max-depth': projection.headlines.maxDepthM,
    'average-depth': projection.headlines.averageDepthM,
    'average-sac': projection.headlines.averageSacBarMin,
    'best-sac': projection.headlines.bestSacBarMin,
    'average-rmv': projection.headlines.averageRmvLMin,
    'recent-dives': projection.headlines.divesLast90Days,
  } as const;
  const value = map[kind as keyof typeof map];
  return (
    <section className={styles.detailPanel}>
      <h3>Calculation</h3>
      <p>{value?.definition}</p>
      {value && (
        <dl>
          <div>
            <dt>Denominator</dt>
            <dd>{value.denominator} dives</dd>
          </div>
          <div>
            <dt>Missing/excluded for this metric</dt>
            <dd>{value.missingCount}</dd>
          </div>
          <div>
            <dt>Provenance</dt>
            <dd>Calculated from canonical Dive records</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function detailSourceIds(
  kind: Exclude<DetailKind, 'filters'>,
  projection: ExperienceAnalyticsProjection,
) {
  const map = {
    'total-dives': projection.headlines.totalDives.sourceDiveIds,
    'total-time': projection.headlines.totalDiveTimeMin.sourceDiveIds,
    'max-depth': projection.headlines.maxDepthM.sourceDiveIds,
    'average-depth': projection.headlines.averageDepthM.sourceDiveIds,
    'average-sac': projection.headlines.averageSacBarMin.sourceDiveIds,
    'best-sac': projection.headlines.bestSacBarMin.sourceDiveIds,
    'average-rmv': projection.headlines.averageRmvLMin.sourceDiveIds,
    'recent-dives': projection.headlines.divesLast90Days.sourceDiveIds,
    'depth-bands': projection.depthBands.flatMap((row) => row.diveIds),
    environment: projection.environmentSplit.flatMap((row) => row.diveIds),
    'sac-trend': projection.sacTrend.map((row) => row.diveId),
    'rmv-trend': projection.rmvTrend.map((row) => row.diveId),
    equipment: projection.equipmentSetUsage.flatMap((row) => row.diveIds),
    sites: projection.siteUsage.flatMap((row) => row.diveIds),
    qualifying: projection.includedDiveIds,
    readiness: projection.includedDiveIds,
  };
  return [...new Set(map[kind])];
}

function AccessibleRows({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <table className={styles.rows}>
      <tbody>
        {rows.map(([a, b, c]) => (
          <tr key={`${a}-${b}`}>
            <td>{a}</td>
            <td>
              <b>{b}</b>
            </td>
            <td>
              <small>{c}</small>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function AccessibleDepthTable({
  rows,
}: {
  rows: ReturnType<typeof compareDepthBandsByWater>;
}) {
  return (
    <AccessibleRows
      rows={rows.map((row) => [
        row.label,
        `${row.saltwater} saltwater`,
        `${row.freshwater} freshwater`,
      ])}
    />
  );
}
