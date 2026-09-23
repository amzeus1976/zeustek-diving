import {parseWorkflowDestination} from './workflow-destination';
export const WORKFLOW_LINK_EVENT='zeustek:workflow-link';
export function workflowLinkDestination(href:string){
 if(!/^(?:\/)?\?/.test(href))return null;
 const query=new URLSearchParams(href.replace(/^\//,''));
 return query.has('section')?parseWorkflowDestination(href):null;
}
