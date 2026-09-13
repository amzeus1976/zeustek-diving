import {expect,it} from 'vitest';
import {auditSiteCoordinate} from '../lib/site-coordinate-audit';
it('finds the confirmed reef correction',()=>{const r=auditSiteCoordinate({name:'Shark & Yolanda Reef',latitude:27.7278,longitude:34.2556});expect(r.status).toBe('Correction available');expect(r.target?.longitude).toBe(34.2589);});
it('does not guess absent sites or distant namesakes',()=>{expect(auditSiteCoordinate({name:'Unlisted QA Site'}).status).toBe('No Google match');expect(auditSiteCoordinate({name:'Shark & Yolanda Reef',latitude:54,longitude:-3}).status).toBe('Location needs review');});
it('recognises matching coordinates',()=>{expect(auditSiteCoordinate({name:'Shark & Yolanda Reef',latitude:27.7252,longitude:34.2589}).status).toBe('Matches Google');});

it('prefers verified guide coordinates over Google pins',()=>{const r=auditSiteCoordinate({name:'29 Steps'});expect(r.status).toBe('Researched correction available');expect(r.target?.latitude).toBeCloseTo(56.118564,5);});
