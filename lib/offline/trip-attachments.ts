import { editableDiveExpeditionTrip, listDiveExpeditionTrips, saveDiveExpeditionTrip, type DiveExpeditionTripInput } from './trips-expeditions';
import type { UploadedMediaFile } from '../media-batch';

export const TRIP_ATTACHMENT_CATEGORIES = ['Passport / identity', 'Travel insurance', 'Dive insurance', 'Medical', 'Booking confirmation', 'Ticket / travel document', 'Certification', 'Emergency information', 'General document', 'Photo / video', 'Other'] as const;
export const ITINERARY_ATTACHMENT_CATEGORIES = ['Photo', 'Video', 'Map', 'Briefing', 'Booking information', 'Operator information', 'Training material', 'General document', 'Other'] as const;
export interface TripAttachmentReference extends Omit<UploadedMediaFile, 'sizeBytes' | 'createdAt'> { sizeBytes?: number; createdAt?: string; category: string; caption?: string }
export function categoriseTripAttachment(current: TripAttachmentReference[], asset: {id:string;fileName:string;contentType:string;caption?:string}, category:string): TripAttachmentReference[] {
  return current.some(item=>item.id===asset.id) ? current.map(item=>item.id===asset.id?{...item,category}:item) : [...current,{...asset,category}];
}
export interface TripResourceLink { id: string; url: string; title?: string; notes?: string }
export function captionTripAttachment(current: TripAttachmentReference[], asset: {id:string;fileName:string;contentType:string;caption?:string}, caption:string): TripAttachmentReference[] {
  return categoriseTripAttachment(current,asset,current.find(item=>item.id===asset.id)?.category ?? 'General document').map(item=>item.id===asset.id?{...item,caption}:item);
}
export function safeTripResourceUrl(value: string) {
  try { const url = new URL(value.trim()); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function tripMediaOwner(tripId: string, itineraryId?: string) {
  return { ownerKind: itineraryId ? 'dive-trip-itinerary' : 'dive-trip', ownerId: itineraryId ? `${tripId}:${itineraryId}` : tripId };
}
export function appendTripAttachments(current: TripAttachmentReference[] = [], assets: UploadedMediaFile[], category: string) {
  const ids = new Set(current.map(asset => asset.id));
  return [...current, ...assets.filter(asset => !ids.has(asset.id)).map(asset => ({ ...asset, category }))];
}
/** Cleanup is scoped to server-owned attachment listings, never copied reference IDs. */
export async function cleanupTripMedia(tripId: string, itineraryIds: string[], includeTrip = true) {
  for (const owner of [...(includeTrip ? [tripMediaOwner(tripId)] : []), ...itineraryIds.map(id => tripMediaOwner(tripId,id))]) {
    const response = await fetch(`/api/media?kind=${encodeURIComponent(owner.ownerKind)}&ownerId=${encodeURIComponent(owner.ownerId)}`,{cache:'no-store'});
    if (!response.ok) throw new Error('Trip saved/deleted; attachment cleanup needs a connection. Originals remain private.');
    const {items} = await response.json() as {items: Array<{id:string}>};
    for (const item of items) { const deletion = await fetch(`/api/media?id=${encodeURIComponent(item.id)}`,{method:'DELETE'});if (!deletion.ok) throw new Error('Attachment cleanup failed; remaining originals are retained.'); }
  }
}
/** Always reload canonical Trip before a scoped update; never copy linked entities. */
export async function updateTripResources(tripId: string, itineraryId: string | undefined,
  change: (scope: { attachments: TripAttachmentReference[]; links: TripResourceLink[] }) => { attachments: TripAttachmentReference[]; links: TripResourceLink[] }) {
  const current = (await listDiveExpeditionTrips()).find(trip => trip.entityId === tripId);
  if (!current) throw new Error('Trip is unavailable. Existing attachments are retained.');
  const segment = itineraryId ? current.itinerary.find(item => item.id === itineraryId) : undefined;
  if (itineraryId && !segment) throw new Error('Itinerary item no longer exists.');
  const scope = segment ?? current;
  const next = change({ attachments: scope.attachments ?? [], links: scope.links ?? [] });
  if (next.links.some(link => !safeTripResourceUrl(link.url))) throw new Error('Use a valid HTTP or HTTPS link without embedded credentials.');
  const input: DiveExpeditionTripInput = editableDiveExpeditionTrip(current);
  return saveDiveExpeditionTrip(itineraryId ? { ...input, itinerary: input.itinerary.map(item => item.id === itineraryId ? { ...item, ...next } : item) }
    : { ...input, ...next, documentAttachmentIds: [...new Set([...input.documentAttachmentIds.filter(id => !scope.attachments?.some(asset => asset.id === id) || next.attachments.some(asset => asset.id === id)), ...next.attachments.map(asset => asset.id)])] });
}
