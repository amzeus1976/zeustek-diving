import {describe,it,expect} from 'vitest';
import {diveHeat} from '../lib/dive-heat';
describe('logged dive heat map',()=>{
 it('counts visits and uses corrected linked coordinates',()=>{
  const site={entityId:'a',name:'Reef',latitude:27,longitude:34};
  const result=diveHeat([{site:'Old name',siteId:'a',latitude:99,longitude:88},{site:'Reef'}],[site]);
  expect(result.mapped).toBe(2);expect(result.points).toEqual([{latitude:27,longitude:34,count:2,name:'Reef'}]);
 });
 it('does not guess between duplicate names or invalid coordinates',()=>{
  const result=diveHeat([{site:'Reef'},{site:'Missing',latitude:91,longitude:0}],[{entityId:'a',name:'Reef',latitude:27,longitude:34},{entityId:'b',name:'Reef',latitude:50,longitude:1}]);
  expect(result.skipped).toBe(2);expect(result.points).toEqual([]);
 });
 it('allows valid log coordinates and zero coordinates',()=>{
  expect(diveHeat([{site:'Offshore',latitude:0,longitude:0}],[]).mapped).toBe(1);
  expect(diveHeat([{site:'Bad',latitude:NaN,longitude:0}],[]).skipped).toBe(1);
 });
});
