'use client';
import { useEffect, useState } from 'react';
import {
  DEFAULT_CONDITIONS_SETTINGS,
  readConditionsSettings,
  saveConditionsSettings,
  mergeConditionsSettings,
  type WeatherConditionsSettings,
} from '../../lib/weather/conditions-settings';
import type {
  ConditionsProvider,
  ConditionsSelection,
  ProviderDiagnostic,
} from '../../lib/weather/conditions-model';
import type { WeatherProviderStatus } from '../../lib/weather/provider-contract';
import styles from './conditions.module.css';
export function ConditionsConfiguration() {
  const [settings, setSettings] = useState<WeatherConditionsSettings>(
    DEFAULT_CONDITIONS_SETTINGS,
  );
  const [providers, setProviders] = useState<WeatherProviderStatus[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    let active = true;
    void readConditionsSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => {
        if (active)
          setMessage(
            'Saved preferences could not be loaded. Default weather remains available.',
          );
      });
    void fetch('/api/weather/providers', { cache: 'no-store' })
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ providers: WeatherProviderStatus[] }>)
          : null,
      )
      .then((data: { providers: WeatherProviderStatus[] } | null) => {
        if (active && data) setProviders(data.providers);
      })
      .catch(() => {
        if (active)
          setMessage(
            'Provider status is unavailable. Existing settings are retained.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function check(id: string) {
    setBusy(id);
    setMessage('');
    try {
      const response = await fetch('/api/weather/providers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: id }),
      });
      const result = (await response.json()) as {
        result?: ProviderDiagnostic;
        providers?: WeatherProviderStatus[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? 'Provider check failed.');
      if (result.providers) setProviders(result.providers);
      setMessage(
        `${result.result?.message ?? 'Provider check finished.'}${result.result?.costAccesses !== undefined ? ` Accesses used: ${result.result.costAccesses}.` : ''}`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Provider could not be checked.',
      );
    } finally {
      setBusy('');
    }
  }
  async function save() {
    setBusy('save');
    try {
      await saveConditionsSettings(settings);
      setSettings(mergeConditionsSettings(undefined,settings).weatherConditions);
      setMessage(
        'Weather & Conditions preferences saved. Other configuration was preserved.',
      );
    } catch {
      setMessage(
        'Preferences could not be saved. Your choices remain here for retry.',
      );
    } finally {
      setBusy('');
    }
  }
  return (
    <section
      className={styles.configuration}
      aria-label="Weather and Conditions configuration"
    >
      <p>
        Open-Meteo remains the no-key default and fallback. Choose Auto to
        compare available sources by metric, location and freshness. Credential
        checks contact the selected provider only when you choose Check access.
      </p>
      <label>
        Default weather provider
        <select
          value={settings.defaultProvider}
          onChange={(e) =>
            setSettings({
              ...settings,
              defaultProvider: e.target.value as ConditionsSelection,
            })
          }
        >
          {providers.map((row) => (
            <option
              value={row.id}
              key={row.id}
              disabled={
                !row.enabled ||
                settings.disabledProviders.includes(
                  row.id as ConditionsProvider,
                )
              }
            >
              {row.label}
              {row.enabled ? '' : ' · unavailable'}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={!settings.disabledProviders.includes('operator')}
          onChange={(e) =>
            setSettings({
              ...settings,
              disabledProviders: e.target.checked
                ? settings.disabledProviders.filter((id) => id !== 'operator')
                : [...settings.disabledProviders, 'operator'],
            })
          }
        />
        Include official operator conditions when the Site matches
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.includeSiteReferences}
          onChange={(e) =>
            setSettings({
              ...settings,
              includeSiteReferences: e.target.checked,
            })
          }
        />
        Include site-reference lookups on explicit refresh
      </label>
      <ul className={styles.diagnostics}>
        {providers
          .filter((row) => row.id !== 'auto')
          .map((row) => (
            <li key={row.id}>
              <b>{row.label}</b>
              <span>
                {row.configured ? 'Configured' : 'Not configured'} ·{' '}
                {row.status ?? (row.enabled ? 'available' : 'disabled')}
              </span>
              <span>{row.reason}</span>
              {row.lastCheckedAt && <small>Checked {row.lastCheckedAt}</small>}
              {row.id !== 'open-meteo' && (
                <div className={styles.row}>
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        !settings.disabledProviders.includes(
                          row.id as ConditionsProvider,
                        )
                      }
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          disabledProviders: e.target.checked
                            ? settings.disabledProviders.filter(
                                (id) => id !== row.id,
                              )
                            : [
                                ...settings.disabledProviders,
                                row.id as ConditionsProvider,
                              ],
                        })
                      }
                    />
                    Allow when available
                  </label>
                  {row.configured && (
                    <button
                      type="button"
                      className="focus-secondary"
                      disabled={Boolean(busy)}
                      onClick={() => void check(row.id)}
                    >
                      {busy === row.id ? 'Checking…' : 'Check access'}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
      </ul>
      <details>
        <summary>Operator and specialist sources</summary>
        <p>
          Capernwray uses its official public conditions feed. Ellerton Park,
          Stoney Cove and Vobster use bounded, low-frequency reads of their
          published conditions. Missing observation times and unknown
          measurement depths remain visible.
        </p>
        <p>
          PickADive provides read-only site facts. DiveNumber supplies sites
          within the credential’s configured region. Copernicus depth samples
          require a server-side subset service; SwellCloud remains unavailable
          until provider approval and verified access.
        </p>
      </details>
      <details>
        <summary>Server configuration guidance</summary>
        <p>
          Credentials are configured only in server bindings. No credential
          values are displayed or accepted by this page. Met Office requires a
          Global Spot subscription; an Atmospheric Models subscription does not
          establish Global Spot access.
        </p>
        <p>
          Xweather checks make a bounded atmospheric and marine request. Exact
          access charges are shown when returned by the provider. A successful
          access check remains valid for up to 24 hours across server restarts.
          Credential changes require a new check; only a non-reversible fingerprint and redacted status are stored.
        </p>
      </details>
      <button
        type="button"
        className="focus-primary"
        disabled={Boolean(busy)}
        onClick={() => void save()}
      >
        {busy === 'save' ? 'Saving…' : 'Save weather preferences'}
      </button>
      {message && <output className={styles.notice}>{message}</output>}
    </section>
  );
}
