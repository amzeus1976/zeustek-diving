import {describe,it,expect} from 'vitest';
import {cloudAccountIndicator} from '../lib/offline/cloud-account-indicator';
describe('Truthful Cloud account status',()=>{
 it('is green only after a successful status read with no pending edits',()=>{expect(cloudAccountIndicator({account:true,online:true,loaded:true,pending:0,conflicts:0,error:false})).toMatchObject({state:'synced',label:'Cloud account · Synced'});});
 it.each([{pending:2,conflicts:0},{pending:2,conflicts:1},{online:false},{loaded:false},{error:true}])('warns for pending, review, offline, loading or failed status: %j',override=>{expect(cloudAccountIndicator({account:true,online:true,loaded:true,pending:0,conflicts:0,error:false,...override}).state).toBe('pending');});
 it('shows disabled when no cloud account is configured',()=>{expect(cloudAccountIndicator({account:false,online:true,loaded:true,pending:0,conflicts:0,error:false}).state).toBe('disabled');});
});
