import type {DiveSiteRecord,PersonRecord} from '../offline/dive-planning';
import {findOwnerProfile} from '../offline/people-profiles';
export type TripDirectionsOrigin = {kind:'current'} | {kind:'home'|'address';address:string};
const joined=(parts:Array<string|null|undefined>)=>parts.map(part=>part?.trim()).filter(Boolean).join(', ');
/** Resolve the canonical owner, without guessing names or rewriting source data. */
export function ownerHomeAddress(people:PersonRecord[]):string|null {
 if(people.filter(person=>person.roles?.ownerProfile).length!==1)return null;
 const owner=findOwnerProfile(people);
 if(!owner?.address?.trim()&&!owner?.postcode?.trim())return null;
 return joined([owner.address,owner.postcode,owner.location])||null;
}
/** Dive coordinates can be underwater; never infer a road arrival from them. */
export function siteRoadArrival(site?:DiveSiteRecord|null):string|null {
 if(!site?.address?.trim()&&!site?.postcode?.trim())return null;
 return joined([site.address,site.postcode,site.location,site.country])||null;
}
/** Pure construction; no provider request, geolocation or persistence. */
export function tripDirectionsUrl(destination:string,origin:TripDirectionsOrigin):string|null {
 const target=destination.trim();if(!target)return null;
 const url=new URL('https://www.google.com/maps/dir/');
 url.searchParams.set('api','1');url.searchParams.set('travelmode','driving');url.searchParams.set('destination',target);
 if(origin.kind!=='current'){const address=origin.address.trim();if(!address)return null;url.searchParams.set('origin',address);}
 return url.href.length<=2048?url.href:null;
}
