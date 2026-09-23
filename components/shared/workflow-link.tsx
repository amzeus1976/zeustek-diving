'use client';
import type {ReactNode} from 'react';
import {WORKFLOW_LINK_EVENT,workflowLinkDestination} from '../../lib/workflow/workflow-link';
export function WorkflowLink({href,children}:{href:string;children:ReactNode}){
 return <a href={href} onClick={event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
  const destination=workflowLinkDestination(href);if(!destination)return;
  event.preventDefault();
  window.dispatchEvent(new CustomEvent(WORKFLOW_LINK_EVENT,{detail:destination}));
 }}>{children}</a>;
}
