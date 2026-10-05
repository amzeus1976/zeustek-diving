'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Link2,
  Pencil,
  Plus,
  XCircle,
} from 'lucide-react';
import { RecordEditorWorkspace } from '../shared/record-editor-workspace';
import { bookingRecordLinks } from '../../lib/planning/booking-record-links';
import {CalendarDownloadWorkspace} from './calendar-download-workspace';
import { useRecordRefresh } from '../record-status';
import { CollapsibleWorkCard } from '../workflow/collapsible-work-card';
import { ZeusTekIcon } from '../zeustek-icon';
import {
  saveDivingCalendarBooking,
  type BookingKind,
  type BookingStatus,
  type DivingCalendarBooking,
  type StoredDivingCalendarBooking,
} from '../../lib/offline/planning-pages';
import styles from './planning-pages.module.css';
import {readCalendarSources,linkCalendarBookingToTrip,setCalendarEntryStatus,type CalendarBooking} from '../../lib/planning/calendar-booking-workflow';
import type {DiveExpeditionTripRecord} from '../../lib/offline/trips-expeditions';
import type {Stored} from '../../lib/offline/dive-planning';
import type {DiveRecord} from '../../lib/offline/dives';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import {CalendarEventText} from './calendar-event-text';
import {CalendarDiveLinks} from './calendar-dive-links';
import {DeletePlanningRecordDialog} from './delete-planning-record-dialog';
import {PlanningConnections} from './planning-connections';
import {PlanningWorkflow} from './planning-workflow';
import {calendarPlanDestination,calendarGasDestination} from '../../lib/planning/planning-start-context';

type Props = { go?: (route: string) => void };
type CalendarView = 'calendar' | 'list' | 'bookings';
type BookingDraft = DivingCalendarBooking & { entityId?: string };

const kinds: Array<[BookingKind, string, string]> = [
  ['dive', 'Dive', 'dive-plan'],
  ['course', 'Course / Training', 'training'],
  ['assessment', 'Assessment', 'verified-log'],
  ['club', 'Club / Centre', 'buddy-team'],
  ['centre', 'Dive centre', 'operator-dive-centre'],
  ['trip', 'Trip / Expedition', 'liveaboard'],
  ['show', 'Event / Show', 'favourite-dive'],
  ['gear-service', 'Gear / Service', 'equipment'],
  ['travel', 'Travel', 'boat'],
  ['other', 'Other', 'other'],
];
const statuses: Array<[BookingStatus, string]> = [
  ['idea', 'Idea'],
  ['planned', 'Planned'],
  ['booked', 'Booked'],
  ['confirmed', 'Confirmed'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
  ['archived', 'Archived'],
];

const localIsoDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
};
const startOfMonth = (value: string) =>
  new Date(`${value.slice(0, 7)}-01T00:00:00`);
const iso = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

function monthDays(month: string) {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return iso(date);
  });
}

function eventLabel(item: StoredDivingCalendarBooking) {
  return `${item.startDate}${item.startAt ? ` · ${item.startAt.slice(11, 16)}` : ''}`;
}

function bookingDraft(item: StoredDivingCalendarBooking | null): BookingDraft {
  const now = new Date().toISOString();
  if (item) return { ...item };
  const date = localIsoDate();
  return {
    name: '',
    bookingKind: 'dive',
    bookingStatus: 'planned',
    planType: 'day-dive',
    startDate: date,
    endDate: date,
    siteName: '',
    locationName: '',
    buddy: '',
    status: 'planned',
    notes: '',
    createdAt: now,
    modifiedAt: now,
  };
}

export function requestedCalendarEventId(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get('eventId') ?? params.get('recordId');
}

/** An explicit unavailable identity must never select a different source. */
export function selectCalendarBooking<T extends { entityId: string }>(
  items: readonly T[], visibleItems: readonly T[], selectedId: string | null,
): T | null {
  return selectedId === null ? visibleItems[0] ?? null : items.find(item => item.entityId === selectedId) ?? null;
}

