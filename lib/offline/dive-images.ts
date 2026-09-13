import { zeustekDb } from './db';
export type CardImage = {attachmentId:string;remoteKey?:string;zoom:number;x:number;y:number};
export async function storeDiveImage(file:File,account:string):Promise<CardImage>{
  if(file.size>12*1024*1024)throw new Error('Use an image smaller than 12 MB.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use a JPEG, PNG or WebP image.');
  const attachmentId=crypto.randomUUID();await zeustekDb.diveImages.add({id:attachmentId,account,blob:file,name:file.name,createdAt:new Date().toISOString()});return {attachmentId,zoom:1,x:50,y:50};
}
export async function imageSource(image:CardImage,account:string){
  const local=await zeustekDb.diveImages.get(image.attachmentId);
  if(local?.account===account)return URL.createObjectURL(local.blob);
  if(!image.remoteKey)return '';
  const url=`/api/cert-image?key=${encodeURIComponent(image.remoteKey)}`;
  if(navigator.onLine){try{
    const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
    if(response.ok){const blob=await response.blob();if(blob.size<=12*1024*1024&&['image/jpeg','image/png','image/webp'].includes(blob.type)){
      if(!local)await zeustekDb.diveImages.put({id:image.attachmentId,account,blob,name:'card-image',remoteKey:image.remoteKey,createdAt:new Date().toISOString()});
      return URL.createObjectURL(blob);
    }}
  }catch{}}
  return navigator.onLine?url:'';
}
export async function prepareCardImages(record:Record<string,unknown>,account:string){
  const next={...record};
  for(const field of ['cardFront','cardBack','profileImage','diveMapImage']){
    const image=next[field] as CardImage|null|undefined;if(!image||image.remoteKey)continue;
    const local=await zeustekDb.diveImages.get(image.attachmentId);if(!local||local.account!==account)throw new Error('A certification image is unavailable on this device. Restore its attachment before syncing.');
    let remoteKey=local.remoteKey;
    if(!remoteKey){const form=new FormData();form.append('file',new File([local.blob],local.name,{type:local.blob.type}));form.append('attachmentId',image.attachmentId);const response=await fetch('/api/cert-image',{method:'POST',body:form});const result=await response.json() as {imageKey?:string;error?:string};if(!response.ok||!result.imageKey)throw new Error(result.error??'Image upload pending');remoteKey=result.imageKey;await zeustekDb.diveImages.update(local.id,{remoteKey});}
    next[field]={...image,remoteKey};
  }
  return next;
}
