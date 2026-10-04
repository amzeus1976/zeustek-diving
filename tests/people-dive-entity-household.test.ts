import {describe,it,expect} from 'vitest';

describe('household Person boundary',()=>{
  it('keeps human data but omits private Dive Entity references from shared and copied People',async()=>{
    const boundary=await import('../lib/server/household-person-boundary').catch(()=>null);
    const input={name:'Alex',email:'alex@example.invalid',operatorId:'private-centre',currentDiveOperatorId:'private-boat',operatorName:'Private Centre',operatorNotes:'Private business note',operatorPostcode:'PRIVATE',bookingUrl:'https://private.example.invalid',roles:{buddy:true}};
    const result=boundary?.householdPersonProjection?.(input)??input;
    expect(result).toMatchObject({name:'Alex',email:'alex@example.invalid',roles:{buddy:true}});
    expect(result).not.toHaveProperty('operatorId');
    expect(result).not.toHaveProperty('currentDiveOperatorId');
    expect(result).not.toHaveProperty('operatorName');
    expect(result).not.toHaveProperty('operatorNotes');
    expect(result).not.toHaveProperty('operatorPostcode');
    expect(result).not.toHaveProperty('bookingUrl');
  });
});


describe('private owner favourites in household sharing and copy',()=>{
  it.each([true,false])('omits favourite=%s and retains ordinary human fields without rewriting the source',async favourite=>{
    const {householdPersonProjection}=await import('../lib/server/household-person-boundary');
    const source={entityId:'fixture-person',name:'Alex',favourite,roles:{buddy:true},qualifications:'Rescue Diver'};
    const before=structuredClone(source);
    const shared=householdPersonProjection(source);
    const copied={...shared,entityId:'recipient-person'};
    expect(shared).not.toHaveProperty('favourite');expect(copied).not.toHaveProperty('favourite');
    expect(shared).toMatchObject({name:'Alex',roles:{buddy:true},qualifications:'Rescue Diver'});
    expect(source).toEqual(before);
  });
});
