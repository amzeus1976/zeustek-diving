'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {EditorContent,useEditor,useEditorState} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Bold,Italic,Underline,List,ListOrdered,Undo2,Redo2,RemoveFormatting} from 'lucide-react';
import {editedPlanText,matchingPlanText,planTextFromPlain,type PlanTextDocument,type PlanTextNode} from '../../lib/planning/formatted-text';
import {FormattedPlanText} from './formatted-plan-text';
import styles from './rich-text-field.module.css';

const extensions=[StarterKit.configure({blockquote:false,code:false,codeBlock:false,heading:false,horizontalRule:false,link:false,strike:false,trailingNode:false})];

export function RichTextField({label,value,document,onChange,help,className=''}:{label:string;value:string;document?:PlanTextDocument|undefined;onChange:(text:string,document:PlanTextDocument|undefined)=>void;help?:ReactNode;className?:string|undefined}) {
  const labelId=useId(), callback=useRef(onChange), emitted=useRef<{text:string;document:PlanTextDocument|undefined}|null>(null);
  useEffect(()=>{callback.current=onChange;},[onChange]);
  const [initial]=useState(()=>matchingPlanText(value,document) ?? planTextFromPlain(value));
  const [plainOnly,setPlainOnly]=useState(false);
  const editor=useEditor({extensions,immediatelyRender:false,shouldRerenderOnTransaction:false,content:initial,
    editorProps:{attributes:{class:styles.editor??'',role:'textbox','aria-label':label,'aria-multiline':'true','aria-labelledby':labelId}},
    onUpdate:({editor})=>{
      const next=editedPlanText(editor.getJSON() as PlanTextNode);
      emitted.current=next;setPlainOnly(!next.document);callback.current(next.text,next.document);
    },
  });
  const state=useEditorState({editor,selector:({editor})=>editor ? {bold:editor.isActive('bold'),italic:editor.isActive('italic'),underline:editor.isActive('underline'),bullet:editor.isActive('bulletList'),numbered:editor.isActive('orderedList'),undo:editor.can().undo(),redo:editor.can().redo()} : null});
  useEffect(()=>{
    if (!editor || (emitted.current?.text===value && emitted.current.document===document)) return;
    const next=matchingPlanText(value,document) ?? planTextFromPlain(value);
    if (JSON.stringify({...editor.getJSON(),version:1})!==JSON.stringify(next)) editor.commands.setContent(next,{emitUpdate:false});
  },[editor,value,document]);
  const button=(name:string,icon:ReactNode,run:()=>void,pressed?:boolean,disabled=false)=><button key={name} type="button" title={name} aria-label={name} aria-pressed={pressed} disabled={!editor||disabled} onMouseDown={event=>event.preventDefault()} onClick={run}>{icon}</button>;
  return <div className={`${styles.field} ${className}`}>
    <div className={styles.caption}><span id={labelId}>{label}</span>{help}</div>
    <div className={styles.frame}>
      <fieldset className={styles.toolbar} aria-label={`Format ${label}`}>
        {button('Bold',<Bold/>,()=>editor?.chain().focus().toggleBold().run(),state?.bold)}
        {button('Italic',<Italic/>,()=>editor?.chain().focus().toggleItalic().run(),state?.italic)}
        {button('Underline',<Underline/>,()=>editor?.chain().focus().toggleUnderline().run(),state?.underline)}
        {button('Bullet list',<List/>,()=>editor?.chain().focus().toggleBulletList().run(),state?.bullet)}
        {button('Numbered list',<ListOrdered/>,()=>editor?.chain().focus().toggleOrderedList().run(),state?.numbered)}
        {button('Clear formatting',<RemoveFormatting/>,()=>editor?.chain().focus().unsetAllMarks().clearNodes().run())}
        {button('Undo',<Undo2/>,()=>editor?.chain().focus().undo().run(),undefined,!state?.undo)}
        {button('Redo',<Redo2/>,()=>editor?.chain().focus().redo().run(),undefined,!state?.redo)}
      </fieldset>
      {editor ? <EditorContent editor={editor}/> : <div className={styles.editor}><FormattedPlanText text={value} document={document}/></div>}
    </div>
    {plainOnly && <output>This field exceeds the formatting limit. All entered text will be saved as plain text.</output>}
  </div>;
}
