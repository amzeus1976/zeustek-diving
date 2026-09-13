import {describe,it,expect} from 'vitest';
import {matchesProduct,matchedOffers} from '../lib/product-match';
import {logTimeRange} from '../lib/log-time';
describe('verified wishlist comparisons',()=>{
 it('rejects unrelated bargains and incomplete bundles',()=>{
  expect(matchesProduct('Suunto Nautic','Anti motion sickness sea bands')).toBe(false);
  expect(matchesProduct('Suunto Nautic','Replacement strap for Suunto Nautic')).toBe(false);
  expect(matchesProduct('Suunto Nautic with dive pod','Suunto Nautic')).toBe(false);
  expect(matchesProduct('Xdeep Stealth 2.0 Tec setup','Xdeep Stealth 2.0 Tec wing')).toBe(false);
  expect(matchesProduct('Suunto Nautic','SUUNTO Nautic dive computer')).toBe(true);
 });
 it('only takes an offer belonging to the matching product',()=>{
  const offers=matchedOffers([{ '@type':'Product',name:'Sea bands',offers:{'@type':'Offer',price:9.75,priceCurrency:'GBP'}},{'@type':'Product',name:'Suunto Nautic',offers:{'@type':'Offer',price:625,priceCurrency:'GBP'}}],'Suunto Nautic');
  expect(offers).toHaveLength(1);expect(offers[0]?.price).toBe(625);
 });
 it('does not present variant aggregate prices as an exact match',()=>expect(matchedOffers({'@type':'Product',name:'Suunto Nautic',offers:{'@type':'AggregateOffer',lowPrice:20,priceCurrency:'GBP'}},'Suunto Nautic')).toEqual([]));
});
describe('logbook entry and exit times',()=>{
 it('preserves midnight crossings without calculating duration',()=>expect(logTimeRange('23:45','00:30')).toBe('23:45 – 00:30'));
 it('shows partial and absent times honestly',()=>{expect(logTimeRange('09:12:00','')).toBe('09:12 – —');expect(logTimeRange(null,'25:00')).toBe('— – —');});
});
