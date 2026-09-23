import {readFileSync,existsSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ZEUSTEK_ICON_DEFINITIONS,findZeusTekIcon} from '../lib/brand/zeustek-icon-registry';
import {ZEUSTEK_COMPLETE_ICONS} from '../lib/brand/zeustek-complete-icon-registry.generated';
import {resolveZeusTekIcon,ZEUSTEK_SEMANTIC_ICON_MAP} from '../lib/brand/zeustek-icon-resolver';
import {ZeusTekAssetIcon} from '../components/brand/zeustek-asset-icon';
import {buildCompleteIconPrecache,isCompleteIconPath} from '../lib/brand/icon-cache-policy';

describe('T14 icon superset',()=>{
  it('keeps curated resolution and makes every verified complete-library PNG addressable',()=>{
    expect(ZEUSTEK_ICON_DEFINITIONS).toHaveLength(131);
    expect(resolveZeusTekIcon('weather')).toEqual(findZeusTekIcon('weather'));
    expect(ZEUSTEK_COMPLETE_ICONS).toHaveLength(748);
    expect(new Set(ZEUSTEK_COMPLETE_ICONS.map(icon=>icon.src)).size).toBe(748);
    for(const icon of ZEUSTEK_COMPLETE_ICONS){
      expect(existsSync('public'+icon.src),icon.src).toBe(true);
      expect(readFileSync('public'+icon.src).subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(resolveZeusTekIcon(icon.key)).not.toBeNull();
    }
  });
  it('resolves semantic centres to the requested artwork with accessible text',()=>{
    for(const name of Object.keys(ZEUSTEK_SEMANTIC_ICON_MAP))expect(resolveZeusTekIcon(name),name).not.toBeNull();
    const html=renderToStaticMarkup(createElement(ZeusTekAssetIcon,{name:'dive-centres',label:'Dive Centres'}));
    expect(html).toContain('/zeustek-complete/dive_centre_operator.png');
    expect(html).toContain('alt="Dive Centres"');
    expect(resolveZeusTekIcon('not-an-icon')).toBeNull();
  });
  it('precaches a small high-use subset and recognises only complete asset paths for runtime caching',()=>{
    const entries=buildCompleteIconPrecache(src=>readFileSync('public'+src));
    expect(entries.length).toBeGreaterThan(0);expect(entries.length).toBeLessThanOrEqual(22);
    expect(entries.every(entry=>typeof entry.revision==='string'&&entry.revision.length===64)).toBe(true);
    expect(isCompleteIconPath('/brand/icons/zeustek-complete/dive_centre_operator.png')).toBe(true);
    expect(isCompleteIconPath('/api/dive-data')).toBe(false);
    expect(isCompleteIconPath('/brand/icons/zeustek-complete/../secret.png')).toBe(false);
  });
});
