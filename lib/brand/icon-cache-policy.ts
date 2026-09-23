import {createHash} from 'node:crypto';
import {ZEUSTEK_COMPLETE_ICONS} from './zeustek-complete-icon-registry.generated';
import {ZEUSTEK_SEMANTIC_ICON_MAP} from './zeustek-icon-resolver';
export {isCompleteIconPath} from './icon-path';

/** Build-time only: never import this module into a client or service worker. */
export function buildCompleteIconPrecache(read:(src:string)=>Uint8Array){
  const keys=new Set(Object.values(ZEUSTEK_SEMANTIC_ICON_MAP));
  return ZEUSTEK_COMPLETE_ICONS.filter(icon=>keys.has(icon.key)).map(icon=>({
    url:icon.src.replace(/^\//,''),
    revision:createHash('sha256').update(read(icon.src)).digest('hex'),
  }));
}
