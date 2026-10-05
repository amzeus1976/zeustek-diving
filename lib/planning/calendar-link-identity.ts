/** Explicit conversion provenance only. Similar names never establish identity. */
export function calendarTripLinkState(bookingId:string,explicitTripId:unknown,trips:readonly {entityId:string;calendarBookingIds?:unknown;originCalendarBookingId?:unknown}[]){
 const linked=typeof explicitTripId==='string'?explicitTripId.trim():'';
 const ids=new Set([linked,...trips.filter(trip=>(Array.isArray(trip.calendarBookingIds)&&trip.calendarBookingIds.includes(bookingId))||trip.originCalendarBookingId===bookingId).map(trip=>trip.entityId)].filter(Boolean));
 return {linkedTripId:ids.size===1?[...ids][0]!:null,conflict:ids.size>1};
}

export function sameConvertedCalendarDates(trip:Record<string,unknown>,booking:Record<string,unknown>):boolean {
 const start=typeof booking.startDate==='string'&&booking.startDate?booking.startDate:typeof booking.startAt==='string'?booking.startAt.slice(0,10):'';
 const end=typeof booking.endDate==='string'&&booking.endDate?booking.endDate:typeof booking.endAt==='string'&&booking.endAt?booking.endAt.slice(0,10):start;
 return Boolean(start)&&trip.startsOn===start&&(trip.endsOn||trip.startsOn)===end;
}

/** Current converted Trip status controls its original-identity display/export. */
export function convertedCalendarBookingStatus(tripStatus:unknown,sourceStatus:unknown):import('../offline/planning-pages').BookingStatus {
 const current=typeof tripStatus==='string'?tripStatus.trim().toLowerCase():'';
 const source=typeof sourceStatus==='string'?sourceStatus.trim().toLowerCase():'';
 if(current==='cancelled'||current==='completed')return current;
 // Explicitly archived source evidence stays historical; it never bypasses canonical cancellation.
 if(source==='archived')return 'archived';
 if(current==='draft')return 'idea';
 if(current==='active')return 'confirmed';
 if(current==='planned'||current==='confirmed')return current;
 return source==='cancelled'||source==='completed'||source==='confirmed'||source==='booked'||source==='idea'?source:'planned';
}
