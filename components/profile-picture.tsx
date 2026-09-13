'use client';
import {useState} from 'react';
import {storeDiveImage,type CardImage} from '@/lib/offline/dive-images';
import {currentDiveAccount} from '@/lib/offline/dive-store';
import {CardImageView} from './certification-images';
export function ProfilePicture({value,legacyId,change,removeLegacy}:{value:CardImage|null;legacyId:string;change:(image:CardImage|null)=>void;removeLegacy:()=>void}) {
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  return <section className="profile-picture-editor"><h3>Profile picture</h3>{value ? <CardImageView image={value} label="Current profile"/> : legacyId ? <img className="person-avatar" src={`/api/media?id=${encodeURIComponent(legacyId)}`} alt="Current profile"/> : <p>No profile picture</p>}
  <label>Choose profile image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async event=>{
    const file=event.target.files?.[0];if(!file)return;setBusy(true);
    try{change(await storeDiveImage(file,currentDiveAccount()));setMessage('Image saved on this device. Save the person to keep this picture.');}
    catch(error){setMessage(error instanceof Error?error.message:'Image could not be saved.');}finally{setBusy(false);}
  }}/></label>{(value||legacyId)&&<button type="button" className="focus-secondary" onClick={()=>{if(confirm('Remove this picture from the profile? The previous attachment is retained.')){change(null);removeLegacy();}}}>Remove picture</button>}
  <p role="status">{busy?'Saving picture…':message}</p></section>;
}
