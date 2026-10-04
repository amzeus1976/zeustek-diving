import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {DataReviewLinkControls} from '../components/admin/data-review-links';
import {ComputerSourceReview} from '../components/dive-computer-data';
import type {ImportResolutionRecord} from '../lib/offline/import-resolution';
import type {Stored} from '../lib/offline/dive-planning';
it('links existing configuration controls to the owner review tabs without creating parallel navigation',()=>{
 const html=renderToStaticMarkup(createElement(DataReviewLinkControls,{go:()=>undefined}));
 expect(html).toContain('section=Data+%26+Backups');expect(html).toContain('tab=Evidence+%26+data+health');expect(html).toContain('tab=Calendar+download');expect(html).toContain('Nothing is published');
});
it('renders exact retained import decisions and linked records without raw decision payloads or automatic correction',()=>{
 const resolution:Stored<ImportResolutionRecord>={entityId:'decision-id',importId:'import-id',targetDiveId:'dive-id',targetRevisionEventId:null,sourceProfileIds:['profile-id'],decidedAt:'2026-10-01T00:00:00Z',decisions:[{fieldPath:'durationMin',action:'keep-zeustek',zeustekValue:'PRIVATE-VALUE',importedValue:'PRIVATE-IMPORTED',committedValue:'PRIVATE-COMMITTED',resolutionClass:'scalar',provenance:'direct',transformIds:[],sourceSegmentIds:[]}],createdAt:'2026-10-01',modifiedAt:'2026-10-01'};
 const html=renderToStaticMarkup(createElement(ComputerSourceReview,{review:{unavailable:false,resolution}}));
 expect(html).toContain('durationMin');expect(html).toContain('keep-zeustek');expect(html).toContain('diveId=dive-id');expect(html).toContain('profileId=profile-id');expect(html).not.toMatch(/PRIVATE-|<button|Save/);
 const missing=renderToStaticMarkup(createElement(ComputerSourceReview,{review:{unavailable:true}}));expect(missing).toContain('No substitute profile');
});
