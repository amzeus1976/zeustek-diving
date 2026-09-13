import researched from './researched-site-coordinates.json';
import pins from './google-map-coordinate-reference.json';
export const COORDINATE_SOURCE = 'https://www.google.com/maps/d/viewer?mid=1WkMJxWCo9HndflpdlaKO86r_fgg3qDM';
export const COORDINATE_AUDIT_VERSION = 'google-map-2026-09-08';
type Point = { latitude?: number|null|undefined; longitude?: number|null|undefined };
export function distanceMetres(a: Point,b: Point) {
  if (![a.latitude,a.longitude,b.latitude,b.longitude].every(v => typeof v === 'number' && Number.isFinite(v))) return Infinity;
  const rad = Math.PI/180, dlat=(b.latitude!-a.latitude!)*rad, dlon=(b.longitude!-a.longitude!)*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a.latitude!*rad)*Math.cos(b.latitude!*rad)*Math.sin(dlon/2)**2;
  return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
const normalise=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
export function auditSiteCoordinate(site: Point & {name:string}) {
  const sourceMatches=researched.filter(pin=>normalise(pin.name)===normalise(site.name) && (!Number.isFinite(distanceMetres(site,pin)) || distanceMetres(site,pin)<5000));
  if(sourceMatches.length){const first=sourceMatches[0]!;if(sourceMatches.every(p=>distanceMetres(p,first)<1)){const distance=distanceMetres(site,first);return {status:distance<1?'Verified source matches' as const:'Researched correction available' as const,target:first,distance,source:first.source};}}
  if (/^(unknown( divesite)?|boat|trawler|steam ship|the wall|the caves|the pinnacle)$/i.test(site.name.trim())) return {status:'Ambiguous name' as const};
  const matches=pins.filter(pin=>normalise(pin.name)===normalise(site.name));
  const unique=matches.filter((p,i)=>matches.findIndex(other=>other.latitude===p.latitude&&other.longitude===p.longitude)===i);
  if (!unique.length) return {status:'No Google match' as const};
  let target=unique.length===1?unique[0]:undefined;
  if(!target){const nearby=unique.filter(pin=>distanceMetres(site,pin)<100);if(nearby.length===1)target=nearby[0];}
  if(!target)return {status:'Ambiguous name' as const};
  const distance=distanceMetres(site,target);
  if(Number.isFinite(distance)&&distance>50000)return {status:'Location needs review' as const,target,distance};
  return {status:distance<1?'Matches Google' as const:'Correction available' as const,target,distance};
}
