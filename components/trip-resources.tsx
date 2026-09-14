'use client';
import { useEffect, useState } from 'react';
import { MediaGallery } from './media-gallery';
import { TripNote } from './trip-disclosure';
import { appendTripAttachments, captionTripAttachment, categoriseTripAttachment, ITINERARY_ATTACHMENT_CATEGORIES, TRIP_ATTACHMENT_CATEGORIES, safeTripResourceUrl, tripMediaOwner, updateTripResources, type TripAttachmentReference, type TripResourceLink } from '../lib/offline/trip-attachments';

export function TripLinksEditor({ links, change, onDraftChange }: { links: TripResourceLink[]; change: (links: TripResourceLink[]) => void | Promise<void>; onDraftChange?: (dirty:boolean)=>void }) {
  const [url,setUrl] = useState(''); const [title,setTitle] = useState(''); const [notes,setNotes] = useState('');
  const [editing,setEditing] = useState<string | null>(null); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  useEffect(()=>{onDraftChange?.(Boolean(url||title||notes||editing||busy));},[url,title,notes,editing,busy,onDraftChange]);
  async function save() {
    const safe = safeTripResourceUrl(url); if (!safe) { setError('Enter a valid HTTP or HTTPS URL without embedded credentials.'); return; }
    setBusy(true); setError('');
    try { const item = { id: editing ?? crypto.randomUUID(), url: safe, title: title.trim(), notes: notes.trim() };
      await change(editing ? links.map(link => link.id === editing ? item : link) : [...links,item]);
      setUrl(''); setTitle(''); setNotes(''); setEditing(null);
    } catch { setError('Link could not be saved. Your draft is retained.'); } finally { setBusy(false); }
  }
  return <section className="trip-resource-links"><h4>Links</h4><ul>{links.map(link => <li key={link.id}><div>{safeTripResourceUrl(link.url) ? <a className="focus-link" href={link.url} target="_blank" rel="noopener noreferrer">{link.title || new URL(link.url).hostname}</a> : <span>Unsafe legacy link — edit before opening</span>}{link.notes && <TripNote text={link.notes} label="link notes"/>}</div><button type="button" className="focus-secondary" disabled={busy} onClick={() => { setEditing(link.id);setUrl(link.url);setTitle(link.title ?? '');setNotes(link.notes ?? ''); }}>Edit link</button><button type="button" className="focus-secondary" disabled={busy} onClick={async () => { if (!confirm('Remove this link only?')) return;try { await change(links.filter(item => item.id !== link.id)); } catch { setError('Link removal failed; existing links are retained.'); } }}>Remove link</button></li>)}</ul>
    <div className="trip-link-fields"><label>Link URL<input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…"/></label><label>Link title (optional)<input value={title} onChange={event => setTitle(event.target.value)}/></label><label>Link notes<textarea value={notes} onChange={event => setNotes(event.target.value)}/></label><button type="button" className="focus-secondary" disabled={busy} data-dialog-dirty onClick={() => void save()}>{editing ? 'Save link changes' : 'Add link'}</button>{editing && <button type="button" className="focus-secondary" onClick={() => { setEditing(null);setUrl('');setTitle('');setNotes(''); }}>Cancel link edit</button>}</div>{error && <p role="alert">{error}</p>}
  </section>;
}

export function TripResources({ tripId, itineraryId, attachments = [], links = [], changed, pendingChanged }: { tripId: string; itineraryId?: string; attachments?: TripAttachmentReference[] | undefined; links?: TripResourceLink[] | undefined; changed: () => void; pendingChanged?: (pending: boolean) => void }) {
  const categories = itineraryId ? ITINERARY_ATTACHMENT_CATEGORIES : TRIP_ATTACHMENT_CATEGORIES;
  const [filePending,setFilePending] = useState(false);const [linkPending,setLinkPending] = useState(false);
  useEffect(()=>{pendingChanged?.(filePending||linkPending);},[filePending,linkPending,pendingChanged]);
  const [category,setCategory] = useState('General document'); const owner = tripMediaOwner(tripId,itineraryId);
  async function update(change: Parameters<typeof updateTripResources>[2]) { await updateTripResources(tripId,itineraryId,change); changed(); }
  return <div className="trip-resources"><p>Private files for {itineraryId ? 'this itinerary item only' : 'this Trip'}. Originals need a connection; saved references remain local. Sensitive Trip documents appear as explicit Open links, never overview thumbnails.{!itineraryId && ' Choose Photo / video for clickable photo thumbnails and browsing; document categories stay compact.'}</p><label>Category for this upload batch<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
    <MediaGallery {...owner} acceptFiles retainOfflineMetadata accessibleViewer showHeading={false} compact={!itineraryId} previewCategory={itineraryId ? undefined : 'Photo / video'} categories={categories} categoryById={Object.fromEntries(attachments.map(asset => [asset.id,asset.category]))} onPendingChange={setFilePending}
      onUploadedAssets={assets => update(scope => ({ ...scope, attachments: appendTripAttachments(scope.attachments,assets,category) }))}
      onRemoved={id => update(scope => ({ ...scope, attachments: scope.attachments.filter(asset => asset.id !== id) }))}
      onCategoryChange={(_id,next,asset) => update(scope => ({ ...scope, attachments: categoriseTripAttachment(scope.attachments,asset,next) }))}
      onCaptionChange={(asset,caption) => update(scope => ({ ...scope, attachments: captionTripAttachment(scope.attachments,asset,caption) }))}/>
    <TripLinksEditor links={links} onDraftChange={setLinkPending} change={next => update(scope => ({ ...scope,links:next }))}/>
  </div>;
}
