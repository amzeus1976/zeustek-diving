import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {ReferenceList} from '../components/workflow/synthetic-fixture-review';
import {buildReferenceIndex,buildSyntheticCleanupPlan,discoverFixtureCandidates,recordDestination,recommendedRecordAction,resolveReviewReference,type CanonicalRecordSnapshot,type RecordReference} from '../lib/workflow/synthetic-fixtures';
const rows:CanonicalRecordSnapshot[]=[
 {kind:'cylinder-fill',record:{entityId:'fill',provider:'Acceptance fixture — no actual fill',cylinderEquipmentId:'real-tank'}},
 {kind:'gas-analysis',record:{entityId:'analysis',fillId:'fill',oxygenPct:21,notes:''}},
 {kind:'cylinder',record:{entityId:'real-tank',name:'Owner tank',cylinderNumber:'03'}},
];
describe('Exact linked-record review preserves cleanup guards',()=>{
 it('opens the exact loaded Gas Analysis without inferring that it is a disposable fixture',()=>{
  const reference=buildReferenceIndex(rows).get('fill')![0]!;const before=JSON.stringify(rows);
  expect(resolveReviewReference(reference,rows)).toBe(rows[1]);expect(reference.synthetic).not.toBe(true);
  expect(discoverFixtureCandidates(rows).map(row=>row.entityId)).toEqual(['fill']);
  expect(recommendedRecordAction('cylinder-fill',[reference])).toBe('manual-review');
  expect(buildSyntheticCleanupPlan(['fill'],rows).deleteIds).toEqual([]);expect(JSON.stringify(rows)).toBe(before);
 });
 it('never substitutes a different kind or unprovided record for an unavailable reference',()=>{
  const ref:RecordReference={sourceKind:'gas-analysis',sourceId:'absent',sourceTitle:'Unavailable',path:'fillId'};
  expect(resolveReviewReference(ref,rows)).toBeUndefined();expect(resolveReviewReference({...ref,sourceId:'fill'},rows)).toBeUndefined();
 });
 it('allows archive-only handling after the owner explicitly archives every inbound dependency, never deletion',()=>{
  const archived=rows.map(row=>row.record.entityId==='analysis'?{...row,record:{...row.record,archived:true,suppressedFromUse:true}}:row);
  const reference=buildReferenceIndex(archived).get('fill')![0]!;
  expect(reference.synthetic).not.toBe(true);expect(recommendedRecordAction('cylinder-fill',[reference])).toBe('archive');
  expect(buildSyntheticCleanupPlan(['fill'],archived)).toMatchObject({deleteIds:[],archiveIds:['fill']});
  const withActiveDive=[...archived,{kind:'dive',record:{entityId:'real-dive',cylinders:[{fillId:'fill'}]}}];
  expect(recommendedRecordAction('cylinder-fill',buildReferenceIndex(withActiveDive).get('fill')!)).toBe('manual-review');
 });
 it('provides an accessible direct review control while preserving the dependency explanation',()=>{
  const refs=buildReferenceIndex(rows).get('fill')!;const review=vi.fn();
  const html=renderToStaticMarkup(createElement(ReferenceList,{references:refs,review}));
  expect(html).toContain('Review Gas analyses record');expect(html).toContain('type="button"');expect(html).toContain('fillId');expect(review).not.toHaveBeenCalled();
 });
 it('keeps organisation review in Dive Centres and humans in People',()=>{
  expect(recordDestination('operator').destination).toBe('Dive Centres');expect(recordDestination('person').destination).toBe('People');
  expect(recordDestination('cylinder-fill').destination).toBe('Cylinders & Gas');expect(recordDestination('gas-analysis').destination).toBe('Cylinders & Gas');
 });
});
