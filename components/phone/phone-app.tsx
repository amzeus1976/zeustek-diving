'use client';
/* oxlint-disable next/no-img-element -- Exact, precached brand images work without an image server when offline. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  MoreHorizontal,
  Phone,
  Plus,
  Ship,
  Users,
  UserPlus,
  Waves,
  Wifi,
} from 'lucide-react';
import {
  configureDiveStore,
  pendingDiveChanges,
} from '../../lib/offline/dive-store';
import {
  EMPTY_PHONE_DATA,
  initialPhoneDay,
  linkedPhoneGasPlans,
  loadPhoneData,
  phoneDate,
  phoneDownloadStatus,
  phoneTimeline,
  missingPhoneReferences,
  planDay,
  synchronizePhoneRecords,
  tripForPhoneDay,
  type PhoneData,
} from '../../lib/phone/phone-data';
import {
  rememberPhoneAccount,
  forgetPhoneAccount,
} from '../../lib/phone/offline-access';
import { phoneWorkerMessage } from '../../lib/phone/offline-shell';
import {
  listPhoneDrafts,
  listPhoneDraftReviews,
  readPhoneDraft,
  savePhoneDraft,
  type PhoneDraft,
  type PhoneDraftKind,
} from '../../lib/phone/phone-drafts';
import {
  basicGasEditable,
  basicPlanEditable,
  basicGasInput,
  phoneGasInput,
} from '../../lib/phone/planning';
import {
  duplicateDivePlanDraft,
  duplicateGasPlanDraft,
} from '../../lib/planning/duplicate-plans';
import { createDiveDraftFromPlan } from '../../lib/offline/dive-context';
import { FormattedPlanText } from '../planning/formatted-plan-text';
import { DiveConflictReview } from '../dive-conflict-review';
import {
  conflictExportPayload,
  syncReviewSummary,
  reviewRecordSnapshot,
} from '../../lib/offline/sync-review';
import {
  saveInterfaceMode,
  readInterfaceMode,
  type InterfaceMode,
} from '../../lib/phone/interface-mode';
import type { JsonValue } from '../../lib/offline/types';
import { PhoneEditor } from './phone-editor';
import styles from './phone.module.css';

type Tab = 'day' | 'plans' | 'logbook' | 'people' | 'more';
type Screen =
  | { kind: 'tab'; tab: Tab }
  | {
      kind: 'plan' | 'gas' | 'trip' | 'event' | 'person' | 'operator' | 'dive';
      id: string;
    }
  | { kind: 'equipment' | 'centres' }
  | { kind: 'edit'; draft: PhoneDraft };
const subscribeOnline = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};
const subscribeKeyboard = (callback: () => void) => {
  window.visualViewport?.addEventListener('resize', callback);
  return () => window.visualViewport?.removeEventListener('resize', callback);
};
const readable = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
const tabs: Array<{ id: Tab; label: string; icon: typeof CalendarDays }> = [
  { id: 'day', label: 'Dive day', icon: CalendarDays },
  { id: 'plans', label: 'Plans', icon: FileText },
  { id: 'logbook', label: 'Logbook', icon: BookOpen },
  { id: 'people', label: 'People', icon: Users },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];
const label = (kind: PhoneDraftKind) =>
  kind === 'trip'
    ? 'Dive Plan'
    : kind === 'gas-plan'
      ? 'Gas Plan'
      : kind === 'person'
        ? 'Person'
        : kind === 'operator'
          ? 'Dive Centre'
          : 'Dive';
const jsonRecord = (record: unknown) =>
  JSON.parse(JSON.stringify(record)) as Record<string, JsonValue>;
const stamp = (value: string | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not downloaded';
function Row({
  icon: Icon,
  title,
  subtitle,
  action,
  onClick,
  disabled = false,
  image,
}: {
  icon: typeof FileText;
  title: string;
  subtitle?: string | undefined;
  action?: string;
  onClick: () => void;
  disabled?: boolean;
  image?: string | undefined;
}) {
  return (
    <button
      className={styles.row}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {image ? (
        <img className={styles.rowImage} src={image} alt="" />
      ) : (
        <Icon aria-hidden />
      )}
      <span>
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
        {action && <em>{action}</em>}
      </span>
      <ChevronRight aria-hidden />
    </button>
  );
}
function Detail({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  const [expanded, setExpanded] = useState(open);
  return (
    <details
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      {expanded && <div className={styles.body}>{children}</div>}
    </details>
  );
}
function Facts({ items }: { items: Array<[string, unknown]> }) {
  return (
    <dl>
      {items
        .filter(
          ([, value]) => value !== undefined && value !== null && value !== '',
        )
        .map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>
              {typeof value === 'boolean'
                ? value
                  ? 'Yes'
                  : 'No'
                : readable(value)}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function SavedFieldList({ items, depth }: { items: unknown[]; depth: number }) {
  const [page, setPage] = useState(0);
  const size = 20;
  const pages = Math.ceil(items.length / size);
  const current = Math.min(page, pages - 1);
  return (
    <>
      <p className={styles.muted}>
        Items {current * size + 1}–
        {Math.min((current + 1) * size, items.length)} of {items.length}
      </p>
      <ul>
        {items
          .slice(current * size, (current + 1) * size)
          .map((item, index) => (
            <li key={current * size + index}>
              <SavedFields value={item} depth={depth + 1} />
            </li>
          ))}
      </ul>
      <div className={styles.actions}>
        <button disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous items
        </button>
        <button
          disabled={current + 1 === pages}
          onClick={() => setPage(current + 1)}
        >
          Next items
        </button>
      </div>
    </>
  );
}
export function SavedFields({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}) {
  if (value == null || value === '')
    return <span className={styles.muted}>Not recorded</span>;
  if (typeof value !== 'object')
    return (
      <>
        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : readable(value)}
      </>
    );
  if (Array.isArray(value))
    return value.length > 20 ? (
      <SavedFieldList items={value} depth={depth} />
    ) : value.length ? (
      <ul>
        {value.map((item, index) => (
          <li key={index}>
            <SavedFields value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    ) : (
      <span className={styles.muted}>None</span>
    );
  return (
    <dl>
      {Object.entries(value)
        .filter(
          ([key]) =>
            ![
              'entityId',
              'createdAt',
              'modifiedAt',
              'recordHash',
              'integrityHash',
            ].includes(key),
        )
        .map(([key, item]) => (
          <div key={key}>
            <dt>
              {key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')}
            </dt>
            <dd>
              <SavedFields value={item} depth={depth + 1} />
            </dd>
          </div>
        ))}
    </dl>
  );
}
function downloadFile(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PhoneApp({
  userId,
  verifiedOnline,
}: {
  userId: string;
  verifiedOnline: boolean;
}) {
  configureDiveStore(userId, 'manual');
  const [data, setData] = useState<PhoneData>(EMPTY_PHONE_DATA),
    [screen, setScreen] = useState<Screen>({ kind: 'tab', tab: 'day' });
  const [day, setDay] = useState(phoneDate()),
    [loaded, setLoaded] = useState(false);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const keyboardOpen = useSyncExternalStore(
    subscribeKeyboard,
    () =>
      window.innerHeight -
        (window.visualViewport?.height || window.innerHeight) >
      170,
    () => false,
  );
  const [pending, setPending] = useState<
      Awaited<ReturnType<typeof pendingDiveChanges>>
    >([]),
    [drafts, setDrafts] = useState<PhoneDraft[]>([]);
  const [downloadedAt, setDownloadedAt] = useState<string>(),
    [shellReady, setShellReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [pauseEdits, setPauseEdits] = useState(false),
    [connectionVerified, setConnectionVerified] = useState(verifiedOnline),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [planTab, setPlanTab] = useState<'dive' | 'gas'>('dive'),
    [peopleTab, setPeopleTab] = useState<'people' | 'centres'>('people');
  const [interfacePreference, setInterfacePreference] =
    useState<InterfaceMode>('auto');
  const [missing, setMissing] = useState<string[]>([]);
  const [search, setSearch] = useState(''),
    [showArchived, setShowArchived] = useState(false);
  const firstLoad = useRef(true),
    dayChosen = useRef(false),
    leaveEditor = useRef<(() => Promise<void>) | null>(null);
  const editable = loaded && !busy && !pauseEdits;
  const refresh = useCallback(async () => {
    const [next, changes, localDrafts, status] = await Promise.all([
      loadPhoneData(),
      pendingDiveChanges(),
      listPhoneDrafts(),
      phoneDownloadStatus(userId),
    ]);
    setMissing(await missingPhoneReferences(userId, next));
    setData(next);
    setPending(changes);
    setDrafts(localDrafts);
    setDownloadedAt(status?.downloadedAt);
    if (firstLoad.current || !dayChosen.current) {
      firstLoad.current = false;
      setDay(initialPhoneDay(next));
    }
    setLoaded(true);
  }, [userId]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (verifiedOnline) await rememberPhoneAccount(userId);
      setInterfacePreference(readInterfaceMode());
      await refresh();
      if ('serviceWorker' in navigator) {
        // An older worker may not support this status query. Preparation is
        // explicit in More, so an unavailable status is not a download error.
        const ready = await phoneWorkerMessage('PHONE_OFFLINE_STATUS').catch(
          () => false,
        );
        if (alive) setShellReady(ready);
      }
    })().catch((cause) => {
      if (alive) {
        setLoaded(true);
        setError(
          cause instanceof Error
            ? cause.message
            : 'Device storage is unavailable.',
        );
      }
    });
    let refreshTimer: ReturnType<typeof setTimeout>;
    const updated = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(
        () =>
          void refresh().catch(() =>
            setError(
              'Device storage could not be read. Your saved records have not been cleared.',
            ),
          ),
        120,
      );
    };
    const connected = () => {
      setConnectionVerified(false);
      setPauseEdits(true);
      setMessage(
        'Back online. Sync now before making further edits. Your current draft is retained.',
      );
    };
    const disconnected = () => {
      setPauseEdits(false);
      setMessage('Offline. Changes stay on this device.');
    };
    const changedInAnotherWindow = (event: StorageEvent) => {
      if (event.key === 'zeustek-account-signed-out')
        window.location.replace('/phone/offline');
    };
    window.addEventListener('zeustek-records-updated', updated);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    window.addEventListener('storage', changedInAnotherWindow);
    return () => {
      alive = false;
      clearTimeout(refreshTimer);
      window.removeEventListener('zeustek-records-updated', updated);
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('storage', changedInAnotherWindow);
    };
  }, [userId, verifiedOnline, refresh]);
  async function navigate(next: Screen) {
    try {
      await leaveEditor.current?.();
      leaveEditor.current = null;
      setError('');
      setSearch('');
      setScreen(next);
      window.scrollTo({ top: 0 });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Your draft could not be saved. Stay on this screen and try again.',
      );
    }
  }
  async function sync() {
    if (busy || !online) return;
    setBusy(true);
    setError('');
    try {
      await leaveEditor.current?.();
      setMessage('Preparing offline app…');
      await phoneWorkerMessage('PREPARE_PHONE_OFFLINE');
      setShellReady(true);
      await synchronizePhoneRecords(setMessage);
      await refresh();
      setConnectionVerified(true);
      setPauseEdits(false);
      setMessage(
        'Synced. Saved records and the phone app are ready for offline use.',
      );
      void navigator.storage?.persist?.().catch(() => false);
    } catch (cause) {
      setPauseEdits(true);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Sync did not finish. Device records and drafts are retained.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function create(
    kind: PhoneDraftKind,
    source?: Record<string, JsonValue>,
    entityId?: string,
  ) {
    if (!editable) return;
    try {
      await leaveEditor.current?.();
      const id = crypto.randomUUID();
      const defaults: Record<PhoneDraftKind, Record<string, JsonValue>> = {
        trip: {
          name: '',
          planType: 'day-dive',
          startDate: day,
          endDate: day,
          siteName: '',
          buddy: '',
          personIds: [],
          status: 'planned',
          lifecycleStatus: 'draft',
          aim: '',
          goals: [],
          notes: '',
          planTeam: [],
          diveCentreIds: [],
          equipmentIds: [],
        },
        'gas-plan': {
          name: '',
          status: 'draft',
          cylinders: [],
          warnings: [],
          notes: '',
          phoneGasInput: jsonRecord(basicGasInput()),
        },
        person: {
          name: '',
          forename: '',
          surname: '',
          displayName: '',
          role: 'buddy',
          roles: { buddy: true },
          agency: '',
          highestQualification: '',
          membershipNumber: '',
          email: '',
          phone: '',
          emergencyContact: '',
          notes: '',
          contactVisibility: 'private',
        },
        operator: {
          name: '',
          operatorType: 'dive-centre',
          location: '',
          website: '',
          notes: '',
          active: true,
          services: {},
        },
        dive: {
          site: '',
          date: day,
          timeIn: '',
          timeOut: '',
          maxDepthM: null,
          bottomTimeMin: null,
          gas: '',
          notes: '',
          source: 'manual',
          buddyIds: [],
          diveTeamIds: [],
        },
      };
      const draft: PhoneDraft = {
        id,
        account: userId,
        kind,
        record: {
          ...defaults[kind],
          ...source,
          ...(kind === 'gas-plan' && source
            ? { phoneGasInput: jsonRecord(phoneGasInput(source)) }
            : {}),
        },
        ...(entityId && source ? { baseRecord: jsonRecord(source) } : {}),
        baseModifiedAt: entityId ? readable(source?.modifiedAt) : null,
        savedAt: new Date().toISOString(),
        ...(entityId ? { entityId } : {}),
      };
      await savePhoneDraft(draft);
      leaveEditor.current = null;
      await refresh();
      setScreen({ kind: 'edit', draft });
      setError('');
      window.scrollTo({ top: 0 });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The draft could not be created.',
      );
    }
  }
  async function logDive(planId?: string) {
    try {
      const planned = planId ? await createDiveDraftFromPlan(planId) : {};
      await create(
        'dive',
        jsonRecord({
          ...planned,
          date: day,
          timeIn: '',
          timeOut: '',
          gas: '',
          maxDepthM: null,
          bottomTimeMin: null,
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The saved plan could not be opened.',
      );
    }
  }
  async function resume(id: string) {
    try {
      const draft = await readPhoneDraft(id);
      if (draft) await navigate({ kind: 'edit', draft });
      else setError('This draft is no longer on this device.');
    } catch {
      setError('The draft could not be opened.');
    }
  }
  async function fullInterface(section: string, id?: string) {
    if (!online || pending.length || pauseEdits || busy) {
      setError(
        'Sync now before opening the full interface. Your device changes remain saved.',
      );
      return;
    }
    try {
      await leaveEditor.current?.();
      saveInterfaceMode('full');
      await phoneWorkerMessage('CLEAR_PHONE_ENTRY').catch(() => false);
      const params = new URLSearchParams({ section, interface: 'full' });
      if (id)
        params.set(
          section === 'Gas Planning'
            ? 'gasPlanId'
            : section === 'Dive Plans'
              ? 'planId'
              : 'recordId',
          id,
        );
      window.location.assign('/?' + params);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The full interface could not be opened.',
      );
    }
  }
  const back = () =>
    void navigate({
      kind: 'tab',
      tab:
        screen.kind === 'dive'
          ? 'logbook'
          : screen.kind === 'person' || screen.kind === 'operator'
            ? 'people'
            : screen.kind === 'plan' || screen.kind === 'gas'
              ? 'plans'
              : 'day',
    });
  const trip = tripForPhoneDay(data, day),
    todayPlans = data.plans.filter(
      (plan) => planDay(plan) === day && plan.lifecycleStatus !== 'cancelled',
    );
  const site = data.sites.find(
    (item) =>
      item.entityId === todayPlans[0]?.siteId ||
      trip?.siteIds.includes(item.entityId),
  );
  const timeline = phoneTimeline(data, day),
    activeTab: Tab =
      screen.kind === 'tab'
        ? screen.tab
        : screen.kind === 'person' ||
            screen.kind === 'operator' ||
            screen.kind === 'centres'
          ? 'people'
          : screen.kind === 'plan' ||
              screen.kind === 'gas' ||
              screen.kind === 'edit'
            ? 'plans'
            : screen.kind === 'dive'
              ? 'logbook'
              : 'day';
  const filtered = (name: string) =>
    name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const plan =
    screen.kind === 'plan'
      ? data.plans.find((item) => item.entityId === screen.id)
      : undefined;
  const dive =
    screen.kind === 'dive'
      ? data.dives.find((item) => item.entityId === screen.id)
      : undefined;
  const gas =
    screen.kind === 'gas'
      ? data.gasPlans.find((item) => item.entityId === screen.id)
      : undefined;
  const selectedTrip =
    screen.kind === 'trip'
      ? data.trips.find((item) => item.entityId === screen.id)
      : undefined;
  const event =
    screen.kind === 'event'
      ? data.events.find((item) => item.entityId === screen.id)
      : undefined;
  const contact =
    screen.kind === 'person'
      ? data.people.find((item) => item.entityId === screen.id)
      : screen.kind === 'operator'
        ? data.operators.find((item) => item.entityId === screen.id)
        : undefined;
  const statusLabel = busy
    ? 'Syncing…'
    : !online || !connectionVerified
      ? `Offline / ${pending.length} saved change${pending.length === 1 ? '' : 's'}`
      : pending.length
        ? `${pending.length} saved · Sync now`
        : downloadedAt && !pauseEdits
          ? 'Synced'
          : 'Sync now';
  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <img
          className={styles.logo}
          src="/zeustek-wordmark.png"
          alt="ZeusTek Diving"
        />
        <button
          className={styles.status}
          data-tone={
            !online || !connectionVerified || pending.length || pauseEdits
              ? 'warning'
              : downloadedAt
                ? 'good'
                : 'warning'
          }
          aria-label={`${statusLabel}. Open sync and offline downloads`}
          onClick={() => void navigate({ kind: 'tab', tab: 'more' })}
        >
          {online && connectionVerified ? (
            <Wifi aria-hidden />
          ) : (
            <ArrowDownToLine aria-hidden />
          )}
          {statusLabel}
        </button>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {pauseEdits && online && (
        <div className={styles.warning}>
          <p>Sync now before editing. Your current draft is saved here.</p>
          <button
            className={styles.primary}
            type="button"
            disabled={busy}
            onClick={() => void sync()}
          >
            Sync now
          </button>
        </div>
      )}
      {!loaded && (
        <output className={styles.card}>Opening saved records…</output>
      )}
      {loaded && screen.kind === 'tab' && screen.tab === 'day' && (
        <>
          <h1>Dive day</h1>
          <div className={styles.datebar}>
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => {
                dayChosen.current = true;
                const next = new Date(day + 'T12:00:00');
                next.setDate(next.getDate() - 1);
                setDay(phoneDate(next));
              }}
            >
              <ChevronLeft />
            </button>
            <label className={styles.dayChoice}>
              <span>
                {new Date(day + 'T12:00:00').toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <input
                aria-label="Choose dive day"
                type="date"
                value={day}
                onChange={(e) => {
                  if (e.target.value) {
                    dayChosen.current = true;
                    setDay(e.target.value);
                  }
                }}
              />
            </label>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => {
                dayChosen.current = true;
                const next = new Date(day + 'T12:00:00');
                next.setDate(next.getDate() + 1);
                setDay(phoneDate(next));
              }}
            >
              <ChevronRight />
            </button>
          </div>
          <section className={styles.destination}>
            <img
              className={styles.emblem}
              src="/zeustek-tech-emblem.png"
              alt=""
            />
            <div>
              <h2>
                {trip?.destination ||
                  todayPlans[0]?.siteName ||
                  site?.name ||
                  'Your dive day'}
              </h2>
              {(site?.location || trip?.travelArrivalPoint) && (
                <p>{site?.location || trip?.travelArrivalPoint}</p>
              )}
              <div className={styles.saved}>
                <ArrowDownToLine aria-hidden />
                {downloadedAt && shellReady
                  ? 'Saved for offline use'
                  : 'Prepare this phone in More'}
              </div>
            </div>
          </section>
          <div className={styles.timeline}>
            {timeline.length ? (
              timeline.map((item) => (
                <div className={styles.timelineItem} key={item.id}>
                  <span className={styles.time}>{item.time || '—'}</span>
                  <Row
                    icon={item.kind === 'plan' ? Waves : Ship}
                    image={
                      item.kind === 'plan'
                        ? '/brand/icons/navigation/cylinders_and_gas.png'
                        : undefined
                    }
                    title={item.title}
                    subtitle={item.subtitle}
                    action={
                      item.kind === 'plan'
                        ? 'View saved plan'
                        : item.kind === 'trip'
                          ? 'Trip details'
                          : 'Event details'
                    }
                    onClick={() =>
                      void navigate({ kind: item.kind, id: item.recordId })
                    }
                  />
                </div>
              ))
            ) : (
              <p className={styles.muted}>
                No saved events or Dive Plans for this date.
              </p>
            )}
          </div>
          <div className={styles.group}>
            <Row
              icon={ClipboardCheck}
              title="Equipment checks"
              subtitle="Review and confirm"
              onClick={() => void navigate({ kind: 'equipment' })}
            />
            <Row
              icon={Users}
              title="Centre contacts"
              subtitle="Key numbers and details"
              onClick={() => void navigate({ kind: 'centres' })}
            />
          </div>
          <div className={styles.rows}>
            <Row
              icon={UserPlus}
              title="Add buddy"
              disabled={!editable}
              subtitle="Create a Person on this device"
              onClick={() => void create('person')}
            />
          </div>
          <button
            type="button"
            className={`${styles.primary} ${styles.log}`}
            disabled={!editable}
            onClick={() => void logDive(todayPlans[0]?.entityId)}
          >
            <span>
              <FileText aria-hidden />
              Log dive
            </span>
            <ChevronRight aria-hidden />
          </button>
          <p className={styles.footnote}>
            <ArrowDownToLine aria-hidden />
            Saved here. Tap Sync now when back online.
          </p>
        </>
      )}
      {loaded && screen.kind === 'tab' && screen.tab === 'plans' && (
        <>
          <h1>Plans</h1>
          <div className={styles.segmented}>
            <button
              type="button"
              aria-pressed={planTab === 'dive'}
              onClick={() => setPlanTab('dive')}
            >
              Dive Plans
            </button>
            <button
              type="button"
              aria-pressed={planTab === 'gas'}
              onClick={() => setPlanTab('gas')}
            >
              Gas Plans
            </button>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={!editable}
              type="button"
              onClick={() =>
                void create(planTab === 'dive' ? 'trip' : 'gas-plan')
              }
            >
              <Plus />
              {planTab === 'dive' ? 'New Dive Plan' : 'New Gas Plan'}
            </button>
          </div>
          <label className={styles.field}>
            Search plans
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or Site"
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show completed / archived
          </label>
          <div className={styles.rows}>
            {planTab === 'dive'
              ? data.plans
                  .filter(
                    (item) =>
                      filtered(item.name) &&
                      (showArchived ||
                        !['completed', 'cancelled'].includes(
                          item.lifecycleStatus || '',
                        )),
                  )
                  .map((item) => (
                    <Row
                      key={item.entityId}
                      icon={Waves}
                      title={item.name}
                      subtitle={`${planDay(item)} · ${item.siteName}`}
                      onClick={() =>
                        void navigate({ kind: 'plan', id: item.entityId })
                      }
                    />
                  ))
              : data.gasPlans
                  .filter(
                    (item) =>
                      filtered(item.name) &&
                      (showArchived ||
                        !['archived', 'used'].includes(item.status)),
                  )
                  .map((item) => (
                    <Row
                      key={item.entityId}
                      icon={Waves}
                      title={item.name}
                      subtitle={`${item.plannedDepthM ?? '—'} m · ${item.status}`}
                      onClick={() =>
                        void navigate({ kind: 'gas', id: item.entityId })
                      }
                    />
                  ))}
          </div>
          <p className={styles.muted}>
            Basic plans can be created and edited offline. Open the full
            interface for advanced planning.
          </p>
        </>
      )}
      {loaded && screen.kind === 'tab' && screen.tab === 'logbook' && (
        <>
          <h1>Logbook</h1>
          <button
            className={`${styles.primary} ${styles.wide}`}
            disabled={!editable}
            onClick={() => void logDive()}
          >
            <Plus />
            Log dive
          </button>
          <label className={styles.field}>
            Search dives
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Site name"
            />
          </label>
          <div className={styles.rows}>
            {data.dives
              .filter((item) => filtered(item.site))
              .sort((a, b) =>
                `${b.date} ${b.timeIn || ''}`.localeCompare(
                  `${a.date} ${a.timeIn || ''}`,
                ),
              )
              .map((item) => (
                <Row
                  key={item.entityId}
                  icon={BookOpen}
                  title={`${item.diveNumber ? '#' + item.diveNumber + ' · ' : ''}${item.site}`}
                  subtitle={`${item.date} · ${item.maxDepthM ?? '—'} m · ${item.bottomTimeMin ?? '—'} min`}
                  action="View / edit saved log"
                  onClick={() =>
                    void navigate({ kind: 'dive', id: item.entityId })
                  }
                />
              ))}
          </div>
        </>
      )}
      {loaded && screen.kind === 'tab' && screen.tab === 'people' && (
        <>
          <h1>People &amp; centres</h1>
          <div className={styles.segmented}>
            <button
              aria-pressed={peopleTab === 'people'}
              onClick={() => setPeopleTab('people')}
            >
              People
            </button>
            <button
              aria-pressed={peopleTab === 'centres'}
              onClick={() => setPeopleTab('centres')}
            >
              Dive Centres
            </button>
          </div>
          <button
            className={`${styles.primary} ${styles.wide}`}
            disabled={!editable}
            onClick={() =>
              void create(peopleTab === 'people' ? 'person' : 'operator')
            }
          >
            <Plus />
            {peopleTab === 'people' ? 'Add Person' : 'Add Dive Centre'}
          </button>
          <label className={styles.field}>
            Search contacts
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className={styles.rows}>
            {(peopleTab === 'people' ? data.people : data.operators)
              .filter((item) => filtered(item.name))
              .map((item) => (
                <Row
                  key={item.entityId}
                  icon={Users}
                  title={item.name}
                  subtitle={
                    'roles' in item && item.roles?.ownerProfile
                      ? 'Self'
                      : item.phone ||
                        ('role' in item ? item.role : item.location)
                  }
                  onClick={() =>
                    void navigate({
                      kind: peopleTab === 'people' ? 'person' : 'operator',
                      id: item.entityId,
                    })
                  }
                />
              ))}
          </div>
        </>
      )}
      {loaded && screen.kind === 'tab' && screen.tab === 'more' && (
        <>
          <h1>More</h1>
          {missing.length > 0 && (
            <Detail title={`Missing linked records (${missing.length})`}>
              <ul>
                {missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                These references are retained but their details are unavailable
                on this phone. Check cloud access, then download again.
              </p>
            </Detail>
          )}
          <section className={styles.card}>
            <h2>Sync &amp; offline</h2>
            <p className={styles.muted}>
              Last complete download: {stamp(downloadedAt)}
            </p>
            <p>
              {shellReady && downloadedAt
                ? 'Phone app and downloaded records are ready offline.'
                : 'Download this phone before leaving coverage.'}
            </p>
            <button
              className={`${styles.primary} ${styles.wide}`}
              disabled={!online || busy}
              onClick={() => void sync()}
            >
              {busy
                ? 'Syncing…'
                : downloadedAt
                  ? 'Sync now / refresh download'
                  : 'Download for offline use'}
            </button>
            <output className={styles.notice}>{message}</output>
            <p className={styles.muted}>
              Upload and download happen when you tap Sync now. Booking codes
              and saved plan details are included. Document attachments need a
              separate download.
            </p>
          </section>
          {pending.length > 0 && (
            <Detail title={`${pending.length} saved changes`} open>
              {pending.map((row) => {
                const summary = syncReviewSummary(row.value);
                const value = row.value as Record<string, JsonValue>;
                return (
                  <div className={styles.card} key={row.key}>
                    <h3>
                      {summary.kind} · {summary.title}
                    </h3>
                    <p className={styles.muted}>
                      {value.state === 'conflict'
                        ? summary.message
                        : 'Saved here, waiting for Sync now.'}
                    </p>
                    {value.state === 'conflict' && online && (
                      <DiveConflictReview recordKey={row.key} />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(
                          'zeustek-device-record.json',
                          conflictExportPayload(row.value),
                        )
                      }
                    >
                      Download device version
                    </button>
                  </div>
                );
              })}
            </Detail>
          )}
          {drafts.length > 0 && (
            <Detail title={`Unfinished drafts (${drafts.length})`} open>
              {drafts.map((draft) => (
                <Row
                  key={draft.id}
                  icon={FileText}
                  title={readable(
                    draft.record.name || draft.record.site,
                    `New ${label(draft.kind)}`,
                  )}
                  subtitle={`${label(draft.kind)} · saved ${stamp(draft.savedAt)}`}
                  action="Continue draft"
                  onClick={() => void resume(draft.id)}
                />
              ))}
            </Detail>
          )}
          <Detail title="Events & trips" open>
            <div className={styles.rows}>
              {data.trips
                .filter(
                  (item) =>
                    !['completed', 'cancelled'].includes(item.status) ||
                    showArchived,
                )
                .map((item) => (
                  <Row
                    key={item.entityId}
                    icon={Ship}
                    title={item.name}
                    subtitle={item.destination || ''}
                    action="Bookings & itinerary"
                    onClick={() =>
                      void navigate({ kind: 'trip', id: item.entityId })
                    }
                  />
                ))}
              {data.events
                .filter(
                  (item) =>
                    !['archived', 'cancelled', 'completed'].includes(
                      item.bookingStatus || '',
                    ) || showArchived,
                )
                .map((item) => (
                  <Row
                    key={item.entityId}
                    icon={CalendarDays}
                    title={item.name}
                    subtitle={item.startDate}
                    onClick={() =>
                      void navigate({ kind: 'event', id: item.entityId })
                    }
                  />
                ))}
            </div>
          </Detail>
          <Detail title="Interface & device">
            <p className={styles.muted}>
              Choose the interface on this device. Desktop layout is unchanged.
            </p>
            <label className={styles.field}>
              Interface preference
              <select
                value={interfacePreference}
                onChange={(e) => {
                  const mode = e.target.value as InterfaceMode;
                  saveInterfaceMode(mode);
                  setInterfacePreference(mode);
                }}
              >
                <option value="auto">Auto (phone preview is opt-in)</option>
                <option value="phone">Phone</option>
                <option value="full">Full interface</option>
              </select>
            </label>
            <button
              disabled={!online || !!pending.length || pauseEdits || busy}
              onClick={() => void fullInterface('Overview')}
            >
              Use desktop version for full functionality
            </button>
            <button
              onClick={() =>
                void (async () => {
                  const reviews = await listPhoneDraftReviews();
                  downloadFile('zeustek-phone-device-copy.json', {
                    format: 'zeustek-phone-device-review',
                    version: 1,
                    records: Object.fromEntries(
                      Object.entries(data).map(([key, records]) => [
                        key,
                        records.map((record: unknown) =>
                          reviewRecordSnapshot(record),
                        ),
                      ]),
                    ),
                    drafts: drafts.map((item) => ({
                      ...item,
                      record: reviewRecordSnapshot(item.record),
                    })),
                    reviews: reviews.map((item) => reviewRecordSnapshot(item)),
                  });
                })()
              }
            >
              Export saved device records &amp; drafts
            </button>
            <p className={styles.muted}>
              First open and download online from the installed Home Screen app.
              Safari and the installed app have separate device storage.
            </p>
            <button
              disabled={!online || busy}
              onClick={() =>
                void (async () => {
                  try {
                    await leaveEditor.current?.();
                    await forgetPhoneAccount();
                    try {
                      localStorage.setItem(
                        'zeustek-account-signed-out',
                        String(Date.now()),
                      );
                    } catch {}
                    window.location.assign('/signout-with-chatgpt');
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : 'Sign out did not finish. Your draft is retained.',
                    );
                  }
                })()
              }
            >
              Sign out
            </button>
          </Detail>
        </>
      )}
      {screen.kind === 'edit' && (
        <PhoneEditor
          key={screen.draft.id}
          initial={screen.draft}
          data={data}
          editable={editable}
          registerLeave={(action) => {
            leaveEditor.current = action;
          }}
          close={back}
          saved={async () => {
            leaveEditor.current = null;
            await refresh();
            setMessage('Saved on this device. Tap Sync now when online.');
            setScreen({
              kind: 'tab',
              tab:
                screen.draft.kind === 'dive'
                  ? 'logbook'
                  : screen.draft.kind === 'person' ||
                      screen.draft.kind === 'operator'
                    ? 'people'
                    : 'plans',
            });
          }}
          addPerson={() => void create('person')}
          addCentre={() => void create('operator')}
          full={() =>
            void fullInterface(
              screen.draft.kind === 'gas-plan'
                ? 'Gas Planning'
                : screen.draft.kind === 'trip'
                  ? 'Dive Plans'
                  : 'People',
              screen.draft.entityId,
            )
          }
        />
      )}
      {screen.kind !== 'tab' && screen.kind !== 'edit' && (
        <>
          <header className={styles.panelHeader}>
            <button className={styles.back} onClick={back} aria-label="Back">
              <ArrowLeft />
            </button>
            <h1>
              {dive?.site ||
                plan?.name ||
                gas?.name ||
                selectedTrip?.name ||
                event?.name ||
                contact?.name ||
                (screen.kind === 'equipment'
                  ? 'Equipment checks'
                  : 'Centre contacts')}
            </h1>
          </header>
          {dive && (
            <>
              <section className={styles.card}>
                <Facts
                  items={[
                    ['Dive date', dive.date],
                    ['Time in', dive.timeIn],
                    ['Time out', dive.timeOut],
                    ['Depth', dive.maxDepthM],
                    ['Bottom time', dive.bottomTimeMin],
                    ['Gas', dive.gas],
                    ['Notes', dive.notes],
                  ]}
                />
              </section>
              <button
                className={styles.wide}
                disabled={!editable}
                onClick={() =>
                  void create('dive', jsonRecord(dive), dive.entityId)
                }
              >
                Edit this dive
              </button>
              <Detail title="All saved dive information" open>
                <SavedFields value={reviewRecordSnapshot(dive)} />
              </Detail>
            </>
          )}
          {plan && (
            <>
              <section className={styles.card}>
                <Facts
                  items={[
                    ['Planned start', plan.startAt || plan.startDate],
                    ['Site', plan.siteName],
                    [
                      'Planned depth',
                      plan.plannedMaxDepthM != null
                        ? `${plan.plannedMaxDepthM} m`
                        : undefined,
                    ],
                    [
                      'Planned duration',
                      plan.plannedDurationMin != null
                        ? `${plan.plannedDurationMin} min`
                        : undefined,
                    ],
                    ['Status', plan.lifecycleStatus || plan.status],
                  ]}
                />
              </section>
              <div className={styles.actions}>
                <button
                  disabled={!editable || !basicPlanEditable(jsonRecord(plan))}
                  onClick={() =>
                    void create('trip', jsonRecord(plan), plan.entityId)
                  }
                >
                  Edit / update
                </button>
                <button
                  disabled={!editable || !basicPlanEditable(jsonRecord(plan))}
                  onClick={() =>
                    void create(
                      'trip',
                      jsonRecord(duplicateDivePlanDraft(plan)),
                    )
                  }
                >
                  Duplicate
                </button>
              </div>
              <button
                className={`${styles.primary} ${styles.wide}`}
                disabled={!editable}
                onClick={() => void logDive(plan.entityId)}
              >
                Log this dive
              </button>
              <Detail title="Aim, goals & notes" open>
                <FormattedPlanText
                  text={plan.aim || ''}
                  document={plan.textFormatting?.aim}
                />
                {plan.goals?.length ? (
                  <ul>
                    {plan.goals.map((goal, i) => (
                      <li key={i}>{goal}</li>
                    ))}
                  </ul>
                ) : null}
                <FormattedPlanText
                  text={plan.notes || ''}
                  document={plan.textFormatting?.notes}
                />
              </Detail>
              <Detail title="Linked Gas Plans" open>
                {linkedPhoneGasPlans(plan, data.gasPlans).map((item) => (
                  <Row
                    key={item.entityId}
                    icon={Waves}
                    title={item.name}
                    onClick={() =>
                      void navigate({ kind: 'gas', id: item.entityId })
                    }
                  />
                ))}
                <button
                  disabled={!editable}
                  onClick={() =>
                    void create('gas-plan', {
                      divePlanId: plan.entityId,
                      name: plan.name + ' gas',
                      phoneGasInput: jsonRecord({
                        ...basicGasInput(),
                        plannedDepthM: plan.plannedMaxDepthM || 0,
                        plannedWorkingTimeMin: plan.plannedDurationMin ?? null,
                      }),
                    })
                  }
                >
                  <Plus />
                  New Gas Plan
                </button>
              </Detail>
              <Detail title="Team & centre contacts">
                <ContactList
                  data={data}
                  personIds={
                    plan.planTeam?.length
                      ? plan.planTeam.map((item) => item.personId)
                      : plan.personIds || []
                  }
                  centreIds={plan.diveCentreIds || []}
                  navigate={navigate}
                />
              </Detail>
              <Detail title="Safety & emergency">
                <SavedFields
                  value={{
                    humanFactors: plan.humanFactors,
                    emergency: plan.emergency,
                  }}
                />
              </Detail>
              <Detail title="Saved conditions">
                <p className={styles.muted}>
                  Saved snapshot ·{' '}
                  {stamp(
                    plan.conditions?.capturedAt || plan.conditions?.sourceTime,
                  )}
                  . Check local conditions before diving.
                </p>
                <SavedFields value={plan.conditions} />
              </Detail>
              <Detail title="All saved plan details">
                <SavedFields value={reviewRecordSnapshot(plan)} />
              </Detail>
              <button
                className={styles.wide}
                onClick={() => void fullInterface('Dive Plans', plan.entityId)}
              >
                Use desktop version for full functionality
              </button>
            </>
          )}
          {gas && (
            <>
              <section className={styles.card}>
                <Facts
                  items={[
                    ['Status', gas.status],
                    [
                      'Planned depth',
                      gas.plannedDepthM != null
                        ? `${gas.plannedDepthM} m`
                        : undefined,
                    ],
                    [
                      'Working time',
                      gas.plannedBottomTimeMin != null
                        ? `${gas.plannedBottomTimeMin} min`
                        : undefined,
                    ],
                  ]}
                />
                <GasSummary snapshot={gas.recGasPlan101} />
              </section>
              <div className={styles.actions}>
                <button
                  disabled={!editable || !basicGasEditable(jsonRecord(gas))}
                  onClick={() =>
                    void create('gas-plan', jsonRecord(gas), gas.entityId)
                  }
                >
                  Edit / update
                </button>
                <button
                  disabled={!editable || !basicGasEditable(jsonRecord(gas))}
                  onClick={() =>
                    void create(
                      'gas-plan',
                      jsonRecord(duplicateGasPlanDraft(gas)),
                    )
                  }
                >
                  Duplicate
                </button>
              </div>
              <Detail title="Warnings & assumptions" open>
                <ul>
                  {[
                    ...(gas.recGasPlan101?.readinessReasons || []),
                    ...(gas.warnings || []),
                  ].map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
                <SavedFields value={gas.recGasPlan101?.assumptions} />
              </Detail>
              <Detail title="All saved Gas Plan details">
                <SavedFields value={reviewRecordSnapshot(gas)} />
              </Detail>
              <button
                className={styles.wide}
                onClick={() => void fullInterface('Gas Planning', gas.entityId)}
              >
                Use desktop version for full functionality
              </button>
            </>
          )}
          {selectedTrip && (
            <>
              <section className={styles.card}>
                <Facts
                  items={[
                    ['Destination', selectedTrip.destination],
                    ['Starts', selectedTrip.startsOn],
                    ['Ends', selectedTrip.endsOn],
                    ['Arrival point', selectedTrip.travelArrivalPoint],
                    ['Accommodation', selectedTrip.accommodation],
                    ['Status', selectedTrip.status],
                  ]}
                />
              </section>
              <Detail title="Booking codes & references" open>
                {selectedTrip.bookings.length ? (
                  selectedTrip.bookings.map((booking) => (
                    <section className={styles.card} key={booking.id}>
                      <h3>{booking.provider}</h3>
                      <Facts
                        items={[
                          ['Booking code', booking.reference],
                          ['Paid', booking.paid],
                          ['Payment due', booking.dueOn],
                          [
                            'Amount',
                            booking.amount != null
                              ? `${booking.amount} ${booking.currency || ''}`
                              : undefined,
                          ],
                          ['Notes', booking.notes],
                        ]}
                      />
                    </section>
                  ))
                ) : (
                  <p>No separate booking codes saved.</p>
                )}
              </Detail>
              <Detail
                title={`Itinerary (${selectedTrip.itinerary.length})`}
                open
              >
                {selectedTrip.itinerary.map((item) => (
                  <Detail key={item.id} title={item.title || item.kind}>
                    <Facts
                      items={[
                        ['Starts', item.startsAt],
                        ['Ends', item.endsAt],
                        ['Location', item.location],
                        ['Booking code', item.bookingRef],
                        ['Notes', item.notes],
                      ]}
                    />
                    {item.links?.map((link) => (
                      <p key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {link.title || link.url}
                        </a>
                      </p>
                    ))}
                    {Boolean(item.attachments?.length) && (
                      <p className={styles.muted}>
                        Attached documents require a separate download.
                      </p>
                    )}
                  </Detail>
                ))}
              </Detail>
              <Detail title="Dive Plans" open>
                {data.plans
                  .filter(
                    (item) =>
                      item.tripId === selectedTrip.entityId ||
                      selectedTrip.planIds.includes(item.entityId),
                  )
                  .map((item) => (
                    <Row
                      key={item.entityId}
                      icon={Waves}
                      title={item.name}
                      onClick={() =>
                        void navigate({ kind: 'plan', id: item.entityId })
                      }
                    />
                  ))}
              </Detail>
              <Detail title="Team & centre contacts">
                <ContactList
                  data={data}
                  personIds={selectedTrip.teamPersonIds}
                  centreIds={selectedTrip.diveCentreIds || []}
                  navigate={navigate}
                />
              </Detail>
              <Detail title="Emergency, insurance & notes">
                <SavedFields
                  value={{
                    emergency: selectedTrip.emergencyNotes,
                    insurance: selectedTrip.insuranceNotes,
                    medical: selectedTrip.medicalNotes,
                    notes: selectedTrip.notes,
                  }}
                />
              </Detail>
              <Detail title="All saved trip details">
                <SavedFields value={reviewRecordSnapshot(selectedTrip)} />
              </Detail>
            </>
          )}
          {event && (
            <>
              <section className={styles.card}>
                <Facts
                  items={[
                    ['Starts', event.startAt || event.startDate],
                    ['Ends', event.endAt || event.endDate],
                    ['Location', event.locationName || event.siteName],
                    ['Status', event.bookingStatus],
                    ['Notes', event.quickNotes || event.notes],
                  ]}
                />
              </section>
              {event.linkedTripId && (
                <Row
                  icon={Ship}
                  title="Trip details & booking codes"
                  onClick={() =>
                    void navigate({ kind: 'trip', id: event.linkedTripId! })
                  }
                />
              )}
              <Detail title="All saved event details" open>
                <SavedFields value={reviewRecordSnapshot(event)} />
              </Detail>
            </>
          )}
          {contact && (
            <>
              <section className={styles.card}>
                <ContactActions contact={contact} />
                <Facts
                  items={[
                    ['Phone', contact.phone],
                    ['Email', contact.email],
                    [
                      'Address',
                      'address' in contact
                        ? contact.address
                        : 'streetAddress' in contact
                          ? contact.streetAddress
                          : '',
                    ],
                    ['Postcode', contact.postcode],
                    [
                      'Emergency number',
                      'emergencyPhone' in contact
                        ? contact.emergencyPhone
                        : 'emergencyContactNumber' in contact
                          ? contact.emergencyContactNumber
                          : '',
                    ],
                  ]}
                />
              </section>
              <button
                className={`${styles.primary} ${styles.wide}`}
                disabled={!editable}
                onClick={() =>
                  void create(
                    screen.kind === 'operator' ? 'operator' : 'person',
                    jsonRecord(contact),
                    contact.entityId,
                  )
                }
              >
                Edit full contact details
              </button>
              <Detail title="All contact details" open>
                <SavedFields value={reviewRecordSnapshot(contact)} />
              </Detail>
            </>
          )}
          {screen.kind === 'centres' && (
            <div className={styles.rows}>
              {data.operators
                .filter(
                  (item) =>
                    trip?.diveCentreIds?.includes(item.entityId) ||
                    todayPlans.some((plan) =>
                      plan.diveCentreIds?.includes(item.entityId),
                    ),
                )
                .map((item) => (
                  <Row
                    key={item.entityId}
                    icon={Phone}
                    title={item.name}
                    subtitle={item.phone}
                    onClick={() =>
                      void navigate({ kind: 'operator', id: item.entityId })
                    }
                  />
                ))}
              <button
                onClick={() => void navigate({ kind: 'tab', tab: 'people' })}
              >
                All People &amp; Dive Centres
              </button>
            </div>
          )}
          {screen.kind === 'equipment' && (
            <>
              {todayPlans.map((item) => (
                <Detail key={item.entityId} title={item.name} open>
                  <SavedFields value={item.equipmentReadiness} />
                  <ul>
                    {item.checklist?.map((check) => (
                      <li key={check.id}>
                        {check.completed ? '✓' : '○'} {check.label}
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={!editable}
                    onClick={() =>
                      void create('trip', jsonRecord(item), item.entityId)
                    }
                  >
                    Update checks
                  </button>
                </Detail>
              ))}
            </>
          )}
          {!dive &&
            !plan &&
            !gas &&
            !selectedTrip &&
            !event &&
            !contact &&
            !['equipment', 'centres'].includes(screen.kind) && (
              <p className={styles.warning}>
                This record is not saved on this device. Download it online
                before relying on it offline.
              </p>
            )}
        </>
      )}
      <nav
        className={styles.tabs}
        data-keyboard={keyboardOpen}
        aria-label="Phone navigation"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => void navigate({ kind: 'tab', tab: id })}
          >
            <Icon aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function ContactActions({
  contact,
}: {
  contact: { phone?: string; email?: string };
}) {
  return (
    <div className={styles.actions}>
      {contact.phone && (
        <a href={'tel:' + contact.phone.replace(/[^\d+]/g, '')}>
          Call {contact.phone}
        </a>
      )}
      {contact.email && (
        <a href={'mailto:' + encodeURIComponent(contact.email)}>Email</a>
      )}
    </div>
  );
}
function ContactList({
  data,
  personIds,
  centreIds,
  navigate,
}: {
  data: PhoneData;
  personIds: string[];
  centreIds: string[];
  navigate: (screen: Screen) => Promise<void>;
}) {
  return (
    <>
      {personIds.map((id) => {
        const person = data.people.find((item) => item.entityId === id);
        return person ? (
          <Row
            key={id}
            icon={Users}
            title={person.name}
            subtitle={person.phone}
            onClick={() => void navigate({ kind: 'person', id })}
          />
        ) : (
          <p key={id} className={styles.warning}>
            A linked Person is not downloaded.
          </p>
        );
      })}
      {centreIds.map((id) => {
        const centre = data.operators.find((item) => item.entityId === id);
        return centre ? (
          <Row
            key={id}
            icon={Phone}
            title={centre.name}
            subtitle={centre.phone}
            onClick={() => void navigate({ kind: 'operator', id })}
          />
        ) : (
          <p key={id} className={styles.warning}>
            A linked Dive Centre is not downloaded.
          </p>
        );
      })}
    </>
  );
}
export function GasSummary({
  snapshot,
}: {
  snapshot?:
    | import('../../lib/offline/recreational-gas-planner').RecreationalGasSnapshot
    | null
    | undefined;
}) {
  const selected = snapshot?.gasCandidates.find((item) => item.selected);
  if (!snapshot)
    return (
      <p className={styles.muted}>
        No saved calculation. Open or create a Gas Plan to calculate.
      </p>
    );
  return (
    <>
      <p
        className={
          snapshot.readiness === 'Blocked' ? styles.warning : styles.muted
        }
      >
        {snapshot.readiness} · {snapshot.selectedGasLabel}
      </p>
      <div className={styles.metrics}>
        <div>
          <small>No-stop limit</small>
          <strong>
            {selected?.ndl.state === 'available'
              ? `${selected.ndl.minutes} min`
              : 'Unavailable'}
          </strong>
        </div>
        <div>
          <small>Gas-limited time</small>
          <strong>
            {selected?.gasLimitedTimeMin != null
              ? `${Math.floor(selected.gasLimitedTimeMin)} min`
              : 'Unavailable'}
          </strong>
        </div>
        <div>
          <small>Selected reserve</small>
          <strong>
            {snapshot.reserve.selectedBar != null
              ? `${Math.ceil(snapshot.reserve.selectedBar)} bar`
              : 'Unavailable'}
          </strong>
        </div>
        <div>
          <small>MOD</small>
          <strong>
            {selected?.modM != null
              ? `${selected.modM.toFixed(1)} m`
              : 'Unavailable'}
          </strong>
        </div>
      </div>
      <p className={styles.muted}>
        {snapshot.selectedBuhlmannModel} · GF {snapshot.gfLow}/{snapshot.gfHigh}{' '}
        · {stamp(snapshot.createdAt)}.{' '}
        {snapshot.repetitiveDive
          ? 'Residual loading unknown.'
          : 'Rested surface-air tissues assumed.'}
      </p>
    </>
  );
}
