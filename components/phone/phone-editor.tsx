'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import {
  commitPhoneDraft,
  savePhoneDraft,
  reviewPhoneDraft,
  applyPhoneDraftReview,
  type PhoneDraft,
  type PhoneDraftReview,
} from '../../lib/phone/phone-drafts';
import {
  phoneGasInput,
  updatePhoneTeam,
  updatePhoneSchedule,
} from '../../lib/phone/planning';
import type { PhoneData } from '../../lib/phone/phone-data';
import type { JsonValue } from '../../lib/offline/types';
import type {
  RecreationalGasInput,
  RecreationalGasSnapshot,
} from '../../lib/offline/recreational-gas-planner';
import type {
  PlanTextDocument,
  PlanTextFormats,
} from '../../lib/planning/formatted-text';
import { RichTextField } from '../planning/rich-text-field';
import { ProfilePicture } from '../profile-picture';
import type { CardImage } from '../../lib/offline/dive-images';
import { chooseDiveEntity, diveEntityChoices } from '../../lib/operators/dive-log-selection';
import { GasSummary, SavedFields } from './phone-app';
// Vite generates the default URL export for this bundled worker asset.
// oxlint-disable-next-line import/default
import gasCalculationUrl from '../../lib/phone/gas-calculation.worker?worker&url';
import styles from './phone.module.css';

type Props = {
  initial: PhoneDraft;
  data: PhoneData;
  editable: boolean;
  registerLeave: (action: () => Promise<void>) => void;
  close: () => void;
  saved: () => Promise<void>;
  addPerson: () => void;
  addCentre: () => void;
  full: () => void;
};
const readable = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const numeric = (value: string) => (value.trim() === '' ? null : Number(value));
const kindLabel = (kind: PhoneDraft['kind']) =>
  kind === 'trip'
    ? 'Dive Plan'
    : kind === 'gas-plan'
      ? 'Gas Plan'
      : kind === 'person'
        ? 'Person'
        : kind === 'operator'
          ? 'Dive Centre'
          : 'Dive';
function Section({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open}>
      <summary>{title}</summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}

