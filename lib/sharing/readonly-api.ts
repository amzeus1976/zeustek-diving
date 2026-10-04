import {strictObject} from './public-profile';
export const API_RESOURCES=['dives','awards','equipment','equipment-usage','gas-plans','dive-plans','trips'] as const;
export type ApiResource=typeof API_RESOURCES[number];
export const API_FIELDS={dives:['date','site','depth','duration','mode'],awards:['title','agency','date','track'],equipment:['name','category','maker','model'],'equipment-usage':[],'gas-plans':['name','status','depth','duration','rmv','supplies'],'dive-plans':['name','status','start','end','site','depth','duration'],trips:['name','status','start','end','destination','itinerary']} as const;
export const API_LABELS:Record<ApiResource,string>={dives:'Dives',awards:'Awards',equipment:'Equipment','equipment-usage':'Equipment usage','gas-plans':'Gas Plans','dive-plans':'Dive Plans',trips:'Trips & Expeditions'};
export const API_RECORD_KINDS:Record<ApiResource,string>={dives:'dive',awards:'certification',equipment:'equipment','equipment-usage':'dive','gas-plans':'gas-plan','dive-plans':'trip',trips:'dive-trip'};
export type ApiConsent=Partial<Record<ApiResource,{ids:string[];fields:string[]}>>;
export type ApiKeyInput={client:'AMZeus'|'ZeusTek';expiresAt:string;scopes:ApiResource[];selection:ApiConsent};
export type ApiKeyMetadata={id:string;client:'AMZeus'|'ZeusTek';scopes:ApiResource[];createdAt:string;expiresAt:string;revoked:boolean;lastUsedAt:string|null;selectedCounts:Partial<Record<ApiResource,number>>};
export function validateApiKeyInput(value:unknown,now=Date.now()):ApiKeyInput{
  const object=strictObject(value,['client','expiresAt','scopes','selection']);
  if(!['AMZeus','ZeusTek'].includes(String(object.client))||typeof object.expiresAt!=='string'||!Number.isFinite(Date.parse(object.expiresAt))||Date.parse(object.expiresAt)<=now||Date.parse(object.expiresAt)>now+366*86400000)throw new Error('Select a supported client and an expiry within one year.');
  if(!Array.isArray(object.scopes)||!object.scopes.length||object.scopes.some(item=>!API_RESOURCES.includes(item))||new Set(object.scopes).size!==object.scopes.length)throw new Error('Select supported scopes once each.');
  const selection=strictObject(object.selection,object.scopes),result:ApiConsent={};
  for(const scope of object.scopes as ApiResource[]){const consent=strictObject(selection[scope],['ids','fields']);if(!Array.isArray(consent.ids)||!consent.ids.length||consent.ids.length>1000||consent.ids.some(id=>typeof id!=='string'||id.length<1||id.length>180)||new Set(consent.ids).size!==consent.ids.length||!Array.isArray(consent.fields)||consent.fields.some(field=>!(API_FIELDS[scope] as readonly unknown[]).includes(field))||new Set(consent.fields).size!==consent.fields.length)throw new Error('Choose bounded records and supported fields.');result[scope]={ids:consent.ids,fields:consent.fields};}
  return {client:object.client as ApiKeyInput['client'],expiresAt:object.expiresAt,scopes:object.scopes as ApiResource[],selection:result};
}
