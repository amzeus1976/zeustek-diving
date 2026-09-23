import {describe,it,expect} from 'vitest';
import {parseWorkflowDestination,workflowDestinationUrl} from '../lib/workflow/workflow-destination';
import {workflowLinkDestination} from '../lib/workflow/workflow-link';
describe('T14 in-route record links',()=>{
 it('preserves domain configuration links through the shared navigation guard',()=>{
  const result=parseWorkflowDestination('/?section=Settings&config=weather-conditions');
  expect(result.params?.config).toBe('weather-conditions');
  expect(workflowDestinationUrl(result)).toContain('config=weather-conditions');
 });
 it('handles only local workflow links and leaves external or unrelated destinations alone',()=>{
  expect(workflowLinkDestination('/?section=Sites&siteId=s')?.recordId).toBe('s');
  expect(workflowLinkDestination('https://other.example/?section=Sites')).toBeNull();
  expect(workflowLinkDestination('/api/conditions')).toBeNull();
 });
});