export function PhoneEditor({
  initial,
  data,
  editable,
  registerLeave,
  close,
  saved,
  addPerson,
  addCentre,
  full,
}: Props) {
  const [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('Draft saved on this device.');
  const live = useRef(initial),
    writes = useRef<Promise<void>>(Promise.resolve()),
    worker = useRef<Worker | null>(null),
    calculationId = useRef(0),
    cancelCalculation = useRef<(() => void) | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [review, setReview] = useState<PhoneDraftReview>();
  const record = draft.record,
    disabled = !editable || busy;
  const persist = useCallback((value: PhoneDraft) => {
    const work = writes.current
      .catch(() => {})
      .then(() => savePhoneDraft(value));
    writes.current = work;
    void work.then(
      () => setNotice('Draft saved on this device.'),
      (cause) => {
        setNotice('Draft could not be saved.');
        setError(
          cause instanceof Error
            ? cause.message
            : 'Device storage is full or unavailable. Keep this page open and export your draft.',
        );
      },
    );
    return work;
  }, []);
  const flush = useCallback(() => persist(live.current), [persist]);
  useEffect(() => {
    registerLeave(flush);
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush().catch(() => {});
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush, registerLeave]);
  useEffect(
    () => () => {
      cancelCalculation.current?.();
      worker.current?.terminate();
    },
    [],
  );
  function patch(update: Record<string, JsonValue>) {
    const next = {
      ...live.current,
      record: { ...live.current.record, ...update },
      savedAt: new Date().toISOString(),
    };
    live.current = next;
    setDraft(next);
    setNotice('Saving draft here…');
    void persist(next);
  }
  const text = (key: string) =>
    typeof record[key] === 'string' ? String(record[key]) : '';
  const array = (key: string) =>
    Array.isArray(record[key]) ? (record[key] as JsonValue[]) : [];
  const object = (key: string) =>
    record[key] &&
    typeof record[key] === 'object' &&
    !Array.isArray(record[key])
      ? (record[key] as Record<string, JsonValue>)
      : {};
  function input(key: string, title: string, type = 'text', help?: string) {
    return (
      <label className={styles.field} key={key}>
        {title}
        <input
          type={type}
          value={
            type === 'number'
              ? typeof record[key] === 'number'
                ? String(record[key])
                : ''
              : text(key)
          }
          onChange={(e) =>
            patch(
              draft.kind === 'trip' &&
                (key === 'startDate' || key === 'startAt')
                ? updatePhoneSchedule(record, key, e.target.value)
                : {
                    [key]:
                      type === 'number'
                        ? numeric(e.target.value)
                        : e.target.value,
                  },
            )
          }
        />
        {help && <small>{help}</small>}
      </label>
    );
  }
  function area(key: string, title: string) {
    return (
      <label className={styles.field} key={key}>
        {title}
        <textarea
          value={text(key)}
          onChange={(e) =>
            patch({
              [key]: e.target.value,
              ...(key === 'role'
                ? {
                    roles: {
                      ...object('roles'),
                      buddy: e.target.value !== 'instructor',
                      instructor: e.target.value !== 'buddy',
                    },
                  }
                : {}),
            })
          }
        />
      </label>
    );
  }
  function select(
    key: string,
    title: string,
    choices: Array<[string, string]>,
  ) {
    return (
      <label className={styles.field}>
        {title}
        <select
          value={text(key)}
          onChange={(e) =>
            patch({
              [key]: e.target.value,
              ...(key === 'role'
                ? {
                    roles: {
                      ...object('roles'),
                      buddy: e.target.value !== 'instructor',
                      instructor: e.target.value !== 'buddy',
                    },
                  }
                : {}),
            })
          }
        >
          {choices.map(([value, name]) => (
            <option value={value} key={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function check(key: string, title: string) {
    return (
      <label className={styles.check} key={key}>
        <input
          type="checkbox"
          checked={record[key] === true}
          onChange={(e) => patch({ [key]: e.target.checked })}
        />
        {title}
      </label>
    );
  }
  function lines(key: string, title: string) {
    return (
      <label className={styles.field}>
        {title}
        <textarea
          value={array(key)
            .filter((item) => typeof item === 'string')
            .join('\n')}
          onChange={(e) => patch({ [key]: e.target.value.split('\n') })}
        />
        <small>One item per line.</small>
      </label>
    );
  }
  function flags(key: string, choices: Array<[string, string]>) {
    return choices.map(([value, name]) => (
      <label key={value} className={styles.check}>
        <input
          type="checkbox"
          checked={object(key)[value] === true}
          onChange={(e) =>
            patch({ [key]: { ...object(key), [value]: e.target.checked } })
          }
        />
        {name}
      </label>
    ));
  }
  function rich(key: string, title: string) {
    const formats = record.textFormatting as unknown as
      | PlanTextFormats
      | undefined;
    return (
      <RichTextField
        label={title}
        value={text(key)}
        document={formats?.[key]}
        onChange={(value: string, document: PlanTextDocument | undefined) =>
          patch({
            [key]: value,
            textFormatting: {
              ...formats,
              [key]: document,
            } as unknown as JsonValue,
          })
        }
      />
    );
  }
  function choosePeople(key: string, title: string, team = false) {
    const ids = [
      ...new Set([
        ...(array(key).filter((item) => typeof item === 'string') as string[]),
        ...(team
          ? (array('planTeam')
              .map((item) => (item as Record<string, JsonValue>).personId)
              .filter((item) => typeof item === 'string') as string[])
          : []),
      ]),
    ];
    return (
      <Section title={title}>
        {!data.people.length && <p className={styles.muted}>Sync &amp; download brings your existing People to this phone. You can also add a new Person here.</p>}
        <div className={styles.rows}>
          {data.people.map((person) => (
            <label className={styles.check} key={person.entityId}>
              <input
                type="checkbox"
                checked={ids.includes(person.entityId)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...ids, person.entityId]
                    : ids.filter((id) => id !== person.entityId);
                  patch({
                    [key]: next,
                    ...(team
                      ? {
                          planTeam: updatePhoneTeam(
                            record,
                            next,
                            data.people
                              .filter((person) => person.roles?.ownerProfile)
                              .map((person) => person.entityId),
                          ),
                          personIds: next,
                        }
                      : { diveTeamIds: next }),
                  });
                }}
              />
              <span>
                {person.name}
                <small>
                  {' '}
                  · {person.roles?.ownerProfile ? 'Self' : person.role}
                </small>
              </span>
            </label>
          ))}
        </div>
        {ids.filter(
          (id) => !data.people.some((person) => person.entityId === id),
        ).length > 0 && (
          <p className={styles.warning}>
            A saved team member is not downloaded. Its existing reference is
            retained.
          </p>
        )}
        <button type="button" onClick={addPerson}>
          <Plus />
          Add Person
        </button>
      </Section>
    );
  }
  function centres() {
    const ids = array('diveCentreIds').filter(
      (item) => typeof item === 'string',
    ) as string[];
    return (
      <Section title="Dive Centre contacts">
        {!data.operators.length && <p className={styles.muted}>Sync &amp; download brings your existing Dive Centres to this phone.</p>}
        <div className={styles.rows}>
          {data.operators.map((centre) => (
            <label className={styles.check} key={centre.entityId}>
              <input
                type="checkbox"
                checked={ids.includes(centre.entityId)}
                onChange={(e) =>
                  patch({
                    diveCentreIds: e.target.checked
                      ? [...ids, centre.entityId]
                      : ids.filter((id) => id !== centre.entityId),
                  })
                }
              />
              <span>
                {centre.name}
                <small>{centre.phone ? ' · ' + centre.phone : ''}</small>
              </span>
            </label>
          ))}
        </div>
        <button type="button" onClick={addCentre}>
          <Plus />
          Add Dive Centre
        </button>
      </Section>
    );
  }
  function loggedDiveCentre() {
    const previous = { name: text('operator'), ...(text('operatorId') ? { id: text('operatorId') } : {}) };
    const choices = diveEntityChoices(data.operators, 'operator', previous);
    return <Section title="Dive Centre / operator">
      <label className={styles.field}>Saved Dive Centre / operator
        <select value={previous.id ? `entity:${previous.id}` : previous.name ? 'legacy' : ''} onChange={event => {
          const selected = chooseDiveEntity(event.target.value, choices, previous);
          patch({ operatorId: selected.id || null, operator: selected.name });
        }}>
          <option value="">Choose a Dive Centre / operator</option>
          {choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </select>
      </label>
      {!data.operators.length && <p className={styles.muted}>Sync &amp; download brings your existing Dive Centres to this phone.</p>}
      <button type="button" onClick={addCentre}><Plus />Add Dive Centre</button>
    </Section>;
  }
  const gasInput = phoneGasInput(record);
  const snapshot = record.recGasPlan101 as unknown as
    | RecreationalGasSnapshot
    | undefined;
  function changeGas(update: Partial<RecreationalGasInput>) {
    calculationId.current++;
    cancelCalculation.current?.();
    setCalculating(false);
    patch({
      phoneGasInput: {
        ...gasInput,
        ...update,
        ...(update.ownRmvLMin !== undefined
          ? {
              ownRmvSource:
                update.ownRmvLMin != null ? 'owner-entered' : 'unknown',
            }
          : {}),
        ...(update.buddyRmvLMin !== undefined
          ? {
              buddyRmvSource:
                update.buddyRmvLMin != null ? 'owner-entered' : 'unknown',
            }
          : {}),
      } as unknown as JsonValue,
      recGasPlan101: null,
      warnings: [],
      ...(update.plannedDepthM !== undefined
        ? { plannedDepthM: update.plannedDepthM }
        : {}),
      ...(update.plannedWorkingTimeMin !== undefined
        ? { plannedBottomTimeMin: update.plannedWorkingTimeMin }
        : {}),
    });
  }
  function gasNumber(
    key: keyof RecreationalGasInput,
    title: string,
    locked = false,
  ) {
    const value = gasInput[key];
    return (
      <label className={styles.field}>
        {title}
        <input
          type="number"
          inputMode="decimal"
          disabled={locked}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => changeGas({ [key]: numeric(e.target.value) })}
        />
      </label>
    );
  }
  async function calculate(): Promise<RecreationalGasSnapshot> {
    setCalculating(true);
    setError('');
    const id = ++calculationId.current;
    try {
      if (!worker.current)
        worker.current = new Worker(
          new URL(gasCalculationUrl, window.location.origin),
          { type: 'module' },
        );
    } catch {
      setCalculating(false);
      throw new Error(
        'The calculation could not load. Refresh the offline app download when online; your inputs remain saved.',
      );
    }
    return new Promise((resolve, reject) => {
      const current = worker.current!;
      const stop = (cause: Error) => {
        clearTimeout(timeout);
        current.removeEventListener('message', received);
        current.removeEventListener('error', failed);
        cancelCalculation.current = null;
        setCalculating(false);
        reject(cause);
      };
      const received = (
        event: MessageEvent<{
          id: number;
          snapshot?: RecreationalGasSnapshot;
          error?: string;
        }>,
      ) => {
        if (event.data.id !== id) return;
        if (event.data.error) {
          stop(new Error(event.data.error));
          return;
        }
        if (event.data.snapshot) {
          const result = event.data.snapshot;
          clearTimeout(timeout);
          current.removeEventListener('message', received);
          current.removeEventListener('error', failed);
          cancelCalculation.current = null;
          setCalculating(false);
          if (calculationId.current !== id) {
            reject(new Error('The inputs changed. Calculate again.'));
            return;
          }
          patch({
            phoneGasInput: gasInput as unknown as JsonValue,
            recGasPlan101: result as unknown as JsonValue,
            warnings: result.warnings,
            plannedDepthM: result.plannedDepthM,
            plannedBottomTimeMin: result.plannedWorkingTimeMin,
            rmvRateLitresMin: result.ownRmvLMin,
            rmvSource: 'manual',
          });
          resolve(result);
        }
      };
      const failed = () =>
        stop(
          new Error(
            'The calculation could not load. Stay online and refresh the offline app download.',
          ),
        );
      const timeout = setTimeout(
        () =>
          stop(
            new Error(
              'The calculation did not finish. Your inputs remain saved.',
            ),
          ),
        45000,
      );
      cancelCalculation.current = () =>
        stop(new Error('Calculation cancelled; inputs are retained.'));
      current.addEventListener('message', received);
      current.addEventListener('error', failed);
      current.postMessage({ id, input: gasInput });
    });
  }
  async function save() {
    if (disabled || calculating) return;
    setBusy(true);
    setError('');
    try {
      if (draft.kind === 'gas-plan' && !snapshot)
        await calculate();
      await flush();
      await commitPhoneDraft(live.current);
      await saved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The record could not be saved. The device draft is retained.',
      );
      if (
        draft.entityId &&
        cause instanceof Error &&
        cause.message.includes('changed since')
      ) {
        try {
          setReview(await reviewPhoneDraft(live.current));
        } catch (problem) {
          setError(
            problem instanceof Error
              ? problem.message
              : 'The latest version could not be read.',
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.editor}>
      <header className={styles.panelHeader}>
        <button
          className={styles.back}
          type="button"
          disabled={busy}
          aria-label="Back; retain draft"
          onClick={close}
        >
          <ArrowLeft />
        </button>
        <h1>
          {draft.entityId ? 'Edit' : 'New'} {kindLabel(draft.kind)}
        </h1>
      </header>
      <output className={styles.notice}>{notice}</output>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {review && (
        <section className={styles.card}>
          <h2>Review newer saved version</h2>
          <p>
            Your draft and the latest record are both retained. Untouched fields
            keep their latest values.
          </p>
          {review.conflicts.length > 0 && (
            <p className={styles.warning}>
              Both versions changed: {review.conflicts.join(', ')}. Applying
              your draft keeps your entries for these fields.
            </p>
          )}
          <Section title="Latest saved version">
            <SavedFields value={review.latest} />
          </Section>
          <Section title="Your draft">
            <SavedFields value={draft.record} />
          </Section>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              void (async () => {
                try {
                  await writes.current;
                  const next = await applyPhoneDraftReview(
                    live.current,
                    review,
                  );
                  live.current = next;
                  setDraft(next);
                  setReview(undefined);
                  setError('');
                  setNotice(
                    'Versions retained. Review your merged draft, then Save.',
                  );
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : 'The review could not be saved.',
                  );
                }
              })()
            }
          >
            Apply draft changes to latest record
          </button>
        </section>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={disabled || !!review}>
          {draft.kind === 'trip' && (
            <>
              <Section title="Dive basics" open>
                {input('name', 'Plan name')}
                <div className={styles.fields}>
                  {input('startDate', 'Planned date', 'date')}
                  {input('startAt', 'Planned start', 'datetime-local')}
                  {input(
                    'plannedMaxDepthM',
                    'Planned maximum depth (m)',
                    'number',
                  )}
                  {input(
                    'plannedDurationMin',
                    'Planned duration (min)',
                    'number',
                  )}
                </div>
                <label className={styles.field}>
                  Site
                  <select
                    value={text('siteId')}
                    onChange={(e) => {
                      const site = data.sites.find(
                        (item) => item.entityId === e.target.value,
                      );
                      patch({
                        siteId: e.target.value,
                        siteName: site?.name || '',
                      });
                    }}
                  >
                    <option value="">Choose a downloaded Site</option>
                    {text('siteId') &&
                      !data.sites.some(
                        (item) => item.entityId === text('siteId'),
                      ) && (
                        <option value={text('siteId')}>
                          Saved Site (not downloaded)
                        </option>
                      )}
                    {data.sites.map((site) => (
                      <option key={site.entityId} value={site.entityId}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </label>
                {input('siteName', 'Site name (if not listed)')}
                <label className={styles.field}>
                  Trip (optional)
                  <select
                    value={text('tripId')}
                    onChange={(e) => patch({ tripId: e.target.value || null })}
                  >
                    <option value="">No linked Trip</option>
                    {data.trips.map((trip) => (
                      <option key={trip.entityId} value={trip.entityId}>
                        {trip.name}
                      </option>
                    ))}
                  </select>
                </label>
              </Section>
              <Section title="Aim, goals & notes" open>
                {rich('aim', 'Aim')}
                {lines('goals', 'Goals')}
                {rich('notes', 'Plan notes')}
              </Section>
              {choosePeople('personIds', 'Diving team', true)}
              {centres()}
              <Section title="Equipment & checks">
                <div className={styles.rows}>
                  {data.equipment.map((item) => (
                    <label className={styles.check} key={item.entityId}>
                      <input
                        type="checkbox"
                        checked={array('equipmentIds').includes(item.entityId)}
                        onChange={(e) =>
                          patch({
                            equipmentIds: e.target.checked
                              ? [...array('equipmentIds'), item.entityId]
                              : array('equipmentIds').filter(
                                  (id) => id !== item.entityId,
                                ),
                          })
                        }
                      />
                      {readable(item.name) || 'Equipment'}
                    </label>
                  ))}
                </div>
                {Array.isArray(record.checklist) &&
                  record.checklist.map((item, index) => {
                    const row = item as Record<string, JsonValue>;
                    return (
                      <label className={styles.check} key={readable(row.id)}>
                        <input
                          type="checkbox"
                          checked={row.completed === true}
                          onChange={(e) =>
                            patch({
                              checklist: array('checklist').map((current, i) =>
                                i === index
                                  ? { ...row, completed: e.target.checked }
                                  : current,
                              ),
                            })
                          }
                        />
                        {readable(row.label)}
                      </label>
                    );
                  })}
              </Section>
              <Section title="Safety & emergency">
                <label className={styles.field}>
                  Key risks
                  <textarea
                    value={
                      Array.isArray(object('humanFactors').keyRisks)
                        ? (object('humanFactors').keyRisks as string[]).join(
                            '\n',
                          )
                        : ''
                    }
                    onChange={(e) =>
                      patch({
                        humanFactors: {
                          ...object('humanFactors'),
                          keyRisks: e.target.value.split('\n'),
                        },
                      })
                    }
                  />
                </label>
                <label className={styles.field}>
                  Stop / abort criteria
                  <textarea
                    value={
                      Array.isArray(object('humanFactors').stopAbortCriteria)
                        ? (
                            object('humanFactors').stopAbortCriteria as string[]
                          ).join('\n')
                        : ''
                    }
                    onChange={(e) =>
                      patch({
                        humanFactors: {
                          ...object('humanFactors'),
                          stopAbortCriteria: e.target.value.split('\n'),
                        },
                      })
                    }
                  />
                </label>
                {[
                  ['emergencyContact', 'Emergency contact'],
                  ['oxygenFirstAid', 'Oxygen & first aid'],
                  ['evacuation', 'Evacuation arrangements'],
                ].map(([key, title]) => (
                  <label className={styles.field} key={key}>
                    {title}
                    <textarea
                      value={readable(object('emergency')[key!])}
                      onChange={(e) =>
                        patch({
                          emergency: {
                            ...object('emergency'),
                            [key!]: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </Section>
            </>
          )}
          {draft.kind === 'gas-plan' && (
            <>
              <Section title="Basic Gas Plan" open>
                {input('name', 'Gas Plan name')}
                <label className={styles.field}>
                  Linked Dive Plan
                  <select
                    value={text('divePlanId')}
                    onChange={(e) =>
                      patch({ divePlanId: e.target.value || null })
                    }
                  >
                    <option value="">Standalone Gas Plan</option>
                    {text('divePlanId') &&
                      !data.plans.some(
                        (item) => item.entityId === text('divePlanId'),
                      ) && (
                        <option value={text('divePlanId')}>
                          Saved plan (not downloaded)
                        </option>
                      )}
                    {data.plans.map((plan) => (
                      <option key={plan.entityId} value={plan.entityId}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className={styles.muted}>
                  Recreational no-stop, direct ascent. Saved results use the
                  same engine as desktop.
                </p>
                <div className={styles.fields}>
                  {gasNumber('plannedDepthM', 'Planned depth (m)')}
                  {gasNumber('plannedWorkingTimeMin', 'Working time (min)')}
                  {gasNumber(
                    'cylinderWaterVolumeL',
                    'Cylinder volume (litres)',
                    gasInput.cylinderSourceMode !== 'manual',
                  )}
                  {gasNumber(
                    'startPressureBar',
                    'Start pressure (bar)',
                    gasInput.cylinderSourceMode !== 'manual',
                  )}
                  {gasNumber('ownRmvLMin', 'Your RMV (L/min)')}
                  {gasNumber('buddyRmvLMin', 'Buddy RMV (L/min)')}
                </div>
                {gasInput.cylinderSourceMode !== 'manual' && (
                  <>
                    <p className={styles.muted}>
                      Saved cylinder:{' '}
                      {gasInput.cylinderSourceLabel ||
                        gasInput.cylinderSourceMode}
                      . Its fill evidence is retained.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        changeGas({
                          cylinderSourceMode: 'manual',
                          cylinderSourceId: null,
                          cylinderSourceLabel: 'Owner-entered cylinder',
                          pressureSource: 'Owner-entered planning pressure',
                          fillProvenance: [],
                          analysisProvenance: null,
                          analysedGases: [],
                          customGas: null,
                          selectedGasLabel: 'Air / EAN21',
                          sourceWarnings: [],
                        });
                        patch({ cylinders: [] });
                      }}
                    >
                      Use manually entered cylinder instead
                    </button>
                  </>
                )}
                <label className={styles.field}>
                  Gas
                  <select
                    value={gasInput.selectedGasLabel}
                    onChange={(e) =>
                      changeGas({
                        selectedGasLabel: e.target.value,
                        analysedGases: [],
                        customGas: null,
                      })
                    }
                  >
                    {![
                      'Air / EAN21',
                      'EAN28',
                      'EAN30',
                      'EAN32',
                      'EAN36',
                    ].includes(gasInput.selectedGasLabel) && (
                      <option value={gasInput.selectedGasLabel}>
                        {gasInput.selectedGasLabel}
                      </option>
                    )}
                    {['Air / EAN21', 'EAN28', 'EAN30', 'EAN32', 'EAN36'].map(
                      (gas) => (
                        <option key={gas}>{gas}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={gasInput.repetitiveDive === true}
                    onChange={(e) =>
                      changeGas({ repetitiveDive: e.target.checked })
                    }
                  />
                  Earlier dive / residual loading unknown
                </label>
              </Section>
              <Section title="Limits & assumptions">
                <div className={styles.fields}>
                  {gasNumber('maxPpo2', 'PPO₂ limit (bar)')}
                  {gasNumber('conservatismM', 'Depth conservatism (m)')}
                  {gasNumber(
                    'ownerMaxDurationMin',
                    'Your maximum duration (min)',
                  )}
                  {gasNumber('ascentRateMMin', 'Ascent rate (m/min)')}
                  {gasNumber('gfLow', 'GF Low (%)')}
                  {gasNumber('gfHigh', 'GF High (%)')}
                </div>
                <label className={styles.field}>
                  Water
                  <select
                    value={gasInput.waterType}
                    onChange={(e) =>
                      changeGas({
                        waterType: e.target.value as 'salt' | 'fresh',
                      })
                    }
                  >
                    <option value="salt">Salt water</option>
                    <option value="fresh">Fresh water</option>
                  </select>
                </label>
                <label className={styles.field}>
                  Model
                  <select
                    value={gasInput.selectedBuhlmannModel}
                    onChange={(e) =>
                      changeGas({
                        selectedBuhlmannModel: e.target.value as
                          | 'ZH-L16B'
                          | 'ZH-L16C',
                      })
                    }
                  >
                    <option>ZH-L16C</option>
                    <option>ZH-L16B</option>
                  </select>
                </label>
                <label className={styles.field}>
                  Reserve
                  <select
                    value={gasInput.reserveStrategy}
                    onChange={(e) =>
                      changeGas({
                        reserveStrategy: e.target
                          .value as RecreationalGasInput['reserveStrategy'],
                      })
                    }
                  >
                    <option value="most-conservative">
                      Most conservative: calculated / thirds
                    </option>
                    <option value="calculated">
                      Calculated emergency reserve
                    </option>
                    <option value="thirds">Thirds</option>
                  </select>
                </label>
                <p className={styles.muted}>
                  Unanalysed presets remain labelled. Unknown RMV or supply
                  values do not produce a ready assessment.
                </p>
              </Section>
              <button
                className={styles.wide}
                type="button"
                disabled={calculating}
                onClick={() =>
                  void calculate().catch((cause) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : 'Calculation failed.',
                    ),
                  )
                }
              >
                {calculating ? 'Calculating…' : 'Calculate / update results'}
              </button>
              <Section title="Results & warnings" open>
                <GasSummary snapshot={snapshot} />
                {snapshot?.readinessReasons.length ? (
                  <ul>
                    {snapshot.readinessReasons.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.muted}>
                    Calculate after changing the inputs.
                  </p>
                )}
              </Section>
              <Section title="Notes">{area('notes', 'Gas Plan notes')}</Section>
            </>
          )}
          {draft.kind === 'dive' && (
            <>
              <Section title="Actual dive" open>
                <div className={styles.fields}>
                  {input('date', 'Dive date', 'date')}
                  {input('diveNumber', 'Logbook number (optional)', 'number')}
                  {input('timeIn', 'Time in', 'time')}
                  {input('timeOut', 'Time out', 'time')}
                </div>
                <label className={styles.field}>
                  Site
                  <select
                    value={text('siteId')}
                    onChange={(e) => {
                      const site = data.sites.find(
                        (item) => item.entityId === e.target.value,
                      );
                      patch({ siteId: e.target.value, site: site?.name || '' });
                    }}
                  >
                    <option value="">Choose a downloaded Site</option>
                    {data.sites.map((site) => (
                      <option key={site.entityId} value={site.entityId}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </label>
                {input('site', 'Site name')}
                <div className={styles.fields}>
                  {input('maxDepthM', 'Actual maximum depth (m)', 'number')}
                  {input('bottomTimeMin', 'Bottom time (min)', 'number')}
                  {input(
                    'totalElapsedMin',
                    'Elapsed dive time (min)',
                    'number',
                  )}
                  {input('gas', 'Actual gas')}
                </div>
                <p className={styles.muted}>
                  Actual depth, time and gas are entered separately from the
                  saved plan. Saving keeps existing Dive numbers and IDs.
                </p>
              </Section>
              {choosePeople('buddyIds', 'Buddies & team')}
              {loggedDiveCentre()}
              <Section title="Conditions & notes">
                <div className={styles.fields}>
                  {input('visibilityM', 'Underwater visibility (m)', 'number')}
                  {input(
                    'minimumTemperatureC',
                    'Water temperature (°C)',
                    'number',
                  )}
                  {input('waveHeightM', 'Wave height (m)', 'number')}
                  {input('currentStrength', 'Current')}
                </div>
                {area('notes', 'Dive notes')}
                {area('personalNotes', 'Personal notes')}
              </Section>
            </>
          )}
          {draft.kind === 'person' && (
            <>
              <Section title="Name & roles" open>
                {input('name', 'Full name / display name')}
                <div className={styles.fields}>
                  {input('forename', 'First name')}
                  {input('surname', 'Surname')}
                </div>
                {input('displayName', 'Preferred display name')}
                {select('role', 'Diving role', [
                  ['buddy', 'Buddy'],
                  ['instructor', 'Instructor'],
                  ['both', 'Buddy & instructor'],
                ])}
                {flags('roles', [
                  ['buddy', 'Buddy'],
                  ['instructor', 'Instructor'],
                  ['diveOperator', 'Dive operator'],
                  ['diveCentre', 'Dive Centre'],
                  ['boatCharter', 'Boat charter'],
                  ['guide', 'Guide'],
                  ['emergencyContact', 'Emergency contact'],
                  ['other', 'Other'],
                ])}
                {check('favourite', 'Favourite')}
                {record.roles && object('roles').ownerProfile === true && (
                  <p className={styles.muted}>Self / owner profile</p>
                )}
              </Section>
              <Section title="Contact details" open>
                <div className={styles.fields}>
                  {input('phone', 'Phone', 'tel')}
                  {input('email', 'Email', 'email')}
                </div>
                {input('address', 'Street address')}
                {input('location', 'Town / region / country')}
                {input('postcode', 'Postcode')}
                {input('profileUrl', 'Profile URL', 'url')}
                {select('contactVisibility', 'Contact visibility', [
                  ['private', 'Private'],
                  ['household', 'Household'],
                  ['planning', 'Planning'],
                ])}
              </Section>
              <Section title="Emergency contacts">
                <div className={styles.fields}>
                  {input('emergencyContactName', 'Emergency contact name')}
                  {input('emergencyContactNumber', 'Emergency number', 'tel')}
                </div>
                {area('emergencyContact', 'Emergency contact details')}
              </Section>
              <Section title="Qualifications & capability">
                {input('agency', 'Agency')}
                {input('membershipNumber', 'Membership / certification number')}
                {input('highestQualification', 'Highest qualification')}
                {input(
                  'highestKnownQualification',
                  'Highest known qualification',
                )}
                {input(
                  'highestRecreationalCertification',
                  'Recreational certification',
                )}
                {input(
                  'highestTechnicalCertification',
                  'Technical certification',
                )}
                {input(
                  'highestProfessionalCertification',
                  'Professional certification',
                )}
                {input(
                  'maxAllowedDepthM',
                  'Recorded depth limit (m)',
                  'number',
                  'Owner-entered evidence; not inferred from a name.',
                )}
                {select('maxAllowedDepthSource', 'Depth limit source', [
                  ['unknown', 'Unknown'],
                  ['owner-entered', 'Owner entered'],
                  ['certification-derived', 'Certification evidence'],
                  ['auto', 'Auto'],
                ])}
                {flags('certificationFlags', [
                  ['deep', 'Deep'],
                  ['wreck', 'Wreck'],
                  ['wreckPenetration', 'Wreck penetration'],
                  ['drysuit', 'Drysuit'],
                  ['nitrox', 'Nitrox'],
                  ['trimix', 'Trimix'],
                  ['cavern', 'Cavern'],
                  ['cave', 'Cave'],
                  ['tec40', 'Tec 40'],
                  ['tec45', 'Tec 45'],
                  ['tec50', 'Tec 50'],
                  ['tec65Plus', 'Tec 65+'],
                  ['rescue', 'Rescue'],
                  ['divemaster', 'Divemaster'],
                  ['instructor', 'Instructor'],
                ])}
                {area(
                  'certificationEvidenceNotes',
                  'Certification evidence notes',
                )}
              </Section>
              <Section title="Instructor details">
                {input('instructorAgency', 'Instructor agency')}
                {input('instructorNumber', 'Instructor number')}
                {input('instructorPhone', 'Instructor phone', 'tel')}
                {input('instructorEmail', 'Instructor email', 'email')}
                {input('instructorUrl', 'Instructor website', 'url')}
                {lines('instructorSpecialties', 'Instructor specialties')}
                {check('instructorActive', 'Instructor active')}
                {area('instructorNotes', 'Instructor notes')}
              </Section>
              <Section title="Dive Centre / affiliation">
                <label className={styles.field}>
                  Current Dive Centre
                  <select
                    value={text('currentDiveOperatorId')}
                    onChange={(e) =>
                      patch({
                        currentDiveOperatorId: e.target.value,
                        operatorId: e.target.value,
                      })
                    }
                  >
                    <option value="">None</option>
                    {data.operators.map((item) => (
                      <option key={item.entityId} value={item.entityId}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                {input('operatorName', 'Saved organisation name')}
                {select('operatorType', 'Organisation type', [
                  ['', 'Unspecified'],
                  ['dive-centre', 'Dive Centre'],
                  ['liveaboard', 'Liveaboard'],
                  ['charter-boat', 'Charter boat'],
                  ['club', 'Club'],
                  ['independent-instructor', 'Independent instructor'],
                  ['resort', 'Resort'],
                  ['other', 'Other'],
                ])}
                {input('website', 'Organisation website', 'url')}
                {input('operatorPhone', 'Organisation phone', 'tel')}
                {input('operatorEmail', 'Organisation email', 'email')}
                {input('operatorAddress', 'Organisation address')}
                {input('operatorPostcode', 'Organisation postcode')}
                {input('operatorLocation', 'Organisation location')}
                {input('bookingUrl', 'Booking URL', 'url')}
                {input(
                  'operatorEmergencyContact',
                  'Organisation emergency contact',
                )}
                {area('operatorNotes', 'Organisation notes')}
              </Section>
              <Section title="Profile photo">
                <ProfilePicture
                  value={
                    (record.profileImage as unknown as CardImage | null) || null
                  }
                  legacyId={text('profileImageId')}
                  change={(image) =>
                    patch({ profileImage: image as unknown as JsonValue })
                  }
                  removeLegacy={() => patch({ profileImageId: '' })}
                />
              </Section>
              <Section title="Notes">{area('notes', 'Person notes')}</Section>
            </>
          )}
          {draft.kind === 'operator' && (
            <>
              <Section title="Dive Centre details" open>
                {input('name', 'Centre / organisation name')}
                {input('tradingName', 'Trading name')}
                {select('operatorType', 'Organisation type', [
                  ['dive-centre', 'Dive Centre'],
                  ['dive-resort', 'Dive resort'],
                  ['dive-boat', 'Dive boat'],
                  ['liveaboard', 'Liveaboard'],
                  ['charter-operator', 'Charter operator'],
                  ['dive-school', 'Dive school'],
                  ['dive-club', 'Dive club'],
                  ['dive-shop', 'Dive shop'],
                  ['dive-operator', 'Dive operator'],
                  ['dive-accommodation', 'Dive accommodation'],
                  ['resort', 'Resort'],
                  ['charter-boat', 'Charter boat'],
                  ['club', 'Club'],
                  ['independent-instructor', 'Independent instructor'],
                  ['gas-fill-station', 'Gas fill station'],
                  ['other', 'Other'],
                ])}
                {input('otherSubtype', 'Other subtype')}
                {check('active', 'Active')}
                {check('favourite', 'Favourite')}
              </Section>
              <Section title="Contact & booking" open>
                {input('phone', 'Phone', 'tel')}
                {input('email', 'Email', 'email')}
                {input('emergencyPhone', 'Emergency phone', 'tel')}
                {input('website', 'Website', 'url')}
                {input('bookingUrl', 'Booking URL', 'url')}
              </Section>
              <Section title="Address & location">
                {input('streetAddress', 'Street address')}
                <div className={styles.fields}>
                  {input('town', 'Town')}
                  {input('region', 'Region')}
                  {input('country', 'Country')}
                  {input('postcode', 'Postcode')}
                </div>
                {input('location', 'Location summary')}
                <div className={styles.fields}>
                  {input('latitude', 'Latitude', 'number')}
                  {input('longitude', 'Longitude', 'number')}
                </div>
              </Section>
              <Section title="Agencies & services">
                {lines('agencies', 'Agencies')}
                {flags('services', [
                  ['training', 'Training'],
                  ['equipmentRental', 'Equipment rental'],
                  ['equipmentService', 'Equipment servicing'],
                  ['cylinderTesting', 'Cylinder testing'],
                  ['airFills', 'Air fills'],
                  ['nitroxFills', 'Nitrox fills'],
                  ['trimixFills', 'Trimix fills'],
                  ['oxygenFills', 'Oxygen fills'],
                  ['boatDiving', 'Boat diving'],
                  ['shoreDiving', 'Shore diving'],
                  ['accommodation', 'Accommodation'],
                ])}
              </Section>
              <Section title="Profile photo">
                <ProfilePicture
                  value={
                    (record.profileImage as unknown as CardImage | null) || null
                  }
                  legacyId=""
                  change={(image) =>
                    patch({ profileImage: image as unknown as JsonValue })
                  }
                  removeLegacy={() => {}}
                  recordLabel="Dive Centre"
                />
              </Section>
              <Section title="Notes">{area('notes', 'Centre notes')}</Section>
            </>
          )}
          <button
            className={`${styles.primary} ${styles.wide}`}
            type="submit"
            disabled={calculating}
          >
            {busy ? 'Saving…' : `Save ${kindLabel(draft.kind)} on this device`}
            <Save aria-hidden />
          </button>
        </fieldset>
      </form>
      {(draft.kind === 'trip' || draft.kind === 'gas-plan') && (
        <button
          className={styles.wide}
          type="button"
          disabled={busy || !draft.entityId}
          onClick={full}
        >
          Use desktop version for full functionality
        </button>
      )}
      <p className={styles.muted}>
        {(draft.kind === 'trip' || draft.kind === 'gas-plan') &&
          'Save and sync a new plan before opening it in the full interface. '}
        Closing this editor retains its draft. Sync &amp; download uploads saved records
        when you are online.
      </p>
    </div>
  );
}
