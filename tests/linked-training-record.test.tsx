import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {LinkedTrainingRecord} from '../components/linked-training-record';
import type {Stored,TrainingProgressRecord} from '../lib/offline/dive-planning';
describe('Exact Calendar training navigation',()=>{
 it('shows the selected saved record instead of combined or similarly named course evidence',()=>{const record={entityId:'exact',courseTitle:'Owner course',agency:'PADI',status:'planned',metRequirementIds:['a'],modifiedAt:'2026-10-05T10:00:00Z'} as Stored<TrainingProgressRecord>;const before=structuredClone(record),html=renderToStaticMarkup(<LinkedTrainingRecord record={record}/>);expect(html).toContain('Owner course');expect(html).toContain('1 recorded requirements');expect(html).toContain('exact saved training record');expect(record).toEqual(before);});
 it('reports an unavailable exact endpoint without selecting or editing another record',()=>{const html=renderToStaticMarkup(<LinkedTrainingRecord record={null}/>);expect(html).toContain('no other record has been substituted');expect(html).toContain('role="alert"');});
 it('escapes owner-entered text and offers no mutation controls',()=>{const record={courseTitle:'<script>owner</script>',agency:'PADI',status:'planned',modifiedAt:'2026-10-05'} as Stored<TrainingProgressRecord>;const html=renderToStaticMarkup(<LinkedTrainingRecord record={record}/>);expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain('<button');});
});
