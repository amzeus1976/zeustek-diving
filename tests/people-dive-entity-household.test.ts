import {describe,it,expect} from 'vitest';

describe('household Person boundary',()=>{
  it('keeps human data but omits private Dive Entity references from shared and copied People',async()=>{
    const module=await import('../lib/server/household-person-boundary').catch(()=>null);
    const input={name:'Alex',email:'alex@example.invalid',operatorId:'private-centre',currentDiveOperatorId:'private-boat',operatorName:'Private Centre',operatorNotes:'Private business note',operatorPostcode:'PRIVATE',bookingUrl:'https://private.example.invalid',roles:{buddy:true}};
    const result=module?.householdPersonProjection?.(input)??input;
    expect(result).toMatchObject({name:'Alex',email:'alex@example.invalid',roles:{buddy:true}});
    expect(result).not.toHaveProperty('operatorId');
    expect(result).not.toHaveProperty('currentDiveOperatorId');
    expect(result).not.toHaveProperty('operatorName');
    expect(result).not.toHaveProperty('operatorNotes');
    expect(result).not.toHaveProperty('operatorPostcode');
    expect(result).not.toHaveProperty('bookingUrl');
  });
});
