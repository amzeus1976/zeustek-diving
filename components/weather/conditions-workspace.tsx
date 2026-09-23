'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { DiveSiteRecord } from '../../lib/offline/dive-planning';
import type { DiveRecord } from '../../lib/offline/dives';
import { currentDiveAccount } from '../../lib/offline/dive-store';
import {WorkflowLink} from '../shared/workflow-link';
import { readLocalConditionsEvidence } from '../../lib/weather/local-evidence';
import type { ComputerProfileRecord } from '../../lib/offline/computer-import';
import {
  fetchConditions,
  conditionsCacheKey,
} from '../../lib/weather/conditions-client';
import {
  readConditionsCache,
  readOperatorHistory,
} from '../../lib/weather/conditions-cache';
import {
  actualDiveConditions,
  actualDeviceConditions,
} from '../../lib/weather/actual-dive-conditions';
import {
  DEFAULT_CONDITIONS_SETTINGS,
  readConditionsSettings,
} from '../../lib/weather/conditions-settings';
import {
  LatestWeatherRequest,
  type WeatherProviderStatus,
} from '../../lib/weather/provider-contract';
import type {
  ConditionReading,
  ConditionsRequest,
  ConditionsSelection,
  ConditionsSnapshot,
} from '../../lib/weather/conditions-model';
import { ConditionsView } from './conditions-view';
import styles from './conditions.module.css';
export function ConditionsWorkspace({
  site,
}: {
  site: DiveSiteRecord & { entityId?: string };
}) {
  const [clock, setClock] = useState(() => new Date().toISOString());
  const [profiles, setProfiles] = useState<
    Array<ComputerProfileRecord & { entityId: string }>
  >([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('12:00');
  const [provider, setProvider] = useState<ConditionsSelection>('open-meteo');
  const [settings, setSettings] = useState(DEFAULT_CONDITIONS_SETTINGS);
  const [providers, setProviders] = useState<WeatherProviderStatus[]>([
    {
      id: 'open-meteo',
      label: 'Open-Meteo atmospheric + marine',
      enabled: true,
    },
    { id: 'auto', label: 'Auto · choose by metric', enabled: true },
  ]);
  const [includeFacts, setIncludeFacts] = useState(false);
  const [snapshot, setSnapshot] = useState<ConditionsSnapshot | null>(null);
  const [history, setHistory] = useState<ConditionReading[]>([]);
  const [dives, setDives] = useState<Array<DiveRecord & { entityId: string }>>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [requests] = useState(() => new LatestWeatherRequest());
  const coastal =
    ['shore', 'boat', 'wreck', 'sea'].includes(site.siteType ?? '') ||
    site.waterType === 'salt';
  const account = currentDiveAccount();
  const validCoords =
    site.latitude !== null &&
    site.latitude !== undefined &&
    site.longitude !== null &&
    site.longitude !== undefined;
  const mode =
    date < clock.slice(0, 10)
      ? 'historical'
      : Date.parse(date) - Date.parse(clock) > 6 * 86400000
        ? 'seasonal'
        : 'forecast';
  const request: ConditionsRequest = {
    latitude: site.latitude ?? 0,
    longitude: site.longitude ?? 0,
    siteId: site.entityId ?? `${site.latitude},${site.longitude}`,
    siteName: site.name,
    siteType: coastal
      ? 'coastal'
      : site.waterType === 'fresh' ||
          ['quarry', 'lake', 'inland'].includes(site.siteType ?? '')
        ? 'inland'
        : 'unknown',
    provider,
    date,
    time,
    mode,
    marine: coastal,
    disabledProviders: settings.disabledProviders,
  };
  const key = conditionsCacheKey(request);
  const requestJson = JSON.stringify(request);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toISOString()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    void readConditionsSettings()
      .then((value) => {
        if (active) {
          setSettings(value);
          setProvider(value.defaultProvider);
          setIncludeFacts(value.includeSiteReferences);
        }
      })
      .catch(() => {});
    void fetch('/api/weather/providers', { cache: 'no-store' })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ providers: WeatherProviderStatus[] }>)
          : null,
      )
      .then((data: { providers: WeatherProviderStatus[] } | null) => {
        if (active && data) setProviders(data.providers);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    requests.invalidate();
    const current = JSON.parse(requestJson) as ConditionsRequest;
    void readConditionsCache(account, current)
      .then((value) => {
        if (active) {
          setSnapshot(value);
          setMessage('');
          setBusy(false);
        }
      })
      .catch(() => {
        if (active) setSnapshot(null);
      });
    void readOperatorHistory(account, current.siteId)
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch(() => {});
    // Cached canonical Dives only: this read cannot repair, backfill or sync an owner record.
    void readLocalConditionsEvidence(account)
      .then((value) => {
        if (active) {
          setDives(value.dives);
          setProfiles(value.profiles);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      requests.invalidate();
    };
  }, [requestJson, account, requests]);
  async function refresh() {
    if (!validCoords) return;
    const active = requests.begin(key);
    setBusy(true);
    setMessage('');
    try {
      const result = await fetchConditions(
        account,
        request,
        active.signal,
        includeFacts,
      );
      if (requests.accepts(active, key)) {
        const nextHistory = await readOperatorHistory(account, request.siteId).catch(() => []);
        if (!requests.accepts(active, key)) return;
        setSnapshot(result);
        setHistory(nextHistory);
        setMessage(
          result.offline
            ? 'Refresh unavailable; cached conditions retained.'
            : 'Conditions refreshed. No Site or Dive records were changed.',
        );
      }
    } catch (error) {
      if (requests.accepts(active, key))
        setMessage(
          error instanceof Error
            ? error.message
            : 'Conditions are unavailable.',
        );
    } finally {
      if (requests.accepts(active, key)) setBusy(false);
    }
  }
  const now = clock;
  const actual = [
    ...actualDiveConditions(dives, request, now),
    ...actualDeviceConditions(dives, profiles, request, now),
  ];
  const shown = snapshot ?? {
    version: 1 as const,
    request,
    retrievedAt: now,
    readings: [],
    diagnostics: [],
  };
  return (
    <section
      className={styles.workspace}
      aria-label="Site weather and conditions"
    >
      <div className={styles.controls}>
        <label>
          Conditions date
          <input
            type="date"
            value={date}
            onChange={(e) => {
              requests.invalidate();
              setDate(e.target.value);
            }}
          />
        </label>
        <label>
          Conditions time
          <input
            type="time"
            value={time}
            onChange={(e) => {
              requests.invalidate();
              setTime(e.target.value);
            }}
          />
        </label>
        <label>
          Conditions provider
          <select
            value={provider}
            onChange={(e) => {
              requests.invalidate();
              setProvider(e.target.value as ConditionsSelection);
            }}
          >
            {providers.map((option) => (
              <option
                key={option.id}
                value={option.id}
                disabled={
                  !option.enabled ||
                  settings.disabledProviders.includes(option.id as never)
                }
              >
                {option.label}
                {!option.enabled ? ' · unavailable' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="focus-primary"
          disabled={!validCoords || busy || !date || !time}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {busy ? 'Getting conditions…' : 'Get weather'}
        </button>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={includeFacts}
            onChange={(e) => setIncludeFacts(e.target.checked)}
          />
          Include read-only site references from PickADive / DiveNumber
        </label>
      </div>
      {!validCoords && (
        <p className={styles.notice}>
          Add Site coordinates to request weather. Recorded Site details remain
          available.
        </p>
      )}
      {message && <output className={styles.notice}>{message}</output>}
      <ConditionsView
        snapshot={shown}
        actual={actual}
        history={history}
        now={clock}
      />
      <p className={styles.note}>
        Refresh is explicit. Previously retrieved conditions and operator
        history are available offline.{' '}
        <WorkflowLink href="/?section=Settings&config=weather-conditions">
          Weather &amp; Conditions settings
        </WorkflowLink>
      </p>
    </section>
  );
}
