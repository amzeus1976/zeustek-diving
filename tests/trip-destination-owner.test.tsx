import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {TripEditor} from '../components/trips-expeditions';
import type {PersonRecord,Stored} from '../lib/offline/dive-planning';
const people=[{entityId:'owner-person',name:'Zeus',role:'buddy',roles:{ownerProfile:true}},{entityId:'other-zeus',name:'Zeus',role:'buddy'}] as Array<Stored<PersonRecord>>;
describe('Trip destination and canonical owner presentation',()=>{
 it('offers a labelled searchable destination with exact saved Site choices',()=>{const html=renderToStaticMarkup(createElement(TripEditor,{item:null,items:[],plans:[],sites:[],people,equipment:[],equipmentSets:[],currentUserId:'dummy-account',sourceBooking:null,close:()=>{},saved:()=>{}}));expect(html).toMatch(/<input[^>]*list=/);expect(html).toContain('Type a Site name');});
 it('shows only the canonical owner as Me / Self while leaving the source Person roles untouched',()=>{const before=JSON.stringify(people);const html=renderToStaticMarkup(createElement(TripEditor,{item:null,items:[],plans:[],sites:[],people,equipment:[],equipmentSets:[],currentUserId:'dummy-account',sourceBooking:null,close:()=>{},saved:()=>{}}));expect(html).toContain('<b>Me</b><small>Self');expect(html).toContain('<b>Zeus</b><small>buddy');expect(JSON.stringify(people)).toBe(before);});
});