export function calendarListEntries<T extends {bookingStatus?: string}>(items: readonly T[], showArchived: boolean): T[] {
  return items.filter(item => showArchived || item.bookingStatus !== 'archived');
}

export function DivingCalendarBookings({ go }: Props) {
  const [items, setItems] = useState<CalendarBooking[]>([]);
  const [bookings,setBookings]=useState<StoredDivingCalendarBooking[]>([]);
  const [canonicalPlanIds,setCanonicalPlanIds]=useState<string[]>([]);
  const [trips,setTrips]=useState<Stored<DiveExpeditionTripRecord>[]>([]);
  const [dives,setDives]=useState<Array<DiveRecord&{entityId:string}>>([]);
  const [loadError,setLoadError]=useState('');
  const [requestedId] = useState(() => typeof window === 'undefined' ? null : requestedCalendarEventId(window.location.search));
  const [activeTab, setActiveTab] = useState<CalendarView>(requestedId === null ? 'calendar' : 'list');
  const [month, setMonth] = useState(localIsoDate().slice(0, 7));
  const [filter, setFilter] = useState<BookingKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<
    StoredDivingCalendarBooking | null | undefined
  >(undefined);

  const refresh = useCallback(
    async () => {try{const source=await readCalendarSources();setItems(source.entries);setBookings(source.bookings);setCanonicalPlanIds(source.canonicalPlanIds);setTrips(source.trips);setDives(source.dives);setLoadError('');}catch{setLoadError('Calendar records could not be loaded. Existing records are retained; try reopening this workspace.');}finally{setLoaded(true);}},
    [],
  );
  useRecordRefresh(refresh);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (filter !== 'all' && item.bookingKind !== filter) return false;
        const haystack =
          `${item.name} ${item.siteName} ${item.locationName} ${item.notes} ${item.quickNotes}`.toLowerCase();
        return (
          !query.trim() ||
          haystack.includes(query.trim().toLocaleLowerCase('en-GB'))
        );
      }),
    [items, filter, query],
  );
  const visibleItems = useMemo(() => {
    if (activeTab === 'bookings')
      return filtered.filter((item) =>
        ['planned', 'booked', 'confirmed'].includes(
          item.bookingStatus ?? 'planned',
        ),
      );
    if (activeTab === 'calendar')
      return filtered.filter(
        (item) =>
          item.startDate >= localIsoDate() &&
          !['completed', 'cancelled', 'archived'].includes(
            item.bookingStatus ?? 'planned',
          ),
      );
    return calendarListEntries(filtered, showArchived);
  }, [activeTab, filtered, showArchived]);
  const selected = selectCalendarBooking(items, visibleItems, selectedId);
  const days = monthDays(`${month}-01`);

  function moveMonth(delta: number) {
    const date = startOfMonth(`${month}-01`);
    date.setMonth(date.getMonth() + delta);
    setMonth(iso(date).slice(0, 7));
  }

  if (editing !== undefined) return <BookingEditor
    key={editing?.entityId ?? 'new-booking'}
    item={editing}
    close={() => setEditing(undefined)}
    saved={async () => { setEditing(undefined); await refresh(); }}
  />;
  return (
    <main className={`${styles.page} ${styles.calendarPage}`}>
      <header className={styles.hero}>
        <div className={styles.heroTitle}>
          <ZeusTekIcon id="dive-flag" size="hero" />
          <div>
            <span className="focus-eyebrow">PLANNING</span>
            <h1>Diving Calendar &amp; Bookings</h1>
            <p>
              Track diving dates and bookings, then connect them to the planning
              record you need.
            </p>
          </div>
        </div>
        <button className="focus-primary" onClick={() => setEditing(null)}>
          <Plus size={16} /> Add event
        </button>
      </header>

      {loadError&&<p role="alert">{loadError}</p>}
      <div className={styles.shell}>


        <section className={styles.workArea}>
        <details className={styles.calendarFilters}>
          <summary>Event types</summary>
          <button
            className={filter === 'all' ? styles.activePill : ''}
            onClick={() => setFilter('all')}
          >
            All events
          </button>
          {kinds.map(([value, label, icon]) => (
            <button
              key={value}
              className={filter === value ? styles.activePill : ''}
              onClick={() => setFilter(value)}
            >
              <ZeusTekIcon id={icon} size="chip" />
              {label}
            </button>
          ))}
          <div className={styles.railNote}>
            Events remain lightweight until you link or convert them into a
            Trip, Dive Plan, Gas Plan or training record.
          </div>
        </details>
          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Calendar views"
          >
            {(
              [
                ['calendar', 'Calendar'],
                ['list', 'List'],
                ['bookings', 'Bookings'],
              ] as const
            ).map(([view, label]) => (
              <button
                key={view}
                role="tab"
                aria-selected={activeTab === view}
                className={activeTab === view ? styles.activeTab : ''}
                onClick={() => setActiveTab(view)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.toolbar}>
            <input
              aria-label="Search calendar events"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events…"
            />
            <select
              aria-label="Filter by event type"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as BookingKind | 'all')
              }
            >
              <option value="all">All types</option>
              {kinds.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {activeTab === 'list' && <label style={{display:'flex',alignItems:'center',gap:8,minHeight:44}}><input type="checkbox" checked={showArchived} onChange={event => {setShowArchived(event.target.checked);if(!event.target.checked && selected?.bookingStatus==='archived')setSelectedId(null);}}/>Show archived</label>}
          </div>

          {activeTab === 'calendar' ? (
            <CollapsibleWorkCard
              id="diving-calendar-month"
              title="Calendar"
              eyebrow="BOOKINGS"
              status={`${filtered.length} event(s)`}
              defaultExpanded
            >
              <div className={styles.monthHeader}>
                <button
                  className="focus-secondary"
                  aria-label="Previous month"
                  onClick={() => moveMonth(-1)}
                >
                  ‹
                </button>
                <b>
                  {new Date(`${month}-01T00:00:00`).toLocaleDateString(
                    'en-GB',
                    {
                      month: 'long',
                      year: 'numeric',
                    },
                  )}
                </b>
                <button
                  className="focus-secondary"
                  aria-label="Next month"
                  onClick={() => moveMonth(1)}
                >
                  ›
                </button>
              </div>
              <section className={styles.calendarGridViewport} aria-label="Calendar days"><div className={styles.calendarGrid}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                  (day) => (
                    <strong key={day}>{day}</strong>
                  ),
                )}
                {days.map((day) => {
                  const dayItems = filtered.filter(
                    (item) => item.startDate === day,
                  );
                  return (
                    <button
                      key={day}
                      className={
                        day.slice(0, 7) === month ? '' : styles.outsideMonth
                      }
                      aria-label={`${day}: ${dayItems.length} event(s)`}
                      onClick={() =>
                        dayItems[0] && setSelectedId(dayItems[0].entityId)
                      }
                    >
                      <span>{Number(day.slice(8))}</span>
                      {dayItems.slice(0, 4).map((item) => (
                        <i
                          key={item.entityId}
                          data-kind={item.bookingKind}
                          title={item.name}
                        />
                      ))}
                      {dayItems.length > 4 ? (
                        <em>+{dayItems.length - 4}</em>
                      ) : null}
                    </button>
                  );
                })}
              </div></section>
            </CollapsibleWorkCard>
          ) : null}

          <CollapsibleWorkCard
            id="diving-calendar-events"
            title={
              activeTab === 'calendar'
                ? 'Upcoming events'
                : activeTab === 'bookings'
                  ? 'Active bookings'
                  : 'All events'
            }
            eyebrow="DATES"
            rowCount={visibleItems.length}
            previewLimit={6}
            status={`${visibleItems.length} shown`}
          >
            {({ expanded, previewLimit }) => (
              <div className={styles.eventList}>
                {visibleItems
                  .slice(0, expanded ? visibleItems.length : previewLimit)
                  .map((item) => (
                    <button
                      key={item.entityId}
                      className={
                        selected?.entityId === item.entityId
                          ? styles.selectedRow
                          : ''
                      }
                      onClick={() => setSelectedId(item.entityId)}
                    >
                      <ZeusTekIcon
                        id={
                          kinds.find(
                            ([kind]) => kind === item.bookingKind,
                          )?.[2] ?? 'dive-plan'
                        }
                        size="card"
                      />
                      <span>
                        <b>{item.name}</b>
                        <small>
                          {eventLabel(item)} ·{' '}
                          {item.siteName ||
                            item.locationName ||
                            'Location not set'}
                        </small>
                      </span>
                      <em>
                        {item.calendarLinkConflict?'Needs review':statuses.find(
                          ([value]) => value === item.bookingStatus,
                        )?.[1] ?? 'Planned'}
                      </em>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                {!visibleItems.length ? (
                  <p className={styles.emptyCopy}>No matching events.</p>
                ) : null}
              </div>
            )}
          </CollapsibleWorkCard>
        </section>

        <aside className={styles.detailPane}>
          {selected ? (
            <BookingDetail
              key={selected.entityId}
              item={selected}
              isCanonicalPlan={canonicalPlanIds.includes(selected.entityId)}
              canonicalPlanIds={canonicalPlanIds}
              trips={trips}
              dives={dives}
              go={go}
              edit={() => {if(selected.calendarSource==='dive-trip')go?.(workflowDestinationUrl({route:'Trips',recordId:selected.entityId}));else{const original=bookings.find(row=>row.entityId===selected.entityId);if(original)setEditing(original);}}}
              refresh={refresh}
            />
          ) : (
            <div className={styles.emptyPane}>
              <CalendarDays />
              <h2>{selectedId !== null ? loaded ? 'Linked event unavailable' : 'Loading linked event' : 'No event selected'}</h2>
              <p>{selectedId !== null ? loaded ? 'The exact requested event is unavailable on this device. Choose another event to review it.' : 'Waiting for the exact requested event. No other event has been selected.' : 'Add a booking or choose an event from the calendar.'}</p>
            </div>
          )}
        </aside>
      </div>
      <CalendarDownloadWorkspace go={go}/>
    </main>
  );
}

export function BookingDetail({
  item,
  isCanonicalPlan,
  canonicalPlanIds=[],
  trips,
  dives,
  go,
  edit,
  refresh,
}: {
  item: CalendarBooking;
  isCanonicalPlan:boolean;
  canonicalPlanIds?:string[];
  trips: Stored<DiveExpeditionTripRecord>[];
  dives: Array<DiveRecord&{entityId:string}>;
  go?: Props['go'];
  edit: () => void;
  refresh: () => Promise<void>;
}) {
  const isTraining = ['course', 'assessment'].includes(item.bookingKind ?? '');
  const gasDestination=calendarGasDestination(item,isCanonicalPlan,canonicalPlanIds);
  const [tripId,setTripId]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [deleting,setDeleting]=useState(false);
  const updateStatus = async (status: BookingStatus) => {
    if(busy)return;setBusy(true);setError('');try{await setCalendarEntryStatus(item,status);await refresh();}catch(reason){setError(reason instanceof Error?reason.message:'Event status could not be saved.');}finally{setBusy(false);}
  };
  async function linkTrip(){if(busy||!tripId)return;setBusy(true);setError('');try{await linkCalendarBookingToTrip(item,tripId);await refresh();}catch(reason){setError(reason instanceof Error?reason.message:'Trip link could not be saved.');}finally{setBusy(false);}}
  return (
    <section className={styles.detailCard}>
      <header>
        <ZeusTekIcon id="dive-flag" size="heading" />
        <div>
          <span className="focus-eyebrow">SELECTED EVENT</span>
          <h2>{item.name}</h2>
          <p>{eventLabel(item)}</p>
        </div>
      </header>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>
            {kinds.find(([value]) => value === item.bookingKind)?.[1] ?? 'Dive'}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{item.calendarLinkConflict?'Needs review — multiple Trip associations':item.bookingStatus ?? 'planned'}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{item.siteName || item.locationName || 'Not set'}</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd><CalendarEventText text={item.notes || item.quickNotes || 'No notes yet.'} label="event notes"/></dd>
        </div>
      </dl>
      <PlanningWorkflow/><PlanningConnections recordId={item.entityId} changed={refresh}/>
      <CalendarDiveLinks item={item} dives={dives} refresh={refresh} go={go}/>
      {bookingRecordLinks(item).length>0&&<><h3>Linked records</h3><div className={styles.linkRows}>
        {bookingRecordLinks(item).map(link=><a className="focus-secondary" key={link.label} href={link.href} onClick={go?event=>{event.preventDefault();go(link.destination);}:undefined}>{link.label}<ChevronRight size={14}/></a>)}
      </div></>}
      <h3>Quick actions</h3>
      <div className={styles.actionGrid}>
        <button className="focus-secondary" onClick={() => go?.(calendarPlanDestination(item,isCanonicalPlan))}>
          <Link2 size={14} /> Create/link Dive Plan
        </button>
        {gasDestination?<a className="focus-secondary" href={gasDestination} onClick={go?event=>{event.preventDefault();go(gasDestination);}:undefined}><Link2 size={14}/> Plan gas from this Dive Plan</a>:<><button className="focus-secondary" disabled><Link2 size={14}/> Plan gas from this Dive Plan</button><p>{item.linkedDivePlanId?'Linked Dive Plan unavailable. Open or refresh the exact Plan before planning gas.':'Create or link a Dive Plan before planning gas.'}</p></>}
        {item.linkedTripId?<button className="focus-secondary" onClick={()=>go?.(workflowDestinationUrl({route:'Trips',recordId:item.linkedTripId!}))}><Link2 size={14}/> {item.calendarSource==='dive-trip'?'Open Trip to edit / delete':'Open linked Trip'}</button>:<button className="focus-secondary" disabled={item.calendarLinkConflict} onClick={()=>go?.(workflowDestinationUrl({route:'Trips',params:{fromEventId:item.entityId}}))}><Link2 size={14}/> Create Trip from event</button>}
        {isTraining ? (
          <button
            className="focus-secondary"
            onClick={() => go?.('Course Map')}
          >
            <Link2 size={14} /> Open Planned Training
          </button>
        ) : null}
        <button className="focus-secondary" onClick={isCanonicalPlan?()=>go?.(workflowDestinationUrl({route:'Dive Plans',recordId:item.entityId})):edit}>
          <Pencil size={14} /> {isCanonicalPlan?'Open Dive Plan to edit / delete':item.calendarSource==='dive-trip'?'Edit in Trips':'Edit event'}
        </button>
        {!isCanonicalPlan&&<><button
          className="focus-secondary"
          disabled={busy||item.calendarLinkConflict||item.bookingStatus === 'completed'}
          onClick={() => void updateStatus('completed')}
        >
          <CheckCircle2 size={14} /> Mark complete
        </button>
        <button
          className="focus-secondary danger"
          disabled={busy||item.calendarLinkConflict||item.bookingStatus === 'cancelled'}
          onClick={() => void updateStatus('cancelled')}
        >
          <XCircle size={14} /> Cancel event
        </button>
        {item.calendarSource!=='dive-trip'&&<button
          className="focus-secondary danger"
          disabled={busy||item.calendarLinkConflict||item.bookingStatus === 'archived'}
          onClick={() => void updateStatus('archived')}
        >
          <Archive size={14} /> Archive event
        </button>}
        {item.calendarSource!=='dive-trip'&&<button type="button" className="focus-secondary danger" disabled={busy} onClick={()=>setDeleting(true)}>Delete event</button>}</>}
      </div>
      {item.calendarLinkConflict&&<p role="alert">Multiple Trip associations need review. No new Trip will be created automatically.</p>}
      {!item.linkedTripId&&!item.calendarLinkConflict&&<details className={styles.existingTripLink}><summary>Link an existing Trip</summary><p>Import this event into its itinerary and fill blank Trip summary fields. Existing Trip text and dates are retained.</p><label>Trip<select value={tripId} onChange={e=>setTripId(e.target.value)}><option value="">Choose a Trip</option>{trips.map(trip=><option key={trip.entityId} value={trip.entityId}>{trip.name} · {trip.startsOn||'Undated'}</option>)}</select></label><button type="button" className="focus-secondary" disabled={!tripId||busy} onClick={()=>void linkTrip()}>Link Trip and import event details</button></details>}
      {error&&<p role="alert">{error}</p>}
      {deleting&&!isCanonicalPlan&&item.calendarSource!=='dive-trip'&&<DeletePlanningRecordDialog record={item} label="event" close={()=>setDeleting(false)} deleted={refresh}/>}
    </section>
  );
}

function BookingEditor({
  item,
  close,
  saved,
}: {
  item: StoredDivingCalendarBooking | null;
  close: () => void;
  saved: () => void;
}) {
  const [draft, setDraft] = useState<BookingDraft>(() => bookingDraft(item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function update(patch: Partial<BookingDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await saveDivingCalendarBooking(draft);
      saved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Event could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <RecordEditorWorkspace
      label={item ? 'Edit calendar event' : 'Add calendar event'}
      close={close}
      save={save}
      busy={busy}
      value={draft}
      trackInteractions={false}
      saveLabel="Save event"
      saveDisabled={!draft.name.trim() || !draft.startDate || Boolean(draft.endDate && draft.endDate < draft.startDate)}
    >
        <div>
          <div>
            <span className="focus-eyebrow">BOOKING</span>
            <h2>{item ? 'Edit event' : 'Add event'}</h2>
          </div>
        </div>
        <div className={styles.editorGrid}>
          <label>
            Name
            <input
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          </label>
          <label>
            Type
            <select
              value={draft.bookingKind}
              onChange={(event) =>
                update({ bookingKind: event.target.value as BookingKind })
              }
            >
              {kinds.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={draft.bookingStatus}
              onChange={(event) =>
                update({ bookingStatus: event.target.value as BookingStatus })
              }
            >
              {statuses.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start date
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => update({ startDate: event.target.value })}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              min={draft.startDate}
              value={draft.endDate}
              onChange={(event) => update({ endDate: event.target.value })}
            />
          </label>
          <label>
            Start time
            <input
              type="time"
              value={draft.startAt?.slice(11, 16) ?? ''}
              onChange={(event) =>
                update({
                  startAt: event.target.value
                    ? `${draft.startDate}T${event.target.value}`
                    : '',
                })
              }
            />
          </label>
          <label>
            Location
            <input
              value={draft.siteName}
              onChange={(event) =>
                update({
                  siteName: event.target.value,
                  locationName: event.target.value,
                })
              }
            />
          </label>
          <label className={styles.wide}>
            Notes
            <textarea
              value={draft.notes}
              onChange={(event) => update({ notes: event.target.value })}
            />
          </label>
        </div>
        {error ? (
          <p role="alert" className="focus-notice danger">
            {error}
          </p>
        ) : null}
    </RecordEditorWorkspace>
  );
}
