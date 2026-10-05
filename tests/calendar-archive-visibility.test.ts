import {describe,it,expect} from 'vitest';
import {calendarListEntries,selectCalendarBooking} from '../components/planning/diving-calendar-bookings';
describe('Calendar list archive visibility',()=>{
 const rows=[{entityId:'old',bookingStatus:'archived'},{entityId:'done',bookingStatus:'completed'},{entityId:'new',bookingStatus:'planned'}];
 it('hides only archived entries by default without changing their source records',()=>{const before=JSON.stringify(rows);expect(calendarListEntries(rows,false).map(x=>x.entityId)).toEqual(['done','new']);expect(JSON.stringify(rows)).toBe(before);});
 it('shows archived entries only when requested and preserves order and exact IDs',()=>{expect(calendarListEntries(rows,true)).toEqual(rows);});
 it('does not automatically select an archived row; explicit historical deep links still resolve exactly',()=>{const visible=calendarListEntries(rows,false);expect(selectCalendarBooking(rows,visible,null)?.entityId).toBe('done');expect(selectCalendarBooking(rows,visible,'old')?.entityId).toBe('old');});
});
