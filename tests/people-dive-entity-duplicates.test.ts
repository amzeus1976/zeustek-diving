import {describe,it,expect} from 'vitest';
import {reviewEntityDuplicates,reviewPersonDuplicates} from '../lib/operators/duplicate-review';

describe('duplicate review before creating canonical records',()=>{
  it('flags same name and location while allowing distinct boats at one website',()=>{
    const rows=[{entityId:'a',name:'MV Explorer I',location:'Red Sea',website:'https://fleet.example.invalid'},
      {entityId:'b',name:'Blue Reef Centre',location:'Hurghada',website:'https://blue.example.invalid'}];
    expect(reviewEntityDuplicates({name:'Blue Reef Centre',location:'Hurghada',website:''},rows).map(row=>row.entityId)).toEqual(['b']);
    expect(reviewEntityDuplicates({name:'MV Explorer II',location:'Red Sea',website:'https://fleet.example.invalid'},rows)).toEqual([]);
  });
  it('flags a potentially repeated human without automatically merging records',()=>{
    const rows=[{entityId:'alex',name:'Alex Morgan',email:'alex@example.invalid'}];
    expect(reviewPersonDuplicates({name:'Alex Morgan',email:''},rows).map(row=>row.entityId)).toEqual(['alex']);
  });
});
