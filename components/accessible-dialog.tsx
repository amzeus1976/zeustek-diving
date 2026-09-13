'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export function AccessibleDialog({label,className,close,children}:{label:string;className:string;close:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const dialog=ref.current;dialog?.showModal();
    if(dialog){dialog.scrollTop=0;dialog.focus({preventScroll:true});}
    return()=>{dialog?.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return <dialog tabIndex={-1} ref={ref} className={className} aria-label={label} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target!==event.currentTarget)return;const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}>{children}</dialog>;
}
