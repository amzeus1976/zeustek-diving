import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';

describe('People and Dive Entity workspace ownership',()=>{
  it('keeps long human names readable inside narrow Person cards',()=>{
    const css=readFileSync(new URL('../components/people-operators.module.css',import.meta.url),'utf8');
    const heading=css.match(/\.personCard h2\s*\{([^}]+)\}/)?.[1]??'';
    expect(heading).toMatch(/overflow-wrap:\s*anywhere/);
    expect(heading).not.toMatch(/text-overflow:\s*ellipsis/);
  });
  it('offers affiliation editing in People using existing entities, without organisation CRUD',async()=>{
    const module=await import('../components/people/person-entity-relationships').catch(()=>null);
    const Component=module?.PersonEntityRelationships;
    const html=Component?renderToStaticMarkup(createElement(Component,{
      person:{entityId:'person-1',name:'Alex',role:'buddy',agency:'',highestQualification:'',membershipNumber:'',email:'',phone:'',emergencyContact:'',notes:'',createdAt:'',modifiedAt:''},
      operators:[{entityId:'centre-1',name:'Blue Reef Diving',operatorType:'dive-centre',location:'',website:'',notes:'',createdAt:'',modifiedAt:''}],
      links:[],close:()=>{},onSaved:()=>{},go:()=>{},
    })):'';
    expect(html).toContain('Blue Reef Diving');
    expect(html).toContain('Add affiliation');
    expect(html).not.toContain('Operator name');
  });
  it('offers entity-to-entity links without editing People records in Dive Centres',async()=>{
    const module=await import('../components/dive-centres/entity-relationships').catch(()=>null);
    const Component=module?.EntityRelationships;
    const centre={entityId:'centre',name:'Blue Reef Diving',operatorType:'dive-centre' as const,location:'',website:'',notes:'',createdAt:'',modifiedAt:''};
    const boat={...centre,entityId:'boat',name:'MV Blue Reef',operatorType:'dive-boat' as const};
    const html=Component?renderToStaticMarkup(createElement(Component,{entity:centre,operators:[centre,boat],links:[],close:()=>{},onSaved:()=>{},go:()=>{}})):'';
    expect(html).toContain('MV Blue Reef');
    expect(html).toContain('Add entity relationship');
    expect(html).not.toContain('Create Person');
  });
});
