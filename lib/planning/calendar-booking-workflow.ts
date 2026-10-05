import {listRecords,saveRecord,type Stored} from '../offline/dive-planning';
import {listDives} from '../offline/dives';
import {currentDiveAccount} from '../offline/dive-store';
import {listDivingCalendarBookings,setDivingCalendarBookingStatus,type BookingStatus,type StoredDivingCalendarBooking} from '../offline/planning-pages';
import {editableDiveExpeditionTrip,listDiveExpeditionTrips,saveDiveExpeditionTrip,type DiveExpeditionTripInput,type DiveExpeditionTripRecord} from '../offline/trips-expeditions';
import {sameConvertedCalendarDates,convertedCalendarBookingStatus,calendarTripLinkState} from './calendar-link-identity';

export type CalendarBooking = StoredDivingCalendarBooking & {linkedDiveIds?:string[];calendarSource?:'trip'|'dive-trip';calendarLinkConflict?:boolean;calendarStatusTripId?:string;calendarStatusTripModifiedAt?:string};
export const normaliseCalendarDiveIds=(ids:readonly string[])=>[...new Set(ids.filter(id=>typeof id==='string'&&id.trim()).map(id=>id.trim()))];

/** Bounded display only; original saved text is never changed. */
export function eventTextPreview(text:string){
 const characters=Array.from(text);const lines=text.split('\n');
 const preview=Array.from(lines.slice(0,6).join('\n')).slice(0,320).join('');
 return {preview,truncated:characters.length>320||lines.length>6};
}
export function calendarTripAssociation(booking:StoredDivingCalendarBooking,trips:readonly Stored<DiveExpeditionTripRecord>[]){
 return calendarTripLinkState(booking.entityId,booking.linkedTripId,trips);
}
export function linkedCalendarTripId(booking:StoredDivingCalendarBooking,trips:readonly Stored<DiveExpeditionTripRecord>[]){
 return calendarTripAssociation(booking,trips).linkedTripId;
}
export function calendarEntries(bookings:readonly CalendarBooking[],trips:readonly Stored<DiveExpeditionTripRecord>[]):CalendarBooking[]{
 const sources=new Map(bookings.map(booking=>[booking.entityId,booking]));
 const rows:CalendarBooking[]=bookings.map<CalendarBooking>(booking=>{
  const {linkedTripId,conflict:calendarLinkConflict}=calendarTripAssociation(booking,trips);
  const matches=trips.filter(trip=>trip.originCalendarBookingId===booking.entityId&&sameConvertedCalendarDates(trip as unknown as Record<string,unknown>,booking as unknown as Record<string,unknown>));
  const converted=!calendarLinkConflict&&matches.length===1?matches[0]:undefined;
  const bookingStatus=converted?convertedCalendarBookingStatus(converted.status,booking.bookingStatus):booking.bookingStatus??'planned';
  return {...booking,calendarSource:'trip',linkedTripId:calendarLinkConflict?null:linkedTripId,bookingStatus,...(converted?{calendarStatusTripId:converted.entityId,calendarStatusTripModifiedAt:converted.modifiedAt}:{}),calendarLinkConflict};
 });
 for(const trip of trips){
  const origin=trip.originCalendarBookingId?sources.get(trip.originCalendarBookingId):undefined;
  if(origin&&sameConvertedCalendarDates(trip as unknown as Record<string,unknown>,origin as unknown as Record<string,unknown>))continue;
  rows.push({entityId:trip.entityId,calendarSource:'dive-trip',linkedTripId:trip.entityId,linkedDiveIds:trip.linkedDiveIds??[],name:trip.name,startDate:trip.startsOn??'',endDate:trip.endsOn??trip.startsOn??'',siteName:trip.destination??'',locationName:trip.destination??'',buddy:'',notes:trip.notes??'',bookingKind:'trip',bookingStatus:trip.status==='draft'?'idea':trip.status==='active'?'confirmed':trip.status,status:trip.status==='completed'?'completed':trip.status==='confirmed'||trip.status==='active'?'confirmed':'planned',createdAt:trip.createdAt,modifiedAt:trip.modifiedAt});
 }
 return rows.sort((a,b)=>`${a.startDate}T${a.startAt??''}`.localeCompare(`${b.startDate}T${b.startAt??''}`)||a.name.localeCompare(b.name));
}
function bookingItinerary(booking:CalendarBooking){
 const kind=booking.bookingKind==='course'||booking.bookingKind==='assessment'?'training':booking.bookingKind==='travel'?'travel':booking.bookingKind==='club'?'meeting':booking.bookingKind==='show'?'activity':booking.bookingKind==='dive'||booking.bookingKind==='centre'?'dive':'other';
 return {id:`calendar-event:${booking.entityId}`,calendarBookingId:booking.entityId,kind,title:booking.name,startsAt:booking.startAt||booking.startDate,endsAt:booking.endAt||booking.endDate,location:booking.locationName||booking.siteName,notes:booking.notes||booking.quickNotes||''} as import('../offline/trips-expeditions').TripItinerarySegment;
}
export function mergeBookingIntoTrip(trip:Stored<DiveExpeditionTripRecord>,booking:CalendarBooking):DiveExpeditionTripInput{
 const old=editableDiveExpeditionTrip(trip);
 return {...old,name:trip.name.trim()?trip.name:booking.name,destination:trip.destination?.trim()?trip.destination:booking.locationName||booking.siteName,startsOn:trip.startsOn||booking.startDate,endsOn:trip.endsOn||booking.endDate||booking.startDate,notes:trip.notes?.trim()?trip.notes:booking.notes||booking.quickNotes||'',calendarBookingIds:normaliseCalendarDiveIds([...(trip.calendarBookingIds??[]),booking.entityId]),siteIds:normaliseCalendarDiveIds([...trip.siteIds,...(booking.siteId?[booking.siteId]:[])]),teamPersonIds:normaliseCalendarDiveIds([...trip.teamPersonIds,...(booking.personIds??[])]),planIds:normaliseCalendarDiveIds([...trip.planIds,...(booking.linkedDivePlanId?[booking.linkedDivePlanId]:[])]),itinerary:trip.itinerary.some(row=>row.calendarBookingId===booking.entityId)?trip.itinerary:[...trip.itinerary,bookingItinerary(booking)]};
}
export function tripDraftFromBooking(booking:CalendarBooking):DiveExpeditionTripInput{
 const now=new Date().toISOString();
 const initial:Stored<DiveExpeditionTripRecord>={entityId:'',name:'',status:booking.bookingStatus==='cancelled'?'cancelled':booking.bookingStatus==='completed'?'completed':booking.bookingStatus==='booked'||booking.bookingStatus==='confirmed'?'confirmed':'planned',teamPersonIds:[],siteIds:[],planIds:[],itinerary:[],bookings:[],packingEquipmentSetIds:[],packingItems:[],gasLogistics:[],documentAttachmentIds:[],createdAt:now,modifiedAt:now};
 const {entityId:_id,...draft}=mergeBookingIntoTrip(initial,booking);
 return {...draft,linkedDiveIds:normaliseCalendarDiveIds(booking.linkedDiveIds??[]),originCalendarBookingId:booking.entityId};
}
export async function readCalendarSources(){
 const account=currentDiveAccount();
 const [bookings,trips,dives]=await Promise.all([listDivingCalendarBookings(),listDiveExpeditionTrips(),listDives()]);
 sameAccount(account);
 return {entries:calendarEntries(bookings,trips),bookings,trips,dives};
}
function sameAccount(account:string){if(currentDiveAccount()!==account)throw new Error('The account changed. Reopen this event before saving links.');}
export async function saveCalendarDiveLinks(entry:CalendarBooking,ids:readonly string[]){
 const account=currentDiveAccount();const kind=entry.calendarSource==='dive-trip'?'dive-trip':'trip';
 const [rows,dives]=await Promise.all([listRecords<CalendarBooking>(kind),listDives()]);sameAccount(account);
 const current=rows.find(row=>row.entityId===entry.entityId);
 if(!current||current.modifiedAt!==entry.modifiedAt)throw new Error('This event changed or is unavailable. Reopen it before saving Dive links.');
 const known=new Set(dives.map(dive=>dive.entityId));const original=new Set(current.linkedDiveIds??[]);const linkedDiveIds=normaliseCalendarDiveIds(ids);
 if(linkedDiveIds.some(id=>!known.has(id)&&!original.has(id)))throw new Error('A selected Dive is unavailable in this account. No links were saved.');
 return saveRecord(kind,{...current,linkedDiveIds});
}
export async function linkCalendarBookingToTrip(entry:CalendarBooking,tripId:string){
 const account=currentDiveAccount();if(entry.calendarSource==='dive-trip')throw new Error('This event already is a Trip.');
 const [bookings,trips]=await Promise.all([listDivingCalendarBookings(),listDiveExpeditionTrips()]);sameAccount(account);
 const booking=bookings.find(row=>row.entityId===entry.entityId),trip=trips.find(row=>row.entityId===tripId);
 if(!booking||!trip||booking.modifiedAt!==entry.modifiedAt)throw new Error('The source event or Trip changed or is unavailable. Reopen it before linking.');
 const existing=linkedCalendarTripId(booking,trips);
 if(calendarEntries([booking],trips)[0]?.calendarLinkConflict)throw new Error('Multiple Trip associations need review before linking this event.');
 if(existing&&existing!==tripId)throw new Error('This event already links to another Trip. Open that Trip to review the association.');
 return saveDiveExpeditionTrip(mergeBookingIntoTrip(trip,booking));
}
export async function setCalendarEntryStatus(entry:CalendarBooking,status:BookingStatus){
 const account=currentDiveAccount();
 const currentEntry=(await readCalendarSources()).entries.find(row=>row.entityId===entry.entityId&&row.calendarSource===entry.calendarSource);sameAccount(account);
 if(currentEntry?.calendarLinkConflict)throw new Error('Multiple Trip associations need review before changing this event status.');
 if(!currentEntry||currentEntry.modifiedAt!==entry.modifiedAt||currentEntry.linkedTripId!==entry.linkedTripId||currentEntry.calendarStatusTripId!==entry.calendarStatusTripId||currentEntry.calendarStatusTripModifiedAt!==entry.calendarStatusTripModifiedAt)throw new Error('This event or its Trip association changed. Reopen it before changing its status.');
 const tripId=currentEntry.calendarStatusTripId??(currentEntry.calendarSource==='dive-trip'?currentEntry.entityId:null);
 if(tripId&&!(entry.calendarSource==='trip'&&status==='archived')){
  if(status!=='completed'&&status!=='cancelled')throw new Error('Edit this Trip in Trips & Expeditions.');
  const trip=(await listDiveExpeditionTrips()).find(row=>row.entityId===tripId);sameAccount(account);
  if(!trip||trip.modifiedAt!==(entry.calendarStatusTripModifiedAt??entry.modifiedAt))throw new Error('This Trip changed. Reopen it before changing its status.');
  if(entry.calendarStatusTripId){
   const booking=(await listDivingCalendarBookings()).find(row=>row.entityId===entry.entityId);sameAccount(account);
   if(!booking||booking.modifiedAt!==entry.modifiedAt||trip.originCalendarBookingId!==booking.entityId||!sameConvertedCalendarDates(trip as unknown as Record<string,unknown>,booking as unknown as Record<string,unknown>))throw new Error('This event changed. Reopen it before changing its Trip status.');
  }
  return saveDiveExpeditionTrip({...editableDiveExpeditionTrip(trip),status});
 }
 const booking=(await listDivingCalendarBookings()).find(row=>row.entityId===entry.entityId);sameAccount(account);
 if(!booking||booking.modifiedAt!==entry.modifiedAt)throw new Error('This event changed. Reopen it before changing its status.');
 return setDivingCalendarBookingStatus(booking,status);
}
