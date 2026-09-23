'use client';
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {AccessibleDialog} from '../accessible-dialog';
import {recordNavigation} from '../../lib/editor/navigation-guard';
import {editorReturnTrigger} from '../../lib/editor/focus-return';
import styles from './record-editor-workspace.module.css';

export function RecordEditorWorkspace({label,close,save,children,value,dirty=false,busy=false,saveDisabled=false,saveLabel='Save',contentClassName}:{
  label:string;close:()=>void;save?:()=>void|Promise<unknown>;children:ReactNode;value?:unknown;
  dirty?:boolean;busy?:boolean;saveDisabled?:boolean;saveLabel?:string;
  contentClassName?:string|undefined;
}){
  const root=useRef<HTMLElement>(null);
  const [initial]=useState(()=>JSON.stringify(value));
  const keepButton=useRef<HTMLButtonElement>(null);
  const [interactionDirty,setInteractionDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [confirming,setConfirming]=useState(false);
  const pending=useRef<(()=>void)|null>(null);
  const working=busy||saving;
  const changed=dirty||interactionDirty||JSON.stringify(value)!==initial;
  useEffect(()=>{if(confirming)keepButton.current?.focus({preventScroll:true});},[confirming]);
  const leave=useCallback((action:()=>void)=>{
    if(working)return;
    if(changed){if(!pending.current)pending.current=action;setConfirming(true);}
    else action();
  },[working,changed]);
  useEffect(()=>{
    const trigger=editorReturnTrigger();
    const previous=trigger?.element??(document.activeElement instanceof HTMLElement?document.activeElement:null);
    const triggerLabel=trigger?.label??previous?.getAttribute('aria-label');
    const triggerText=trigger?.text??previous?.textContent;
    const scroll={x:window.scrollX,y:window.scrollY};
    root.current?.focus({preventScroll:true});root.current?.scrollIntoView({block:'start'});
    return ()=>{requestAnimationFrame(()=>{
      const restored=previous?.isConnected?previous:[...document.querySelectorAll<HTMLElement>('button,a')].find(element=>
        triggerLabel?element.getAttribute('aria-label')===triggerLabel:Boolean(triggerText?.trim())&&element.textContent===triggerText);
      if(restored){window.scrollTo(scroll.x,scroll.y);restored.focus({preventScroll:true});}
    });};
  },[]);
  useEffect(()=>{
    if(!changed&&!working)return;
    const release=recordNavigation.register(leave);
    const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();};
    window.addEventListener('beforeunload',unload);
    return ()=>{release();window.removeEventListener('beforeunload',unload);};
  },[changed,working,leave]);
  function keepEditing(){pending.current=null;setConfirming(false);}
  async function persist(){
    if(!save||working||saveDisabled)return;
    setSaving(true);setError('');
    try{await save();}catch(reason){setError(reason instanceof Error?reason.message:'Unable to save. Your edits are retained.');}
    finally{setSaving(false);}
  }
  return <section ref={root} tabIndex={-1} aria-label={label} data-record-editor-workspace className={styles.workspace}
    onInputCapture={()=>setInteractionDirty(true)} onChangeCapture={()=>setInteractionDirty(true)}
    onClickCapture={event=>{
      const target=event.target instanceof Element?event.target:null;
      if(target?.closest('dialog'))return;
      if(target?.closest('[data-dialog-dirty]'))setInteractionDirty(true);
      if(target?.closest('[data-dialog-close]')){event.preventDefault();event.stopPropagation();leave(close);}
    }}
    onKeyDownCapture={event=>{
      if(event.key!=='Escape'||(event.target instanceof Element&&event.target.closest('dialog')))return;
      event.preventDefault();event.stopPropagation();leave(close);
    }}>
    <header className={styles.header}><div><span className="focus-eyebrow">RECORD WORKSPACE</span><h1>{label}</h1><small>{working?'Saving…':changed?'Unsaved changes':'Review and edit'}</small></div>
      <div className={styles.actions}><button type="button" className="focus-secondary" disabled={working} onClick={()=>leave(close)}>Cancel</button>
        {save&&<button type="button" className="focus-primary" disabled={working||saveDisabled} onClick={()=>void persist()}>{working?'Saving…':saveLabel}</button>}</div></header>
    <div className={[styles.body,contentClassName].filter(Boolean).join(' ')}>{children}</div>
    {error&&<p role="alert" className="dive-save-error">{error}</p>}
    <footer className={styles.actions}><button type="button" className="focus-secondary" disabled={working} onClick={()=>leave(close)}>Cancel</button>
      {save&&<button type="button" className="focus-primary" disabled={working||saveDisabled} onClick={()=>void persist()}>{working?'Saving…':saveLabel}</button>}</footer>
    {confirming&&<AccessibleDialog label="Discard unsaved changes?" className="focus-modal" close={keepEditing} containDismiss onEscape={keepEditing}>
      <h2>Discard unsaved changes?</h2><p>Your edits have not been saved.</p>
      <footer><button type="button" ref={keepButton} className="focus-primary" onClick={keepEditing}>Keep editing</button>
        <button type="button" className="focus-secondary danger" onClick={()=>{const action=pending.current;pending.current=null;setConfirming(false);action?.();}}>Discard changes</button></footer>
    </AccessibleDialog>}
  </section>;
}
