import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {OverheadEditor,OverheadProfileView} from '../components/site-overhead-profile';
const site={entityId:'site',name:'Original Site',location:'Location',access:'Access',hazards:'Original hazards',notes:'',maxDepthM:30,createdAt:'',modifiedAt:''};
describe('Site wreck/overhead presentation',()=>{
  it('puts exterior facts before hazard/egress/routes/observations and disclosed trained details, without implying readiness',()=>{
    const html=renderToStaticMarkup(createElement(OverheadProfileView,{profile:{siteId:'site',featureType:'Wreck',hazards:[{id:'h',label:'Silt'}],observations:[{id:'o',date:'2026-09-13',notes:'Recorded conditions',diveId:'original-dive'}],attachmentIds:['original-media']}}));
    expect(html.indexOf('Exterior / open-water information')).toBeLessThan(html.indexOf('Hazards'));expect(html.indexOf('Dated route observations')).toBeLessThan(html.indexOf('Trained-overhead / penetration details'));expect(html).toContain('No readiness is inferred');expect(html).toContain('/?section=Logbook&amp;diveId=original-dive');expect(html).toContain('/api/media?id=original-media');expect(html).not.toContain('<details open');
  });
  it('protects editable overlay and labels fields; Site and Planner reuse one profile with read-only summary',()=>{
    const html=renderToStaticMarkup(createElement(OverheadEditor,{site,profile:{siteId:'site'},close:()=>{},saved:()=>{}}));expect(html).toContain('data-editable="true"');expect(html).toContain('data-dialog-close');expect(html).toContain('Minimum recorded depth (m)');expect(html).toContain('Save wreck profile');
    const source=readFileSync(new URL('../app/dashboard-client.tsx',import.meta.url),'utf8');expect(source).toContain('<SiteOverheadSection key={viewing.entityId} site={viewing}/>');expect(source.match(/readOnly summaryOnly/g)).toHaveLength(2);
  });
  it('opts only the T03 gallery into the shared focus-managed original media viewer',()=>{
    const source=readFileSync(new URL('../components/site-overhead-profile.tsx',import.meta.url),'utf8');
    expect(source).toContain('retainOfflineMetadata acceptFiles accessibleViewer');
    const media=readFileSync(new URL('../components/media-gallery.tsx',import.meta.url),'utf8');
    expect(media).toContain('accessibleViewer = false');
    expect(media).toContain('<AccessibleDialog label="Full resolution media viewer"');
    expect(media).toContain('Close full-size media');
  });
});
