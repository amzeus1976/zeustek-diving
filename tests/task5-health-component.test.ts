import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {DataHealthResults} from '../components/admin/data-health';
import {evaluateDataHealth} from '../lib/data-health/health-model';
import {DATA_REVIEW_KINDS,type OwnerDataSnapshot} from '../lib/data-health/read-owner-snapshot';
it('shows uncertainty and exact canonical source links without raw record labels or sensitive values',()=>{
 const snapshot:OwnerDataSnapshot={accountId:'owner-private',snapshotAt:'2026-10-02T00:00:00Z',records:[{kind:'dive',id:'exact-dive',data:{date:'2026-10-01',siteId:'absent-site',notes:'PRIVATE-NOTES',email:'PRIVATE-CONTACT'}}],completeKinds:DATA_REVIEW_KINDS.filter(kind=>kind!=='site'),coverage:[],imageEvidence:[]};
 const html=renderToStaticMarkup(createElement(DataHealthResults,{result:evaluateDataHealth(snapshot)}));
 expect(html).toContain('Unknown');expect(html).toContain('site');expect(html).toContain('diveId=exact-dive');expect(html).not.toMatch(/PRIVATE-|owner-private|absent-site/);
 expect(html).toContain('Last device snapshot');expect(html).toContain('not a safety');expect(html).toContain('Inspection filters');
});
it('bounds affected-source rows and provides accessible paging rather than hiding remaining links',()=>{
 const snapshot:OwnerDataSnapshot={accountId:'owner',snapshotAt:'2026-10-02T00:00:00Z',records:Array.from({length:30},(_,index)=>({kind:'dive',id:`dive-${index}`,data:{date:'2026-10-01',siteId:'missing'}})),completeKinds:DATA_REVIEW_KINDS,coverage:[],imageEvidence:[]};
 const html=renderToStaticMarkup(createElement(DataHealthResults,{result:evaluateDataHealth(snapshot)}));
 expect(html).toContain('30 affected records');expect(html).toContain('Next affected sources');expect(html.match(/Review source/g)?.length).toBe(50);expect(html).not.toContain('diveId=dive-29');
});
