'use client';
import {WorkflowLink} from '../shared/workflow-link';
import {
  Droplets,
  Thermometer,
  Waves,
  CloudSun,
  Wind,
  History,
  ExternalLink,
} from 'lucide-react';
import {
  CONDITION_LABELS,
  conditionFreshness,
  conditionWallTime,
  depthLabel,
  selectConditions,
  type ConditionReading,
  type ConditionsSnapshot,
  type ConditionMetric,
} from '../../lib/weather/conditions-model';
import styles from './conditions.module.css';
import { workflowDestinationUrl } from '../../lib/workflow/workflow-destination';
function timeLabel(value: string | null) {
  if (!value) return 'Observation time not supplied';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return value.replace('T', ' ').replace('.000Z', ' UTC').replace(/Z$/, ' UTC');
}
function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
export function ConditionTile({
  reading,
  now,
}: {
  reading: ConditionReading;
  now: string;
}) {
  const freshness = conditionFreshness(reading, now);
  const url = safeUrl(reading.url);
  const water = ['water-temperature', 'visibility'].includes(reading.metric);
  return (
    <article className={`${styles.tile} ${water ? styles.water : ''}`}>
      <span className={styles.metric}>{CONDITION_LABELS[reading.metric]}</span>
      <strong>
        {typeof reading.value === 'number'
          ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(
              reading.value,
            )
          : reading.value}
        {reading.unit !== 'text' && <span> {reading.unit}</span>}
      </strong>
      {water && <b className={styles.depth}>{depthLabel(reading.depth)}</b>}
      {reading.metric === 'sea-level' && (
        <b className={styles.depth}>Datum: {reading.datum ?? 'unknown'}</b>
      )}
      <small>
        {reading.label} · {reading.classification}
      </small>
      <small className={freshness === 'stale' ? styles.stale : styles.fresh}>
        {freshness === 'fresh'
          ? 'Recent retrieval / source time'
          : freshness === 'stale'
            ? 'Stale — check locally'
            : 'Observation time not supplied'}
      </small>
      <details>
        <summary>Source &amp; freshness</summary>
        <dl>
          <dt>Source time</dt>
          <dd>{timeLabel(reading.observedAt ?? reading.validAt)}</dd>
          <dt>Retrieved</dt>
          <dd>{timeLabel(reading.retrievedAt)}</dd>
          <dt>Time basis</dt>
          <dd>{reading.timeZone ?? 'Not supplied'}</dd>
          <dt>Location</dt>
          <dd>
            {reading.latitude.toFixed(4)}, {reading.longitude.toFixed(4)}
          </dd>
          <dt>Resolution</dt>
          <dd>{reading.resolution}</dd>
          {reading.station && (
            <>
              <dt>Station / site</dt>
              <dd>{reading.station}</dd>
            </>
          )}
          {reading.model && (
            <>
              <dt>Model</dt>
              <dd>{reading.model}</dd>
            </>
          )}
          {reading.modelRunAt && (
            <>
              <dt>Model run</dt>
              <dd>{timeLabel(reading.modelRunAt)}</dd>
            </>
          )}
          {reading.detail && (
            <>
              <dt>Notes</dt>
              <dd>{reading.detail}</dd>
            </>
          )}
        </dl>
        {url && (
          <a href={url} target="_blank" rel="noreferrer">
            {reading.attribution ?? reading.label}{' '}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
        {reading.sourceRecordId && (
          <WorkflowLink
            href={workflowDestinationUrl({
              route: 'Logbook',
              recordId: reading.sourceRecordId,
            })}
          >
            Open source Dive
          </WorkflowLink>
        )}
      </details>
    </article>
  );
}
const groups: Array<{
  name: string;
  icon: typeof Waves;
  metrics: ConditionMetric[];
}> = [
  { name: 'Water', icon: Thermometer, metrics: ['water-temperature'] },
  {
    name: 'Dive conditions',
    icon: Droplets,
    metrics: ['visibility', 'site-status'],
  },
  {
    name: 'Surface weather',
    icon: CloudSun,
    metrics: [
      'air-temperature',
      'feels-like',
      'weather',
      'wind-speed',
      'wind-gust',
      'wind-direction',
      'rain',
      'air-visibility',
    ],
  },
  {
    name: 'Marine conditions',
    icon: Waves,
    metrics: ['wave-height', 'wave-period', 'wave-direction', 'swell-height'],
  },
  {
    name: 'Tide / current',
    icon: Wind,
    metrics: ['current-speed', 'current-direction', 'sea-level'],
  },
];
export function ConditionsView({
  snapshot,
  actual = [],
  history = [],
  now = new Date().toISOString(),
}: {
  snapshot: ConditionsSnapshot;
  actual?: ConditionReading[];
  history?: ConditionReading[];
  now?: string;
}) {
  const all = [...snapshot.readings, ...actual];
  const selected = selectConditions(all, snapshot.request, now);
  const days = [
    ...new Set(
      snapshot.readings
        .filter((row) => row.classification === 'forecast')
        .map((row) => conditionWallTime(row)?.slice(0, 10))
        .filter((date): date is string => Boolean(date)),
    ),
  ]
    .sort()
    .slice(0, 7);
  const observations = [
    ...new Map(
      [
        ...actual,
        ...history,
        ...snapshot.readings.filter((row) => row.classification === 'observed'),
      ].map((row) => [`${row.id}:${row.value}`, row]),
    ).values(),
  ]
    .sort((a, b) =>
      (b.observedAt ?? b.retrievedAt).localeCompare(
        a.observedAt ?? a.retrievedAt,
      ),
    )
    .slice(0, 100);
  const attribution = [
    ...new Map(
      snapshot.readings
        .filter((row) => row.attribution)
        .map((row) => [
          row.attribution,
          { label: row.attribution!, url: safeUrl(row.url) },
        ]),
    ).values(),
  ];
  return (
    <section
      className={styles.conditions}
      aria-label="Water and dive conditions"
    >
      <div className={styles.heading}>
        <div>
          <span>WEATHER &amp; CONDITIONS</span>
          <h3>{snapshot.request.siteName || 'Selected Site'}</h3>
          <p>
            {snapshot.request.mode === 'seasonal'
              ? 'Regional seasonal context'
              : `${snapshot.request.date} · ${snapshot.request.time}`}{' '}
            ·{' '}
            {snapshot.request.timeZone ?? 'Times use the source’s stated basis'}
          </p>
        </div>
        <Waves aria-hidden="true" />
      </div>
      {snapshot.offline && (
        <output className={styles.notice}>
          Showing the last successful local snapshot. Its original source and
          retrieval times are retained.
        </output>
      )}
      <p className={styles.note}>
        Surface temperature does not describe temperature at depth. Verify
        conditions locally before diving.
      </p>
      {groups
        .filter(
          (group) =>
            snapshot.request.marine ||
            !['Marine conditions', 'Tide / current'].includes(group.name),
        )
        .map((group) => {
          const rows = selected.filter((row) =>
            group.metrics.includes(row.metric),
          );
          return (
            <section key={group.name} className={styles.group}>
              <h4>
                <group.icon size={18} aria-hidden="true" />
                {group.name}
              </h4>
              {rows.length ? (
                <div className={styles.grid}>
                  {rows.map((row) => (
                    <ConditionTile key={row.id} reading={row} now={now} />
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>
                  {group.name === 'Water'
                    ? 'No water temperature is available from the selected sources.'
                    : group.name === 'Dive conditions'
                      ? 'No current underwater visibility or operator notice was supplied.'
                      : 'No readings cover this requested place and time.'}
                </p>
              )}
            </section>
          );
        })}
      {snapshot.request.plannedDepthM !== undefined &&
        !selected.some(
          (row) =>
            row.metric === 'water-temperature' &&
            ((row.depth.kind === 'exact' &&
              row.depth.metres === snapshot.request.plannedDepthM) ||
              (row.depth.kind === 'band' &&
                row.depth.minimumM <= snapshot.request.plannedDepthM! &&
                (row.depth.maximumM === null ||
                  row.depth.maximumM >= snapshot.request.plannedDepthM!))),
        ) && (
          <p className={styles.notice}>
            Temperature at the planned {snapshot.request.plannedDepthM} m depth
            is unknown.
          </p>
        )}
      <details className={styles.detail}>
        <summary>
          Forecast ·{' '}
          {days.length
            ? `${days.length} days`
            : 'no date-specific forecast available'}
        </summary>
        <div className={styles.forecast}>
          {days.map((date) => {
            const readings = selectConditions(
              snapshot.readings,
              { ...snapshot.request, date, time: '12:00' },
              now,
            ).filter((row) =>
              [
                'air-temperature',
                'water-temperature',
                'wave-height',
                'wind-speed',
              ].includes(row.metric),
            );
            return (
              <article key={date}>
                <b>{date} · around midday</b>
                {readings.map((row) => (
                  <div key={row.id}>
                    {CONDITION_LABELS[row.metric]}
                    {row.metric === 'water-temperature'
                      ? ` (${depthLabel(row.depth)})`
                      : ''}
                    :{' '}
                    <b>
                      {row.value} {row.unit}
                    </b>
                    <small>
                      {row.label} ·{' '}
                      {conditionFreshness(row, now) === 'stale'
                        ? 'stale'
                        : 'forecast'}{' '}
                      · {timeLabel(row.validAt)}
                    </small>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      </details>
      <details className={styles.detail}>
        <summary>
          <History size={16} aria-hidden="true" />
          Historical / recent observations · {observations.length}
        </summary>
        <p>
          Actual logged observations and operator reports remain separate from
          forecasts. Viewing them does not change Dive records.
        </p>
        <div className={styles.grid}>
          {observations.map((row) => (
            <ConditionTile
              key={`${row.id}:${row.value}`}
              reading={row}
              now={now}
            />
          ))}
        </div>
      </details>
      <details className={styles.detail}>
        <summary>Sources, alternatives &amp; provider status</summary>
        <p>
          Sources may disagree. Values are kept separately; tidal datums and
          model values are never averaged.
        </p>
        <ul className={styles.diagnostics}>
          {snapshot.diagnostics.map((row, index) => (
            <li key={`${row.provider}:${index}`}>
              <b>
                {row.provider} · {row.status}
              </b>
              <span>{row.message}</span>
              <small>
                {timeLabel(row.retrievedAt)}
                {row.costAccesses !== undefined
                  ? ` · ${row.costAccesses} provider accesses`
                  : ''}
              </small>
            </li>
          ))}
        </ul>
        <div className={styles.grid}>
          {all
            .filter(
              (row) =>
                !selected.some((winner) => winner.id === row.id) &&
                (row.classification === 'observed' ||
                  conditionWallTime(row)?.slice(0, 10) ===
                    snapshot.request.date),
            )
            .slice(0, 80)
            .map((row, index) => (
              <ConditionTile
                key={`${row.id}:${index}`}
                reading={row}
                now={now}
              />
            ))}
        </div>
      </details>
      {!!snapshot.enrichment?.length && (
        <section className={styles.group}>
          <h4>Site references</h4>
          <p>
            Read-only reference results; no changes have been made to this Site.
          </p>
          <div className={styles.grid}>
            {snapshot.enrichment.map((site, index) => (
              <article
                className={styles.tile}
                key={`${site.provider}:${index}`}
              >
                <b>{site.name}</b>
                {site.maxDepthM !== null && (
                  <p>Published maximum depth: {site.maxDepthM} m</p>
                )}
                {site.access && <p>Access: {site.access}</p>}
                {site.difficulty && <p>Difficulty: {site.difficulty}</p>}
                {site.hazards && <p>Published hazards: {site.hazards}</p>}
                <small>
                  {site.attribution} · retrieved {timeLabel(site.retrievedAt)}
                </small>
                {safeUrl(site.url) && (
                  <a href={site.url} target="_blank" rel="noreferrer">
                    Open source
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      <footer className={styles.attribution}>
        {attribution.map((source) =>
          source.url ? (
            <a
              key={source.label}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.label}
            </a>
          ) : (
            <span key={source.label}>{source.label}</span>
          ),
        )}
      </footer>
    </section>
  );
}
