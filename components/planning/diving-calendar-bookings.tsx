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
import { useRecordRefresh } from '../record-status';
import { CollapsibleWorkCard } from '../workflow/collapsible-work-card';
import { ZeusTekIcon } from '../zeustek-icon';
import {
  archiveDivingCalendarBooking,
  listDivingCalendarBookings,
  saveDivingCalendarBooking,
  setDivingCalendarBookingStatus,
  type BookingKind,
  type BookingStatus,
  type DivingCalendarBooking,
  type StoredDivingCalendarBooking,
} from '../../lib/offline/planning-pages';
import styles from './planning-pages.module.css';

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

export function DivingCalendarBookings({ go }: Props) {
  const [items, setItems] = useState<StoredDivingCalendarBooking[]>([]);
  const [activeTab, setActiveTab] = useState<CalendarView>('calendar');
  const [month, setMonth] = useState(localIsoDate().slice(0, 7));
  const [filter, setFilter] = useState<BookingKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<
    StoredDivingCalendarBooking | null | undefined
  >(undefined);

  const refresh = useCallback(
    async () => setItems(await listDivingCalendarBookings()),
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
    return filtered;
  }, [activeTab, filtered]);
  const selected =
    items.find((item) => item.entityId === selectedId) ??
    visibleItems[0] ??
    null;
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
    <main className={styles.page}>
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

      <div className={styles.shell}>
        <aside className={styles.sideRail}>
          <h2>Event types</h2>
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
        </aside>

        <section className={styles.workArea}>
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
              <div className={styles.calendarGrid}>
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
              </div>
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
                        {statuses.find(
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
              item={selected}
              go={go}
              edit={() => setEditing(selected)}
              refresh={refresh}
            />
          ) : (
            <div className={styles.emptyPane}>
              <CalendarDays />
              <h2>No event selected</h2>
              <p>Add a booking or choose an event from the calendar.</p>
            </div>
          )}
        </aside>
      </div>

    </main>
  );
}

function BookingDetail({
  item,
  go,
  edit,
  refresh,
}: {
  item: StoredDivingCalendarBooking;
  go?: Props['go'];
  edit: () => void;
  refresh: () => Promise<void>;
}) {
  const isTraining = ['course', 'assessment'].includes(item.bookingKind ?? '');
  const updateStatus = async (status: BookingStatus) => {
    await setDivingCalendarBookingStatus(item, status);
    await refresh();
  };
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
          <dd>{item.bookingStatus ?? 'planned'}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{item.siteName || item.locationName || 'Not set'}</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{item.notes || item.quickNotes || 'No notes yet.'}</dd>
        </div>
      </dl>
      {bookingRecordLinks(item).length>0&&<><h3>Linked records</h3><div className={styles.linkRows}>
        {bookingRecordLinks(item).map(link=><a className="focus-secondary" key={link.label} href={link.href} onClick={go?event=>{event.preventDefault();go(link.destination);}:undefined}>{link.label}<ChevronRight size={14}/></a>)}
      </div></>}
      <h3>Quick actions</h3>
      <div className={styles.actionGrid}>
        <button className="focus-secondary" onClick={() => go?.('Dive Plans')}>
          <Link2 size={14} /> Create/link Dive Plan
        </button>
        <button
          className="focus-secondary"
          onClick={() => go?.('Gas Planning')}
        >
          <Link2 size={14} /> Create/link Gas Plan
        </button>
        <button className="focus-secondary" onClick={() => go?.('Trips')}>
          <Link2 size={14} /> Convert/link Trip
        </button>
        {isTraining ? (
          <button
            className="focus-secondary"
            onClick={() => go?.('Course Map')}
          >
            <Link2 size={14} /> Open Planned Training
          </button>
        ) : null}
        <button className="focus-secondary" onClick={edit}>
          <Pencil size={14} /> Edit event
        </button>
        <button
          className="focus-secondary"
          disabled={item.bookingStatus === 'completed'}
          onClick={() => void updateStatus('completed')}
        >
          <CheckCircle2 size={14} /> Mark complete
        </button>
        <button
          className="focus-secondary danger"
          disabled={item.bookingStatus === 'cancelled'}
          onClick={() => void updateStatus('cancelled')}
        >
          <XCircle size={14} /> Cancel event
        </button>
        <button
          className="focus-secondary danger"
          disabled={item.bookingStatus === 'archived'}
          onClick={() => void archiveDivingCalendarBooking(item).then(refresh)}
        >
          <Archive size={14} /> Archive event
        </button>
      </div>
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
