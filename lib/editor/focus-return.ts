type EditorTrigger = {element:HTMLElement;label:string|null;text:string|null};
let trigger:EditorTrigger|null=null;
// Capture before React removes the launcher when replacing the route with its editor.
export function rememberEditorTrigger(event:Event){
  const element=event.target instanceof Element?event.target.closest<HTMLElement>('button,a'):null;
  if(element&&!element.closest('[data-record-editor-workspace]'))trigger={element,label:element.getAttribute('aria-label'),text:element.textContent};
}
export function editorReturnTrigger(){return trigger;}
