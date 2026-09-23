'use client';
import {useCallback,useEffect,useRef} from 'react';
import {WORKFLOW_LINK_EVENT} from '../../lib/workflow/workflow-link';
import {recordNavigation} from '../../lib/editor/navigation-guard';
import {rememberEditorTrigger} from '../../lib/editor/focus-return';
import {parseWorkflowDestination,workflowDestinationUrl,type WorkflowDestination} from '../../lib/workflow/workflow-destination';

export function useWorkflowNavigation(apply:(destination:WorkflowDestination)=>void){
  const applyRef=useRef(apply);
  useEffect(()=>{applyRef.current=apply;},[apply]);
  const navigateRef=useRef<(destination:WorkflowDestination)=>void>(()=>{});
  useEffect(()=>{
    let index=typeof window.history.state?.zeustekIndex==='number'?window.history.state.zeustekIndex:0;
    window.history.replaceState({...window.history.state,zeustekIndex:index},'',window.location.href);
    applyRef.current(parseWorkflowDestination(window.location.search||'Overview'));
    let restoring=false,allowNext=false;
    let afterRestore:(()=>void)|null=null;
    navigateRef.current=destination=>recordNavigation.request(()=>{
      const url=workflowDestinationUrl(destination);
      if(window.location.search!==url){index++;window.history.pushState({zeustekIndex:index},'',url);}
      applyRef.current(destination);
    });
    const pop=(event:PopStateEvent)=>{
      const next=typeof event.state?.zeustekIndex==='number'?event.state.zeustekIndex:index-1;
      if(restoring){restoring=false;const action=afterRestore;afterRestore=null;action?.();return;}
      if(allowNext||!recordNavigation.guarded){
        allowNext=false;index=next;applyRef.current(parseWorkflowDestination(window.location.search||'Overview'));return;
      }
      const delta=index-next;
      if(!delta)return;
      restoring=true;
      window.history.go(delta);
      recordNavigation.request(()=>{
        const proceed=()=>{allowNext=true;window.history.go(-delta);};
        if(restoring)afterRestore=proceed;else proceed();
      });
    };
    const link=(event:Event)=>{const destination=(event as CustomEvent<WorkflowDestination>).detail;if(destination)navigateRef.current(parseWorkflowDestination(destination));};
    window.addEventListener(WORKFLOW_LINK_EVENT,link);
    window.addEventListener('popstate',pop);
    document.addEventListener('click',rememberEditorTrigger,true);
    return ()=>{window.removeEventListener(WORKFLOW_LINK_EVENT,link);window.removeEventListener('popstate',pop);document.removeEventListener('click',rememberEditorTrigger,true);navigateRef.current=()=>{};};
  },[]);
  return useCallback((input:string|WorkflowDestination)=>navigateRef.current(parseWorkflowDestination(input)),[]);
}
