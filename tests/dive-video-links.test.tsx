import 'fake-indexeddb/auto';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {normalizeDiveVideoUrl} from '../lib/logbook/dive-video-links';
import {DiveVideoLinks} from '../components/logbook/dive-video-links';
import {saveDivePerspective} from '../lib/offline/dive-perspectives';
import {configureDiveStore,saveLocalRecord,listLocalDiveRecords} from '../lib/offline/dive-store';
import {zeustekDb} from '../lib/offline/db';
import {localBackupPayload,restoreLocalPayload} from '../lib/offline/local-backup';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('video-test');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
describe('Private logged Dive video links',()=>{
 it.each(['https://www.youtube.com/watch?v=TZNYXImh9V0','https://youtu.be/TZNYXImh9V0?si=tracking','https://www.youtube.com/shorts/TZNYXImh9V0'])('normalizes a supported YouTube link without tracking: %s',url=>{expect(normalizeDiveVideoUrl(url)).toBe('https://www.youtube.com/watch?v=TZNYXImh9V0');expect(fetch).not.toHaveBeenCalled();});
 it.each(['javascript:alert(1)','https://youtube.com.evil.test/watch?v=TZNYXImh9V0','https://user:password@youtube.com/watch?v=TZNYXImh9V0','https://www.youtube.com/watch?v=bad','https://example.org/video','http://www.youtube.com/watch?v=TZNYXImh9V0'])('rejects unsafe or unsupported URL: %s',url=>expect(normalizeDiveVideoUrl(url)).toBeNull());
 it('shows named controls and safe links with no embed or automatic playback',()=>{const html=renderToStaticMarkup(<DiveVideoLinks links={[{url:'https://www.youtube.com/watch?v=TZNYXImh9V0',title:'<script>My Dive</script>'}]} change={()=>{}}/>);expect(html).toContain('YouTube URL');expect(html).toContain('Add video');expect(html).toContain('noopener noreferrer');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<iframe');expect(html).not.toContain('<script>');});
 it('persists and backs up only the exact Dive story without changing facts or sibling records',async()=>{await saveLocalRecord('dive',{entityId:'dive-67',diveNumber:67,site:'Existing site',date:'2026-10-03',story:{narrative:'Keep this'},gas:'Air'});await saveLocalRecord('dive',{entityId:'other-dive',site:'Other'});const before=(await listLocalDiveRecords('dive')).find(x=>x.entityId==='other-dive');await saveDivePerspective('dive-67',{story:{videoLinks:[{url:'https://www.youtube.com/watch?v=TZNYXImh9V0',title:'My video'}]}});const backup=await localBackupPayload();for(const table of zeustekDb.tables)await table.clear();await restoreLocalPayload(backup);expect((await listLocalDiveRecords('dive')).find(x=>x.entityId==='dive-67')).toMatchObject({diveNumber:67,site:'Existing site',story:{narrative:'Keep this',videoLinks:[{url:'https://www.youtube.com/watch?v=TZNYXImh9V0',title:'My video'}]}});expect((await listLocalDiveRecords('dive')).find(x=>x.entityId==='other-dive')).toEqual(before);expect(fetch).not.toHaveBeenCalled();});
});
