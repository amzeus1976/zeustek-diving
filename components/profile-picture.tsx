'use client';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {imageSource,storeDiveImage,type CardImage} from '@/lib/offline/dive-images';
import {currentDiveAccount} from '@/lib/offline/dive-store';
import {moveCrop,resetCrop,zoomCrop} from '@/lib/people/avatar-crop';

export function PersonAvatar({image,legacyId='',label,size=64,crop}:{image?:CardImage|null|undefined;legacyId?:string|undefined;label:string;size?:number;crop?:Pick<CardImage,'x'|'y'|'zoom'>|undefined}){
  const [source,setSource]=useState({key:'',url:''});
  const attachmentId=image?.attachmentId,remoteKey=image?.remoteKey;
  useEffect(()=>{let alive=true,objectUrl='';if(!attachmentId)return;
    void imageSource({attachmentId,...(remoteKey?{remoteKey}:{}),zoom:1,x:50,y:50},currentDiveAccount()).then(url=>{objectUrl=url;if(alive)setSource({key:attachmentId,url});else if(url.startsWith('blob:'))URL.revokeObjectURL(url);}).catch(()=>{if(alive)setSource({key:attachmentId,url:''});});
    return()=>{alive=false;if(objectUrl.startsWith('blob:'))URL.revokeObjectURL(objectUrl);};
  },[attachmentId,remoteKey]);
  const src=image?(source.key===attachmentId?source.url:''):legacyId?`/api/media?id=${encodeURIComponent(legacyId)}`:'';
  /* oxlint-disable-next-line next/no-img-element -- Authenticated media and local blob URLs cannot use image optimization. */
  return <span className="person-avatar-viewport" style={{width:size,height:size}}>{src?<img src={src} alt={label} draggable={false} style={{objectPosition:`${crop?.x??image?.x??50}% ${crop?.y??image?.y??50}%`,transform:`scale(${crop?.zoom??image?.zoom??1})`}}/>:<span aria-label={`${label}: no picture`}>👤</span>}</span>;
}

export function ProfilePicture({value,legacyId,change,removeLegacy,recordLabel='person'}:{value:CardImage|null;legacyId:string;change:(image:CardImage|null)=>void;removeLegacy:()=>void;recordLabel?:string}) {
  const [draft,setDraft]=useState<CardImage|null>(value);
  const [legacyCrop,setLegacyCrop]=useState<CardImage>({attachmentId:'legacy',zoom:1,x:50,y:50});
  const [editing,setEditing]=useState(Boolean(value||legacyId));
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const drag=useRef<{x:number;y:number}|null>(null);
  const viewport=useRef<HTMLButtonElement>(null);
  const current=draft??(legacyId?legacyCrop:null);
  const update=(image:CardImage)=>{if(image.attachmentId==='legacy')setLegacyCrop(image);else setDraft(image);};
  async function replace(file:File){setBusy(true);setMessage('');try{setDraft(await storeDiveImage(file,currentDiveAccount()));setEditing(true);}catch(error){setMessage(error instanceof Error?error.message:'Image could not be saved.');}finally{setBusy(false);}}
  async function saveCrop(){if(!current)return;setBusy(true);setMessage('');try{
    let image=draft;
    if(!image&&legacyId){const response=await fetch(`/api/media?id=${encodeURIComponent(legacyId)}`);if(!response.ok)throw new Error('Legacy image is unavailable. Keep the original or choose Replace.');const blob=await response.blob();image=await storeDiveImage(new File([blob],`legacy-profile.${blob.type.split('/')[1]??'jpg'}`,{type:blob.type}),currentDiveAccount());image={...image,x:current.x,y:current.y,zoom:current.zoom};}
    if(image){change(image);if(legacyId)removeLegacy();setDraft(image);setEditing(false);setMessage(`Crop ready. Save the ${recordLabel} to keep this picture.`);}
  }catch(error){setMessage(error instanceof Error?error.message:'Could not save crop.');}finally{setBusy(false);}}
  function move(event:PointerEvent<HTMLButtonElement>){if(!drag.current||!current)return;const size=viewport.current?.clientWidth??160;update(moveCrop(current,event.clientX-drag.current.x,event.clientY-drag.current.y,size));drag.current={x:event.clientX,y:event.clientY};}
  return <section className="profile-picture-editor"><h3>Profile picture</h3>
    <button type="button" ref={viewport} className="person-avatar-crop" aria-label="Circular crop preview" disabled={!editing} title="Drag or use arrow keys to recenter the photo"
      onPointerDown={event=>{if(!editing||!current)return;drag.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
      onKeyDown={event=>{if(!editing||!current)return;const axes:Record<string,[number,number]>={ArrowLeft:[-4,0],ArrowRight:[4,0],ArrowUp:[0,-4],ArrowDown:[0,4]};const delta=axes[event.key];if(delta){event.preventDefault();update(moveCrop(current,delta[0],delta[1],160));}}}>
      <PersonAvatar image={draft} legacyId={draft?'':legacyId} label="Profile crop" size={160} crop={current??undefined}/>
    </button>
    <label>{current?'Replace':'Choose profile image'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void replace(file);event.target.value='';}}/></label>
    {current&&editing&&<><div className="person-avatar-zoom"><button type="button" aria-label="Zoom out" onClick={()=>update(zoomCrop(current,-.1))}>−</button><label>Zoom <input type="range" min="1" max="3" step="0.05" value={current.zoom} onChange={event=>update({...current,zoom:Number(event.target.value)})}/></label><button type="button" aria-label="Zoom in" onClick={()=>update(zoomCrop(current,.1))}>+</button></div>
      <div className="record-actions"><button type="button" className="focus-secondary" onClick={()=>update(resetCrop(current))}>Reset</button><button type="button" className="focus-secondary" onClick={()=>{setDraft(value);setLegacyCrop({attachmentId:'legacy',zoom:1,x:50,y:50});setEditing(false);setMessage('Crop cancelled.');}}>Cancel</button><button type="button" className="focus-primary" disabled={busy} onClick={()=>void saveCrop()}>Save Crop</button></div></>}
    {current&&!editing&&<div className="record-actions"><button type="button" className="focus-secondary" onClick={()=>setEditing(true)}>Adjust crop</button><button type="button" className="focus-secondary" onClick={()=>{if(confirm('Remove this picture from the profile? The previous attachment is retained.')){change(null);removeLegacy();setDraft(null);}}}>Remove picture</button></div>}
    <output>{busy?'Saving picture…':message}</output>
  </section>;
}
