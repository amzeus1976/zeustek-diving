import type {CardImage} from '../offline/dive-images';
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
export function moveCrop<T extends Pick<CardImage,'x'|'y'|'zoom'>>(image:T,dx:number,dy:number,size:number):T{
  if(!Number.isFinite(size)||size<=0)return image;
  return {...image,x:clamp(image.x-dx/size*100,0,100),y:clamp(image.y-dy/size*100,0,100)};
}
export function zoomCrop<T extends Pick<CardImage,'zoom'>>(image:T,delta:number):T{
  return {...image,zoom:clamp(Math.round((image.zoom+delta)*20)/20,1,3)};
}
export function resetCrop<T extends Pick<CardImage,'x'|'y'|'zoom'>>(image:T):T{
  return {...image,x:50,y:50,zoom:1};
}
