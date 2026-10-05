/** Private links only: never fetch or embed third-party media while reading a Dive. */
export function normalizeDiveVideoUrl(input:string):string|null {
 if(input.length>2048)return null;
 try {
  const url=new URL(input.trim());
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase();
  const youtube=['youtube.com','www.youtube.com','m.youtube.com'].includes(host);
  const id=host==='youtu.be'?url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1]:youtube?(url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})\/?$/)?.[1]):null;
  return id&&/^[\w-]{11}$/.test(id)?`https://www.youtube.com/watch?v=${id}`:null;
 }catch{return null;}
}
