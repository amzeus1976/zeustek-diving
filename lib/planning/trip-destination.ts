import type {DiveSiteRecord,Stored} from '../offline/dive-planning';
import type {DiveExpeditionTripInput} from '../offline/trips-expeditions';
import {matchSiteChoice,siteChoiceLabel} from '../offline/plan-site-choice';
import {siteRoadArrival} from './trip-directions';
/** Only edits a reviewable draft. Never writes Sites, People or stored Trips. */
export function tripSiteChoiceLabel(site:Stored<DiveSiteRecord>){return `${siteChoiceLabel(site)}${site.postcode?.trim()?` · ${site.postcode.trim()}`:''}`;}
export function tripArrivalDraft(draft:DiveExpeditionTripInput,value:string,source:'site'|'owner'='owner'):DiveExpeditionTripInput{return{...draft,travelArrivalPoint:value,travelArrivalSource:value.trim()?source:'owner'};}
export function tripDestinationDraft(draft:DiveExpeditionTripInput,query:string,sites:Array<Stored<DiveSiteRecord>>,previousAutoArrival=draft.travelArrivalSource==='site'?draft.travelArrivalPoint??'':''){
 const site=sites.find(row=>tripSiteChoiceLabel(row).toLocaleLowerCase('en-GB')===query.trim().toLocaleLowerCase('en-GB'))??matchSiteChoice(sites,query),road=siteRoadArrival(site);
 const mayFill=!draft.travelArrivalPoint?.trim()||Boolean(previousAutoArrival&&draft.travelArrivalPoint===previousAutoArrival);
 const value:DiveExpeditionTripInput={...draft,destination:site?.name??query,...(site?{siteIds:[...new Set([...draft.siteIds,site.entityId])]}:{})};
 if(mayFill&&(road||previousAutoArrival)){value.travelArrivalPoint=road||'';value.travelArrivalSource=road?'site':'owner';}
 return{value,autoArrival:mayFill?road||'':previousAutoArrival};
}
