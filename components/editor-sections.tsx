'use client';
import {useEffect,useRef,useState} from 'react';

export function EditorSections({selector}:{selector:string}) {
  const ref=useRef<HTMLDivElement>(null);
  const [sections,setSections]=useState<Array<{label:string;node:HTMLElement}>>([]);
  const [selected,setSelected]=useState('');
  useEffect(()=>{
    const editor=ref.current?.closest('dialog');
    if(!editor)return;
    const update=()=>setSections(Array.from(editor.querySelectorAll<HTMLElement>(selector)).map(node=>({node,label:node.querySelector(':scope > summary,:scope > h3,:scope > .focus-eyebrow')?.textContent?.trim()||'Details'})));
    update();
    const observer=new MutationObserver(update);observer.observe(editor,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[selector]);
  return <div ref={ref} className="editor-section-nav"><label>Jump to section<select value={selected} onChange={event=>{setSelected(event.target.value);const node=sections[Number(event.target.value)]?.node;if(!node)return;if(node instanceof HTMLDetailsElement)node.open=true;node.scrollIntoView({behavior:'smooth',block:'start'});const target=node.querySelector<HTMLElement>('input,select,textarea,summary');target?.focus({preventScroll:true});}}><option value="">Choose a section</option>{sections.map((section,index)=><option key={index} value={index}>{section.label}</option>)}</select></label></div>;
}
