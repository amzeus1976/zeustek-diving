'use client';

import { Check, Plus, Wrench } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useRecordRefresh } from './record-status';
import {
  equipmentEventsFor,
  latestEquipmentEvents,
  listEquipmentEvents,
  resolveEquipmentEvent,
  saveEquipmentEvent,
  updateEquipmentServiceBaseline,
  type EquipmentEventStatus,
  type EquipmentEventType,
} from '../lib/offline/equipment-events';
import type { EquipmentRecord, Stored } from '../lib/offline/dive-planning';
import styles from './equipment-maintenance-log.module.css';

const eventTypes: Array<[EquipmentEventType, string]> = [
  ['issue', 'Issue'],
  ['fault', 'Fault'],
  ['damage', 'Damage'],
  ['inspection', 'Inspection'],
  ['maintenance', 'Maintenance'],
  ['service', 'Service'],
  ['repair', 'Repair'],
  ['note', 'Note'],
  ['other', 'Other'],
];

const statuses: Array<[EquipmentEventStatus, string]> = [
  ['open', 'Open'],
  ['monitoring', 'Monitoring'],
  ['resolved', 'Resolved'],
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function labelForType(value: EquipmentEventType) {
  return eventTypes.find(([key]) => key === value)?.[1] ?? value;
}

export function EquipmentMaintenanceLog({
  equipment,
  onEquipmentChanged,
}: {
  equipment: Stored<EquipmentRecord>;
  onEquipmentChanged?: () => void;
}) {
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listEquipmentEvents>>>([]);
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'issue' | 'service' | 'resolved'>('all');
  const [resolvingId, setResolvingId] = useState('');
  const [resolveDate, setResolveDate] = useState(today());
  const [resolveNotes, setResolveNotes] = useState('');
  const [eventType, setEventType] = useState<EquipmentEventType>('issue');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState(today());
  const [status, setStatus] = useState<EquipmentEventStatus>('open');
  const [serviceProvider, setServiceProvider] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [updateBaseline, setUpdateBaseline] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(() => {
    void listEquipmentEvents().then(setEvents);
  }, []);
  useRecordRefresh(refresh);

  const allForEquipment = useMemo(
    () => equipmentEventsFor(events, equipment.entityId),
    [events, equipment.entityId],
  );
  const latest = useMemo(
    () => latestEquipmentEvents(events, equipment.entityId, 5),
    [events, equipment.entityId],
  );
  const filtered = useMemo(() => {
    if (filter === 'all') return allForEquipment;
    if (filter === 'open') return allForEquipment.filter((event) => event.status !== 'resolved');
    if (filter === 'resolved') return allForEquipment.filter((event) => event.status === 'resolved');
    if (filter === 'issue') return allForEquipment.filter((event) => ['issue', 'fault', 'damage'].includes(event.eventType));
    return allForEquipment.filter((event) => ['service', 'maintenance', 'inspection', 'repair'].includes(event.eventType));
  }, [allForEquipment, filter]);
  const visible = showAll ? filtered : latest;

  function resetEventForm() {
    setEventType('issue');
    setTitle('');
    setDescription('');
    setOccurredAt(today());
    setStatus('open');
    setServiceProvider('');
    setCost('');
    setCurrency('GBP');
    setUpdateBaseline(false);
    setAdding(false);
  }

  async function addEvent() {
    if (!title.trim() || !occurredAt) return;
    setMessage('Saving event locally…');
    try {
      await saveEquipmentEvent({
        equipmentId: equipment.entityId,
        eventType,
        title: title.trim(),
        description: description.trim(),
        occurredAt,
        status,
        serviceProvider: serviceProvider.trim(),
        cost: cost.trim() === '' ? null : Number(cost),
        currency: currency.trim().toUpperCase() || 'GBP',
        ...(status === 'resolved' ? { resolvedAt: occurredAt } : {}),
      });
      if (eventType === 'service' && updateBaseline) {
        await updateEquipmentServiceBaseline(equipment.entityId, occurredAt);
        onEquipmentChanged?.();
      }
      resetEventForm();
      refresh();
      setMessage(eventType === 'service' && updateBaseline
        ? 'Service event saved and scheduled-service baseline updated.'
        : 'Equipment event saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Equipment event could not be saved.');
    }
  }

  async function resolve(id: string) {
    const event = events.find((candidate) => candidate.entityId === id);
    if (!event || !resolveDate) return;
    setMessage('Resolving event locally…');
    try {
      await resolveEquipmentEvent(event, resolveDate, resolveNotes);
      setResolvingId('');
      setResolveNotes('');
      setResolveDate(today());
      refresh();
      setMessage('Issue resolved; original event history retained.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Issue could not be resolved.');
    }
  }

  return <section className={styles.section} aria-labelledby={`equipment-history-${equipment.entityId}`}>
    <div className={styles.header}>
      <div>
        <span className="focus-eyebrow">ISSUES · SERVICE · MAINTENANCE</span>
        <h3 id={`equipment-history-${equipment.entityId}`}>Equipment history</h3>
        <p className="focus-copy">Recent faults, servicing, inspections, repairs and resolutions for this item.</p>
      </div>
      <button className="focus-primary" onClick={() => setAdding((value) => !value)}>
        <Plus size={15}/> Report issue / event
      </button>
    </div>

    {adding && <div className={styles.form}>
      <label>Type<select value={eventType} onChange={(event) => setEventType(event.target.value as EquipmentEventType)}>{eventTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as EquipmentEventStatus)}>{statuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className={styles.wide}>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. SPG hose leaking"/></label>
      <label className={styles.wide}>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What happened, what was found, or what work was carried out…"/></label>
      <label>Date<input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)}/></label>
      <label>Provider / technician<input value={serviceProvider} onChange={(event) => setServiceProvider(event.target.value)}/></label>
      <label>Cost<input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)}/></label>
      <label>Currency<input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())}/></label>
      {eventType === 'service' && <label className={styles.checkbox}><input type="checkbox" checked={updateBaseline} onChange={(event) => setUpdateBaseline(event.target.checked)}/><span>Update scheduled-service baseline from this service</span></label>}
      <div className={`${styles.actions} ${styles.wide}`}><button className="focus-secondary" onClick={resetEventForm}>Cancel</button><button className="focus-primary" disabled={!title.trim() || !occurredAt} onClick={() => void addEvent()}>Save event</button></div>
    </div>}

    {showAll && <div className={styles.filters} role="group" aria-label="Equipment history filters">
      {[['all','All'],['open','Open'],['issue','Fault / issue'],['service','Service / maintenance'],['resolved','Resolved']].map(([value,label]) => <button key={value} className="focus-secondary" aria-pressed={filter === value} onClick={() => setFilter(value as typeof filter)}>{label}</button>)}
    </div>}

    <div className={styles.events}>
      {visible.map((event) => <article className={styles.event} key={event.entityId}>
        <div className={styles.eventHead}>
          <div><b>{event.title}</b><small>{new Date(`${event.occurredAt}T12:00:00`).toLocaleDateString('en-GB')}</small></div>
          <div className={styles.badges}><span className={styles.badge}>{labelForType(event.eventType)}</span><span className={`${styles.badge} ${event.status === 'resolved' ? styles.resolved : styles.open}`}>{event.status}</span></div>
        </div>
        {event.description && <p className={styles.description}>{event.description}</p>}
        {(event.serviceProvider || event.cost != null) && <small className={styles.meta}>{[event.serviceProvider, event.cost != null ? `${event.currency || 'GBP'} ${event.cost.toFixed(2)}` : ''].filter(Boolean).join(' · ')}</small>}
        {event.resolvedAt && <small className={styles.meta}><Check size={13}/> Resolved {new Date(`${event.resolvedAt}T12:00:00`).toLocaleDateString('en-GB')}{event.resolutionNotes ? ` · ${event.resolutionNotes}` : ''}</small>}
        {event.status !== 'resolved' && <div className={styles.actions}><button className="focus-secondary" onClick={() => { setResolvingId(event.entityId); setResolveDate(today()); setResolveNotes(''); }}>Resolve issue</button></div>}
        {resolvingId === event.entityId && <div className={styles.resolveBox}>
          <label>Resolved date<input type="date" value={resolveDate} onChange={(value) => setResolveDate(value.target.value)}/></label>
          <label className={styles.wide}>Resolution notes<textarea value={resolveNotes} onChange={(value) => setResolveNotes(value.target.value)} placeholder="e.g. Hose replaced and leak test passed"/></label>
          <div className={`${styles.actions} ${styles.wide}`}><button className="focus-secondary" onClick={() => setResolvingId('')}>Keep open</button><button className="focus-primary" onClick={() => void resolve(event.entityId)}>Mark resolved</button></div>
        </div>}
      </article>)}
      {!visible.length && <p className={styles.empty}>{showAll && filter !== 'all' ? 'No events match this filter.' : 'No issues or maintenance events recorded yet.'}</p>}
    </div>

    {allForEquipment.length > 5 && <div className={styles.actions}><button className="focus-link" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show latest five' : `More… view full log (${allForEquipment.length})`}</button></div>}
    {message && <p className="focus-notice" role="status"><Wrench size={14}/>{message}</p>}
  </section>;
}
