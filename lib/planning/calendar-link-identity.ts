/** Explicit conversion provenance only. Similar names never establish identity. */
export function sameConvertedCalendarDates(trip:Record<string,unknown>,booking:Record<string,unknown>):boolean {
 const start=typeof booking.startDate==='string'&&booking.startDate?booking.startDate:typeof booking.startAt==='string'?booking.startAt.slice(0,10):'';
 const end=typeof booking.endDate==='string'&&booking.endDate?booking.endDate:typeof booking.endAt==='string'&&booking.endAt?booking.endAt.slice(0,10):start;
 return Boolean(start)&&trip.startsOn===start&&(trip.endsOn||trip.startsOn)===end;
}
