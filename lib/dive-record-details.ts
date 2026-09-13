import type { DiveRecord } from './offline/dives';
export function elapsedRuntime(timeIn?: string, timeOut?: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(timeIn ?? '') || !/^\d{2}:\d{2}$/.test(timeOut ?? '')) return null;
  const [ih = 0, im = 0] = timeIn!.split(':').map(Number); const [oh = 0, om = 0] = timeOut!.split(':').map(Number);
  if (ih > 23 || oh > 23 || im > 59 || om > 59) return null;
  // Times describe one dive. An earlier exit time rolls into the following day.
  return (oh * 60 + om - ih * 60 - im + 1440) % 1440;
}
export const DIVE_ACTIVITIES = ['Lake','Quarry','River','Pool','Shore','Boat','Wreck','Wall','Reef','Macro','Muck','Night','Drift','Ice','Training','Cavern','Cave','Photography','Wreck penetration','Blue water'] as const;
export function summedRuntime(bottom: number | null, stops: Array<{actualDurationMin?:number|null;durationMin?:number|null}>, safety:number|null):number|null {
  if(bottom == null || !Number.isFinite(bottom) || bottom < 0 || safety == null || safety < 0) return null;
  const durations=stops.map(stop=>stop.actualDurationMin);
  if(durations.some(value=>value == null || !Number.isFinite(value) || value < 0)) return null;
  return bottom + safety + durations.reduce<number>((sum,value)=>sum+(value??0),0);
}
export function diveCompleteness(dive: DiveRecord) {
  const status=(values:boolean[])=>values.every(Boolean)?'recorded':values.some(Boolean)?'partial':'missing';
  return {
    Weather: status([Boolean(dive.weather?.trim()),dive.airTemperatureC!=null,dive.windSpeedKnots!=null]),
    Gear: status([Boolean(dive.equipmentIds?.length || dive.hiredEquipment?.some(item=>item.name.trim())),Boolean(dive.equipmentIds?.length || (dive.hiredEquipment?.length && dive.hiredEquipment.every(item=>item.name.trim() && item.category.trim())))]),
    Gas: status([Boolean(dive.gas?.trim() || dive.cylinders?.some(c=>c.gasType)),Boolean(dive.cylinders?.length && dive.cylinders.every(c=>c.oxygenPercent!=null && c.startPressureBar!=null && c.endPressureBar!=null))]),
  };
}
export function normaliseMyMaps(value: string): string {
  const raw = value.trim(); if (!raw) return '';
  let id = raw;
  if (raw.includes('://')) {
    let url: URL; try { url = new URL(raw); } catch { throw new Error('Paste a Google My Maps share URL or map ID.'); }
    if (url.protocol !== 'https:' || !['www.google.com', 'google.com'].includes(url.hostname) || !url.pathname.startsWith('/maps/d/')) throw new Error('Use a Google My Maps viewer, edit or embed link from google.com/maps/d/.');
    id = url.searchParams.get('mid') ?? url.pathname.match(/\/maps\/d\/(?:u\/\d+\/)?(?:edit|viewer|embed)\/([\w-]+)/)?.[1] ?? '';
  }
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new Error('The Google My Maps ID is missing or invalid.');
  return `https://www.google.com/maps/d/embed?mid=${encodeURIComponent(id)}`;
}
