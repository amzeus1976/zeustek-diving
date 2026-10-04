import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {ZeusTekAssetIcon} from '../components/brand/zeustek-asset-icon';
import {resolveZeusTekIcon} from '../lib/brand/zeustek-icon-resolver';
import {ZEUSTEK_ICON_DEFINITIONS} from '../lib/brand/zeustek-icon-registry';
import {ZEUSTEK_COMPLETE_ICONS} from '../lib/brand/zeustek-complete-icon-registry.generated';
const sha=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
describe('Supplied Top Buddy and favourites art',()=>{
 it('adds two preferred status icons through the existing curated resolver while preserving131 original entries and748 superset',()=>{expect(ZEUSTEK_ICON_DEFINITIONS.filter(icon=>!['top-buddy','favourites'].includes(icon.key))).toHaveLength(131);expect(ZEUSTEK_COMPLETE_ICONS).toHaveLength(748);for(const key of ['top-buddy','favourites'])expect(resolveZeusTekIcon(key)?.src).toBe('/brand/icons/owner-status/'+key+'.png');});
 it('keeps unchanged masters outside public precache and128px RGBA runtime PNGs with verifiable hashes',()=>{const manifest=JSON.parse(readFileSync('lib/brand/owner-status-icons.manifest.json','utf8')) as {icons:Array<{key:string,master:string,masterSha256:string,src:string,runtimeSha256:string}>};expect(manifest.icons).toHaveLength(2);for(const entry of manifest.icons){expect(existsSync(entry.master)).toBe(true);expect(entry.master).not.toMatch(/^public\//);const master=readFileSync(entry.master),runtime=readFileSync('public'+entry.src);expect(sha(master)).toBe(entry.masterSha256);expect(sha(runtime)).toBe(entry.runtimeSha256);expect(runtime.subarray(1,4).toString()).toBe('PNG');expect(runtime.readUInt32BE(16)).toBe(128);expect(runtime.readUInt32BE(20)).toBe(128);expect(runtime[25]).toBe(6);expect(runtime.length).toBeLessThan(100_000);}});
 it('keeps artwork accessible/decorative as requested and does not use a generic replacement',()=>{const visible=renderToStaticMarkup(createElement(ZeusTekAssetIcon,{name:'top-buddy',label:'Top Buddy',size:40}));expect(visible).toContain('alt="Top Buddy"');expect(visible).toContain('top-buddy.png');const decorative=renderToStaticMarkup(createElement(ZeusTekAssetIcon,{name:'favourites',decorative:true,size:28}));expect(decorative).toContain('aria-hidden="true"');expect(decorative).toContain('favourites.png');});
});
