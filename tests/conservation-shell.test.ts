import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivityForm, ConservationPage, conservationDiveLabel, sortConservationDives } from '../components/conservation-page';
import { MediaGallery } from '../components/media-gallery';

describe('Conservation integration shell', () => {
  it('renders ordered, labelled empty states without claiming certification', () => {
    const html = renderToStaticMarkup(createElement(ConservationPage, {go: () => {}}));
    expect(html).toContain('<h1>Conservation &amp; AWARE</h1>');
    expect(html).toContain('Search activities');
    expect(html).toContain('does not certify completion');
    expect(html.indexOf('Calculated conservation totals')).toBeLessThan(html.indexOf('AWARE learning'));
    expect(html.indexOf('Recent conservation activity')).toBeLessThan(html.indexOf('Linked sites'));
  });
  it('accepts evidence files only when opted in and preserves the existing media default', () => {
    const normal = renderToStaticMarkup(createElement(MediaGallery, {ownerKind:'dive',ownerId:'existing'}));
    const evidence = renderToStaticMarkup(createElement(MediaGallery, {ownerKind:'conservation_activity',ownerId:'existing',acceptFiles:true}));
    expect(normal).toContain('accept="image/*,video/*"');
    expect(normal).not.toContain('application/pdf');
    expect(evidence).toContain('accept="image/*,video/*,application/pdf,text/plain"');
    expect(evidence).toContain('evidence files');
  });
  it('uses one canonical Dive selector, local Site combobox, distinguishable oldest-first labels and accessible help',()=>{
    const dives=[
      {entityId:'latest',date:'2026-09-05',timeIn:'14:00',site:'St Abbs Harbour – East',diveNumber:65,maxDepthM:14},
      {entityId:'oldest',date:'2026-09-05',timeIn:'10:00',site:'St Abbs Harbour – East',diveNumber:64,maxDepthM:12},
    ];
    expect(sortConservationDives(dives as never).map(dive=>dive.entityId)).toEqual(['oldest','latest']);
    expect(conservationDiveLabel(dives[0] as never)).toContain('14:00 · Dive #65 · 14 m');
    const html=renderToStaticMarkup(createElement(ActivityForm,{item:null,initialType:'marine-life',linked:{dives,sites:[{entityId:'site-1',name:'St Abbs Harbour – East',location:'St Abbs'}],people:[]},programmes:[],close:()=>{},saved:async()=>{}} as never));
    expect(html.match(/aria-label="Linked Dive"/g)).toHaveLength(1);
    expect(html).not.toContain('Find an existing Dive');
    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('aria-label="Linked site"');
    expect(html).toContain('No linked Dive');
    expect(html).toContain('Information about Activity type');
    expect(html).toContain('Information about Existing Site');
    expect(html).toContain('Information about Participants / external reference / media');
  });
});
