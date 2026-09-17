'use client';

import {
  CalendarDays,
  Check,
  FileText,
  MapPin,
  Pencil,
  Plus,
  ShipWheel,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { AccessibleDialog } from './accessible-dialog';
import { ZeusTekIcon } from './zeustek-icon';
import { MediaGallery } from './media-gallery';
import { TripResources, TripLinksEditor } from './trip-resources';
import { TripLinkedSites } from './trip-linked-sites';
import { TripNote, TripSection } from './trip-disclosure';
import { WorkflowContextStrip } from './workflow/workflow-context-strip';
import { resolveZeusTekIconId } from '../lib/zeustek-icons';
import { cleanupTripMedia } from '../lib/offline/trip-attachments';
import { useRecordRefresh } from './record-status';
import {
  listDiveSites,
  listDiveTrips,
  listEquipment,
  listEquipmentSets,
  listPeople,
  type DiveSiteRecord,
  type DiveTripRecord,
  type EquipmentRecord,
  type EquipmentSetRecord,
  type PersonRecord,
  type Stored,
} from '../lib/offline/dive-planning';
import { currentDiveAccount } from '../lib/offline/dive-store';
import {
  deleteDiveExpeditionTrip,
  editableDiveExpeditionTrip,
  listDiveExpeditionTrips,
  normaliseTripGuestParticipants,
  sameTripFingerprint,
  saveDiveExpeditionTrip,
  tripOrganiserReferences,
  tripReadiness,
  type DiveExpeditionTripInput,
  type DiveExpeditionTripRecord,
  type DiveExpeditionTripStatus,
  type TripBooking,
  type TripGasLogisticsItem,
  type TripGuestParticipant,
  type TripItinerarySegment,
  type TripPackingItem,
} from '../lib/offline/trips-expeditions';
import styles from './trips-expeditions.module.css';

const statuses: Array<[DiveExpeditionTripStatus, string]> = [
  ['draft', 'Draft'],
  ['planned', 'Planned'],
  ['confirmed', 'Confirmed'],
  ['active', 'Active'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const itineraryKinds: Array<[TripItinerarySegment['kind'], string]> = [
  ['travel', 'Travel'],
  ['transfer', 'Transfer'],
  ['accommodation', 'Accommodation'],
  ['dive', 'Dive'],
  ['meal', 'Meal'],
  ['activity', 'Activity / excursion'],
  ['training', 'Training'],
  ['meeting', 'Meeting'],
  ['rest', 'Rest / free time'],
  ['other', 'Other'],
];

const guestRoles: Array<[TripGuestParticipant['role'], string]> = [
  ['non-diver', 'Non-diver'],
  ['family-guest', 'Family / guest'],
  ['surface-support', 'Surface support'],
  ['driver', 'Driver'],
  ['photographer', 'Photographer'],
  ['other', 'Other'],
];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string | undefined }) {
  return <section className={`focus-card ${className}`}>{children}</section>;
}

function recordHref(section: string, key: string, id: string) {
  const query = new URLSearchParams({ section, [key]: id });
  return `/?${query.toString()}`;
}

function dateLabel(value?: string | null) {
  if (!value) return 'Not set';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function itineraryKindLabel(kind: TripItinerarySegment['kind']) {
  return itineraryKinds.find(([value]) => value === kind)?.[1] ?? kind;
}

function guestRoleLabel(role: TripGuestParticipant['role']) {
  return guestRoles.find(([value]) => value === role)?.[1] ?? role;
}

function newItinerary(): TripItinerarySegment {
  return { id: crypto.randomUUID(), kind: 'travel', title: '', startsAt: '', endsAt: '', location: '', bookingRef: '', notes: '' };
}
function newGuest(): TripGuestParticipant {
  return { id: crypto.randomUUID(), name: '', role: 'non-diver', notes: '' };
}
function newBooking(): TripBooking {
  return { id: crypto.randomUUID(), kind: 'travel', provider: '', reference: '', amount: null, currency: 'GBP', paid: false, dueOn: '', notes: '' };
}
function newPackingItem(): TripPackingItem {
  return { id: crypto.randomUUID(), equipmentId: '', equipmentSetId: '', label: '', quantity: 1, packed: false, notes: '' };
}
function newGasItem(): TripGasLogisticsItem {
  return { id: crypto.randomUUID(), label: '', equipmentId: '', gas: '', plannedFillBar: null, fillProvider: '', booked: false, notes: '' };
}

const emptyTrip = (): DiveExpeditionTripInput => ({
  name: '', destination: '', startsOn: null, endsOn: null, status: 'draft',
  organiserPersonId: '', organiserUserId: '', teamPersonIds: [], guestParticipants: [], siteIds: [], planIds: [], accommodation: '',
  itinerary: [], bookings: [], packingEquipmentSetIds: [], packingItems: [], gasLogistics: [],
  documentAttachmentIds: [], emergencyNotes: '', insuranceNotes: '', medicalNotes: '', notes: '',
});

export function TripsExpeditions({ go }: { go?: (next: string) => void }) {
  const currentUserId = currentDiveAccount();
  const [items, setItems] = useState<Array<Stored<DiveExpeditionTripRecord>>>([]);
  const [plans, setPlans] = useState<Array<Stored<DiveTripRecord>>>([]);
  const [sites, setSites] = useState<Array<Stored<DiveSiteRecord>>>([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [equipment, setEquipment] = useState<Array<Stored<EquipmentRecord>>>([]);
  const [equipmentSets, setEquipmentSets] = useState<Array<Stored<EquipmentSetRecord>>>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('soonest');
  const [editing, setEditing] = useState<Stored<DiveExpeditionTripRecord> | null>(null);
  const [viewing, setViewing] = useState<Stored<DiveExpeditionTripRecord> | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(() => {
    void Promise.all([
      listDiveExpeditionTrips(), listDiveTrips(), listDiveSites(), listPeople(), listEquipment(), listEquipmentSets(),
    ]).then(([nextTrips, nextPlans, nextSites, nextPeople, nextEquipment, nextSets]) => {
      setItems(nextTrips); setPlans(nextPlans); setSites(nextSites); setPeople(nextPeople);
      setEquipment(nextEquipment); setEquipmentSets(nextSets);
      setViewing((current) => current ? nextTrips.find((item) => item.entityId === current.entityId) ?? null : null);
    });
  }, []);
  useRecordRefresh(refresh);

  const visible = useMemo(() => items.filter((item) => {
    const term = search.trim().toLocaleLowerCase('en-GB');
    const matchesText = !term || [item.name, item.destination, item.accommodation, item.notes]
      .filter(Boolean).join(' ').toLocaleLowerCase('en-GB').includes(term);
    return matchesText && (status === 'all' || item.status === status);
  }).sort((a, b) => {
    if (sort === 'latest') return (b.startsOn ?? '').localeCompare(a.startsOn ?? '');
    if (sort === 'name') return a.name.localeCompare(b.name);
    return (a.startsOn ?? '9999').localeCompare(b.startsOn ?? '9999') || a.name.localeCompare(b.name);
  }), [items, search, status, sort]);

  async function remove(item: Stored<DiveExpeditionTripRecord>) {
    if (!window.confirm(`Delete ${item.name}? Linked Plans, Sites, People and Equipment will not be deleted.`)) return;
    await deleteDiveExpeditionTrip(item.entityId);
    await cleanupTripMedia(item.entityId,item.itinerary.map(segment => segment.id));
    setViewing(null); refresh();
  }

  async function togglePacked(item: Stored<DiveExpeditionTripRecord>, packingId: string) {
    const packingItems = item.packingItems.map((packing) => packing.id === packingId
      ? { ...packing, packed: !packing.packed, checkedAt: !packing.packed ? new Date().toISOString() : undefined }
      : packing);
    await saveDiveExpeditionTrip({ ...editableDiveExpeditionTrip(item), packingItems });
    refresh();
  }

  async function changeDocuments(item: Stored<DiveExpeditionTripRecord>, ids: string[], removeId?: string) {
    const documentAttachmentIds = removeId
      ? item.documentAttachmentIds.filter((id) => id !== removeId)
      : [...new Set([...item.documentAttachmentIds, ...ids])];
    await saveDiveExpeditionTrip({ ...editableDiveExpeditionTrip(item), documentAttachmentIds });
    refresh();
  }

  return <>
    <header className="focus-heading">
      <div className="focus-heading-title"><ZeusTekIcon id="liveaboard" size="heading"/><div><span>TRAVEL · DIVING · LOGISTICS</span><h1>Trips &amp; expeditions</h1>
        <p>Keep your travel, plans, team and packing together.</p></div></div>
      <button className="focus-primary" onClick={() => { setEditing(null); setAdding(true); }}><Plus size={16}/> New trip</button>
    </header>
    <WorkflowContextStrip from={[{label:'Diving Calendar & Bookings',route:'Diving Calendar & Bookings'}]} current="Trips & Expeditions" next={[{label:'Create or link Dive Plan',route:'Dive Plans'},{label:'Sites',route:'Sites'},{label:'People & Operators',route:'People'},{label:'Loadouts & Cylinder Gas',route:'Loadouts & Gas'}]} go={go??(()=>undefined)}/>

    <Card className={styles.toolbar}>
      <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Trip or destination"/></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All trips</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="soonest">Soonest first</option><option value="latest">Latest first</option><option value="name">Name</option></select></label>
    </Card>

    {adding && <TripEditor
      item={editing} items={items} plans={plans} sites={sites} people={people}
      equipment={equipment} equipmentSets={equipmentSets} currentUserId={currentUserId}
      close={() => { setAdding(false); setEditing(null); }} saved={refresh}
    />}

    <div className={styles.grid}>
      {visible.map((item) => {
        const readiness = tripReadiness(item);
        const participantCount = item.teamPersonIds.length + (item.guestParticipants?.filter((guest) => guest.name.trim()).length ?? 0);
        return <Card key={item.entityId} className={`${styles.tripCard} clickable-card`}>
          <button className="card-hit" aria-label={`Open ${item.name}`} onClick={() => setViewing(item)}/>
          <div className="focus-card-head"><ZeusTekIcon id={resolveZeusTekIconId(`${item.name} ${item.destination}`, 'dive-plan')} size="card"/><div className="record-actions">
            <button aria-label={`Edit ${item.name}`} onClick={() => { setEditing(item); setAdding(true); }}><Pencil size={15}/></button>
            <button aria-label={`Delete ${item.name}`} onClick={() => void remove(item)}><Trash2 size={15}/></button>
          </div></div>
          <span className="focus-eyebrow">{item.status.toUpperCase()}</span><h2>{item.name}</h2>
          <p>{item.destination || 'Destination not recorded'}</p>
          <div className={styles.dates}><CalendarDays size={15}/><span>{dateLabel(item.startsOn)} → {dateLabel(item.endsOn)}</span></div>
          <div className={styles.readinessMini}><span>Readiness</span><strong>{readiness.percent}%</strong><progress value={readiness.percent} max="100" aria-label={`${readiness.percent}% trip readiness`}/></div>
          <div className={styles.chips}><span>{item.planIds.length} plans</span><span>{item.siteIds.length} sites</span><span>{participantCount} people</span></div>
        </Card>;
      })}
    </div>
    {!visible.length && !adding && <Card className="focus-empty"><ShipWheel size={32}/><h2>{items.length ? 'No matching trips' : 'No trips yet'}</h2><p>Create a UK day trip, liveaboard, holiday or expedition and link the records you already have.</p></Card>}

    {viewing && <TripDetail item={viewing} plans={plans} sites={sites} people={people} equipment={equipment} equipmentSets={equipmentSets} currentUserId={currentUserId}
      close={() => setViewing(null)} edit={() => { setEditing(viewing); setViewing(null); setAdding(true); }}
      remove={() => void remove(viewing)} togglePacked={(id) => void togglePacked(viewing, id)}
      addDocuments={(ids) => changeDocuments(viewing, ids)} removeDocument={(id) => changeDocuments(viewing, [], id)} changed={refresh} />}
  </>;
}

function TripDetail({ item, plans, sites, people, equipment, equipmentSets, currentUserId, close, edit, remove, togglePacked, addDocuments, removeDocument, changed }: {
  item: Stored<DiveExpeditionTripRecord>;
  plans: Array<Stored<DiveTripRecord>>; sites: Array<Stored<DiveSiteRecord>>; people: Array<Stored<PersonRecord>>;
  equipment: Array<Stored<EquipmentRecord>>; equipmentSets: Array<Stored<EquipmentSetRecord>>; currentUserId: string;
  close: () => void; edit: () => void; remove: () => void; togglePacked: (id: string) => void;
  addDocuments: (ids: string[]) => Promise<void>; removeDocument: (id: string) => Promise<void>;
  changed: () => void;
}) {
  const [pendingScopes,setPendingScopes] = useState<Record<string,boolean>>({});
  const pendingChanged = (key: string, pending: boolean) => setPendingScopes(current => current[key] === pending ? current : {...current,[key]:pending});
  const readiness = tripReadiness(item);
  const organiser = people.find((person) => person.entityId === item.organiserPersonId);
  const guests = (item.guestParticipants ?? []).filter((guest) => guest.name.trim());
  const organiserIsCurrentUser = Boolean(item.organiserUserId && item.organiserUserId === currentUserId);
  return <AccessibleDialog editable={Object.values(pendingScopes).some(Boolean)} dirty={Object.values(pendingScopes).some(Boolean)} className={`focus-modal ${styles.detail}`} label={`${item.name} trip details`} close={close}>
    <header className={styles.hero}><div><span className="focus-eyebrow">{item.status.toUpperCase()}</span><h2>{item.name}</h2><p>{item.destination || 'Destination not recorded'} · {dateLabel(item.startsOn)} → {dateLabel(item.endsOn)}</p></div><button className="focus-icon" data-dialog-close aria-label="Close trip" onClick={close}><X/></button></header>

    <TripSection title="Upcoming itinerary">{item.itinerary.length ? <div className={styles.stack}>{[...item.itinerary].sort((a,b)=>(a.startsAt??'').localeCompare(b.startsAt??'')).map((segment) => <article key={segment.id}><small className={styles.itineraryKind}>{itineraryKindLabel(segment.kind)}</small><details><summary>{segment.title || itineraryKindLabel(segment.kind)} · {segment.attachments?.filter(asset => asset.contentType.startsWith('image/')).length ?? 0} images · {segment.attachments?.filter(asset => asset.contentType.startsWith('video/')).length ?? 0} videos · {segment.attachments?.filter(asset => !asset.contentType.startsWith('image/') && !asset.contentType.startsWith('video/')).length ?? 0} documents · {segment.links?.length ?? 0} links</summary><span>{[segment.startsAt && new Date(segment.startsAt).toLocaleString('en-GB'), segment.location].filter(Boolean).join(' · ')}</span>{segment.notes && <TripNote text={segment.notes} label="itinerary notes"/>}<TripResources tripId={item.entityId} itineraryId={segment.id} attachments={segment.attachments} links={segment.links} changed={changed} pendingChanged={pending => pendingChanged(segment.id,pending)}/></details></article>)}</div> : <p className="focus-copy">No itinerary segments yet.</p>}</TripSection>

    <TripSection title="Readiness · advisory"><div className={styles.readiness}><div><strong>{readiness.percent}%</strong><span>{readiness.state.replace('-', ' ')}</span></div><progress value={readiness.percent} max="100" aria-label="Trip logistics readiness"/><div className={styles.checks}>{readiness.checks.map((check) => <span key={check.id} className={check.complete ? styles.complete : ''}>{check.complete ? <Check size={14}/> : <span aria-hidden="true">○</span>}<b>{check.label}</b><small>{check.detail}</small></span>)}</div></div></TripSection>

    <TripSection title="Linked Plans & Linked Sites"><div className={styles.linkColumns}><div><h3>Linked Plans</h3>{item.planIds.map((id) => { const plan=plans.find((candidate)=>candidate.entityId===id); return <a className="focus-link" key={id} href={recordHref('Dive Plans','planId',id)}>{plan?.name ?? 'Plan unavailable'}</a>; })}{!item.planIds.length&&<p className="focus-copy">No Plans linked.</p>}</div>
      <TripLinkedSites siteIds={item.siteIds} sites={sites}/></div></TripSection>

    <TripSection title="Team">
      {(item.organiserUserId || organiser) && <p><b>Organiser:</b> {organiserIsCurrentUser ? 'Me (this account)' : organiser ? <a className="focus-link" href={recordHref('People','personId',organiser.entityId)}>{organiser.name}</a> : 'Account organiser'}</p>}
      {!!item.teamPersonIds.length && <><h4>Diving team</h4><div className={styles.chips}>{item.teamPersonIds.map((id)=>{const person=people.find((candidate)=>candidate.entityId===id);return <a key={id} href={recordHref('People','personId',id)}>{person?.name ?? 'Person unavailable'}</a>;})}</div></>}
      {!!guests.length && <><h4>Non-diving participants</h4><div className={styles.guestList}>{guests.map((guest)=><article key={guest.id}><b>{guest.name}</b><small>{guestRoleLabel(guest.role)}</small>{guest.notes&&<TripNote text={guest.notes} label="participant notes"/>}</article>)}</div></>}
      {!item.teamPersonIds.length&&!guests.length&&<p className="focus-copy">No team members or guests linked.</p>}
    </TripSection>

    <TripSection title="Equipment & packing">{item.packingEquipmentSetIds.length>0&&<div className={styles.chips}>{item.packingEquipmentSetIds.map((id)=><a key={id} href="/?section=Equipment"><Wrench size={13}/>{equipmentSets.find((set)=>set.entityId===id)?.name ?? 'Loadout unavailable'}</a>)}</div>}
      <div className={styles.packing}>{item.packingItems.map((packing)=><div key={packing.id}><label><input type="checkbox" checked={packing.packed} onChange={()=>togglePacked(packing.id)}/><span><b>{packing.label || equipment.find((gear)=>gear.entityId===packing.equipmentId)?.name || 'Packing item'}</b><small>{packing.quantity && packing.quantity>1?`Qty ${packing.quantity}`:''}</small></span></label>{packing.notes&&<TripNote text={packing.notes} label="packing notes"/>}</div>)}</div>{!item.packingItems.length&&!item.packingEquipmentSetIds.length&&<p className="focus-copy">No packing list yet.</p>}
    </TripSection>

    <TripSection title="Gas & fill logistics">{item.gasLogistics.length?<div className={styles.stack}>{item.gasLogistics.map((gas)=><article key={gas.id}><b>{gas.label || gas.gas || 'Gas requirement'}</b><span>{[gas.gas,gas.plannedFillBar!=null?`${gas.plannedFillBar} bar`:'',gas.fillProvider,gas.booked?'Booked':''].filter(Boolean).join(' · ')}</span>{gas.notes&&<TripNote text={gas.notes} label="gas logistics notes"/>}</article>)}</div>:<p className="focus-copy">No gas logistics recorded.</p>}</TripSection>

    <TripSection title="Bookings & accommodation">{item.accommodation&&<TripNote text={item.accommodation} label="accommodation notes"/>}{item.bookings.length?<div className={styles.stack}>{item.bookings.map((booking)=><article key={booking.id}><b>{booking.provider || booking.kind}</b><span>{[booking.reference,booking.amount!=null?`${booking.currency||'GBP'} ${booking.amount.toFixed(2)}`:'',booking.paid?'Paid':'',booking.dueOn?`Due ${booking.dueOn}`:''].filter(Boolean).join(' · ')}</span>{booking.notes&&<TripNote text={booking.notes} label="booking notes"/>}</article>)}</div>:<p className="focus-copy">No bookings recorded.</p>}</TripSection>

    <TripSection title="Trip documents & links"><TripResources tripId={item.entityId} attachments={item.attachments} links={item.links} changed={changed} pendingChanged={pending => pendingChanged('trip',pending)}/></TripSection>

    <TripSection title="Emergency, insurance & notes"><div className={styles.notes}><div><small>Emergency</small><TripNote text={item.emergencyNotes || 'Not recorded'} label="emergency notes"/></div><div><small>Insurance</small><TripNote text={item.insuranceNotes || 'Not recorded'} label="insurance notes"/></div><div><small>Medical / travel documents</small><TripNote text={item.medicalNotes || 'Not recorded'} label="medical notes"/></div><div><small>Trip notes</small><TripNote text={item.notes || 'Not recorded'} label="Trip notes"/></div></div></TripSection>

    <footer><button className="focus-secondary danger" data-dialog-close onClick={remove}><Trash2 size={15}/> Delete</button><span/><button className="focus-secondary" data-dialog-close onClick={close}>Close</button><button className="focus-primary" data-dialog-close onClick={edit}><Pencil size={15}/> Edit trip</button></footer>
  </AccessibleDialog>;
}

function TripEditor({ item, items, plans, sites, people, equipment, equipmentSets, currentUserId, close, saved }: {
  item: Stored<DiveExpeditionTripRecord> | null;
  items: Array<Stored<DiveExpeditionTripRecord>>; plans: Array<Stored<DiveTripRecord>>; sites: Array<Stored<DiveSiteRecord>>;
  people: Array<Stored<PersonRecord>>; equipment: Array<Stored<EquipmentRecord>>; equipmentSets: Array<Stored<EquipmentSetRecord>>; currentUserId: string;
  close: () => void; saved: () => void;
}) {
  const initial = item ? editableDiveExpeditionTrip(item) : emptyTrip();
  const [value, setValue] = useState(initial);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const set = <K extends keyof DiveExpeditionTripInput>(key: K, next: DiveExpeditionTripInput[K]) => setValue((current) => ({ ...current, [key]: next }));
  const toggle = (key: 'teamPersonIds'|'siteIds'|'planIds'|'packingEquipmentSetIds', id: string, checked: boolean) => set(key, checked ? [...new Set([...value[key],id])] : value[key].filter((entry)=>entry!==id));
  const guests = value.guestParticipants ?? [];
  const organiserValue = value.organiserUserId && value.organiserUserId === currentUserId ? '__current_user__' : value.organiserPersonId ?? '';

  async function submit() {
    if (!value.name.trim() || busy) return;
    if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) { setMessage('End date cannot be before the start date.'); return; }
    const duplicate = !item && items.find((candidate) => sameTripFingerprint(candidate, value as DiveExpeditionTripRecord));
    if (duplicate && !window.confirm(`A similar Trip already exists: “${duplicate.name}”. Save another Trip anyway?`)) return;
    setBusy(true); setMessage('Saving locally…');
    try {
      await saveDiveExpeditionTrip({ ...value, guestParticipants: normaliseTripGuestParticipants(guests), name:value.name.trim(), destination:value.destination?.trim()||'', accommodation:value.accommodation?.trim()||'', emergencyNotes:value.emergencyNotes?.trim()||'', insuranceNotes:value.insuranceNotes?.trim()||'', medicalNotes:value.medicalNotes?.trim()||'', notes:value.notes?.trim()||'' });
      if (item) await cleanupTripMedia(item.entityId,item.itinerary.filter(segment => !value.itinerary.some(next => next.id === segment.id)).map(segment => segment.id),false);
      saved(); close();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Trip could not be saved.'); }
    finally { setBusy(false); }
  }

  return <div className="focus-modal-bg"><AccessibleDialog editable dirty={dirty} className={`focus-modal record-form ${styles.editor}`} label={item?'Edit trip':'New trip'} close={close}>
    <div className="record-form-head"><div><span className="focus-eyebrow">{item?'EDIT TRIP':'NEW TRIP'}</span><h3>{item?'Update trip logistics':'Create trip or expedition'}</h3></div><button className="focus-icon" aria-label="Close editor" data-dialog-close onClick={close}><X/></button></div>
    <div className="record-fields"><label>Name<input value={value.name} onChange={(e)=>set('name',e.target.value)} placeholder="Farne Islands weekend"/></label><label>Destination<input value={value.destination??''} onChange={(e)=>set('destination',e.target.value)}/></label><label>Starts<input type="date" value={value.startsOn??''} onChange={(e)=>set('startsOn',e.target.value||null)}/></label><label>Ends<input type="date" value={value.endsOn??''} onChange={(e)=>set('endsOn',e.target.value||null)}/></label><label>Status<select value={value.status} onChange={(e)=>set('status',e.target.value as DiveExpeditionTripStatus)}>{statuses.map(([status,label])=><option key={status} value={status}>{label}</option>)}</select></label><label>Organiser<select value={organiserValue} onChange={(e)=>{const next=e.target.value;const selection=next==='__current_user__'?{kind:'account' as const,id:currentUserId}:next?{kind:'person' as const,id:next}:{kind:'none' as const};setValue((current)=>({...current,...tripOrganiserReferences(selection)}));}}><option value="">Not recorded</option>{currentUserId&&<option value="__current_user__">Me (this account)</option>}{people.map((person)=><option key={person.entityId} value={person.entityId}>{person.name}</option>)}</select></label><label className="record-wide">Accommodation<textarea value={value.accommodation??''} onChange={(e)=>set('accommodation',e.target.value)} placeholder="Hotel, liveaboard, campsite or meeting arrangements"/></label></div>

    <EditorChoices title="Diving team" icon={<Users size={17}/>} empty="Add People first if the diving team is not listed.">{people.map((person)=><label key={person.entityId}><input type="checkbox" checked={value.teamPersonIds.includes(person.entityId)} onChange={(e)=>toggle('teamPersonIds',person.entityId,e.target.checked)}/><span><b>{person.name}</b><small>{person.role}</small></span></label>)}</EditorChoices>

    <RepeatSection title="Non-diving participants" addLabel="Add non-diver" add={()=>set('guestParticipants',[...guests,newGuest()])}>{guests.map((guest,index)=><div className={styles.repeatRow} key={guest.id}><label>Name<input value={guest.name} onChange={(e)=>set('guestParticipants',guests.map((row,i)=>i===index?{...row,name:e.target.value}:row))} placeholder="Guest name"/></label><label>Role<select value={guest.role} onChange={(e)=>set('guestParticipants',guests.map((row,i)=>i===index?{...row,role:e.target.value as TripGuestParticipant['role']}:row))}>{guestRoles.map(([role,label])=><option key={role} value={role}>{label}</option>)}</select></label><label className="record-wide">Notes<textarea value={guest.notes??''} onChange={(e)=>set('guestParticipants',guests.map((row,i)=>i===index?{...row,notes:e.target.value}:row))} placeholder="Relationship, surface-support role, travel notes…"/></label><button className="focus-secondary danger" onClick={()=>set('guestParticipants',guests.filter((_,i)=>i!==index))}><Trash2 size={14}/> Remove</button></div>)}</RepeatSection>

    <EditorChoices title="Linked sites" icon={<MapPin size={17}/>} empty="Add Sites first if needed.">{sites.map((site)=><label key={site.entityId}><input type="checkbox" checked={value.siteIds.includes(site.entityId)} onChange={(e)=>toggle('siteIds',site.entityId,e.target.checked)}/><span><b>{site.name}</b><small>{site.location}</small></span></label>)}</EditorChoices>
    <EditorChoices title="Linked Dive Plans" icon={<CalendarDays size={17}/>} empty="Plans stay canonical on Dive Plans.">{plans.map((plan)=><label key={plan.entityId}><input type="checkbox" checked={value.planIds.includes(plan.entityId)} onChange={(e)=>toggle('planIds',plan.entityId,e.target.checked)}/><span><b>{plan.name}</b><small>{plan.startDate} · {plan.siteName}</small></span></label>)}</EditorChoices>
    <EditorChoices title="Reusable loadouts" icon={<Wrench size={17}/>} empty="Create Equipment Sets first if useful.">{equipmentSets.map((setRecord)=><label key={setRecord.entityId}><input type="checkbox" checked={value.packingEquipmentSetIds.includes(setRecord.entityId)} onChange={(e)=>toggle('packingEquipmentSetIds',setRecord.entityId,e.target.checked)}/><span><b>{setRecord.name}</b><small>{setRecord.equipmentIds.length} items</small></span></label>)}</EditorChoices>

    <RepeatSection title="Itinerary" addLabel="Add itinerary event" add={()=>set('itinerary',[...value.itinerary,newItinerary()])}>{value.itinerary.map((segment,index)=><div className={styles.repeatRow} key={segment.id}>
      <label>Type<select value={segment.kind} onChange={(e)=>set('itinerary',value.itinerary.map((row,i)=>i===index?{...row,kind:e.target.value as TripItinerarySegment['kind']}:row))}>{itineraryKinds.map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></label>
      {segment.kind==='travel'&&<label>Travel mode<select value={segment.travelMode??''} onChange={e=>set('itinerary',value.itinerary.map((row,i)=>i===index?{...row,travelMode:e.target.value as NonNullable<TripItinerarySegment['travelMode']>}:row))}><option value="">Not specified</option><option value="flight">Flight</option><option value="rail">Rail</option><option value="road">Road</option><option value="sea">Sea</option><option value="other">Other</option></select></label>}
      <label>Title<input value={segment.title} onChange={(e)=>set('itinerary',value.itinerary.map((row,i)=>i===index?{...row,title:e.target.value}:row))} placeholder="e.g. Desert camel safari"/></label>
      <label>Starts<input type="datetime-local" value={segment.startsAt??''} onChange={(e)=>set('itinerary',value.itinerary.map((row,i)=>i===index?{...row,startsAt:e.target.value}:row))}/></label>
      <label>Ends<input type="datetime-local" value={segment.endsAt??''} onChange={(e)=>set('itinerary',value.itinerary.map((row,i)=>i===index?{...row,endsAt:e.target.value}:row))}/></label>
      <label>Location<input value={segment.location??''} onChange={(e)=>set('itinerary',value.itinerary.map((row,i)=>i===index?{...row,location:e.target.value}:row))}/></label>
      <label>Booking ref<input value={segment.bookingRef??''} onChange={(e)=>set('itinerary',value.itinerary.map((row,i)=>i===index?{...row,bookingRef:e.target.value}:row))}/></label>
      <label className="record-wide">Notes<textarea value={segment.notes??''} onChange={(e)=>set('itinerary',value.itinerary.map((row,i)=>i===index?{...row,notes:e.target.value}:row))}/></label>
      <div className="record-wide"><TripLinksEditor links={segment.links ?? []} change={links => set('itinerary',value.itinerary.map(row => row.id === segment.id ? {...row,links} : row))}/><small>Save the itinerary item before adding original files in its detail view.</small></div>
      <button className="focus-secondary danger" onClick={()=>{if(confirm('Remove this itinerary item and its own attachments? Trip-level files, other items and linked records remain.'))set('itinerary',value.itinerary.filter((_,i)=>i!==index));}}><Trash2 size={14}/> Remove</button>
    </div>)}</RepeatSection>
    <TripSection title="Trip documents & links" className="focus-card"><TripLinksEditor links={value.links ?? []} change={links => set('links',links)}/></TripSection>

    <RepeatSection title="Bookings & payments" addLabel="Add booking" add={()=>set('bookings',[...value.bookings,newBooking()])}>{value.bookings.map((booking,index)=><div className={styles.repeatRow} key={booking.id}><label>Type<select value={booking.kind} onChange={(e)=>set('bookings',value.bookings.map((row,i)=>i===index?{...row,kind:e.target.value as TripBooking['kind']}:row))}><option value="travel">Travel</option><option value="accommodation">Accommodation</option><option value="operator">Operator</option><option value="dive">Dive</option><option value="other">Other</option></select></label><label>Provider<input value={booking.provider} onChange={(e)=>set('bookings',value.bookings.map((row,i)=>i===index?{...row,provider:e.target.value}:row))}/></label><label>Reference<input value={booking.reference??''} onChange={(e)=>set('bookings',value.bookings.map((row,i)=>i===index?{...row,reference:e.target.value}:row))}/></label><label>Amount<input type="number" min="0" step="0.01" value={booking.amount??''} onChange={(e)=>set('bookings',value.bookings.map((row,i)=>i===index?{...row,amount:e.target.value===''?null:Number(e.target.value)}:row))}/></label><label>Currency<input value={booking.currency??'GBP'} maxLength={3} onChange={(e)=>set('bookings',value.bookings.map((row,i)=>i===index?{...row,currency:e.target.value.toUpperCase()}:row))}/></label><label>Due<input type="date" value={booking.dueOn??''} onChange={(e)=>set('bookings',value.bookings.map((row,i)=>i===index?{...row,dueOn:e.target.value}:row))}/></label><label className="record-check"><input type="checkbox" checked={booking.paid??false} onChange={(e)=>set('bookings',value.bookings.map((row,i)=>i===index?{...row,paid:e.target.checked}:row))}/>Paid</label><label className="record-wide">Notes<textarea value={booking.notes??''} onChange={(e)=>set('bookings',value.bookings.map((row,i)=>i===index?{...row,notes:e.target.value}:row))}/></label><button className="focus-secondary danger" onClick={()=>set('bookings',value.bookings.filter((_,i)=>i!==index))}><Trash2 size={14}/> Remove</button></div>)}</RepeatSection>

    <RepeatSection title="Trip packing list" addLabel="Add packing item" add={()=>set('packingItems',[...value.packingItems,newPackingItem()])}>{value.packingItems.map((packing,index)=><div className={styles.repeatRow} key={packing.id}><label>Equipment<select value={packing.equipmentId??''} onChange={(e)=>set('packingItems',value.packingItems.map((row,i)=>i===index?{...row,equipmentId:e.target.value,label:e.target.value?'':row.label}:row))}><option value="">Custom item</option>{equipment.filter((item)=>!item.retired).map((item)=><option key={item.entityId} value={item.entityId}>{item.name}</option>)}</select></label><label>Custom label<input value={packing.label} disabled={Boolean(packing.equipmentId)} onChange={(e)=>set('packingItems',value.packingItems.map((row,i)=>i===index?{...row,label:e.target.value}:row))}/></label><label>Quantity<input type="number" min="1" value={packing.quantity??1} onChange={(e)=>set('packingItems',value.packingItems.map((row,i)=>i===index?{...row,quantity:Number(e.target.value)||1}:row))}/></label><label className="record-check"><input type="checkbox" checked={packing.packed} onChange={(e)=>set('packingItems',value.packingItems.map((row,i)=>i===index?{...row,packed:e.target.checked,checkedAt:e.target.checked?new Date().toISOString():undefined}:row))}/>Packed</label><label className="record-wide">Notes<textarea value={packing.notes??''} onChange={(e)=>set('packingItems',value.packingItems.map((row,i)=>i===index?{...row,notes:e.target.value}:row))}/></label><button className="focus-secondary danger" onClick={()=>set('packingItems',value.packingItems.filter((_,i)=>i!==index))}><Trash2 size={14}/> Remove</button></div>)}</RepeatSection>

    <RepeatSection title="Gas & fill logistics" addLabel="Add gas requirement" add={()=>set('gasLogistics',[...value.gasLogistics,newGasItem()])}>{value.gasLogistics.map((gas,index)=><div className={styles.repeatRow} key={gas.id}><label>Label<input value={gas.label} onChange={(e)=>set('gasLogistics',value.gasLogistics.map((row,i)=>i===index?{...row,label:e.target.value}:row))}/></label><label>Cylinder / gear<select value={gas.equipmentId??''} onChange={(e)=>set('gasLogistics',value.gasLogistics.map((row,i)=>i===index?{...row,equipmentId:e.target.value}:row))}><option value="">Not linked</option>{equipment.filter((item)=>/cylinder|tank/i.test(`${item.category} ${item.name}`)).map((item)=><option key={item.entityId} value={item.entityId}>{item.name}</option>)}</select></label><label>Gas<input value={gas.gas??''} onChange={(e)=>set('gasLogistics',value.gasLogistics.map((row,i)=>i===index?{...row,gas:e.target.value}:row))} placeholder="Air, Nx32, Tx18/45…"/></label><label>Fill pressure (bar)<input type="number" min="0" value={gas.plannedFillBar??''} onChange={(e)=>set('gasLogistics',value.gasLogistics.map((row,i)=>i===index?{...row,plannedFillBar:e.target.value===''?null:Number(e.target.value)}:row))}/></label><label>Fill provider<input value={gas.fillProvider??''} onChange={(e)=>set('gasLogistics',value.gasLogistics.map((row,i)=>i===index?{...row,fillProvider:e.target.value}:row))}/></label><label className="record-check"><input type="checkbox" checked={gas.booked??false} onChange={(e)=>set('gasLogistics',value.gasLogistics.map((row,i)=>i===index?{...row,booked:e.target.checked}:row))}/>Booked / arranged</label><label className="record-wide">Notes<textarea value={gas.notes??''} onChange={(e)=>set('gasLogistics',value.gasLogistics.map((row,i)=>i===index?{...row,notes:e.target.value}:row))}/></label><button className="focus-secondary danger" onClick={()=>set('gasLogistics',value.gasLogistics.filter((_,i)=>i!==index))}><Trash2 size={14}/> Remove</button></div>)}</RepeatSection>

    <TripSection title="Emergency, insurance & notes" className={`focus-card ${styles.safetyNotes}`}><div className="record-fields"><label className="record-wide">Emergency notes<textarea value={value.emergencyNotes??''} onChange={(e)=>set('emergencyNotes',e.target.value)} placeholder="Emergency numbers, chamber, muster, contingency…"/></label><label className="record-wide">Insurance notes<textarea value={value.insuranceNotes??''} onChange={(e)=>set('insuranceNotes',e.target.value)} placeholder="Provider, policy/reference, assistance number…"/></label><label className="record-wide">Medical / travel-document notes<textarea value={value.medicalNotes??''} onChange={(e)=>set('medicalNotes',e.target.value)}/></label><label className="record-wide">General trip notes<textarea value={value.notes??''} onChange={(e)=>set('notes',e.target.value)}/></label></div><p className="focus-copy"><FileText size={14}/> Save the Trip first, then attach PDFs and other documents from its detail view.</p></TripSection>

    {message&&<p role="status" className="focus-notice">{message}</p>}
    <footer><button className="focus-secondary" data-dialog-close onClick={close}>Cancel</button><button className="focus-primary" disabled={busy||!value.name.trim()} onClick={()=>void submit()}>{busy?'Saving…':'Save trip'}</button></footer>
  </AccessibleDialog></div>;
}

function EditorChoices({ title, icon, empty, children }: { title:string; icon:React.ReactNode; empty:string; children:React.ReactNode }) {
  const [search, setSearch] = useState('');
  const array = Array.isArray(children) ? children : [children];
  const term = search.trim().toLocaleLowerCase('en-GB');
  const visible = array.filter((child) => {
    if (!term || !child) return Boolean(child);
    const label = child as React.ReactElement<{children: React.ReactElement[]}>;
    const span = label.props.children[1] as React.ReactElement<{children: React.ReactElement<{children: React.ReactNode}>[]}>;
    return span.props.children.map((node) => String(node.props.children ?? '')).join(' ').toLocaleLowerCase('en-GB').includes(term);
  });
  return <TripSection title={title} className={`focus-card ${styles.choiceSection}`}><span aria-hidden="true">{icon}</span>{array.length > 10 && <label>Search {title.toLowerCase()}<input type="search" value={search} onChange={event => setSearch(event.target.value)}/></label>}<div className={styles.choiceGrid}>{visible.length ? visible : <p className="focus-copy">{term ? 'No matching records.' : empty}</p>}</div></TripSection>;
}
function RepeatSection({ title, addLabel, add, children }: { title:string; addLabel:string; add:()=>void; children:React.ReactNode }) {
  return <TripSection title={title} className={`focus-card ${styles.repeatSection}`}><div className="focus-card-head"><button className="focus-secondary" onClick={add}><Plus size={14}/>{addLabel}</button></div><div className={styles.stack}>{children}</div></TripSection>;
}
