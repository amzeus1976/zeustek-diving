type Coordinates={latitude?:number|null;longitude?:number|null};
type LoggedDive=Coordinates & {site:string;siteId?:string};
type Site=Coordinates & {entityId:string;name:string;unconfirmed?:boolean};
export type DiveHeatPoint={latitude:number;longitude:number;count:number;name:string};
function valid(p:Coordinates|undefined):p is {latitude:number;longitude:number} {
  return !!p && typeof p.latitude==='number' && typeof p.longitude==='number' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude)<=90 && Math.abs(p.longitude)<=180;
}
export function diveHeat(dives:LoggedDive[],sites:Site[]) {
  const byId=new Map(sites.map(site=>[site.entityId,site]));
  const byName=new Map<string,Site[]>();
  for(const site of sites){const key=site.name.trim().toLowerCase();byName.set(key,[...(byName.get(key)??[]),site]);}
  const points=new Map<string,DiveHeatPoint>();let skipped=0;
  for(const dive of dives){
    const matches=byName.get(dive.site.trim().toLowerCase())??[];
    const site=(dive.siteId?byId.get(dive.siteId):undefined)??(matches.length===1?matches[0]:undefined);
    // Linked site corrections take precedence over stale coordinates copied into logs.
    const position=site&&!site.unconfirmed&&valid(site)?site:valid(dive)?dive:undefined;
    if(!position){skipped++;continue;}
    const key=`${position.latitude},${position.longitude}`;
    const point=points.get(key)??{latitude:position.latitude,longitude:position.longitude,count:0,name:site?.name??dive.site};
    point.count++;points.set(key,point);
  }
  return {points:[...points.values()],mapped:dives.length-skipped,skipped};
}
