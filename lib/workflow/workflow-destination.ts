import {resolveWorkflowRoute,WORKFLOW_ROUTES} from './workflow-model';

export interface WorkflowDestination {route:string;recordId?:string;params?:Record<string,string>}
const recordKeys:Record<string,string>={People:'personId','Dive Centres':'operatorId',Sites:'siteId',Trips:'tripId',Logbook:'diveId','Dive Plans':'planId','Gas Planning':'gasPlanId','Dive Computer Imports':'importId'};
const parameterKeys=new Set(['recordId',...Object.values(recordKeys),'divePlanId','newPlan','source','tab','view','edit','personId','equipmentId','eventId','loadoutId','bucketId']);
const routes=new Set([...WORKFLOW_ROUTES.map(item=>item.route),'Dive Centres','Changelog','Imports','Sync','Backups']);

export function parseWorkflowDestination(input:string|WorkflowDestination):WorkflowDestination {
  if(typeof input!=='string'){
    const route=resolveWorkflowRoute(input.route);
    return {route:routes.has(route)?route:'Overview',...(input.recordId?{recordId:input.recordId}:{}),...(input.params?{params:Object.fromEntries(Object.entries(input.params).filter(([key])=>parameterKeys.has(key)))}:{})};
  }
  if(/^[a-z][a-z0-9+.-]*:/i.test(input)||input.startsWith('//'))return {route:'Overview'};
  const separator=input.search(/&(?=(?:recordId|personId|operatorId|siteId|tripId|diveId|planId|gasPlanId|divePlanId|importId|newPlan|tab|view|edit)=)/);
  const isQuery=input.startsWith('?')||input.startsWith('/?');
  const query=new URLSearchParams(isQuery?input.replace(/^\/?\?/,''):separator>=0?input.slice(separator+1):'');
  const section=isQuery?query.get('section'):separator>=0?input.slice(0,separator):input;
  const resolved=resolveWorkflowRoute(section);
  const route=routes.has(resolved)?resolved:'Overview';
  const params=Object.fromEntries([...query.entries()].filter(([key])=>parameterKeys.has(key)));
  if(route==='Data & Backups'&&section&&['Imports','Backups','Sync'].includes(section)&&!params.tab)params.tab=section;
  const recordId=query.get('recordId')??query.get(recordKeys[route]??'recordId');
  return {route,...(recordId?{recordId}:{}),...(Object.keys(params).length?{params}:{})};
}

export function workflowDestinationUrl(input:string|WorkflowDestination){
  const destination=parseWorkflowDestination(input);
  const params=new URLSearchParams({section:destination.route,...destination.params});
  if(destination.recordId){
    params.set('recordId',destination.recordId);
    const key=recordKeys[destination.route];if(key)params.set(key,destination.recordId);
  }
  return '?'+params.toString();
}
