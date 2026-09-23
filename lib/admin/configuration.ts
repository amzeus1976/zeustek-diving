import { normaliseMyMaps } from '../dive-record-details';
const domains={insights:['selectedAwards','maxAwards'],maps:['customGoogleMapEmbedUrl'],news:['newsletterEmail'],records:['diveNumberStart']} as const;
export type ConfigurationDomain=keyof typeof domains;
/** Preserve unknown future fields and all other domains during an explicit save. */
export function applySettingsPatch<T extends Record<string,unknown>>(current:T,domain:ConfigurationDomain,patch:Record<string,unknown>):T{
 const next={...current} as Record<string,unknown>;
 for(const [key,value] of Object.entries(patch)){
  if(!(domains[domain] as readonly string[]).includes(key))throw new Error('This setting belongs to a different domain.');
  if(key==='selectedAwards'&&(!Array.isArray(value)||!value.every(item=>typeof item==='string')))throw new Error('Choose valid awards.');
  if(key==='maxAwards'&&![4,8,12,16,20].includes(value as number))throw new Error('Choose 4, 8, 12, 16 or 20 awards.');
  if(key==='diveNumberStart'&&(!Number.isSafeInteger(value)||Number(value)<1))throw new Error('First Dive number must be a whole positive number.');
  if(key==='customGoogleMapEmbedUrl'){if(typeof value!=='string')throw new Error('Enter a map link.');next[key]=normaliseMyMaps(value);continue;}
  if(key==='newsletterEmail'&&(typeof value!=='string'||!/^\S+@\S+\.\S+$/.test(value)))throw new Error('Enter a valid newsletter email.');
  next[key]=value;
 }
 return next as T;
}
